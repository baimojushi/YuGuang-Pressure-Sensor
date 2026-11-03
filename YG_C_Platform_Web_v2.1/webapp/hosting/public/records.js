// Shared reporting rules, used by both backends and the browser.
const DAY=86400000, OFFSET=8*3600000;
export const dateKey=t=>new Date(t+OFFSET).toISOString().slice(0,10);
export function periodRange(period='week',date=dateKey(Date.now())){
 if(!['day','week','month'].includes(period)||!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Object.assign(Error('请选择有效的日期与日、周或月范围'),{status:400});
 const utc=Date.parse(date+'T00:00:00Z');if(!Number.isFinite(utc)||new Date(utc).toISOString().slice(0,10)!==date)throw Object.assign(Error('日期无效'),{status:400});
 let start=utc-OFFSET,end=start+DAY;
 if(period==='week'){start-=((new Date(utc).getUTCDay()+6)%7)*DAY;end=start+7*DAY;}
 if(period==='month'){const d=new Date(utc);start=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1)-OFFSET;end=Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1)-OFFSET;}
 return {period,date,start,end,timeZone:'Asia/Shanghai',startDate:dateKey(start),endDate:dateKey(end-1)};
}
export function validateBreathing(body,clock=Date.now()){
 const bad=msg=>{throw Object.assign(Error(msg),{status:400});};
 if(!body||typeof body.eventId!=='string'||!body.eventId.trim()||body.eventId.length>100)bad('需要长度为 1–100 的 eventId');
 const {startedAt,endedAt,samples}=body;
 if(!Number.isSafeInteger(startedAt)||!Number.isSafeInteger(endedAt)||startedAt<=0||endedAt<=startedAt||endedAt-startedAt>DAY||endedAt>clock+300000)bad('开始与结束需为毫秒时间戳，单次记录最长 24 小时，不能在未来');
 if(!Array.isArray(samples)||!samples.length||samples.length>720)bad('需要 1–720 个呼吸采样点');
 let last=-1;const points=samples.map(p=>{if(!p||!Number.isSafeInteger(p.offsetMs)||p.offsetMs<0||p.offsetMs>endedAt-startedAt||p.offsetMs<=last||typeof p.rpm!=='number'||!Number.isFinite(p.rpm)||p.rpm<=0||p.rpm>120)bad('采样点需按 offsetMs 严格递增，rpm 为大于 0 且不超过 120 的数值');last=p.offsetMs;return {offsetMs:p.offsetMs,rpm:Math.round(p.rpm*100)/100};});
 return {eventId:body.eventId,startedAt,endedAt,durationSec:Math.round((endedAt-startedAt)/1000),samples:points,sampleCount:points.length,avgRpm:Math.round(points.reduce((a,p)=>a+p.rpm,0)/points.length*10)/10,minRpm:Math.min(...points.map(p=>p.rpm)),maxRpm:Math.max(...points.map(p=>p.rpm)),source:'hardware'};
}
export function interactionReport(messages,touches,breathing,range){
 const inside=t=>Number.isFinite(t)&&t>=range.start&&t<range.end;
 const sent=messages.filter(m=>inside(m.created)),delivered=messages.filter(m=>inside(m.delivered));
 const firstTouches=new Map();for(const t of touches){const command=t.commandId??t.command_id,old=firstTouches.get(command);if(!old||old.created>t.created)firstTouches.set(command,t);}
 const received=[...firstTouches.values()].filter(t=>inside(t.created));
 const sessions=breathing.filter(b=>inside(b.startedAt));
 const days=[];for(let t=range.start;t<range.end;t+=DAY){const date=dateKey(t);days.push({date,sent:sent.filter(m=>dateKey(m.created)===date).length,touches:received.filter(x=>dateKey(x.created)===date).length});}
 const intents=Object.fromEntries(['miss','meal','rest','cheer'].map(k=>[k,sent.filter(m=>m.intent===k).length]));
 return {range,counts:{sent:sent.length,delivered:delivered.length,touches:received.length,queued:sent.filter(m=>m.status==='queued').length,activeDays:days.filter(d=>d.sent+d.touches>0).length,breathingSessions:sessions.length,breathingSeconds:sessions.reduce((n,b)=>n+b.durationSec,0)},intents,days,messages:sent,events:[...sent.map(m=>({type:'light',at:m.created,intent:m.intent,status:m.status})),...received.map(t=>({type:'touch',at:t.created}))].sort((a,b)=>a.at-b.at),breathing:sessions};
}
export function reportCSV(report){
 const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';
 const rows=[['类型','时间（北京时间）','灯语','当前状态','时长（秒）','平均呼吸（次/分）','来源']];
 const labels={miss:'我想你了',meal:'记得吃饭',rest:'别熬太晚',cheer:'加油 / 拍拍你'},status={queued:'已送出',delivered:'已送出',sent:'已送出',saved:'已送出',received:'主动回应'};
 const at=t=>new Date(t).toLocaleString('sv-SE',{timeZone:'Asia/Shanghai'});
 for(const e of report.events)rows.push([e.type==='light'?'灯语':'触摸回执',at(e.at),labels[e.intent]||'',e.type==='touch'?'主动回应':status[e.status]||'','','','真实保存的互动']);
 for(const b of report.breathing)rows.push(['我的呼吸',at(b.startedAt),'','',b.durationSec,b.avgRpm??'',b.source==='guided'?'练习计时':'设备采集']);
 return '\uFEFF'+rows.map(r=>r.map(quote).join(',')).join('\r\n');
}

// Direction and acknowledgement are separate: a reply does not stop being outgoing.
export function filterInteractionMessages(messages,filter){
 if(filter==='sent')return messages.filter(m=>m.direction==='outgoing');
 if(filter==='received')return messages.filter(m=>m.received!=null||m.status==='received');
 return messages;
}
