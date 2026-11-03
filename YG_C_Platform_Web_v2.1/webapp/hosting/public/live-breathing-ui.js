const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={unbound:'等待绑定设备',waiting:'等待持续采集',tracking:'正在持续采集',no_signal:'暂未检测到有效信号',paused:'设备采集已暂停',stale:'采集连接已中断',offline:'暂时无法同步',loading:'正在连接采集设备'};
export function liveCard(data,failed=false){
 const status=failed?'offline':data?.status||'loading',tracking=status==='tracking',points=data?.points||[];
 const time=data?.measuredAt?new Date(data.measuredAt).toLocaleTimeString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}):'—';
 const values=points.filter(p=>p.rpm!==null),min=Math.min(...values.map(p=>p.rpm)),max=Math.max(...values.map(p=>p.rpm)),first=points[0]?.at||0,last=points.at(-1)?.at||0;
 let segments=[],segment=[],previousAt=null;for(const p of points){if(previousAt!==null&&p.at-previousAt>15000){if(segment.length)segments.push(segment);segment=[];}previousAt=p.at;if(p.rpm===null){if(segment.length)segments.push(segment);segment=[];continue;}segment.push(`${10+(p.at-first)/Math.max(1,last-first)*280},${65-(p.rpm-min)/Math.max(2,max-min)*45}`);}if(segment.length)segments.push(segment);
 const chart=values.length?`<svg viewBox="0 0 300 85" class="breath-chart" role="img" aria-label="最近五分钟内已收到的呼吸频率趋势，不是逐次呼吸波形">${segments.map(seg=>seg.length===1?`<circle cx="${seg[0].split(',')[0]}" cy="${seg[0].split(',')[1]}" r="3" fill="currentColor"/>`:`<polyline points="${seg.join(' ')}" stroke="currentColor" stroke-width="2.5" fill="none"/>`).join('')}<text x="10" y="83" font-size="9" fill="currentColor">${min}–${max} 次/分 · 最近收到的频率趋势</text></svg>`:'<div class="live-trend-empty">有真实数据后，频率变化会出现在这里。</div>';
 const detail=status==='unbound'?'绑定桌搭并接入传感器后，开机持续采集。':status==='no_signal'?'设备仍在工作，当前没有可用呼吸结果。':status==='stale'?'已停止显示当前值，等待设备重新上报。':status==='offline'?'当前值暂不显示，恢复连接后自动更新。':status==='paused'?'采集由设备暂停，恢复后自动更新。':'桌搭开机后持续上报，不需要在 App 点击开始。';
 return `<section class="card live-breathing-card"><div class="card-title"><h2>此刻的呼吸</h2><span class="private-label">仅自己可见</span></div><div class="live-breathing-main"><div><strong id="live-rpm">${tracking?esc(data.rpm):'—'}</strong><span>次 / 分</span></div><span class="live-status ${tracking?'is-tracking':''}" role="status">${labels[status]||labels.waiting}</span></div><p class="live-description">${detail}</p><div class="live-trend ${tracking?'':'is-muted'}">${chart}</div><div class="live-meta"><span>最近采样 ${time}</span><span>自动更新 · 自动分段留存</span></div><small class="privacy-note">显示设备计算的频率趋势，不代表逐次吸气 / 呼气波形或情绪判断。</small></section>`;
}
export function createLiveBreathing({api,getUser,rootId="live-breathing"}){
 let data=null,failed=false,identity=null,generation=0,busy=false,loadedAt=0;
 const root=()=>document.getElementById(rootId);
 function draw(){if(root())root().innerHTML=liveCard(data,failed);}
 async function poll(){const who=getUser()?.id;if(!root()||!who||document.hidden||busy)return;const ticket=generation;busy=true;
  try{const result=await api('/breathing/live');if(ticket!==generation||who!==getUser()?.id)return;data=result;loadedAt=Date.now();failed=false;draw();}
  catch{if(ticket===generation&&who===getUser()?.id){failed=true;draw();}}
  finally{busy=false;}
 }
 setInterval(()=>{if(!root())return;if(data&&Date.now()-loadedAt>data.staleAfterMs&&data.status==='tracking'){data={...data,status:'stale',rpm:null};draw();}poll();},2200);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll();});
 return {markup:()=>'<div id="'+rootId+'">'+liveCard(data,failed)+'</div>',mount(){const who=getUser()?.id;if(who!==identity){generation++;identity=who;data=null;failed=false;}draw();poll();}};
}
