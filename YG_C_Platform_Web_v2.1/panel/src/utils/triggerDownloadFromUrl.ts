import { resolveDownloadFileName } from "./resolveDownloadFileName";

/**
 * 尽量直接保存：先 fetch 成 Blob 再触发下载（需 OSS 对当前页 Origin 放行 CORS）。
 * 否则回退为新开标签打开链接（是否出现「下载」由服务端 Content-Disposition / 浏览器决定）。
 */
export async function triggerDownloadFromUrl(
  url: string,
  titleHint?: string | null,
): Promise<void> {
  const trimmed = url.trim();
  if (!trimmed) return;

  const name = resolveDownloadFileName(trimmed, titleHint);

  try {
    const res = await fetch(trimmed, { mode: "cors", credentials: "omit" });
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = name;
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch {
    window.open(trimmed, "_blank", "noopener,noreferrer");
  }
}
