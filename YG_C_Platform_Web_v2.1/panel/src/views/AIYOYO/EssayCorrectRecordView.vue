<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter, type HistoryState } from "vue-router";
import { xj, initData, info } from "../../stores";
import { NavigationBar, loading, toast } from "xjiang-ui";
import {
  deleteCompositionTask,
  fetchCompositionList,
  type CompositionListItem,
  type CompositionListRow,
} from "@/utils/apis/aiLamp";
import moreIcon from "@/assets/images/ai-lamp/more_icon.png";
import messageEmptyState from "@/assets/images/ai-lamp/message-empty-state.svg";
import deleteAlertIcon from "@/assets/images/ai-lamp/delete-alert-icon.svg";
import AiLampEmptyState from "./components/AiLampEmptyState.vue";
import { downloadEssay } from "@/utils/essayDownload";

const { t } = useI18n();
const router = useRouter();

const menuOpenId = ref<string | null>(null);
const pendingDeleteTaskId = ref<string | null>(null);
const records = ref<CompositionListRow[]>([]);
const listLoaded = ref(false);
const deleteInFlight = ref(false);

const pageMinHeight = computed(() => {
  const statusBarHeight = initData?.statusBarHeight || 24;
  const navBarContentHeight = 44;
  return `calc(100vh - ${statusBarHeight + navBarContentHeight}px)`;
});

function toggleMenu(taskId: string) {
  menuOpenId.value = menuOpenId.value === taskId ? null : taskId;
}

function dismissOpenMenu() {
  menuOpenId.value = null;
}

async function onDownload(row: CompositionListRow) {
  menuOpenId.value = null;
  const url = row.reportUrl?.trim();
  if (!url) return;
  await downloadEssay(url, row.title);
}

function onAskDelete(taskId: string) {
  menuOpenId.value = null;
  pendingDeleteTaskId.value = taskId;
}

function onCancelDelete() {
  pendingDeleteTaskId.value = null;
}

function onConfirmDelete() {
  const taskId = pendingDeleteTaskId.value;
  if (taskId === null || deleteInFlight.value) return;
  deleteInFlight.value = true;
  deleteCompositionTask(taskId)
    .then(envelope => {
      if (envelope.result?.content === true) {
        const i = records.value.findIndex(r => r.taskId === taskId);
        if (i >= 0) records.value.splice(i, 1);
        pendingDeleteTaskId.value = null;
        menuOpenId.value = null;
      }
      deleteInFlight.value = false;
    })
}

function onOpenDetail(row: CompositionListRow) {
  if (menuOpenId.value !== null) {
    const openOn = menuOpenId.value;
    menuOpenId.value = null;
    if (openOn === row.taskId) return;
  }
  const url = row.reportUrl?.trim();
  if (!url) {
    toast({ text: "作文批改中，请稍后再试" });
    return;
  }
  router.push({
    name: "aiLampEssayCorrectDetail",
    state: { data: JSON.parse(JSON.stringify(row)) } as unknown as HistoryState,
  });
}

function mapListItemToRow(item: CompositionListItem): CompositionListRow {
  const d = new Date(item.createdAt);
  const pad = (n: number) => (n < 10 ? "0" : "") + n;
  const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const ymd = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return {
    ...item,
    cardTimeLabel: `${ymd} ${timeStr}`,
  };
}

onMounted(async () => {
  xj.hideNavigationBar();
  if (!info.did) return;
  const loadHandler = loading({
    type: "loading",
    text: "加载中...",
    canDismiss: false,
  });
  try {
    const envelope = await fetchCompositionList({
      deviceId: info.did,
    });
    records.value = (envelope.result?.content ?? []).map(mapListItemToRow);
  } catch (e) {
    console.error("[aiLamp] fetchCompositionList failed", e);
  }
  listLoaded.value = true;
  loadHandler.close();
});
</script>

<template>
  <NavigationBar :title="t('aiLamp.home.essayTitle')" :statusbar-height="initData?.statusBarHeight || 24" />
  <main class="essay-record-page" :style="{ minHeight: pageMinHeight }" @click="dismissOpenMenu">
    <section class="record-list" v-if="records.length">
      <article class="record-card" v-for="item in records" :key="item.taskId" @click="onOpenDetail(item)">
        <div class="thumb-wrap">
          <img class="thumb-img" :src="item.imageThumbnailUrl" alt="" />
          <div class="thumb-dim" aria-hidden="true"></div>
        </div>

        <div class="card-body">
          <p class="card-title">{{ item.title }}</p>
        </div>
        <p class="card-time">{{ item.cardTimeLabel }}</p>

        <div class="more-anchor" @click.stop>
          <div v-show="menuOpenId === item.taskId" class="more-menu" role="menu" :aria-label="t('more')">
            <button type="button" class="menu-item" @click="onDownload(item)">
              {{ t("aiLamp.common.download") }}
            </button>
            <button type="button" class="menu-item is-danger" @click="onAskDelete(item.taskId)">
              {{ t("aiLamp.common.delete") }}
            </button>
          </div>
          <button type="button" class="more-hit" :aria-label="t('more')" @click="toggleMenu(item.taskId)">
            <img class="more-icon" :src="moreIcon" alt="" />
          </button>
        </div>
      </article>
    </section>
    <section class="record-empty-card" v-else-if="listLoaded">
      <AiLampEmptyState :image-src="messageEmptyState" :text="t('aiLamp.essay.empty')" />
    </section>
    <div v-if="pendingDeleteTaskId !== null" class="delete-mask" @click="onCancelDelete">
      <section class="delete-dialog" role="dialog" aria-modal="true" @click.stop>
        <header class="dialog-title">
          <span class="dialog-title-icon" aria-hidden="true">
            <img class="dialog-title-icon-img" :src="deleteAlertIcon" alt="" />
          </span>
          <span>{{ t("aiLamp.settings.deleteAlertTitle") }}</span>
        </header>
        <p class="dialog-message">{{ t("aiLamp.essay.deleteText") }}</p>
        <footer class="dialog-actions">
          <button type="button" class="dialog-btn cancel" @click="onCancelDelete">
            {{ t("dialog.cancel") }}
          </button>
          <button type="button" class="dialog-btn confirm" :disabled="deleteInFlight" @click="onConfirmDelete">
            {{ t("aiLamp.common.delete") }}
          </button>
        </footer>
      </section>
    </div>
  </main>
</template>

<style scoped lang="scss">
/* stylelint-disable at-rule-no-unknown */
.essay-record-page {
  @apply overflow-y-auto;
  padding-top: 1.2143rem;
  padding-right: 0.8571rem;
  padding-left: 0.8571rem;
  padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 2rem);
  background: #f7f8fc;
  /* token 卡片背景色 */
  box-sizing: border-box;
}

.record-list {
  @apply flex flex-col;
  gap: 0.8571rem;
}

.record-empty-card {
  border-radius: 0.8571rem;
  background: #ffffff;
}

.record-card {
  @apply relative flex items-start;
  gap: 1.1429rem;
  padding: 1.1429rem;
  min-height: 11.0714rem;
  /* 155px */
  border-radius: 0.8571rem;
  background: #ffffff;
  box-sizing: border-box;
}

.thumb-wrap {
  @apply relative overflow-hidden;
  width: 10.4286rem;
  /* 146px */
  aspect-ratio: 146 / 100;
  border-radius: 0.5714rem;
  flex: 0 0 auto;
}

.thumb-img {
  @apply block h-full w-full object-cover;
}

.thumb-dim {
  @apply pointer-events-none absolute inset-0;
  background: rgba(0, 0, 0, 0.4);
}

.card-body {
  @apply min-w-0 flex-1;
  padding-right: 2.8571rem;
}

.card-title {
  @apply m-0 overflow-hidden text-ellipsis;
  font-size: 1.1429rem;
  line-height: 1.5714rem;
  font-weight: 600;
  color: #212121;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
}

.card-time {
  @apply absolute m-0;
  left: 1.1429rem;
  bottom: 0.7143rem;
  font-size: 0.8571rem;
  line-height: 1.2143rem;
  color: #999999;
}

.more-anchor {
  @apply absolute flex items-center justify-center;
  right: 0.5rem;
  bottom: 0.8571rem;
  width: 2.8571rem;
  height: 2.8571rem;
}

.more-hit {
  @apply flex h-full w-full items-center justify-center border-0 bg-transparent;
  padding: 0;
  opacity: 0.8;
}

.more-icon {
  @apply block object-contain;
  width: 2.8571rem;
  /* DSL icon frame 40x40 */
  height: 2.8571rem;
}

.more-menu {
  @apply absolute flex flex-col justify-center overflow-hidden;
  right: 0.5rem;
  bottom: 1.7rem;
  width: 5.1429rem;
  /* 72px */
  height: 5.1429rem;
  /* 72px */
  border-radius: 0.2857rem;
  /* 4px */
  background: #ffffff;
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.08),
    0 0 1px rgba(0, 0, 0, 0.04);
  z-index: 2;
}

.menu-item {
  @apply border-0 bg-transparent p-0;
  flex: 1 1 50%;
  font-size: 0.8571rem;
  line-height: 1.2143rem;
  color: #0c121f;
}

.menu-item.is-danger {
  color: #ff0202;
}

.delete-mask {
  @apply fixed inset-0 flex items-center justify-center;
  z-index: 30;
  background: rgba(0, 0, 0, 0.4);
}

.delete-dialog {
  width: 22.2143rem;
  min-height: 14.1429rem;
  border-radius: 1.4286rem;
  background: #ffffff;
  padding: 1.7143rem 1.1429rem;
  box-sizing: border-box;
}

.dialog-title {
  @apply mx-auto flex items-center justify-center;
  gap: 0.5714rem;
  width: fit-content;
  font-size: 1.1429rem;
  line-height: 1.5714rem;
  font-weight: 600;
  color: #212121;
}

.dialog-title-icon {
  @apply inline-flex items-center justify-center;
  width: 1.5714rem;
  height: 1.5714rem;
}

.dialog-title-icon-img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain;
}

.dialog-message {
  margin: 1.1429rem auto 1.7143rem;
  width: 19.4286rem;
  font-size: 1.1429rem;
  line-height: 1.5714rem;
  color: #999999;
  text-align: center;
}

.dialog-actions {
  @apply flex items-center justify-between;
}

.dialog-btn {
  @apply border-0 p-0;
  width: 9.4286rem;
  height: 3.1429rem;
  border-radius: 0.5714rem;
  font-size: 1.1429rem;
  line-height: 1.7857rem;
  font-weight: 400;
}

.dialog-btn.cancel {
  background: #f7f8fc;
  color: #212121;
}

.dialog-btn.confirm {
  background: #f43f31;
  color: #f7f8fc;
}

.dialog-btn.confirm:disabled {
  opacity: 0.6;
}
</style>