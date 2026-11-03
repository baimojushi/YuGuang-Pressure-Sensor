<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { xj, initData } from "../../stores";
import { NavigationBar, loading } from "xjiang-ui";
import {
  fetchDictationRecordDetail,
  type DictationRecordDetail,
  type DictationResultStatus,
} from "@/utils/apis/aiLamp";
import {
  accuracyScoreClass,
  formatAccuracyPercent,
} from "@/utils/dictationAccuracy";
import iconCheck from "@/assets/images/ai-lamp/dictation-icon-check.png";
import iconCross from "@/assets/images/ai-lamp/dictation-icon-cross.png";
import iconSkip from "@/assets/images/ai-lamp/dictation-icon-skip.png";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const detail = ref<DictationRecordDetail | null>(null);

const STATUS_ICON_MAP: Record<DictationResultStatus, string> = {
  1: iconCheck,
  2: iconCross,
  3: iconSkip,
};

const WORD_ROW_CLASS_MAP: Record<DictationResultStatus, string> = {
  1: "is-correct",
  2: "is-incorrect",
  3: "is-skipped",
};

function onBack() {
  router.back();
}

onMounted(async () => {
  xj.hideNavigationBar();
  const recordId = route.query.id as string | undefined;
  if (!recordId) {
    console.error("[aiLamp] DictationDetailView: missing id query");
    return;
  }
  const loadHandler = loading({
    type: "loading",
    text: "加载中...",
    canDismiss: false,
  });
  try {
    const envelope = await fetchDictationRecordDetail(recordId);
    if (envelope.code === 0) {
      detail.value = envelope.data ?? null;
    } else {
      console.error(
        "[aiLamp] fetchDictationRecordDetail failed",
        envelope.message,
      );
    }
  } catch (e) {
    console.error("[aiLamp] fetchDictationRecordDetail failed", e);
  } finally {
    loadHandler.close();
  }
});
</script>

<template>
  <div v-if="detail" class="dictation-detail-root">
    <div class="dictation-detail-nav">
      <NavigationBar class="dictation-detail-nav-bar" :title="t('aiLamp.dictation.detailTitle')"
        :left="[{ key: 'back', onClick: onBack }]" :statusbar-height="initData?.statusBarHeight || 24"
        background-color="transparent" />
    </div>
    <main class="dictation-detail-page">
      <section class="summary-card">
        <p class="summary-card__tag">{{ detail.title }}</p>
        <div class="summary-card__head">
          <p class="summary-card__score" :class="accuracyScoreClass(detail.accuracy)">
            {{ formatAccuracyPercent(detail.accuracy) }}
          </p>
        </div>
        <p class="summary-card__time">{{ detail.finishTime }}</p>
        <div class="summary-card__stats">
          <div class="summary-card__stat">
            <p class="summary-card__stat-value">{{ detail.correctCount }}</p>
            <p class="summary-card__stat-label">
              {{ t("aiLamp.dictation.statCorrect") }}
            </p>
          </div>
          <div class="summary-card__stat">
            <p class="summary-card__stat-value is-wrong">
              {{ detail.wrongCount }}
            </p>
            <p class="summary-card__stat-label">
              {{ t("aiLamp.dictation.statIncorrect") }}
            </p>
          </div>
          <div class="summary-card__stat">
            <p class="summary-card__stat-value is-skip">
              {{ detail.skipCount }}
            </p>
            <p class="summary-card__stat-label">
              {{ t("aiLamp.dictation.statSkipped") }}
            </p>
          </div>
        </div>
      </section>

      <section class="word-card">
        <ul class="word-list">
          <li v-for="item in detail.wordList" :key="`${item.sortOrder}-${item.word}`" class="word-row"
            :class="WORD_ROW_CLASS_MAP[item.resultStatus]">
            <span class="word-row__index">{{ item.sortOrder }}</span>
            <div class="word-row__text">
              <span class="word-row__word">{{ item.word }}</span>
              <span class="word-row__translation">{{ item.meaning }}</span>
            </div>
            <img class="word-row__icon" :src="STATUS_ICON_MAP[item.resultStatus]" alt="" aria-hidden="true" />
          </li>
        </ul>
      </section>
    </main>
  </div>
</template>

<style scoped lang="scss">
.dictation-detail-root {
  @apply relative flex h-screen flex-col overflow-hidden;
  background: linear-gradient(180deg, #b1a1ff 0%, #fff3eb54 100%);
}

.dictation-detail-nav {
  @apply relative z-[20] flex-shrink-0;
}

.dictation-detail-nav-bar {
  :deep(.navigationBar) {
    h1 {
      color: #ffffff;
    }
  }

  :deep(.navigationBar_icon) {
    color: #ffffff;
  }
}

.dictation-detail-page {
  @apply relative z-[1] min-h-0 flex-1 overflow-y-auto;
  padding: 0.5714rem 0.8571rem calc(env(safe-area-inset-bottom, 0px) + 1.7143rem);
  box-sizing: border-box;
}

.summary-card {
  position: relative;
  border-radius: 0.8571rem;
  background: linear-gradient(156deg, #ede8ff 0%, #ffffff 63%);
  padding: 1.1429rem 1rem 1rem;
  box-sizing: border-box;
  overflow: hidden;
}

.summary-card__head {
  @apply relative;
}

.summary-card__score {
  @apply m-0 flex-shrink-0;
  font-size: 2.2857rem;
  line-height: 1.1;
  font-weight: 600;

  &.is-high {
    color: #2db55d;
  }

  &.is-low {
    color: #ff6600;
  }
}

.summary-card__tag {
  @apply m-0 truncate text-right;
  position: absolute;
  top: 12px;
  right: 0;
  z-index: 1;
  max-width: calc(100% - 9rem);
  padding: 0.2857rem 0.5714rem;
  border-radius: 0.4286rem;
  font-size: 12px;
  line-height: 1.35;
  font-weight: 500;
  color: #00aaff;
  background: rgba(0, 170, 255, 0.06);
  box-sizing: border-box;
}

.summary-card__time {
  @apply m-0 mt-2;
  font-size: 0.8571rem;
  line-height: 1.35;
  color: rgba(12, 18, 31, 0.45);
}

.summary-card__stats {
  @apply mt-4 flex;
  padding-top: 1rem;
  border-top: 0.5px solid rgba(33, 33, 33, 0.08);
}

.summary-card__stat {
  @apply flex-1 text-center;
}

.summary-card__stat-value {
  @apply m-0;
  font-size: 1.4286rem;
  line-height: 1.2;
  font-weight: 600;
  color: #212121;

  &.is-wrong {
    color: #ff3b30;
  }

  &.is-skip {
    color: rgba(12, 18, 31, 0.35);
  }
}

.summary-card__stat-label {
  @apply m-0 mt-1;
  font-size: 0.8571rem;
  line-height: 1.35;
  color: rgba(12, 18, 31, 0.45);
}

.word-card {
  margin-top: 0.8571rem;
  border-radius: 0.8571rem;
  background: #ffffff;
  overflow: hidden;
}

.word-list {
  @apply m-0 list-none p-0;
}

.word-row {
  @apply flex items-center;
  padding: 0.9286rem 1rem;
  border-bottom: 0.5px solid rgba(33, 33, 33, 0.08);

  &:last-child {
    border-bottom: none;
  }

  &.is-correct .word-row__word {
    color: #212121;
  }

  &.is-correct .word-row__translation {
    color: rgba(12, 18, 31, 0.45);
  }

  &.is-incorrect .word-row__word,
  &.is-incorrect .word-row__translation {
    color: #ff3b30;
  }

  &.is-skipped .word-row__word,
  &.is-skipped .word-row__translation {
    color: rgba(12, 18, 31, 0.35);
  }
}

.word-row__index {
  @apply flex-shrink-0;
  margin-right: 30px;
  font-size: 14px;
  line-height: 1.35;
  color: #0c121f;
}

.word-row__text {
  @apply min-w-0 flex-1;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 12px;
}

.word-row__word {
  font-size: 1rem;
  line-height: 1.4;
  font-weight: 500;
}

.word-row__translation {
  font-size: 0.9286rem;
  line-height: 1.35;
}

.word-row__icon {
  @apply flex-shrink-0 object-contain;
  width: 1.1429rem;
  height: 1.1429rem;
}
</style>