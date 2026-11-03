/**
 * 拼接 IoT 接口地址。
 * 本地 dev：IoT 域名未对 localhost 配置 CORS，改走 Vite `server.proxy` 前缀同源转发（见 vite.config）。
 * 其余环境直连 `VITE_APP_IOT_API`。
 */
export function resolveIotUrl(path: string): string {
  const origin = (
    (import.meta.env.VITE_APP_IOT_API as string | undefined) || ""
  ).replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (import.meta.env.DEV) {
    const proxy = (
      (import.meta.env.VITE_DEV_IOT_API_PROXY as string | undefined) ||
      "/dev-proxy-iot"
    ).replace(/\/+$/, "");
    return `${window.location.origin}${proxy}${normalizedPath}`;
  }
  return `${origin}${normalizedPath}`;
}
