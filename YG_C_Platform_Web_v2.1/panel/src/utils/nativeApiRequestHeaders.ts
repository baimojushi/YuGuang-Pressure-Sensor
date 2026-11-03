import { xj } from "xjiang-sdk/api/app/XJIotApi";
import { nativeRouter } from "./nativeRouter";

export type NativeApiRequestHeaders = Record<string, string>;

/** 登录获取的 Agent token（短信验证码登录），对应 Agent-Authorization 头 */
const AGENT_TOKEN_KEY = "agent_token";
/** 用 Agent token 换取到的 IoT token，对应 Authorization 头 */
const IOT_TOKEN_KEY = "iot_token";

/** 读取本地保存的 Agent token */
export function getStoredAgentToken(): string {
  try {
    return localStorage.getItem(AGENT_TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

/** 保存 Agent token */
export function setStoredAgentToken(token: string) {
  try {
    localStorage.setItem(AGENT_TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

/** 读取本地保存的 IoT token */
export function getStoredIotToken(): string {
  try {
    return localStorage.getItem(IOT_TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

/** 保存 IoT token */
export function setStoredIotToken(token: string) {
  try {
    localStorage.setItem(IOT_TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

/** 清除本地登录 token */
export function clearStoredToken() {
  try {
    localStorage.removeItem(AGENT_TOKEN_KEY);
    localStorage.removeItem(IOT_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

let getReqHeadersInstalled = false;
let waiters: Array<(headers: NativeApiRequestHeaders) => void> = [];
const REQUEST_HEADERS_TIMEOUT = 8000;
let cachedHeaders: NativeApiRequestHeaders = {};
let firstFetchPromise: Promise<NativeApiRequestHeaders> | null = null;

function cloneHeaders(headers: NativeApiRequestHeaders) {
  return { ...headers };
}

function hasHeaders(headers: NativeApiRequestHeaders) {
  return Object.keys(headers).length > 0;
}

function updateCachedHeaders(headers: NativeApiRequestHeaders) {
  if (hasHeaders(headers)) {
    cachedHeaders = cloneHeaders(headers);
  }
}

function flushWaiters(headers: NativeApiRequestHeaders) {
  updateCachedHeaders(headers);
  const batch = waiters;
  waiters = [];
  for (const resolve of batch) {
    resolve(cloneHeaders(headers));
  }
}

function resolveWithTimeout() {
  return new Promise<NativeApiRequestHeaders>(resolve => {
    let settled = false;
    const finish = (headers: NativeApiRequestHeaders) => {
      if (settled) return;
      settled = true;
      resolve(headers);
    };

    const timer = window.setTimeout(() => {
      finish({});
    }, REQUEST_HEADERS_TIMEOUT);

    waiters.push(headers => {
      window.clearTimeout(timer);
      finish(headers);
    });
  });
}

function getCachedHeaders() {
  return cloneHeaders(cachedHeaders);
}

function ensureGetReqHeadersOnXj() {
  if (getReqHeadersInstalled) return;
  getReqHeadersInstalled = true;
  (
    xj as { getReqHeaders: (params: NativeApiRequestHeaders) => void }
  ).getReqHeaders = (params: NativeApiRequestHeaders) => {
    flushWaiters({ ...params });
  };
}

/**
 * RN WebView：经 `xj.msgToNative('getReqHeaders')` 与 Native 回传的 `getReqHeaders` 合并头。
 * 每次调用都向 Native 拉取最新头（不做内存缓存）。
 */
export async function fetchRnNativeApiRequestHeaders(): Promise<NativeApiRequestHeaders> {
  ensureGetReqHeadersOnXj();
  const requestPromise = resolveWithTimeout();
  if (waiters.length === 1) {
    xj.msgToNative("getReqHeaders");
  }
  return requestPromise;
}

/**
 * 小程序 web-view：通过 WeappApi 实例的 WebSocket 向小程序宿主请求 headers。
 * 注意：不能走 xj.msgToNative，因为小程序路径下 XJIotApi 的 ws 未初始化，
 * 消息会卡在 wsQueue 里。必须走 WeappApi 的 webSocketSend。
 * 小程序宿主收到后回传 `{ method: "getReqHeaders", params: {...} }`，
 * 由 WeappApi.onMessage 分发到 xj.getReqHeaders 完成 Promise resolve。
 */
export async function fetchWeappNativeApiRequestHeaders(): Promise<NativeApiRequestHeaders> {
  ensureGetReqHeadersOnXj();
  const requestPromise = resolveWithTimeout();
  if (waiters.length === 1) {
    const weappApi = (xj as any)._weappApi;
    if (weappApi?.webSocketSend) {
      weappApi.webSocketSend("getReqHeaders");
    } else {
      flushWaiters({});
    }
  }
  return requestPromise;
}

async function refreshNativeHeadersByEnv() {
  const headers =
    (window as any).__wxjs_environment === "miniprogram" ||
    (typeof (window as any).__wxjs_environment === "undefined" &&
      /MicroMessenger/i.test(navigator.userAgent))
      ? await fetchWeappNativeApiRequestHeaders()
      : await fetchRnNativeApiRequestHeaders();
  if (hasHeaders(headers)) {
    updateCachedHeaders(headers);
    return cloneHeaders(headers);
  }
  return getCachedHeaders();
}

export async function getNativeApiRequestHeaders() {
  const headers = getCachedHeaders();
  if (hasHeaders(headers)) {
    return headers;
  }
  if (!firstFetchPromise) {
    firstFetchPromise = refreshNativeHeadersByEnv().finally(() => {
      firstFetchPromise = null;
    });
  }
  return firstFetchPromise;
}
export async function getToken() {
  const isDebug = import.meta.env?.MODE === "debug"; // 是否开启调试模式
  if (isDebug) {
    const headers = await fetchMockApiRequestHeaders();
    return headers["Agent-Authorization"] || getStoredAgentToken();
  }
  const headers = await getNativeApiRequestHeaders();
  return headers["Agent-Authorization"] || getStoredAgentToken();
}

/**
 * 解析当前可用的 Agent token（短信登录 token）：
 * 原生/小程序注入的 header 优先，其次为本地登录保存的 token（debug 下 mock 优先）。
 * 无 token 时返回空串，路由守卫据此跳转到登录页。
 */
export async function resolveAgentToken(): Promise<string> {
  const isDebug = import.meta.env?.MODE === "debug"; // 是否开启调试模式
  if (isDebug) {
    const headers = await fetchMockApiRequestHeaders();
    const token = headers["Agent-Authorization"] || headers["Authorization"];
    return token || getStoredAgentToken();
  }
  if (nativeRouter.isRnWebView() || nativeRouter.isMiniProgram()) {
    const headers = await getNativeApiRequestHeaders();
    if (headers["Agent-Authorization"]) {
      return headers["Agent-Authorization"];
    }
  }
  return getStoredAgentToken();
}
/**
 * 开发环境 mock headers
 * 优先级：VITE_MOCK_HEADERS（JSON）> VITE_MOCK_TOKEN（自动生成 Authorization）
 */
export async function fetchMockApiRequestHeaders(): Promise<NativeApiRequestHeaders> {
  const mockHeadersJson = import.meta.env.VITE_MOCK_HEADERS;
  if (mockHeadersJson) {
    try {
      return JSON.parse(mockHeadersJson);
    } catch {
      console.warn(
        "[MockHeaders] VITE_MOCK_HEADERS 解析失败，回退到 VITE_MOCK_TOKEN"
      );
    }
  }

  const mockToken = import.meta.env.VITE_MOCK_TOKEN;
  if (mockToken) {
    return { Authorization: `Bearer ${mockToken}` };
  }

  return {};
}
