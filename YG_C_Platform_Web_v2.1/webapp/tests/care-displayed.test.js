import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {handle} from '../shared/backend.mjs';
import {signCareAck} from '../shared/care-ack.mjs';
const key='dev-display-bridge-secret-0123456789ABCDEF';
function fixture(){
 const clock=Date.now(),db=new DatabaseSync(':memory:');
 db.exec('CREATE TABLE spaces(id TEXT PRIMARY KEY,payload TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 0)');
 const payload={users:[{id:'sender'},{id:'owner'}],sessions:[],pairs:[{id:'pair',memberIds:['sender','owner'],active:true}],
  devices:[{id:'lamp-001',ownerId:'owner',focus:false,power:true,nextOfferAt:0}],
  messages:[{id:'msg-001',pair_id:'pair',receiver_id:'owner',status:'queued'}],
  commands:[{id:'cmd-001',pairId:'pair',deviceId:'lamp-001',messageIds:['msg-001'],status:'offered',light:{durationMs:5600}}],
  touches:[],breathing:[],rests:[],uploads:[],gestures:[],lightEvents:[],failures:{}};
 db.prepare('INSERT INTO spaces VALUES(?,?,0)').run('live-v2',JSON.stringify(payload));
 const DB={prepare(query){return {bind(...args){return {
  async first(){return db.prepare(query).get(...args)||null},
  async run(){const result=db.prepare(query).run(...args);return {meta:{changes:Number(result.changes)}}}
 }}}}};
 const env={DB,BUCKET:{},NOW:()=>clock,CARE_DISPLAY_BRIDGE_SECRET:key};
 const event={schema_version:'YG-IFACE-2.1.0',type:'care_displayed',
   command_id:'cmd-001',message_id:'msg-001',device_id:'lamp-001',rendered_at_ms:clock-120};
 const state=()=>JSON.parse(db.prepare('SELECT payload FROM spaces WHERE id=?').get('live-v2').payload);
 const put=s=>db.prepare('UPDATE spaces SET payload=?,version=version+1 WHERE id=?').run(JSON.stringify(s),'live-v2');
 const request=async (e=event,options={})=>{
  const raw=JSON.stringify(e);const stamp=String(options.stamp??clock);
  const signature=await signCareAck(raw,stamp,key);
  return handle(new Request('https://yg.test'+(options.path||'/api/bridge/care-displayed'),{
   method:'POST',body:raw,headers:{'content-type':'application/json','x-yg-timestamp-ms':stamp,
    'x-yg-signature':options.signature??signature}}),options.env??env);
 };
 return {db,clock,event,env,request,state,put};
}
test('signed real-render event moves exactly one queued message to delivered; duplicate safe',async()=>{
 const f=fixture();try{
  let res=await f.request();assert.equal(res.status,200);assert.equal((await res.json()).recorded,true);
  const s=f.state();assert.equal(s.messages[0].status,'delivered');
  assert.equal(s.messages[0].delivered,f.event.rendered_at_ms);
  assert.equal(s.commands[0].lightEndsAt,f.event.rendered_at_ms+5600);
  assert.equal(s.lightEvents.filter(e=>e.type==='delivered').length,1);
  res=await f.request();assert.equal(res.status,200);assert.equal((await res.json()).duplicate,true);
  assert.equal(f.state().lightEvents.length,1);
  assert.equal((await f.request({...f.event,rendered_at_ms:f.event.rendered_at_ms+30})).status,409);
 }finally{f.db.close()}
});
test('render receipt blocks unsigned, wrong device/command, demo and invalid order',async()=>{
 const f=fixture();try{
  assert.equal((await f.request(undefined,{signature:'0'.repeat(64)})).status,401);
  assert.equal((await f.request({...f.event,device_id:'foreign'})).status,403);
  assert.equal((await f.request({...f.event,message_id:'wrong-msg'})).status,409);
  assert.equal((await f.request({...f.event,rendered_at_ms:f.clock-301000})).status,400);
  assert.equal((await f.request(undefined,{path:'/api/demo/bridge/care-displayed'})).status,404);
  let s=f.state();s.devices[0].focus=true;f.put(s);
  assert.equal((await f.request()).status,409);
  s=f.state();s.devices[0].focus=false;s.commands[0].messageIds.push('extra');f.put(s);
  assert.equal((await f.request()).status,409);
 }finally{f.db.close()}
});
test('device render delivery cannot happen before matching paired sender message exists',async()=>{
 const f=fixture();try{
  let s=f.state();s.pairs[0].active=false;f.put(s);
  assert.equal((await f.request()).status,403);
  s=f.state();s.pairs[0].active=true;s.messages[0].status='sent';f.put(s);
  assert.equal((await f.request()).status,403);
 }finally{f.db.close()}
});
test('hardware pending_single reserves one message per cloud command for A firmware',async()=>{
 const f=fixture();try{
  let s=f.state();
  s.messages[0].intent='miss';s.messages[0].replyPreference='none';
  s.messages.push({...s.messages[0],id:'msg-002'});
  s.commands=[];
  const key='yg_real_device_key_for_a_board_bridge_2026';
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key));
  s.devices[0].keyHash=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
  s.devices[0].lastSeen=f.clock;
  f.put(s);
  const response=await handle(new Request('https://yg.test/api/hardware/lamp-001/pending_single',{
   headers:{'x-device-key':key}}),f.env);
  assert.equal(response.status,200);
  const value=await response.json();
  assert.equal(value.command.messageIds.length,1);
  assert.equal(value.command.messageIds[0],'msg-001');
  assert.equal(f.state().messages.length,2);
 }finally{f.db.close()}
});
