import request from "@/utils/request";

// ==================== 统一响应/错误模型（符合后端规范） ====================

/** 统一成功响应壳：code=200 表示成功 */
export interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
  requestId?: string;
}

/** 错误响应模型：code 为业务错误码字符串 */
export interface ApiErrorEnvelope {
  code: string;
  message: string;
  details?: Array<{ field?: string; issue: string }>;
  requestId: string;
}

// ==================== 类型定义 ====================

/** 场景权限配置 */
export interface ScenePermissions {
  cameraMonitorEnabled?: boolean;
  dataUploadEnabled?: boolean;
  deviceReminderEnabled?: boolean;
}

/** 任务今日完成状态（5.2 返回）
 * 后端实际只用两个值：checked=已打卡, unchecked=未打卡
 * 其他值为兼容保留
 */
export type TaskStatus = "checked" | "unchecked" | "pending" | "in_progress" | "completed" | "failed" | "skipped" | "missed";

/** 前端统一任务显示状态
 * 后端 progress 只返回三个状态：pending(未开始)/inProgress(进行中)/completed(已结束)
 * 前端任务显示状态精简为：completed(已完成)/pending(未开始)
 */
export type TaskDisplayStatus = "completed" | "pending";

/**
 * 将后端 taskStatus 映射为前端显示状态
 * 后端状态值：
 * - completed/checked: 已完成（绿色√）
 * - 其他/空: 未开始（灰色）
 * 说明：后端接口只返回 pending/inProgress/completed 三个状态，前端不再使用"未打卡"状态
 */
export function mapTaskStatus(taskStatus?: TaskStatus, sceneEnded?: boolean): TaskDisplayStatus {
  if (!taskStatus) {
    return "pending";
  }
  const s = taskStatus.toLowerCase();
  // 已完成：只要返回completed/checked就是已完成
  if (s === "checked" || s === "completed") return "completed";
  // 其他所有情况都算未开始
  return "pending";
}

/** 场景整体进度（5.2/5.4 返回，替代原 5.9 接口） */
export type SceneProgress = "pending" | "in_progress" | "inProgress" | "completed" | "failed" | "skipped" | "ended";

/** 场景子任务 */
export interface SceneTask {
  taskCode: string;
  taskName: string;
  taskDescription?: string;
  enabled: boolean;
  /** 今日完成状态，仅 5.2 详情接口返回 */
  taskStatus?: TaskStatus;
}

/** 同步状态枚举 */
export const SceneSyncStatus = {
  UNSYNCED: 0,
  SYNCED: 1,
  FAILED: 2,
} as const;

export type SceneSyncStatusType = (typeof SceneSyncStatus)[keyof typeof SceneSyncStatus];

/** 重复规则枚举 */
export type RepeatRule = "once" | "day" | "week" | "month";

/** 场景配置（完整） */
export interface SceneConfig {
  scheduleId: string;
  templateCode: string;
  templateName: string;
  alarmId: string;
  hour: number;
  minute: number;
  endHour: number;
  endMinute: number;
  enabled: boolean;
  repeatRule: RepeatRule;
  repeatDays: string;
  permissions?: ScenePermissions;
  tasks: SceneTask[];
  syncStatus: SceneSyncStatusType;
  customized: boolean;
  /** 今日整体进度，仅 5.2/5.4 详情接口返回 */
  progress?: SceneProgress;
  /** 光线提醒次数，仅 5.2 详情接口返回 */
  lightRemindCount?: number;
  /** 坐姿提醒次数，仅 5.2 详情接口返回 */
  postureRemindCount?: number;
  /** 已完成任务数，仅 5.4 当前场景接口返回 */
  completedCount?: number;
  /** 总任务数，仅 5.4 当前场景接口返回 */
  totalCount?: number;
}

/** 5.1 查询场景列表 响应壳 */
export type FetchSceneListEnvelope = ApiEnvelope<SceneConfig[]>;

/** 5.2 查询单场景详情 响应壳 */
export type FetchSceneDetailEnvelope = ApiEnvelope<SceneConfig>;

/** 5.3 修改场景配置 请求体（PATCH 部分更新） */
export interface UpdateSceneConfigBody {
  hour?: number;
  minute?: number;
  endHour?: number;
  endMinute?: number;
  repeatRule?: RepeatRule;
  repeatDays?: string;
  permissions?: Partial<ScenePermissions>;
  tasks?: Array<{ taskCode: string; enabled: boolean }>;
  enabled?: boolean;
}

/** 5.3 修改场景配置 响应壳（5.3 仅返回 code/message，无 data 字段，故独立定义） */
export interface UpdateSceneConfigEnvelope {
  code: number;
  message: string;
  data?: boolean;
  requestId?: string;
}

/** 5.4 查询正在进行的场景 响应壳 */
export type FetchCurrentSceneEnvelope = ApiEnvelope<SceneConfig>;

/** 课表单项 */
export interface CourseItem {
  weekday: number;
  weekdayName: string;
  period: number;
  subject: string;
}

/** 5.5 OCR识别课表 响应壳 */
export type ParseCourseTableEnvelope = ApiEnvelope<{
  courses: CourseItem[];
}>;

/** 5.6 查询当前课表 响应壳 */
export type FetchCourseTableEnvelope = ApiEnvelope<{
  courseId: string;
  courses: CourseItem[];
}>;

/** 5.7 修改课表 请求体 */
export interface SaveCourseTableBody {
  courses: Array<{
    weekday: number;
    period: number;
    subject: string;
  }>;
}

/** 5.7 修改课表 响应壳 */
export type SaveCourseTableEnvelope = ApiEnvelope<boolean>;

/** 5.8 课程表数据清除 响应数据：clearedCount 为实际清除的课表条数（0 表示暂无课表可清除） */
export type CleanupCourseTableEnvelope = ApiEnvelope<{
  clearedCount: number;
}>;

/** 5.8 设备上行上报（复用）—— 报文见「设备上报：场景状态与打卡」章节 */
export interface ScheduleReportBody {
  [key: string]: unknown;
}

export type ScheduleReportEnvelope = ApiEnvelope<unknown>;

// ==================== 工具函数 ====================

/** 格式化 hour:minute -> "HH:mm" */
export function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** 根据小时判断时段 */
export function getTimePeriod(time: string): string {
  const [hourStr] = time.split(":");
  const hour = parseInt(hourStr, 10);
  if (hour >= 6 && hour < 12) return "上午";
  if (hour >= 13 && hour < 18) return "下午";
  if (hour >= 18 || hour < 6) return "晚上";
  return "上午";
}

/** templateCode 与前端图标/配色映射 */
export const TEMPLATE_CODE_MAP: Record<
  string,
  { cardClass: string; iconKey: string; defaultMeta: string }
> = {
  morning_wakeup: { cardClass: "card-morning", iconKey: "晨间唤醒", defaultMeta: "阳光唤醒 眼球唤醒操" },
  after_school_outdoor: { cardClass: "card-outdoor", iconKey: "放学户外", defaultMeta: "户外完成30分钟 收集护眼能量" },
  home_study: { cardClass: "card-study", iconKey: "居家学习", defaultMeta: "光线达标 一拳一尺一寸 20-20-20休息" },
  entertainment: { cardClass: "card-entertain", iconKey: "娱乐时段", defaultMeta: "屏幕限时 听觉娱乐" },
  bedtime: { cardClass: "card-sleep", iconKey: "睡前准备", defaultMeta: "睡前无蓝光 护眼故事" },
};

/** 根据当前时间与场景时段判断状态 */
export function computeSceneStatus(
  hour: number,
  minute: number,
  endHour: number,
  endMinute: number
): "done" | "active" | "pending" {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = hour * 60 + minute;
  const endMinutes = endHour * 60 + endMinute;

  if (nowMinutes < startMinutes) return "pending";
  if (nowMinutes >= startMinutes && nowMinutes < endMinutes) return "active";
  return "done";
}

/** 前端统一场景显示状态
 * 后端 progress 只返回三个状态：pending(未开始)/inProgress(进行中)/completed(已结束)
 * 前端已去除"未打卡"状态，时间已过即算已结束
 */
export type SceneDisplayStatus = "done" | "active" | "pending";

/**
 * 将后端下发的场景整体进度映射为前端状态。
 * 后端 5.1/5.2/5.4 接口返回的 progress 字段优先；
 * 没有 progress 时回退到按当前时间计算。
 * - failed/skipped/missed: 已结束（不再区分"未打卡"）
 * - completed/ended: 已结束（绿色√）
 */
function mapProgressToStatus(
  progress?: SceneProgress | string
): SceneDisplayStatus | undefined {
  if (!progress) return undefined;
  const p = progress.toLowerCase();
  // 后端只有三个状态：pending/inProgress/completed，其他值统一归为已结束
  if (p === "failed" || p === "skipped" || p === "missed") {
    return "done";
  }
  if (p === "completed" || p === "ended") {
    return "done";
  }
  if (p === "in_progress" || p === "inprogress" || p === "inprogress") {
    return "active";
  }
  if (p === "pending") {
    return "pending";
  }
  return undefined;
}

const STATUS_LABEL: Record<string, string> = {
  done: "已结束",
  active: "进行中",
  pending: "未开始",
};

/** 将后端 SceneConfig 转换为前端 ScheduleItem */
export function transformToScheduleItem(scene: SceneConfig, completedCountFromAlarm?: number) {
  const time = formatTime(scene.hour, scene.minute);
  const endTime = formatTime(scene.endHour, scene.endMinute);
  const period = getTimePeriod(time);
  // 所有可见任务（排除语音播报，不管是否启用，用于总数统计）
  const allVisibleTasks = scene.tasks.filter((t) => t.taskCode !== "task_voice_broadcast");
  // 已启用的任务（用于显示描述文字和统计完成数）
  const enabledTasks = allVisibleTasks.filter((t) => t.enabled);
  const taskNames = enabledTasks.map((t) => t.taskName).join(" ");

  // 按时间判断场景状态：时间未到=未开始，时间在范围内=进行中，时间已过=已结束
  // 后端 progress 只返回三个状态 pending/inProgress/completed，已去除"未打卡"状态
  const timeStatus = computeSceneStatus(scene.hour, scene.minute, scene.endHour, scene.endMinute);

  // 统计任务完成情况：直接使用5.2接口返回的taskStatus
  const completedTasks = allVisibleTasks.filter(t => {
    const s = t.taskStatus?.toLowerCase();
    return s === "completed" || s === "checked";
  });

  let status: SceneDisplayStatus;

  // 按时间判断：
  // - 时间未到 → 未开始（黑色）
  // - 时间在范围内 → 进行中（黄色）
  // - 时间已过 → 已结束（绿色，无论任务是否完成）
  if (timeStatus === "pending") {
    // 未到开始时间：显示未开始
    status = "pending";
  } else if (timeStatus === "active") {
    // 在时间范围内：进行中
    status = "active";
  } else {
    // 已过结束时间：统一显示已结束
    status = "done";
  }

  const action = STATUS_LABEL[status];
  const mapping = TEMPLATE_CODE_MAP[scene.templateCode] || { cardClass: "", iconKey: scene.templateName, defaultMeta: "" };

  // 任务完成/总数统计：直接统计实际completed/checked任务数
  const progressTotal = scene.totalCount ?? allVisibleTasks.length;
  let progressDone: number;

  if (completedCountFromAlarm !== undefined) {
    progressDone = completedCountFromAlarm;
  } else if (status === "pending") {
    progressDone = 0;
  } else if (status === "done") {
    progressDone = completedTasks.length;
  } else {
    // active：统计实际completed/checked任务数
    progressDone = completedTasks.length;
  }

  return {
    id: scene.scheduleId,
    time,
    endTime,
    period,
    name: scene.templateName,
    status,
    customized: scene.customized === true,
    meta: taskNames || mapping.defaultMeta,
    action,
    templateCode: scene.templateCode,
    alarmId: scene.alarmId,
    enabled: scene.enabled,
    syncStatus: scene.syncStatus,
    cardClass: mapping.cardClass,
    iconKey: mapping.iconKey,
    progressDone,
    progressTotal,
  };
}

export type ScheduleItemFromApi = ReturnType<typeof transformToScheduleItem>;

// ==================== API 函数 ====================

const API_PREFIX = "app/api/v1";

/**
 * 5.1 查询场景模板列表
 * GET /app/api/v1/eye/devices/{deviceId}/scene-configs?pid=xxx
 */
export async function fetchSceneConfigs(deviceId: string | number, pid: string | number) {
  return (await request.get(`${API_PREFIX}/eye/devices/${deviceId}/scene-configs`, {
    params: { pid },
    showErrorToast: false,
  })) as FetchSceneListEnvelope;
}

/**
 * 5.2 按模板编码查询完整配置（编辑页进页）
 * GET /app/api/v1/eye/scene-configs/detail?deviceId=xxx&pid=xxx&templateCode=xxx
 * 成功返回时自动写入短时结果缓存，供详情页"缓存秒开 + 后台刷新"复用
 */
export async function fetchSceneConfigDetail(
  deviceId: string | number,
  pid: string | number,
  templateCode: string
) {
  const res = (await request.get(`${API_PREFIX}/eye/scene-configs/detail`, {
    params: { deviceId, pid, templateCode },
  })) as FetchSceneDetailEnvelope;
  if (res?.code === 200 && res.data) {
    sceneDetailResultCache.set(`${deviceId}|${pid}|${templateCode}`, {
      res,
      time: Date.now(),
    });
  }
  return res;
}

/**
 * 5.2 详情结果短时缓存（stale-while-revalidate）：
 * 任何调用方（列表页进度拉取、详情页、点击预取）成功拿到详情都会写入。
 * 列表页本就周期性为每个场景拉取详情，详情页进入时大概率命中几秒内的缓存。
 */
const SCENE_DETAIL_RESULT_TTL = 10_000; // 缓存有效期 10 秒，超时视为过期
const sceneDetailResultCache = new Map<
  string,
  { res: FetchSceneDetailEnvelope; time: number }
>();

/** 读取 5.2 详情短时缓存：命中且未过期返回接口结果；过期则清理并返回 undefined */
export function peekFreshSceneConfigDetail(
  deviceId: string | number,
  pid: string | number,
  templateCode: string
): FetchSceneDetailEnvelope | undefined {
  const key = `${deviceId}|${pid}|${templateCode}`;
  const cached = sceneDetailResultCache.get(key);
  if (cached && Date.now() - cached.time < SCENE_DETAIL_RESULT_TTL) {
    return cached.res;
  }
  if (cached) {
    sceneDetailResultCache.delete(key); // 过期清理，避免 Map 无限增长
  }
  return undefined;
}

/**
 * 5.2 详情"点击预取"缓存：点击场景卡片的瞬间提前发起详情请求，
 * 详情页挂载时直接复用已完成的结果，省去整段网络等待，实现页面秒开。
 * key = `${deviceId}|${pid}|${templateCode}`，消费即删除，保证下次进入不会用到旧数据。
 */
const sceneDetailPrefetchCache = new Map<
  string,
  Promise<FetchSceneDetailEnvelope | null>
>();

/** 点击场景卡片时调用：立即发起 5.2 详情请求并缓存 Promise（fire-and-forget，不阻塞跳转） */
export function prefetchSceneConfigDetail(
  deviceId: string | number,
  pid: string | number,
  templateCode: string
) {
  const key = `${deviceId}|${pid}|${templateCode}`;
  if (sceneDetailPrefetchCache.has(key)) return; // 同一场景快速连点只发一次请求
  // 兜底 catch：预取失败缓存 null，详情页消费后按正常失败流程渲染，避免未捕获的 Promise 异常
  sceneDetailPrefetchCache.set(
    key,
    fetchSceneConfigDetail(deviceId, pid, templateCode).catch(e => {
      console.warn("[SceneDetailPrefetch] 预取失败，详情页将改为正常请求", e);
      return null;
    })
  );
}

/** 详情页加载时调用：取走预取结果（取即删除）；未预取过时返回 undefined，由详情页正常发请求 */
export function takeSceneConfigDetailPrefetch(
  deviceId: string | number,
  pid: string | number,
  templateCode: string
): Promise<FetchSceneDetailEnvelope | null> | undefined {
  const key = `${deviceId}|${pid}|${templateCode}`;
  const cached = sceneDetailPrefetchCache.get(key);
  if (cached) {
    sceneDetailPrefetchCache.delete(key);
  }
  return cached;
}

/** tasks/alarm 接口返回的打卡状态内容 */
export interface AlarmTaskStatus {
  progress?: string | null;
  lightRemindCount?: number;
  postureRemindCount?: number;
  [taskCode: string]: string | number | undefined | null;
}

/** tasks/alarm 接口响应 */
export interface FetchAlarmTasksEnvelope {
  msg: string;
  ok: boolean;
  status: number;
  timestamp: number;
  result: {
    content: AlarmTaskStatus;
  };
}

/**
 * 查询闹钟今日打卡状态
 * GET /app/api/v1/eye/tasks/alarm?alarmId=xx
 * 返回每个taskCode对应的状态：checked=已打卡, unchecked=未打卡
 */
export async function fetchAlarmTaskStatus(alarmId: string | number) {
  return (await request.get(`${API_PREFIX}/eye/tasks/alarm`, {
    params: { alarmId },
    showErrorToast: false,
  })) as FetchAlarmTasksEnvelope;
}

/**
 * 5.3 修改场景配置（PATCH 部分更新）
 * PATCH /app/api/v1/eye/devices/{deviceId}/scene-configs/{templateCode}?pid=xxx
 */
export async function updateSceneConfig(
  deviceId: string | number,
  pid: string | number,
  templateCode: string,
  body: UpdateSceneConfigBody
) {
  return (await request.patch(
    `${API_PREFIX}/eye/devices/${deviceId}/scene-configs/${templateCode}`,
    body,
    { params: { pid } }
  )) as UpdateSceneConfigEnvelope;
}

/**
 * 5.4 查询正在进行的场景
 * GET /api/v1/devices/{deviceId}/scene-configs/current?pid=xxx&date=xxx
 */
export async function fetchCurrentScene(
  deviceId: string | number,
  pid: string | number,
  date?: string
) {
  return (await request.get(`api/v1/devices/${deviceId}/scene-configs/current`, {
    params: { pid, ...(date ? { date } : {}) },
    showErrorToast: false,
  })) as FetchCurrentSceneEnvelope;
}

/**
 * 5.5 OCR 识别课表（预览，不落库）
 * POST /app/api/course-table/devices/{deviceId}/course-table-parses?pid=xxx
 * multipart/form-data: file 字段为课表图片
 */
export async function parseCourseTable(
  deviceId: string | number,
  pid: string | number,
  file: File
) {
  const formData = new FormData();
  formData.append("file", file);
  return (await request.post(
    `app/api/course-table/devices/${deviceId}/course-table-parses`,
    formData,
    { params: { pid } }
  )) as ParseCourseTableEnvelope;
}

/**
 * 5.7 修改课表
 * PUT /app/api/course-table/devices/{deviceId}/course-tables?pid=xxx
 */
export async function saveCourseTable(
  deviceId: string | number,
  pid: string | number,
  body: SaveCourseTableBody
) {
  return (await request.put(
    `app/api/course-table/devices/${deviceId}/course-tables`,
    body,
    { params: { pid } }
  )) as SaveCourseTableEnvelope;
}

/**
 * 5.6 查询当前课表
 * GET /app/api/course-table/devices/{deviceId}/course-tables?pid=xxx
 */
export async function fetchCourseTable(
  deviceId: string | number,
  pid: string | number
) {
  return (await request.get(`app/api/course-table/devices/${deviceId}/course-tables`, {
    params: { pid },
    showErrorToast: false,
  })) as FetchCourseTableEnvelope;
}

/**
 * 5.8 课程表数据清除
 * GET /api/course-table/cleanup?deviceId=xxx（token 鉴权，Query 传参）
 * 清除设备下课程表数据；clearedCount=0 表示暂无课表可清除
 */
export async function cleanupCourseTable(deviceId: string | number) {
  return (await request.get(`app/api/course-table/cleanup`, {
    params: { deviceId },
    showErrorToast: false,
  })) as CleanupCourseTableEnvelope;
}

/**
 * 5.8 设备上行上报（复用）
 * POST /app/api/v1/schedules/report
 * Merchant 转发设备上行；日程服务处理 sceneEvent 后 ACK sceneEventAck，
 * 并异步通知 App 服务记录打卡/计分
 */
export async function reportSchedule(body: ScheduleReportBody) {
  return (await request.post(
    `${API_PREFIX}/schedules/report`,
    body
  )) as ScheduleReportEnvelope;
}

/** 积分汇总 */
export interface PointsSummary {
  todayPoints: number;
  weekPoints: number;
  currentPoints: number;
}

/** 积分汇总响应壳 */
export interface PointsSummaryResponse {
  msg: string;
  result: {
    content: PointsSummary;
  };
  ok: boolean;
  status: number;
  timestamp: number;
}

/**
 * 查询积分汇总
 * GET /app/api/v1/eye/points/summary?deviceId=xxx&pid=xxx
 */
export async function fetchPointsSummary(deviceId: string | number, pid: string | number) {
  return (await request.get(`${API_PREFIX}/eye/points/summary`, {
    params: { deviceId, pid },
    showErrorToast: false,
  })) as PointsSummaryResponse;
}

/** 6.1 清除设备数据 响应数据 */
export interface CleanupDeviceDataResult {
  scheduleCount: number;     // 清理的日程数
  courseCount: number;       // 清理的课表数
  sceneExtensionCount: number; // 清理的场景扩展数
}

/** 6.1 清除设备数据 响应壳（eye 模块统一 code:200） */
export interface CleanupDeviceDataEnvelope {
  code: number;
  message: string;
  data: CleanupDeviceDataResult;
  requestId?: string;
}

/**
 * 6.1 清除设备数据（日程/课表/场景扩展）
 * POST /app/api/schedule/devices/cleanup
 * body: { deviceId: string }
 *
 * 用于设备解绑时同步清除后端业务数据。
 */
export async function cleanupDeviceData(deviceId: string | number) {
  return (await request.post(
    `app/api/schedule/devices/cleanup`,
    { deviceId: String(deviceId) },
    { showErrorToast: false }
  )) as CleanupDeviceDataEnvelope;
}

// ==================== 摄像头权限 ====================

/** 摄像头权限值：on=已授权，off=未授权 */
export type CameraPermissionValue = "on" | "off";

/**
 * 摄像头权限响应数据：
 * 后端可能直接返回 "on"/"off"，也可能返回对象 { cameraPermission: "on"/"off" }，
 * 解析逻辑统一收口在 cameraPermissionService 中处理
 */
export type CameraPermissionData =
  | CameraPermissionValue
  | boolean
  | { cameraPermission?: CameraPermissionValue | boolean }
  | null
  | undefined;

/** 摄像头权限接口通用响应壳（eye 模块统一 code:200） */
export interface CameraPermissionEnvelope {
  code?: number;
  message?: string;
  msg?: string;
  data?: CameraPermissionData;
  result?: { content?: CameraPermissionData };
  [key: string]: unknown;
}

/**
 * 获取摄像头权限
 * GET /app/device/cameraPermission?did=xxx（注意：无 /api/v1 前缀，用 did 传参）
 */
export async function fetchCameraPermission(did: string | number) {
  return (await request.get(`app/device/cameraPermission`, {
    params: { did },
    showErrorToast: false,
  })) as CameraPermissionEnvelope;
}

/**
 * 设置摄像头权限
 * POST /app/device/update/cameraPermission（注意：无 /api/v1 前缀）
 * body: { did: 设备ID, cameraPermission: "on" | "off" }
 */
export async function updateCameraPermission(
  did: string | number,
  cameraPermission: CameraPermissionValue
) {
  return (await request.post(
    `app/device/update/cameraPermission`,
    { did: String(did), cameraPermission },
    { showErrorToast: false }
  )) as CameraPermissionEnvelope;
}

// ==================== 设备信息（设备名称）接口 ====================

/** 设备信息数据：名称字段做兼容（后端可能返回 name 或 deviceName） */
export interface DeviceByDidData {
  name?: string;
  deviceName?: string;
  [key: string]: unknown;
}

/** 设备信息接口通用响应壳（宽松解析，兼容 data/result 两种包裹形态） */
export interface DeviceInfoEnvelope {
  code?: number;
  ok?: boolean;
  status?: number;
  message?: string;
  msg?: string;
  data?: DeviceByDidData | null;
  result?: DeviceByDidData | { content?: DeviceByDidData };
  [key: string]: unknown;
}

/**
 * 获取设备信息
 * GET /app/device/getByDid/{did}（注意：无 /api/v1 前缀，did 为路径参数）
 */
export async function fetchDeviceByDid(did: string | number) {
  return (await request.get(`app/device/getByDid/${did}`, {
    showErrorToast: false,
  })) as DeviceInfoEnvelope;
}

/**
 * 修改设备名称
 * POST /app/device/update/name（注意：无 /api/v1 前缀）
 * body: { did: 设备ID, name: 新名称 }
 */
export async function updateDeviceName(did: string | number, name: string) {
  return (await request.post(
    `app/device/update/name`,
    { did: String(did), name },
    { showErrorToast: false }
  )) as DeviceInfoEnvelope;
}

/**
 * 设备信息接口统一成功判定
 * 兼容后端壳三种形态：code=200（eye 模块规范）/ ok=true（unbind 同款）/ status=0
 */
export function isDeviceInfoSuccess(res: DeviceInfoEnvelope | null | undefined): boolean {
  return (
    !!res &&
    (res.code === 200 ||
      String(res.code) === "200" ||
      res.ok === true ||
      res.status === 0)
  );
}

/**
 * 从设备信息响应壳中解析设备名称
 * 兼容 data / result / result.content 三种包裹结构与 name / deviceName 两种字段名
 */
export function parseDeviceName(res: DeviceInfoEnvelope | null | undefined): string {
  if (!res) return "";
  const d =
    (res.data as DeviceByDidData | undefined) ??
    ((res.result as DeviceByDidData | undefined)?.content as DeviceByDidData | undefined) ??
    (res.result as DeviceByDidData | undefined) ??
    {};
  const name = d?.name ?? d?.deviceName ?? "";
  return typeof name === "string" ? name.trim() : "";
}

/** 修改设备信息（IoT 平台 editdevice）的响应结构（与闹钟项目 aiAlarmApi 保持一致） */
export interface UpdateUserInfoApiEnvelope {
  msg: string;
  ok: boolean;
  status: number;
  timestamp: number;
}

/**
 * 修改设备名称（直接写 IoT 平台数据源，与闹钟项目同款实现）
 * POST {VITE_APP_IOT_API}/appapi/iot/editdevice
 * body: { id: 设备数字ID（取 SDK 推送的 info.id）, deviceName: 新名称 }
 * 说明：eye 后端 update/name 写入的数据源与 getByDid 读取存在同步延迟，
 * 导致改名后重进页面标题回退为旧名；改为直接写 IoT 平台保证宿主与 H5 读取一致
 */
export async function editDeviceName(params: {
  id: number;
  deviceName: string;
}) {
  return (await request.post(
    import.meta.env.VITE_APP_IOT_API + "/appapi/iot/editdevice",
    {
      ...params
    }
  )) as UpdateUserInfoApiEnvelope;
}
