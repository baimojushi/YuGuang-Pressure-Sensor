// Safe connectivity check: no example users, messages, devices or breathing data.
import assert from 'node:assert/strict';
import {createSupabaseBindings} from '../shared/supabase.mjs';
import {Store} from '../shared/service.mjs';

const {DB, BUCKET} = createSupabaseBindings(process.env);
const store = new Store(DB, 'live');
await store.ensure();
const before = await store.read();
const update = await DB.prepare('UPDATE spaces SET payload=?,version=version+1 WHERE id=? AND version=?').bind(before.payload, before.id, Number(before.version)).run();
assert.equal(update.meta.changes, 1, '并发写入发生，请稍后重试检查');
const after = await store.read();
assert.equal(after.version, Number(before.version) + 1);
assert.equal(after.payload, before.payload);
let publicDataBlocked = null;
if (process.env.SUPABASE_PUBLISHABLE_KEY) {
  const publicData = await fetch(process.env.SUPABASE_URL + '/rest/v1/yuguang_spaces?select=id', {headers: {apikey: process.env.SUPABASE_PUBLISHABLE_KEY}, signal: AbortSignal.timeout(15000)});
  const denied = await publicData.json();
  assert.ok([401, 403].includes(publicData.status) && denied.code === '42501', '公开客户端必须因表权限被拒绝，不能把无效 API key 当作权限验证');
  publicDataBlocked = true;
}
const key = 'live-v2/_connection-check/' + crypto.randomUUID() + '.wav';
const wav = new Uint8Array(46), data = new DataView(wav.buffer);
for (const [offset, value] of [[0, 'RIFF'], [8, 'WAVE'], [12, 'fmt '], [36, 'data']]) wav.set(new TextEncoder().encode(value), offset);
data.setUint32(4, 38, true); data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, 1, true); data.setUint32(24, 8000, true); data.setUint32(28, 16000, true); data.setUint16(32, 2, true); data.setUint16(34, 16, true); data.setUint32(40, 2, true);
let privateBlocked = false;
try {
  await BUCKET.put(key, wav.buffer, {httpMetadata: {contentType: 'audio/wav'}});
  const object = await BUCKET.get(key);
  assert.deepEqual(new Uint8Array(await new Response(object.body).arrayBuffer()), wav);
  const bucket = process.env.SUPABASE_AUDIO_BUCKET || 'yuguang-audio';
  const publicResponse = await fetch(process.env.SUPABASE_URL + '/storage/v1/object/public/' + bucket + '/' + key, {signal: AbortSignal.timeout(15000)});
  assert.ok(!publicResponse.ok, '音频桶不能允许公开读取');
  privateBlocked = true;
} finally {
  await BUCKET.delete(key);
}
const state = JSON.parse(after.payload);
console.log(JSON.stringify({database: 'Supabase', connected: true, casVerified: true, publicDataBlocked, audioRoundTrip: true, publicAudioBlocked: privateBlocked, probeRemoved: true, businessCounts: Object.fromEntries(Object.entries(state).filter(([, value]) => Array.isArray(value)).map(([name, value]) => [name, value.length]))}, null, 2));
