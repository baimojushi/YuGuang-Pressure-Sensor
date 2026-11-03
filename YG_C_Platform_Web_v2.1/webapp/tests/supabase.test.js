import {test} from 'node:test';
import assert from 'node:assert/strict';
import {contract} from './contract.mjs';
import {handle} from '../shared/backend.mjs';
import {createSupabaseBindings} from '../shared/supabase.mjs';

// Exercise the full product contract through PostgREST-shaped requests, including CAS races.
function restServer(DB, BUCKET) {
  return async (input, options = {}) => {
    const url = new URL(input), method = options.method || 'GET';
    assert.equal(options.headers.apikey, 'sb_secret_contract_fixture');
    assert.equal(options.headers.Authorization, undefined);
    if (url.pathname === '/rest/v1/yuguang_spaces') {
      const id = url.searchParams.get('id')?.replace('eq.', '');
      if (method === 'GET') return Response.json([await DB.prepare('SELECT * FROM spaces WHERE id=?').bind(id).first()].filter(Boolean));
      const body = JSON.parse(options.body);
      if (method === 'POST') {
        assert.equal(body.id, 'live-v2');
        assert.match(options.headers.Prefer, /ignore-duplicates/);
        await DB.prepare('INSERT OR IGNORE INTO spaces(id,payload,version) VALUES(?,?,0)').bind(body.id, body.payload).run();
        return new Response(null, {status: 201});
      }
      if (method === 'PATCH') {
        const version = Number(url.searchParams.get('version').replace('eq.', ''));
        assert.equal(body.version, version + 1);
        const r = await DB.prepare('UPDATE spaces SET payload=?,version=version+1 WHERE id=? AND version=?').bind(body.payload, id, version).run();
        return Response.json(r.meta.changes ? [{id}] : []);
      }
    }
    const prefix = '/storage/v1/object/yuguang-audio';
    if (url.pathname === prefix && method === 'DELETE') {
      await BUCKET.delete(JSON.parse(options.body).prefixes);
      return Response.json([]);
    }
    if (url.pathname.startsWith(prefix + '/')) {
      const name = url.pathname.slice(prefix.length + 1).split('/').map(decodeURIComponent).join('/');
      assert.ok(name.startsWith('live-v2/'));
      if (method === 'POST') {await BUCKET.put(name, options.body); return Response.json({Key: name});}
      if (method === 'GET') {const object = await BUCKET.get(name); return object ? new Response(object.body) : new Response(null, {status: 404});}
    }
    throw Error('Unexpected storage request');
  };
}
contract((request, env) => handle(request, {...env, LIVE_STORAGE: 'supabase', SUPABASE_URL: 'https://contract-fixture.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_contract_fixture', SUPABASE_FETCH: restServer(env.DB, env.BUCKET)}), false, 'Supabase HTTP 适配器：真实业务协议、并发、权限和正式展示隔离');

test('Supabase 配置或网络失效时明确失败，不降级写入本地，也不泄露密钥', async () => {
  let localTouched = false;
  const env = {LIVE_STORAGE: 'supabase', DB: {prepare() {localTouched = true; throw Error('must not use local');}}, BUCKET: {}};
  const missing = await handle(new Request('https://yg.test/api/config'), env);
  assert.equal(missing.status, 503); assert.equal(localTouched, false);
  const secret = 'sb_secret_hidden_fixture';
  const broken = await handle(new Request('https://yg.test/api/config'), {...env, SUPABASE_URL: 'https://test.supabase.co', SUPABASE_SECRET_KEY: secret, SUPABASE_FETCH: async () => {throw Error(secret);}});
  assert.equal(broken.status, 503); assert.ok(!(await broken.text()).includes(secret)); assert.equal(localTouched, false);
  assert.throws(() => createSupabaseBindings({SUPABASE_URL: 'https://test.supabase.co', SUPABASE_SECRET_KEY: 'sb_publishable_wrong'}));
  const demo = await handle(new Request('https://yg.test/api/demo/health'), env);
  assert.equal(demo.status, 200); assert.equal((await demo.json()).mode, 'demo');
});

test('Supabase 适配器拒绝展示空间和越界数据库查询', async () => {
  const {DB} = createSupabaseBindings({SUPABASE_URL: 'https://test.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_fixture'}, async () => {throw Error('must not send');});
  await assert.rejects(DB.prepare('SELECT * FROM spaces WHERE id=?').bind('demo-v2').first(), /展示数据/);
  await assert.rejects(DB.prepare('DROP TABLE spaces').bind().run(), /不支持/);
});
