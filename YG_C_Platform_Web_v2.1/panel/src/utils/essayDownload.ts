import { loading } from "xjiang-ui";
import { xj } from "xjiang-sdk/api/app/XJIotApi";
import { nativeRouter } from "./nativeRouter";
import { resolveDownloadFileName } from "./resolveDownloadFileName";
import { triggerDownloadFromUrl } from "./triggerDownloadFromUrl";

/** 与 RN `onDownloadRemoteFile` 回传一致 */
export type HostResult = {
  ok: boolean;
  reason?: string;
  statusCode?: number;
  localPath?: string;
};

export type WeappDl = (o: {
  url: string;
  fileName?: string;
}) => Promise<HostResult> | HostResult;

let weappDl: WeappDl | null = null;

/** 小程序宿主实现下载后注入；传 `null` 清除 */
export function setWeappDl(handler: WeappDl | null) {
  weappDl = handler;
}

let listenerInited = false;
let pending: ((r: HostResult) => void) | null = null;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;
let mutex: Promise<void> = Promise.resolve();

function ensureListener() {
  if (listenerInited) return;
  listenerInited = true;
  (
    xj as { onDownloadRemoteFile?: (p: HostResult) => void }
  ).onDownloadRemoteFile = (params: HostResult) => {
    if (!pending) return;
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      pendingTimer = null;
    }
    const done = pending;
    pending = null;
    if (params && typeof params === "object" && "ok" in params) {
      done(params);
    } else {
      done({ ok: false, reason: "invalid_response" });
    }
  };
}

function sendHostDl(
  url: string,
  fileName: string | undefined,
  timeoutMs: number
): Promise<HostResult> {
  ensureListener();
  return new Promise(resolve => {
    pending = resolve;
    pendingTimer = setTimeout(() => {
      pendingTimer = null;
      if (!pending) return;
      const r = pending;
      pending = null;
      r({ ok: false, reason: "timeout" });
    }, timeoutMs);
    xj.msgToNative(
      "downloadRemoteFile",
      fileName != null && fileName !== "" ? { url, fileName } : { url }
    );
  });
}

function withMutex<T>(fn: () => Promise<T>): Promise<T> {
  const run = mutex.then(fn);
  mutex = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

/**
 * 走宿主 `downloadRemoteFile`（RN postMessage；小程序可先 `setWeappDl`，否则 WS 等 `onDownloadRemoteFile`）。
 * 非嵌入环境返回 `null`。
 */
export async function tryHostDl(
  url: string,
  fileName?: string,
  options?: { timeoutMs?: number }
): Promise<HostResult | null> {
  const u = url.trim();
  if (!u) return null;

  const timeoutMs = options?.timeoutMs ?? 120_000;

  if (nativeRouter.isMiniProgram() && weappDl) {
    return Promise.resolve(weappDl({ url: u, fileName }));
  }

  if (!nativeRouter.isRnWebView() && !nativeRouter.isMiniProgram()) {
    return null;
  }

  const t =
    nativeRouter.isMiniProgram() && !weappDl
      ? Math.min(timeoutMs, 12_000)
      : timeoutMs;

  return withMutex(() => sendHostDl(u, fileName, t));
}

/** 作文报告：优先宿主下载，失败再走 H5 */
export async function downloadEssay(
  url: string,
  title?: string | null
): Promise<void> {
  const u = url.trim();
  if (!u) return;

  const name = resolveDownloadFileName(u, title);
  const load = loading({ type: "loading" });
  try {
    try {
      const r = await tryHostDl(u, name);
      if (r?.ok === true) return;
    } catch {
      /* fallback */
    }

    await triggerDownloadFromUrl(u, title);
  } finally {
    load.close();
  }
}
