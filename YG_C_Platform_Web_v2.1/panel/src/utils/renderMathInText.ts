import katex from "katex";
import "katex/dist/katex.min.css";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderLatex(latex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(latex.trim(), {
      displayMode,
      throwOnError: false,
      strict: "ignore",
    });
  } catch {
    return escapeHtml(latex);
  }
}

const PLACEHOLDER_PREFIX = "\uE000MATH";
const PLACEHOLDER_SUFFIX = "\uE001";

/**
 * 将后端返回的 LaTeX（$...$、\(...\)、\[...\]）转为 KaTeX HTML，供 v-html 展示。
 */
export function renderMathInText(text: string): string {
  if (!text) return "";

  const stash: string[] = [];

  const stashRender = (latex: string, displayMode: boolean) => {
    const idx = stash.length;
    stash.push(renderLatex(latex, displayMode));
    return `${PLACEHOLDER_PREFIX}${idx}${PLACEHOLDER_SUFFIX}`;
  };

  let html = text;
  html = html.replace(/\\\[([\s\S]*?)\\\]/g, (_, latex: string) =>
    stashRender(latex, true),
  );
  html = html.replace(/\\\(([\s\S]*?)\\\)/g, (_, latex: string) =>
    stashRender(latex, false),
  );
  html = html.replace(/\$([^$\n]+?)\$/g, (_, latex: string) =>
    stashRender(latex, false),
  );

  html = escapeHtml(html);
  const placeholderRe = new RegExp(
    `${PLACEHOLDER_PREFIX}(\\d+)${PLACEHOLDER_SUFFIX}`,
    "g",
  );
  html = html.replace(placeholderRe, (_, idx: string) => stash[Number(idx)] ?? "");

  return html.replace(/\n/g, "<br>");
}
