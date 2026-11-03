import axios, {
  AxiosHeaders,
  type AxiosError,
  type AxiosRequestConfig
} from "axios";
import { toast } from "xjiang-ui";
import {
  getNativeApiRequestHeaders,
  fetchMockApiRequestHeaders,
  getStoredAgentToken,
  getStoredIotToken
} from "./nativeApiRequestHeaders";
import { nativeRouter } from "./nativeRouter";

async function applyNativeHeaders(config: AxiosRequestConfig) {
  if (!nativeRouter.isRnWebView() && !nativeRouter.isMiniProgram()) {
    return;
  }
  if (!config.headers) {
    config.headers = new AxiosHeaders();
  }
  const headers = await getNativeApiRequestHeaders();
  Object.assign(config.headers as Record<string, unknown>, headers);
}

/** 从后端 JSON 壳（如 `{ msg, message }`）取可读错误文案 */
function resolveBodyMessage(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const o = data as { msg?: unknown; message?: unknown };
  if (typeof o.msg === "string" && o.msg.trim()) return o.msg.trim();
  if (typeof o.message === "string" && o.message.trim())
    return o.message.trim();
  return undefined;
}

function isEnvelopeOkFalse(data: unknown): boolean {
  return (
    !!data &&
    typeof data === "object" &&
    "ok" in data &&
    (data as { ok: unknown }).ok === false
  );
}

function resolveAxiosErrorMessage(error: AxiosError): string {
  if (error.code === "ECONNABORTED" || error.message?.includes("timeout")) {
    return "请求超时，请稍后重试";
  }
  if (!error.response) {
    return "网络异常，请稍后重试";
  }
  const fromBody = resolveBodyMessage(error.response.data);
  if (fromBody) return fromBody;
  const { status, statusText } = error.response;
  return statusText || `请求失败 (${status})`;
}

// 创建 axios 实例
const service = axios.create({
  baseURL: import.meta.env.VITE_APP_H5_API, // url = base url + request url
  // baseURL: import.meta.env.VITE_APP_H5_API + '/app', // url = base url + request url
  timeout: 20000, // 请求超时时间 20s
  showErrorToast: true
});
const isDebug = import.meta.env?.MODE === "debug"; // 是否开启调试模式
// 请求拦截器（async：等待 Native 回传 headers 后再发请求）
service.interceptors.request.use(
  async config => {
    await applyNativeHeaders(config);
    if (isDebug) {
      const mockHeaders = await fetchMockApiRequestHeaders();
      Object.assign(config.headers as Record<string, unknown>, mockHeaders);
    }

    const headers = config.headers as Record<string, unknown>;
    if (headers) {
      // 无原生/mock 注入 token 时，使用登录后本地保存的 token
      if (!headers["Agent-Authorization"]) {
        const agentToken = getStoredAgentToken();
        if (agentToken) headers["Agent-Authorization"] = agentToken;
      }
      if (!headers["Authorization"]) {
        const iotToken = getStoredIotToken();
        if (iotToken) headers["Authorization"] = iotToken;
      }
    }

    return config;
  },
  error => {
    // 处理请求错误
    console.log(JSON.stringify(error)); // for debug
    return Promise.reject(error);
  }
);

// 响应拦截器
service.interceptors.response.use(
  response => {
    const cfg = response.config;
    const data = response.data as unknown;
    // HTTP 成功但业务壳标明失败（如 `{ ok: false, msg: "..." }`）仍走成功分支，需单独 toast
    // if (isEnvelopeOkFalse(data) && cfg && cfg.showErrorToast !== false) {
    //   toast({ text: resolveBodyMessage(data) || "请求失败" });
    // }
    return response.data;
  },
  (error: AxiosError) => {
    // 处理响应错误
    console.log("err" + error); // for debug
    const response = error.response;
    if (response) {
      switch (response.status) {
        case 401:
          // todo 跳转登录 rn/weapp
          break;
      }
    }
    const cfg = error.config;
    if (cfg && cfg.showErrorToast !== false) {
      // toast({ text: resolveAxiosErrorMessage(error) });
    }
    return Promise.reject(error);
  }
);

export default service;

declare module "axios" {
  interface AxiosRequestConfig {
    /** 请求失败时是否 toast；默认 true，单请求传 `false` 可关闭 */
    showErrorToast?: boolean;
  }
}
