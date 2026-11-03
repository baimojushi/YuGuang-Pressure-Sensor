import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PracticeTimer,validatePractice,practiceMatches} from '../public/practice-model.js';
import {interactionReport,periodRange,reportCSV} from '../public/records.js';
test('实际前台计时：暂停、恢复、进程休眠不补算，达到目标封顶',()=>{
 const t=new PracticeTimer({eventId:'timer',startedAt:Date.now(),targetSec:60});t.resume(0);t.tick(1000);t.pause(1500);assert.equal(t.elapsedMs,1500);t.tick(20000);assert.equal(t.elapsedMs,1500);t.resume(20000);t.tick(21000);assert.equal(t.elapsedMs,2500);t.tick(90000);assert.equal(t.elapsedMs,2500);
 for(let i=1;i<=60;i++)t.tick(90000+i*1000);assert.equal(t.elapsedMs,60000);t.finish(151000,Date.now());assert.equal(t.payload().durationSec,60);
 const restored=new PracticeTimer({...t.snapshot(),status:'paused'});restored.resume(0);restored.tick(1000);assert.equal(restored.elapsedMs,60000);
});
test('提前结束只保存实际计时，练习绝不生成测量频率',()=>{
 const end=Date.now(),body={eventId:'practice',startedAt:end-12000,endedAt:end,durationSec:8,targetSec:60};const b=validatePractice(body);assert.equal(b.status,'ended_early');assert.equal(b.source,'guided');assert.equal(b.avgRpm,null);assert.deepEqual(b.samples,[]);assert.equal(b.sampleCount,0);
 const r=interactionReport([],[],[b],periodRange('day'));assert.equal(r.counts.breathingSeconds,8);assert.ok(reportCSV(r).includes('练习计时'));assert.ok(!reportCSV(r).includes('设备采集'));
 assert.ok(practiceMatches(body,{...b}));assert.ok(!practiceMatches(body,{...b,durationSec:9}));
 for(const patch of [{durationSec:0},{durationSec:80},{durationSec:60},{targetSec:20},{durationSec:1.5},{endedAt:end+900000}])assert.throws(()=>validatePractice({...body,...patch}));
 const complete=validatePractice({...body,startedAt:end-60000,durationSec:60});assert.equal(complete.status,'completed');
});
