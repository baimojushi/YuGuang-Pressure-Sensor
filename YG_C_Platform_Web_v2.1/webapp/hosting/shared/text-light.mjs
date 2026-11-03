/**
 * 文本 -> 受限灯语。每一次调用均有确定性的本地映射兜底。
 * 可选的私有 LLM 服务仅能选择预先审核的 4 个情绪意图；不得直接写 GPIO/亮度/RGB。
 */
export const LIGHT_SCHEMA = 'yuguang.light.v1';
export const MAPPER_VERSION = 'text-light/1.0';
const PRESETS = Object.freeze({
  miss: {pattern:'slow_breathe', colors:['#E6B4B7'],periodMs:6000,cycles:1,durationMs:6000,maxBrightness:.12,description:'柔桃粉，一次轻柔而缓慢的明暗起伏'},
  meal: {pattern:'soft_pulse',colors:['#E8A568','#FFF0D5'],periodMs:2800,cycles:2,durationMs:5600,maxBrightness:.12,description:'暖橙与乳白，低亮度交织'},
  rest: {pattern:'slow_fade',colors:['#E0AB76'],periodMs:6000,cycles:1,durationMs:6000,maxBrightness:.09,description:'柔暖橙，缓慢收暗后恢复'},
  cheer: {pattern:'soft_pulse',colors:['#E6B4B7'],periodMs:2100,cycles:2,durationMs:4200,maxBrightness:.16,description:'柔桃粉，两次温和的亮度跃动'}
});
const CUES = Object.freeze({
  miss: [/想你/,/思念/,/牵挂/,/好想/,/miss you/i,/抱抱/,/想念/],
  meal: [/吃饭/,/午饭/,/晚饭/,/早餐/,/记得吃/,/好好吃/,/吃点/,/喝点水/,/补充能量/],
  rest: [/休息/,/睡觉/,/别熬/,/早睡/,/熬夜/,/早点睡/,/太累/,/别太累/,/歇一歇/,/放松/],
  cheer: [/加油/,/辛苦/,/棒棒/,/厉害/,/相信你/,/支持你/,/可以的/,/拍拍/,/冲呀/,/你真棒/]
});
const VALID = new Set(Object.keys(PRESETS));
const isValidIntent = value => typeof value==='string' && VALID.has(value);
export function classifyText(note='', fallback='miss') {
  if (!isValidIntent(fallback)) throw new TypeError('unknown light intent');
  if (typeof note!=='string'||note.length>140) throw new TypeError('note must be <=140 characters');
  const text=note.normalize('NFKC').replace(/\s+/g,' ').trim();
  // 明确否定的“我不想你”不能映射成想念；多个类别分数相同时尊重发送者选项。
  const scores=Object.fromEntries(Object.entries(CUES).map(([intent,pats])=>
    [intent,pats.reduce((score,re)=>score+(re.test(text)?1:0),0)]));
  if (/不想你|不思念|不想念|别想我/.test(text)) scores.miss=0;
  const top=Math.max(...Object.values(scores));
  if (!top) return {intent:fallback,source:'sender_selection',matchCount:0};
  const tied=Object.keys(scores).filter(k=>scores[k]===top);
  return {intent:tied.includes(fallback)?fallback:tied[0],source:'text_rules',matchCount:top};
}
export function validatedLight(intent, replyPreference='none') {
  if (!isValidIntent(intent)||!['none','when_free'].includes(replyPreference)) throw new TypeError('invalid lamp parameters');
  const base=replyPreference==='when_free'
    ? {pattern:'slow_fade',colors:['#CA8954'],periodMs:6000,cycles:1,durationMs:6000,maxBrightness:.10,description:'方便时回应：一次六秒的暖橙渐隐'}
    : PRESETS[intent];
  return {schema:LIGHT_SCHEMA,pattern:base.pattern,colors:[...base.colors],periodMs:base.periodMs,
    cycles:base.cycles,durationMs:base.durationMs,maxBrightness:base.maxBrightness,
    description:base.description,sound:false,vibration:false,autoFade:true};
}
/** 可选的模型服务使用 HTTP POST {schema,note,allowedIntents}; 仅接受 {intent} 响应。 */
export async function mapTextToLight(body,env={},fetchImpl=fetch) {
  const note=String(body.note??'');
  const fallback=body.intent;
  const classified=classifyText(note,fallback);
  let intent=classified.intent,engine=classified.source;
  // 只有合法且已配置的私有端点才调用；失败始终回退到本地确定性规则。
  if (note.trim() && env.LIGHT_MAPPER_URL && !body.preview) {
    const endpoint=String(env.LIGHT_MAPPER_URL);
    if (/^https:\/\/[a-z0-9][a-z0-9.-]+(?:\/[\w/-]*)?$/i.test(endpoint)) {
      try {
        const res=await fetchImpl(endpoint,{
          method:'POST',headers:{'content-type':'application/json',
            ...(env.LIGHT_MAPPER_TOKEN?{Authorization:'Bearer '+env.LIGHT_MAPPER_TOKEN}:{})},
          body:JSON.stringify({schema:'yuguang.light.classify.v1',note,allowedIntents:[...VALID]}),
          signal:AbortSignal.timeout(2000)
        });
        if (res.ok && Number(res.headers.get('content-length')||'0')<2048) {
          const out=await res.json();
          if (out && Object.keys(out).length===1 && isValidIntent(out.intent)) {
            intent=out.intent;engine='llm_validated';
          }
        }
      } catch { engine=classified.source+'_fallback'; }
    }
  }
  return {intent,light:validatedLight(intent,body.replyPreference||'none'),
    mapping:{version:MAPPER_VERSION,engine,selectedIntent:fallback,matchedCount:classified.matchCount}};
}
