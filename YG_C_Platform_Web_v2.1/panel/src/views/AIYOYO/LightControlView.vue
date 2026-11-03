<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { xj, initData, data } from "../../stores";
import { isMiniProgramEnv } from "../../utils";
import { NavigationBar, SliderCard } from "xjiang-ui";
import iconAudioMode from "@/assets/images/ai-lamp/icon-audio-mode.svg";
import iconAudioSlider from "@/assets/images/ai-lamp/icon-audio-slider.svg";
import iconAudioSliderMuted from "@/assets/images/ai-lamp/icon-audio-slider-muted.svg";

const { t } = useI18n();

/** profile: 1 = 开启静音模式, 2 = 关闭静音模式 */
const VOICE_MUTE_ON = 1;
const VOICE_MUTE_OFF = 2;

const muteModeOn = computed(() => (data.voice_MuteMode ?? VOICE_MUTE_OFF) === VOICE_MUTE_ON);

const volumeHead = ref<number>(data.voice_Volume ?? 50);
watch(
  () => data.voice_Volume,
  v => {
    if (typeof v === "number") volumeHead.value = v;
  }
);

const setData = (key: string, value: number) => {
  if (data[key] !== value) {
    xj.device.set({ [key]: value });
  }
};

const onToggleMuted = () => {
  setData("voice_MuteMode", muteModeOn.value ? VOICE_MUTE_OFF : VOICE_MUTE_ON);
};

onMounted(() => {
  xj.pageInit({
    key: "XJ_PAGE_INIT",
    onLoad: () => {
      xj.device.get([]);
    }
  });
  xj.hideNavigationBar();
});
</script>

<template>
  <svg class="ai-lamp-slider-symbol-defs" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
    aria-hidden="true" focusable="false">
    <symbol id="icon-ai-sun-small" viewBox="0 0 20 20">
      <path fill="currentColor"
        d="M10 2.5C10.6904 2.5 11.25 1.94036 11.25 1.25C11.25 0.559644 10.6904 0 10 0C9.30964 0 8.75 0.559644 8.75 1.25C8.75 1.94036 9.30964 2.5 10 2.5ZM15.3033 15.3033C15.7915 14.8151 16.5829 14.8151 17.0711 15.3033C17.5592 15.7915 17.5592 16.5829 17.0711 17.0711C16.5829 17.5592 15.7915 17.5592 15.3033 17.0711C14.8151 16.5829 14.8151 15.7915 15.3033 15.3033ZM2.92893 15.3033C3.41709 14.8151 4.20854 14.8151 4.6967 15.3033C5.18485 15.7915 5.18485 16.5829 4.6967 17.0711C4.20854 17.5592 3.41709 17.5592 2.92893 17.0711C2.44078 16.5829 2.44078 15.7915 2.92893 15.3033ZM10 3.75C13.4518 3.75 16.25 6.54822 16.25 10C16.25 13.4518 13.4518 16.25 10 16.25C6.54822 16.25 3.75 13.4518 3.75 10C3.75 6.54822 6.54822 3.75 10 3.75ZM17.0711 2.92893C17.5592 3.41709 17.5592 4.20854 17.0711 4.6967C16.5829 5.18485 15.7915 5.18485 15.3033 4.6967C14.8151 4.20854 14.8151 3.41709 15.3033 2.92893C15.7915 2.44078 16.5829 2.44078 17.0711 2.92893ZM2.92893 2.92893C3.41709 2.44078 4.20854 2.44078 4.6967 2.92893C5.18485 3.41709 5.18485 4.20854 4.6967 4.6967C4.20854 5.18485 3.41709 5.18485 2.92893 4.6967C2.44078 4.20854 2.44078 3.41709 2.92893 2.92893ZM17.5 10C17.5 10.6904 18.0596 11.25 18.75 11.25C19.4404 11.25 20 10.6904 20 10C20 9.30964 19.4404 8.75 18.75 8.75C18.0596 8.75 17.5 9.30964 17.5 10ZM10 17.5C9.30964 17.5 8.75 18.0596 8.75 18.75C8.75 19.4404 9.30964 20 10 20C10.6904 20 11.25 19.4404 11.25 18.75C11.25 18.0596 10.6904 17.5 10 17.5ZM2.5 10C2.5 9.30964 1.94036 8.75 1.25 8.75C0.559644 8.75 0 9.30964 0 10C0 10.6904 0.559644 11.25 1.25 11.25C1.94036 11.25 2.5 10.6904 2.5 10Z" />
    </symbol>
    <symbol id="icon-ai-sun-large" viewBox="0 0 22 22">
      <path fill="currentColor"
        d="M11 17C11.5523 17 12 17.4477 12 18V21C12 21.5523 11.5523 22 11 22C10.4477 22 10 21.5523 10 21V18C10 17.4477 10.4477 17 11 17ZM16.6569 15.2426L18.7782 17.364C19.1687 17.7545 19.1687 18.3877 18.7782 18.7782C18.3876 19.1687 17.7545 19.1687 17.364 18.7782L15.2426 16.6569C14.8521 16.2663 14.8521 15.6332 15.2426 15.2426C15.6332 14.8521 16.2663 14.8521 16.6569 15.2426ZM6.75736 15.2426C7.14788 15.6332 7.14788 16.2663 6.75736 16.6569L4.63604 18.7782C4.24551 19.1687 3.61235 19.1687 3.22183 18.7782C2.8313 18.3877 2.8313 17.7545 3.22183 17.364L5.34315 15.2426C5.73367 14.8521 6.36684 14.8521 6.75736 15.2426ZM11 6C13.7614 6 16 8.23858 16 11C16 13.7614 13.7614 16 11 16C8.23858 16 6 13.7614 6 11C6 8.23858 8.23858 6 11 6ZM21 10C21.5523 10 22 10.4477 22 11C22 11.5523 21.5523 12 21 12H18C17.4477 12 17 11.5523 17 11C17 10.4477 17.4477 10 18 10H21ZM4 10C4.55228 10 5 10.4477 5 11C5 11.5523 4.55228 12 4 12H1C0.447715 12 0 11.5523 0 11C0 10.4477 0.447715 10 1 10H4ZM18.7782 3.22183C19.1687 3.61235 19.1687 4.24551 18.7782 4.63604L16.6569 6.75736C16.2663 7.14788 15.6332 7.14788 15.2426 6.75736C14.8521 6.36684 14.8521 5.73367 15.2426 5.34315L17.364 3.22183C17.7545 2.8313 18.3876 2.8313 18.7782 3.22183ZM4.63604 3.22183L6.75736 5.34315C7.14788 5.73367 7.14788 6.36684 6.75736 6.75736C6.36684 7.14788 5.73367 7.14788 5.34315 6.75736L3.22183 4.63604C2.8313 4.24551 2.8313 3.61235 3.22183 3.22183C3.61235 2.8313 4.24551 2.8313 4.63604 3.22183ZM11 0C11.5523 0 12 0.447715 12 1V4C12 4.55228 11.5523 5 11 5C10.4477 5 10 4.55228 10 4V1C10 0.447715 10.4477 0 11 0Z" />
    </symbol>
  </svg>
  <NavigationBar v-if="!isMiniProgramEnv" :title="t('aiLamp.lightControl.title')"
    :statusbar-height="initData?.statusBarHeight || 24" />
  <main class="ai-light-page">
    <div class="light-section-title">{{ t("aiLamp.lightControl.lightSetting") }}</div>
    <section class="light-card">
      <div class="slider-block">
        <div class="slider-head">
          <span>{{ t("colorTemperature") }}</span>
          <span class="head-divider"></span>
          <span class="head-value">{{ data.light_LightCCT ?? 2700 }}K</span>
        </div>
        <input class="ui-slider temp-range" type="range" min="2700" max="5700" step="100"
          :value="data.light_LightCCT ?? 2700"
          @change="setData('light_LightCCT', Number(($event.target as HTMLInputElement).value))" />
      </div>
      <div class="separator"></div>
      <div class="slider-block">
        <div class="slider-head">
          <span>{{ t("aiLamp.lightControl.brightnessAdjust") }}</span>
          <span class="head-divider"></span>
          <span class="head-value">{{ data.light_Brightness ?? 50 }}%</span>
        </div>
        <SliderCard :is-card="false" slider-type="COARSE" :showButton="false" :showMark="false"
          :icons="['icon-ai-sun-small', 'icon-ai-sun-large']" track-color="#E9EAEE" track-tint-color="#FF6600"
          container-height="3.4286rem" unit="%" :value="data.light_Brightness ?? 50" :range="[1, 100, 1]"
          @complete="v => setData('light_Brightness', v)" />
      </div>
    </section>

    <div class="light-section-title">{{ t("aiLamp.lightControl.soundSetting") }}</div>
    <section class="mute-card">
      <div class="mute-row">
        <div class="mute-row-left">
          <img class="mute-row-icon" :src="muteModeOn ? iconAudioSliderMuted : iconAudioMode" alt="" />
          <span>{{ t("aiLamp.lightControl.muteMode") }}</span>
        </div>
        <button class="mute-switch" :class="{ on: muteModeOn }" type="button" @click="onToggleMuted" />
      </div>
    </section>
    <section class="sound-card" :class="{ muted: muteModeOn }">
      <div class="sound-slider-row">
        <div class="mute-row-left">
          <img class="mute-row-icon" :src="iconAudioSlider" alt="" />
        </div>
        <input class="sound-slider" type="range" min="0" max="100" step="1" :disabled="muteModeOn" :value="volumeHead"
          :style="{
            background: `linear-gradient(to right, #ff6600 0%, #ff6600 ${volumeHead}%, #cccccc ${volumeHead}%, #cccccc 100%)`
          }" @input="volumeHead = Number(($event.target as HTMLInputElement).value)"
          @change="setData('voice_Volume', Number(($event.target as HTMLInputElement).value))" />
        <img class="mute-row-icon" :src="iconAudioMode" alt="" />
      </div>
    </section>
  </main>
</template>

<style scoped lang="scss">
.ai-lamp-slider-symbol-defs {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
}

.ai-light-page {
  @apply min-h-screen overflow-y-auto;
  padding: 0.8571rem 1.1429rem 2.2857rem;
  background: #f7f8fc;
}

.light-section-title {
  margin-bottom: 1.1429rem;
  font-size: 1rem;
  line-height: 1.2;
  font-weight: 400;
  color: rgba(12, 18, 31, 0.6);
}

.light-card,
.mute-card,
.sound-card {
  border-radius: 0.8571rem;
  background: #fff;
}

.light-card {
  margin-bottom: 1.7143rem;
  padding: 1.1429rem 0.25rem;
}

.mute-card {
  padding: 0 1.1429rem;
  margin-bottom: 0.8571rem;
}

.sound-card {
  padding: 0 1.1429rem;

  &.muted {
    opacity: 0.4;
  }
}

.slider-block {
  padding: 0 1.4286rem;
}

.slider-head {
  height: 2.5714rem;
  margin-bottom: 0.4286rem;
  display: flex;
  align-items: center;
  gap: 0.4286rem;
  font-size: 1rem;
  line-height: 1.2857rem;
  font-weight: 400;
  color: #0c121f;

  .head-value {
    display: inline-flex;
    align-items: center;
    font-size: 0.7857rem;
    line-height: 1.2143rem;
    font-weight: 400;
    opacity: 0.6;
  }
}

.head-divider {
  display: inline-flex;
  align-items: center;
  width: 0.0714rem;
  height: 0.5714rem;
  border-radius: 0;
  background: rgba(12, 18, 31, 0.25);
}

.ui-slider {
  width: 100%;
  height: 3.4286rem;
  border-radius: 999px;
  -webkit-appearance: none;
  appearance: none;
  outline: none;
  padding: 0 0.8571rem;
  box-sizing: border-box;
}

.ui-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 2.2857rem;
  height: 2.2857rem;
  border-radius: 50%;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.04);
  box-shadow:
    0 0 1px rgba(0, 0, 0, 0.15),
    0 0 2px rgba(0, 0, 0, 0.15);
}

.ui-slider::-moz-range-thumb {
  width: 2.2857rem;
  height: 2.2857rem;
  border-radius: 50%;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.04);
}

.temp-range {
  background: linear-gradient(90deg, #f6830c -1%, #fbd26c 34%, #fefdd9 66%, #edf4ff 100%);
}

.separator {
  margin: 0.7143rem 1.4286rem;
  height: 0.0714rem;
  background: #d8d8d8;
}

.mute-row,
.sound-slider-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #0c121f;
}

.mute-row {
  height: 4.5714rem;
  padding: 0;
  font-size: 1rem;
  line-height: 1.1429rem;
  font-weight: 400;
}

.sound-slider-row {
  margin-top: 0;
  height: 4.5714rem;
  padding: 0;
  gap: 0.8571rem;
}

.mute-row-left {
  @apply flex items-center gap-3;
}

.mute-row-icon {
  width: 1.7143rem;
  height: 1.7143rem;
  object-fit: contain;
}

.mute-switch {
  @apply relative flex-shrink-0 rounded-full border-0 bg-[#ccc];
  width: 2.8571rem;
  height: 1.5714rem;

  &::after {
    @apply absolute top-1/2 -translate-y-1/2 rounded-full bg-white;
    content: "";
    left: 0.2143rem;
    width: 1.1429rem;
    height: 1.1429rem;
  }

  &.on {
    @apply bg-[#ff6600];

    &::after {
      left: calc(100% - 1.3571rem);
    }
  }
}

.sound-slider {
  flex: 1;
  min-width: 0;
  margin: 0;
  height: 0.2857rem;
  border-radius: 999px;
  -webkit-appearance: none;
  appearance: none;
}

.sound-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 1.5714rem;
  height: 1.5714rem;
  border-radius: 50%;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.04);
  box-shadow: 0 0 2px rgba(0, 0, 0, 0.15);
}

.sound-slider::-moz-range-thumb {
  width: 1.5714rem;
  height: 1.5714rem;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.04);
  background: #fff;
}
</style>