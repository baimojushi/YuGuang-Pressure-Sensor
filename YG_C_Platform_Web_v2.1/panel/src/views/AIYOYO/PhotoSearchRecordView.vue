<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { xj, initData, info } from "../../stores";
import { NavigationBar, centerConfirmDialog, loading, toast } from "xjiang-ui";
import {
  deletePhotoSearchTask,
  fetchPhotoSearchList,
  type PhotoSearchListGroupBlock,
  type PhotoSearchListItem,
  type PhotoSearchListRow,
} from "@/utils/apis/aiLamp";
import moreIcon from "@/assets/images/ai-lamp/more_icon.png";
import messageEmptyState from "@/assets/images/ai-lamp/message-empty-state.svg";
import AiLampEmptyState from "./components/AiLampEmptyState.vue";

const router = useRouter();
const { t } = useI18n();
const menuOpenId = ref<string | null>(null);
const records = ref<PhotoSearchListRow[]>([]);
const listLoaded = ref(false);
const deleteInFlight = ref(false);

const pageMinHeight = computed(() => {
  const statusBarHeight = initData?.statusBarHeight || 24;
  const navBarContentHeight = 44;
  return `calc(100vh - ${statusBarHeight + navBarContentHeight}px)`;
});

const grouped = computed((): PhotoSearchListGroupBlock[] => {
  const today: PhotoSearchListRow[] = [];
  const byDate: Record<string, PhotoSearchListRow[]> = {};
  for (const item of records.value) {
    if (item.sectionGroup === "today") {
      today.push(item);
    } else {
      const label = item.sectionHeading;
      byDate[label] ??= [];
      byDate[label]!.push(item);
    }
  }
  const out: PhotoSearchListGroupBlock[] = [];
  if (today.length) {
    out.push({ heading: t("aiLamp.photo.sectionToday"), items: today });
  }
  for (const label of Object.keys(byDate).sort().reverse()) {
    out.push({ heading: label, items: byDate[label]! });
  }
  return out;
});

function toggleMenu(id: string) {
  menuOpenId.value = menuOpenId.value === id ? null : id;
}

function dismissOpenMenu() {
  menuOpenId.value = null;
}

function goDetail(row: PhotoSearchListRow) {
  if (menuOpenId.value !== null) {
    const openOn = menuOpenId.value;
    menuOpenId.value = null;
    if (openOn === row.ocrTaskId) return;
  }

  router.push({
    name: "aiLampPhotoSearchDetail",
    query: { ocrTaskId: row.ocrTaskId },
  });
}

function onDelete(ocrTaskId: string) {
  menuOpenId.value = null;
  const handler = centerConfirmDialog({
    title: t("aiLamp.settings.deleteAlertTitle"),
    message: t("aiLamp.photo.deleteText"),
    cancelText: t("dialog.cancel"),
    confirmText: t("aiLamp.common.delete"),
    onConfirm: () => {
      if (deleteInFlight.value) return false;
      deleteInFlight.value = true;
      deletePhotoSearchTask(ocrTaskId)
        .then(envelope => {
          if (envelope.result?.content === true) {
            const i = records.value.findIndex(r => r.ocrTaskId === ocrTaskId);
            if (i >= 0) records.value.splice(i, 1);
            menuOpenId.value = null;
          }
          deleteInFlight.value = false;
          handler.close();
        })
      return false;
    },
  });
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function mapListItemToRow(item: PhotoSearchListItem): PhotoSearchListRow {
  const d = new Date(item.createdAt);
  const now = new Date();
  const diffDays = Math.round(
    (startOfDay(now) - startOfDay(d)) / 86400000
  );
  const pad = (n: number) => String(n).padStart(2, "0");
  const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const ymd = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (diffDays === 0) {
    return {
      ...item,
      cardTimeLabel: timeStr,
      sectionGroup: "today",
      sectionHeading: "",
    };
  }
  return {
    ...item,
    cardTimeLabel: timeStr,
    sectionGroup: "other",
    sectionHeading: ymd,
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
    const envelope = await fetchPhotoSearchList({
      // deviceId: 'test_device_001',
      deviceId: info.did,
    });
    records.value = (envelope.result?.content ?? []).map(mapListItemToRow);
  } catch (e) {
    console.error("[aiLamp] fetchPhotoSearchList failed", e);
  }
  listLoaded.value = true;
  loadHandler.close();
});
</script>

<template>
  <NavigationBar :title="t('aiLamp.photo.recordTitle')" :statusbar-height="initData?.statusBarHeight || 24" />
  <main class="record-page" :style="{ minHeight: pageMinHeight }" @click="dismissOpenMenu">
    <template v-if="grouped.length">
      <template v-for="(block, bIdx) in grouped" :key="block.heading + bIdx">
        <h2 class="section-label">{{ block.heading }}</h2>
        <section class="card-grid">
          <article class="thumb-card" v-for="item in block.items" :key="item.ocrTaskId">
            <div class="thumb-card-inner" role="button" tabindex="0" @click.stop="goDetail(item)">
              <div class="thumb-media">
                <img class="thumb-img" :src="item.imageThumbnailUrl" alt="" />
                <div class="thumb-dim" aria-hidden="true"></div>
              </div>
              <div class="thumb-footer">
                <p class="thumb-time">{{ item.cardTimeLabel }}</p>
                <div class="more-anchor">
                  <button v-show="menuOpenId === item.ocrTaskId" type="button" class="delete-pill"
                    @click.stop="onDelete(item.ocrTaskId)">
                    {{ t("aiLamp.common.delete") }}
                  </button>
                  <button type="button" class="more-hit" :aria-label="t('more')"
                    @click.stop="toggleMenu(item.ocrTaskId)">
                    <img class="more-icon" :src="moreIcon" alt="" />
                  </button>
                </div>
              </div>
            </div>
          </article>
        </section>
      </template>
      <p class="end-hint">{{ t("aiLamp.photo.endOfList") }}</p>
    </template>
    <section v-else-if="listLoaded" class="record-empty-card">
      <AiLampEmptyState :image-src="messageEmptyState" :text="t('aiLamp.photo.empty')" />
    </section>
  </main>
</template>

<style scoped lang="scss">
.record-page {
  @apply overflow-y-auto px-3;
  padding-top: 0.9286rem; // 13px, aligns first section top spacing
  padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 2rem);
  box-sizing: border-box;
  background: #f7f8fc;
  /* token 卡片背景色 */
  display: flex;
  flex-direction: column;
}

.section-label {
  @apply mb-3 mt-5;
  font-size: 0.7857rem;
  line-height: 1.36;
  font-weight: 400;
  color: #999999;

  &:first-child {
    margin-top: 0;
  }
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 0.7857rem; // 11px
  row-gap: 0.8571rem; // 12px
}

.record-empty-card {
  border-radius: 0.8571rem;
  background: #ffffff;
}

.thumb-card {
  min-width: 0;
}

.thumb-card-inner {
  cursor: pointer;
  position: relative;
  @apply flex w-full flex-col overflow-hidden rounded-xl bg-white;
  border-radius: 0.8571rem;
}

.thumb-media {
  @apply relative w-full overflow-hidden;
  flex-shrink: 0;
  height: 167px; // DSL image area height
}

.thumb-img {
  @apply block w-full object-cover;
  height: 100%;
  object-position: center center;
  vertical-align: top;
}

.thumb-dim {
  @apply pointer-events-none absolute inset-0;
  background: rgba(0, 0, 0, 0.2);
}

.thumb-footer {
  @apply relative flex flex-shrink-0 items-center;
  min-height: 41px; // 208 - 167
  padding: 0.8571rem 0.8571rem;
  box-sizing: border-box;
}

.more-anchor {
  position: absolute;
  z-index: 3;
  right: -0.25rem;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.8571rem;
  /* DSL icon frame 40x40 */
  height: 2.8571rem;
  margin: 0;
}

.more-hit {
  @apply flex flex-shrink-0 items-center justify-center border-0 bg-transparent;
  opacity: 0.8;
  width: 2.8571rem;
  height: 2.8571rem;
  padding: 0;
}

.more-icon {
  width: 2.8571rem;
  height: 2.8571rem;
  display: block;
  object-fit: contain;
}

/* 删除按钮：固定 72×36（稿），相对「更多」按钮锚点定位，右对齐、叠在更多上方 */
.delete-pill {
  position: absolute;
  z-index: 4;
  top: 50%;
  right: calc(100% - 0.6429rem); // align menu anchor to DSL (9px)
  transform: translateY(calc(-50% - 0.5rem)); // move up to match DSL y-axis
  width: 5.1429rem;
  height: 2.5714rem;
  box-sizing: border-box;
  @apply flex items-center justify-center border-0 p-0 font-normal;
  font-size: 1rem;
  line-height: 1.5714rem;
  font-weight: 400;
  color: #ff0202;
  /* paint_2:2302 */
  background: #ffffff;
  border-radius: 0.2857rem;
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.08),
    0 0 1px rgba(0, 0, 0, 0.04);
}

.thumb-time {
  @apply min-w-0 flex-1 text-left font-normal;
  font-size: 0.8571rem;
  line-height: 1.35;
  font-weight: 400;
  color: #999999;
  padding-right: 2.8571rem; // reserve room for absolute-positioned menu
  margin: 0;
}

.end-hint {
  margin-top: auto;
  @apply pt-4 text-center font-normal;
  font-size: 0.7857rem;
  line-height: 1.36;
  font-weight: 400;
  color: #999999;
  margin-right: 0;
  margin-bottom: 0;
  margin-left: 0;
}
</style>