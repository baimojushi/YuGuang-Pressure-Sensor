/** Signed, vendor-authenticated LED-rendered event from trusted Lingji adapter.
 * The firmware emits this only after successful WS2812 fill, not after MQTT send/arm.
 * Vendor authentication is the gateway's responsibility before it signs this hop. */
import {signCareAck} from './care-ack.mjs';
const fail=(status,text)=>{throw Object.assign(Error(text),{status})};
const ID=/^[\w-]{1,128}$/;
const KEYS=['schema_version','type','command_id','message_id','device_id','rendered_at_ms'];
const VERSION='YG-IFACE-2.1.0';
const safeHex=(a,b)=>{
 if(!/^[a-f0-9]{64}$/i.test(a||''))return false;
 let delta=0;
 for(let i=0;i<64;i++)delta|=a.toLowerCase().charCodeAt(i)^b.toLowerCase().charCodeAt(i);
 return delta===0;
};
export function validateCareDisplayed(event,clock){
 if(!event||typeof event!=='object'||Array.isArray(event)||
  Object.keys(event).length!==KEYS.length||KEYS.some(k=>!Object.hasOwn(event,k))||
  event.schema_version!==VERSION||event.type!=='care_displayed'||
  !ID.test(event.command_id||'')||!ID.test(event.message_id||'')||!ID.test(event.device_id||'')||
  !Number.isSafeInteger(event.rendered_at_ms)||event.rendered_at_ms<clock-300000||event.rendered_at_ms>clock+5000)
  fail(400,'实际亮灯事件格式无效');
 return event;
}
export async function verifyCareDisplayedBridge(request,env,clock){
 const key=env.CARE_DISPLAY_BRIDGE_SECRET;
 if(typeof key!=='string'||key.length<32)fail(503,'实际灯效桥接未配置');
 const raw=await request.text();
 if(new TextEncoder().encode(raw).length>4096)fail(413,'设备亮灯事件过大');
 const stamp=request.headers.get('x-yg-timestamp-ms')||'';
 if(!/^\d{13}$/.test(stamp)||Math.abs(Number(stamp)-clock)>300000)fail(401,'亮灯桥接认证失败');
 const expected=await signCareAck(raw,stamp,key);
 if(!safeHex(request.headers.get('x-yg-signature')||'',expected))fail(401,'亮灯桥接认证失败');
 let event;try{event=JSON.parse(raw)}catch{fail(400,'亮灯事件必须为 JSON')}
 return validateCareDisplayed(event,clock);
}
export function applyCareDisplayed(state,event,clock){
 const device=state.devices.find(d=>d.id===event.device_id);
 if(!device)fail(403,'设备未授权');
 const pair=state.pairs.find(p=>p.active&&(p.memberIds||[p.senderId,p.receiverId]).includes(device.ownerId));
 if(!pair)fail(403,'当前没有有效亲友配对');
 const cmd=state.commands.find(c=>c.id===event.command_id&&c.deviceId===device.id&&c.pairId===pair.id);
 if(!cmd||cmd.messageIds?.length!==1||cmd.messageIds[0]!==event.message_id)
  fail(409,'灯效事件与待显示消息不匹配');
 if(cmd.status==='delivered'){
  if(cmd.delivered===event.rendered_at_ms)return {recorded:true,duplicate:true,commandId:cmd.id};
  fail(409,'相同指令已有不同显示时间');
 }
 if(cmd.status!=='offered'||device.focus||!device.power||
    state.rests?.some(r=>r.ownerId===device.ownerId&&r.status==='active'))
  fail(409,'当前灯效已取消或处于勿扰时段');
 const message=state.messages.find(m=>m.id===event.message_id&&m.pair_id===pair.id&&m.receiver_id===device.ownerId);
 if(!message||message.status!=='queued')fail(403,'消息归属无效或已被消费');
 const light=cmd.light;
 if(!light||!Number.isInteger(light.durationMs)||light.durationMs<500||light.durationMs>120000)
  fail(409,'缺少受控灯语');
 cmd.status='delivered';cmd.delivered=event.rendered_at_ms;
 cmd.lightEndsAt=event.rendered_at_ms+light.durationMs;
 device.nextOfferAt=cmd.lightEndsAt+60000;
 message.status='delivered';message.delivered=event.rendered_at_ms;
 state.lightEvents??=[];state.lightEvents.push({type:'delivered',commandId:cmd.id,
  messageIds:[message.id],deviceId:device.id,occurredAt:event.rendered_at_ms,light});
 return {recorded:true,duplicate:false,commandId:cmd.id};
}
