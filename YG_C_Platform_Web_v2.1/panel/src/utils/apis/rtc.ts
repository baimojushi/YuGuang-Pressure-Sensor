import request from "@/utils/request";
import requestAgent from "../requestAgent";

/** 查询设备对话记录的请求参数 */
export interface GetConvoListParams {
  /** 设备ID（必填） */
  did: number;
  /** 起始ID（查询大于此ID的记录） */
  beforeId?: number | null;
  /** 结束ID（查询小于此ID的记录） */
  afterId?: number | null;
  /** 每页条数（即 pageSize） */
  limit?: number;
  startTime?: number;
  searchAfter?: [number, string];
  endTime?: number;
}
export interface DeleteConvoListParams {
  /** 设备ID（必填） */
  did: number;
}

/** 对话记录项 */
export interface ConvoRecord {
  /** 记录ID */
  id: number;
  /** 对话内容 */
  content: string;
  emotion?: string;
  /** 内容类型，固定为 "text" */
  content_type: string;
  /** 角色："user"（role=1）或 "assistant"（role≠1） */
  role: "user" | "assistant";
  /** 更新时间（毫秒级 epoch） */
  updated_at: number;
  /** 创建时间（毫秒级 epoch） */
  created_at: number;
}

/** 查询设备对话记录的响应数据 */
export interface ConvoListResult {
  /** 总记录数 */
  total: number;
  /** 每页大小 */
  size: number;
  /** 总页数 */
  pages: number;
  /** 当前页码 */
  current: number;
  /** 对话记录列表 */
  records: ConvoRecord[];
  nextCursor: [number, string];
  emotion?: string;
}

/** 查询设备对话记录的响应结构 */
export interface GetConvoListApiEnvelope {
  status: number;
  msg: string;
  timestamp: number;
  result?: ConvoListResult;
}
export interface DeleteConvoListApiEnvelope {
  status: number;
  msg: string;
  timestamp: number;
  result?: {
    /** 清空的记录数 */
    content: number;
  };
}

/**
 * 查询设备对话记录
 * POST /ws/chatRecord/getConvoList
 */
export async function getConvoList(params: GetConvoListParams) {
  return (await requestAgent.post("app/ws/chatRecord/getConvoList", {
    ...params
  })) as GetConvoListApiEnvelope;
}

/**
 * 清空设备对话记录
 * POST /ws/chatRecord/deleteByDid
 */
export async function clearConvoList(params: DeleteConvoListParams) {
  return (await requestAgent.post("app/ws/chatRecord/deleteByDid", {
    ...params
  })) as DeleteConvoListApiEnvelope;
}
