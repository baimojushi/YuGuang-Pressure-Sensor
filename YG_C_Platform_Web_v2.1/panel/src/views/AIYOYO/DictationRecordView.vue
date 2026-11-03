<script setup lang="ts">
import { computed, onActivated, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { xj, initData, info } from "../../stores";
import { NavigationBar } from "xjiang-ui";
import {
  fetchDictationRecordBatchList,
  fetchDictationRecordList,
  type DictationRecordBatchItem,
  type DictationRecordListItem
} from "@/utils/apis/aiLamp";
import messageEmptyState from "@/assets/images/ai-lamp/message-empty-state.svg";
import iconPhotoRecord from "@/assets/images/ai-lamp/dictation-icon-photo.png";
import iconTextbookRecord from "@/assets/images/ai-lamp/dictation-icon-textbook.png";
import iconRetry from "@/assets/images/ai-lamp/dictation-icon-retry.png";
import iconExpand from "@/assets/images/ai-lamp/dictation-icon-expand.png";
import fabSettingsIcon from "@/assets/images/ai-lamp/dictation-fab-settings.png";
import AiLampEmptyState from "./components/AiLampEmptyState.vue";
import InfiniteList from "./components/InfiniteList.vue";
import {
  accuracyScoreClass,
  formatAccuracyPercent,
  hasAccuracyValue
} from "@/utils/dictationAccuracy";

type DictationRecordKind = "photo" | "textbook" | "batch";

interface DictationBatchItem {
  id: string;
  label: string;
  score: number;
}

const { t } = useI18n();
const router = useRouter();

const expandedBatchIds = ref<Record<number, boolean>>({});
const batchChildrenByParentId = ref<
  Record<number, DictationRecordBatchItem[]>
>({});
const batchLoadingParentIds = ref<Record<number, boolean>>({});

async function fetchPage(current: number, size: number) {
  if (!info.pid || !info.did) return { records: [], total: 0 };
  const envelope = await fetchDictationRecordList({
    pid: info.pid,
    did: info.did,
    current,
    size
  });
  if (envelope.code !== 0) {
    throw new Error(envelope.message || "fetchDictationRecordList failed");
  }
  return {
    records: envelope.data?.records ?? [],
    total: envelope.data?.total ?? 0
  };
}

const pageMinHeight = computed(() => {
  const statusBarHeight = initData?.statusBarHeight || 24;
  const navBarContentHeight = 44;
  return `calc(100vh - ${statusBarHeight + navBarContentHeight}px)`;
});

function formatFinishTime(finishTime: string): string {
  const d = new Date(finishTime.replace(" ", "T"));
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const hm =
    (hours < 10 ? "0" : "") +
    hours +
    ":" +
    (minutes < 10 ? "0" : "") +
    minutes;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round(
    (todayStart.getTime() - dayStart.getTime()) / 86400000
  );
  if (diff === 0) return "今天 " + hm;
  if (diff === 1) return "昨天 " + hm;
  return d.getMonth() + 1 + "月" + d.getDate() + "日 " + hm;
}

function isBatchExpanded(id: number) {
  return expandedBatchIds.value[id] === true;
}

function isBatchLoading(parentId: number) {
  return batchLoadingParentIds.value[parentId] === true;
}

function getBatchChildren(parentId: number): DictationRecordBatchItem[] {
  return batchChildrenByParentId.value[parentId] ?? [];
}

function batchTagForItem(item: DictationRecordListItem) {
  if (item.batchLabel) return item.batchLabel;
  const cached = getBatchChildren(item.id);
  if (cached.length > 0) {
    return t("aiLamp.dictation.batchTag", { n: cached.length });
  }
  return "";
}

async function onBatchExpandClick(parentId: number) {
  if (isBatchExpanded(parentId)) {
    expandedBatchIds.value = {
      ...expandedBatchIds.value,
      [parentId]: false
    };
    return;
  }
  if (parentId in batchChildrenByParentId.value) {
    expandedBatchIds.value = {
      ...expandedBatchIds.value,
      [parentId]: true
    };
    return;
  }
  batchLoadingParentIds.value = {
    ...batchLoadingParentIds.value,
    [parentId]: true
  };
  try {
    const envelope = await fetchDictationRecordBatchList(parentId);
    if (envelope.code !== 0) {
      throw new Error(envelope.message || "fetchDictationRecordBatchList failed");
    }
    batchChildrenByParentId.value = {
      ...batchChildrenByParentId.value,
      [parentId]: envelope.data ?? []
    };
    expandedBatchIds.value = {
      ...expandedBatchIds.value,
      [parentId]: true
    };
  } catch (e) {
    console.error("[aiLamp] fetchDictationRecordBatchList failed", e);
  } finally {
    batchLoadingParentIds.value = {
      ...batchLoadingParentIds.value,
      [parentId]: false
    };
  }
}

function openDetail(id: number) {
  router.push({
    name: "aiLampDictationDetail",
    query: { id: String(id) }
  });
}

function setupPageChrome() {
  xj.hideNavigationBar();
}

onMounted(setupPageChrome);
onActivated(setupPageChrome);
</script>

<template>
  <NavigationBar :title="t('aiLamp.dictation.recordTitle')" :statusbar-height="initData?.statusBarHeight || 24" />
  <main class="dictation-record-page" :style="{ minHeight: pageMinHeight, maxHeight: pageMinHeight }">
    <InfiniteList :fetcher="fetchPage" :size="10" class="record-list">
      <template #default="{ item }">
        <article :key="(item as DictationRecordListItem).id" class="dictation-card" :class="{
          'is-photo': (item as DictationRecordListItem).sourceType === 2,
          'is-textbook': (item as DictationRecordListItem).sourceType === 1
        }" role="button" tabindex="0" @click="openDetail((item as DictationRecordListItem).id)"
          @keydown.enter="openDetail((item as DictationRecordListItem).id)">
          <div class="dictation-card__main" :class="{ 'has-retry': (item as DictationRecordListItem).hasWrong === 1 }">
            <div class="dictation-card__content">
              <div class="dictation-card__icon" aria-hidden="true">
                <img class="dictation-card__icon-img" :src="(item as DictationRecordListItem).sourceType === 2
                    ? iconPhotoRecord
                    : iconTextbookRecord
                  " alt="" />
              </div>

              <div class="dictation-card__info">
                <p class="dictation-card__title">
                  {{ (item as DictationRecordListItem).title }}
                </p>
                <p class="dictation-card__meta">
                  {{
                    formatFinishTime((item as DictationRecordListItem).finishTime)
                  }}<template v-if="(item as DictationRecordListItem).sourceType === 2">
                    ·
                    {{
                      t("aiLamp.dictation.wordCount", {
                        n: (item as DictationRecordListItem).wordCount
                      })
                    }}</template>
                  <template v-if="(item as DictationRecordListItem).unitName">
                    {{ (item as DictationRecordListItem).unitName }}</template>
                </p>
              </div>
            </div>

            <div v-if="(item as DictationRecordListItem).isBatch === 1" class="dictation-card__batch-line">
              <p class="dictation-card__batch-tag">
                {{ batchTagForItem(item as DictationRecordListItem) }}
              </p>
              <button type="button" class="dictation-card__expand" :disabled="isBatchLoading((item as DictationRecordListItem).id)
                " :aria-expanded="isBatchExpanded((item as DictationRecordListItem).id)
                " :aria-label="isBatchExpanded((item as DictationRecordListItem).id)
                  ? '收起'
                  : '展开'
                " @click.stop="
                onBatchExpandClick((item as DictationRecordListItem).id)
                ">
                <img class="dictation-card__chevron" :class="{
                  'is-up': isBatchExpanded((item as DictationRecordListItem).id)
                }" :src="iconExpand" alt="" aria-hidden="true" />
              </button>
            </div>

            <div v-if="
              hasAccuracyValue((item as DictationRecordListItem).accuracy) ||
              (item as DictationRecordListItem).hasWrong === 1
            " class="dictation-card__aside">
              <p v-if="hasAccuracyValue((item as DictationRecordListItem).accuracy)" class="dictation-card__score"
                :class="accuracyScoreClass((item as DictationRecordListItem).accuracy)
                  ">
                {{
                  formatAccuracyPercent((item as DictationRecordListItem).accuracy)
                }}
              </p>
              <!-- <button
              v-if="(item as DictationRecordListItem).hasWrong === 1"
              type="button"
              class="dictation-card__retry"
              @click.stop>
              <img
                class="dictation-card__retry-icon"
                :src="iconRetry"
                alt=""
                aria-hidden="true" />
              <span>{{ t("aiLamp.dictation.wrongRetry") }}</span>
            </button> -->
            </div>
          </div>

          <div v-if="(item as DictationRecordListItem).isBatch === 1"
            v-show="isBatchExpanded((item as DictationRecordListItem).id)" class="dictation-card__batches">
            <p v-if="isBatchLoading((item as DictationRecordListItem).id)" class="dictation-card__batch-loading">
              加载中…
            </p>
            <div v-for="batch in getBatchChildren(
              (item as DictationRecordListItem).id
            )" :key="batch.id" class="dictation-card__batch-row" role="button" tabindex="0"
              @click.stop="openDetail(batch.id)" @keydown.enter.stop="openDetail(batch.id)">
              <span class="dictation-card__batch-label">{{
                batch.batchLabel ?? batch.title
                }}</span>
              <span class="dictation-card__batch-score" :class="accuracyScoreClass(batch.accuracy)">
                {{ formatAccuracyPercent(batch.accuracy) }}
              </span>
            </div>
          </div>
        </article>
      </template>
      <template #empty>
        <section class="record-empty-card">
          <AiLampEmptyState :image-src="messageEmptyState" :text="t('aiLamp.dictation.empty')" />
        </section>
      </template>
    </InfiniteList>

    <!-- <button
      type="button"
      class="dictation-fab"
      :aria-label="t('settings')"
      @click="router.push('/aiLampDictationStudySettings')">
      <img class="dictation-fab__icon" :src="fabSettingsIcon" alt="" />
    </button> -->
  </main>
</template>

<style scoped lang="scss">
.dictation-record-page {
  @apply relative overflow-y-auto;
  padding: 1.2143rem 0.8571rem calc(env(safe-area-inset-bottom, 0px) + 5.5rem);
  background: #f7f8fc;
  box-sizing: border-box;
  -webkit-overflow-scrolling: touch;
}

.record-list {
  @apply flex flex-col;
  gap: 0.8571rem;
}

.record-empty-card {
  border-radius: 0.8571rem;
  background: #ffffff;
}

.dictation-card {
  border-radius: 0.8571rem;
  background: #ffffff;
  overflow: hidden;
  cursor: pointer;
}

.dictation-card__main {
  @apply relative flex flex-col;
  padding: 1rem 1rem 0.8571rem;
  box-sizing: border-box;
  min-height: 80px;
  display: flex;
  flex-direction: column;
}

.dictation-card__content {
  @apply flex min-w-0 items-center;
  gap: 0.8571rem;
  padding-right: 4rem;
  flex-grow: 1;
}

.dictation-card__main.has-retry .dictation-card__content {
  padding-right: 5.7143rem;
}

.dictation-card__icon {
  @apply flex flex-shrink-0 items-center justify-center;
  width: 1.8571rem;
  height: 1.8571rem;
}

.dictation-card__icon-img {
  @apply h-full w-full object-contain;
}

.dictation-card__info {
  @apply min-w-0 flex-1;
}

.dictation-card__title {
  @apply m-0 truncate;
  font-size: 1rem;
  line-height: 1.4;
  font-weight: 600;
  color: #212121;
}

.dictation-card__aside {
  @apply absolute flex flex-col items-end;
  top: 1rem;
  right: 1rem;
  gap: 0.4286rem;
  max-width: 5.7143rem;
}

.dictation-card__score {
  @apply m-0 flex-shrink-0 whitespace-nowrap;
  font-size: 1.4286rem;
  line-height: 1.2;
  font-weight: 600;

  &.is-high {
    color: #2db55d;
  }

  &.is-low {
    color: #ff6600;
  }
}

.dictation-card__meta {
  @apply m-0 mt-1;
  font-size: 0.8571rem;
  line-height: 1.35;
  color: rgba(12, 18, 31, 0.45);
}

.dictation-card__batch-line {
  @apply mt-1 flex items-center justify-between gap-2;
  margin-left: calc(1.8571rem + 0.8571rem);
}

.dictation-card__batch-tag {
  @apply m-0 min-w-0 flex-1;
  font-size: 0.8571rem;
  line-height: 1.35;
  font-weight: 500;
  color: #ff6600;
}

.dictation-card__retry {
  @apply inline-flex flex-shrink-0 items-center gap-1 border-0 p-0;
  padding: 0.2857rem 0.5714rem;
  border-radius: 9999px;
  font-size: 0.8571rem;
  line-height: 1.35;
  font-weight: 500;
  color: #ff6600;
  background: rgba(255, 102, 0, 0.1);
  white-space: nowrap;
}

.dictation-card__retry-icon {
  @apply flex-shrink-0 object-contain;
  width: 0.8571rem;
  height: 0.8571rem;
}

.dictation-card__expand {
  @apply flex flex-shrink-0 items-center justify-center border-0 bg-transparent p-0;
  width: 1.7143rem;
  height: 1.7143rem;
}

.dictation-card__chevron {
  @apply block h-full w-full object-contain;
  transition: transform 0.2s ease;

  &.is-up {
    transform: rotate(180deg);
  }
}

.dictation-card__batches {
  position: relative;
  padding: 0.5714rem 1rem 0.8571rem calc(1rem + 1.8571rem + 0.8571rem);

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 12px;
    right: 12px;
    border-top: 0.5px solid rgba(33, 33, 33, 0.08);
  }
}

.dictation-card__batch-loading {
  @apply m-0;
  padding: 0.7143rem 0;
  font-size: 0.8571rem;
  line-height: 1.35;
  color: rgba(12, 18, 31, 0.45);
}

.dictation-card__batch-row {
  @apply flex items-center justify-between;
  padding: 0.7143rem 0;
  cursor: pointer;
}

.dictation-card__batch-label {
  font-size: 1rem;
  line-height: 1.35;
  color: rgba(12, 18, 31, 0.6);
}

.dictation-card__batch-score {
  font-size: 1.0714rem;
  line-height: 1.2;
  font-weight: 600;

  &.is-high {
    color: #2db55d;
  }

  &.is-low {
    color: #ff6600;
  }
}

.dictation-fab {
  position: fixed;
  right: 1rem;
  bottom: 72px;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
}

.dictation-fab__icon {
  @apply block object-contain;
  width: 24px;
  height: 24px;
}
</style>