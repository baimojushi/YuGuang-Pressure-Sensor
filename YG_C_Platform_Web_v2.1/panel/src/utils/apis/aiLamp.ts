import request from "@/utils/request";

// 关闭或者开启学习模式
export async function sendCustomEvent(params: {
  pid: string;
  did: string;
  event: "study_mode_on" | "study_mode_off";
}) {
  return await request.get("app/api/agora/sendCustomEvent", { params });
}

/** 与后端约定一致的通用响应壳（语雀 4.x 示例） */
export interface AiLampApiEnvelope<T> {
  code: string;
  status: boolean;
  message: string;
  data: T;
}

/** 4.1.1 查询用户搜题任务列表 GET /app/api/olap/learning/photosearchlist */
export interface PhotoSearchListQueryParams {
  deviceId: string;
  startTime?: string;
  endTime?: string;
}

export interface PhotoSearchListItem {
  ocrTaskId: string;
  imageThumbnailUrl: string;
  subject: string;
  createdAt: string;
  completedAt: string;
}

/** 4.1.1 列表接口实际响应：列表在 result.content */
export interface PhotoSearchListApiEnvelope {
  code?: string;
  status?: boolean;
  message?: string;
  result?: {
    content: PhotoSearchListItem[];
  } | null;
}

/** 列表项 + 前端分组展示字段 */
export type PhotoSearchListRow = PhotoSearchListItem & {
  cardTimeLabel: string;
  sectionGroup: "today" | "other";
  sectionHeading: string;
};

export type PhotoSearchListGroupBlock = {
  heading: string;
  items: PhotoSearchListRow[];
};

export async function fetchPhotoSearchList(params: PhotoSearchListQueryParams) {
  return (await request.get("app/api/olap/learning/photosearchlist", {
    params
  })) as PhotoSearchListApiEnvelope;
}

/** 4.1.2 查询搜题任务详情 GET /app/api/olap/learning/photosearchdetail?taskId= */
export type PhotoSearchTaskStatus = "PENDING" | "COMPLETED" | "FAILED" | string;

export interface PhotoSearchQuestionItem {
  questionId: string;
  question: string;
  coordinates: string;
  cropUrl?: string;
  answer: string;
  solveProcess: string;
  correctionResult: string;
  correctAnswer: string | null;
}

export interface PhotoSearchDetailData {
  id: number;
  imageUrl: string;
  detectedSubject: string;
  status: PhotoSearchTaskStatus;
  questions: PhotoSearchQuestionItem[];
}

/** 4.1.2 详情接口实际响应：与列表一致，详情在 result.content */
export interface PhotoSearchDetailApiEnvelope {
  code?: string;
  status?: boolean;
  message?: string;
  result?: {
    content: PhotoSearchDetailData;
  } | null;
}

export async function fetchPhotoSearchDetail(ocrTaskId: string) {
  return (await request.get("app/api/olap/learning/photosearchdetail", {
    params: { taskId: ocrTaskId }
  })) as PhotoSearchDetailApiEnvelope;
}

/** 4.1.3 / 4.2.3 删除任务接口响应 */
export type OlapDeleteTaskResponse = {
  result?: { content: boolean } | null;
  msg?: string;
  message?: string;
};

/** 4.1.3 删除搜题任务 DELETE /app/api/olap/learning/photosearchtask?taskId= */
export async function deletePhotoSearchTask(ocrTaskId: string) {
  return (await request.delete("app/api/olap/learning/photosearchtask", {
    params: { taskId: ocrTaskId }
  })) as OlapDeleteTaskResponse;
}

/** 4.2.1 查询用户作文批改任务列表 GET /app/api/olap/learning/compositionlist */
export interface CompositionListQueryParams {
  deviceId: string;
  startTime?: string;
  endTime?: string;
}

export interface CompositionListItem {
  taskId: string;
  imageThumbnailUrl: string;
  title: string;
  reportUrl: string;
  createdAt: string;
  completedAt: string;
}

/** 4.2.1 列表接口实际响应：与搜题列表一致，列表在 result.content */
export interface CompositionListApiEnvelope {
  code?: string;
  status?: boolean;
  message?: string;
  result?: {
    content: CompositionListItem[];
  } | null;
}

/** 列表项 + 前端列表展示字段（时间文案等） */
export type CompositionListRow = CompositionListItem & {
  cardTimeLabel: string;
};

export async function fetchCompositionList(params: CompositionListQueryParams) {
  return (await request.get("app/api/olap/learning/compositionlist", {
    params
  })) as CompositionListApiEnvelope;
}

/** 4.2.3 删除作文批改任务 DELETE /app/api/olap/learning/compositiontask?taskId= */
export async function deleteCompositionTask(taskId: string) {
  return (await request.delete("app/api/olap/learning/compositiontask", {
    params: { taskId }
  })) as OlapDeleteTaskResponse;
}

/** 通用分页响应壳（current/size/pages/records 模式） */
export interface PageApiEnvelope<T> {
  code: number;
  success: boolean;
  message: string;
  data: {
    records: T[];
    total: number;
    pages: number;
    size: number;
    current: number;
  };
}

/** 消息提醒分页 GET /app/desklamp/study/abnormal/page */
export interface StudyAbnormalPageQuery {
  did: string;
  current: number;
  size: number;
}

export interface StudyAbnormalRecord {
  id: number;
  did: string;
  pid: string | null;
  createTime: string;
  abnormalType: string;
  abnormalTypeName: string;
  deviceAlert: number;
}

export async function fetchStudyAbnormalPage(params: StudyAbnormalPageQuery) {
  return (await request.get("app/desklamp/study/abnormal/page", {
    params
  })) as PageApiEnvelope<StudyAbnormalRecord>;
}

/** App 听写通用响应壳（code === 0 表示成功） */
export interface DictationApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

/** 听写来源：1-教材听写，2-拍照录入 */
export type DictationSourceType = 1 | 2;

/** 听写结果：1-正确，2-错误，3-跳过（详情 wordList.resultStatus） */
export type DictationResultStatus = 1 | 2 | 3;

/** App 听写 pid/did 查询参数 */
export interface DictationDeviceQuery {
  pid: string;
  did: string;
}

/** 1. 获取听写记录列表 GET /study/dictation/record/list */
export interface DictationRecordListQuery extends DictationDeviceQuery {
  current?: number;
  size?: number;
}

export interface DictationRecordListItem {
  id: number;
  title: string;
  accuracy: number;
  finishTime: string;
  wordCount: number;
  sourceType: DictationSourceType;
  unitName: string;
  batchLabel: string | null;
  isBatch: 0 | 1 | null;
  hasWrong: 0 | 1;
}

/** 分批子记录项 GET /study/dictation/record/batchList */
export interface DictationRecordBatchItem {
  id: number;
  title: string;
  accuracy: number;
  finishTime: string;
  wordCount?: number;
  sourceType?: DictationSourceType;
  unitName?: string;
  batchLabel: string | null;
  hasWrong?: 0 | 1;
}

export interface DictationRecordListData {
  records: DictationRecordListItem[];
  total: number;
  pages: number;
  size: number;
  current: number;
}

export async function fetchDictationRecordList(
  params: DictationRecordListQuery
) {
  return (await request.get("app/study/dictation/record/list", {
    params
  })) as DictationApiEnvelope<DictationRecordListData>;
}

/** 1.1 获取分批子记录列表 GET /study/dictation/record/batchList */
export async function fetchDictationRecordBatchList(parentId: number) {
  return (await request.get("app/study/dictation/record/batchList", {
    params: { parentId }
  })) as DictationApiEnvelope<DictationRecordBatchItem[]>;
}

/** 2. 获取听写详情 GET /study/dictation/record/detail */
export interface DictationWordDetailItem {
  sortOrder: number;
  word: string;
  meaning: string;
  phonetic: string;
  userAnswer: string;
  resultStatus: DictationResultStatus;
}

export interface DictationRecordDetail {
  recordId: number;
  title: string;
  accuracy: number;
  finishTime: string;
  correctCount: number;
  wrongCount: number;
  skipCount: number;
  totalCount: number;
  wordList: DictationWordDetailItem[];
}

export async function fetchDictationRecordDetail(id: number | string) {
  return (await request.get("app/study/dictation/record/detail", {
    params: { id }
  })) as DictationApiEnvelope<DictationRecordDetail>;
}

/** 3. 获取听写配置 GET /study/dictation/config */
export interface DictationConfig {
  id: number;
  pid: string;
  did: string;
  textbookId: number | null;
  /** 1-小学，2-初中 */
  schoolStage: number | null;
  /** 3-三年级，5-五年级，6-六年级 */
  grade: number | null;
  /** 1-上册，2-下册 */
  semester: number | null;
  /** 1-人教，2-外研，3-译林，4-沪教 */
  publisher: number | null;
  /** 1-英语 */
  subject: number;
  intervalSeconds: number;
  repeatTimes: number;
  playMeaning: 0 | 1;
  /** 0-未启用，1-启用 */
  status: 0 | 1;
}

/** 学段选项（value 与 DictationConfig.schoolStage 一致） */
export const DICTATION_SCHOOL_STAGE_OPTIONS = [
  { value: 1, labelKey: "aiLamp.dictation.stagePrimary" },
  { value: 2, labelKey: "aiLamp.dictation.stageJunior" }
] as const;

/** 年级选项（value 与 DictationConfig.grade 一致） */
export const DICTATION_GRADE_OPTIONS = [
  { value: 3, labelKey: "aiLamp.dictation.gradeG3" },
  { value: 5, labelKey: "aiLamp.dictation.gradeG5" },
  { value: 6, labelKey: "aiLamp.dictation.gradeG6" }
] as const;

/** 学期选项（value 与 DictationConfig.semester 一致） */
export const DICTATION_SEMESTER_OPTIONS = [
  { value: 1, labelKey: "aiLamp.dictation.semesterVol1" },
  { value: 2, labelKey: "aiLamp.dictation.semesterVol2" }
] as const;

/** 出版社选项（value 与 DictationConfig.publisher 一致） */
export const DICTATION_PUBLISHER_OPTIONS = [
  { value: 1, labelKey: "aiLamp.dictation.publisherPep" },
  { value: 2, labelKey: "aiLamp.dictation.publisherFltrp" },
  { value: 3, labelKey: "aiLamp.dictation.publisherYilin" },
  { value: 4, labelKey: "aiLamp.dictation.publisherShanghai" }
] as const;

export async function fetchDictationConfig(params: DictationDeviceQuery) {
  return (await request.get("app/study/dictation/config", {
    params
  })) as DictationApiEnvelope<DictationConfig>;
}

/** 4. 保存/更新听写配置 POST /study/dictation/config/save */
export type DictationConfigSavePayload = Pick<
  DictationConfig,
  "pid" | "did"
> &
  Partial<Omit<DictationConfig, "id">>;

export async function saveDictationConfig(body: DictationConfigSavePayload) {
  return (await request.post(
    "app/study/dictation/config/save",
    body
  )) as DictationApiEnvelope<DictationConfig>;
}

/** 5. 重置听写配置 GET /study/dictation/config/reset */
export async function resetDictationConfig(params: DictationDeviceQuery) {
  return (await request.get("app/study/dictation/config/reset", {
    params
  })) as DictationApiEnvelope<DictationConfig>;
}
