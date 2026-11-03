import test from 'node:test';
import assert from 'node:assert/strict';
import {createDevicePanel} from '../public/device-panel.js';

const originals={doc:globalThis.document,interval:globalThis.setInterval};
// 这些测试只检查纯渲染，不运行浏览器定时器与异步设备请求。
globalThis.document={addEventListener(){},getElementById(){return null}};
globalThis.setInterval=()=>0;
const panel=createDevicePanel({api:async()=>{throw Error('渲染不应发起 API 请求')},toast:()=>{},getUser:()=>({id:'user-A'}),restMarkup:()=>'<section>自由休息</section>'});
globalThis.document=originals.doc;
globalThis.setInterval=originals.interval;

const state=(device=null)=>({user:{id:'user-A',name:'小满'},intents:{miss:{label:'想念'},meal:{label:'记得吃饭'},rest:{label:'休息'},cheer:{label:'加油'}},device,rest:null,messages:[]});
const device={id:'lamp-test-01',online:false,focus:false,power:true};

test('无设备时开关不可写，呼吸值不使用默认模拟数据',()=>{
 const html=panel.markup(state(),{mode:'live'});
 assert.match(html,/尚未绑定/);
 assert.match(html,/id="bind-device"/);
 assert.doesNotMatch(html,/id="rotate-key"/);
 assert.equal((html.match(/data-mode="(?:focus|power)"[^>]*disabled/g)||[]).length,2);
 assert.match(html,/id="device-live-breathing"/);
 assert.match(html,/此刻的呼吸/);
 assert.doesNotMatch(html,/id="live-rpm">\d+/);
});

test('真实设备在线状态由服务端决定，关闭专注和情感光分别对应写入属性',()=>{
 const html=panel.markup(state({...device,online:true}),{mode:'live'});
 assert.match(html,/设备心跳在线/);
 assert.match(html,/aria-checked="true" aria-label="允许情感光"/);
 assert.match(html,/aria-checked="false" aria-label="深度专注"/);
 assert.equal((html.match(/data-mode="(?:focus|power)"/g)||[]).length,2);
 assert.doesNotMatch(html,/连接模拟灯/);
 assert.match(html,/id="rotate-key"/);
});

test('离线时开关禁用，演示状态从未冒充真实心跳',()=>{
 const offline=panel.markup(state({...device,online:true}),{mode:'live',offline:true});
 assert.match(offline,/连接暂时中断/);
 assert.equal((offline.match(/data-mode="(?:focus|power)"[^>]*disabled/g)||[]).length,2);
 const demo=panel.markup(state(device),{mode:'demo',sim:false});
 assert.match(demo,/演示灯未连接/);
 assert.match(demo,/id="connect"/);
 assert.match(demo,/id="touch" disabled/);
 assert.match(demo,/仅运行展示数据/);
});

test('预览不会下发设备指令，设备编号按 HTML 转义，密钥不写入常规页面',()=>{
 const markup=panel.markup(state({...device,id:'<script>alert(1)</script>'}),{mode:'live'});
 assert.doesNotMatch(markup,/<script>/);
 assert.match(markup,/&lt;script&gt;/);
 assert.match(markup,/仅屏幕预览/);
 assert.match(markup,/硬件亮度控制尚未提供可写接口/);
 assert.doesNotMatch(markup,/device-key/);
});
