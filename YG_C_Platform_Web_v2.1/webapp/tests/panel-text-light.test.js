import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {dirname,join} from 'node:path';
const root=join(dirname(fileURLToPath(import.meta.url)),'../../');
const importFile=relative=>import(pathToFileURL(join(root,relative)).href);
const platform=await importFile('webapp/shared/text-light.mjs');
const panel=await importFile('panel/src/utils/yuguangTextLight.ts');

const CASES=[
  ['我想你了','miss'],
  ['好想你，抱抱','miss'],
  ['记得按时吃饭','meal'],
  ['别熬太晚，早点休息','rest'],
  ['加油，你可以的','cheer'],
  ['我不想你','miss'],
  ['今天天气不错','miss'],
  ['吃饭还是休息','meal'],
  ['方便的时候回我','rest']
];

test('控制面板灯语映射与平台规则逐例一致',async()=>{
  for(const [note,intent] of CASES){
    const a=await platform.mapTextToLight({note,intent,replyPreference:'none',preview:true});
    const b=panel.mapTextToLight(note,intent,'none');
    assert.deepEqual(b.light,a.light,`灯语 JSON 不一致：${note}`);
    assert.equal(b.intent,a.intent,`意图不一致：${note}`);
    assert.equal(b.mapping.engine,a.mapping.engine,`映射依据不一致：${note}`);
    assert.equal(b.mapping.matchedCount,a.mapping.matchedCount,`命中数不一致：${note}`);
  }
});

test('when_free 回应偏好与平台覆盖结果一致，且优于所选意图',async()=>{
  for(const intent of ['miss','meal','rest','cheer']){
    const a=await platform.mapTextToLight({note:'',intent,replyPreference:'when_free',preview:true});
    const b=panel.mapTextToLight('',intent,'when_free');
    assert.deepEqual(b.light,a.light);
    assert.equal(b.light.pattern,'slow_fade');
    assert.equal(b.light.colors[0],'#CA8954');
  }
});

test('超长文本与非法意图在两端同样被拒绝',()=>{
  const long='好'.repeat(141);
  assert.throws(()=>platform.classifyText(long,'miss'),TypeError);
  assert.throws(()=>panel.classifyText(long,'miss'),TypeError);
  assert.throws(()=>panel.classifyText('你好','sad'),TypeError);
});

test('控制面板朗读口令：动作词命中、否定拦截',()=>{
  assert.equal(panel.isReadAloudIntent('朗读'),true);
  assert.equal(panel.isReadAloudIntent('说给我听'),true);
  assert.equal(panel.isReadAloudIntent('不要朗读了'),false);
  assert.equal(panel.isReadAloudIntent('取消播放'),false);
  assert.equal(panel.isReadAloudIntent('好'),false);
});
