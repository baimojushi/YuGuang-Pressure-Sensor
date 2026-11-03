<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { xj, data, info, initData, status } from '@/stores';
import { yuguangFields, enabledSuixiField, siid19Registered, lightPreviewRegistered, lightPreviewField } from '@/config/yuguang-field-map';
import {
  INTENT_LABELS,
  INTENT_OPTIONS,
  isReadAloudIntent,
  mapTextToLight,
  type LightIntent,
  type LightPreviewResult,
  type ReplyPreference
} from '@/utils/yuguangTextLight';

/** 适配参考项目的 XJ SDK，属性键须以真实产品物模型为准。 */
type Mode = 'power' | 'focus';
type SuixiSwitch = 'companionEnabled' | 'demoCloudDesired';
// 图标取自余光原有 visuals.js 的线条符号，视觉上与 Web App 保持一致。
const previewIcons = {
  miss: 'M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 00-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 000-7.8z',
  meal: 'M4 13h16M3 13a9 9 0 0018 0M8 3v4M12 2v5M16 3v4M5 22h14',
  rest: 'M21 13A9 9 0 0111 3a9 9 0 1010 10z',
  cheer: 'M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3zM21 2v4M19 4h4',
  request: 'M3 17a9 9 0 0118 0M2 21h20M12 2v3M4 5l2 2M20 5l-2 2'
} as const;
type PresetIcon = keyof typeof previewIcons;
const presets: { id: string; label: string; intent: LightIntent; replyPreference: ReplyPreference; sample: string; icon: PresetIcon }[] = [
  { id: 'miss', label: INTENT_LABELS.miss, intent: 'miss', replyPreference: 'none', sample: '我想你了', icon: 'miss' },
  { id: 'meal', label: INTENT_LABELS.meal, intent: 'meal', replyPreference: 'none', sample: '记得按时吃饭', icon: 'meal' },
  { id: 'rest', label: INTENT_LABELS.rest, intent: 'rest', replyPreference: 'none', sample: '别熬太晚，早点休息', icon: 'rest' },
  { id: 'cheer', label: INTENT_LABELS.cheer, intent: 'cheer', replyPreference: 'none', sample: '加油，你可以的', icon: 'cheer' },
  { id: 'request', label: '方便时回复', intent: 'miss', replyPreference: 'when_free', sample: '方便的时候回我', icon: 'request' }
];
const noteText = ref('');
const selectedIntent = ref<LightIntent>('miss');
const replyPreference = ref<ReplyPreference>('none');
const lightPreview = ref<LightPreviewResult | null>(null);
const lightNote = ref('');
const previewKey = ref(0);
const speaking = ref(false);
const listening = ref(false);
const previewLevel = ref(70);
const saving = ref<Mode | SuixiSwitch | 'relaxRequest' | 'lightPreview' | null>(null);
const message = ref('');
const clock = ref(Date.now());
const lastRealSampleAt = ref<number | null>(null);
let interval: ReturnType<typeof setInterval> | null = null;

const title = computed(() => info?.deviceName || '我的余光');
// 设备在线状态：优先采信宿主明确下发的布尔标志（onDeviceOnline → onPageInit →
// initData.isOnline，官方例程同一取法）。若宿主未上报该字段，则退化为"页面通道已连通
// 且已知设备"——此时允许下发并展示回执，避免控件永久锁死。
const onlineFlag = computed<boolean | null>(() => {
  for (const value of [initData?.isOnline, info?.isOnline, info?.online, info?.onlineStatus, info?.onlionStatus]) {
    if (typeof value === 'boolean') return value;
  }
  return null;
});
const hasDevice = computed(() => Boolean(
  info?.did || info?.deviceId || initData?.device?.did || initData?.did || initData?.deviceId
));
const channelReady = computed(() => status?.pageConnectState === true);
const connected = computed<boolean | null>(() => {
  if (onlineFlag.value !== null) return onlineFlag.value;
  if (hasDevice.value && channelReady.value) return true;
  return null;
});
// 供界面说明当前在线判定的来源，便于现场排查宿主是否上报。
const connectedSource = computed<'device' | 'inferred' | 'unknown'>(() => {
  if (onlineFlag.value !== null) return 'device';
  return connected.value === true ? 'inferred' : 'unknown';
});
const barHeight = computed(() => (initData?.statusBarHeight || 24) + 56);
const modeValue = (key: Mode): boolean | null => {
  const field = yuguangFields[key];
  return field && typeof data?.[field] === 'boolean' ? Boolean(data[field]) : null;
};
const power = computed(() => modeValue('power'));
const focus = computed(() => modeValue('focus'));
// 属性未上报时不再锁死控件：未知按"关闭"处理，点击即下发开启，回执再校正界面。
const canWrite = (key: Mode) => Boolean(hasDevice.value && connected.value === true && saving.value !== key);
const unmapped = computed(() => !yuguangFields.power || !yuguangFields.focus);
const realRpm = computed(() => {
  const key = yuguangFields.rpm;
  if (!key || connected.value !== true || data?.[yuguangFields.sensorState ?? ''] !== 'ok' || !lastRealSampleAt.value || clock.value - lastRealSampleAt.value > 15000) return null;
  const value = data?.[key];
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 120 ? value : null;
});
const sensorMessage = computed(() => {
  if (!yuguangFields.rpm) return '呼吸属性尚未映射';
  if (connected.value !== true) return '设备未确认在线，等待上报';
  if (yuguangFields.sensorState && data?.[yuguangFields.sensorState] !== 'ok') return '暂无可信呼吸信号';
  return realRpm.value === null ? '等待最新真实采样' : '来自设备最近上报的频率';
});

const suixiBoolean = (key: SuixiSwitch): boolean | null => {
  const field = enabledSuixiField(key);
  return field && typeof data?.[field] === 'boolean' ? data[field] : null;
};
const suixiEnabled = computed(() => suixiBoolean('companionEnabled'));
const demoCloudDesired = computed(() => suixiBoolean('demoCloudDesired'));
const guideState = computed<'idle'|'syncing'|'guiding'|'cooldown'|null>(() => {
  const field = enabledSuixiField('guideState');
  const value = field ? data?.[field] : null;
  return typeof value === 'string' && ['idle','syncing','guiding','cooldown'].includes(value)
    ? value as 'idle'|'syncing'|'guiding'|'cooldown' : null;
});
const guideLabel = computed(() => ({idle:'安静陪伴',syncing:'同步呼吸',guiding:'温和引导',cooldown:'休息中'}[guideState.value ?? 'idle']));
const guidePeriodSec = computed<number | null>(() => {
  const field = enabledSuixiField('guidePeriod');
  const value = field ? data?.[field] : null;
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 600 ? value / 10 : null;
});
const sensorLink = computed<'connected'|'lost'|'negotiating'|null>(() => {
  const field = enabledSuixiField('sensorLink');
  const value = field ? data?.[field] : null;
  return typeof value === 'string' && ['connected','lost','negotiating'].includes(value)
    ? value as 'connected'|'lost'|'negotiating' : null;
});
const sensorLinkLabel = computed(() => ({connected:'感知板已连接',lost:'感知板已断开',negotiating:'感知板连接中'}[sensorLink.value ?? 'lost']));
const canWriteSuixi = (key: SuixiSwitch) =>
  Boolean(hasDevice.value && connected.value === true && saving.value !== key && typeof xj.device.set === 'function');
const canRequestRelax = computed(() => {
  const field = enabledSuixiField('relaxRequest');
  return Boolean(hasDevice.value && connected.value === true &&
    !['syncing','guiding'].includes(guideState.value ?? '') && field && data?.[field] !== true &&
    !saving.value && typeof xj.device.set === 'function');
});
async function changeSuixi(key: SuixiSwitch) {
  const field = enabledSuixiField(key);
  if (!field || !canWriteSuixi(key)) return;
  saving.value = key;
  message.value = '';
  try {
    await commitSet({[field]: suixiBoolean(key) !== true});
    message.value = '设置已提交，请以设备回报状态为准';
    xj.device.get?.([]);
  } catch {
    message.value = '设备未确认设置，请检查平台与连接';
  } finally { saving.value = null; }
}
async function requestRelax() {
  const field = enabledSuixiField('relaxRequest');
  if (!field || !canRequestRelax.value) return;
  saving.value = 'relaxRequest';
  message.value = '';
  try {
    await commitSet({[field]: true});
    message.value = '已发送放松请求，等待设备进入同步状态并将请求自清';
    xj.device.get?.([]);
  } catch {
    message.value = '放松请求发送失败，请稍后重试';
  } finally { saving.value = null; }
}

// 屏幕节奏是设备遥测的近似：引导时取 19.3 目标周期，同步时取实时呼吸换算。
const breathPreviewPeriodSec = computed<number | null>(() => {
  if (guideState.value === 'guiding' && guidePeriodSec.value !== null && realRpm.value !== null)
    return guidePeriodSec.value;
  if (guideState.value === 'syncing' && realRpm.value !== null)
    return 60 / realRpm.value;
  return null;
});
// 优先由文字灯语映射引擎输出的受控灯语 JSON 驱动；无文字预览时回退呼吸节律示意。
const lampColors = computed(() => lightPreview.value?.light.colors ?? ['#E6B4B7']);
const lampPattern = computed(() => {
  if (lightPreview.value) return `p-${lightPreview.value.light.pattern}`;
  return breathPreviewPeriodSec.value !== null ? 'breath-live' : 'quiet';
});
const lampGlowStyle = computed(() => {
  const light = lightPreview.value?.light;
  const filter = `brightness(${previewLevel.value / 100})`;
  if (light) {
    return {
      filter,
      animationDuration: `${light.periodMs}ms`,
      animationIterationCount: String(light.cycles),
      '--yg-peak': String(light.maxBrightness)
    };
  }
  if (breathPreviewPeriodSec.value !== null) {
    return { filter, '--yg-breath-period': `${breathPreviewPeriodSec.value.toFixed(2)}s` };
  }
  return { opacity: '0' };
});
const lightSummary = computed(() => {
  const result = lightPreview.value;
  if (!result) return null;
  const { light, mapping } = result;
  return {
    description: light.description,
    pattern: light.pattern,
    periodSec: (light.periodMs / 1000).toFixed(1),
    cycles: light.cycles,
    brightness: Math.round(light.maxBrightness * 100),
    engine: mapping.engine === 'text_rules' ? '文字规则命中' : '沿用所选意图',
    matched: mapping.matchedCount,
    version: mapping.version
  };
});
const presetActive = (item: (typeof presets)[number]) =>
  lightPreview.value?.intent === item.intent && replyPreference.value === item.replyPreference;
// 19.7 真机试播：与 19.1–19.6 门禁分离，仅前四种预设、非“方便时回复”、非同步/引导中可发。
const canSendLightPreview = computed(() => Boolean(
  lightPreviewRegistered && lightPreviewField &&
  hasDevice.value && connected.value === true && power.value !== false && focus.value !== true &&
  guideState.value !== 'syncing' && guideState.value !== 'guiding' &&
  lightPreview.value && ['miss','meal','rest','cheer'].includes(lightPreview.value.intent) &&
  replyPreference.value === 'none' &&
  !saving.value && typeof xj.device.set === 'function'));

async function sendLightPreview() {
  if (!canSendLightPreview.value || !lightPreviewField || !lightPreview.value) return;
  saving.value = 'lightPreview';
  message.value = '';
  const command = JSON.stringify({v:1,preset:lightPreview.value.intent,
    nonce:`${Date.now().toString(36)}${Math.random().toString(36).slice(2,12)}`});
  try {
    await commitSet({[lightPreviewField]: command});
    message.value = '灯语试播命令已提交；实际显示仍以设备侧回执和实机观察为准';
  } catch {
    message.value = '灯语试播命令发送失败，请检查服务 19.7 和连接状态';
  } finally { saving.value = null; }
}

function previewLight() {
  lightNote.value = '';
  try {
    const result = mapTextToLight(noteText.value.trim(), selectedIntent.value, replyPreference.value);
    lightPreview.value = result;
    previewKey.value += 1;
    message.value = `灯语已生成：${result.light.description}`;
  } catch (error) {
    lightPreview.value = null;
    lightNote.value = error instanceof Error ? error.message : '灯语生成失败，请重试';
  }
}
function choosePreset(item: (typeof presets)[number]) {
  selectedIntent.value = item.intent;
  replyPreference.value = item.replyPreference;
  noteText.value = item.sample;
  previewLight();
}
function clearPreview() {
  lightPreview.value = null;
  previewKey.value += 1;
  lightNote.value = '';
}
function speakCurrentNote() {
  const text = noteText.value.trim();
  if (!text) {
    lightNote.value = '没有可朗读的文字';
    return;
  }
  if (!('speechSynthesis' in window)) {
    lightNote.value = '此浏览器不支持语音朗读';
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-CN';
  utterance.rate = 0.92;
  utterance.volume = 0.7;
  speaking.value = true;
  utterance.onend = () => { speaking.value = false; };
  utterance.onerror = () => {
    speaking.value = false;
    lightNote.value = '朗读失败，请重试';
  };
  window.speechSynthesis.speak(utterance);
}
interface AsrResultLike { isFinal: boolean; 0: { transcript?: string } }
interface AsrEventLike { results: ArrayLike<AsrResultLike> }
interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: AsrEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onnomatch: (() => void) | null;
  start(): void;
}
function listenForRead() {
  if (listening.value) return;
  const scope = window as unknown as {
    SpeechRecognition?: new () => RecognitionLike;
    webkitSpeechRecognition?: new () => RecognitionLike;
  };
  const Recognition = scope.SpeechRecognition || scope.webkitSpeechRecognition;
  if (!Recognition) {
    lightNote.value = '此浏览器不支持语音识别';
    return;
  }
  if (!window.isSecureContext) {
    lightNote.value = '请通过 HTTPS 使用麦克风';
    return;
  }
  const recognition = new Recognition();
  recognition.lang = 'zh-CN';
  recognition.interimResults = false;
  recognition.continuous = false;
  listening.value = true;
  lightNote.value = '请说：朗读这段文字';
  recognition.onresult = event => {
    listening.value = false;
    const transcript = Array.from(event.results)
      .filter(result => result.isFinal)
      .map(result => result[0]?.transcript || '')
      .join(' ')
      .trim();
    if (!isReadAloudIntent(transcript)) {
      lightNote.value = '没有听清朗读指令';
      return;
    }
    speakCurrentNote();
  };
  recognition.onerror = event => {
    listening.value = false;
    lightNote.value = `语音识别失败：${event.error}`;
  };
  recognition.onnomatch = () => {
    listening.value = false;
    lightNote.value = '没有听清朗读指令';
  };
  recognition.start();
}

const updateFromDevice = (updated: Record<string, unknown> | null | undefined) => {
  const rpmKey = yuguangFields.rpm;
  if (!rpmKey || !updated || !Object.prototype.hasOwnProperty.call(updated, rpmKey)) return;
  const value = updated[rpmKey];
  // 仅设备实际推送的新数值可标记为实时；初始化快照不冒充最新采样。
  if (typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 120) lastRealSampleAt.value = Date.now();
  else lastRealSampleAt.value = null;
};
// xj.device.set 在无宿主/回调丢失时会一直 pending，导致 saving 永久占用、按钮全灰。
// 统一加超时，保证交互不会卡死。
async function commitSet(payload: Record<string, unknown>) {
  await Promise.race([
    Promise.resolve(xj.device.set?.(payload)),
    new Promise(resolve => { setTimeout(resolve, 4000); })
  ]);
}
async function changeMode(key: Mode) {
  const field = yuguangFields[key];
  if (!field || !canWrite(key)) return;
  saving.value = key;
  message.value = '';
  try {
    await commitSet({ [field]: modeValue(key) !== true });
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
onUnmounted(() => {
  if (interval) clearInterval(interval);
  try { window.speechSynthesis?.cancel(); } catch { /* 部分环境没有语音合成，忽略 */ }
});
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
        <span class="yg-status" :class="{ good: connected === true }"><i></i>{{ connected === true ? (connectedSource === 'inferred' ? '设备在线（推断）' : '设备在线') : connected === false ? '设备离线' : '等待设备状态' }}</span>
      </div>
      <div class="yg-stage">
        <div class="yg-orbit"></div>
        <svg class="yg-lamp" viewBox="0 0 280 240" role="img" aria-label="余光桌搭灯语预览">
          <!-- 和余光主站使用相同的玩偶轮廓、底座、脸部细节及暖光材料。 -->
          <defs>
            <radialGradient id="yg-body"><stop stop-color="#fffcf0"/><stop offset=".7" stop-color="#f4e6c8"/><stop offset="1" stop-color="#e6d7b9"/></radialGradient>
            <radialGradient id="yg-light">
              <stop :stop-color="lampColors[0]" stop-opacity=".9"/>
              <stop v-if="lampColors[1]" offset=".55" :stop-color="lampColors[1]" stop-opacity=".9"/>
              <stop offset="1" :stop-color="lampColors[0]" stop-opacity="0"/>
            </radialGradient>
            <linearGradient id="yg-base" x2="0" y2="1"><stop stop-color="#cfb89b"/><stop offset="1" stop-color="#b9a182"/></linearGradient>
            <filter id="yg-blur"><feGaussianBlur stdDeviation="7"/></filter>
          </defs>
          <ellipse cx="140" cy="211" rx="75" ry="10" fill="#9c9d7a" opacity=".13" filter="url(#yg-blur)"/>
          <ellipse cx="140" cy="201" rx="59" ry="10" fill="url(#yg-base)"/>
          <path d="M82 192v9c0 15 116 15 116 0v-9" fill="url(#yg-base)"/>
          <ellipse cx="140" cy="192" rx="58" ry="10" fill="#d9c5a6"/>
          <path d="M84 76C62 30 96 15 117 54Q140 44 163 54C184 15 218 30 196 76Q220 112 214 158C210 206 70 206 66 158Q60 112 84 76Z" fill="url(#yg-body)" stroke="#e7d9bc"/>
          <path :key="previewKey" d="M84 76C62 30 96 15 117 54Q140 44 163 54C184 15 218 30 196 76Q220 112 214 158C210 206 70 206 66 158Q60 112 84 76Z" fill="url(#yg-light)" :class="['yg-glow', lampPattern || 'quiet']" :style="lampGlowStyle"/>
          <ellipse cx="114" cy="126" rx="2.2" ry="3.1" fill="#a08d72"/><ellipse cx="166" cy="126" rx="2.2" ry="3.1" fill="#a08d72"/>
          <path d="M134 138q6 5 12 0" fill="none" stroke="#b09b7b" stroke-linecap="round" stroke-width="1.7"/>
          <ellipse cx="99" cy="137" rx="7" ry="3" fill="#e5b9a0" opacity=".35"/><ellipse cx="181" cy="137" rx="7" ry="3" fill="#e5b9a0" opacity=".35"/>
        </svg>
        <strong>{{ lightSummary ? lightSummary.description : (breathPreviewPeriodSec !== null ? `呼吸节律示意 · ${breathPreviewPeriodSec.toFixed(1)}秒/周期` : '此刻安静陪着你') }}</strong>
        <small>画面只近似显示周期；真实呼吸相位、光照幅度由设备端决定。</small>
      </div>
    </section>

    <section class="yg-card">
      <div class="yg-section-head"><h2>日常模式</h2><span>设备属性</span></div>
      <div class="yg-row"><div class="yg-row-symbol">☼</div><div class="yg-row-copy"><b>允许情感光</b><small>{{ power === null ? '等待真实物模型数据' : '关闭后灯语保留，等待再次允许点亮' }}</small></div><button type="button" class="yg-switch" role="switch" aria-label="允许情感光" :aria-checked="power === true" :class="{ on: power === true }" :disabled="!canWrite('power')" @click="changeMode('power')"><i></i></button></div>
      <div class="yg-row"><div class="yg-row-symbol">☾</div><div class="yg-row-copy"><b>深度专注</b><small>{{ focus === null ? '等待真实物模型数据' : '新的心意安静排队，不催促回应' }}</small></div><button type="button" class="yg-switch" role="switch" aria-label="深度专注" :aria-checked="focus === true" :class="{ on: focus === true }" :disabled="!canWrite('focus')" @click="changeMode('focus')"><i></i></button></div>
      <p class="yg-annotation" role="status">{{ unmapped ? '请先在 yuguang-field-map.ts 中填写真实物模型字段，控件在映射前保持锁定。' : connected !== true ? '等待设备通道就绪，暂不发送控制指令。' : connectedSource === 'inferred' ? (message || '宿主未上报设备在线标志，已按通道连通状态允许操作；结果以设备回报为准。') : (message || '设备回报状态会自动更新；请先用平台控制链路联调。') }}</p>
    </section>

    <section class="yg-card yg-light"><div class="yg-section-head"><h2>文字灯语</h2><span>仅屏幕预览</span></div>
      <div class="yg-presets"><button v-for="item in presets" :key="item.id" type="button" :aria-pressed="presetActive(item)" :class="{ chosen: presetActive(item) }" @click="choosePreset(item)"><svg class="yg-preset-icon" viewBox="0 0 24 24" aria-hidden="true"><path :d="previewIcons[item.icon]" /></svg><span><b>{{ item.label }}</b><small>{{ item.sample }}</small></span></button></div>
      <label class="yg-note-label" for="yg-note">捎上一句话 <small>可选 · 最多 140 字</small></label>
      <textarea id="yg-note" v-model="noteText" maxlength="140" rows="3" placeholder="例如：忙完再听就好。"></textarea>
      <div class="yg-intent-row"><button v-for="intent in INTENT_OPTIONS" :key="intent" type="button" class="yg-intent-chip" :class="{ on: selectedIntent === intent }" :aria-pressed="selectedIntent === intent" @click="selectedIntent = intent">{{ INTENT_LABELS[intent] }}</button></div>
      <fieldset class="yg-preference"><legend>想怎样回应？</legend><label><input v-model="replyPreference" type="radio" value="none" />不用回复</label><label><input v-model="replyPreference" type="radio" value="when_free" />方便时回复</label></fieldset>
      <div class="yg-tools">
        <button type="button" class="yg-primary" @click="previewLight">按文字预览灯语</button>
        <button type="button" class="yg-text-button" :disabled="speaking" @click="speakCurrentNote">{{ speaking ? '朗读中…' : '朗读这段文字' }}</button>
        <button type="button" class="yg-text-button" :disabled="listening" @click="listenForRead">{{ listening ? '请说话…' : '说「朗读」' }}</button>
        <button type="button" class="yg-text-button" :disabled="!lightPreview" @click="clearPreview">退出预览</button>
      </div>
      <div class="yg-tools"><label for="yg-preview-level">屏幕光感 {{ previewLevel }}%</label><input id="yg-preview-level" v-model.number="previewLevel" type="range" min="20" max="100" step="5" aria-label="屏幕预览光感" /></div>
      <button type="button" class="yg-relax" :disabled="!canSendLightPreview" @click="sendLightPreview">发送当前灯语到设备（试播）</button>
      <div v-if="lightSummary" class="yg-light-summary">
        <strong>{{ lightSummary.description }}</strong>
        <small>{{ lightSummary.pattern }} · 周期 {{ lightSummary.periodSec }} 秒 · {{ lightSummary.cycles }} 次 · 最高亮度 {{ lightSummary.brightness }}%</small>
        <small>映射依据：{{ lightSummary.engine }}（命中 {{ lightSummary.matched }} 项）· {{ lightSummary.version }}</small>
      </div>
      <p class="yg-annotation">设备试播需在灵机云先登记 19.7 LightPreviewCommand（字符串、读写、最大 128 字符），再启用独立门禁 VITE_YG_ENABLE_SIID19_LIGHT_PREVIEW。仅支持前四种灯语。发送成功不代表设备已显示，也不会确认亲友消息。</p>
      <p class="yg-annotation" role="status">{{ lightNote || '本页灯效为屏幕预览；朗读使用浏览器语音，不经过设备扬声器。' }}</p>
    </section>


    <section class="yg-card yg-suixi" aria-label="随息陪伴">
      <div class="yg-section-head"><h2>随息陪伴</h2><span>双板协同 · V2.1</span></div>
      <p v-if="!siid19Registered" class="yg-annotation yg-gate">新物模型仍待平台录入与核验，新增控件已锁定；原有情感光与专注功能正常保留。</p>
      <div class="yg-row"><div class="yg-row-symbol">✧</div><div class="yg-row-copy"><b>允许随息陪伴</b><small>{{ suixiEnabled === null ? '等待 19.1 的真实设备状态' : '先同步真实呼吸，再温和减慢引导节律' }}</small></div><button type="button" class="yg-switch" role="switch" aria-label="允许随息陪伴" :aria-checked="suixiEnabled === true" :class="{ on: suixiEnabled === true }" :disabled="!canWriteSuixi('companionEnabled')" @click="changeSuixi('companionEnabled')"><i></i></button></div>
      <div class="yg-suixi-state"><span>引导状态</span><strong>{{ guideState === null ? '等待状态' : guideLabel }}</strong><small>{{ guidePeriodSec === null ? '暂无有效目标周期' : `引导目标 ${guidePeriodSec.toFixed(1)} 秒 / 周期` }}</small></div>
      <button type="button" class="yg-relax" :disabled="!canRequestRelax" @click="requestRelax">我需要放松一下</button>
      <p class="yg-annotation">仅在当前未进入同步或引导时可发起。设备执行后将 19.6 自清；页面不以请求提交代替执行回报。</p>
    </section>
    <section class="yg-card yg-suixi" aria-label="感知板与隐私设置">
      <div class="yg-section-head"><h2>设备与隐私</h2><span>默认端侧感知</span></div>
      <div class="yg-suixi-state"><span>BLE 感知板</span><strong>{{ sensorLink === null ? '等待状态' : sensorLinkLabel }}</strong><small>连接状态来自业务板 19.5</small></div>
      <div class="yg-row"><div class="yg-row-symbol">◇</div><div class="yg-row-copy"><b>Demo 姿态云推理意向</b><small>仅在 Demo 模式另行取得本地授权并配置合法 API 后才能调用；此开关不会单独触发数据上传。</small></div><button type="button" class="yg-switch" role="switch" aria-label="Demo 姿态云推理意向" :aria-checked="demoCloudDesired === true" :class="{ on: demoCloudDesired === true }" :disabled="!canWriteSuixi('demoCloudDesired')" @click="changeSuixi('demoCloudDesired')"><i></i></button></div>
      <p class="yg-annotation" role="status">{{ message || '原始呼吸流、压力分数与姿态关键点默认仅在端侧保留，不提供给伴侣端。' }}</p>
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
.yg-head, .yg-hero, .yg-card, .yg-suixi-state { display: flex; align-items: baseline; flex-wrap: wrap; gap: 8px; padding: 13px 0; border-top: 1px solid #eeeee5; color: #6d786c; }
.yg-suixi-state > span { font-size: 12px; min-width: 84px; }
.yg-suixi-state strong { font-size: 13px; color: #576b52; font-weight: 600; }
.yg-suixi-state small { width: 100%; font-size: 11px; color: #9ba090; margin-left: 92px; }
.yg-gate { margin-top: 0; color: #946d3f; }
.yg-relax { border: 0; border-radius: 12px; width: 100%; min-height: 44px; padding: 10px 14px; color: #fffefa; background: #81997b; font-size: 13px; font-weight: 600; }
.yg-relax:disabled { opacity: .5; }
.yg-foot { max-width: 650px; margin-left: auto; margin-right: auto; }
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
.yg-glow { transform-origin: center; opacity: 0; }
.yg-glow.breath-live { animation: yg-breathe var(--yg-breath-period, 6s) ease-in-out infinite; }
.yg-glow.p-slow_breathe, .yg-glow.p-soft_pulse, .yg-glow.p-slow_fade { animation-timing-function: ease-in-out; animation-fill-mode: both; }
.yg-glow.p-slow_breathe { animation-name: yg-breathe; }
.yg-glow.p-soft_pulse { animation-name: yg-pulse; }
.yg-glow.p-slow_fade { animation-name: yg-fade; }
@keyframes yg-breathe { 0%, 100% { opacity: 0; } 50% { opacity: var(--yg-peak, .12); } }
@keyframes yg-pulse { 0%, 100% { opacity: 0; } 28%, 62% { opacity: var(--yg-peak, .12); } }
@keyframes yg-fade { 0% { opacity: var(--yg-peak, .1); } 70% { opacity: 0; } 100% { opacity: var(--yg-peak, .1); } }
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
.yg-note-label { display: block; margin: 18px 0 6px; color: #889780; font-size: 11px; }
.yg-note-label small { color: #9ba090; font-size: 10px; }
.yg-light textarea { width: 100%; box-sizing: border-box; border: 1px solid #e8e9e1; border-radius: 12px; background: #fbfaf4; color: var(--yg-ink); font: inherit; padding: 10px 12px; resize: vertical; }
.yg-intent-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.yg-intent-chip { border: 1px solid #e8e9e1; background: var(--yg-paper); color: #6d786c; border-radius: 16px; padding: 7px 14px; font-size: 12px; }
.yg-intent-chip.on { border-color: #96a68e; background: #f1f3ec; color: #576b52; font-weight: 600; }
.yg-preference { border: 0; padding: 12px 0 0; margin: 12px 0 0; display: flex; flex-wrap: wrap; gap: 18px; align-items: center; }
.yg-preference legend { float: left; margin-right: 14px; padding: 0; color: #889780; font-size: 11px; }
.yg-preference label { display: inline-flex; align-items: center; gap: 6px; color: #6d786c; font-size: 12px; }
.yg-primary { border: 0; border-radius: 12px; min-height: 40px; padding: 9px 18px; color: #fffefa; background: #81997b; font-size: 13px; font-weight: 600; }
.yg-primary:disabled { opacity: .5; }
.yg-light-summary { border-top: 1px solid #eeeee5; margin-top: 14px; padding-top: 12px; display: flex; flex-direction: column; gap: 4px; }
.yg-light-summary strong { font-size: 13px; font-weight: 600; color: #576b52; }
.yg-light-summary small { color: #9ba090; font-size: 11px; }
.yg-tools { display: flex; align-items: center; flex-wrap: wrap; gap: 11px 16px; margin-top: 18px; }
.yg-text-button { background: none; border: 0; color: #657e61; font-size: 11px !important; margin-right: auto; padding: 6px 0; }
.yg-tools label { color: #889780; font-size: 10px; }
.yg-tools input[type=range] { width: 110px; accent-color: #829878; }
.yg-rpm { display: flex; align-items: baseline; gap: 9px; }
.yg-rpm strong { font-size: 37px; font-weight: 500; line-height: 1.35; }
.yg-rpm span, .yg-breath > p { color: var(--yg-muted); font-size: 12px; }
.yg-breath > p { margin: 7px 0; }
.yg-suixi-state { display: flex; align-items: baseline; flex-wrap: wrap; gap: 8px; padding: 13px 0; border-top: 1px solid #eeeee5; color: #6d786c; }
.yg-suixi-state > span { font-size: 12px; min-width: 84px; }
.yg-suixi-state strong { font-size: 13px; color: #576b52; font-weight: 600; }
.yg-suixi-state small { width: 100%; font-size: 11px; color: #9ba090; margin-left: 92px; }
.yg-gate { margin-top: 0; color: #946d3f; }
.yg-relax { border: 0; border-radius: 12px; width: 100%; min-height: 44px; padding: 10px 14px; color: #fffefa; background: #81997b; font-size: 13px; font-weight: 600; }
.yg-relax:disabled { opacity: .5; }
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
