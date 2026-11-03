<script setup lang="ts">
import { ref } from "vue";
import { IconButton } from 'xjiang-ui';

export type DeviceTopProps = {
  disabled?: boolean;
  value?: boolean;
  values?: any;
  modeOpt?; any;
  bmValue?: number;
  bmBg?: string;
};

const emits = defineEmits(["click"]);

const props = withDefaults(defineProps<DeviceTopProps>(), {
});
const onClick = () => {
  if (props.disabled) return;
  emits("click");
};

</script>

<template>
  <div :class="{ 'cardDisabled': disabled }" class="relative mt-[20px]">
    <!-- <img src="../assets/images/img_aupu_device_off.png" class="deviceImg" v-if="!bmValue" />
    <img src="../assets/images/img_aupu_device.png" class="deviceImg" v-else /> -->

    <img :src="bmBg" class="deviceBgImg" v-if="bmBg && bmValue" />

    <div class="relative z-1">
      <div class="flex">
        <div class="deviceTopText" :style="{ 'background-color': modeOpt.active ? 'var(--active-color)' : '#A0A2A3' }">
          <span v-if="modeOpt">{{ modeOpt.text }}</span>
          <img v-if="modeOpt.icon" :src="modeOpt.icon" :style="{
            width: modeOpt?.iconSize || '2rem',
            height: modeOpt?.iconSize || '2rem'
          }" />
        </div>
      </div>

      <div v-if="values && values.length" v-for="(item, index) of values" class="w-[20vw] text-[#fff] ml-[6px]">
        <div class="mt-[2rem] flex items-center">
          <span class="text-[2.4rem]">{{ item.value }}</span>
          <span class="ml-[3px] mt-[-10px]">{{ item.unit }}</span>
        </div>
        <span class="text-[.9rem]">{{ item.text }}</span>
      </div>

      <div class="mt-[2rem] w-[4rem]" @click="onClick">
        <IconButton name="icon-kaiguan" :size="4" :rounded="1.5" :active="true" :buttonBg="!value ? '#A0A2A3' : null" />
        <p class="deviceSwitchText">{{ value ? "开启" : "关闭" }}</p>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
.deviceTopText {
  @apply flex flex-row items-center text-[#fff] text-center rounded-[20px] py-[4px] px-[12px] h-[2.8rem];
  background-color: var(--active-color);

  img {
    margin-left: 4px;
    filter: grayscale(100%) brightness(200%);
  }
}

.deviceSwitchText {
  @apply text-center mt-[4px] text-[1.3rem] text-[#fff];

}

.deviceImg {
  @apply absolute right-[-1.4rem] bottom-[-6rem] w-[80%];
  z-index: 1;
}

.deviceBgImg {
  @apply absolute left-[-1.3rem] right-[-1.3rem] bottom-[1rem] max-w-[200%];
  width: calc(100vw + 2.6rem);
}
</style>