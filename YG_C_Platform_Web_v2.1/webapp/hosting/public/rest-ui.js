const $=s=>document.querySelector(s);
export function createRestControls({api,toast,refresh}){
 let rest=null,seconds=300,busy=false,pendingId=null;
 function markup(){return `<section class="card rest-card"><div class="card-title"><h2>自由休息</h2><span>离开桌面，也可以</span></div><p>走走、喝口水，或什么也不做。</p><div id="rest-body"></div><small class="privacy-note">自由休息离开页面仍继续计时。网页关闭后的提醒需依靠已连接的玩偶固件，不能只依赖浏览器。</small></section>`;}
 function draw(){const el=$('#rest-body');if(!el)return;if(!rest){el.innerHTML=`<div class="practice-targets">${[300,600,900].map(s=>`<button data-rest-seconds="${s}" aria-pressed="${seconds===s}" ${busy?'disabled':''}>${s/60} 分钟</button>`).join('')}</div><button class="primary" id="start-rest" ${busy?'disabled':''}>${busy?'正在开始…':'开始自由休息'}</button>`;el.querySelectorAll('[data-rest-seconds]').forEach(b=>b.onclick=()=>{seconds=Number(b.dataset.restSeconds);draw();});$('#start-rest').onclick=()=>act(async()=>{pendingId??=crypto.randomUUID();window.dispatchEvent(new CustomEvent('yg-rest-start'));await api('/rest',{method:'POST',body:{clientId:pendingId,durationSec:seconds}});pendingId=null;await refresh();toast('休息已经开始，心意会安静等候');});return;}
  const left=Math.max(0,Math.ceil((rest.endsAt-Date.now())/1000)),due=left===0;el.innerHTML=`<div class="rest-countdown" role="timer">${due?'休息到时':String(Math.floor(left/60)).padStart(2,'0')+':'+String(left%60).padStart(2,'0')}</div><p class="helper">${due?'愿意的话，再慢慢回到自己的节奏。':'休息期间，新的灯语先安静等候。'}</p><div class="button-row"><button class="primary" id="end-rest" ${busy?'disabled':''}>${due?'我回来了':'提前结束'}</button><button class="secondary" id="extend-rest" ${busy?'disabled':''}>再休息 5 分钟</button></div>`;
  $('#end-rest').onclick=()=>act(async()=>{await api('/rest/'+rest.id,{method:'PATCH',body:{action:due?'ack':'end'}});await refresh();});$('#extend-rest').onclick=()=>act(async()=>{await api('/rest/'+rest.id,{method:'PATCH',body:{action:'extend',seconds:300,eventId:crypto.randomUUID()}});await refresh();});
 }
 async function act(fn){if(busy)return;busy=true;draw();try{await fn();}catch(e){toast(e.message);}finally{busy=false;draw();}}
 setInterval(()=>{if(rest&&$('#rest-body')){const focused=document.activeElement?.id;if(focused!=='end-rest'&&focused!=='extend-rest')draw();}},1000);
 return {markup,mount(state){rest=state.rest;draw();}};
}
