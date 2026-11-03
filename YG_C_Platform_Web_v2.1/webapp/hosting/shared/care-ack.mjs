/**
 * YG-IFACE-2.1.0 trusted-ingress normalization boundary.
 * This signature attests the *adapter* -> Web App hop only. Lingji callback
 * signature/identity must be checked by the trusted adapter with vendor docs.
 * The payload contains no physiological data or cloud inference metadata.
 */
const fail = (status, message) => { throw Object.assign(Error(message), {status}); };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VERSION = 'YG-IFACE-2.1.0';
const REQUIRED = ['schema_version','type','event_id','message_id','device_id','source','ack_type','reply_text','occurred_at_ms'];
const utf8 = value => new TextEncoder().encode(value);
const toHex = bytes => Array.from(bytes, x=>x.toString(16).padStart(2,'0')).join('');
function safeHexEqual(a,b) {
  if (!/^[0-9a-f]{64}$/i.test(a||'')) return false;
  const aLower=a.toLowerCase(),bLower=b.toLowerCase();
  let delta=0;
  for (let i=0;i<64;i++) delta |= aLower.charCodeAt(i)^bLower.charCodeAt(i);
  return delta===0;
}
export async function signCareAck(raw, timestampMs, sharedSecret) {
  const key=await crypto.subtle.importKey('raw',utf8(sharedSecret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return toHex(new Uint8Array(await crypto.subtle.sign('HMAC',key,utf8(`${timestampMs}.${raw}`))));
}
export function validateCareAck(body, clock) {
  if (!body || Array.isArray(body) || typeof body!=='object' ||
      Object.keys(body).length!==REQUIRED.length ||
      REQUIRED.some(k=>!Object.hasOwn(body,k))) fail(400,'回执字段不符合冻结契约');
  if (body.schema_version!==VERSION || body.type!=='care_ack' ||
      body.source!=='gpio5_ir' || body.ack_type!=='received' ||
      body.reply_text!=='收到了' || !UUID.test(body.event_id) ||
      typeof body.message_id!=='string' || !/^[\w-]{1,128}$/.test(body.message_id) ||
      typeof body.device_id!=='string' || !/^[\w-]{1,128}$/.test(body.device_id) ||
      !Number.isSafeInteger(body.occurred_at_ms) ||
      body.occurred_at_ms<clock-86400000 || body.occurred_at_ms>clock+5000) {
    fail(400,'回执版本、来源或数据无效');
  }
  return body;
}
export async function verifyCareAckBridge(request, env, clock) {
  const secret=env.CARE_ACK_BRIDGE_SECRET;
  if (typeof secret!=='string'||secret.length<32) fail(503,'回执桥接尚未配置');
  const raw=await request.text();
  if (utf8(raw).length>4096) fail(413,'回执消息过大');
  const stamp=request.headers.get('x-yg-timestamp-ms')||'';
  if (!/^\d{13}$/.test(stamp) || Math.abs(Number(stamp)-clock)>300000) fail(401,'回执桥接身份未通过验证');
  const expected=await signCareAck(raw,stamp,secret);
  if (!safeHexEqual(request.headers.get('x-yg-signature')||'',expected)) fail(401,'回执桥接身份未通过验证');
  let body;
  try { body=JSON.parse(raw); } catch { fail(400,'回执必须为 JSON'); }
  return validateCareAck(body,clock);
}

// Called inside the pre-existing CAS transaction. Result is returned only after
// the whole message/receipt state was durably committed by Store.mutate().
export function applyCareAck(state, event, clock) {
  const device=state.devices.find(d=>d.id===event.device_id);
  if (!device) fail(403,'设备无权确认此心意');
  const oldEvent=state.touches.find(t=>t.eventId===event.event_id);
  const oldMessage=state.touches.find(t=>t.messageIds?.includes(event.message_id));
  if (oldEvent) {
    if (oldEvent.source==='gpio5_ir' && oldEvent.ownerId===device.ownerId &&
        oldEvent.deviceId===device.id && oldEvent.messageIds.length===1 &&
        oldEvent.messageIds[0]===event.message_id && oldEvent.occurredAt===event.occurred_at_ms) {
      return {acknowledged:true,duplicate:true,message_id:event.message_id,event_id:event.event_id};
    }
    fail(409,'回执事件编号冲突');
  }
  if (oldMessage) fail(409,'该心意已被另一回执事务确认');
  const pair=state.pairs.find(p=>p.active&&(p.memberIds||[p.senderId,p.receiverId]).includes(device.ownerId));
  const message=state.messages.find(m=>m.id===event.message_id && m.receiver_id===device.ownerId && m.pair_id===pair?.id);
  if (!message) fail(403,'心意归属校验失败');
  if (message.received) fail(409,'该心意已经被确认');
  const command=state.commands.find(c=>c.deviceId===device.id && c.pairId===pair.id &&
    c.messageIds.includes(message.id) && ['delivered','done','received'].includes(c.status));
  if (!command || !Number.isFinite(command.delivered) || !Number.isFinite(command.lightEndsAt) ||
      event.occurred_at_ms<command.delivered || event.occurred_at_ms>command.lightEndsAt) {
    fail(409,'确认动作不在亲友心意灯效有效窗口内');
  }
  message.status='received';
  message.received=event.occurred_at_ms;
  message.acknowledged_at=new Date(event.occurred_at_ms).toISOString();
  message.ack_source='gpio5_ir';
  state.touches.push({eventId:event.event_id,deviceId:device.id,ownerId:device.ownerId,pairId:pair.id,
    commandId:command.id,messageIds:[message.id],source:'gpio5_ir',occurredAt:event.occurred_at_ms,created:clock});
  if (command.messageIds.every(id=>state.messages.some(m=>m.id===id&&m.received))) {
    command.status='received';
    command.received??=event.occurred_at_ms;
  }
  return {acknowledged:true,duplicate:false,message_id:message.id,event_id:event.event_id};
}
