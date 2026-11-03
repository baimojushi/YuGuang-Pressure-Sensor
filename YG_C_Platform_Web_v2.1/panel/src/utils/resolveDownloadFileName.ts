const INVALID = /[/\\?%*:|"<>]/g;
const MAX_LEN = 200;

function hasExtension(name: string): boolean {
  return /\.[a-z0-9]{1,12}$/i.test(name);
}

/** URL 路径最后一段（尽量 decode）；失败时从字符串尾部取一段 */
function lastPathSegment(urlStr: string): string {
  const strip = urlStr.split("#")[0].split("?")[0];
  try {
    const u = new URL(
      urlStr,
      typeof window !== "undefined" && window.location?.href
        ? window.location.href
        : undefined,
    );
    const raw = u.pathname.split("/").filter(Boolean).pop() ?? "";
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  } catch {
    const m = strip.match(/([^/]+)$/);
    const raw = m?.[1] ?? "";
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
}

function extensionFrom(filename: string): string {
  const m = filename.match(/(\.[a-z0-9]{1,12})$/i);
  return m?.[1] ?? "";
}

function sanitizeFilename(s: string): string {
  return s
    .replace(INVALID, "_")
    .trim()
    .replace(/^\.+$/, "")
    .slice(0, MAX_LEN);
}

/**
 * 下载用文件名：优先 `title`；无扩展名时从 URL 路径补扩展名；无 `title` 时用 URL 最后一段。
 * 不写死 `.pdf`，便于以后 zip 等类型。
 */
export function resolveDownloadFileName(
  url: string,
  title?: string | null,
): string {
  const u = url.trim();
  const urlSeg = lastPathSegment(u);
  const extFromUrl = extensionFrom(urlSeg);

  const rawTitle = String(title ?? "").trim();
  if (rawTitle) {
    const base = sanitizeFilename(rawTitle);
    if (!base) {
      const fromUrl = sanitizeFilename(urlSeg);
      return fromUrl || "download";
    }
    if (hasExtension(base)) return base;
    if (extFromUrl) return `${base}${extFromUrl}`;
    return base;
  }

  const fromUrl = sanitizeFilename(urlSeg);
  return fromUrl || "download";
}
