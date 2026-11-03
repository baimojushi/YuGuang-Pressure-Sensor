import {periodRange,interactionReport,validateBreathing} from '../public/records.js';
import {validatePractice,practiceMatches} from '../public/practice-model.js';
import {ingestLiveBreathing,liveBreathingView} from './live-breathing.mjs';
import {verifyCareAckBridge,applyCareAck} from './care-ack.mjs';
import {verifyCareDisplayedBridge,applyCareDisplayed} from './care-displayed.mjs';
import {mapTextToLight,validatedLight} from './text-light.mjs';
import {validateVoiceEvent,verifyVoiceBridge,applyVoiceRead,applyVoicePlayback,voiceDownlink} from './voice-read.mjs';

export const INTENTS={
 miss:{label:'我想你了',...validatedLight('miss')},
 meal:{label:'记得吃饭',...validatedLight('meal')},
 rest:{label:'别熬太晚',...validatedLight('rest')},
 cheer:{label:'加油 / 拍拍你',...validatedLight('cheer')}
};
const uuid=()=>crypto.randomUUID();
const secret=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
const hash=async t=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t))),b=>b.toString(16).padStart(2,'0')).join('');
const fail=(status,message,code)=>{throw Object.assign(Error(message),{status,code});};
const valid=(v,max=100)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
const profile=u=>({id:u.id,name:u.name,account:u.account||null});
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'}});
function recordLight(s,e){s.lightEvents??=[];s.lightEvents.push(e);if(s.lightEvents.length>4000)s.lightEvents.splice(0,s.lightEvents.length-4000);}
function empty(){return {users:[],sessions:[],pairs:[],invites:[],devices:[],messages:[],commands:[],touches:[],breathing:[],rests:[],uploads:[],gestures:[],lightEvents:[],lightPreviews:[],voiceReads:[],failures:{}};}
function seed(mode){const s=empty();if(mode!=='demo')return s;
 s.users=[{id:'demo-sender',name:'小满',role:'sender',account:'xiaoman'},{id:'demo-receiver',name:'阿屿',role:'receiver',account:'ayu'}];
 s.pairs=[{id:'demo-pair',senderId:'demo-sender',receiverId:'demo-receiver',active:true,created:Date.now()}];
 s.devices=[{id:'lamp-001',ownerId:'demo-receiver',keyHash:null,focus:false,power:true,lastSeen:0,nextOfferAt:0,restSeconds:300}];return s;
}
// Both releases and both runtimes use this one CAS transaction boundary.
export class Store{
 constructor(db,mode){this.db=db;this.id=mode==='demo'?'demo-v2':'live-v2';this.mode=mode;}
 async read(){return this.db.prepare('SELECT * FROM spaces WHERE id=?').bind(this.id).first();}
 async ensure(){let row=await this.read();if(row)return row;const s=seed(this.mode);if(this.mode==='demo')s.devices[0].keyHash=await hash('yg-lamp-demo-1031');await this.db.prepare('INSERT OR IGNORE INTO spaces(id,payload,version) VALUES(?,?,0)').bind(this.id,JSON.stringify(s)).run();return this.read();}
 async get(){return JSON.parse((await this.ensure()).payload);}
 async mutate(fn){for(let i=0;i<20;i++){const row=await this.ensure(),s=JSON.parse(row.payload),out=await fn(s);const payload=JSON.stringify(s);if(new TextEncoder().encode(payload).length>8*1024*1024)fail(429,'此黑客松版本的存储容量已满，请先导出整理记录');const result=await this.db.prepare('UPDATE spaces SET payload=?,version=version+1 WHERE id=? AND version=?').bind(payload,this.id,row.version).run();if(result.meta?.changes===1)return out;}fail(409,'操作较多，请稍后重试，已保存的内容不会被覆盖');}
}
async function passwordHash(password,salt){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);return Array.from(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:210000,hash:'SHA-256'},key,256)),b=>b.toString(16).padStart(2,'0')).join('');}
// Read historical pairs without rewriting existing accounts, records or device keys.
const members=p=>p.memberIds||[p.senderId,p.receiverId];
const pairFor=(s,id)=>s.pairs.find(p=>p.active&&members(p).includes(id));
const deviceFor=(s,id)=>s.devices.find(d=>d.ownerId===id);
const requireOwner=(s,u)=>{const d=deviceFor(s,u.id);if(!d)fail(409,'请先绑定自己的玩偶灯');return d;};
function pairRequired(s,u){const p=pairFor(s,u.id);if(!p)fail(403,'请先连接亲友');return p;}
const peerId=(p,id)=>members(p).find(member=>member!==id);
const activeRest=(s,id)=>s.rests.find(r=>r.ownerId===id&&r.status==='active');
function lightFor(c){return c.light||validatedLight(c.intent,c.replyPreference||'none');}
function commandView(c,clock){return {id:c.id,intent:c.intent,messageIds:c.messageIds,status:c.status,created:c.created,light:lightFor(c),playUntil:c.lightEndsAt||null,play:c.status==='offered'||(c.status==='delivered'&&clock<c.lightEndsAt)};}
function setModes(s,d,b,clock){for(const k of ['focus','power'])if(k in b&&typeof b[k]!=='boolean')fail(400,k+' 必须为布尔值');if(typeof b.focus==='boolean')d.focus=b.focus;if(typeof b.power==='boolean')d.power=b.power;if(d.focus||!d.power){s.commands.forEach(c=>{if(c.deviceId!==d.id)return;if(c.status==='offered')c.status='cancelled';else if(c.status==='delivered')c.status='done';});d.nextOfferAt=Math.max(clock+1000,d.nextOfferAt||0);}}
function restView(r,clock){return r?{...r,due:r.endsAt<=clock}:null;}
function beginRest(s,u,b,clock){if(!valid(b.clientId)||!Number.isInteger(b.durationSec)||b.durationSec<10||b.durationSec>3600)fail(400,'休息时长需为 10–3600 秒，并提供 clientId');const old=s.rests.find(r=>r.ownerId===u.id&&r.clientId===b.clientId);if(old)return old;if(activeRest(s,u.id))fail(409,'已有一次休息正在计时');const r={id:uuid(),ownerId:u.id,clientId:b.clientId,startedAt:clock,endsAt:clock+b.durationSec*1000,durationSec:b.durationSec,status:'active'};s.rests.push(r);const d=deviceFor(s,u.id);if(d)s.commands.forEach(c=>{if(c.deviceId===d.id&&c.status==='offered')c.status='cancelled';else if(c.deviceId===d.id&&c.status==='delivered')c.status='done';});return r;}
function restPending(s,d,clock){const r=activeRest(s,d.ownerId);if(!r)return null;return {id:r.id,endsAt:r.endsAt,due:clock>=r.endsAt,light:{pattern:clock>=r.endsAt?'double_pulse':'steady',colors:['#c0d3e1'],periodMs:3000,cycles:clock>=r.endsAt?2:1,durationMs:clock>=r.endsAt?6000:0,maxBrightness:.1,sound:false,vibration:false},play:!d.focus&&d.power,reminderEventId:r.id+':due'};}
function pending(s,d,clock,maxMessages=Infinity){const rest=restPending(s,d,clock);for(const c of s.commands)if(c.deviceId===d.id&&c.status==='delivered'&&clock>=c.lightEndsAt)c.status='done';if(rest||d.focus||!d.power||clock-d.lastSeen>35000)return {command:null,rest};const p=pairFor(s,d.ownerId);if(!p)return {command:null,rest:null};let c=s.commands.find(c=>c.deviceId===d.id&&c.pairId===p.id&&['offered','delivered'].includes(c.status));if(c){if(c.messageIds.length>maxMessages)fail(409,'已有待迁移的多条合并指令，安全网关暂不支持下发');return {command:commandView(c,clock),rest:null};}if(clock<(d.nextOfferAt||0))return {command:null,rest:null};
 const q=s.messages.filter(m=>m.pair_id===p.id&&m.receiver_id===d.ownerId&&m.status==='queued');if(!q.length)return {command:null,rest:null};const ids=[];for(const m of q){if(m.intent!==q[0].intent||m.replyPreference!==q[0].replyPreference||JSON.stringify(m.light||null)!==JSON.stringify(q[0].light||null))break;ids.push(m.id);if(ids.length>=maxMessages)break;}c={id:uuid(),deviceId:d.id,pairId:p.id,intent:q[0].intent,replyPreference:q[0].replyPreference,light:q[0].light||lightFor(q[0]),messageIds:ids,status:'offered',created:clock};s.commands.push(c);recordLight(s,{type:'offered',commandId:c.id,messageIds:ids,deviceId:d.id,occurredAt:clock});return {command:commandView(c,clock),rest:null};
}
function deliver(s,d,body,clock){const c=s.commands.find(c=>c.id===body.commandId&&c.deviceId===d.id);if(!c)fail(404,'指令不存在');if(!s.pairs.some(p=>p.id===c.pairId&&p.active)||c.status==='cancelled'||d.focus||!d.power||activeRest(s,d.ownerId))fail(409,'灯语已撤销或暂停，请停止并重新查询');if(c.status!=='offered')return commandView(c,clock);c.status='delivered';c.delivered=clock;c.lightEndsAt=clock+lightFor(c).durationMs;recordLight(s,{type:'delivered',commandId:c.id,messageIds:c.messageIds,deviceId:d.id,occurredAt:clock,light:c.light});d.nextOfferAt=c.lightEndsAt+60000;for(const m of s.messages)if(c.messageIds.includes(m.id)){m.status='delivered';m.delivered=clock;}return commandView(c,clock);}
function ack(s,u,messageIds,eventId,clock,commandId=null){if(!valid(eventId))fail(400,'需要 eventId');const p=pairRequired(s,u),old=s.touches.find(t=>t.eventId===eventId&&t.ownerId===u.id);const ids=[...messageIds].sort();if(old){if(JSON.stringify(old.messageIds)!==JSON.stringify(ids))fail(409,'事件编号已用于其他回应');return {received:true,duplicate:true};}if(s.touches.some(t=>t.messageIds?.some(id=>ids.includes(id))))fail(409,'消息已使用另一事务确认');const ms=ids.map(id=>s.messages.find(m=>m.id===id&&m.pair_id===p.id&&m.receiver_id===u.id));if(!ms.length||ms.some(m=>!m))fail(403,'只能确认发给自己的心意');for(const m of ms){m.received??=clock;m.status='received';}if(commandId){const c=s.commands.find(c=>c.id===commandId);c.status='received';c.received??=clock;}s.touches.push({eventId,ownerId:u.id,pairId:p.id,commandId:commandId||'message:'+ids.join(','),messageIds:ids,created:clock});return {received:true,meaning:'我收到了'};}
function touch(s,d,b,clock){
 const c=s.commands.find(c=>c.id===b.commandId&&c.deviceId===d.id);
 if(!c)fail(409,'当前没有可回应的心意灯效');
 const u=s.users.find(u=>u.id===d.ownerId);
 if(!u)fail(403,'设备主人身份无效');
 // 相同事务的网络重试仍然幂等；新的挥手必须发生在正在展示的窗口内。
 const old=s.touches.find(t=>t.eventId===b.eventId&&t.ownerId===u.id);
 if(old)return ack(s,u,c.messageIds,b.eventId,clock,c.id);
 if(c.status!=='delivered'||!Number.isFinite(c.delivered)||
    !Number.isFinite(c.lightEndsAt)||clock<c.delivered||clock>=c.lightEndsAt||
    d.focus||!d.power||activeRest(s,d.ownerId))fail(409,'仅心意灯效显示期间可以挥手确认');
 return ack(s,u,c.messageIds,b.eventId,clock,c.id);
}
function messageView(m,u){return {id:m.id,pair_id:m.pair_id,sender_id:m.sender_id,receiver_id:m.receiver_id,intent:m.intent,note:m.note,light:m.light||null,lightMapping:m.lightMapping||null,audio_id:m.audio_id,audioUrl:m.audio_id?'/api/audio/'+m.audio_id:null,created:m.created,received:m.received||null,acknowledged_at:m.acknowledged_at||null,ack_source:m.ack_source||null,status:m.received?'received':'sent',direction:m.sender_id===u.id?'outgoing':'incoming',replyPreference:m.replyPreference,replyTo:m.replyTo||null};}
function stateView(s,u,mode,clock){const p=pairFor(s,u.id),d=deviceFor(s,u.id),peer=p?s.users.find(x=>x.id===peerId(p,u.id)):null;return {user:profile(u),peer:peer?{id:peer.id,name:peer.name}:null,pair:p?{id:p.id}:null,device:d?{id:d.id,focus:d.focus,power:d.power,online:clock-d.lastSeen<35000,restSeconds:d.restSeconds}:null,messages:p?s.messages.filter(m=>m.pair_id===p.id).slice(-100).reverse().map(m=>messageView(m,u)):[],intents:INTENTS,breathingCount:s.breathing.filter(b=>b.ownerId===u.id).length,rest:restView(activeRest(s,u.id),clock),voiceReadHistory:(s.voiceReads||[]).filter(v=>v.ownerId===u.id).slice(-15).map(v=>({requestId:v.eventId,messageId:v.messageId,status:v.status,created:v.created})),mode};}
function send(s,u,b,clock,mapped){
 const p=pairRequired(s,u);
 const {intent,note='',audioId=null,clientId,replyPreference='none',replyTo=null}=b;
 if(!Object.hasOwn(INTENTS,intent)||typeof note!=='string'||note.length>140||
    !valid(clientId)||!['none','when_free'].includes(replyPreference))
    fail(400,'请选择有效灯语、回应意图，并提供 clientId；文字不超过 140 字');
 const old=s.messages.find(m=>m.sender_id===u.id&&m.client_id===clientId);
 if(old){if(old.note!==note.trim()||old.requestedIntent&&old.requestedIntent!==intent)fail(409,'消息编号已用于其他文本');return {id:old.id,duplicate:true};}
 if(!mapped)fail(500,'灯语映射结果不存在');
 if(audioId&&!s.uploads.some(a=>a.id===audioId&&a.ownerId===u.id&&a.pairId===p.id))fail(400,'原声附件无效');
 if(replyTo&&!s.messages.some(m=>m.id===replyTo&&m.pair_id===p.id&&m.receiver_id===u.id))fail(403,'只能回复当前亲友发给自己的心意');
 const recipient=peerId(p,u.id);
 if(s.messages.filter(m=>m.pair_id===p.id&&!m.received).length>=100)fail(429,'心意已经很多，先让它们慢慢抵达');
 const m={id:uuid(),pair_id:p.id,sender_id:u.id,receiver_id:recipient,
  intent:mapped.intent,requestedIntent:intent,note:note.trim(),light:mapped.light,
  lightMapping:{...mapped.mapping,mappedAt:clock},audio_id:audioId,
  status:deviceFor(s,recipient)?'queued':'saved',created:clock,delivered:null,
  received:null,client_id:clientId,replyPreference,replyTo};
 s.messages.push(m);
 recordLight(s,{type:'mapped',messageId:m.id,intent:mapped.intent,
  engine:mapped.mapping.engine,version:mapped.mapping.version,occurredAt:clock});
 return {id:m.id,status:'sent',intent:mapped.intent,light:mapped.light,
  lightMapping:m.lightMapping};
}
async function bodyOf(req){if(['GET','HEAD'].includes(req.method))return {};if(req.headers.get('content-type')?.startsWith('multipart/'))return null;const text=await req.text();if(text.length>65536)fail(413,'请求内容过大');if(!text)return {};try{const b=JSON.parse(text);if(!b||typeof b!=='object'||Array.isArray(b))throw Error();return b;}catch{fail(400,'请求格式不正确');}}

export async function handle(req,env){try{
 const url=new URL(req.url),mode=/^\/api\/demo(?:\/|$)/.test(url.pathname)?'demo':'live',path=url.pathname.replace(/^\/api\/demo(?=\/|$)/,'/api').replace(/\/$/,''),method=req.method,clock=env.NOW?env.NOW():Date.now();
 if(path==='/api/health')return json({ok:true,mode,version:2,storage:env.STORAGE_LABEL||'D1 + R2'});
 if(path==='/api/bridge/care-displayed'){
  if(mode!=='live'||method!=='POST')fail(404,'灯效桥接接口不存在');
  const event=await verifyCareDisplayedBridge(req,env,clock);
  if(!env.DB)fail(503,'持久存储尚未配置');
  return json(await new Store(env.DB,'live').mutate(s=>applyCareDisplayed(s,event,clock)));
 }
 // Only a trusted Lingji adapter may call this signed normalization endpoint.
 // The adapter must independently verify the vendor's signature and account.
 if(path==='/api/bridge/care-ack'){
  if(mode!=='live'||method!=='POST')fail(404,'桥接接口不存在');
  const event=await verifyCareAckBridge(req,env,clock);
  if(!env.DB)fail(503,'持久存储尚未配置');
  return json(await new Store(env.DB,'live').mutate(s=>applyCareAck(s,event,clock)));
 }
 // Signed vendor-adapter normalization. Adapter must authenticate the Lingji device first.
 if(path==='/api/bridge/voice-read' || path==='/api/bridge/voice-playback'){
  if(mode!=='live'||method!=='POST')fail(404,'语音桥接接口不存在');
  const event=await verifyVoiceBridge(req,env,clock);
  if(!env.DB)fail(503,'持久存储尚未配置');
  if(path.endsWith('/voice-read')){
   if(event.type!=='voice_read')fail(400,'语音事件类型不符');
   const result=await new Store(env.DB,'live').mutate(s=>applyVoiceRead(s,event,clock));
   return json({...result,downlink:voiceDownlink(result)});
  }
  if(event.type!=='voice_playback')fail(400,'语音播放事件类型不符');
  return json(await new Store(env.DB,'live').mutate(s=>applyVoicePlayback(s,event,clock)));
 }
 if(!env.DB||!env.BUCKET)fail(503,'持久存储尚未配置');const store=new Store(env.DB,mode),s=await store.get(),b=await bodyOf(req);const provider=mode==='demo'?'demo':env.AUTH_PROVIDER==='platform'?'platform':'password';
 const external=provider==='platform'&&req.headers.get('oai-authenticated-user-id')?await hash(req.headers.get('oai-authenticated-user-id')):null;
 const tokenHash=await hash((req.headers.get('Authorization')||'').replace(/^Bearer /,''));
 const userFor=state=>{if(provider==='platform'){if(!external)fail(401,'请先登录个人账号','LOGIN_REQUIRED');const u=state.users.find(u=>u.external===external);if(!u)fail(401,'请先设置自己的资料','PROFILE_REQUIRED');return u;}const session=state.sessions.find(x=>x.hash===tokenHash&&x.expires>clock);const u=session&&state.users.find(u=>u.id===session.userId);if(!u)fail(401,'请先登录自己的账号','LOGIN_REQUIRED');return u;};
 if(path==='/api/config')return json({mode,authProvider:provider,signedIn:!!external,registered:!!(external&&s.users.some(u=>u.external===external)),signInUrl:'/signin-with-chatgpt?return_to=%2F',signOutUrl:'/signout-with-chatgpt?return_to=%2F',demoAccounts:mode==='demo'?s.users.map(profile):undefined});
 if(path==='/api/register'&&method==='POST'){
  if(mode==='demo')fail(403,'展示版使用示例身份；请到正式版注册');if(!valid(b.name,40))fail(400,'请填写自己的称呼');let account=null,salt=null,digest=null;
  if(provider==='platform'){if(!external)fail(401,'请先登录个人账号');}else{account=String(b.account||'').trim().toLowerCase();if(!/^[a-z0-9@._+-]{3,80}$/.test(account)||typeof b.password!=='string'||b.password.length<12||b.password.length>200)fail(400,'账号使用 3–80 位字母、数字或邮箱；密码至少 12 位');salt=secret();digest=await passwordHash(b.password,salt);}
  const id=uuid();const u=await store.mutate(s=>{if(s.users.some(u=>external?u.external===external:u.account===account))fail(409,'该账号已存在，请登录');if(s.users.length>=1000)fail(429,'此版本已达到账号容量');const u={id,name:b.name.trim(),account,external,salt,digest};s.users.push(u);return profile(u);});return json({user:u},201);
 }
 if(path==='/api/login'&&method==='POST'){
  if(provider==='platform')return json({user:profile(userFor(s)),token:null});const account=String(b.account||'').trim().toLowerCase(),failureKey=await hash(account),f=s.failures[failureKey];if(f&&f.until>clock&&f.count>=6)fail(429,'登录尝试过多，请在 15 分钟后重试');const u=s.users.find(u=>u.account===account);let ok=false;if(mode==='demo')ok=!!u&&b.password==='yuguang1031';else{const candidate=await passwordHash(String(b.password||'').slice(0,200),u?.salt||'missing-account');const expected=u?.digest||'0'.repeat(64);let diff=candidate.length^expected.length;for(let i=0;i<64;i++)diff|=(candidate.charCodeAt(i)||0)^(expected.charCodeAt(i)||0);ok=!!u&&diff===0;}
  if(!ok){await store.mutate(s=>{const previous=s.failures[failureKey];s.failures[failureKey]={count:previous?.until>clock?previous.count+1:1,until:clock+900000};});fail(401,'账号或密码不正确');}
  const token=secret(),digest=await hash(token);await store.mutate(s=>{delete s.failures[failureKey];s.sessions=s.sessions.filter(x=>x.expires>clock);s.sessions.push({hash:digest,userId:u.id,expires:clock+12*3600000});});return json({token,user:profile(u)});
 }
 const hw=path.match(/^\/api\/hardware\/([^/]+)\/(.+)$/);
 if(hw){const keyHash=await hash(req.headers.get('X-Device-Key')||''),d=s.devices.find(d=>d.id===hw[1]&&d.keyHash===keyHash);if(!d)fail(401,'设备认证失败');const action=hw[2];
  if(action.startsWith('audio/')&&method==='GET'){const id=action.slice(6),a=s.uploads.find(a=>a.id===id),p=pairFor(s,d.ownerId);if(!a||!p||a.pairId!==p.id||!s.messages.some(m=>m.audio_id===id&&m.receiver_id===d.ownerId))fail(403,'原声不可访问');const obj=await env.BUCKET.get(a.key);if(!obj)fail(404,'原声不存在');return new Response(obj.body,{headers:{'Content-Type':a.mime,'Cache-Control':'private, no-store'}});}
  return json(await store.mutate(s=>{const device=s.devices.find(x=>x.id===d.id&&x.keyHash===keyHash);if(!device)fail(401,'设备密钥已失效');const owner=s.users.find(u=>u.id===device.ownerId);
   if(action==='heartbeat'&&method==='POST'){device.lastSeen=clock;return {focus:device.focus,power:device.power,stopLight:device.focus||!device.power||!pairFor(s,device.ownerId)||!!activeRest(s,device.ownerId),rest:restPending(s,device,clock),pollAfterMs:2000,protocolVersion:2};}
   if(action==='pending'&&method==='GET')return pending(s,device,clock);
   if(action==='pending_single'&&method==='GET')return pending(s,device,clock,1);
   if(action==='delivered'&&method==='POST')return deliver(s,device,b,clock);
   if(action==='touch'&&method==='POST')return touch(s,device,b,clock);
   if(action==='voice/read'&&method==='POST'){
    const event=validateVoiceEvent(b,clock);
    if(event.source!=='device_asr_final'||event.device_id!==device.id)fail(403,'语音请求设备不匹配');
    return applyVoiceRead(s,event,clock);
   }
   if(action==='voice/playback'&&method==='POST'){
    if(b.device_id!==device.id)fail(403,'播放结果设备不匹配');
    return applyVoicePlayback(s,b,clock);
   }
   if(action==='focus'&&method==='PUT'){if(typeof b.focus!=='boolean')fail(400,'focus 必须为布尔值');setModes(s,device,b,clock);return {ok:true};}
   if(action==='breathing/live'&&method==='POST')return ingestLiveBreathing(s,device,b,clock);
   if(action==='breathing'&&method==='POST'){const data=validateBreathing(b,clock),old=s.breathing.find(x=>x.deviceId===device.id&&x.eventId===data.eventId);if(old){if(JSON.stringify(old.samples)!==JSON.stringify(data.samples)||old.startedAt!==data.startedAt||old.endedAt!==data.endedAt)fail(409,'记录编号冲突');return {id:old.id,duplicate:true};}const record={...data,id:uuid(),ownerId:owner.id,deviceId:device.id,created:clock};s.breathing.push(record);return {id:record.id};}
   if(action==='gesture'&&method==='POST'){if(!valid(b.eventId))fail(400,'需要 eventId');const old=s.gestures.find(g=>g.deviceId===device.id&&g.eventId===b.eventId);if(old){if(old.type!==b.type)fail(409,'触摸事件编号冲突');return {...old.result,duplicate:true};}let result;
    if(b.type==='long_touch'){if(!Number.isFinite(b.durationMs)||b.durationMs<5000)fail(400,'长触需持续至少 5 秒');result={action:'rest_started',rest:beginRest(s,owner,{clientId:'gesture:'+b.eventId,durationSec:device.restSeconds},clock)};}
    else if(b.type==='short_touch'){const r=activeRest(s,owner.id);if(r&&r.endsAt<=clock){r.status='acknowledged';r.endedAt=clock;result={action:'rest_acknowledged'};}else if(r)result={action:'rest_continues'};else result={action:'message_acknowledged',...touch(s,device,b,clock)};}
    else fail(400,'未知手势；先在固件中完成短触与长触互斥判定');s.gestures.push({deviceId:device.id,eventId:b.eventId,type:b.type,result});return result;
   }
   if(action==='messages'&&method==='GET'){const p=pairFor(s,owner.id);return {messages:p?s.messages.filter(m=>m.pair_id===p.id&&m.receiver_id===owner.id).slice(-50).map(m=>({...messageView(m,owner),audioUrl:m.audio_id?`/api/hardware/${device.id}/audio/${m.audio_id}`:null})):[]};}
   fail(404,'硬件接口不存在');
  }));
 }
 const user=userFor(s),mutate=fn=>store.mutate(s=>fn(s,userFor(s)));
 if(path==='/api/state'&&method==='GET')return json(stateView(s,user,mode,clock));
 if(path==='/api/logout'&&method==='POST'){await mutate(s=>{s.sessions=s.sessions.filter(x=>x.hash!==tokenHash);});return json({ok:true});}
 if(path==='/api/device'&&method==='POST'){const key='yg_'+secret(),keyHash=await hash(key),id='lamp-'+uuid();await mutate((s,u)=>{if(deviceFor(s,u.id))fail(409,'已经绑定了一台玩偶灯');s.devices.push({id,ownerId:u.id,keyHash,focus:false,power:true,lastSeen:0,nextOfferAt:0,restSeconds:300});s.messages.forEach(m=>{if(m.receiver_id===u.id&&m.status==='saved')m.status='queued';});});return json({deviceId:id,key,apiBase:new URL(req.url).origin+'/api'+(mode==='demo'?'/demo':''),oneTime:true},201);}
 if(path==='/api/device/key'&&method==='POST'){const key='yg_'+secret(),keyHash=await hash(key);const id=await mutate((s,u)=>{const d=requireOwner(s,u);d.keyHash=keyHash;d.lastSeen=0;return d.id;});return json({deviceId:id,key,oneTime:true,apiBase:new URL(req.url).origin+'/api'+(mode==='demo'?'/demo':'')});}
 if(path==='/api/device'&&method==='PATCH')return json(await mutate((s,u)=>{setModes(s,requireOwner(s,u),b,clock);return {ok:true};}));
 if(path==='/api/invites'&&method==='POST')return json(await mutate((s,u)=>{if(pairFor(s,u.id))fail(409,'请先解除当前连接');s.invites.forEach(i=>{if(i.ownerId===u.id)i.used=true;});const i={code:secret().slice(0,10).toUpperCase(),ownerId:u.id,expires:clock+600000,used:false};s.invites.push(i);return {code:i.code,expires:i.expires};}));
 if(path==='/api/pair'&&method==='POST')return json(await mutate((s,u)=>{if(pairFor(s,u.id))fail(409,'已经连接了亲友');const i=s.invites.find(i=>i.code===String(b.code||'').trim().toUpperCase()&&!i.used&&i.expires>clock);if(!i||pairFor(s,i.ownerId)||i.ownerId===u.id)fail(400,'邀请码无效、过期或已使用');const p={id:uuid(),memberIds:[i.ownerId,u.id],active:true,created:clock};s.pairs.push(p);s.invites.forEach(invite=>{if(members(p).includes(invite.ownerId))invite.used=true;});return {ok:true};}));
 if(path==='/api/pair'&&method==='DELETE'){const keys=await mutate((s,u)=>{const p=pairFor(s,u.id);if(!p)return [];p.active=false;const uploads=s.uploads.filter(a=>a.pairId===p.id);const removedMessageIds=new Set(s.messages.filter(m=>m.pair_id===p.id).map(m=>m.id));s.messages=s.messages.filter(m=>m.pair_id!==p.id);s.commands=s.commands.filter(c=>c.pairId!==p.id);
 s.lightEvents=(s.lightEvents||[]).filter(e=>!removedMessageIds.has(e.messageId)&&!e.messageIds?.some(id=>removedMessageIds.has(id)));
 s.voiceReads=(s.voiceReads||[]).filter(v=>v.pairId!==p.id);
 s.lightPreviews=(s.lightPreviews||[]).filter(v=>v.pairId!==p.id);
 s.touches=s.touches.filter(t=>t.pairId!==p.id);s.uploads=s.uploads.filter(a=>a.pairId!==p.id);s.invites.forEach(i=>{if(members(p).includes(i.ownerId))i.used=true;});return uploads.map(a=>a.key);});if(keys.length)await env.BUCKET.delete(keys).catch(()=>{});return json({ok:true,cleared:true});}
 if(path==='/api/voice/browser-read'&&method==='POST'){
  const d=requireOwner(s,user);
  const event=validateVoiceEvent(b,clock);
  if(event.source!=='browser_asr_final'||event.device_id!==d.id)fail(403,'只能朗读自己收到的消息');
  return json(await mutate(state=>applyVoiceRead(state,event,clock)));
 }
 if(path==='/api/voice/browser-playback'&&method==='POST'){
  const d=requireOwner(s,user);
  if(b.device_id!==d.id||b.source!=='browser_audio_result')fail(403,'只能记录自己的朗读结果');
  return json(await mutate(state=>applyVoicePlayback(state,b,clock)));
 }
 if(path==='/api/light/preview'&&method==='POST'){
  pairRequired(s,user);
  if(!Object.hasOwn(INTENTS,b.intent)||typeof b.note!=='string'||b.note.length>140||
    !['none','when_free'].includes(b.replyPreference||'none'))fail(400,'预览参数无效');
  // 同一次预览可使用私有分类模型；发送时引用此快照，避免两次推理前后不一致。
  const mapped=await mapTextToLight(b,env);
  const digest=await hash(JSON.stringify([b.note.trim(),b.intent,b.replyPreference||'none']));
  const previewId=uuid();
  await mutate((state,u)=>{
   const pair=pairRequired(state,u);
   state.lightPreviews=(state.lightPreviews||[]).filter(p=>p.expiresAt>clock).slice(-99);
   state.lightPreviews.push({id:previewId,userId:u.id,pairId:pair.id,digest,mapped,expiresAt:clock+10*60000});
  });
  return json({...mapped,previewId,expiresAt:clock+10*60000});
 }
 if(path==='/api/messages'&&method==='POST'){
  const pair=pairRequired(s,user);
  if(!Object.hasOwn(INTENTS,b.intent)||typeof b.note!=='string'||b.note.length>140||
    !['none','when_free'].includes(b.replyPreference||'none'))fail(400,'心意文本或灯语类型无效');
  let mapped=null;
  if(!s.messages.some(m=>m.sender_id===user.id&&m.client_id===b.clientId)){
   if(b.previewId){
    const digest=await hash(JSON.stringify([b.note.trim(),b.intent,b.replyPreference||'none']));
    const preview=(s.lightPreviews||[]).find(p=>p.id===b.previewId&&p.userId===user.id&&
      p.pairId===pair.id&&p.expiresAt>clock&&p.digest===digest);
    if(!preview)fail(409,'灯语预览已过期或文字发生变化，请重新预览');
    mapped=preview.mapped;
   }else mapped=await mapTextToLight(b,env);
  }
  return json(await mutate((state,u)=>send(state,u,b,clock,mapped)),201);
 }
 const ackPath=path.match(/^\/api\/messages\/([^/]+)\/ack$/);if(ackPath&&method==='POST')return json(await mutate((s,u)=>ack(s,u,[ackPath[1]],b.eventId,clock)));
 if(path==='/api/breathing/live'&&method==='GET')return json(liveBreathingView(s,user,clock));
 if(path==='/api/breathing'&&method==='GET')return json({sessions:s.breathing.filter(x=>x.ownerId===user.id).sort((a,b)=>b.startedAt-a.startedAt)});
 if(path==='/api/breathing/practice'&&method==='POST')return json(await mutate((s,u)=>{const data=validatePractice(b,clock),old=s.breathing.find(x=>x.ownerId===u.id&&x.source==='guided'&&x.eventId===data.eventId);if(old){if(!practiceMatches(old,data))fail(409,'练习记录编号冲突');return {id:old.id,duplicate:true};}const record={...data,id:uuid(),ownerId:u.id,deviceId:null,created:clock};s.breathing.push(record);return {id:record.id};}),201);
 if(path==='/api/records'&&method==='GET'){const p=pairFor(s,user.id),range=periodRange(url.searchParams.get('period')||undefined,url.searchParams.get('date')||undefined),messages=p?s.messages.filter(m=>m.pair_id===p.id):[];const report=interactionReport(messages,p?s.touches.filter(t=>t.pairId===p.id):[],s.breathing.filter(b=>b.ownerId===user.id),range);report.messages=report.messages.map(m=>messageView(m,user));report.counts.queued=0;report.counts.delivered=0;report.events=report.events.map(e=>({...e,status:e.status==='received'?'received':'sent'}));report.rests=s.rests.filter(r=>r.ownerId===user.id&&r.startedAt>=range.start&&r.startedAt<range.end);
  const ids=new Set(messages.map(m=>m.id));
  report.lightEvents=(s.lightEvents||[]).filter(e=>
   (e.messageId&&ids.has(e.messageId))||e.messageIds?.some(id=>ids.has(id))
  ).filter(e=>e.occurredAt>=range.start&&e.occurredAt<range.end).slice(-200);
  return json(report);}
 if(path==='/api/rest'&&method==='POST')return json(await mutate((s,u)=>restView(beginRest(s,u,b,clock),clock)),201);
 const restPath=path.match(/^\/api\/rest\/([^/]+)$/);if(restPath&&method==='PATCH')return json(await mutate((s,u)=>{const r=s.rests.find(r=>r.id===restPath[1]&&r.ownerId===u.id);if(!r)fail(404,'休息记录不存在');if(['end','ack'].includes(b.action)){if(r.status==='active'){r.status=b.action==='ack'?'acknowledged':'ended';r.endedAt=clock;}return restView(r,clock);}if(b.action==='extend'){if(r.status!=='active'||!Number.isInteger(b.seconds)||b.seconds<10||b.seconds>3600||!valid(b.eventId))fail(400,'请选择有效的延长时长并提供 eventId');r.extensions??=[];if(!r.extensions.includes(b.eventId)){r.endsAt=Math.max(r.endsAt,clock)+b.seconds*1000;r.extensions.push(b.eventId);}return restView(r,clock);}fail(400,'未知休息操作');}));
 if(path.startsWith('/api/simulator/')){if(mode!=='demo')fail(404,'正式版没有模拟硬件接口');return json(await mutate((s,u)=>{const d=requireOwner(s,u),action=path.split('/').pop();if(action==='heartbeat'&&method==='POST'){d.lastSeen=b.online===false?0:clock;return {ok:true};}if(action==='pending'&&method==='GET')return pending(s,d,clock);if(action==='delivered'&&method==='POST')return deliver(s,d,b,clock);if(action==='touch'&&method==='POST')return touch(s,d,b,clock);fail(404,'模拟接口不存在');}));}
 if(path==='/api/audio'&&method==='POST'){const p=pairRequired(s,user);if(Number(req.headers.get('content-length'))>5*1024*1024+65536)fail(413,'音频需小于 5 MB');const form=await req.formData(),file=form.get('audio');if(!file||typeof file==='string'||file.size===0||file.size>5*1024*1024||!/^audio\/(webm|mp4|mpeg|wav|x-wav|ogg|aac)(;.*)?$/.test(file.type))fail(400,'请选择 5 MB 内的常用音频格式');const id=uuid(),key=store.id+'/'+p.id+'/'+id;await env.BUCKET.put(key,await file.arrayBuffer(),{httpMetadata:{contentType:file.type}});try{await mutate((s,u)=>{const current=pairRequired(s,u);if(current.id!==p.id)fail(409,'连接已改变');s.uploads.push({id,key,pairId:p.id,ownerId:u.id,mime:file.type});});}catch(e){await env.BUCKET.delete(key);throw e;}return json({id},201);}
 const audioPath=path.match(/^\/api\/audio\/([^/]+)$/);if(audioPath&&method==='GET'){const a=s.uploads.find(a=>a.id===audioPath[1]),p=pairFor(s,user.id);if(!a||!p||a.pairId!==p.id||!(a.ownerId===user.id||s.messages.some(m=>m.audio_id===a.id&&m.receiver_id===user.id)))fail(403,'原声不可访问');const obj=await env.BUCKET.get(a.key);if(!obj)fail(404,'原声不存在');return new Response(obj.body,{headers:{'Content-Type':a.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}
 fail(404,'接口不存在');
}catch(e){if(!e.status)console.error('Yuguang request failed:',e.message);return json({error:e.status?e.message:'服务暂时不可用，请稍后重试',code:e.code||null},e.status||500);}}
