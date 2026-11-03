<script setup lang="ts">
import { onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { xj, initData, info } from "../../stores";
import { NavigationBar } from "xjiang-ui";
import {
  fetchStudyAbnormalPage,
  type StudyAbnormalRecord,
} from "@/utils/apis/aiLamp";
import messageEmptyState from "@/assets/images/yoyo/yoyo-shadow.png";
import messageNotifyItemIcon from "@/assets/images/ai-lamp/message-notify-item-icon.svg";
import AiLampEmptyState from "./components/AiLampEmptyState.vue";
import InfiniteList from "./components/InfiniteList.vue";

const { t } = useI18n();

async function fetchPage(current: number, size: number) {
  if (!info.did) return { records: [], total: 0 };
  const env = await fetchStudyAbnormalPage({ did: info.did, current, size });
  return {
    records: env.data.records,
    total: env.data.total,
  };
}

function formatTime(iso: string): string {
  const d = new Date(iso.replace(" ", "T"));
  const pad = (n: number) => String(n).padStart(2, "0");
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round(
    (todayStart.getTime() - dayStart.getTime()) / 86400000
  );
  if (diff === 0) return `今日${hm}`;
  if (diff === 1) return `昨日${hm}`;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${hm}`;
}

onMounted(() => {
  xj.hideNavigationBar();
});
</script>

<template>

  <main class="ai-message-page">
    <InfiniteList :fetcher="fetchPage" :size="10" class="msg-list">
      <template #default="{ item }">
        <article class="msg-row" :key="(item as StudyAbnormalRecord).id">
          <div class="msg-icon-wrap">
            <img class="msg-item-icon" :src="messageNotifyItemIcon" alt="" />
          </div>
          <div class="msg-body">
            <p class="msg-title">{{ (item as StudyAbnormalRecord).abnormalTypeName }}</p>
            <p class="msg-time">{{ formatTime((item as StudyAbnormalRecord).createTime) }}</p>
          </div>
        </article>
      </template>
      <template #empty>
        <section class="msg-empty-card">
          <AiLampEmptyState :image-src="messageEmptyState" :text="t('aiLamp.message.empty')" />
        </section>
      </template>
    </InfiniteList>
  </main>
</template>

<style scoped lang="scss">
.ai-message-page {
  @apply overflow-y-auto px-3 pt-3 pb-3;
  padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 2.2857rem);
  background: #f7f8fc;
}

.msg-list {
  @apply rounded-2xl bg-white px-3;
}

.msg-row {
  @apply flex items-center;
  gap: 1.1429rem;
  /* 16px */
  padding-top: 1.1071rem;
  /* 15.5px */
  padding-bottom: 1.1071rem;
  /* 15.5px */
  border-bottom: 0.5px solid rgba(33, 33, 33, 0.06);

  &:last-child {
    border-bottom: none;
  }
}

.msg-icon-wrap {
  @apply flex h-10 w-10 items-center justify-center;
}

.msg-item-icon {
  @apply h-full w-full object-contain;
}

.msg-title {
  @apply text-[#212121];
  font-size: 1rem;
  /* 14px */
  line-height: 1.4286rem;
  /* 20px */
  font-weight: 600;
}

.msg-time {
  @apply text-[#999999];
  margin-top: 0.1429rem;
  /* 2px */
  font-size: 0.8571rem;
  /* 12px */
  line-height: 1.2143rem;
  /* 17px */
  font-weight: 400;
}

.msg-empty-card {
  @apply rounded-2xl bg-white;
}
</style>