import {test} from 'node:test';
import assert from 'node:assert/strict';
import {periodRange,interactionReport,validateBreathing,reportCSV,filterInteractionMessages} from '../public/records.js';
test('北京时间按自然日、周一、自然月分桶，跨年与闰年',()=>{
 const r=periodRange('week','2026-01-01');assert.equal(r.startDate,'2025-12-29');assert.equal(r.endDate,'2026-01-04');
 assert.equal(periodRange('month','2024-02-29').endDate,'2024-02-29');
 assert.throws(()=>periodRange('day','2026-02-29'));assert.throws(()=>periodRange('x','2026-01-01'));
 const day=periodRange('day','2026-10-29');assert.equal(day.start,Date.parse('2026-10-28T16:00:00Z'));
});
test('跨期回执、同指令多次触摸去重、百条以上互动准确统计',()=>{
 const r=periodRange('day','2026-10-29'),t=r.start;
 const messages=Array.from({length:125},(_,i)=>({id:String(i),intent:'miss',created:t+i,status:'queued'}));
 messages.push({id:'old',intent:'meal',created:t-10,delivered:t+10});
 messages.push({id:'next-day',intent:'rest',created:r.end});
 const report=interactionReport(messages,[{command_id:'a',created:t-1},{command_id:'a',created:t+1},{commandId:'b',created:t+5},{commandId:'b',created:t+6}],[],r);
 assert.equal(report.counts.sent,125);assert.equal(report.counts.delivered,1);assert.equal(report.counts.touches,1);assert.equal(report.counts.activeDays,1);assert.equal(report.intents.miss,125);assert.equal(report.days.length,1);assert.equal(report.events.length,126);
 assert.ok(!reportCSV({...report,messages:[{note:'private text'}]}).includes('private text'));
});
test('设备呼吸数据验证，不接受伪造时间与无效采样',()=>{
 const t=Date.now(),body={eventId:'breath-1',startedAt:t-60000,endedAt:t,samples:[{offsetMs:0,rpm:12},{offsetMs:30000,rpm:15}]};
 const b=validateBreathing(body);assert.equal(b.avgRpm,13.5);assert.equal(b.durationSec,60);assert.equal(b.source,'hardware');
 for(const samples of [[],[{offsetMs:0,rpm:-1}],[{offsetMs:60001,rpm:12}],[{offsetMs:0,rpm:12},{offsetMs:0,rpm:15}]])assert.throws(()=>validateBreathing({...body,samples}));
 assert.throws(()=>validateBreathing({...body,endedAt:t+999999}));
});

test('我送出的按发送方向筛选，回应后仍保留；主动回应可跨发送方向',()=>{
 const messages=[
  {id:'out-pending',direction:'outgoing',status:'sent',received:null},
  {id:'out-replied',direction:'outgoing',status:'received',received:100},
  {id:'in-pending',direction:'incoming',status:'sent',received:null},
  {id:'in-replied',direction:'incoming',status:'received',received:200}
 ];
 assert.deepEqual(filterInteractionMessages(messages,'sent').map(m=>m.id),['out-pending','out-replied']);
 assert.deepEqual(filterInteractionMessages(messages,'received').map(m=>m.id),['out-replied','in-replied']);
 assert.equal(filterInteractionMessages(messages,'all').length,4);
});
test('导出的主动回执不标成已送出，CSV 使用真实换行',()=>{
 const csv=reportCSV({events:[{type:'touch',at:Date.now(),status:'sent'}],breathing:[]});
 assert.match(csv,/触摸回执.*主动回应/);
 assert.equal(csv.split('\r\n').length,2);
 assert.ok(!csv.includes('\\r\\n'));
});
