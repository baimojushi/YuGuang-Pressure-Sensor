/**
 * 文本 → 受限灯语。规则与平台端 webapp/shared/text-light.mjs 完全一致。
 * 面板只跑本地确定性规则：可选私有模型只能在服务端调用，地址与密钥都不进前端。
 */
export type LightIntent = "miss" | "meal" | "rest" | "cheer";
export type ReplyPreference = "none" | "when_free";
export type LightPattern = "slow_breathe" | "soft_pulse" | "slow_fade";

export interface LightPreset {
  pattern: LightPattern;
  colors: string[];
  periodMs: number;
  cycles: number;
  durationMs: number;
  maxBrightness: number;
  description: string;
}

export interface LightEffect extends LightPreset {
  schema: string;
  sound: boolean;
  vibration: boolean;
  autoFade: boolean;
}

export interface LightMapping {
  version: string;
  engine: "text_rules" | "sender_selection";
  selectedIntent: LightIntent;
  matchedCount: number;
}

export interface LightPreviewResult {
  intent: LightIntent;
  light: LightEffect;
  mapping: LightMapping;
}

export const LIGHT_SCHEMA = "yuguang.light.v1";
export const MAPPER_VERSION = "text-light/1.0";
export const NOTE_MAX_LENGTH = 140;

export const INTENT_LABELS: Record<LightIntent, string> = {
  miss: "我想你了",
  meal: "记得吃饭",
  rest: "别熬太晚",
  cheer: "加油 / 拍拍你"
};

export const INTENT_OPTIONS: LightIntent[] = ["miss", "meal", "rest", "cheer"];

const PRESETS: Record<LightIntent, LightPreset> = {
  miss: {
    pattern: "slow_breathe",
    colors: ["#E6B4B7"],
    periodMs: 6000,
    cycles: 1,
    durationMs: 6000,
    maxBrightness: 0.12,
    description: "柔桃粉，一次轻柔而缓慢的明暗起伏"
  },
  meal: {
    pattern: "soft_pulse",
    colors: ["#E8A568", "#FFF0D5"],
    periodMs: 2800,
    cycles: 2,
    durationMs: 5600,
    maxBrightness: 0.12,
    description: "暖橙与乳白，低亮度交织"
  },
  rest: {
    pattern: "slow_fade",
    colors: ["#E0AB76"],
    periodMs: 6000,
    cycles: 1,
    durationMs: 6000,
    maxBrightness: 0.09,
    description: "柔暖橙，缓慢收暗后恢复"
  },
  cheer: {
    pattern: "soft_pulse",
    colors: ["#E6B4B7"],
    periodMs: 2100,
    cycles: 2,
    durationMs: 4200,
    maxBrightness: 0.16,
    description: "柔桃粉，两次温和的亮度跃动"
  }
};

const REPLY_PRESET: LightPreset = {
  pattern: "slow_fade",
  colors: ["#CA8954"],
  periodMs: 6000,
  cycles: 1,
  durationMs: 6000,
  maxBrightness: 0.1,
  description: "方便时回应：一次六秒的暖橙渐隐"
};

const CUES: Record<LightIntent, RegExp[]> = {
  miss: [/想你/, /思念/, /牵挂/, /好想/, /miss you/i, /抱抱/, /想念/],
  meal: [/吃饭/, /午饭/, /晚饭/, /早餐/, /记得吃/, /好好吃/, /吃点/, /喝点水/, /补充能量/],
  rest: [/休息/, /睡觉/, /别熬/, /早睡/, /熬夜/, /早点睡/, /太累/, /别太累/, /歇一歇/, /放松/],
  cheer: [/加油/, /辛苦/, /棒棒/, /厉害/, /相信你/, /支持你/, /可以的/, /拍拍/, /冲呀/, /你真棒/]
};

const VALID_INTENTS = new Set<string>(Object.keys(PRESETS));

export function isValidIntent(value: unknown): value is LightIntent {
  return typeof value === "string" && VALID_INTENTS.has(value);
}

export function classifyText(
  note = "",
  fallback: LightIntent = "miss"
): { intent: LightIntent; source: "text_rules" | "sender_selection"; matchCount: number } {
  if (!isValidIntent(fallback)) throw new TypeError("unknown light intent");
  if (typeof note !== "string" || note.length > NOTE_MAX_LENGTH) {
    throw new TypeError(`note must be <= ${NOTE_MAX_LENGTH} characters`);
  }
  const text = note.normalize("NFKC").replace(/\s+/g, " ").trim();
  const scores: Record<LightIntent, number> = { miss: 0, meal: 0, rest: 0, cheer: 0 };
  INTENT_OPTIONS.forEach(intent => {
    scores[intent] = CUES[intent].reduce((score, pattern) => score + (pattern.test(text) ? 1 : 0), 0);
  });
  // 明确否定的“我不想你”不能映射成想念；多个类别分数相同时尊重发送者选项。
  if (/不想你|不思念|不想念|别想我/.test(text)) scores.miss = 0;
  const top = Math.max(...Object.values(scores));
  if (!top) return { intent: fallback, source: "sender_selection", matchCount: 0 };
  const tied = INTENT_OPTIONS.filter(intent => scores[intent] === top);
  return { intent: tied.includes(fallback) ? fallback : tied[0], source: "text_rules", matchCount: top };
}

export function validatedLight(intent: LightIntent, replyPreference: ReplyPreference = "none"): LightEffect {
  if (!isValidIntent(intent) || !["none", "when_free"].includes(replyPreference)) {
    throw new TypeError("invalid lamp parameters");
  }
  const base = replyPreference === "when_free" ? REPLY_PRESET : PRESETS[intent];
  return {
    schema: LIGHT_SCHEMA,
    pattern: base.pattern,
    colors: [...base.colors],
    periodMs: base.periodMs,
    cycles: base.cycles,
    durationMs: base.durationMs,
    maxBrightness: base.maxBrightness,
    description: base.description,
    sound: false,
    vibration: false,
    autoFade: true
  };
}

export function mapTextToLight(
  note: string,
  intent: LightIntent,
  replyPreference: ReplyPreference = "none"
): LightPreviewResult {
  const classified = classifyText(note, intent);
  return {
    intent: classified.intent,
    light: validatedLight(classified.intent, replyPreference),
    mapping: {
      version: MAPPER_VERSION,
      engine: classified.source,
      selectedIntent: intent,
      matchedCount: classified.matchCount
    }
  };
}

/**
 * 朗读口令判定。平台端要求动作词与消息对象同时出现（朗读收到的消息）；
 * 控制面板没有消息收件箱，朗读对象是屏幕上这段文字，因此只要求动作词，并保留否定拦截。
 */
export function isReadAloudIntent(text: string): boolean {
  if (typeof text !== "string" || text.length < 2 || text.length > 160) return false;
  const clean = text.normalize("NFKC").trim();
  if (/(不要|别|不用|取消|停止|先别|不需要).{0,10}(读|念|播报|朗读|播放)/.test(clean)) return false;
  return /(读|念|朗读|播报|说给我听|讲给我听)/.test(clean);
}
