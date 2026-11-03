<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { xj, initData } from "../../stores";
import { NavigationBar, loading } from "xjiang-ui";
import {
  fetchPhotoSearchDetail,
  type PhotoSearchDetailData
} from "@/utils/apis/aiLamp";
import { renderMathInText } from "@/utils/renderMathInText";
import { resolveRemoteImageUrl } from "@/utils/resolveRemoteImageUrl";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const detail = ref<PhotoSearchDetailData | null>(null);

const heroImageScrollRef = ref<HTMLElement | null>(null);
const heroImageRef = ref<HTMLImageElement | null>(null);
const contentCardRef = ref<HTMLElement | null>(null);

/** 与下方卡片已同步过的题号，避免重复滚动图片 */
let lastCardSyncQuestionIndex = -1;

let contentScrollRaf = 0;
let boundCardEl: HTMLElement | null = null;

/** 接口 coordinates：原图上的题目框 left,top,right,bottom（逗号分隔，像素） */
function parseImageBBox(raw: string | undefined | null) {
  if (raw == null || !String(raw).trim()) return null;
  const parts = String(raw)
    .split(",")
    .map(s => Number(s.trim()));
  if (parts.length !== 4 || parts.some(n => !Number.isFinite(n))) return null;
  const [a, b, c, d] = parts;
  const left = Math.min(a, c);
  const right = Math.max(a, c);
  const top = Math.min(b, d);
  const bottom = Math.max(b, d);
  return { left, top, right, bottom };
}

/** 下方卡片内，与视口竖直方向重叠面积最大的题块下标；滑到底部时固定为最后一题（避免末题较矮抢不到最大重叠） */
function pickActiveQuestionIndexFromCard(): number {
  const card = contentCardRef.value;
  if (!card) return 0;
  const sets = card.querySelectorAll<HTMLElement>(".question-set");
  if (!sets.length) return 0;

  const scrollRange = card.scrollHeight - card.clientHeight;
  const remaining = scrollRange - card.scrollTop;
  const bottomSlackPx = 96;
  if (scrollRange > 8 && remaining <= bottomSlackPx) {
    return sets.length - 1;
  }

  const cardRect = card.getBoundingClientRect();
  const vt = cardRect.top;
  const vb = cardRect.bottom;
  let bestIdx = 0;
  let maxOverlap = -1;
  sets.forEach((el, i) => {
    const r = el.getBoundingClientRect();
    const overlap = Math.min(r.bottom, vb) - Math.max(r.top, vt);
    if (overlap > maxOverlap) {
      maxOverlap = overlap;
      bestIdx = i;
    }
  });
  return bestIdx;
}

function bboxVisibleInHeroScroll(
  scrollEl: HTMLElement,
  img: HTMLImageElement,
  topNat: number,
  bottomNat: number,
  padPx: number
) {
  if (!img.naturalWidth || !img.naturalHeight) return true;
  const scale = img.clientWidth / img.naturalWidth;
  const topPx = topNat * scale;
  const bottomPx = bottomNat * scale;
  const st = scrollEl.scrollTop;
  const vh = scrollEl.clientHeight;
  return topPx >= st - padPx && bottomPx <= st + vh + padPx;
}

function syncHeroScrollToQuestion(index: number) {
  const scrollEl = heroImageScrollRef.value;
  const img = heroImageRef.value;
  const d = detail.value;
  if (!scrollEl || !img || !d?.questions[index]) return;
  const bbox = parseImageBBox(d.questions[index].coordinates);
  if (!bbox) return;
  if (!img.naturalWidth || !img.naturalHeight) return;

  const pad = 6;
  if (bboxVisibleInHeroScroll(scrollEl, img, bbox.top, bbox.bottom, pad)) {
    return;
  }

  const scale = img.clientWidth / img.naturalWidth;
  const topPx = bbox.top * scale;
  const bottomPx = bbox.bottom * scale;
  const vh = scrollEl.clientHeight;
  const center = (topPx + bottomPx) / 2;
  let target = Math.round(center - vh / 2);
  const maxScroll = Math.max(0, scrollEl.scrollHeight - vh);
  target = Math.max(0, Math.min(target, maxScroll));
  scrollEl.scrollTop = target;
}

function onContentCardScroll() {
  if (contentScrollRaf) cancelAnimationFrame(contentScrollRaf);
  contentScrollRaf = requestAnimationFrame(() => {
    contentScrollRaf = 0;
    const idx = pickActiveQuestionIndexFromCard();
    if (idx !== lastCardSyncQuestionIndex) {
      lastCardSyncQuestionIndex = idx;
      syncHeroScrollToQuestion(idx);
    }
  });
}

function bindContentCardScroll() {
  unbindContentCardScroll();
  const el = contentCardRef.value;
  if (!el) return;
  boundCardEl = el;
  el.addEventListener("scroll", onContentCardScroll, { passive: true });
}

function unbindContentCardScroll() {
  if (boundCardEl) {
    boundCardEl.removeEventListener("scroll", onContentCardScroll);
    boundCardEl = null;
  }
  if (contentScrollRaf) {
    cancelAnimationFrame(contentScrollRaf);
    contentScrollRaf = 0;
  }
}

function onHeroImageLoad() {
  lastCardSyncQuestionIndex = pickActiveQuestionIndexFromCard();
  syncHeroScrollToQuestion(lastCardSyncQuestionIndex);
}

watch(
  () => detail.value,
  async d => {
    await nextTick();
    unbindContentCardScroll();
    if (!d) return;
    lastCardSyncQuestionIndex = -1;
    bindContentCardScroll();
    await nextTick();
    lastCardSyncQuestionIndex = pickActiveQuestionIndexFromCard();
    syncHeroScrollToQuestion(lastCardSyncQuestionIndex);
  },
  { flush: "post" }
);

function onBack() {
  router.back();
}

/** 解析文本中，除首个【】标题外，其余【】前换行 */
function formatSectionLineBreaks(text: string): string {
  if (!text) return text;
  let first = true;
  return text.replace(/【/g, () => (first ? ((first = false), "【") : "\n【"));
}

function renderSolveProcess(text: string): string {
  return renderMathInText(formatSectionLineBreaks(text));
}

onMounted(async () => {
  xj.hideNavigationBar();
  const loadHandler = loading({
    type: "loading",
    text: "加载中...",
    canDismiss: false
  });
  const ocrTaskId = route.query.ocrTaskId as string;
  if (!ocrTaskId) {
    console.error("[aiLamp] PhotoSearchDetailView: missing ocrTaskId query");
    return;
  }
  try {
    const envelope = await fetchPhotoSearchDetail(ocrTaskId);
    detail.value = envelope?.result?.content;
  } catch (e) {
    console.error("[aiLamp] fetchPhotoSearchDetail failed", e);
  }
  loadHandler.close();
});

onUnmounted(() => {
  unbindContentCardScroll();
});
</script>

<template>
  <NavigationBar class="detail-nav" :left="[{ key: 'back', onClick: onBack }]"
    :statusbar-height="initData?.statusBarHeight || 24" background-color="#75716E" />
  <main v-if="detail" class="photo-detail-page">
    <section class="hero-section">
      <div ref="heroImageScrollRef" class="hero-image-scroll">
        <div class="hero-image-wrap">
          <img ref="heroImageRef" class="hero-image" :src="detail.imageUrl" alt="" @load="onHeroImageLoad" />
        </div>
      </div>
    </section>

    <section ref="contentCardRef" class="content-card">
      <div v-for="(q, index) in detail.questions" :key="q.questionId || String(index)" class="question-set">
        <div class="content-block">
          <h3 class="block-title">{{ t("aiLamp.photo.question") }}</h3>
          <i class="title-bar" aria-hidden="true"></i>
          <div v-if="q.cropUrl" class="block-content question-crop">
            <img :src="resolveRemoteImageUrl(q.cropUrl)" alt="" />
          </div>
        </div>
        <div class="question-divider" aria-hidden="true"></div>
        <div class="content-block">
          <h3 class="block-title">{{ t("aiLamp.photo.answer") }}</h3>
          <i class="title-bar" aria-hidden="true"></i>
          <p class="block-content pre-wrap math-content" v-html="renderMathInText(q.answer)" />
        </div>
        <div class="content-block">
          <h3 class="block-title">{{ t("aiLamp.photo.analysis") }}</h3>
          <i class="title-bar" aria-hidden="true"></i>
          <p class="block-content pre-wrap math-content" v-html="renderSolveProcess(q.solveProcess)" />
        </div>
        <div v-if="index < detail.questions.length - 1" class="question-set-divider" aria-hidden="true"></div>
      </div>
    </section>
  </main>
</template>

<style scoped lang="scss">
.photo-detail-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  min-height: 0;
  overflow: hidden;
  padding-bottom: 0;
  font-size: 14px;
  background: linear-gradient(180deg,
      #75716e 0,
      #75716e 20.7143rem,
      #f7f8fc 20.7143rem,
      #f7f8fc 100%);
}

.hero-section {
  flex-shrink: 0;
  padding-top: 1.8571rem;
  padding-bottom: 2rem;
  padding-right: 1.4286rem;
  padding-left: 1.4286rem;
}

.hero-image-scroll {
  max-height: min(38vh, 15rem);
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  border-radius: 0;
  background: rgba(0, 0, 0, 0.2);
  box-sizing: border-box;
}

.hero-image-wrap {
  width: 100%;
  border-radius: 0;
  overflow: hidden;
  box-sizing: border-box;
}

.hero-image {
  width: 100%;
  height: auto;
  display: block;
}

.content-card {
  flex: 1;
  min-height: 0;
  border-radius: 1.1429rem 1.1429rem 0 0;
  background: #ffffff;
  margin-top: 1.1429rem;
  padding-top: 1.1429rem;
  padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 2.8571rem + min(32vh, 13.7143rem));
  box-sizing: border-box;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

.question-set+.question-set {
  padding-top: 1rem;
}

.question-set-divider {
  margin-top: 1.7143rem;
  width: 100%;
  height: 1.7143rem;
  background: #f7f8fc;
}

.content-block {
  padding-right: 1.4286rem;
  padding-left: 1.4286rem;
  margin-top: 1.7143rem;
}

.content-block:first-child {
  margin-top: 0;
}

.question-divider {
  margin-top: 0.8571rem;
  width: 100%;
  height: 1.7143rem;
  background: #f7f8fc;
}

.question-divider+.content-block {
  margin-top: 0;
  padding-top: 1.1429rem;
}

.block-title {
  margin: 0;
  font-size: 1.2857rem;
  line-height: 1.7857rem;
  font-weight: 600;
  color: #212121;
}

.title-bar {
  display: block;
  width: 2.1429rem;
  height: 0.4286rem;
  margin-top: -0.5rem;
  border-radius: 0.2143rem;
  background: #b3e9ff;
}

.block-content {
  margin-bottom: 0;
  margin-top: 0.5rem;
  font-size: 1rem;
  line-height: 1.5714rem;
  color: #0c121f;
}

.question-crop {
  width: 100%;
  line-height: 0;

  img {
    display: block;
    width: 100%;
    height: auto;
  }
}

.pre-wrap {
  white-space: pre-wrap;
}

.math-content {
  word-break: break-word;

  :deep(.katex) {
    font-size: 1em;
  }

  :deep(.katex-display) {
    margin: 0.5rem 0;
    overflow-x: auto;
    overflow-y: hidden;
  }
}

.detail-nav {
  :deep(.navigationBar_icon) {
    color: #ffffff;
  }
}
</style>