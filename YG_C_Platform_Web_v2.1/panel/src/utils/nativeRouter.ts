import { xj } from "xjiang-sdk/api/app/XJIotApi";

export type NativeNavigatePayload = {
  action?: "goBack" | "navigate" | "replace" | "popToTop";
  name?: string;
  params?: unknown;
};

function rnWebViewActive(): boolean {
  return (
    typeof window !== "undefined" &&
    !!(window as unknown as { ReactNativeWebView?: { postMessage?: unknown } })
      .ReactNativeWebView?.postMessage
  );
}

function miniProgramActive(): boolean {
  return (
    typeof window !== "undefined" &&
    ((window as unknown as { __wxjs_environment?: string })
      .__wxjs_environment === "miniprogram" ||
      (typeof (window as any).__wxjs_environment === "undefined" &&
        /MicroMessenger/i.test(navigator.userAgent)))
  );
}

function postNavigateToRn(payload: NativeNavigatePayload) {
  xj.msgToNative("navigateTo", payload);
}

function webSocketOpen(weappApi?: { ws?: { ws?: { readyState: number } } }) {
  return weappApi?.ws?.ws?.readyState === WebSocket.OPEN;
}

/**
 * 等待 WebSocket 连接成功
 */
function waitForWebSocket(
  weappApi: { ws?: { ws?: { readyState: number } } },
  timeout = 5000
): Promise<void> {
  return new Promise(resolve => {
    const checkInterval = 100;
    let elapsed = 0;

    const check = () => {
      if (webSocketOpen(weappApi)) {
        resolve();
        return;
      }
      if (elapsed >= timeout) {
        console.warn("[nativeRouter] WebSocket connection timeout");
        resolve(); // 即使超时也继续尝试发送
        return;
      }
      elapsed += checkInterval;
      setTimeout(check, checkInterval);
    };

    check();
  });
}

/**
 * 小程序内路由（与 web-view 宿主约定后在此实现，例如 JSSDK / postMessage）
 */
async function postNavigateToMiniProgram(_payload: NativeNavigatePayload) {
  const weappApi = (
    xj as {
      _weappApi?: {
        webSocketSend?: (method: string, data?: unknown) => void;
        initWS?: () => void;
        ws?: { ws?: { readyState: number } };
      };
    }
  )._weappApi;

  if (!weappApi?.webSocketSend) {
    return;
  }

  if (!webSocketOpen(weappApi) && weappApi?.initWS) {
    console.log(
      "[nativeRouter] WebSocket not connected, attempting reconnect..."
    );
    weappApi.initWS();
    await waitForWebSocket(weappApi);
  }

  if (webSocketOpen(weappApi)) {
    weappApi.webSocketSend("navigateTo", _payload);
    return;
  }

  setTimeout(() => {
    const latestWeappApi = (
      xj as {
        _weappApi?: {
          webSocketSend?: (method: string, data?: unknown) => void;
          ws?: { ws?: { readyState: number } };
        };
      }
    )._weappApi;
    if (webSocketOpen(latestWeappApi)) {
      latestWeappApi?.webSocketSend?.("navigateTo", _payload);
    }
  }, 300);
}

function postNavigateTo(payload: NativeNavigatePayload) {
  if (rnWebViewActive()) {
    postNavigateToRn(payload);
    return;
  }
  if (miniProgramActive()) {
    postNavigateToMiniProgram(payload);
    return;
  }
}

/**
 * 通知宿主处理导航：RN WebView 走 `navigateTo`；小程序走预留口子（待实现）
 */
export const nativeRouter = {
  isRnWebView(): boolean {
    return rnWebViewActive();
  },

  isMiniProgram(): boolean {
    return miniProgramActive();
  },

  goBack() {
    postNavigateTo({ action: "goBack" });
  },

  navigate(name: string, params?: unknown) {
    postNavigateTo(
      params !== undefined
        ? { action: "navigate", name, params }
        : { action: "navigate", name }
    );
  },

  replace(name: string, params?: unknown) {
    postNavigateTo(
      params !== undefined
        ? { action: "replace", name, params }
        : { action: "replace", name }
    );
  },

  popToTop() {
    postNavigateTo({ action: "popToTop" });
  }
};
