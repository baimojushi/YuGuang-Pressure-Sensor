import {icon,lamp} from './visuals.js';
import {createRecordFeatures} from './records-ui.js';
import {createRestControls} from './rest-ui.js';
import {createDevicePanel} from './device-panel.js';
const $=s=>document.querySelector(s);
const appStyle=document.createElement('link');appStyle.rel='stylesheet';appStyle.href='/release.css';document.head.append(appStyle);
const deviceStyle=document.createElement('link');deviceStyle.rel='stylesheet';deviceStyle.href='/device-panel.css';document.head.append(deviceStyle);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const params=new URLSearchParams(location.search);
const mode=location.pathname.startsWith('/demo')||params.has('as')?'demo':'live';
const apiBase=mode==='demo'?'/api/demo':'/api',tokenKey='yg-v2-token:'+mode;
let lightPreviewId=null;
let token=sessionStorage.getItem(tokenKey),config=null,state=null,view='home',selected='miss',draft='',replyPreference='none',audioId=null,audioName='',busy=false,sim=false,command=null,lastCommand=null,playing=null,recording=null,recordTimer=null,toastTimer,retry=null,offline=false,pairCode='',issuedInvite=null,composeExpanded=false;
const rests=createRestControls({api,toast,refresh:()=>refresh(true)});
const records=createRecordFeatures({api,toast,getUser:()=>state?.user,restMarkup:()=>rests.markup(),onContent:()=>rests.mount(state)});
const devicePanel=createDevicePanel({api,toast,getUser:()=>state?.user,restMarkup:()=>rests.markup()});
const endpoint=url=>apiBase+url.replace(/^\/api/,'');
async function api(url,options={}){const headers={...(token?{Authorization:'Bearer '+token}:{}),...options.headers};if(options.body&&!(options.body instanceof FormData))headers['Content-Type']='application/json';const r=await fetch(endpoint(url),{...options,headers,body:options.body instanceof FormData?options.body:options.body?JSON.stringify(options.body):undefined});let data;try{data=await r.json();}catch{throw Error('服务暂时未能响应，请稍后重试');}if(!r.ok){const e=Object.assign(Error(data.error||'操作未完成'),{status:r.status,code:data.code});throw e;}return data;}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),4200);}
function setToken(value){token=value||null;if(token)sessionStorage.setItem(tokenKey,token);else sessionStorage.removeItem(tokenKey);}
async function act(fn){try{await fn();}catch(e){toast(e.message);}}
const time=t=>new Date(t).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
const dialogNode=$('#dialog');dialogNode.addEventListener('close',()=>{if(!dialogNode.open)dialogNode.replaceChildren();});
function showDialog(html,bind){const d=dialogNode;if(d.open)d.close();d.innerHTML=html;d.showModal();bind?.(d);}
function authView(register=false){
 document.title='余光 · '+(register?'注册':'登录');
 const platform=config?.authProvider==='platform';
 $('#app').innerHTML='<main class="auth-page"><a class="auth-brand" href="/"><img src="/icon.svg" alt="">余光</a><div class="card"><div class="eyebrow">A LITTLE LIGHT, A LITTLE CLOSER</div><h1>'+(platform&&config.signedIn?'设置我的余光':register?'建立自己的连接':'留一束光，给在意的人')+'</h1><p>'+(platform?'使用个人身份进入，连接在意的人，按需绑定自己的玩偶。':'用手机就能互相关心，有玩偶时再绑定。')+'</p>'+
 (platform&&!config.signedIn?'<a class="primary" href="'+esc(config.signInUrl)+'" target="_top">登录个人账号</a>':
 '<form id="auth-form">'+(register||platform?'<label>怎么称呼你<input id="auth-name" required maxlength="40" autocomplete="nickname" placeholder="你的称呼"></label>':'')+
 (!platform?'<label>账号<input id="auth-account" required minlength="3" maxlength="80" autocomplete="username" placeholder="邮箱或自定账号"></label><label>密码<input id="auth-password" type="password" required '+(register?'minlength="12"':'')+' maxlength="200" autocomplete="'+(register?'new-password':'current-password')+'" placeholder="'+(register?'至少 12 位':'输入密码')+'"></label>':'')+
 '<button class="primary" id="auth-submit" type="submit">'+(register||platform?'开始使用':'登录')+'</button></form>'+(!platform?'<button class="text-button section-gap" id="auth-toggle">'+(register?'已有账号，去登录':'还没有账号，创建一个')+'</button>':'')
 )+'<p class="privacy-note">你的呼吸和休息记录只留给自己，亲友连接由双方主动建立。</p></div></main>';
 $('#auth-toggle')?.addEventListener('click',()=>authView(!register));
 $('#auth-form')?.addEventListener('submit',e=>{e.preventDefault();act(async()=>{const b={name:$('#auth-name')?.value,account:$('#auth-account')?.value,password:$('#auth-password')?.value};$('#auth-submit').disabled=true;try{if(register||platform)await api('/register',{method:'POST',body:b});const result=await api('/login',{method:'POST',body:b});setToken(result.token);await refresh(true);}finally{if($('#auth-submit'))$('#auth-submit').disabled=false;}});});
}
async function demoLogin(role='sender'){stopAudio();stopVoiceRead();if(recording?.state==='recording')recording.stop();replyPreference='none';selected='miss';lightPreviewId=null;composeExpanded=false;pairCode='';issuedInvite=null;sim=false;command=null;lastCommand=null;const r=await api('/login',{method:'POST',body:{account:role==='receiver'?'ayu':'xiaoman',password:'yuguang1031'}});setToken(r.token);view='home';draft='';audioId=null;audioName='';history.replaceState({},'','/demo?as='+role);await refresh(true);}
async function refresh(force=false){try{const next=await api('/state'),changed=JSON.stringify(next)!==JSON.stringify(state),recovered=offline;state=next;offline=false;if(force||changed||recovered)render();}catch(e){if(e.status===401){setToken(null);state=null;stopAudio();sim=false;if(mode==='live'){config=await api('/config');authView(config.authProvider==='platform'&&config.signedIn);}}else{const firstFailure=!offline;offline=true;if(state&&(force||firstFailure))render();else if(!state)throw e;}}}
const meta={miss:'heart',meal:'meal',rest:'moon',cheer:'spark'};
function statusLabel(m){return m.received?(m.ack_source==='gpio5_ir'?'已收到 ♡':'已主动回应 ♡'):m.direction==='incoming'?'亲友送来的心意':'已送出';}
function shell(content){return '<div class="layout"><aside class="sidebar"><div class="brand"><img class="brandmark" src="/icon.svg" alt=""><div><b>余光</b><small>YUGUANG</small></div></div><div class="side-caption">留一盏光，给在意的人</div><nav class="nav" aria-label="主导航">'+[['home','heart','此刻在场'],['history','list','呼吸与互动'],['device','lamp','我的余光'],['pair','link','亲友连接']].map(([v,i,n])=>'<button data-view="'+v+'" class="'+(view===v?'active':'')+'" '+(view===v?'aria-current="page"':'')+'>'+icon(i)+n+'</button>').join('')+'</nav><div class="side-end"><p>最好的陪伴，<br>不要求你此刻回应。</p>'+(mode==='demo'?'<a href="/">进入正式版 ↗</a>':'<span class="tiny-dot"></span>属于你自己的余光')+'</div></aside><main class="workspace"><header class="topbar"><div class="mobile-brand"><img src="/icon.svg" alt="">余光</div><div class="breadcrumb">余光 / <strong>'+({home:'情感在场',history:'呼吸与互动',device:'我的余光',pair:'亲友连接'})[view]+'</strong></div><div class="account">'+(mode==='demo'?'<span class="demo-pill">展示版 · '+esc(state.user.name)+'</span>':'')+'<span class="avatar">'+esc(state.user.name[0])+'</span><span>'+esc(state.user.name)+'</span><button class="text-button" id="account-action">'+(mode==='demo'?'切换身份 ⇄':'退出登录')+'</button></div></header>'+(offline?'<div class="error-banner">暂时离线，当前显示上次保存的内容。</div>':'')+'<div class="intro"><div><div class="eyebrow">A LITTLE LIGHT, A LITTLE CLOSER</div><h1>'+({home:'此刻，安心做自己',history:'自己的节奏，相伴的时光',device:'你的余光，由你决定',pair:'靠近一点，保留自由'})[view]+'</h1><p>关心可以等待，是否继续交流由你决定。</p></div></div>'+content+'<footer class="footnote"><span>余光 · 不打断，也不缺席</span><span>原声主动回听 · 没有已读考勤</span></footer></main></div>';}
function compose(){return '<section class="card compose-card"><div class="card-title"><h2>把心意，送给在意的人</h2><span>'+(state.peer?'送给 '+esc(state.peer.name):'先连接一位亲友')+'</span></div>'+(!state.pair?'<div class="notice">还没有建立连接。通过邀请码配对后，就可以互相送出心意。</div><button class="secondary" data-view="pair">去连接亲友 ↗</button>':'')+'<div class="intent-grid">'+Object.entries(state.intents).map(([key,i])=>'<button class="intent '+(selected===key?'selected':'')+'" data-intent="'+key+'" aria-pressed="'+(selected===key)+'">'+icon(meta[key])+'<b>'+esc(i.label)+'</b><small>'+esc(i.description)+'</small></button>').join('')+'</div><button class="text-button light-preview-link" id="preview-light">按文字预览灯语 ↗</button><fieldset class="reply-preference"><legend>想怎样回应？</legend><label><input name="preference" type="radio" value="none" '+(replyPreference==='none'?'checked':'')+'>不用回复</label><label><input name="preference" type="radio" value="when_free" '+(replyPreference==='when_free'?'checked':'')+'>方便时回复</label></fieldset><details class="compose-extra" id="compose-extra" '+(composeExpanded||recording?'open':'')+'><summary>捎句话或留原声 <span>选填</span></summary><div class="note"><label for="note">捎上一句话 <small>可选 · 最多 140 字</small></label><textarea id="note" maxlength="140" placeholder="例如：忙完再听就好。">'+esc(draft)+'</textarea></div><div class="voice">'+icon('mic')+'<span>'+esc(audioName||'也可以留一段自己的原声')+'</span><div class="voice-controls"><button id="record" '+(!state.pair?'disabled':'')+'>'+(recording?'结束录音':'录音')+'</button><button id="choose-audio" '+(!state.pair?'disabled':'')+'>上传音频</button>'+(audioId?'<button id="remove-audio">移除</button>':'')+'</div><input class="sr" id="audio-file" type="file" accept="audio/*"></div></details><button id="send" class="primary section-gap" '+(!state.pair||busy?'disabled':'')+'>'+icon('send')+'送出这份心意</button><p class="helper">心意不催促回应；急事请用电话联系。</p></section>';}
function messageCard(m){return '<article class="record"><div class="record-top"><span class="mini-icon">'+icon(meta[m.intent])+'</span><div class="record-title"><b>'+esc(state.intents[m.intent].label)+'</b><small>'+esc(m.direction==='incoming'?'来自 '+state.peer?.name:'送给 '+state.peer?.name)+' · '+time(m.created)+'</small></div><span class="status">'+statusLabel(m)+'</span></div>'+(m.note?'<p>'+esc(m.note)+'</p>':'')+'<small class="response-note">'+(m.replyPreference==='when_free'?'方便时回复，没有倒计时':'不用回复，心意也在这里')+'</small>'+(m.light?'<small class="response-note">已记录灯语 · '+esc(m.light.description)+' · '+esc(m.lightMapping?.engine||'规则映射')+'</small>':'')+(m.audioUrl?'<button class="audio-button" data-audio="'+esc(m.audioUrl)+'" data-id="'+m.id+'">'+icon('headphones')+'主动回听原声</button><div class="audio-wrap" id="audio-'+m.id+'"></div>':'')+(m.direction==='incoming'?'<div class="quick-replies">'+(state.device?'<button type="button" data-voice-read="'+m.id+'">🎙️ 说“朗读收到的消息”</button>':'')+'<button data-ack="'+m.id+'">收到啦</button><button data-reply="'+m.id+'" data-phrase="我也想你" data-reply-intent="miss">我也想你</button><button data-reply="'+m.id+'" data-phrase="忙完再聊" data-reply-intent="cheer">忙完再聊</button></div>':'')+'</article>';}
function inbox(){return '<section class="card inbox-card"><div class="card-title"><h2>亲友送来的心意</h2><button class="text-button" data-history-section="interaction">全部心意 ↗</button></div>'+(state.messages.filter(m=>m.direction==='incoming').slice(0,1).map(messageCard).join('')||'<div class="empty">这里还没有亲友送来的心意。<br>不必着急，连接也有自己的节奏。</div>')+'</section>';}
function home(){
 const d=state.device,r=state.rest;
 const sending=state.pair?compose():'<section class="card welcome-card"><h2>先连接一个在意的人</h2><p>把邀请码交给亲友，或输入对方的邀请码，就可以互相送关心。</p><button class="primary" data-view="pair">连接亲友 ↗</button><small class="privacy-note">不需要先有玩偶，手机也能收到心意。</small></section>';
 return '<div class="grid home-grid"><div>'+sending+'</div><div>'+inbox()+'<div class="home-shortcuts"><button data-history-section="breathing">'+icon('heart')+'<span><b>我的呼吸</b><small>记录与练习 · 仅自己可见</small></span><span aria-hidden="true">↗</span></button><button data-history-section="rest">'+icon('moon')+'<span><b>'+(r?'休息正在进行':'自由休息')+'</b><small>'+(r?'休息至 '+time(r.endsAt):'给自己留一会儿时间')+'</small></span><span aria-hidden="true">↗</span></button></div><button class="home-device-link" data-view="device">'+icon('lamp')+'<span>'+(d?(d.focus?'玩偶专注中':d.online?'自己的玩偶在线':'自己的玩偶待连接'):'有玩偶时，再绑定自己的余光')+'</span><span aria-hidden="true">↗</span></button></div></div>';
}
function deviceView(){return devicePanel.markup(state,{mode,sim,command,lastCommand,offline});}
function pairView(){
 const invite=issuedInvite?'<div class="code">'+esc(issuedInvite.code)+'</div><p class="helper">有效至 '+time(issuedInvite.expires)+' · 仅使用一次</p>':'';
 const connection=state.peer?'<div class="connection"><div><span class="avatar">'+esc(state.user.name[0])+'</span><p>'+esc(state.user.name)+'</p></div><div class="connection-line"></div><div><span class="avatar">'+esc(state.peer.name[0])+'</span><p>'+esc(state.peer.name)+'</p></div></div><p>你们都可以发送心意和主动回复，有没有玩偶都可以。各自的设备、专注、呼吸与休息记录只归本人。</p><button class="secondary danger" id="unbind">解除当前连接</button>':
 '<p>用手机就能互相关心。你们任何一方都可以发起连接，不需要先绑定玩偶。</p><h3>邀请在意的人</h3><p>生成邀请码发给亲友，有效期 10 分钟。</p><div id="invite-result">'+invite+'</div><button class="secondary" id="invite">'+(issuedInvite?'重新生成邀请码':'生成邀请码')+'</button><div class="pair-join section-gap"><label for="pair-code">或者，输入亲友分享的邀请码</label><input id="pair-code" maxlength="10" autocomplete="off" placeholder="输入邀请码" value="'+esc(pairCode)+'"><button class="primary section-gap" id="pair">连接亲友</button></div>';
 const testing=config.authProvider==='password'?'<div class="notice section-gap"><b>一台电脑测试两个人</b><p>另开标签页，用另一个账号注册或登录，再把邀请码填到另一端。两个标签页各自保留登录。</p><a class="secondary" href="/" target="_blank" rel="noopener" id="open-second-account">打开另一个账号 ↗</a></div>':'';
 return '<div class="two-cols"><section class="card"><div class="card-title"><h2>'+(state.peer?'你们已经连接':'建立一条安静的通道')+'</h2><span>一对一 · 双向关心</span></div>'+connection+testing+'</section><section class="card explain"><h2>连接里，也留有边界</h2><p>一人有玩偶，另一人用手机送关心；两人都有玩偶，就各自接收发给自己的灯语。没有玩偶时，心意也会保存在 App 中。</p><p>触摸只表示“我收到了”，并不代表有空、已吃饭或已休息。不展示自动已读状态，不催促回复。</p><p>任何一方都可以解绑。解绑后，旧心意与原声不可访问；各自的呼吸与休息记录保留。</p>'+(mode==='demo'?'<div class="notice">这里是展示环境，可切换小满和阿屿测试完整流程。正式版不会创建这两个身份。</div><a class="secondary" href="/demo?as='+(state.user.account==='xiaoman'?'receiver':'sender')+'" target="_blank" rel="noopener">打开另一端展示 ↗</a>':'')+'</section></div>';
}
function render(){if(!state||playing)return;document.title=state.user.name+'的余光';const focused=document.activeElement?.id,pos=document.activeElement?.selectionStart;$('#app').innerHTML=shell(view==='home'?home():view==='history'?records.view():view==='device'?deviceView():pairView());bind();records.mount(state,view);rests.mount(state);if(view==='device')devicePanel.mount(state);if(focused==='note'&&$('#note')){$('#note').focus();$('#note').setSelectionRange(pos,pos);}}
async function sendPayload(payload){await api('/messages',{method:'POST',body:payload});await refresh(true);toast('心意已送出，什么时候回应都可以');}
async function send(){if(busy)return;busy=true;const payload={intent:selected,note:draft,audioId,replyPreference,...(lightPreviewId?{previewId:lightPreviewId}:{})};if(!retry||JSON.stringify(retry.payload)!==JSON.stringify(payload))retry={payload,clientId:crypto.randomUUID()};try{await sendPayload({...payload,clientId:retry.clientId});retry=null;draft='';lightPreviewId=null;audioId=null;audioName='';composeExpanded=false;}catch(e){toast(e.message);}finally{busy=false;render();}}
function bindMessages(root=document){root.querySelectorAll('[data-voice-read]').forEach(b=>b.onclick=()=>act(voiceReadBrowser));root.querySelectorAll('[data-audio]').forEach(b=>b.onclick=()=>playAudio(b));root.querySelectorAll('[data-ack]').forEach(b=>b.onclick=()=>act(async()=>{await api('/messages/'+b.dataset.ack+'/ack',{method:'POST',body:{eventId:crypto.randomUUID()}});await refresh(true);toast('已主动回应：我收到了');}));root.querySelectorAll('[data-reply]').forEach(b=>b.onclick=()=>act(()=>sendPayload({intent:b.dataset.replyIntent,note:b.dataset.phrase,replyTo:b.dataset.reply,replyPreference:'none',clientId:crypto.randomUUID()})));}
function bind(){
 $('#preview-light')?.addEventListener('click',()=>act(async()=>{
  const result=await api('/light/preview',{method:'POST',body:{intent:selected,note:draft,replyPreference}});
  const light=result.light;lightPreviewId=result.previewId;
  showDialog('<h2>文字映射的灯语</h2>'+lamp(result.intent,esc(state.intents[result.intent].label),esc(light.description),light)+
    '<p>映射依据：'+esc(result.mapping.engine)+' · 节奏 '+esc(light.periodMs)+'ms · '+esc(light.cycles)+' 次</p>'+
    '<p>颜色：'+light.colors.map(c=>'<span class="dp-chip" style="background:'+esc(c)+';display:inline-block;width:24px;height:20px;border-radius:5px;margin:3px" title="'+esc(c)+'"></span>').join('')+'</p>'+
    '<p class="privacy-note">灯语 JSON 会随消息保存，设备收到的是已保存的效果。朗读须由接收者主动请求。</p>'+
    '<button class="secondary" id="close-preview">看好了</button>',
    d=>d.querySelector('#close-preview').onclick=()=>d.close());
 }));
 document.querySelectorAll('[data-history-section]').forEach(b=>b.onclick=()=>{stopAudio();records.select(b.dataset.historySection);view='history';render();window.scrollTo({top:0,behavior:'smooth'});});
 $('#compose-extra')?.addEventListener('toggle',e=>composeExpanded=e.target.open);
 document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{stopAudio();view=b.dataset.view;render();window.scrollTo({top:0,behavior:'smooth'});});
 $('#account-action').onclick=()=>{if(mode==='demo')showDialog('<h2>切换展示身份</h2><p>两个示例身份仅用于展示，和正式版的数据完全分开。</p><div class="button-row"><button class="secondary" id="demo-sender">小满 · 手机送关心</button><button class="secondary" id="demo-receiver">阿屿 · 已绑定玩偶</button></div><button class="text-button section-gap" id="close-dialog">关闭</button>',d=>{for(const r of ['sender','receiver'])d.querySelector('#demo-'+r).onclick=()=>act(async()=>{d.close();await demoLogin(r);});d.querySelector('#close-dialog').onclick=()=>d.close();});else act(async()=>{stopAudio();stopVoiceRead();if(recording?.state==='recording')recording.stop();draft='';lightPreviewId=null;composeExpanded=false;pairCode='';issuedInvite=null;audioId=null;audioName='';replyPreference='none';selected='miss';await api('/logout',{method:'POST',body:{}});setToken(null);state=null;if(config.authProvider==='platform')location.assign(config.signOutUrl);else authView();});};
 document.querySelectorAll('[data-intent]').forEach(b=>b.onclick=()=>{selected=b.dataset.intent;lightPreviewId=null;render();});
 document.querySelectorAll('[name=preference]').forEach(b=>b.onchange=()=>{replyPreference=b.value;lightPreviewId=null;});
 $('#note')?.addEventListener('input',e=>{draft=e.target.value;lightPreviewId=null;});$('#send')?.addEventListener('click',send);
 $('#choose-audio')?.addEventListener('click',()=>$('#audio-file').click());$('#audio-file')?.addEventListener('change',e=>uploadAudio(e.target.files[0]));$('#remove-audio')?.addEventListener('click',()=>{audioId=null;audioName='';render();});$('#record')?.addEventListener('click',toggleRecord);
 document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>act(async()=>{await api('/device',{method:'PATCH',body:{[b.dataset.mode]:!state.device[b.dataset.mode]}});command=null;await refresh(true);}));
 $('#connect')?.addEventListener('click',()=>act(async()=>{sim=!sim;if(!sim){await api('/simulator/heartbeat',{method:'POST',body:{online:false}});command=null;lastCommand=null;}else await tick();await refresh(true);}));
 $('#touch')?.addEventListener('click',()=>act(async()=>{if(!lastCommand)return;await api('/simulator/touch',{method:'POST',body:{commandId:lastCommand.id,eventId:crypto.randomUUID()}});lastCommand=null;command=null;await refresh(true);toast('已送回：我收到了');}));
 $('#invite')?.addEventListener('click',()=>act(async()=>{issuedInvite=await api('/invites',{method:'POST',body:{}});render();}));
 $('#pair-code')?.addEventListener('input',e=>pairCode=e.target.value);
 $('#pair')?.addEventListener('click',()=>act(async()=>{await api('/pair',{method:'POST',body:{code:pairCode}});pairCode='';issuedInvite=null;await refresh(true);toast('已经连接，可以互相送出心意了');}));
 $('#unbind')?.addEventListener('click',()=>showDialog('<h2>解除这段连接？</h2><p>无需对方同意。解除后清除这段连接的消息与原声，各自的呼吸与休息记录保留。</p><div class="button-row"><button class="secondary" id="cancel-unbind">保留连接</button><button class="secondary danger" id="confirm-unbind">确认解绑并清除</button></div>',d=>{d.querySelector('#cancel-unbind').onclick=()=>d.close();d.querySelector('#confirm-unbind').onclick=()=>act(async()=>{await api('/pair',{method:'DELETE'});d.close();stopVoiceRead();stopAudio();command=null;lastCommand=null;pairCode='';issuedInvite=null;await refresh(true);});}));
 $('#bind-device')?.addEventListener('click',()=>act(async()=>showDeviceKey(await api('/device',{method:'POST',body:{}}))));
 $('#rotate-key')?.addEventListener('click',()=>showDialog('<h2>重新生成密钥？</h2><p>旧密钥将立即失效，需要同步更新玩偶固件中的配置。</p><div class="button-row"><button class="secondary" id="cancel-key">取消</button><button class="secondary" id="confirm-key">生成新密钥</button></div>',d=>{d.querySelector('#cancel-key').onclick=()=>d.close();d.querySelector('#confirm-key').onclick=()=>act(async()=>{d.close();showDeviceKey(await api('/device/key',{method:'POST',body:{}}));});}));
 bindMessages();
}
function showDeviceKey(data){showDialog('<h2>配置你的玩偶</h2><p>密钥只在这次显示。复制给你自己的固件配置，不要放进公开仓库。</p><label>API 地址<input readonly value="'+esc(data.apiBase)+'"></label><label>设备编号<input readonly value="'+esc(data.deviceId)+'"></label><label>设备密钥<input id="device-key" readonly value="'+esc(data.key)+'"></label><div class="button-row"><button class="secondary" id="copy-device">复制配置</button><button class="primary" id="done-device">我已保存</button></div>',d=>{d.querySelector('#copy-device').onclick=()=>act(async()=>{await navigator.clipboard.writeText(JSON.stringify(data,null,2));toast('设备配置已复制');});d.querySelector('#done-device').onclick=()=>{d.close();refresh(true);};});}
async function uploadAudio(file){if(!file)return;if(file.size>5*1024*1024)return toast('请使用小于 5 MB 的音频');const f=new FormData();f.append('audio',file);await act(async()=>{const r=await api('/audio',{method:'POST',body:f});audioId=r.id;audioName=file.name;composeExpanded=true;render();toast('原声已附上，发送后由亲友主动回听');});}
async function toggleRecord(){if(recording?.state==='recording'){recording.stop();return;}if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)return toast('当前浏览器不能录音，可上传已有音频');try{const stream=await navigator.mediaDevices.getUserMedia({audio:true}),chunks=[],mime=['audio/webm','audio/mp4','audio/ogg'].find(t=>MediaRecorder.isTypeSupported(t));recording=new MediaRecorder(stream,mime?{mimeType:mime}:{});const current=recording,recordOwner=state.user.id;current.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};current.onstop=async()=>{clearTimeout(recordTimer);stream.getTracks().forEach(t=>t.stop());recording=null;if(state?.user.id!==recordOwner)return;await uploadAudio(new File(chunks,'亲友原声.'+(current.mimeType.includes('mp4')?'m4a':'webm'),{type:current.mimeType}));render();};current.start();recordTimer=setTimeout(()=>current.state==='recording'&&current.stop(),30000);render();}catch{toast('没有获得麦克风权限，可以上传已有音频');}}
function stopAudio(){if(playing){playing.audio.pause();URL.revokeObjectURL(playing.url);playing=null;}}
async function playAudio(b){await act(async()=>{
 stopAudio();const r=await fetch(endpoint(b.dataset.audio),{headers:token?{Authorization:'Bearer '+token}:{}});if(!r.ok)throw Error('这段原声已不可用');
 const url=URL.createObjectURL(await r.blob()),audio=document.createElement('audio');audio.controls=true;audio.src=url;$('#audio-'+b.dataset.id)?.replaceChildren(audio);const current={audio,url};playing=current;
 const release=()=>{if(playing===current){URL.revokeObjectURL(url);playing=null;}};
 audio.onended=()=>{release();render();};audio.onpause=release;audio.onerror=()=>{release();toast('这段原声无法播放，请换一个音频文件重试');render();};
 try{await audio.play();}catch{release();audio.remove();render();throw Error('这段原声无法播放，请换一个音频文件重试');}
});}

let speechTask=null;
function stopVoiceRead(){
 try{speechTask?.recognizer?.abort();}catch{}
 try{window.speechSynthesis?.cancel();}catch{}
 speechTask=null;
}
async function voiceReadBrowser(){
 if(speechTask)return toast('当前已有一条朗读请求');
 const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!Recognition||!window.speechSynthesis||!state?.device)throw Error('此浏览器不支持语音识别，或尚未绑定自己的设备');
 if(!window.isSecureContext)throw Error('请通过 HTTPS 或本机 localhost 使用麦克风');
 const ownerId=state.user.id,deviceId=state.device.id;
 const recognition=new Recognition();
 recognition.lang='zh-CN';recognition.interimResults=false;recognition.continuous=false;
 const task={recognizer:recognition};speechTask=task;
 recognition.onresult=async event=>{
  if(speechTask!==task||state?.user.id!==ownerId)return;
  const text=Array.from(event.results).filter(r=>r.isFinal).map(r=>r[0]?.transcript||'').join(' ').trim();
  if(!text)return;
  try{
   const result=await api('/voice/browser-read',{method:'POST',body:{
    schema_version:'yuguang.voice-read.v1',type:'voice_read',source:'browser_asr_final',
    event_id:crypto.randomUUID(),device_id:deviceId,transcript:text,occurred_at_ms:Date.now()
   }});
   if(!result.play)return toast('该朗读请求已处理');
   if(speechTask!==task||state?.user.id!==ownerId)return;
   const utterance=new SpeechSynthesisUtterance(result.speakText);
   utterance.lang='zh-CN';utterance.rate=.92;utterance.volume=.7;
   let recorded=false;
   const finish=async status=>{
    if(recorded)return;recorded=true;
    const payload={schema_version:'yuguang.voice-read.v1',type:'voice_playback',
      source:'browser_audio_result',event_id:crypto.randomUUID(),request_id:result.requestId,
      device_id:deviceId,status,occurred_at_ms:Date.now()};
    try{await api('/voice/browser-playback',{method:'POST',body:payload});}catch{}
    if(speechTask===task){speechTask=null;toast(status==='played'?'已朗读收到的文本':'朗读播放失败');}
   };
   utterance.onend=()=>finish('played');utterance.onerror=()=>finish('failed');
   window.speechSynthesis.speak(utterance);
  }catch(e){if(speechTask===task){speechTask=null;toast(e.message);}}
 };
 recognition.onerror=event=>{if(speechTask===task){speechTask=null;toast('语音识别失败：'+event.error);}};
 recognition.onnomatch=()=>{if(speechTask===task){speechTask=null;toast('没有听清朗读指令');}};
 recognition.start();toast('请说：朗读刚才收到的消息');
}

let polling=false;
async function tick(){if(!state||mode!=='demo'||!sim||polling)return;polling=true;try{await api('/simulator/heartbeat',{method:'POST',body:{}});const result=await api('/simulator/pending');let c=result.command;if(c?.status==='offered')c=await api('/simulator/delivered',{method:'POST',body:{commandId:c.id}});const changed=JSON.stringify(c)!==JSON.stringify(command);command=c;if(c)lastCommand=c;await refresh(changed);}catch(e){offline=true;}finally{polling=false;}}
window.addEventListener('yg-play-audio',e=>playAudio(e.detail));
window.addEventListener('yg-bind-messages',()=>bindMessages($('#records-content')));
async function boot(){try{config=await api('/config');if(mode==='demo'){if(token){try{state=await api('/state');if(params.get('as')&&state.user.account!==(params.get('as')==='receiver'?'ayu':'xiaoman'))await demoLogin(params.get('as'));else render();}catch{await demoLogin(params.get('as')||'sender');}}else await demoLogin(params.get('as')||'sender');}else if(config.authProvider==='platform'?(config.signedIn&&config.registered):!!token)await refresh(true);else authView(config.authProvider==='platform'&&config.signedIn);setInterval(()=>sim?tick():state&&refresh(),2200);if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});}catch(e){$('#app').innerHTML='<div class="loading">余光<small style="display:block">'+esc(e.message)+'</small><button class="secondary" id="retry-boot">重新连接</button></div>';$('#retry-boot').onclick=boot;}}
boot();
