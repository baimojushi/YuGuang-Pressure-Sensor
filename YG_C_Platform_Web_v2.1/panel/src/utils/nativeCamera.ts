import { xj } from "xjiang-sdk/api/app/XJIotApi";

/**
 * 原生拍照桥（小程序宿主）
 * --------------------------------------------------------------------------
 * 背景：浏览器 <input type="file"> 调起系统相机时，会把 H5 WebView 切到后台，
 * 部分机型（如小米 MIUI/HyperOS）会激进回收后台 WebView 进程，导致"点进拍摄就闪退"。
 * 解决：改走微信小程序宿主的原生拍照（wx.chooseMedia），拍照在小程序原生层完成，
 * 不切后台、不解码大图，从根上规避 WebView 被杀 / OOM。
 *
 * 协议（与小程序宿主对齐）：
 *   H5 → 宿主（WebSocket）      : method = "openCamera"
 *   宿主 → H5（WebSocket 推送）: method = "openCamera_reply"
 *       成功   { ok: true,  dataUrl: "data:image/jpeg;base64,..." }
 *       失败/取消 { ok: false, error: "cancel" | "no_image" | 其他 }
 *
 * 分发说明：WeappApi.onMessage switch 显式处理 openCamera_reply，转发到
 * xj._onOpenCameraReply(params)，因此 H5 只需覆盖 xj._onOpenCameraReply 即可。
 * --------------------------------------------------------------------------
 */

// 拍照超时：35s，小于宿主 45s 定时器，便于日志区分是哪侧触发的超时
const NATIVE_CAMERA_TIMEOUT = 35000;
let onChooseInstalled = false;
let pendingWaiter: {
  resolve: (dataUrl: string) => void;
  reject: (e: Error) => void;
} | null = null;
let timeoutTimer: number | null = null;

/** 统一清理全局等待状态，杜绝脏状态锁死 */
function clearPending(): void {
  if (timeoutTimer) {
    clearTimeout(timeoutTimer);
    timeoutTimer = null;
  }
  pendingWaiter = null;
}

/** 是否运行在微信小程序 web-view 环境 */
export function isMiniProgramEnv(): boolean {
  const weappApi = (xj as any)._weappApi;
  return !!weappApi?.webSocketSend;
}

/** 注册小程序宿主回传回调（一次性，复用同一份 xj 回调） */
function ensureOnChooseInstalled() {
  if (onChooseInstalled) return;
  onChooseInstalled = true;
  (xj as { _onOpenCameraReply: (params: any) => void })._onOpenCameraReply = (
    params: any
  ) => {
    console.log(
      "[nativeCamera] 收到 openCamera_reply 回包",
      params?.ok,
      params?.error
    );
    const waiter = pendingWaiter;
    // 无论成功/失败/取消，都统一清理定时器和 waiter，杜绝脏状态
    clearPending();
    if (!waiter) {
      console.warn(
        "[nativeCamera] 收到回包但无等待中的请求（可能已超时或被拒绝）"
      );
      return;
    }
    // 取消 / 失败
    if (!params || params.ok !== true) {
      const error =
        params?.error === "cancel"
          ? "已取消拍照"
          : params?.error === "no_image"
            ? "未获取到图片"
            : "拍照失败";
      waiter.reject(new Error(error));
      return;
    }
    // 成功：取 dataUrl
    if (!params.dataUrl) {
      waiter.reject(new Error("拍照结果缺少图片数据"));
      return;
    }
    waiter.resolve(params.dataUrl);
  };
}

/**
 * 调起小程序宿主原生拍照，返回图片 dataURL。
 * 非小程序环境或桥未就绪时 reject（调用方应回退到浏览器 <input type="file">）。
 * 并发控制：已有拍照请求进行中时直接 reject，不强行清除正在执行的请求。
 */
export function openNativeCamera(): Promise<string> {
  return new Promise((resolve, reject) => {
    ensureOnChooseInstalled();

    // 环境检查
    if (!isMiniProgramEnv()) {
      console.warn("[nativeCamera] 非小程序环境，拒绝原生拍照");
      reject(new Error("当前环境不支持原生拍照"));
      return;
    }

    // 并发控制：已有请求进行中，直接拒绝，不清理旧请求
    if (pendingWaiter) {
      reject(new Error("已有拍照请求进行中"));
      return;
    }

    const weappApi = (xj as any)._weappApi;
    pendingWaiter = { resolve, reject };

    // 超时兜底：35s 未收到回包则自动拒绝，清理状态
    timeoutTimer = window.setTimeout(() => {
      const waiter = pendingWaiter;
      clearPending();
      console.warn("[nativeCamera] 拍照超时（35s），H5 侧定时器触发");
      waiter?.reject(new Error("拍照超时"));
    }, NATIVE_CAMERA_TIMEOUT);

    // 发送 openCamera 到宿主
    try {
      console.log("[nativeCamera] 发送 openCamera 消息到宿主");
      weappApi.webSocketSend("openCamera");
    } catch (err) {
      // 发送失败，立即清理，避免锁死
      console.error("[nativeCamera] webSocketSend 发送异常", err);
      clearPending();
      reject(new Error("发送拍照请求失败"));
    }
  });
}
