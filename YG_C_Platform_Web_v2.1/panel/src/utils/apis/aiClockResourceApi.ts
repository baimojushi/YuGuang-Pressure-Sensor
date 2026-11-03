import request from "@/utils/request";
import requestAgent from "@/utils/requestAgent";
/** 推荐资源项 */
export interface RecommendResourceItem {
  id: number;
  parentId: number;
  name: string;
  description: string;
  icon: string;
  backgroundImage: string;
  path: string;
  level: number;
  sortOrder: number;
  isLeaf: number;
  isRecommend: string;
  children: RecommendResourceItem[] | null;
  createTime: string;
  [key: string]: any;
}

/** 推荐资源响应结构 */
export interface RecommendResourceApiEnvelope {
  code?: number;
  success?: boolean;
  message?: string;
  data?: RecommendResourceItem[];
}

/** 获取推荐资源 */
export async function fetchRecommendResources(pid: number) {
  return (await requestAgent.get("app/api/resouce/recommend", {
    params: { pid }
  })) as RecommendResourceApiEnvelope;
}

export async function fetchRecommendResourcesCategories(pid: number) {
  return (await requestAgent.get("app/api/resouce/categories", {
    params: { pid }
  })) as RecommendResourceApiEnvelope;
}

/** 资源详情项 */
export interface ResourceDetailItem {
  id: number;
  title: string;
  description: string;
  streamUrl: string;
  originalMediaUrl: string;
  durationSeconds: number;
  language: string;
  searchWord: string;
  text: string;
  categoryId: number;
  fileSizeBytes: number;
  transcodeStatus: number;
  transcodeLog: string;
  createTime: string;
  updateTime: string;
  [key: string]: any;
}

/** 资源分类详情 */
export interface ResourceCategoryDetail {
  id: number;
  name: string;
  description: string;
  icon?: string;
  backgroundImage?: string;
  [key: string]: any;
}

/** 资源详情响应结构 */
export interface ResourceDetailApiEnvelope {
  code?: number;
  success?: boolean;
  message?: string;
  data?: {
    category: RecommendResourceItem;
    resources: ResourceDetailItem[];
  };
}

/** 获取资源分类详情 */
export async function fetchResourceDetail(
  categoryId: number | string,
  pid: number
) {
  return (await requestAgent.get("app/api/resouce/categories/detail", {
    params: { categoryId, pid }
  })) as ResourceDetailApiEnvelope;
}

/** 发送自定义事件（播放/停止资源等） */
export async function sendResourceCustomEvent(params: {
  pid: number | string;
  did: number | string;
  event: string;
}) {
  return (await requestAgent.get("app/api/agora/sendCustomEvent", {
    params
  })) as {
    code?: number;
    success?: boolean;
    message?: string;
    data?: any;
  };
}
export async function sendIOTEvent(payload: {
  // 外层topic
  topicName: string;
  // 设备上行消息体
  receiveBody: {
    method: string;
    subMethod: string;
    id: number;
    code: number;
    params: Record<string, string | number>;
  };
}) {
  // POST 传完整json body，路径带前缀 agent-merchant
  return (await requestAgent.post(
    "agent-merchant/api/resource/event",
    payload
  )) as {
    status: number;
    msg: string;
    timestamp: number;
    result: any;
    ok: boolean;
  };
}
