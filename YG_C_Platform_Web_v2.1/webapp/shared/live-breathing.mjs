// Continuous desk sensing is independent of light power, focus and pairing.
const STALE_MS=15000, WINDOW_MS=300000, BUCKET_MS=30000;
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
function validate(body,now){
 const {eventId,measuredAt,status,rpm}=body;
 if(typeof eventId!=='string'||!eventId.trim()||eventId.length>100)fail(400,'需要唯一的呼吸事件编号');
 if(!Number.isSafeInteger(measuredAt)||measuredAt<now-30000||measuredAt>now+5000)fail(400,'采样时间需校准；实时接口不接收超过 30 秒的离线积压');
 if(!['tracking','no_signal','paused'].includes(status))fail(400,'采集状态无效');
 if(status==='tracking'?(typeof rpm!=='number'||!Number.isFinite(rpm)||rpm<=0||rpm>120):rpm!=null)fail(400,'有有效信号才提交呼吸频率；无信号不能填零或旧值');
 return {eventId,measuredAt,status,rpm:status==='tracking'?Math.round(rpm*100)/100:null};
}
export function ingestLiveBreathing(s,device,body,now){
 const point=validate(body,now);s.breathingLive??={};const old=s.breathingLive[device.id];
 const fingerprint=JSON.stringify(point),previous=old?.events?.find(e=>e.id===point.eventId);
 if(previous){if(previous.fingerprint!==fingerprint)fail(409,'实时事件编号冲突');return {ok:true,duplicate:true};}
 if(old&&point.measuredAt<=old.measuredAt)fail(409,'实时采样需按时间递增；离线历史请使用分段记录接口');
 if(old&&now-old.receivedAt<1000)fail(429,'实时结果最多每秒上报一次，请合并后重试');
 const points=(old?.points||[]).filter(p=>p.at>=point.measuredAt-WINDOW_MS).concat({at:point.measuredAt,rpm:point.rpm}).slice(-150);
 s.breathingLive[device.id]={...point,receivedAt:now,points,events:[...(old?.events||[]),{id:point.eventId,fingerprint}].slice(-32)};
 device.lastSeen=now;
 if(point.status==='tracking'){
  const windowStart=Math.floor(point.measuredAt/WINDOW_MS)*WINDOW_MS,eventId='continuous:'+device.id+':'+windowStart;
  let record=s.breathing.find(b=>b.deviceId===device.id&&b.eventId===eventId);
  if(!record){record={id:crypto.randomUUID(),eventId,ownerId:device.ownerId,deviceId:device.id,source:'hardware',captureMode:'continuous',created:now,startedAt:point.measuredAt,samples:[]};s.breathing.push(record);}
  const offsetMs=point.measuredAt-record.startedAt;
  const existing=record.samples.find(p=>Math.floor(p.offsetMs/BUCKET_MS)===Math.floor(offsetMs/BUCKET_MS));
  if(existing)Object.assign(existing,{offsetMs,rpm:point.rpm});else record.samples.push({offsetMs,rpm:point.rpm});
  record.endedAt=point.measuredAt;record.durationSec=Math.round((record.endedAt-record.startedAt)/1000);
  record.sampleCount=record.samples.length;
  record.avgRpm=Math.round(record.samples.reduce((sum,p)=>sum+p.rpm,0)/record.sampleCount*10)/10;
  record.minRpm=Math.min(...record.samples.map(p=>p.rpm));record.maxRpm=Math.max(...record.samples.map(p=>p.rpm));
 }
 return {ok:true,pollAfterMs:2000,archiveWindowMs:WINDOW_MS};
}
export function liveBreathingView(s,user,now){
 const d=s.devices.find(d=>d.ownerId===user.id),live=d&&s.breathingLive?.[d.id];
 const status=!d?'unbound':!live?'waiting':now-live.receivedAt>STALE_MS||now-live.measuredAt>STALE_MS?'stale':live.status;
 return {status,deviceId:d?.id||null,serverNow:now,staleAfterMs:STALE_MS,measuredAt:live?.measuredAt||null,receivedAt:live?.receivedAt||null,rpm:status==='tracking'?live.rpm:null,
  points:live?.points||[],captureMode:'continuous',trendKind:'frequency',archiveWindowMs:WINDOW_MS};
}
