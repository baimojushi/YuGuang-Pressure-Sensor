// Server-only HTTP adapters. No service key or private object URL is sent to the browser.
export function createSupabaseBindings(env, send = fetch) {
  const origin = String(env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = env.SUPABASE_SECRET_KEY || '';
  const bucket = env.SUPABASE_AUDIO_BUCKET || 'yuguang-audio';
  const unavailable = message => Object.assign(Error(message), {status: 503});
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(origin) || !key || key.startsWith('sb_publishable_')) {
    throw unavailable('正式数据库尚未配置完成，请联系项目维护者');
  }
  if (!/^[a-z0-9-]+$/.test(bucket)) throw unavailable('音频存储配置无效');
  const headers = {apikey: key};
  // Legacy service-role JWTs need Authorization; new secret keys use apikey only.
  if (!key.startsWith('sb_secret_')) {
    try { if (JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role !== 'service_role') throw Error(); }
    catch { throw unavailable('请配置服务端专用 Supabase 密钥'); }
    headers.Authorization = 'Bearer ' + key;
  }
  async function request(route, options = {}, allowMissing = false) {
    let response;
    try {
      response = await send(origin + route, {...options, headers: {...headers, ...options.headers}, signal: AbortSignal.timeout(15000)});
    } catch { throw unavailable('云数据库连接暂时不可用，请稍后重试'); }
    if (allowMissing && response.status === 404) return null;
    if (!response.ok) throw unavailable('云端存储请求未完成（' + response.status + '），请稍后重试');
    return response;
  }
  const table = '/rest/v1/yuguang_spaces';
  function space(id) { if (id !== 'live-v2') throw unavailable('展示数据不得进入正式数据库'); return 'id=eq.' + encodeURIComponent(id); }
  const DB = {prepare(query) { return {bind(...args) { return {
    async first() {
      if (query !== 'SELECT * FROM spaces WHERE id=?') throw unavailable('不支持的数据库查询');
      const response = await request(table + '?' + space(args[0]) + '&select=id,payload,version&limit=1');
      return (await response.json())[0] || null;
    },
    async run() {
      if (query === 'INSERT OR IGNORE INTO spaces(id,payload,version) VALUES(?,?,0)') {
        space(args[0]);
        await request(table + '?on_conflict=id', {method: 'POST', headers: {'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal'}, body: JSON.stringify({id: args[0], payload: args[1], version: 0})});
        return {meta: {changes: 0}};
      }
      if (query === 'UPDATE spaces SET payload=?,version=version+1 WHERE id=? AND version=?') {
        const [payload, id, version] = args;
        if (!Number.isSafeInteger(version) || version < 0) throw unavailable('数据库版本无效');
        const response = await request(table + '?' + space(id) + '&version=eq.' + version + '&select=id', {method: 'PATCH', headers: {'Content-Type': 'application/json', Prefer: 'return=representation'}, body: JSON.stringify({payload, version: version + 1})});
        return {meta: {changes: (await response.json()).length}};
      }
      throw unavailable('不支持的数据库操作');
    }
  };}};}};
  const objectPath = name => '/storage/v1/object/' + bucket + '/' + name.split('/').map(encodeURIComponent).join('/');
  const BUCKET = {
    async put(name, value, options = {}) {
      await request(objectPath(name), {method: 'POST', headers: {'Content-Type': (options.httpMetadata?.contentType || 'application/octet-stream').split(';')[0], 'x-upsert': 'true'}, body: value});
    },
    async get(name) {
      const response = await request(objectPath(name), {}, true);
      return response ? {body: response.body} : null;
    },
    async delete(names) {
      await request('/storage/v1/object/' + bucket, {method: 'DELETE', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({prefixes: Array.isArray(names) ? names : [names]})});
    }
  };
  return {DB, BUCKET, STORAGE_LABEL: 'Supabase PostgreSQL + private Storage'};
}
