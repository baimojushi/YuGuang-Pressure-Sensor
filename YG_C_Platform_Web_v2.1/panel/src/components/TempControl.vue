<script setup lang="ts">
import { Icon } from 'xjiang-ui';

export type TempControlProps = {
  value?: number;
  icons?: string[];
  disabled?: boolean;
};

const emits = defineEmits(["change"]);
withDefaults(defineProps<TempControlProps>(), {});
const onChange = (value) => {
  emits("change", value);
}
</script>

<template>
  <div class="relative flex justify-center items-center flex-1" :class="{ 'cardDisabled': disabled }">
    <div class="circleControl relative z-1">
      <div class="iconButton left-[-2rem]" @click="() => onChange(0)">
        <Icon name="icon-minus" color="#fff" width="2.2rem" height="2.2rem" />
      </div>
      <img src="../assets/images/img_circle.png" />
      <div class="iconButton right-[-2rem]" @click="() => onChange(1)">
        <Icon name="icon-plus" color="#fff" width="2.2rem" height="2.2rem" />
      </div>
    </div>

    <div class="absolute min-w-[4.8rem]">
      <p class="text-white text-[3rem]">{{ value }}<span class="text-[1rem]">℃</span></p>
      <div class="flex justify-center items-center" v-if="icons && icons.length">
        <div v-for="(item, index) in icons" :key="index" class="w-[2.4rem] h-[2.4rem] flex justify-center items-center">
          <Icon :name="item" color="rgba(255,255,255,.85)" width="1.6rem" height="1.6rem" />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
.circleControl {
  @apply w-[70vw] h-[70vw] my-[1rem] flex justify-center items-center;

  &>img {
    @apply w-[100%] h-[100%];
  }

  &>.iconButton {
    @apply absolute z-[1] w-[4rem] h-[4rem] flex justify-center items-center rounded-[50%];
    background: #30558C;
    border: 3px solid #436598;
  }
}
</style>