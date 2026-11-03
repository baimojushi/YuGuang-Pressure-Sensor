export const PRACTICE_TARGETS=[60,180,300];
// A guided session records the app's timer, never a measured breathing rate.
export function validatePractice(body,clock=Date.now()){
 const fail=msg=>{throw Object.assign(Error(msg),{status:400});};
 if(!body||typeof body.eventId!=='string'||!body.eventId.trim()||body.eventId.length>100)fail('需要有效的练习记录编号');
 const {startedAt,endedAt,durationSec,targetSec}=body;
 if(!Number.isSafeInteger(startedAt)||!Number.isSafeInteger(endedAt)||startedAt<=0||endedAt<=startedAt||endedAt>clock+300000)fail('练习开始与结束时间无效');
 if(!PRACTICE_TARGETS.includes(targetSec)||!Number.isSafeInteger(durationSec)||durationSec<1||durationSec>targetSec||durationSec*1000>endedAt-startedAt+1000)fail('练习时长需为实际计时秒数，不得超过目标或经过的时间');
 return {eventId:body.eventId,startedAt,endedAt,durationSec,targetSec,source:'guided',status:durationSec>=targetSec?'completed':'ended_early',pattern:{inhaleSec:4,exhaleSec:4},samples:[],sampleCount:0,avgRpm:null,minRpm:null,maxRpm:null};
}
export function practiceMatches(a,b){return ['eventId','startedAt','endedAt','durationSec','targetSec'].every(k=>a[k]===b[k]);}
export class PracticeTimer {
 constructor({eventId,startedAt,targetSec,elapsedMs=0,status='paused',endedAt=null}){Object.assign(this,{eventId,startedAt,targetSec,elapsedMs:Math.max(0,Math.min(targetSec*1000,elapsedMs)),status,endedAt});this.lastTick=null;}
 tick(monotonic){if(this.status==='running'&&this.lastTick!==null){const delta=monotonic-this.lastTick;if(delta>=0&&delta<=2000)this.elapsedMs=Math.min(this.targetSec*1000,this.elapsedMs+delta);}this.lastTick=monotonic;return this.elapsedMs>=this.targetSec*1000;}
 pause(monotonic){this.tick(monotonic);if(this.status==='running')this.status='paused';}
 resume(monotonic){if(this.status==='paused'){this.status='running';this.lastTick=monotonic;}}
 finish(monotonic,wallClock){this.tick(monotonic);this.status='finished';this.endedAt=wallClock;}
 snapshot(){return {eventId:this.eventId,startedAt:this.startedAt,targetSec:this.targetSec,elapsedMs:Math.floor(this.elapsedMs),status:this.status,endedAt:this.endedAt};}
 payload(){return {eventId:this.eventId,startedAt:this.startedAt,endedAt:this.endedAt,durationSec:Math.floor(this.elapsedMs/1000),targetSec:this.targetSec};}
}
