import request from "@/utils/request";
import requestAgent from "@/utils/requestAgent";
/** 查询闹钟列表的请求参数 */
export interface FetchAlarmListQueryParams {
  deviceId: string;
  scope?: "today" | "all";
  bizType?: string;
}

/** 闹钟模板配置 */
export interface AlarmTemplate {
  templateName: string;
  templateCode:
    | "wakeup"
    | "study"
    | "goodnight"
    | "reading"
    | "sport"
    | "other"
    | "";
  message: string;
  ring: string;
  intensity: string;
  snoozeEnabled: number;
  snoozeInterval: number;
  snoozeMaxCount: number;
  motorAction: string;
  [key: string]: any;
}

/** 闹钟列表项 */
export interface AlarmListItem {
  scheduleId: string;
  execStartTime: string;
  theme: string;
  repeatRule: string;
  repeatDays: string;
  repeatDesc: string;
  enabled: number;
  template: AlarmTemplate;
}

/** 查询闹钟列表的响应结构 */
export interface FetchAlarmListApiEnvelope {
  code?: number;
  status?: boolean;
  message?: string;
  data?: AlarmListItem[];
}

/** 查询今日/全部闹钟 */
export async function fetchAlarmList(params: FetchAlarmListQueryParams) {
  return (await requestAgent.get("app/api/ledi/alarm/alarms", {
    params: {
      bizType: "common",
      ...params
    }
  })) as FetchAlarmListApiEnvelope;
}

/** 启停闹钟的请求参数 */
export interface ToggleAlarmParams {
  deviceId: string;
  scheduleId: string;
  enabled: string;
}

/** 启停闹钟的响应结构 */
export interface ToggleAlarmApiEnvelope {
  code?: number;
  data?: boolean;
  message?: string;
}

/** 启停闹钟 */
export async function toggleAlarm(params: ToggleAlarmParams) {
  return (await requestAgent.post("app/api/ledi/alarm/alarms/toggle", {
    ...params
  })) as ToggleAlarmApiEnvelope;
}

/** 铃声项 */
export interface RingTone {
  code: string;
  name: string;
}

/** 查询铃声的请求参数 */
export interface FetchRingTonesQueryParams {
  bizType?: string;
  deviceId: string;
}

/** 查询铃声的响应结构 */
export interface FetchRingTonesApiEnvelope {
  code?: number;
  data?: RingTone[];
  message?: string;
}

/** 查询铃声 */
export async function fetchRingTones(params?: FetchRingTonesQueryParams) {
  return (await requestAgent.get("app/api/ledi/alarm/ring-tones", {
    params: {
      bizType: "alarm",
      ...params
    }
  })) as FetchRingTonesApiEnvelope;
}

/** 查询铃声强度的请求参数 */
export interface FetchIntensitiesQueryParams {
  bizType?: string;
}

/** 查询铃声强度的响应结构 */
export interface FetchIntensitiesApiEnvelope {
  code?: number;
  data?: RingTone[];
  message?: string;
}

/** 查询铃声强度 */
export async function fetchIntensities(params?: FetchIntensitiesQueryParams) {
  return (await requestAgent.get("app/api/ledi/alarm/intensities", {
    params: {
      bizType: "common",
      ...params
    }
  })) as FetchIntensitiesApiEnvelope;
}

/** 重复设置项 */
export interface RepeatOption {
  repeatCode: string;
  name: string;
}

/** 查询重复设置的请求参数 */
export interface FetchRepeatOptionsQueryParams {
  bizType?: string;
}

/** 查询重复设置的响应结构 */
export interface FetchRepeatOptionsApiEnvelope {
  code?: number;
  data?: RepeatOption[];
  message?: string;
}

/** 查询重复设置 */
export async function fetchRepeatOptions(
  params?: FetchRepeatOptionsQueryParams
) {
  return (await requestAgent.get("app/api/ledi/alarm/repeat-options", {
    params: {
      bizType: "common",
      ...params
    }
  })) as FetchRepeatOptionsApiEnvelope;
}

/** 贪睡设置项 */
export interface SnoozeOption {
  code: string;
  name: string;
  ext: {
    snoozeEnabled?: number;
    snoozeInterval?: number;
    snoozeMaxCount?: number;
    [key: string]: any;
  };
}

/** 查询贪睡设置的请求参数 */
export interface FetchSnoozeOptionsQueryParams {
  bizType?: string;
}

/** 查询贪睡设置的响应结构 */
export interface FetchSnoozeOptionsApiEnvelope {
  code?: number;
  data?: SnoozeOption[];
  message?: string;
}

/** 查询贪睡设置 */
export async function fetchSnoozeOptions(
  params?: FetchSnoozeOptionsQueryParams
) {
  return (await requestAgent.get("app/api/ledi/alarm/snooze-options", {
    params: {
      bizType: "common",
      ...params
    }
  })) as FetchSnoozeOptionsApiEnvelope;
}

/** 乐迪闹钟扩展字段 */
export interface ExtJson {
  templateCode?: string;
  message: string;
  ring: string;
  toneResourceId: string;
  intensity: string;
  snoozeEnabled: number;
  snoozeInterval: number;
  snoozeMaxCount: number;
  [key: string]: any;
}

/** 添加闹钟的请求参数 */
export interface AddAlarmParams {
  scheduleId?: string;
  deviceId: number;
  pid: number;
  theme: string;
  repeatCode: string;
  bizType: string;
  clockTime: string;
  extJson: ExtJson;
  [key: string]: any;
}

/** 添加闹钟的响应数据 */
export interface AddAlarmData {
  schedule_id: string;
  remind_time: string;
  timestamp: number;
}

/** 添加闹钟的响应结构 */
export interface AddAlarmApiEnvelope {
  code?: number;
  message?: string;
  data?: AddAlarmData;
}
export interface EditAlarmApiEnvelope {
  code?: number;
  message?: string;
  data?: {
    scheduleId: string;
  };
}

/** 添加闹钟 */
export async function addAlarm(params: AddAlarmParams) {
  return (await requestAgent.post("app/api/ledi/alarm/addSchedule", {
    ...params
  })) as AddAlarmApiEnvelope;
}

/** 删除闹钟的请求参数 */
export interface DeleteAlarmParams {
  deviceId: string;
  scheduleId?: string;
  scheduleIds?: string[];
}

/** 删除闹钟的响应结构 */
export interface DeleteAlarmApiEnvelope {
  code?: number;
  message?: string;
  data?: boolean;
}

/** 删除闹钟 */
export async function deleteAlarm(params: DeleteAlarmParams) {
  return (await requestAgent.post("app/api/ledi/alarm/deleteSchedule", {
    ...params
  })) as DeleteAlarmApiEnvelope;
}

/** 闹钟模板项 */
export interface AlarmTemplateItem {
  templateCode: string;
  templateName: string;
  defaultMessage: string;
  defaultRing: string;
  defaultToneResourceId: string;
  defaultIntensity: string;
  defaultSnoozeCode: string;
  defaultSnoozeEnabled: number;
  defaultSnoozeInterval: number;
  defaultSnoozeMaxCount: number;
  defaultRepeatCode: string;
}

/** 获取闹钟模板的请求参数 */
export interface FetchAlarmTemplatesParams {
  bizType?: string;
}

/** 获取闹钟模板的响应结构 */
export interface FetchAlarmTemplatesEnvelope {
  code?: number;
  data?: AlarmTemplateItem[];
  message?: string;
}

/** 获取闹钟模板 */
export async function fetchAlarmTemplates(params?: FetchAlarmTemplatesParams) {
  return (await requestAgent.get("app/api/ledi/alarm/alarm-templates", {
    params: {
      bizType: "common",
      ...params
    }
  })) as FetchAlarmTemplatesEnvelope;
}

/** 查询闹钟详情的请求参数 */
export interface FetchAlarmDetailParams {
  scheduleId: string;
  deviceId: string;
  bizType?: string;
}

/** 查询闹钟详情的响应结构 */
export interface FetchAlarmDetailApiEnvelope {
  code?: number;
  message?: string;
  data?: AddAlarmParams;
}

/** 根据id查找闹钟详情 */
export async function fetchAlarmDetail(params: FetchAlarmDetailParams) {
  return (await requestAgent.get("app/api/ledi/alarm/detail", {
    params: {
      bizType: "common",
      ...params
    }
  })) as FetchAlarmDetailApiEnvelope;
}
export async function editAlarm(params: AddAlarmParams) {
  return (await requestAgent.post("app/api/ledi/alarm/updateScheduleAuto", {
    ...params
  })) as EditAlarmApiEnvelope;
}

/** 用户信息 - 兴趣项 */
export interface UserInterest {
  id: number;
  charactersId: number;
  categoryId: number;
  categoryName?: string;
  optionId: number;
  optionName?: string;
  [key: string]: any;
}

/** 用户信息 */
export interface UserInfo {
  ageGroupDescription: string;
  ageGroupId: number;
  consumption: string;
  createTime: string;
  customize: string;
  dateOfBirth: number;
  gender: number;
  habitsCustoms: string;
  hobby: string;
  id: number;
  interests: UserInterest[];
  isDelete: number;
  name: string;
  socialRole: string;
  socialScene: string;
  socialize: string;
  updateTime: string;
  userUuid: string;
  [key: string]: any;
}

/** 获取用户信息的响应结构 */
export interface FetchUserInfoApiEnvelope {
  msg: string;
  ok: boolean;
  result?: UserInfo;
  status: number;
  timestamp: number;
}

/** 获取用户信息 */
export async function fetchUserInfo() {
  return (await requestAgent.get(
    "app/character/getByUserUuid"
  )) as FetchUserInfoApiEnvelope;
}
/** 修改用户信息的兴趣项 */

/** 修改用户信息的请求参数 */
export interface UpdateUserInfoParams {
  dateOfBirth: number;
  gender: number;
  id: number;
  interests: UserInterest[];
  name: string;
}

/** 修改用户信息的响应结构 */
export interface UpdateUserInfoApiEnvelope {
  msg: string;
  ok: boolean;
  status: number;
  timestamp: number;
}

/** 修改用户信息 */
export async function updateUserInfo(params: UpdateUserInfoParams) {
  return (await requestAgent.put("app/character", {
    ...params
  })) as UpdateUserInfoApiEnvelope;
}

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
/** 解绑设备的响应结构 */
export interface UnbindDeviceApiEnvelope {
  msg: string;
  ok: boolean;
  status: number;
  timestamp: number;
}

/** 解绑设备 */
export async function unbind(dids: number[]) {
  return (await request.post(
    import.meta.env.VITE_APP_IOT_API + "/appapi/iot/unbind",
    dids
  )) as UnbindDeviceApiEnvelope;
}

/** 终端用户信息内容 */
export interface TerminalUserInfoContent {
  id: number;
  userUuid: string;
  username: string;
  userSecret: string;
  avatar: string;
  brandId: string;
  createTime: string;
  email: string | null;
  gender: number;
  nickName: string;
  openId: string;
  phone: string;
  roles: any[];
  status: number;
  updateTime: string | null;
  [key: string]: any;
}

/** 终端用户信息结果 */
export interface TerminalUserInfoResult {
  content: TerminalUserInfoContent;
  [key: string]: any;
}

/** 获取终端用户信息的响应结构 */
export interface FetchTerminalUserInfoApiEnvelope {
  msg: string;
  ok: boolean;
  result: TerminalUserInfoResult;
  status: number;
  timestamp: number;
  version: number;
}

/** 获取终端用户信息 */
export async function fetchTerminalUserInfo() {
  return (await requestAgent.get(
    "app/user/info"
  )) as FetchTerminalUserInfoApiEnvelope;
}

/** 设置播放时长的请求参数 */
export interface SetPlayTimeParams {
  pid: string;
  did: string;
  playDurationLimit: number;
}

/** 设置播放时长的响应结构 */
export interface SetPlayTimeApiEnvelope {
  code?: number;
  msg?: string;
  ok?: boolean;
}

/** 设置播放时长 */
export async function setPlayTime(params: SetPlayTimeParams) {
  return (await requestAgent.post("app/api/ledi/alarm/play-time/set", {
    ...params
  })) as SetPlayTimeApiEnvelope;
}
/** 查询播放时长的请求参数 */
export interface GetPlayTimeInfoParams {
  pid: string;
  did: string;
}

/** 查询播放时长的响应数据 */
export interface PlayTimeInfoResult {
  pid: string;
  did: string;
  playDurationLimit: number;
  todayPlayedDuration: number;
  remainingDuration: number;
  playPercentage: number;
}

/** 查询播放时长的响应结构 */
export interface GetPlayTimeInfoApiEnvelope {
  code?: number;
  msg?: string;
  ok?: boolean;
  result?: PlayTimeInfoResult;
}

/** 查询播放时长 */
export async function getPlayTimeInfo(params: GetPlayTimeInfoParams) {
  return (await requestAgent.get("app/api/ledi/alarm/play-time/info", {
    params: {
      ...params
    }
  })) as GetPlayTimeInfoApiEnvelope;
}

export interface CheckTextResultResponse {
  code?: number;
  msg?: string;
  ok?: boolean;
  result?: {
    suggestion: number;
  };
}
export async function checkTextSafety(params: { content: string }) {
  return (await requestAgent.get("app/api/check/text", {
    params: {
      ...params
    }
  })) as CheckTextResultResponse;
}
export interface GetFirmwareUpdateDeviceStatusV2ResultResponse {
  code?: number;
  msg?: string;
  ok?: boolean;
  result?: {
    /** 0 设备不在升级状态、1 设备在升级中、2 设备升级成功、3 设备升级失败 */
    status: number;
    /** 设备当前固件版本集合，模组排首位，后续为 MCU（按产品内资源类型排序） */
    versionList: [];
    /** 设备可升级固件版本集合，仅包含有可升级项的固件 */
    upgradeableVersionList: {
      version: string;
    }[];
    /** 设备当前升级进度，status=1 时存在，否则为 null */
    progress?: number | null;
    /** 正在升级的固件类型：0 模组、1 MCU，status=1 时存在，否则为 null */
    firmwareType?: 0 | 1 | null;
    /** 连续升级阶段进度，status=1 时存在，否则为 null */
    otaStageProgress?: { stage: number; sumStages: number } | null;
  };
}
export async function getFirmwareUpdateDeviceStatusV2(params: { did: number }) {
  return (await request.get(
    import.meta.env.VITE_APP_IOT_API +
      "/iotservice/api/FirmwareUpdateLog/deviceStatus/v2",
    {
      params: {
        ...params
      }
    }
  )) as GetFirmwareUpdateDeviceStatusV2ResultResponse;
}
