import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync,readdirSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
test('本地真实 HTTP：空白正式入口、独立数据库、注册配对、上传与重启持久化',async()=>{
 const dir=mkdtempSync(path.join(os.tmpdir(),'yg-v2-http-')),base='http://127.0.0.1:3197';let child;
 async function start(){child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'3197',DATA_DIR:dir},stdio:'pipe'});let error='';child.stderr.on('data',b=>error+=b);for(let i=0;i<80;i++){try{if((await fetch(base+'/api/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,30));}throw Error('服务器未就绪 '+error);}
 async function stop(){if(child?.exitCode===null)await new Promise(r=>{child.once('exit',r);child.kill();});}
 async function call(url,token,method='GET',body){const r=await fetch(base+'/api'+url,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body&&!(body instanceof FormData)?{'Content-Type':'application/json'}:{})},body:body instanceof FormData?body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}
 try{await start();assert.equal((await fetch(base+'/')).status,200);assert.equal((await fetch(base+'/demo')).status,200);assert.equal((await call('/state')).status,401);assert.equal((await call('/demo/config')).data.mode,'demo');assert.ok(readdirSync(dir).includes('live.sqlite'));assert.ok(readdirSync(dir).includes('demo.sqlite'));
  let tokens=[];for(const account of ['owner','friend']){const b={account,name:account,password:'a-real-password-123'};assert.equal((await call('/register',null,'POST',b)).status,201);tokens.push((await call('/login',null,'POST',b)).data.token);}const [owner,friend]=tokens;const invite=(await call('/invites',owner,'POST',{})).data;await call('/pair',friend,'POST',{code:invite.code});const form=new FormData();form.append('audio',new Blob([new Uint8Array([1,2,3])],{type:'audio/wav'}),'sample.wav');const audio=await call('/audio',owner,'POST',form);assert.equal(audio.status,201);assert.equal((await call('/messages',owner,'POST',{intent:'miss',note:'真实 HTTP 测试',audioId:audio.data.id,clientId:'http-one'})).status,201);
  const device=(await call('/device',owner,'POST',{})).data;
  const live=await fetch(base+'/api/hardware/'+device.deviceId+'/breathing/live',{method:'POST',headers:{'X-Device-Key':device.key,'Content-Type':'application/json'},body:JSON.stringify({eventId:'persistent-live',measuredAt:Date.now(),status:'tracking',rpm:12.5})});assert.equal(live.status,200);
  await stop();await start();
  assert.equal((await call('/breathing/live',owner)).data.rpm,12.5);assert.equal((await call('/breathing',owner)).data.sessions[0].captureMode,'continuous');
  const s=(await call('/state',friend)).data;assert.equal(s.messages.length,1);assert.equal(s.messages[0].note,'真实 HTTP 测试');assert.equal((await fetch(base+'/api/audio/'+audio.data.id,{headers:{Authorization:'Bearer '+friend}})).status,200);
 }finally{await stop();rmSync(dir,{recursive:true,force:true});}
});
