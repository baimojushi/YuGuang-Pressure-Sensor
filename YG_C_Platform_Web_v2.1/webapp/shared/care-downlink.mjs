/** Vendor-neutral trusted care dispatch contract.
 * The actual Lingji MQTT/HTTP transport must supply sendMethod; no fake cloud success.
 * Web delivery must be committed only upon device-rendered receipt, never upon sendMethod acceptance.
 */
import {LIGHT_SCHEMA} from './text-light.mjs';
const IDENT=/^[a-zA-Z0-9_-]{1,128}$/;
export function toCarePresent(command,deviceId) {
 if(!IDENT.test(deviceId||'')||!command||!IDENT.test(command.id||'')||
    !Array.isArray(command.messageIds)||command.messageIds.length!==1||
    !IDENT.test(command.messageIds[0]||'')||!command.play||
    command.status!=='offered')
  throw new Error('only one pending owner-message can be dispatched');
 const light=command.light;
 if(!light||light.schema!==LIGHT_SCHEMA||!['slow_breathe','soft_pulse','slow_fade'].includes(light.pattern)||
    !Array.isArray(light.colors)||light.colors.length<1||light.colors.length>2||
    !light.colors.every(c=>typeof c==='string'&&/^#[0-9a-fA-F]{6}$/.test(c))||
    !Number.isInteger(light.periodMs)||light.periodMs<500||light.periodMs>12000||
    !Number.isInteger(light.cycles)||light.cycles<1||light.cycles>5||
    !Number.isInteger(light.durationMs)||light.durationMs!==light.periodMs*light.cycles||
    typeof light.maxBrightness!=='number'||light.maxBrightness<=0||light.maxBrightness>0.18||
    light.sound!==false||light.vibration!==false||light.autoFade!==true)
  throw new Error('invalid or unsafe light mapping');
 return {
  commandId:command.id,
  method:'care',subMethod:'present',
  params:{command_id:command.id,message_id:command.messageIds[0],device_id:deviceId,
   window_ms:light.durationMs,light:{...light}}
 };
}
function origin(value){
 const url=new URL(value);
 if(url.protocol!=='https:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw Error('Web API must use TLS');
 if(url.username||url.password||url.search||url.hash)throw Error('Web API URL must be origin/path only');
 return url.toString().replace(/\/$/,'');
}
async function call(apiBase,deviceId,key,path,method='GET',body,fetchImpl=fetch){
 const response=await fetchImpl(`${origin(apiBase)}/hardware/${encodeURIComponent(deviceId)}/${path}`,
  {method,headers:{'x-device-key':key,...(body?{'content-type':'application/json'}:{})},
   body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(5000)});
 if(!response.ok)throw Error(`Web device API returned ${response.status}`);
 return response.json();
}
/** Call from a *trusted server-side* bridge, with an authenticated provider transport. */
export async function pollOneCare({apiBase,deviceId,deviceKey,sendMethod,fetchImpl=fetch}){
 if(typeof sendMethod!=='function'||!IDENT.test(deviceId||'')||
    typeof deviceKey!=='string'||deviceKey.length<24)throw Error('authenticated bridge credentials required');
 const heartbeat=await call(apiBase,deviceId,deviceKey,'heartbeat','POST',{},fetchImpl);
 if(heartbeat.stopLight)return {sent:false,reason:'owner_safety_gate'};
 const result=await call(apiBase,deviceId,deviceKey,'pending_single','GET',undefined,fetchImpl);
 if(!result?.command)return {sent:false,reason:'nothing_pending'};
 if(result.command.status==='delivered')return {sent:false,reason:'awaiting_message_ack'};
 const command=toCarePresent(result.command,deviceId);
 await sendMethod({method:command.method,subMethod:command.subMethod,params:command.params,
  idempotencyKey:command.commandId});
 return {sent:true,methodAccepted:true,deviceDisplayed:false,commandId:command.commandId};
}
/** Explicit callback integration, invoked only after independently verified device-rendered event.
 * A vendor method transport success is NEVER sufficient evidence for this call. */
export async function recordDeviceRendered({apiBase,deviceId,deviceKey,commandId,verifiedDeviceEvent,fetchImpl=fetch}){
 if(verifiedDeviceEvent!==true||!IDENT.test(commandId||''))throw Error('device-rendered callback must be verified');
 return call(apiBase,deviceId,deviceKey,'delivered','POST',{commandId},fetchImpl);
}
