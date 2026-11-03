/**
 * 后端 OSS 图片常为 http；页面在 HTTPS / 安全上下文中会被混合内容策略拦截。
 * 本地 dev（http://localhost）保持原协议；线上 WebView 升级为 https 并规整路径中的多余斜杠。
 */
export function resolveRemoteImageUrl(raw: string | undefined | null): string {
  const u = raw == null ? "" : String(raw).trim();
  if (!u) return "";

  try {
    const parsed = new URL(u);
    if (
      typeof window !== "undefined" &&
      window.isSecureContext &&
      parsed.protocol === "http:"
    ) {
      parsed.protocol = "https:";
    }
    parsed.pathname = parsed.pathname.replace(/\/{2,}/g, "/");
    return parsed.toString();
  } catch {
    return u;
  }
}
