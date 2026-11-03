import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ingestLiveBreathing,liveBreathingView} from '../shared/live-breathing.mjs';
import {liveCard} from '../public/live-breathing-ui.js';
const start=1793354400000;
function setup(){const d={id:'private-device',ownerId:'owner',focus:true,power:false},s={devices:[d],breathing:[]},user={id:'owner'};return {d,s,user};}
test('持续采集不受灯光专注与关灯影响；新窗口自动建记录，无需页面开启',()=>{
 const {d,s,user}=setup();for(const [i,delta] of [0,2000,32000,300000].entries())ingestLiveBreathing(s,d,{eventId:'point-'+i,measuredAt:start+delta,status:'tracking',rpm:12+i},start+delta);
 assert.equal(s.breathing.length,2);assert.equal(s.breathing[0].sampleCount,2);assert.equal(s.breathing[0].samples[0].offsetMs,2000);assert.equal(s.breathing[0].samples[0].rpm,13);assert.equal(s.breathing[1].samples[0].rpm,15);assert.equal(liveBreathingView(s,user,start+300000).rpm,15);
 assert.equal(d.focus,true);assert.equal(d.power,false);
});
test('无信号和数据过期不保留当前值；缺口不填假数据',()=>{
 const {d,s,user}=setup();ingestLiveBreathing(s,d,{eventId:'one',measuredAt:start,status:'tracking',rpm:12},start);
 assert.equal(liveBreathingView(s,user,start+15001).status,'stale');assert.equal(liveBreathingView(s,user,start+15001).rpm,null);
 ingestLiveBreathing(s,d,{eventId:'missing',measuredAt:start+16000,status:'no_signal'},start+16000);
 let view=liveBreathingView(s,user,start+16000);assert.equal(view.status,'no_signal');assert.equal(view.points.at(-1).rpm,null);assert.equal(s.breathing[0].samples.length,1);
 ingestLiveBreathing(s,d,{eventId:'resume',measuredAt:start+32000,status:'tracking',rpm:13},start+32000);
 assert.equal(s.breathing[0].samples.length,2);view=liveBreathingView(s,user,start+32000);assert.equal(view.status,'tracking');
 assert.equal(liveBreathingView(s,{id:'friend'},start).deviceId,null);
});
test('实时事件去重、冲突、时间校验及流量限制',()=>{
 const {d,s}=setup(),point={eventId:'one',measuredAt:start,status:'tracking',rpm:12};ingestLiveBreathing(s,d,point,start);
 assert.equal(ingestLiveBreathing(s,d,point,start+1200).duplicate,true);
 for(const [body,now,status] of [[{...point,rpm:13},start+1200,409],[{...point,eventId:'two'},start+1200,409],[{...point,eventId:'next',measuredAt:start+500},start+500,429],[{...point,eventId:'late',measuredAt:start-31000},start,400],[{...point,eventId:'future',measuredAt:start+6000},start,400],[{...point,status:'no_signal'},start,400],[{...point,rpm:0},start,400]])assert.throws(()=>ingestLiveBreathing(s,d,body,now),e=>e.status===status);
});
test('实时点和幂等窗口有界；每个自动记录不超过十个降采样点',()=>{
 const {d,s}=setup();for(let i=0;i<400;i++)ingestLiveBreathing(s,d,{eventId:'point-'+i,measuredAt:start+i*1000,status:'tracking',rpm:12},start+i*1000);
 assert.ok(s.breathingLive[d.id].points.length<=150);assert.equal(s.breathingLive[d.id].events.length,32);assert.equal(s.breathing.length,2);assert.ok(s.breathing.every(b=>b.samples.length<=10));
});
test('实时卡片不将过期值、无信号或网络失败显示成当前值',()=>{
 const {s,d,user}=setup();assert.match(liveCard(liveBreathingView(s,user,start)),/等待持续采集/);
 ingestLiveBreathing(s,d,{eventId:'live',measuredAt:start,status:'tracking',rpm:12.5},start);
 const view=liveBreathingView(s,user,start);assert.match(liveCard(view),/id="live-rpm">12.5/);
 assert.match(liveCard(view,true),/id="live-rpm">—/);assert.match(liveCard(liveBreathingView(s,user,start+15001)),/id="live-rpm">—/);
 assert.match(liveCard(view),/不是逐次呼吸波形/);
});
