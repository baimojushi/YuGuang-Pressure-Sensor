import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {handle} from '../shared/backend.mjs';
import {signCareAck} from '../shared/care-ack.mjs';

const UUID1='34f5998d-7065-4fdb-94aa-84dc793d1d63';
const UUID2='34f5998d-7065-4fdb-94aa-84dc793d1d64';
const SECRET='local-test-only-bridge-key-must-be-32-characters-long';
const stateFor = clock => ({
 users:[{id:'sender'},{id:'receiver'},{id:'stranger'}],sessions:[],
 pairs:[{id:'pair',memberIds:['sender','receiver'],active:true}],
 devices:[{id:'business-board-a',ownerId:'receiver',keyHash:'not-used-in-webhook'}],
 messages:[{id:'care-000045',pair_id:'pair',sender_id:'sender',receiver_id:'receiver',intent:'miss',status:'delivered',delivered:clock-1000,received:null}],
 commands:[{id:'cmd-1',pairId:'pair',deviceId:'business-board-a',messageIds:['care-000045'],status:'delivered',delivered:clock-1000,lightEndsAt:clock+5000}],
 touches:[],breathing:[],rests:[],uploads:[],gestures:[],failures:{}
});
const bodyFor=clock=>({
 schema_version:'YG-IFACE-2.1.0',type:'care_ack',event_id:UUID1,message_id:'care-000045',
 device_id:'business-board-a',source:'gpio5_ir',ack_type:'received',reply_text:'收到了',occurred_at_ms:clock
});
function fixture() {
 const clock=Date.now();
 const sql=new DatabaseSync(':memory:');
 sql.exec('CREATE TABLE spaces(id TEXT PRIMARY KEY,payload TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 0)');
 sql.prepare('INSERT INTO spaces VALUES(?,?,0)').run('live-v2',JSON.stringify(stateFor(clock)));
 const DB={prepare(query){return {bind(...args){return {
  async first(){return sql.prepare(query).get(...args)||null;},
  async run(){const r=sql.prepare(query).run(...args);return {meta:{changes:Number(r.changes)}};}
 };}};}};
 const env={NOW:()=>clock,DB,BUCKET:{},CARE_ACK_BRIDGE_SECRET:SECRET};
 const state=()=>JSON.parse(sql.prepare('SELECT payload FROM spaces WHERE id=?').get('live-v2').payload);
 const write=s=>sql.prepare('UPDATE spaces SET payload=?,version=version+1 WHERE id=?').run(JSON.stringify(s),'live-v2');
 async function request(body=bodyFor(clock),opts={}) {
  const raw=JSON.stringify(body);
  const stamp=String(opts.stamp??clock);
  const sig=await signCareAck(raw,stamp,opts.secret??SECRET);
  return handle(new Request('https://yg.test'+(opts.path||'/api/bridge/care-ack'),{
   method:'POST',headers:{'content-type':'application/json',
    'x-yg-timestamp-ms':stamp,'x-yg-signature':opts.signature??sig},body:raw
  }),opts.env||env);
 }
 return {clock,sql,env,state,write,request};
}

test('V2.1 bridge: authenticated GPIO5 event atomically acknowledges exactly one displayed message',async()=>{
 const f=fixture();try {
  const first=await f.request();assert.equal(first.status,200);
  assert.deepEqual(await first.json(),{acknowledged:true,duplicate:false,message_id:'care-000045',event_id:UUID1});
  const stored=f.state();
  assert.equal(stored.messages[0].status,'received');
  assert.equal(stored.messages[0].received,f.clock);
  assert.equal(stored.messages[0].acknowledged_at,new Date(f.clock).toISOString());
  assert.equal(stored.messages[0].ack_source,'gpio5_ir');
  assert.equal(stored.touches.length,1);
  assert.equal(stored.commands[0].status,'received');
  const retry=await f.request();assert.equal(retry.status,200);assert.equal((await retry.json()).duplicate,true);
  assert.equal(f.state().touches.length,1);
  assert.equal((await f.request({...bodyFor(f.clock),event_id:UUID2})).status,409);
 } finally {f.sql.close();}
});

test('V2.1 bridge: unsigned, tampered, expired, demo and missing config requests fail closed',async()=>{
 const f=fixture();try {
  const bad=await f.request(undefined,{signature:'0'.repeat(64)});
  assert.equal(bad.status,401);
  assert.equal((await bad.text()).includes(SECRET),false);
  assert.equal((await f.request({...bodyFor(f.clock),message_id:'tampered'}, {signature:'0'.repeat(64)})).status,401);
  assert.equal((await f.request(undefined,{stamp:f.clock-301000})).status,401);
  assert.equal((await f.request(undefined,{path:'/api/demo/bridge/care-ack'})).status,404);
  assert.equal((await f.request(undefined,{env:{...f.env,CARE_ACK_BRIDGE_SECRET:undefined}})).status,503);
  assert.equal(f.state().touches.length,0);
 } finally {f.sql.close();}
});

test('V2.1 bridge: rejects unauthorized recipients, mismatched device, stale display and malformed payloads',async()=>{
 const f=fixture();try {
  assert.equal((await f.request({...bodyFor(f.clock),device_id:'unpaired-other'})).status,403);
  assert.equal((await f.request({...bodyFor(f.clock),message_id:'care-someone-else'})).status,403);
  assert.equal((await f.request({...bodyFor(f.clock),source:'voice'})).status,400);
  assert.equal((await f.request({...bodyFor(f.clock),event_id:'not-a-uuid'})).status,400);
  assert.equal((await f.request({...bodyFor(f.clock),unknown:'x'})).status,400);
  assert.equal((await f.request({...bodyFor(f.clock),occurred_at_ms:f.clock-50000})).status,409);
  let s=f.state();s.commands[0].status='offered';f.write(s);
  assert.equal((await f.request()).status,409);
  s=f.state();s.commands[0].status='delivered';s.pairs[0].active=false;f.write(s);
  assert.equal((await f.request()).status,403);
  assert.equal(f.state().touches.length,0);
 } finally {f.sql.close();}
});

test('V2.1 bridge: concurrent conflicting receipts have one winner under CAS',async()=>{
 const f=fixture();try {
  const [a,b]=await Promise.all([f.request(),f.request({...bodyFor(f.clock),event_id:UUID2})]);
  assert.deepEqual([a.status,b.status].sort(),[200,409]);
  assert.equal(f.state().touches.length,1);
 } finally {f.sql.close();}
});
