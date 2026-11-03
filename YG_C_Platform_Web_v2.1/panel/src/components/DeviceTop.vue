<script setup lang="ts">
import { ref } from "vue";
import { IconButton } from 'xjiang-ui';

export type DeviceTopProps = {
  disabled?: boolean;
  value?: boolean;
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
  <div :class="{ 'cardDisabled': disabled }" class="mb-[20px] mt-[20px] relative">
    <img src="../assets/images/img_aupu_light_off.png" class="deviceImg" v-if="!value" />
    <img src="../assets/images/img_aupu_light.png" class="deviceImg" v-else />
    <div class="relative z-1">
      <span class="deviceTopText" :style="{ 'background-color': value ? 'var(--active-color)' : '#A0A2A3' }">{{ value ?
        '照明已开启' : '照明已关闭' }}</span>

      <div class="mt-[11rem] w-[4rem]" @click="onClick">
        <IconButton name="icon-kaiguan" :size="4" :rounded="1.5" :active="true" :buttonBg="!value ? '#A0A2A3' : null" />
        <p class="deviceSwitchText">{{ value ? "开启" : "关闭" }}</p>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
.deviceTopText {
  @apply text-[#fff] text-center rounded-[20px] py-[4px] px-[12px];
  background-color: var(--active-color);
}

.deviceSwitchText {
  @apply text-center mt-[4px] text-[1.3rem] text-[#fff];

}

.deviceImg {
  @apply absolute right-[-1.4rem] top-0 w-[90%];
}
</style>