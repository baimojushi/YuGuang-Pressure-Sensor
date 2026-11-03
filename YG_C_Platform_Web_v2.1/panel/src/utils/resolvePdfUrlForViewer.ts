/**
 * 本地 dev：把 OSS 上的 PDF 绝对地址改走 Vite `server.proxy` 前缀，便于 PDF.js 同源 fetch。
 * 生产或未配置环境变量时原样返回。
 */
export function resolvePdfUrlForViewer(raw: string): string {
  const u = raw.trim();
  if (!u || !import.meta.env.DEV) return u;

  const proxy = (import.meta.env.VITE_DEV_PDF_OSS_PROXY as string | undefined)?.replace(
    /\/+$/,
    "",
  );
  const ossOrigin = (import.meta.env.VITE_DEV_PDF_OSS_ORIGIN as string | undefined)?.replace(
    /\/+$/,
    "",
  );
  if (!proxy || !ossOrigin) return u;

  try {
    const parsed = new URL(u);
    const allowedOrigin = new URL(ossOrigin).origin;
    if (parsed.origin !== allowedOrigin) return u;
    return `${proxy}${parsed.pathname}${parsed.search}`;
  } catch {
    return u;
  }
}
