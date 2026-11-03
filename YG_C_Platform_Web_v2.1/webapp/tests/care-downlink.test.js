import {test} from 'node:test';
import assert from 'node:assert/strict';
import {toCarePresent,pollOneCare,recordDeviceRendered} from '../shared/care-downlink.mjs';
import {validatedLight} from '../shared/text-light.mjs';
const light=validatedLight('meal');
const command={id:'command_1',messageIds:['message_1'],status:'offered',play:true,light};
test('one-message care.present matches A firmware and never transports sender text',()=>{
 const message=toCarePresent(command,'lamp-001');
 assert.equal(message.method,'care');assert.equal(message.subMethod,'present');
 assert.equal(message.params.window_ms,light.durationMs);
 assert.deepEqual(message.params.light,light);
 assert.equal(Object.hasOwn(message.params,'note'),false);
 assert.throws(()=>toCarePresent({...command,messageIds:['a','b']},'lamp-001'),/one pending/);
 assert.throws(()=>toCarePresent({...command,light:{...light,maxBrightness:.75}},'lamp-001'),/unsafe/);
});
test('dispatch only records an outbound method; delivered needs verified device-rendered callback',async()=>{
 const log=[];const fetchImpl=async(url,opts)=>{
  log.push({url,method:opts.method,body:opts.body});
  if(url.endsWith('/heartbeat'))return {ok:true,json:async()=>({stopLight:false})};
  if(url.endsWith('/pending_single'))return {ok:true,json:async()=>({command})};
  if(url.endsWith('/delivered'))return {ok:true,json:async()=>({status:'delivered'})};
  throw Error('bad path');
 };
 const config={apiBase:'https://yuguang.example/api',deviceId:'lamp-001',deviceKey:'yg_12345678901234567890123456',fetchImpl};
 let accepted=0;
 const sent=await pollOneCare({...config,sendMethod:async(args)=>{assert.equal(args.params.message_id,'message_1');accepted++}});
 assert.equal(accepted,1);assert.equal(sent.sent,true);assert.equal(sent.deviceDisplayed,false);
 assert.equal(log.some(e=>e.url.endsWith('/delivered')),false);
 await assert.rejects(()=>recordDeviceRendered({...config,commandId:'command_1',verifiedDeviceEvent:false}),/verified/);
 const receipt=await recordDeviceRendered({...config,commandId:'command_1',verifiedDeviceEvent:true});
 assert.equal(receipt.status,'delivered');assert.equal(log.at(-1).method,'POST');
});
test('bridge rejects missing identity and insecure external Web endpoint',async()=>{
 const config={apiBase:'http://untrusted.example/api',deviceId:'lamp-001',deviceKey:'yg_12345678901234567890123456',sendMethod:async()=>{}};
 await assert.rejects(()=>pollOneCare(config),/TLS/);
 await assert.rejects(()=>pollOneCare({...config,deviceKey:''}),/credentials/);
});
