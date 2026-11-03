<script setup lang="ts">
import { useRouter } from "vue-router";
import { xj, data, initData, status, info } from "../../stores";
import { onMounted, computed, watch, createVNode, ref, onUpdated, reactive } from "vue";
import { useI18n } from 'vue-i18n';
import { theme, NavigationBar, Icon } from 'xjiang-ui';

const { t } = useI18n();
theme.setTheme("#00B988");

const _light_BrightnessRatio = ref(0);
onMounted(() => {
  xj.hideNavigationBar()
  _light_BrightnessRatio.value = 0;
})
const router = useRouter();
const navBar = {
}

const BrightnessStates = {
  1: {
    "light_Brightness": 50,
    "light_LightSelect": 1
  },
  2: {
    "light_Brightness": 77,
    "light_LightSelect": 1
  },
  3: {
    "light_Brightness": 31,
    "light_LightSelect": 1
  }
}
const BrightnessArr = computed(() => {
  return Array.from({ length: 3 }).map((item, index) => {
    const _i = index + 1;
    return {
      title: t(`BirghtnessRatioTitle${_i}`),
      value: _i
    }
  });
});

const setData = (key, value, okStates?) => {
  // if (!disabled.value) {
  // if (data[`${key}`] !== value) {
  xj.device.set({ [`${key}`]: value }, okStates);
  // }
  // }
};
const setBrightnessRatioData = (key, value, okStates?) => {
  _light_BrightnessRatio.value = value;
  setData(key, value, okStates)
};
</script>

<template>
  <NavigationBar :statusbar-height="(initData?.statusBarHeight || 24)" background-color="#fff" />
  <main class="main">
    <p class="brTitle">{{ t("BrightnessRatio") }}</p>

    <div class="deviceImg">
      <img src="../../assets/images/img_floor_lamp1.png" />
    </div>
    <div v-if="BrightnessArr && BrightnessArr.length" v-for="(item, index) in BrightnessArr" :key="index"
      class="brButton" :class="{ 'active': _light_BrightnessRatio === item.value }"
      @click="() => setBrightnessRatioData('light_BrightnessRatio', item.value, BrightnessStates[item.value])">
      <Icon name="icon-tick" width="1.2rem" height="1.2rem" class="absolute left-[.9rem]"
        v-if="_light_BrightnessRatio === item.value" />
      <span>{{ item.title }}</span>
    </div>
  </main>
</template>

<style lang="scss" scoped>
.main {
  background: #fff;
}

.deviceImg {
  @apply flex justify-center items-center my-[2rem];
  background-color: #F5F5F5;
  border-radius: 10px;

  img {
    width: 82%;
  }
}

.brTitle {
  @apply text-[2rem];
}

.brButton {
  @apply flex items-center relative py-[2rem] pl-[3rem] mt-[15px] text-[1rem];
  background-color: #F5F5F5;
  border-radius: 10px;

  &.active {
    @apply text-[#00B988];
    background-color: rgba(0, 185, 136, 0.06);
  }
}
</style>
