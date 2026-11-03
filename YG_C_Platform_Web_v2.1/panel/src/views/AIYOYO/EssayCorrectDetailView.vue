<script setup lang="ts">
import {
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
} from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";
import pdfjsWorker from "pdfjs-dist/legacy/build/pdf.worker.min.js?url";
import { xj, initData } from "../../stores";
import { NavigationBar } from "xjiang-ui";
import { type CompositionListRow } from "@/utils/apis/aiLamp";
import { downloadEssay } from "@/utils/essayDownload";
import { resolvePdfUrlForViewer } from "@/utils/resolvePdfUrlForViewer";
import downloadIcon from "@/assets/images/ai-lamp/essay-detail-download-icon.svg";
import type { PDFDocumentProxy } from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const router = useRouter();
const { t } = useI18n();

const detail = ref<CompositionListRow | null>(null);

const pdfHostRef = ref<HTMLElement | null>(null);
const pdfLoading = ref(false);
/** PDF.js 失败时展示外链/浏览器打开提示（iframe 在多数 App/微信 WebView 内对 PDF 会白屏） */
const pdfFallbackUrl = ref("");

/** 离开页面后置 true，避免卸载后仍往 DOM 写或改 ref */
let pdfViewAborted = false;
/** 防止异步收尾或二次进入时旧任务改状态、清 DOM */
let pdfRenderEpoch = 0;
/** 成功渲染后持有的文档，仅在下次渲染或卸载时 destroy，避免刚画完就 destroy 带来的闪烁/竞态 */
let heldPdfDocument: PDFDocumentProxy | null = null;

async function destroyHeldPdfDocument() {
  const d = heldPdfDocument;
  heldPdfDocument = null;
  if (!d) return;
  try {
    await d.destroy();
  } catch {
    /* ignore */
  }
}

async function renderPdfToHost(originalReportUrl: string, host: HTMLElement) {
  const epoch = ++pdfRenderEpoch;
  const alive = () => !pdfViewAborted && epoch === pdfRenderEpoch;

  pdfFallbackUrl.value = "";
  pdfLoading.value = true;
  await destroyHeldPdfDocument();

  const fetchUrl = resolvePdfUrlForViewer(originalReportUrl);

  let pdf: PDFDocumentProxy | null = null;

  try {
    const loadingTask = pdfjsLib.getDocument({
      url: fetchUrl,
      withCredentials: false,
    });
    pdf = await loadingTask.promise;
    if (!alive()) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const hostWidth = Math.max(
      1,
      host.clientWidth || window.innerWidth || 375,
    );

    // 渲染时先在内存容器里绘制，首屏准备好再一次性替换 DOM，避免「闪一下又回加载中」
    // 这类闪烁通常来自二次 render 时开头清空 DOM + 重新置 loading。
    const nextPages = document.createElement("div");
    const fragment = document.createDocumentFragment();
    // 首屏之前写入 fragment；首屏挂载后改为直接写入 nextPages，保证后续页持续追加
    let appendTarget: ParentNode = fragment;

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      // 仅在 await 之后检查：卸载 / 新一次 render 会改 epoch，避免旧任务继续写 DOM
      if (!alive()) return;

      const baseViewport = page.getViewport({ scale: 1 });
      const cssScale = hostWidth / baseViewport.width;
      const viewport = page.getViewport({ scale: cssScale * dpr });

      const wrap = document.createElement("div");
      wrap.className = "pdf-page-wrap";

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) continue;

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width / dpr}px`;
      canvas.style.height = `${viewport.height / dpr}px`;

      wrap.appendChild(canvas);
      appendTarget.appendChild(wrap);

      await page.render({ canvasContext: ctx, viewport }).promise;
      if (!alive()) return;

      // 首屏即可读，不必等全部页；避免「加载层透明盖在已渲染 canvas 上」被误认为状态来回切
      if (pageNum === 1) {
        nextPages.appendChild(fragment);
        host.replaceChildren(nextPages);
        appendTarget = nextPages;
        if (pdfLoading.value) pdfLoading.value = false;
      }
    }

    if (alive() && pdfLoading.value) pdfLoading.value = false;

    if (alive()) {
      heldPdfDocument = pdf;
      pdf = null;
    }
  } catch {
    if (alive()) {
      pdfFallbackUrl.value = originalReportUrl;
      pdfLoading.value = false;
    }
  } finally {
    if (pdf) {
      try {
        await pdf.destroy();
      } catch {
        /* ignore */
      }
    }
  }
}

function onBack() {
  router.back();
}

async function onDownload() {
  const url = detail.value?.reportUrl;
  if (!url) return;
  await downloadEssay(url);
}

function openReportInBrowser() {
  const url = pdfFallbackUrl.value || detail.value?.reportUrl;
  if (url) window.open(url, "_blank", "noopener,noreferrer");
}

onMounted(async () => {
  pdfViewAborted = false;
  xj.hideNavigationBar();
  const row = history.state?.data as CompositionListRow | undefined;
  if (!row) return;
  detail.value = row;

  const url = row.reportUrl?.trim() ?? "";
  if (!url) {
    pdfLoading.value = false;
    return;
  }

  // 与首帧 DOM 同步进入加载态，避免先出现一帧无「加载中」再变 true
  pdfLoading.value = true;

  await nextTick();
  const host = pdfHostRef.value;
  if (!host) {
    pdfLoading.value = false;
    return;
  }

  await renderPdfToHost(url, host);
});

onBeforeUnmount(() => {
  pdfViewAborted = true;
  pdfRenderEpoch += 1;
  destroyHeldPdfDocument();
});
</script>

<template>
  <div style="position: absolute; top: 0; left: 0; right: 0; z-index: 1000;">
    <NavigationBar class="detail-nav" :left="[{ key: 'back', onClick: onBack }]"
      :statusbar-height="initData?.statusBarHeight || 24" background-color="transparent" />
  </div>
  <main v-if="detail" class="essay-detail-page" :style="{
    minHeight: `calc(100vh - ${(initData?.statusBarHeight || 24) + 44}px)`
  }">
    <section class="content-section">
      <div class="pdf-scroll">
        <div class="pdf-viewer" :class="{ 'pdf-viewer--loading': pdfLoading && !pdfFallbackUrl }">
          <div v-if="pdfFallbackUrl" class="pdf-fallback">
            <p class="pdf-fallback-text">
              {{ t("aiLamp.essay.pdfPreviewUnavailable") }}
            </p>
            <button type="button" class="open-browser-btn" @click="openReportInBrowser">
              {{ t("aiLamp.essay.openInBrowser") }}
            </button>
          </div>
          <div v-show="!pdfFallbackUrl" ref="pdfHostRef" class="pdf-pages-host" />
          <p v-if="pdfLoading" class="pdf-status">{{ t("aiLamp.essay.pdfLoading") }}</p>
        </div>
        <button type="button" class="download-btn" @click="onDownload">
          <img class="download-icon" :src="downloadIcon" alt="" />
          <span>{{ t("aiLamp.common.download") }}</span>
        </button>
      </div>
    </section>
  </main>
</template>

<style scoped lang="scss">
.essay-detail-page {
  background: #f7f8fc;
  overflow: hidden;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.content-section {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  margin-top: -1.7857rem;
  /* 25px */
  border-radius: 1.1429rem 1.1429rem 0 0;
  overflow: hidden;
  background: #f7f8fd;
}

.pdf-scroll {
  height: 100%;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.pdf-viewer {
  position: relative;
  min-height: 40vh;
  background: #ffffff;
}

.pdf-viewer--loading {
  min-height: 100vh;
}

.pdf-viewer--loading .pdf-status {
  position: absolute;
  inset: 0;
  margin: 0;
  padding: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  box-sizing: border-box;
}

.pdf-fallback {
  padding: 1.7143rem 1.1429rem 2rem;
  box-sizing: border-box;
}

.pdf-fallback-text {
  margin: 2rem 0 1.4286rem;
  font-size: 0.8571rem;
  line-height: 1.4286rem;
  color: #5c6470;
  text-align: center;
}

.open-browser-btn {
  display: block;
  width: 100%;
  max-width: 16rem;
  margin: 0 auto;
  padding: 0.8571rem 1rem;
  border: none;
  border-radius: 0.5714rem;
  background: #0c121f;
  color: #ffffff;
  font-size: 0.9286rem;
}

.pdf-pages-host {
  width: 100%;
}

.pdf-page-wrap {
  display: block;
  margin: 0 auto;
  max-width: 100%;
}

.pdf-page-wrap canvas {
  display: block;
  margin: 0 auto;
  max-width: 100%;
  height: auto;
}

.pdf-page-wrap+.pdf-page-wrap {
  margin-top: 0.5714rem;
}

.pdf-status {
  margin: 0;
  padding: 2rem 1rem;
  text-align: center;
  font-size: 0.8571rem;
  color: #5c6470;
}

.download-btn {
  margin: 0 auto;
  margin-top: 1rem;
  margin-bottom: calc(env(safe-area-inset-bottom, 0px) + 1.7857rem);
  width: 4.5714rem;
  height: 2.9286rem;
  /* 41px */
  border: none;
  background: transparent;
  color: #0c121f;
  font-size: 0.8571rem;
  /* 12px */
  line-height: 1.2143rem;
  /* 17px */
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.2857rem;
}

.download-icon {
  width: 1.4286rem;
  /* 20px */
  height: 1.4286rem;
  display: block;
}

.detail-nav {
  :deep(.navigationBar_icon) {
    color: #ffffff;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 9999px;
    padding: 0.3571rem;
    /* 5px */
    line-height: 1;
    background: rgba(0, 0, 0, 0.45);
  }

  :deep(.navigationBar_title) {
    color: #ffffff;
  }
}
</style>