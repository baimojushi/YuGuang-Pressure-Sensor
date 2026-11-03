<script setup lang="ts">
import { Icon } from 'xjiang-ui';

export type SwitchButtonProps = {
  value?: number | boolean;
  icons?: string[];
  disabled?: boolean;
};

const emits = defineEmits(["click"]);
withDefaults(defineProps<SwitchButtonProps>(), {});
const onClick = (value) => {
  emits("click", value);
}
</script>

<template>
  <div class="flex justify-center items-center mt-[2.2rem] pb-[2rem]">
    <div class="switchIcon" :class="{ 'active': value }" @click="() => onClick(!value)">
      <Icon name="icon-switch" :color="value ? '#fff' : 'var(--active-color)'" width="1.8rem" height="1.8rem" />
    </div>
  </div>
</template>

<style lang="scss">
.switchIcon {
  @apply flex justify-center items-center w-[4.5rem] h-[4.5rem] rounded-[50%];
  background: rgba(0, 0, 0, .1);
  border: 3px solid rgba(255, 255, 255, .05);

  &.active {
    background: var(--active-color);
    border: 3px solid rgba(255, 255, 255, .1);
  }
}
</style>