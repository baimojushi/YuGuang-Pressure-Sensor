<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { xj, data, info, initData } from '@/stores';
import { yuguangFields } from '@/config/yuguang-field-map';

/** 适配参考项目的 XJ SDK，属性键须以真实产品物模型为准。 */
type Mode = 'power' | 'focus';
const presets = [
  { id: 'miss', label: '想念', color: '柔桃粉', rhythm: '慢起伏一轮' },
  { id: 'meal', label: '记得吃饭', color: '嫩绿', rhythm: '轻起伏三次' },
  { id: 'rest', label: '早点休息', color: '嫩绿', rhythm: '轻起伏三次' },
  { id: 'cheer', label: '为你加油', color: '柔桃粉', rhythm: '慢起伏一轮' },
  { id: 'request', label: '方便时回复', color: '深橙', rhythm: '慢起伏一轮' }
] as const;
// 图标取自余光原有 visuals.js 的线条符号，视觉上与 Web App 保持一致。
const previewIcons = {
  miss: 'M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 00-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 000-7.8z',
  meal: 'M4 13h16M3 13a9 9 0 0018 0M8 3v4M12 2v5M16 3v4M5 22h14',
  rest: 'M21 13A9 9 0 0111 3a9 9 0 1010 10z',
  cheer: 'M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3zM21 2v4M19 4h4',
  request: 'M3 17a9 9 0 0118 0M2 21h20M12 2v3M4 5l2 2M20 5l-2 2'
} as const;
const activePreset = ref('quiet');
const previewLevel = ref(70);
const saving = ref<Mode | null>(null);
const message = ref('');
const clock = ref(Date.now());
const lastRealSampleAt = ref<number | null>(null);
let interval: ReturnType<typeof setInterval> | null = null;

const title = computed(() => info?.deviceName || '我的余光');
// 参考工程未给出 status 枚举含义。仅采信 SDK 明确返回的布尔在线标志。
const connected = computed<boolean | null>(() => {
  for (const value of [info?.isOnline, info?.online, info?.onlineStatus, info?.onlionStatus]) {
    if (typeof value === 'boolean') return value;
  }
  return null;
});
const hasDevice = computed(() => Boolean(info?.did || info?.deviceId));
const barHeight = computed(() => (initData?.statusBarHeight || 24) + 56);
const modeValue = (key: Mode): boolean | null => {
  const field = yuguangFields[key];
  return field && typeof data?.[field] === 'boolean' ? Boolean(data[field]) : null;
};
const power = computed(() => modeValue('power'));
const focus = computed(() => modeValue('focus'));
const canWrite = (key: Mode) => Boolean(hasDevice.value && connected.value === true && modeValue(key) !== null && !saving.value);
const unmapped = computed(() => !yuguangFields.power || !yuguangFields.focus);
const realRpm = computed(() => {
  const key = yuguangFields.rpm;
  if (!key || connected.value === false || !lastRealSampleAt.value || clock.value - lastRealSampleAt.value > 15000) return null;
  const value = data?.[key];
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 120 ? value : null;
});
const sensorMessage = computed(() => {
  if (!yuguangFields.rpm) return '呼吸属性尚未映射';
  if (connected.value === false) return '设备不在线，等待上报';
  if (yuguangFields.sensorState && data?.[yuguangFields.sensorState] === 'no_signal') return '暂未检测到有效信号';
  return realRpm.value === null ? '等待最新真实采样' : '来自设备最近上报的频率';
});
const lampColor = computed(() => activePreset.value === 'request' ? '#dc9b65' :
  ['meal', 'rest'].includes(activePreset.value) ? '#bcd9a8' : '#e8b2b1');
const glowClass = computed(() => activePreset.value === 'quiet' ? 'quiet' : ['meal','rest'].includes(activePreset.value) ? 'three' : 'one');
const currentPreview = computed(() => presets.find(p => p.id === activePreset.value));

const updateFromDevice = (updated: Record<string, unknown> | null | undefined) => {
  const rpmKey = yuguangFields.rpm;
  if (!rpmKey || !updated || !Object.prototype.hasOwnProperty.call(updated, rpmKey)) return;
  const value = updated[rpmKey];
  // 仅设备实际推送的新数值可标记为实时；初始化快照不冒充最新采样。
  if (typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 120) lastRealSampleAt.value = Date.now();
  else lastRealSampleAt.value = null;
};
async function changeMode(key: Mode) {
  const field = yuguangFields[key], value = modeValue(key);
  if (!field || value === null || !canWrite(key)) return;
  saving.value = key;
  message.value = '';
  try {
    await Promise.resolve(xj.device.set?.({ [field]: !value }));
    message.value = '设置已发送，请以设备回报状态为准';
    xj.device.get?.([]);
  } catch (e) {
    message.value = '设置发送失败，请检查连接后重试';
  } finally { saving.value = null; }
}
onMounted(() => {
  xj.pageInit({
    key: 'XJ_PAGE_INIT',
    onLoad: () => { xj.device.get?.([]); },
    onDeviceDataChange: (update: Record<string, unknown>) => { updateFromDevice(update); }
  });
  interval = setInterval(() => { clock.value = Date.now(); }, 1000);
  document.title = title.value;
});
onUnmounted(() => { if (interval) clearInterval(interval); });
</script>

<template>
  <main class="yg-xj" :style="{ paddingTop: `${barHeight}px` }">
    <header class="yg-head">
      <div class="yg-overline">A LITTLE LIGHT, A LITTLE CLOSER</div>
      <h1>{{ title }}</h1>
      <p>让关心亮得刚刚好，也把专注还给自己。</p>
    </header>

    <section class="yg-hero">
      <div class="yg-hero-top"><div><span class="yg-overline">你的光，慢慢亮</span><h2>此刻的余光</h2></div>
        <span class="yg-status" :class="{ good: connected === true }"><i></i>{{ connected === true ? '设备在线' : connected === false ? '设备离线' : '等待设备状态' }}</span>
      </div>
      <div class="yg-stage">
        <div class="yg-orbit"></div>
        <svg class="yg-lamp" viewBox="0 0 280 240" role="img" aria-label="余光桌搭灯语预览">
          <!-- 和余光主站使用相同的玩偶轮廓、底座、脸部细节及暖光材料。 -->
          <defs>
            <radialGradient id="yg-body"><stop stop-color="#fffcf0"/><stop offset=".7" stop-color="#f4e6c8"/><stop offset="1" stop-color="#e6d7b9"/></radialGradient>
            <radialGradient id="yg-light"><stop :stop-color="lampColor" stop-opacity=".9"/><stop offset="1" :stop-color="lampColor" stop-opacity="0"/></radialGradient>
            <linearGradient id="yg-base" x2="0" y2="1"><stop stop-color="#cfb89b"/><stop offset="1" stop-color="#b9a182"/></linearGradient>
            <filter id="yg-blur"><feGaussianBlur stdDeviation="7"/></filter>
          </defs>
          <ellipse cx="140" cy="211" rx="75" ry="10" fill="#9c9d7a" opacity=".13" filter="url(#yg-blur)"/>
          <ellipse cx="140" cy="201" rx="59" ry="10" fill="url(#yg-base)"/>
          <path d="M82 192v9c0 15 116 15 116 0v-9" fill="url(#yg-base)"/>
          <ellipse cx="140" cy="192" rx="58" ry="10" fill="#d9c5a6"/>
          <path d="M84 76C62 30 96 15 117 54Q140 44 163 54C184 15 218 30 196 76Q220 112 214 158C210 206 70 206 66 158Q60 112 84 76Z" fill="url(#yg-body)" stroke="#e7d9bc"/>
          <path d="M84 76C62 30 96 15 117 54Q140 44 163 54C184 15 218 30 196 76Q220 112 214 158C210 206 70 206 66 158Q60 112 84 76Z" fill="url(#yg-light)" :class="['yg-glow',glowClass]" :style="{ filter: `brightness(${previewLevel / 100})` }"/>
          <ellipse cx="114" cy="126" rx="2.2" ry="3.1" fill="#a08d72"/><ellipse cx="166" cy="126" rx="2.2" ry="3.1" fill="#a08d72"/>
          <path d="M134 138q6 5 12 0" fill="none" stroke="#b09b7b" stroke-linecap="round" stroke-width="1.7"/>
          <ellipse cx="99" cy="137" rx="7" ry="3" fill="#e5b9a0" opacity=".35"/><ellipse cx="181" cy="137" rx="7" ry="3" fill="#e5b9a0" opacity=".35"/>
        </svg>
        <strong>{{ currentPreview ? `${currentPreview.label} · ${currentPreview.color}` : '此刻安静陪着你' }}</strong>
        <small>灯效仅在本页预览，控制信号不会下发到真机。</small>
      </div>
    </section>

    <section class="yg-card">
      <div class="yg-section-head"><h2>日常模式</h2><span>设备属性</span></div>
      <div class="yg-row"><div class="yg-row-symbol">☼</div><div class="yg-row-copy"><b>允许情感光</b><small>{{ power === null ? '等待真实物模型数据' : '关闭后灯语保留，等待再次允许点亮' }}</small></div><button type="button" class="yg-switch" role="switch" aria-label="允许情感光" :aria-checked="power === true" :class="{ on: power === true }" :disabled="!canWrite('power')" @click="changeMode('power')"><i></i></button></div>
      <div class="yg-row"><div class="yg-row-symbol">☾</div><div class="yg-row-copy"><b>深度专注</b><small>{{ focus === null ? '等待真实物模型数据' : '新的心意安静排队，不催促回应' }}</small></div><button type="button" class="yg-switch" role="switch" aria-label="深度专注" :aria-checked="focus === true" :class="{ on: focus === true }" :disabled="!canWrite('focus')" @click="changeMode('focus')"><i></i></button></div>
      <p class="yg-annotation" role="status">{{ unmapped ? '请先在 yuguang-field-map.ts 中填写真实物模型字段，控件在映射前保持锁定。' : connected !== true ? '等待已验证的设备在线状态，暂不发送控制指令。' : message || '设备回报状态会自动更新；请先用平台控制链路联调。' }}</p>
    </section>

    <section class="yg-card"><div class="yg-section-head"><h2>灯语试播</h2><span>仅屏幕预览</span></div>
      <div class="yg-presets"><button v-for="item in presets" :key="item.id" type="button" :aria-pressed="activePreset === item.id" :class="{ chosen: activePreset === item.id }" @click="activePreset = item.id"><svg class="yg-preset-icon" viewBox="0 0 24 24" aria-hidden="true"><path :d="previewIcons[item.id]" /></svg><span><b>{{ item.label }}</b><small>{{ item.color }} · {{ item.rhythm }}</small></span></button></div>
      <div class="yg-tools"><button type="button" class="yg-text-button" :disabled="activePreset === 'quiet'" @click="activePreset = 'quiet'">退出预览</button><label for="yg-preview-level">屏幕光感 {{ previewLevel }}%</label><input id="yg-preview-level" v-model.number="previewLevel" type="range" min="20" max="100" step="5" aria-label="屏幕预览光感" /></div>
      <p class="yg-annotation">真实设备亮度、灯语下发和执行回执须以最终物模型、固件与平台服务为准。</p>
    </section>

    <section class="yg-card yg-breath"><div class="yg-section-head"><h2>此刻的呼吸</h2><span>本人采样</span></div><div class="yg-rpm"><strong>{{ realRpm ?? '—' }}</strong><span>次 / 分</span></div><p>{{ sensorMessage }}</p><p class="yg-annotation">桌搭开机持续采集由固件负责。本页仅展示实际收到且未过期的设备数据，不能用灯效推断呼吸。</p></section>
    <p class="yg-foot">余光 · 不打断，也不缺席</p>
  </main>
</template>

<style scoped>
/* 与余光 Web App 共用一套暖白、鼠尾草绿、纸卡和圆角规范。 */
.yg-xj {
  --yg-ink: #34483e;
  --yg-muted: #7b8178;
  --yg-paper: #fffefa;
  --yg-accent: #486351;
  min-height: 100vh;
  box-sizing: border-box;
  padding: 20px 16px 60px;
  background: #f5f3ed;
  color: var(--yg-ink);
  font: 14px/1.65 -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
}
.yg-head, .yg-hero, .yg-card, .yg-foot { max-width: 650px; margin-left: auto; margin-right: auto; }
.yg-head { padding: 0 1px 19px; }
.yg-overline { color: #9b9e8d; font-size: 10px; font-weight: 550; letter-spacing: 1.8px; }
.yg-head h1 { font-size: 26px; font-weight: 500; letter-spacing: 1.5px; margin: 8px 0 4px; }
.yg-head p { color: var(--yg-muted); font-size: 12px; margin: 0; }
.yg-hero, .yg-card { border: 1px solid #e6e7df; border-radius: 17px; padding: 23px; margin-bottom: 15px; box-sizing: border-box; }
.yg-hero { background: #edeee5; border-color: #e2e6d9; overflow: hidden; }
.yg-card { background: var(--yg-paper); }
.yg-hero-top, .yg-section-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.yg-hero-top h2 { font-size: 17px; font-weight: 550; letter-spacing: 1px; margin: 4px 0; }
.yg-status { display: inline-flex; align-items: center; gap: 6px; color: #829076; background: #e7ecdf; padding: 5px 10px; font-size: 10px; border-radius: 18px; white-space: nowrap; }
.yg-status i { height: 7px; width: 7px; background: #aeb5a2; border-radius: 50%; }
.yg-status.good i { background: #819b75; }
.yg-stage { position: relative; isolation: isolate; display: flex; flex-direction: column; align-items: center; padding: 9px 0 7px; }
.yg-orbit { position: absolute; top: 8px; height: 238px; width: 238px; border-radius: 50%; border: 1px solid #dce1d2; z-index: -1; pointer-events: none; }
.yg-orbit::after { content: ''; position: absolute; inset: -23px; border: 1px solid #e2e6db; border-radius: 50%; }
.yg-lamp { width: 253px; height: 221px; overflow: visible; filter: drop-shadow(0 13px 12px #a6a99322); }
.yg-stage strong { color: #78886f; font-size: 12px; font-weight: 500; margin: 5px 0; }
.yg-stage small { color: #959d8e; font-size: 10px; text-align: center; }
.yg-glow { transform-origin: center; }
.yg-glow.quiet { opacity: 0; }
.yg-glow.one { animation: yg-breathe 6s ease-in-out 1 both; }
.yg-glow.three { animation: yg-breathe 1.8s ease-in-out 3 both; }
@keyframes yg-breathe { 0%, 100% { opacity: 0; } 50% { opacity: .75; } }
.yg-section-head { margin-bottom: 13px; }
.yg-section-head h2 { margin: 0; font-size: 17px; font-weight: 550; letter-spacing: 1px; }
.yg-section-head span { color: #959d8e; font-size: 10px; }
.yg-row { display: flex; align-items: center; gap: 12px; border-top: 1px solid #eeeee5; padding: 18px 0; }
.yg-row-symbol { flex: 0 0 35px; height: 35px; display: grid; place-items: center; border-radius: 10px; background: #f1f3ea; color: #8d9c81; font-size: 21px; }
.yg-row-copy { flex: 1; min-width: 0; }
.yg-row-copy b { font-size: 13px; font-weight: 500; }
.yg-row-copy small { display: block; color: #9ba090; font-size: 11px; line-height: 1.7; margin-top: 3px; }
.yg-switch { width: 42px; height: 25px; border: 0; background: #dadfd0; border-radius: 15px; padding: 0; position: relative; flex: 0 0 42px; }
.yg-switch i { position: absolute; top: 3px; left: 3px; height: 19px; width: 19px; background: #fffefa; border-radius: 50%; transition: transform .18s; }
.yg-switch.on { background: #809575; }
.yg-switch.on i { transform: translateX(17px); }
.yg-switch:disabled { opacity: .48; }
.yg-xj button { font: inherit; cursor: pointer; }
.yg-xj button:disabled { cursor: not-allowed; }
.yg-xj :is(button, input):focus-visible { outline: 2px solid #b4a178; outline-offset: 3px; }
.yg-annotation { font-size: 11px; color: #949d8c; line-height: 1.8; padding: 11px 0 0; border-top: 1px solid #eeeee5; margin: 12px 0 0; }
.yg-presets { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.yg-presets button { display: flex; flex-direction: column; justify-content: center; align-items: flex-start; gap: 9px; position: relative; text-align: left; min-height: 109px; min-width: 0; border: 1px solid #e8e9e1; background: var(--yg-paper); padding: 13px 15px; border-radius: 12px; color: var(--yg-ink); }
.yg-presets button.chosen { border-color: #96a68e; background: #f1f3ec; box-shadow: inset 0 0 0 1px #becbb5; }
.yg-presets button.chosen::after { content: '✓'; position: absolute; top: 10px; right: 13px; color: #81926f; font-size: 11px; }
.yg-presets button:hover:not(:disabled) { background: #f6f7f1; border-color: #c5d0bc; }
.yg-preset-icon { width: 23px; height: 23px; stroke: #a5aa93; fill: none; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.yg-presets button.chosen .yg-preset-icon { stroke: #698064; }
.yg-presets b { font-size: 12px; font-weight: 500; display: block; }
.yg-presets small { display: block; color: #9fa595; font-size: 10px; line-height: 1.65; margin-top: 4px; }
.yg-presets button:last-child { grid-column: 1 / -1; min-height: 72px; flex-direction: row; align-items: center; justify-content: start; }
.yg-tools { display: flex; align-items: center; flex-wrap: wrap; gap: 11px 16px; margin-top: 18px; }
.yg-text-button { background: none; border: 0; color: #657e61; font-size: 11px !important; margin-right: auto; padding: 6px 0; }
.yg-tools label { color: #889780; font-size: 10px; }
.yg-tools input[type=range] { width: 110px; accent-color: #829878; }
.yg-rpm { display: flex; align-items: baseline; gap: 9px; }
.yg-rpm strong { font-size: 37px; font-weight: 500; line-height: 1.35; }
.yg-rpm span, .yg-breath > p { color: var(--yg-muted); font-size: 12px; }
.yg-breath > p { margin: 7px 0; }
.yg-foot { color: #a1a697; font-size: 11px; text-align: center; padding-top: 15px; }
@media (max-width: 400px) {
  .yg-hero, .yg-card { padding: 19px; }
  .yg-head h1 { font-size: 23px; }
  .yg-presets { gap: 8px; }
  .yg-presets button { padding: 12px; }
  .yg-presets small { font-size: 9px; }
  .yg-tools input[type=range] { flex: 1; min-width: 100px; }
}
@media (prefers-reduced-motion: reduce) { .yg-glow { animation: none !important; opacity: .35 !important; } .yg-switch i { transition: none; } }
</style>
