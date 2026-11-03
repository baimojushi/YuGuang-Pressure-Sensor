// 过滤表情符号与特殊符号
// \p{Extended_Pictographic} 为 Unicode 标准属性，与 emoji-regex 等主流表情过滤插件内部使用的一致
// \p{Sc} 为 Unicode 货币符号属性（$、€、£、¥ 等）
export const stripSymbols = (value: string): string =>
  value
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\p{Sc}/gu, "")
    .replace(
      /[~!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`]|[\uFF01-\uFF5E]|[\u3000-\u303F]/g,
      ""
    );

// 自定义指令：过滤输入框中的表情符号与特殊符号
export const vFilterEmoji = {
  mounted(el: HTMLInputElement | HTMLTextAreaElement) {
    const onInput = () => {
      const cleaned = stripSymbols(el.value);
      if (cleaned !== el.value) {
        const pos = Math.min(
          el.selectionStart ?? cleaned.length,
          cleaned.length
        );
        el.value = cleaned;
        el.dispatchEvent(new Event("input"));
        try {
          el.setSelectionRange(pos, pos);
        } catch (e) {
          /* ignore */
        }
      }
    };
    el.addEventListener("input", onInput);
  }
};
