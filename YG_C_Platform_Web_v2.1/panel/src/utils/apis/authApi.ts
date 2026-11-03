import requestAgent from "@/utils/requestAgent";
import request from "@/utils/request";
import { resolveIotUrl } from "@/utils/resolveIotUrl";
import type { UserInfo } from "./aiAlarmApi";

/** Agent 接口通用响应结构 */
export interface ApiRequestResponse<T> {
  version?: number;
  status?: number;
  msg?: string;
  timestamp?: number;
  ok?: boolean;
  result?: T;
}

/**
 * App获取新短信验证码
 */
export async function getNewSmsCode(params: {
  mobile: string;
  loginType: number;
}) {
  return (await requestAgent.post("app/api/auth/sendCaptcha", {
    ...params
  })) as ApiRequestResponse<void>;
}

/**
 * Agent登录接口（短信验证码）
 * 返回的 tokenValue 放入 Agent-Authorization 头
 */
export async function loginByCode(params: { mobile: string; captcha: string }) {
  return (await requestAgent.post("app/api/auth/login", {
    loginType: 2,
    ...params
  })) as ApiRequestResponse<{
    content: {
      tokenValue: string;
      user: UserInfo;
    };
  }>;
}

/**
 * 用 Agent token 换取 IoT 用户 token
 * 请求头需携带 Agent-Authorization，返回的 token 放入 Authorization 头
 */
export async function iotLogin(params: { token: string }) {
  return (await request.post(resolveIotUrl("/authserver/third/auth/login"), {
    ...params
  })) as ApiRequestResponse<{
    token: string;
    user: UserInfo;
  }>;
}
