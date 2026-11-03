<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { xj, initData, info } from "../../stores";
import { NavigationBar, Icon, loading } from "xjiang-ui";
import {
  fetchDictationConfig,
  saveDictationConfig,
  DICTATION_SCHOOL_STAGE_OPTIONS,
  DICTATION_GRADE_OPTIONS,
  DICTATION_SEMESTER_OPTIONS,
  DICTATION_PUBLISHER_OPTIONS,
  type DictationConfig,
  type DictationConfigSavePayload
} from "@/utils/apis/aiLamp";
import AiLampSwitch from "./components/AiLampSwitch.vue";

const { t } = useI18n();

const config = ref<DictationConfig | null>(null);
const saving = ref(false);

const pageMinHeight = computed(() => {
  const statusBarHeight = initData?.statusBarHeight || 24;
  const navBarContentHeight = 44;
  return `calc(100vh - ${statusBarHeight + navBarContentHeight}px)`;
});

const INTERVAL_SECONDS_MIN = 5;
const INTERVAL_SECONDS_MAX = 30;

const intervalSeconds = computed(() => config.value?.intervalSeconds);

const writingTimePercent = computed(() => {
  const sec = intervalSeconds.value;
  if (sec == null) return 0;
  return (
    ((sec - INTERVAL_SECONDS_MIN) / (INTERVAL_SECONDS_MAX - INTERVAL_SECONDS_MIN)) *
    100
  );
});

const writingTimeLabel = computed(() => {
  const sec = intervalSeconds.value;
  if (sec == null) return "";
  return t("aiLamp.dictation.writingTimeUnit", { n: sec });
});

function optionLabel(
  options: readonly { value: number; labelKey: string }[],
  value: number | null | undefined
) {
  if (value == null) return "";
  const opt = options.find(o => o.value === value);
  return opt ? t(opt.labelKey) : "";
}

const gradeLabel = computed(() =>
  optionLabel(DICTATION_GRADE_OPTIONS, config.value?.grade)
);

const usedTextbookLabel = computed(() => {
  const c = config.value;
  if (!c) return "";
  const pub = optionLabel(DICTATION_PUBLISHER_OPTIONS, c.publisher);
  const gr = optionLabel(DICTATION_GRADE_OPTIONS, c.grade);
  const sem = optionLabel(DICTATION_SEMESTER_OPTIONS, c.semester);
  if (!pub || !gr || !sem) return "";
  return `${pub}${gr}${sem}`;
});

async function persistConfig(patch: Partial<DictationConfigSavePayload>) {
  if (!info.pid || !info.did || !config.value || saving.value) return;
  saving.value = true;
  try {
    const envelope = await saveDictationConfig({
      pid: info.pid,
      did: info.did,
      ...patch
    });
    if (envelope.code === 0) {
      config.value = envelope.data;
    } else {
      console.error("[aiLamp] saveDictationConfig failed", envelope.message);
    }
  } catch (e) {
    console.error("[aiLamp] saveDictationConfig failed", e);
  } finally {
    saving.value = false;
  }
}

function onSchoolStageClick(value: number) {
  if (!config.value || config.value.schoolStage === value) return;
  config.value.schoolStage = value;
  persistConfig({ schoolStage: value });
}

function onGradeClick(value: number) {
  if (!config.value || config.value.grade === value) return;
  config.value.grade = value;
  persistConfig({ grade: value });
}

function onSemesterClick(value: number) {
  if (!config.value || config.value.semester === value) return;
  config.value.semester = value;
  persistConfig({ semester: value });
}

function onPublisherClick(value: number) {
  if (!config.value || config.value.publisher === value) return;
  config.value.publisher = value;
  persistConfig({ publisher: value });
}

function onToggleStatus() {
  if (!config.value) return;
  const next: 0 | 1 = config.value.status === 1 ? 0 : 1;
  config.value.status = next;
  persistConfig({ status: next });
}

function onIntervalInput(event: Event) {
  if (!config.value) return;
  config.value.intervalSeconds = Number(
    (event.target as HTMLInputElement).value
  );
}

function onIntervalChange() {
  if (!config.value) return;
  persistConfig({ intervalSeconds: config.value.intervalSeconds });
}

onMounted(async () => {
  xj.hideNavigationBar();
  if (!info.pid || !info.did) return;
  const loadHandler = loading({
    type: "loading",
    text: "加载中...",
    canDismiss: false
  });
  try {
    const envelope = await fetchDictationConfig({
      pid: info.pid,
      did: info.did
    });
    if (envelope.code === 0) {
      config.value = envelope.data;
    } else {
      console.error(
        "[aiLamp] fetchDictationConfig failed",
        envelope.message
      );
    }
  } catch (e) {
    console.error("[aiLamp] fetchDictationConfig failed", e);
  } finally {
    loadHandler.close();
  }
});
</script>

<template>
  <NavigationBar :title="t('aiLamp.dictation.studySettingsTitle')"
    :statusbar-height="initData?.statusBarHeight || 24" />
  <main class="study-settings-page" :style="{ minHeight: pageMinHeight }">
    <section class="settings-card">
      <p class="card-title">{{ t("aiLamp.dictation.dictationSettings") }}</p>
      <div class="settings-row">
        <span class="settings-row__label">{{
          t("aiLamp.dictation.studentGrade")
        }}</span>
        <span class="settings-row__value">{{ gradeLabel }}</span>
        <Icon class="settings-row__arrow" name="icon-arrowright" width="0.8571rem" height="0.8571rem" color="#ccc" />
      </div>

      <div class="settings-row">
        <span class="settings-row__label">{{
          t("aiLamp.dictation.usedTextbook")
        }}</span>
        <span class="settings-row__value">{{ usedTextbookLabel }}</span>
        <Icon class="settings-row__arrow" name="icon-arrowright" width="0.8571rem" height="0.8571rem" color="#ccc" />
      </div>

      <div class="settings-row settings-row--switch">
        <div class="settings-row__switch-text">
          <p class="settings-row__label">
            {{ t("aiLamp.dictation.textbookRecommend") }}
          </p>
          <p class="settings-row__desc">
            {{ t("aiLamp.dictation.textbookRecommendDesc") }}
          </p>
        </div>
        <AiLampSwitch :model-value="config?.status === 1" :disabled="!config || saving" @click="onToggleStatus" />
      </div>
    </section>

    <section class="settings-card settings-card--slider">
      <p class="card-title">{{ t("aiLamp.dictation.writingTime") }}</p>
      <div class="slider-head">
        <span class="slider-head__label">{{
          t("aiLamp.dictation.writingTime")
          }}</span>
        <span class="slider-head__value">{{ writingTimeLabel }}</span>
      </div>
      <div class="writing-slider-wrap">
        <input class="writing-slider" type="range" min="5" max="30" step="1"
          :value="intervalSeconds ?? INTERVAL_SECONDS_MIN" :disabled="!config || saving" :style="{
            background: `linear-gradient(to right, #ff6600 0%, #ff6600 ${writingTimePercent}%, #e9eaee ${writingTimePercent}%, #e9eaee 100%)`,
          }" @input="onIntervalInput" @change="onIntervalChange" />
      </div>
      <div class="slider-range-labels">
        <span>{{ t("aiLamp.dictation.writingTimeMin") }}</span>
        <span>{{ t("aiLamp.dictation.writingTimeMax") }}</span>
      </div>
    </section>

    <section class="settings-card settings-card--chips">
      <p class="card-title">{{ t("aiLamp.dictation.textbookSelection") }}</p>
      <div class="chip-block">
        <p class="chip-block__label">{{ t("aiLamp.dictation.stageLabel") }}</p>
        <div class="chip-row">
          <button v-for="opt in DICTATION_SCHOOL_STAGE_OPTIONS" :key="opt.value" type="button" class="chip"
            :class="{ 'is-active': config?.schoolStage === opt.value }" :disabled="!config || saving"
            @click="onSchoolStageClick(opt.value)">
            {{ t(opt.labelKey) }}
          </button>
        </div>
      </div>

      <div class="chip-block">
        <p class="chip-block__label">{{ t("aiLamp.dictation.gradeLabel") }}</p>
        <div class="chip-row">
          <button v-for="opt in DICTATION_GRADE_OPTIONS" :key="opt.value" type="button" class="chip"
            :class="{ 'is-active': config?.grade === opt.value }" :disabled="!config || saving"
            @click="onGradeClick(opt.value)">
            {{ t(opt.labelKey) }}
          </button>
        </div>
      </div>

      <div class="chip-block">
        <p class="chip-block__label">{{ t("aiLamp.dictation.semesterLabel") }}</p>
        <div class="chip-row">
          <button v-for="opt in DICTATION_SEMESTER_OPTIONS" :key="opt.value" type="button" class="chip"
            :class="{ 'is-active': config?.semester === opt.value }" :disabled="!config || saving"
            @click="onSemesterClick(opt.value)">
            {{ t(opt.labelKey) }}
          </button>
        </div>
      </div>

      <div class="chip-block">
        <p class="chip-block__label">{{ t("aiLamp.dictation.publisherLabel") }}</p>
        <div class="chip-row">
          <button v-for="opt in DICTATION_PUBLISHER_OPTIONS" :key="opt.value" type="button" class="chip"
            :class="{ 'is-active': config?.publisher === opt.value }" :disabled="!config || saving"
            @click="onPublisherClick(opt.value)">
            {{ t(opt.labelKey) }}
          </button>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped lang="scss">
.study-settings-page {
  @apply flex flex-col overflow-y-auto;
  gap: 0.8571rem;
  padding: 0.8571rem 0.8571rem calc(env(safe-area-inset-bottom, 0px) + 1.7143rem);
  background: #f7f8fc;
  box-sizing: border-box;
}

.settings-card {
  border-radius: 0.8571rem;
  background: #ffffff;
  overflow: hidden;
  box-sizing: border-box;

  &--slider,
  &--chips {
    padding: 0 1rem 1rem;
  }
}

.card-title {
  margin: 0;
  padding: 1rem 1rem 0.5714rem;
  font-size: 0.8571rem;
  line-height: 1.35;
  font-weight: 400;
  color: rgba(12, 18, 31, 0.45);
}

.settings-card--slider .card-title,
.settings-card--chips .card-title {
  padding-left: 0;
  padding-right: 0;
}

.settings-row {
  @apply flex items-center;
  padding: 1rem;
  min-height: 3.4286rem;
  box-sizing: border-box;

  &--switch {
    align-items: center;
    gap: 0.8571rem;
  }
}

.settings-row__label {
  flex-shrink: 0;
  margin: 0;
  font-size: 1rem;
  line-height: 1.4;
  font-weight: 400;
  color: #212121;
}

.settings-row__value {
  @apply min-w-0 flex-1 truncate text-right;
  margin-left: 0.8571rem;
  font-size: 1rem;
  line-height: 1.4;
  color: rgba(12, 18, 31, 0.45);
}

.settings-row__arrow {
  @apply ml-1 flex-shrink-0;
}

.settings-row__switch-text {
  @apply min-w-0 flex-1;
}

.settings-row__desc {
  @apply m-0 mt-1;
  font-size: 0.8571rem;
  line-height: 1.35;
  color: rgba(12, 18, 31, 0.45);
}

.slider-head {
  @apply flex items-center justify-between;
  margin-bottom: 1rem;
}

.slider-head__label {
  font-size: 1rem;
  line-height: 1.4;
  font-weight: 400;
  color: #212121;
}

.slider-head__value {
  font-size: 1rem;
  line-height: 1.4;
  font-weight: 500;
  color: #ff6600;
}

.writing-slider-wrap {
  margin-bottom: 0.5714rem;
}

.writing-slider {
  display: block;
  width: 100%;
  height: 0.2857rem;
  margin: 0;
  border-radius: 999px;
  -webkit-appearance: none;
  appearance: none;
  outline: none;
}

.writing-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 1.4286rem;
  height: 1.4286rem;
  margin-top: -0.5714rem;
  border-radius: 50%;
  background: #ffffff;
  border: 2px solid #ff6600;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
}

.writing-slider::-moz-range-thumb {
  width: 1.4286rem;
  height: 1.4286rem;
  border-radius: 50%;
  border: 2px solid #ff6600;
  background: #ffffff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
}

.writing-slider::-webkit-slider-runnable-track {
  height: 0.2857rem;
  border-radius: 999px;
}

.writing-slider::-moz-range-track {
  height: 0.2857rem;
  border-radius: 999px;
}

.slider-range-labels {
  @apply flex justify-between;
  font-size: 0.8571rem;
  line-height: 1.35;
  color: rgba(12, 18, 31, 0.45);
}

.chip-block {
  &:not(:last-child) {
    margin-bottom: 1.1429rem;
  }
}

.chip-block__label {
  margin: 0 0 0.7143rem;
  font-size: 1rem;
  line-height: 1.4;
  font-weight: 600;
  color: #212121;
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5714rem;
}

.chip {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 86px;
  height: 40px;
  padding: 0 12px;
  border: 0;
  border-radius: 20px;
  opacity: 1;
  font-size: 0.9286rem;
  line-height: 1.35;
  font-weight: 400;
  color: #212121;
  background: #f7f8fc;
  white-space: nowrap;

  &.is-active {
    color: #ff6600;
    background: rgba(255, 102, 0, 0.1);
    font-weight: 500;
  }

  &:disabled {
    opacity: 0.6;
  }
}
</style>