/**
 * 余光设备控制面板。参考物模型控制页的「状态、可写属性、预览、设备设置」结构。
 * 唯二可以修改硬件模式的属性是 focus 和 power；预览永远只在浏览器中执行。
 * 设备真实状态与呼吸频率由服务端提供，禁止使用模拟值代替缺失的测量。
 */
import {icon,lamp} from './visuals.js';
import {createLiveBreathing} from './live-breathing-ui.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const PREVIEWS=[
 {id:'miss',icon:'heart',name:'想念',light:'柔桃粉 · 一次慢起伏',hint:'一轮约 6 秒，结束后淡出'},
 {id:'meal',icon:'meal',name:'记得吃饭',light:'嫩绿 · 三次轻起伏',hint:'提醒吃饭，也记得照顾自己'},
 {id:'rest',icon:'moon',name:'早点休息',light:'嫩绿 · 三次轻起伏',hint:'温柔提醒，不要求立即回应'},
 {id:'cheer',icon:'spark',name:'为你加油',light:'柔桃粉 · 一次慢起伏',hint:'一次明亮的鼓励'},
 {id:'request',icon:'sun',name:'方便时回应',light:'深橙 · 一次慢起伏',hint:'只在需要时使用，约 6 秒淡出'}
];
const labelFor=(d,mode,sim,offline)=>{
 if(offline)return {name:'连接暂时中断',tone:'away',note:'等待网络恢复后再确认设备状态'};
 if(!d)return {name:'尚未绑定',tone:'away',note:'先生成你的设备信息'};
 if(mode==='demo')return sim?{name:'演示灯已连接',tone:'demo',note:'仅用于展示，不代表真实硬件在线'}:{name:'演示灯未连接',tone:'away',note:'可以在展示版模拟灯语与轻触'};
 return d.online?{name:'设备心跳在线',tone:'online',note:'已收到设备心跳，灯效由固件执行'}:{name:'等待设备心跳',tone:'away',note:'绑定完成，等待设备联网上报'};
};
function renderSwitch({key,iconName,label,description,on,disabled}){
 return `<div class="dp-control-row"><div class="dp-control-symbol">${icon(iconName)}</div><div class="dp-control-text"><b>${label}</b><p>${description}</p></div><button class="dp-switch ${on?'is-on':''}" type="button" data-mode="${key}" role="switch" aria-checked="${on}" aria-label="${label}" ${disabled?'disabled aria-disabled="true"':''}><span></span></button></div>`;
}
export function createDevicePanel({api,toast,getUser,restMarkup}){
 const live=createLiveBreathing({api,getUser,rootId:'device-live-breathing'});
 let selected='auto',brightness=70,lastOwner=null,lastContext={};
 function markup(state,{mode='live',sim=false,command=null,lastCommand=null,offline=false}={}){
  lastContext={mode,sim,command,lastCommand,offline};
  if(state.user?.id!==lastOwner){lastOwner=state.user?.id;selected='auto';brightness=70;}
  const device=state.device,rest=state.rest,report=labelFor(device,mode,sim,offline);
  const validCommand=command&&Object.hasOwn(state.intents||{},command.intent);
  const demoPlaying=mode==='demo'&&sim&&validCommand&&!!command?.play&&(!command.playUntil||command.playUntil>Date.now())&&device?.power&&!device?.focus&&!rest;
  const choice=PREVIEWS.find(p=>p.id===selected),intents=state.intents||{};
  const stage=choice?.id||(demoPlaying?command.intent:'quiet');
  const caption=choice?`正在预览 · ${choice.name}`:demoPlaying?`模拟灯语 · ${intents[command.intent].label}`:rest?'当前休息中':device?.focus?'深度专注中':device&&!device.power?'情感光已关闭':'此刻安静陪着你';
  const sub=choice?'仅屏幕预览，不会向设备发送指令':demoPlaying?'仅展示模式：来自对方的模拟灯语':'实际灯效由设备固件执行，页面只作示意';
  const canWrite=!!device&&!offline;
  const statusNotes=[
   ['设备连接',report.name],
   ['情感光',device?(device.power?'允许点亮':'已关闭'):'等待绑定'],
   ['专注状态',device?(device.focus?'深度专注':'正常接收'):'等待绑定'],
   ['自由休息',rest?'正在休息':'未开启']
  ];
  const connection=report.tone==='online'?'is-online':report.tone==='demo'?'is-demo':'is-away';
  const previewItems=PREVIEWS.map(p=>`<button type="button" class="dp-preset ${selected===p.id?'is-selected':''}" data-dp-preview="${p.id}" aria-pressed="${selected===p.id}">${icon(p.icon)}<span><b>${esc(p.name)}</b><small>${esc(p.light)}</small></span></button>`).join('');
  const hardwareTitle=mode==='demo'?'展示模拟灯':'真实桌搭接入';
  const hardwareHelp=mode==='demo'?'这里仅运行展示数据。正式版通过真实设备密钥接收心意与呼吸。':'设备密钥与平台账号分开，固件带密钥调用硬件接口；灵机平台绑定仍需硬件同学联调。';
  return `<div class="dp-panel">
   <section class="dp-hero card" aria-label="余光设备状态与灯语预览">
    <div class="dp-hero-heading"><div><div class="dp-eyebrow"><span class="dp-sun">✳</span> 这一盏光 · 只属于你</div><h2>让关心，亮得刚刚好。</h2><p>你的桌搭会安静守候，什么时候回应，都由你决定。</p></div><div class="dp-connection ${connection}" role="status"><span class="dp-indicator"></span><span>${report.name}</span></div></div>
    <div class="dp-hero-body"><div class="dp-display"><div class="dp-orbit dp-orbit-one"></div><div class="dp-orbit dp-orbit-two"></div><div class="dp-star dp-star-one">✳</div><div class="dp-star dp-star-two">✧</div><div class="dp-light-display" aria-live="polite" style="--dp-brightness:${brightness/100}">${lamp(stage,esc(caption),esc(sub))}</div><div class="dp-display-foot"><span class="dp-dot"></span>${choice?'灯语在本页试播':'设备灯语示意'}<span class="dp-display-index">01 / 余光</span></div></div>
    <div class="dp-snapshot"><div class="dp-section-eyebrow">现在的陪伴状态</div><h3>${device?(rest?'好好休息一会儿':device.focus?'专注时，心意会等你':device.power?'温柔的光，随时可以等候':'心意保留，灯光暂歇'):'先让自己的余光上线'}</h3><p>${report.note}。${device?'关闭情感光或开启专注，新的灯语将安静排队。':'没有硬件，也能收发心意并记录自由休息。'}</p><dl class="dp-state-list">${statusNotes.map(([k,v])=>`<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl><div class="dp-status-foot">${icon('leaf')}<span>页面展示不等于真机执行确认</span></div></div></div>
   </section>
   <div class="dp-main-grid"><div class="dp-primary-column">
    <section class="card dp-card dp-controls"><div class="dp-card-header"><div><div class="dp-section-eyebrow">自己决定 · 01</div><h2>日常模式</h2><p>状态保存在余光服务端，设备上线后读取并执行。</p></div><div class="dp-chip">${device?'已绑定':'待绑定'}</div></div>
    ${renderSwitch({key:'power',iconName:'lamp',label:'允许情感光',description:'关闭后灯光熄灭；收到的心意仍会保留',on:!!device?.power,disabled:!canWrite})}
    ${renderSwitch({key:'focus',iconName:'moon',label:'深度专注',description:'专注期间，新灯语先排队，不向亲友展示在线状态',on:!!device?.focus,disabled:!canWrite})}
    ${!device?'<div class="dp-inline-hint">还没有绑定桌搭，生成设备编号后即可设置模式。</div>':offline?'<div class="dp-inline-hint">当前无法同步，请在连接恢复后操作。</div>':'<div class="dp-inline-hint">模式只影响情感光；持续呼吸采集由设备固件独立运行。</div>'}</section>
    <section class="card dp-card dp-preview"><div class="dp-card-header"><div><div class="dp-section-eyebrow">心意有光 · 02</div><h2>灯语预览</h2><p>在屏幕上看看不同心意的颜色与节奏。</p></div><span class="dp-preview-label">仅屏幕预览</span></div>
     <div class="dp-preset-grid">${previewItems}</div>
     <div class="dp-preview-tools"><button type="button" class="dp-reset" id="dp-preview-reset" ${selected==='auto'?'disabled':''}>${icon('close')}退出预览 · 恢复状态</button><label for="dp-brightness">预览光感 <strong id="dp-brightness-value">${brightness}%</strong></label><input id="dp-brightness" aria-label="屏幕预览光感" type="range" min="20" max="100" step="5" value="${brightness}"></div>
     <p class="dp-disclaimer">亮度滑块仅调整页面里的示意灯效。硬件亮度控制尚未提供可写接口。</p>
    </section>
    <div class="dp-breathing">${live.markup()}<button class="dp-inline-link" type="button" data-history-section="breathing">查看我的呼吸与练习记录 ${icon('arrow')}</button></div>
   </div><div class="dp-secondary-column">
    ${restMarkup()}
    <section class="card dp-card dp-hardware"><div class="dp-card-header"><div><div class="dp-section-eyebrow">自己的桌搭 · 03</div><h2>${hardwareTitle}</h2></div></div><p>${hardwareHelp}</p>
    ${device?`<div class="dp-device-id"><span>我的设备编号</span><code>${esc(device.id)}</code><button type="button" id="dp-copy-id" data-device-id="${esc(device.id)}">${icon('check')}复制编号</button></div><button type="button" class="dp-wide-secondary" id="rotate-key">重新生成设备密钥 ${icon('arrow')}</button><p class="dp-key-warning">旧密钥将立即失效。请确认可以同步更新自己的固件配置。</p>`:`<div class="dp-empty-device">${icon('lamp')}<span>当前没有绑定设备</span><small>绑定后将生成独立编号与一次性密钥。</small></div><button type="button" class="primary" id="bind-device">生成设备绑定信息</button>`}
    ${mode==='demo'&&device?`<div class="dp-simulator"><div class="dp-simulator-heading"><b>模拟灯操作</b><small>仅展示环境</small></div><div class="dp-simulator-row"><button type="button" class="secondary" id="connect">${sim?'断开模拟灯':'连接模拟灯'}</button><button type="button" class="secondary" id="touch" ${!sim||!lastCommand||!lastCommand.play||(lastCommand.playUntil&&lastCommand.playUntil<=Date.now())?'disabled':''}>轻触 · 我收到了</button></div><small>先在另一端发送心意，再在这里体验回执。</small></div>`:''}
    <details class="dp-setup"><summary>接入说明 ${icon('arrow')}</summary><ol><li>在本页生成并保存一次性设备密钥。</li><li>将编号与密钥配置到自己设备的固件。</li><li>固件每 10 秒发送心跳，按协议查询灯语和上报呼吸。</li></ol><p>是否真正在线由设备心跳决定；灵机平台接入仍需真机验收。</p></details>
    </section>
    <section class="dp-note"><div>✳</div><p><b>把主动权交给你。</b> 情感光和专注可以在这里设置。语音、振动、电量与固件升级等待硬件接口确认后再接入。</p></section>
   </div></div>
  </div>`;
 }
 function mount(state){
  if(!document.querySelector('.dp-panel'))return;
  const who=state?.user?.id;
  if(who!==lastOwner){lastOwner=who;selected='auto';brightness=70;}
  document.querySelectorAll('[data-dp-preview]').forEach(button=>button.addEventListener('click',()=>{
   selected=button.dataset.dpPreview;
   document.querySelectorAll('[data-dp-preview]').forEach(item=>{const on=item.dataset.dpPreview===selected;item.classList.toggle('is-selected',on);item.setAttribute('aria-pressed',String(on));});
   const reset=document.querySelector('#dp-preview-reset');if(reset)reset.disabled=false;
   updateDisplay(state);
  }));
  document.querySelector('#dp-preview-reset')?.addEventListener('click',()=>{selected='auto';document.querySelectorAll('[data-dp-preview]').forEach(item=>{item.classList.remove('is-selected');item.setAttribute('aria-pressed','false');});const reset=document.querySelector('#dp-preview-reset');if(reset)reset.disabled=true;updateDisplay(state);});
  document.querySelector('#dp-brightness')?.addEventListener('input',event=>{brightness=Number(event.target.value);const label=document.querySelector('#dp-brightness-value');if(label)label.textContent=brightness+'%';document.querySelector('.dp-light-display')?.style.setProperty('--dp-brightness',brightness/100);});
  document.querySelector('#dp-copy-id')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(state.device.id);toast('设备编号已复制');}catch{toast('复制未完成，请手动选中设备编号');}});
  live.mount();
 }
 function updateDisplay(state){
  const root=document.querySelector('.dp-light-display');if(!root)return;
  const mode=selected==='auto'?null:PREVIEWS.find(p=>p.id===selected);
  // 本地点击只改变图像；设备实际状态由下一次 /state 刷新恢复。
  if(mode){root.innerHTML=lamp(mode.id,'正在预览 · '+esc(mode.name),'仅屏幕预览，不会向设备发送指令');}
  else {const {mode:kind,sim,command}=lastContext;
   const demoPlaying=kind==='demo'&&sim&&command?.play&&Object.hasOwn(state.intents||{},command.intent)&&(!command.playUntil||command.playUntil>Date.now())&&state.device?.power&&!state.device?.focus&&!state.rest;
   root.innerHTML=lamp(demoPlaying?command.intent:'quiet',demoPlaying?'模拟灯语 · '+esc(state.intents[command.intent].label):state.rest?'当前休息中':state.device?.focus?'深度专注中':state.device&&!state.device.power?'情感光已关闭':'此刻安静陪着你','退出本地预览；真实灯效由固件执行');}
  const foot=document.querySelector('.dp-display-foot');if(foot&&foot.firstChild?.nodeType===1)foot.childNodes[1].textContent=mode?'灯语在本页试播':'设备灯语示意';
 }
 return {markup,mount};
}
