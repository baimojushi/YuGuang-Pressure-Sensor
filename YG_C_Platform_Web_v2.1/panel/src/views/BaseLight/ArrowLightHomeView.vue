<script setup lang="ts">
import { useRouter } from "vue-router";
import { xj, data, initData, status, info } from "../../stores";
import { onMounted, computed, watch, createVNode } from "vue";
import { useI18n } from "vue-i18n";
import {
  theme,
  XJTitle,
  popup,
  SliderCard,
  FunctionCard,
  ModeCard,
  Icon
} from "xjiang-ui";
import { ScrollPickerOption } from "xjiang-ui/components/scroll-picker/src/ScrollPicker.vue";
import { format } from "path";
import { ElColorPicker } from "element-plus";
import { isMiniProgramEnv } from "../../utils";

const router = useRouter();

const { t } = useI18n();
theme.setTheme("#00B988");

const ModeStates = {
  1: {
    light_Brightness: 8,
    light_LightSelect: 1
  },
  2: {
    light_Brightness: 100,
    light_LightSelect: 1
  },
  3: {
    light_Brightness: 87,
    light_LightSelect: 1
  },
  4: {
    light_OnOff: false
  }
};
const LightStates = {
  light_LightMode: 0
};

onMounted(() => {
  xj.showNavigationBar();
  xj.pageInit({
    key: "XJ_PAGE_INIT",
    onLoad: options => {
      console.log("--onLoad-->", JSON.stringify(options));
      // 快照主动上报 - 去掉
      xj.device.get([]);
    }
  });
});
const isOnline = computed(() => false);
const disabled = computed(() => !data.light_OnOff);
const sleepModeDisabled = computed(() => data.light_LightMode === 4);
const setData = (key, value, okStates?, isValEqual = true) => {
  // if (!disabled.value) {
  if (!isValEqual || data[`${key}`] !== value) {
    xj.device.set({ [`${key}`]: value }, okStates);
  }
  // }
};
const headerHeight = computed(() =>
  isMiniProgramEnv ? 0 : `${(initData?.statusBarHeight || 24) + 56}px`
);

const LightStrArr = [t("DualLight"), t("LowerLight"), t("UpperLight")],
  LightIcons = ["icon-shuangguangyuan", "icon-xiaguang", "icon-shangguang"];
const LightArr = computed(() => {
  return LightStrArr.map((item, index) => {
    return {
      text: item,
      value: index + 1,
      icon: LightIcons[index]
    };
  });
});

const ModeStrArr = [
  t("Night Light"),
  t("Read Mode"),
  t("Leisure Mode"),
  t("Sleep Mode")
],
  ModeIcons = ["icon-xiaoyedeng", "icon-yuedu", "icon-xiuxian", "icon-shuijue"];
const ModeArr = computed(() => {
  return ModeStrArr.map((item, index) => {
    return {
      text: item,
      value: index + 1,
      icon: ModeIcons[index],
      iconSize: index === 2 ? 1.8 : 2
    };
  });
});

const timeArr: ScrollPickerOption[] = Array.from({ length: 60 }).map(
  (item, index) => {
    return {
      value: index + 1,
      text: `${index + 1}${t("min")}`
    };
  }
);
const formatColor = color => {
  // 处理 rgb 格式: rgb(255, 69, 0)
  if (color.startsWith("rgb")) {
    const match = color.match(
      /rgb[a]?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/
    );
    if (match) {
      const r = parseInt(match[1]);
      const g = parseInt(match[2]);
      const b = parseInt(match[3]);

      const hex = ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
      return `#${hex}`;
    }
  }
};
const setModeData = v => {
  const okStates =
    v !== data.light_LightMode && v in ModeStates ? ModeStates[v] : {};
  setData("light_LightMode", v !== data.light_LightMode ? v : 0, okStates);
};
const predefineColors = ["#FD5B3F", "#FD9B3F", "#60FD5A", "#3F71FD"];
const setPowerData = () => {
  const okStates = data.light_LightMode === 4 ? { light_LightMode: 0 } : {};
  setData("light_OnOff", !data.light_OnOff, okStates);
  setData("light_RGBOnOff", !data.light_OnOff, okStates);
};
</script>

<template>
  <!-- <main class="main" v-if="initData?.initComplete"> -->
  <main class="main" :style="{ 'padding-top': headerHeight }">
    <div class="deviceBg"></div>

    <div class="deviceImg">
      <img src="../../assets/images/img_top_lamp.png" />
    </div>

    <div class="relative z-1">
      <FunctionCard :text="data.light_OnOff ? $t('turnOn') : $t('turnOff')" icon="icon-kaiguan"
        :active="!!data.light_OnOff" @click="() => setPowerData()" />

      <div class="card">
        <!-- <div
          class="flex flex-row flex-wrap justify-between"
          :class="{ 'cardDisabled': disabled || sleepModeDisabled }"
        >
          <XJTitle 
            :text="t('LightSourceSelection')"
          />
          <div
            class="flex flex-row items-center"
            @click="v => router.push('./BrightnessRatio')"
          >
            <span class="mr-[5px]">
              {{ t("BrightnessRatio") }}
            </span>
            <Icon name="icon-setting" width="1.2rem" height="1.2rem" />
          </div>
        </div> -->

        <!-- <ModeCard
          :is-card="false"
          :disabled="disabled || sleepModeDisabled"
          :list="LightArr"
          :value="data.light_LightSelect"
          @click="v => setData('light_LightSelect', v, LightStates)"
        /> -->
        <SliderCard style="margin-top: 20px" :is-card="false" :disabled="disabled || sleepModeDisabled"
          :text="t('brightness')" unit="%" slider-type="COARSE" :showMark="false"
          :icons="['icon-a-liangdu', 'icon-a-liangdu1']" :value="data.light_Brightness || 100" :range="[8, 100, 1]"
          @complete="v => setData('light_Brightness', v, LightStates)" />
      </div>
      <SliderCard :is-card="true" :disabled="disabled"
        trackColor="linear-gradient(90deg, #FFCD9D 3%, #FFE9C4 28%, #FFF9E8 51%, #C8E4FF 76%, #96C2FF 99%)"
        :text="t('colorTemperature')" unit="k" slider-type="COARSE" :value="data.light_Temperature || 2700"
        :range="[2700, 5700, 100]" @complete="v => setData('light_Temperature', v)" />
      <div :class="{ card: true, sliderCard: true, cardDisabled: disabled }">
        <XJTitle :text="t('RGB')" />
        <ElColorPicker :show-input="false" :style="{ 'margin-top': '.5rem' }" v-model="data.light_Color" show-alpha
          :predefine="predefineColors" @change="
            v => {
              setData('light_Color', v, null, false);
            }
          ">
        </ElColorPicker>
      </div>

      <ModeCard :text="t('LightMode')" :disabled="disabled" :list="ModeArr" :value="data.light_LightMode"
        @click="v => setModeData(v)" />

      <FunctionCard :text="t('DelayOff')" :showArrow="true" icon="icon-dingshi" :iconSize="2.3" :active="true"
        :disabled="disabled" :value="data.light_DelayOff ? `${data.light_DelayOff}${t('min')}` : ''" @click="
          v => {
            popup({
              type: 'dialog-scroll-picker',
              title: t('DelayOff'),
              scrollPickerOptions: [timeArr],
              scrollPickerSelections: [data.light_DelayOff || 1],
              rightButton: {
                onClick: v => {
                  setData('light_DelayOff', v[0], null, false);
                  return true;
                }
              }
            });
          }
        " />

      <FunctionCard :text="t('VoiceControl')" :subtext="t('VoiceControlTip')" icon="icon-yuyin" :active="true"
        :showArrow="true" @click="v => router.push('./baseVoiceCtrl')" />
      <FunctionCard v-if="isMiniProgramEnv" :text="t('settings')" :showArrow="true" icon="icon-setting" :iconSize="2.3"
        :active="true" @click="() => xj.openSettingsPage({})" />

      <!-- <FunctionCard
        :text="t('VoiceControl')"
        :subtext="t('VoiceControlTip')"
        icon="icon-yuyin"
        :active="true"
        :showArrow="true"
        :disabled="disabled"
        @click="v => router.push('./voiceCtrl')" /> -->
    </div>
  </main>
</template>

<style lang="scss" scoped>
.main {
  background: #f6f6f6;
}

.deviceImg {
  @apply flex justify-center items-center py-[4rem];

  img {
    width: 55%;
  }
}

:global(.el-input__wrapper) {
  display: none;
}
</style>
