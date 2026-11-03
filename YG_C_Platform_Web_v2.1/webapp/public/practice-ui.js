import {PracticeTimer,PRACTICE_TARGETS} from './practice-model.js';
const clock=()=>performance.now();
const mmss=(ms,roundUp=true)=>{const s=roundUp?Math.ceil(ms/1000):Math.floor(ms/1000);return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;};
export function createPracticePlayer({api,getUser,toast,onSaved,canStart=()=>true}){
 let userId=null,timer=null,targetSec=60,saving=false,saveError=false,lastPersist=0;
 const key=id=>'yg-practice-draft:'+id;
 function persist(){if(!userId)return;try{if(timer)sessionStorage.setItem(key(userId),JSON.stringify(timer.snapshot()));else sessionStorage.removeItem(key(userId));}catch{/* The current session can still finish if browser storage is unavailable. */}}
 function selectUser(){const next=getUser()?.id;if(next===userId)return;if(timer?.status==='running')timer.pause(clock());persist();timer=null;saving=false;saveError=false;userId=next;try{const draft=JSON.parse(sessionStorage.getItem(key(userId))||'null');if(draft&&PRACTICE_TARGETS.includes(draft.targetSec)&&typeof draft.eventId==='string'&&Number.isFinite(draft.elapsedMs)){timer=new PracticeTimer({...draft,status:draft.status==='finished'?'finished':'paused'});targetSec=timer.targetSec;}}catch{timer=null;}}
 function markup(){return `<section class="practice-panel"><div class="card-title"><h3>跟着余光，呼吸一会儿</h3><span>自己的练习计时</span></div><p>轻轻吸气，再慢慢呼气。不屏息，按舒服的节奏来。</p><div class="practice-targets" role="group" aria-label="选择呼吸练习目标时长">${PRACTICE_TARGETS.map(s=>`<button data-practice-target="${s}" aria-pressed="${targetSec===s}" ${timer?'disabled':''}>${s/60} 分钟</button>`).join('')}</div><div class="practice-ring" id="practice-ring"><span id="practice-phase" aria-live="polite">给自己一点时间</span><strong id="practice-countdown">${mmss(targetSec*1000)}</strong></div><p class="practice-progress" id="practice-progress"></p><div class="practice-controls" id="practice-controls"></div><small class="privacy-note">这是练习计时，不测量真实呼吸频率。暂停和切到后台的时间不计入；可以随时提前结束。</small></section>`;}
 function redraw(){const root=document.querySelector('#practice-player');if(!root)return;root.innerHTML=markup();root.querySelectorAll('[data-practice-target]').forEach(b=>b.onclick=()=>{targetSec=Number(b.dataset.practiceTarget);redraw();});draw(true);}
 function draw(controls=false){const root=document.querySelector('#practice-player');if(!root)return;const elapsed=timer?.elapsedMs||0,running=timer?.status==='running',finished=timer?.status==='finished';
  const ring=root.querySelector('#practice-ring'),phase=root.querySelector('#practice-phase'),phaseName=running?(Math.floor(elapsed/4000)%2?'轻轻呼气':'轻轻吸气'):finished?(saveError?'计时已结束，记录待保存':'练习计时已结束'):timer?'暂停也没关系':'给自己一点时间';
  if(phase.textContent!==phaseName)phase.textContent=phaseName;root.querySelector('#practice-countdown').textContent=mmss(Math.max(0,targetSec*1000-elapsed));root.querySelector('#practice-progress').textContent=timer?`已计时 ${mmss(elapsed,false)} / 目标 ${targetSec/60} 分钟`:'从 1 分钟开始，慢一点也很好。';
  ring.classList.toggle('inhale',running&&Math.floor(elapsed/4000)%2===0);ring.classList.toggle('exhale',running&&Math.floor(elapsed/4000)%2===1);
  if(!controls)return;const controlsEl=root.querySelector('#practice-controls');controlsEl.innerHTML=!timer?'<button class="primary" id="practice-start">开始呼吸练习</button>':finished?`<button class="primary" id="practice-save" ${saving?'disabled':''}>${saving?'正在保存…':saveError?'重试保存记录':'保存这次计时'}</button><button class="text-button" id="practice-reset" ${saving?'disabled':''}>放弃这次未保存计时</button>`:`<button class="primary" id="practice-pause">${running?'暂停练习':'继续练习'}</button><button class="secondary" id="practice-finish">结束并保存</button>`;
  root.querySelector('#practice-start')?.addEventListener('click',()=>{if(!canStart()){toast('自由休息还在计时，结束后再开始呼吸练习');return;}timer=new PracticeTimer({eventId:crypto.randomUUID(),startedAt:Date.now(),targetSec});timer.resume(clock());saveError=false;persist();redraw();});
  root.querySelector('#practice-pause')?.addEventListener('click',()=>{if(timer.status==='running')timer.pause(clock());else timer.resume(clock());persist();draw(true);});
  root.querySelector('#practice-finish')?.addEventListener('click',finish);root.querySelector('#practice-save')?.addEventListener('click',save);root.querySelector('#practice-reset')?.addEventListener('click',()=>{timer=null;saveError=false;persist();redraw();});
 }
 async function save(){if(!timer||timer.status!=='finished'||saving)return;const session=timer,owner=userId,payload=session.payload();if(payload.durationSec<1){toast('计时不足 1 秒，不保存空记录');return;}saving=true;draw(true);
  try{await api('/breathing/practice',{method:'POST',body:payload});if(userId!==owner||timer!==session)return;timer=null;saveError=false;persist();toast(payload.durationSec>=payload.targetSec?'这段给自己的时间，已经保存':'已保存实际练习时长，提前结束也没关系');redraw();await onSaved();}
  catch(e){if(userId!==owner||timer!==session)return;saveError=true;persist();toast('还没保存成功，计时已留在本机，请重试');}
  finally{if(userId===owner&&timer===session){saving=false;draw(true);}else if(userId===owner)saving=false;}
 }
 function finish(){if(!timer||saving)return;timer.finish(clock(),Date.now());persist();draw(true);save();}
 window.addEventListener('yg-rest-start',()=>{if(timer?.status==='running'){timer.pause(clock());persist();draw(true);}});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&timer?.status==='running'){timer.pause(clock());persist();draw(true);}});
 window.addEventListener('pagehide',()=>{if(timer?.status==='running')timer.pause(clock());persist();});
 setInterval(()=>{if(timer?.status!=='running')return;if(document.hidden||!document.querySelector('#practice-player')){timer.pause(clock());persist();draw(true);return;}if(timer.tick(clock())){finish();return;}draw();if(Date.now()-lastPersist>1000){persist();lastPersist=Date.now();}},250);
 return {markup,mount(){selectUser();if((!canStart()||!document.querySelector('#practice-player'))&&timer?.status==='running'){timer.pause(clock());persist();}redraw();}};
}
