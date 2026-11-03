/** 按需朗读。只有已认证的设备或已验签的云适配器可以申请原文。 */
import {signCareAck} from './care-ack.mjs';
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const ID=/^[a-zA-Z0-9_-]{1,128}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const VOICE_READ_SCHEMA='yuguang.voice-read.v1';
export function isReadAloudIntent(text) {
 if(typeof text!=='string'||text.length<2||text.length>160)return false;
 const clean=text.normalize('NFKC').trim();
 if(/(不要|别|不用|取消|停止|先别|不需要).{0,10}(读|念|播报|朗读|播放)/.test(clean))return false;
 return /(读|念|朗读|播报|说给我听|讲给我听)/.test(clean)&&
   /(消息|心意|留言|刚才|上一条|文字|亲友|伴侣|家人|那句话)/.test(clean);
}
export function validateVoiceEvent(event,clock) {
 if(!event||typeof event!=='object'||Array.isArray(event)||
    event.schema_version!==VOICE_READ_SCHEMA||event.type!=='voice_read'||
    !['device_asr_final','browser_asr_final'].includes(event.source)||!UUID.test(event.event_id||'')||
    !ID.test(event.device_id||'')||!isReadAloudIntent(event.transcript)||
    !Number.isSafeInteger(event.occurred_at_ms)||
    Math.abs(event.occurred_at_ms-clock)>300000)fail(400,'朗读请求缺少有效语音意图或字段');
 return event;
}
export async function verifyVoiceBridge(req,env,clock) {
 const key=env.VOICE_READ_BRIDGE_SECRET;
 if(typeof key!=='string'||key.length<32)fail(503,'朗读桥接签名密钥尚未配置');
 const raw=await req.text();
 if(new TextEncoder().encode(raw).length>2048)fail(413,'语音请求过长');
 const stamp=req.headers.get('x-yg-timestamp-ms')||'',sig=req.headers.get('x-yg-signature')||'';
 if(!/^\d{13}$/.test(stamp)||Math.abs(Number(stamp)-clock)>300000||!/^[0-9a-f]{64}$/i.test(sig))fail(401,'朗读桥接认证失败');
 const expected=await signCareAck(raw,stamp,key);
 let diff=0;for(let i=0;i<64;i++)diff|=sig.toLowerCase().charCodeAt(i)^expected.charCodeAt(i);
 if(diff)fail(401,'朗读桥接认证失败');
 let event;try{event=JSON.parse(raw);}catch{fail(400,'语音请求必须为 JSON');}
 if (event?.type==='voice_read' && event.source==='device_asr_final') return validateVoiceEvent(event,clock);
 if (event?.type==='voice_playback' && event.schema_version===VOICE_READ_SCHEMA &&
   event.source==='device_audio_result' && UUID.test(event.event_id||'') &&
   UUID.test(event.request_id||'') && ID.test(event.device_id||'') &&
   ['played','failed'].includes(event.status) && Number.isSafeInteger(event.occurred_at_ms) &&
   Math.abs(event.occurred_at_ms-clock)<=300000) return event;
 fail(400,'语音桥接请求类型无效');
}
/** store.mutate 的原子边界；设备与配对、原文访问、幂等均在一次事务中核验。 */
export function applyVoiceRead(s,event,clock) {
 const d=s.devices.find(x=>x.id===event.device_id);
 if(!d)fail(403,'设备身份无效');
 const pair=s.pairs.find(p=>p.active&&(p.memberIds||[p.senderId,p.receiverId]).includes(d.ownerId));
 if(!pair)fail(403,'设备主人尚未与亲友配对');
 const reads=s.voiceReads??=[];
 const old=reads.find(r=>r.eventId===event.event_id);
 if(old){
   if(old.deviceId!==d.id||old.transcript!==event.transcript||old.occurredAt!==event.occurred_at_ms)fail(409,'朗读事件编号冲突');
   // A lost signed response can be retried with the same event ID. While still pending,
   // resend the same TTS request; the device also deduplicates request_id.
   const oldMessage=s.messages.find(m=>m.id===old.messageId&&m.receiver_id===d.ownerId&&m.pair_id===pair.id);
   const replay=old.status==='prepared'&&!!oldMessage?.note?.trim();
   return {accepted:true,duplicate:true,requestId:old.eventId,messageId:old.messageId,deviceId:d.id,
     play:replay,speakText:replay?'你收到的消息是：'+oldMessage.note.trim():undefined};
 }
 // 连续识别结果不应重复外放；新请求有 2 秒最小间隔。
 if(reads.some(r=>r.deviceId===d.id&&clock-r.created<2000))fail(429,'朗读请求太频繁');
 const message=s.messages.filter(m=>m.receiver_id===d.ownerId&&m.pair_id===pair.id&&m.note?.trim()&&
   (m.delivered||m.received)&&m.status!=='saved'&&m.status!=='queued')
   .sort((a,b)=>(b.delivered||b.created)-(a.delivered||a.created))[0];
 if(!message)fail(404,'还没有可以朗读的已送达文字');
 const text=message.note.trim();
 if(text.length>140)fail(400,'消息长度不符合朗读限制');
 const record={eventId:event.event_id,deviceId:d.id,ownerId:d.ownerId,pairId:pair.id,
   messageId:message.id,transcript:event.transcript,occurredAt:event.occurred_at_ms,
   created:clock,status:'prepared'};
 s.voiceReads??=[];s.voiceReads.push(record);
 if(s.voiceReads.length>2000)s.voiceReads.splice(0,s.voiceReads.length-2000);
 return {accepted:true,duplicate:false,requestId:event.event_id,messageId:message.id,deviceId:d.id,
   play:true,speakText:'你收到的消息是：'+text};
}
export function applyVoicePlayback(s,event,clock) {
 if(!event||event.schema_version!==VOICE_READ_SCHEMA||event.type!=='voice_playback'||!['device_audio_result','browser_audio_result'].includes(event.source)||
  !ID.test(event.device_id||'')||!UUID.test(event.event_id||'')||
  !UUID.test(event.request_id||'')||!['played','failed'].includes(event.status)||
  !Number.isSafeInteger(event.occurred_at_ms)||Math.abs(event.occurred_at_ms-clock)>300000)
  fail(400,'播放结果格式无效');
 const d=s.devices.find(x=>x.id===event.device_id);
 if(!d)fail(403,'设备身份无效');
 const item=(s.voiceReads||[]).find(x=>x.eventId===event.request_id&&x.deviceId===d.id);
 if(!item)fail(404,'没有对应的朗读请求');
 if(item.playbackEventId){
  if(item.playbackEventId!==event.event_id||item.status!==event.status)fail(409,'播放结果事件冲突');
  return {recorded:true,duplicate:true};
 }
 item.playbackEventId=event.event_id;item.status=event.status;item.completedAt=event.occurred_at_ms;
 return {recorded:true,duplicate:false};
}
export function voiceDownlink(result) {
 if(!result.play)return {play:false,duplicate:true};
 return {play:true,method:'care',subMethod:'readText',params:{request_id:result.requestId,
  message_id:result.messageId,device_id:result.deviceId,text:result.speakText}};
}
