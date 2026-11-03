import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';

export function contract(handle,platform,label){test(label,async t=>{
 const sql=new DatabaseSync(':memory:');sql.exec('CREATE TABLE spaces(id TEXT PRIMARY KEY,payload TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 0)');
 const DB={prepare(q){return {bind(...a){return {async first(){await Promise.resolve();return sql.prepare(q).get(...a)||null;},async run(){await Promise.resolve();const r=sql.prepare(q).run(...a);return {meta:{changes:Number(r.changes)}};}};}};}};
 const files=new Map(),BUCKET={async put(k,b){files.set(k,b)},async get(k){return files.has(k)?{body:new Uint8Array(files.get(k))}:null},async delete(ks){for(const k of Array.isArray(ks)?ks:[ks])files.delete(k)}};
 let clock=Date.now(),owner,friend,third,device,firstCommand,voiceId,staleFriendInvite;
 const env={DB,BUCKET,AUTH_PROVIDER:platform?'platform':'password',NOW:()=>clock};
 const call=async(path,actor,method='GET',body,extra={})=>{const headers={...(actor?.identity?{'oai-authenticated-user-id':actor.identity}:{}),...(actor?.token?{Authorization:'Bearer '+actor.token}:{}),...extra};if(body&&!(body instanceof FormData))headers['Content-Type']='application/json';const r=await handle(new Request('https://yg.test/api'+path,{method,headers,body:body instanceof FormData?body:body?JSON.stringify(body):undefined}),env);return {status:r.status,data:r.headers.get('Content-Type')?.includes('json')?await r.json():new Uint8Array(await r.arrayBuffer())};};
 const register=async(name)=>{const actor=platform?{identity:'identity-'+name}:{};const b={name,account:name.toLowerCase(),password:'real-password-2026-'+name};assert.equal((await call('/register',actor,'POST',b)).status,201);const r=await call('/login',actor,'POST',b);assert.equal(r.status,200);assert.ok(!Object.hasOwn(r.data.user,'role'));return {...actor,token:r.data.token,user:r.data.user};};
 const hw=(action,method='GET',body,key=device?.key)=>call('/hardware/'+device.deviceId+'/'+action,null,method,body,{'X-Device-Key':key});
 const send=(intent='miss',more={},actor=friend)=>call('/messages',actor,'POST',{intent,note:'来自真实测试用户的心意',clientId:crypto.randomUUID(),...more});
 await t.test('正式版从空白开始；演示账号、配对和密钥不能进入正式版',async()=>{
  assert.equal((await call('/config')).data.mode,'live');const live=JSON.parse(sql.prepare('SELECT payload FROM spaces WHERE id=?').get('live-v2').payload);for(const k of ['users','pairs','devices','messages','breathing'])assert.equal(live[k].length,0);
  assert.equal((await call('/login',null,'POST',{account:'ayu',password:'yuguang1031'})).status,401);
  const d=(await call('/demo/login',null,'POST',{account:'ayu',password:'yuguang1031'})).data;assert.ok(d.token);assert.equal((await call('/state',{token:d.token})).status,401);assert.equal((await call('/demo/state',{token:d.token})).data.peer.name,'小满');
  assert.equal(JSON.parse(sql.prepare('SELECT payload FROM spaces WHERE id=?').get('live-v2').payload).users.length,0);
 });
 await t.test('建立独立个人身份，跨账号数据不互相冒用',async()=>{owner=await register('Owner');friend=await register('Friend');third=await register('Third');const state=(await call('/state',owner)).data;assert.equal(state.pair,null);assert.equal(state.device,null);assert.deepEqual(state.messages,[]);assert.ok(!JSON.stringify(state).includes('digest'));assert.ok(!JSON.stringify(state).includes('小满'));assert.equal((await call('/breathing',friend)).data.sessions.length,0);if(platform)assert.equal((await call('/state',{identity:'unknown'})).status,401);else assert.equal((await call('/register',null,'POST',{name:'A',role:'receiver',account:'bad',password:'short'})).status,400);});
 await t.test('双方没有玩偶也能邀请、收发与主动回应，不需要先买设备',async()=>{
  const code=(await call('/invites',friend,'POST',{})).data.code;
  assert.equal((await call('/pair',owner,'POST',{code})).status,200);
  const a=await send('miss',{},friend),b=await send('meal',{},owner);
  assert.equal(a.status,201);assert.equal(b.status,201);
  const state=(await call('/state',owner)).data;assert.equal(state.device,null);
  assert.ok(state.messages.some(m=>m.id===a.data.id&&m.direction==='incoming'));
  assert.ok(state.messages.some(m=>m.id===b.data.id&&m.direction==='outgoing'));
  const stored=JSON.parse(sql.prepare('SELECT payload FROM spaces WHERE id=?').get('live-v2').payload);
  assert.ok(stored.messages.every(m=>m.status==='saved'));
  assert.equal((await call('/messages/'+a.data.id+'/ack',owner,'POST',{eventId:'phone-only-ack'})).status,200);
  assert.ok((await call('/state',friend)).data.messages.find(m=>m.id===a.data.id).received);
  assert.equal((await call('/device',owner,'PATCH',{focus:true})).status,409);
  await call('/pair',friend,'DELETE');
 });
 await t.test('真实设备绑定、单次显示密钥、跨版本隔离',async()=>{assert.equal((await call('/device',third,'POST',{})).status,201);const r=await call('/device',owner,'POST',{});assert.equal(r.status,201);device=r.data;assert.ok(device.deviceId.startsWith('lamp-'));assert.ok(device.key.startsWith('yg_'));assert.equal((await call('/device',owner,'POST',{})).status,409);const state=(await call('/state',owner)).data;assert.equal(state.device.online,false);assert.ok(!JSON.stringify(state).includes(device.key));assert.equal((await hw('pending','GET',null,'yg-lamp-demo-1031')).status,401);assert.equal((await call('/simulator/heartbeat',owner,'POST',{})).status,404);});
 await t.test('不同个人账号真实配对、一次性邀请码、拒绝第三者',async()=>{staleFriendInvite=(await call('/invites',friend,'POST',{})).data;assert.ok(staleFriendInvite.code);assert.equal((await call('/pair',friend,'POST',{code:staleFriendInvite.code})).status,400);const invite=(await call('/invites',owner,'POST',{})).data;assert.equal((await call('/pair',friend,'POST',{code:invite.code})).status,200);assert.equal((await call('/pair',third,'POST',{code:invite.code})).status,400);assert.equal((await call('/state',owner)).data.peer.id,friend.user.id);assert.equal((await call('/state',friend)).data.peer.id,owner.user.id);assert.equal((await send('miss',{},third)).status,403);
  const row=sql.prepare('SELECT payload FROM spaces WHERE id=?').get('live-v2'),legacy=JSON.parse(row.payload),pair=legacy.pairs.find(p=>p.active);
  assert.deepEqual(new Set(pair.memberIds),new Set([owner.user.id,friend.user.id]));
  pair.senderId=friend.user.id;pair.receiverId=owner.user.id;delete pair.memberIds;
  legacy.users.find(u=>u.id===owner.user.id).role='receiver';legacy.users.find(u=>u.id===friend.user.id).role='sender';
  sql.prepare('UPDATE spaces SET payload=? WHERE id=?').run(JSON.stringify(legacy),'live-v2');
  assert.equal((await call('/state',friend)).data.peer.id,owner.user.id);
 });
 await t.test('并发与重传不丢消息，专注与离线只排队',async()=>{await call('/device',owner,'PATCH',{focus:true});const rs=await Promise.all(Array.from({length:4},()=>send()));assert.ok(rs.every(r=>r.status===201));const id='retry-message';const a=await send('miss',{clientId:id}),b=await send('miss',{clientId:id});assert.equal(a.data.id,b.data.id);await send('meal');assert.equal((await hw('pending')).data.command,null);await hw('heartbeat','POST',{});assert.equal((await hw('pending')).data.command,null);await call('/device',owner,'PATCH',{focus:false});assert.equal((await call('/state',friend)).data.messages.length,6);assert.equal((await call('/state',friend)).data.device,null);});
 await t.test('单轮淡出、不等触摸也继续；设备接收不暴露成已读',async()=>{clock+=1001;firstCommand=(await hw('pending')).data.command;assert.equal(firstCommand.messageIds.length,5);assert.equal(firstCommand.light.cycles,1);assert.equal(firstCommand.light.autoFade,true);await hw('delivered','POST',{commandId:firstCommand.id});let out=(await call('/state',friend)).data.messages;assert.ok(out.every(m=>m.status==='sent'));assert.ok(out.every(m=>!Object.hasOwn(m,'delivered')));clock+=6100;assert.equal((await hw('pending')).data.command,null);clock+=60001;await hw('heartbeat','POST',{});const next=(await hw('pending')).data.command;assert.equal(next.intent,'meal');assert.equal(next.light.cycles,2);assert.deepEqual(next.light.colors,['#E8A568','#FFF0D5']);const late={commandId:firstCommand.id,eventId:'late-touch'};assert.equal((await hw('touch','POST',late)).status,409);out=(await call('/state',friend)).data.messages;assert.equal(out.filter(m=>m.status==='received').length,0);await hw('delivered','POST',{commandId:next.id});const event={commandId:next.id,eventId:'on-time-touch'};assert.equal((await hw('touch','POST',event)).status,200);assert.equal((await hw('touch','POST',event)).data.duplicate,true);});
 await t.test('两端可回复、回应意图深橙，第三方不能插入回复',async()=>{const incoming=(await call('/state',owner)).data.messages[0];assert.equal((await send('miss',{note:'我也想你',replyTo:incoming.id},owner)).status,201);assert.ok((await call('/state',friend)).data.messages.some(m=>m.direction==='incoming'&&m.note==='我也想你'));assert.equal((await send('miss',{replyTo:incoming.id},third)).status,403);await send('cheer',{replyPreference:'when_free'});clock+=70000;await hw('heartbeat','POST',{});const c=(await hw('pending')).data.command;assert.deepEqual(c.light.colors,['#CA8954']);assert.equal(c.light.sound,false);await hw('focus','PUT',{focus:true});assert.equal((await hw('delivered','POST',{commandId:c.id})).status,409);await hw('focus','PUT',{focus:false});});
 await t.test('双方原声可上传与主动回听，第三方不能读取',async()=>{const form=new FormData();form.append('audio',new Blob([new Uint8Array([1,2,3])],{type:'audio/wav'}),'voice.wav');const r=await call('/audio',friend,'POST',form);assert.equal(r.status,201);voiceId=r.data.id;await send('meal',{audioId:voiceId});assert.equal((await call('/audio/'+voiceId,owner)).status,200);assert.equal((await call('/audio/'+voiceId,third)).status,403);assert.equal((await hw('audio/'+voiceId)).status,200);const reverse=new FormData();reverse.append('audio',new Blob([new Uint8Array([4,5])],{type:'audio/wav'}),'reply.wav');const rev=(await call('/audio',owner,'POST',reverse)).data;await send('miss',{audioId:rev.id},owner);assert.equal((await call('/audio/'+rev.id,friend)).status,200);});
 await t.test('本人传感器与练习记录共存，接口不接受冒用身份',async()=>{const b={eventId:'breath-one',startedAt:clock-60000,endedAt:clock,samples:[{offsetMs:0,rpm:12},{offsetMs:30000,rpm:14}]};assert.equal((await hw('breathing','POST',b)).status,200);assert.equal((await hw('breathing','POST',b)).data.duplicate,true);assert.equal((await hw('breathing','POST',{...b,samples:[{offsetMs:0,rpm:15}]})).status,409);assert.equal((await call('/breathing',friend)).data.sessions.length,0);const p={eventId:'practice-one',startedAt:clock-20000,endedAt:clock,targetSec:60,durationSec:12};assert.equal((await call('/breathing/practice',owner,'POST',p)).status,201);assert.equal((await call('/breathing/practice',owner,'POST',p)).data.duplicate,true);let own=(await call('/breathing',owner)).data.sessions;assert.equal(own.length,2);assert.equal(own.find(x=>x.source==='guided').avgRpm,null);assert.equal((await call('/breathing?userId='+owner.user.id,third)).data.sessions.length,0);for(const period of ['day','week','month'])assert.equal((await call('/records?period='+period,owner)).data.counts.breathingSessions,2);});
 await t.test('自由休息按持久截止时间运行，到时无主动震动，延长幂等',async()=>{const start=await call('/rest',owner,'POST',{durationSec:10,clientId:'rest-one'});assert.equal(start.status,201);const id=start.data.id;assert.equal((await call('/rest',owner,'POST',{durationSec:10,clientId:'rest-one'})).data.id,id);assert.equal((await hw('pending')).data.rest.due,false);clock+=11000;await hw('heartbeat','POST',{});const due=(await hw('pending')).data;assert.equal(due.command,null);assert.equal(due.rest.due,true);assert.equal(due.rest.light.vibration,false);assert.equal((await call('/state',friend)).data.rest,null);const e={action:'extend',seconds:10,eventId:'extend-one'};const a=await call('/rest/'+id,owner,'PATCH',e),b=await call('/rest/'+id,owner,'PATCH',e);assert.equal(a.data.endsAt,b.data.endsAt);assert.equal((await call('/rest/'+id,third,'PATCH',{action:'end'})).status,404);await call('/rest/'+id,owner,'PATCH',{action:'end'});assert.equal((await call('/state',owner)).data.rest,null);});
 await t.test('长触与短触互斥、长触 5 秒不误发消息回执',async()=>{const prior=(await call('/state',friend)).data.messages.filter(m=>m.received).length;assert.equal((await hw('gesture','POST',{eventId:'hold-short',type:'long_touch',durationMs:4000})).status,400);const body={eventId:'hold-five',type:'long_touch',durationMs:5000};const r=await hw('gesture','POST',body);assert.equal(r.data.action,'rest_started');assert.equal((await hw('gesture','POST',body)).data.duplicate,true);assert.equal((await hw('gesture','POST',{...body,type:'short_touch'})).status,409);assert.equal((await call('/state',friend)).data.messages.filter(m=>m.received).length,prior);clock+=301000;const ack=await hw('gesture','POST',{eventId:'rest-ack',type:'short_touch'});assert.equal(ack.data.action,'rest_acknowledged');});
 await t.test('单方解绑立即撤销消息与音频访问，本人记录保留',async()=>{assert.equal((await call('/pair',friend,'DELETE')).status,200);assert.equal((await call('/state',owner)).data.messages.length,0);assert.equal((await call('/audio/'+voiceId,owner)).status,403);assert.equal((await hw('audio/'+voiceId)).status,403);assert.equal(files.size,0);assert.equal((await call('/breathing',owner)).data.sessions.length,2);assert.equal((await hw('pending')).data.command,null);const key=await call('/device/key',owner,'POST',{});assert.equal((await hw('heartbeat','POST',{})).status,401);device.key=key.data.key;assert.equal((await hw('heartbeat','POST',{})).status,200);});

 await t.test('旧账号不换身份也能反向邀请与绑定；配对后旧邀请码失效',async()=>{
  assert.equal((await call('/pair',third,'POST',{code:staleFriendInvite.code})).status,400);
  const invite=(await call('/invites',friend,'POST',{})).data;
  assert.equal((await call('/pair',owner,'POST',{code:invite.code})).status,200);
  assert.equal((await call('/state',owner)).data.peer.id,friend.user.id);
  assert.equal((await call('/device',friend,'POST',{})).status,201);
  assert.equal((await call('/device',friend,'POST',{})).status,409);
  const state=JSON.parse(sql.prepare('SELECT payload FROM spaces WHERE id=?').get('live-v2').payload);
  assert.equal(state.users.find(u=>u.id===friend.user.id).role,'sender');
  assert.equal(state.breathing.filter(b=>b.ownerId===owner.user.id).length,2);
  assert.ok(state.devices.some(d=>d.ownerId===owner.user.id&&d.id===device.deviceId));
 });
 await t.test('双玩偶只接收本人的关心、原声和回执，专注与呼吸记录独立',async()=>{
  // Rotate the friend's key to obtain it without keeping a second copy in ordinary state.
  const second=(await call('/device/key',friend,'POST',{})).data;
  const secondHw=(action,method='GET',body)=>call('/hardware/'+second.deviceId+'/'+action,null,method,body,{'X-Device-Key':second.key});
  await send('miss',{note:'送给第一台玩偶'});
  await send('cheer',{note:'送给第二台玩偶'},owner);
  await hw('heartbeat','POST',{});await secondHw('heartbeat','POST',{});
  await call('/device',friend,'PATCH',{focus:true});
  const first=(await hw('pending')).data.command;
  assert.ok(first);assert.equal((await secondHw('pending')).data.command,null);
  assert.equal((await call('/state',owner)).data.device.focus,false);
  assert.equal((await call('/state',friend)).data.device.focus,true);
  await call('/device',friend,'PATCH',{focus:false});clock+=1001;
  const secondCommand=(await secondHw('pending')).data.command;assert.ok(secondCommand);
  assert.equal(first.intent,'miss');assert.equal(secondCommand.intent,'cheer');
  assert.equal((await secondHw('delivered','POST',{commandId:first.id})).status,404);
  assert.equal((await hw('touch','POST',{commandId:secondCommand.id,eventId:'wrong-device'})).status,409);
  assert.equal((await hw('delivered','POST',{commandId:first.id})).status,200);
  assert.equal((await secondHw('delivered','POST',{commandId:secondCommand.id})).status,200);
  await hw('touch','POST',{commandId:first.id,eventId:'first-device-touch'});
  const friendState=(await call('/state',friend)).data;
  assert.ok(friendState.messages.find(m=>m.id===first.messageIds[0]).received);
  assert.equal(friendState.messages.find(m=>m.id===secondCommand.messageIds[0]).received,null);
  await secondHw('touch','POST',{commandId:secondCommand.id,eventId:'second-device-touch'});
  assert.ok((await call('/state',owner)).data.messages.every(m=>m.received));
  assert.ok((await hw('messages')).data.messages.every(m=>m.receiver_id===owner.user.id));
  assert.ok((await secondHw('messages')).data.messages.every(m=>m.receiver_id===friend.user.id));
  const form=new FormData();form.append('audio',new Blob([new Uint8Array([8,9])],{type:'audio/wav'}),'personal.wav');
  const audio=(await call('/audio',owner,'POST',form)).data;await send('meal',{audioId:audio.id},owner);
  assert.equal((await secondHw('audio/'+audio.id)).status,200);assert.equal((await hw('audio/'+audio.id)).status,403);
  const breath={eventId:'second-device-breath',startedAt:clock-10000,endedAt:clock,samples:[{offsetMs:0,rpm:13}]};
  assert.equal((await secondHw('breathing','POST',breath)).status,200);
  assert.equal((await call('/breathing',owner)).data.sessions.length,2);assert.equal((await call('/breathing',friend)).data.sessions.length,1);
  assert.equal((await call('/pair',owner,'DELETE')).status,200);
  assert.equal((await hw('pending')).data.command,null);assert.equal((await secondHw('pending')).data.command,null);
  assert.equal((await secondHw('audio/'+audio.id)).status,403);
  assert.equal((await call('/breathing',friend)).data.sessions.length,1);
 });


 await t.test('桌搭持续采集：无需配对、无需手动开始，专注关灯不暂停，实时与记录本人可见',async()=>{
  assert.equal((await call('/breathing/live')).status,401);
  assert.equal((await call('/breathing/live',owner)).data.status,'waiting');
  const prior=(await call('/breathing',owner)).data.sessions.length;
  await call('/device',owner,'PATCH',{focus:true,power:false});
  const point={eventId:'continuous-first',measuredAt:clock,status:'tracking',rpm:12.5};
  assert.equal((await hw('breathing/live','POST',point,'wrong-key')).status,401);
  assert.equal((await hw('breathing/live','POST',point)).status,200);
  const view=(await call('/breathing/live',owner)).data;
  assert.equal(view.rpm,12.5);assert.equal(view.status,'tracking');
  assert.ok(!JSON.stringify(view).includes(device.key));
  assert.equal((await call('/breathing/live?userId='+owner.user.id,friend)).data.rpm,null);
  assert.equal((await hw('breathing/live','POST',point)).data.duplicate,true);
  assert.equal((await hw('breathing/live','POST',{...point,rpm:14})).status,409);
  assert.equal((await call('/breathing',owner)).data.sessions.length,prior+1);
  clock+=2000;
  assert.equal((await hw('breathing/live','POST',{eventId:'continuous-next',measuredAt:clock,status:'tracking',rpm:13})).status,200);
  assert.equal((await call('/breathing',owner)).data.sessions.length,prior+1);
  const ownState=(await call('/state',owner)).data;
  assert.equal(ownState.device.focus,true);assert.equal(ownState.device.power,false);
  clock+=2000;
  assert.equal((await hw('breathing/live','POST',{eventId:'continuous-no-signal',measuredAt:clock,status:'no_signal'})).status,200);
  assert.equal((await call('/breathing/live',owner)).data.rpm,null);
  assert.equal((await call('/breathing/live',owner)).data.status,'no_signal');
  clock+=16000;
  assert.equal((await call('/breathing/live',owner)).data.status,'stale');
  const rotation=(await call('/device/key',owner,'POST',{})).data;
  assert.equal((await hw('breathing/live','POST',{eventId:'revoked',measuredAt:clock,status:'tracking',rpm:12})).status,401);
  device.key=rotation.key;
 });

 sql.close();
});}
