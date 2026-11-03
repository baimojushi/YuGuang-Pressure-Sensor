<script setup lang="ts">
import { Icon } from 'xjiang-ui';

export type SelectCardProps = {
  title?: string;
  disabled?: boolean;
  active?: boolean;
  type?: number;
};

const emits = defineEmits(["click"]);
withDefaults(defineProps<SelectCardProps>(), {});
const onClick = (value) => {
  emits("click", value);
}
</script>

<template>
  <div class="selectCard" :class="{ 'active': active, 'selectCard1': type === 1 }">
    <div class="selectCardBg"></div>
    <div class="selectCardInner" @click="onClick">
      <Icon name="icon-tick" width="1.2rem" height="1.2rem" class="absolute left-[.9rem]" v-if="active && !type" />
      <span class="font-semibold">{{ title }}</span>

      <div class="selectRadio" v-if="type === 1"></div>
    </div>
    <slot></slot>
  </div>
</template>

<style lang="scss">
.selectCard {
  @apply relative mt-[15px] text-[1.14rem] text-[var(--color-text-first)];

  .selectCardBg {
    @apply absolute left-0 top-0 w-full h-full;
    background-color: #F5F5F5;
    border-radius: 10px;
  }

  .selectCardInner {
    @apply relative flex items-center py-[2rem] pl-[3rem] z-[1];
  }

  &.active {
    .selectCardBg {
      background-color: var(--active-color);
      opacity: .06;
    }

    .selectCardInner {
      @apply text-[var(--active-color)];
    }
  }

  &.selectCard1 {
    @apply text-[var(--color-text-first)];

    .selectCardBg {
      background-color: #FFF;
    }

    .selectCardInner {
      @apply px-[1.2rem] justify-between;
    }

    .selectRadio {
      @apply w-[1.8rem] h-[1.8rem] rounded-[1.8rem];
      background-color: #F5F5F5;
      border: .4rem solid #F5F5F5;
    }

    &.active {
      .selectCardBg {
        background-color: #FFF;
        opacity: 1;
      }

      .selectCardInner {
        @apply text-[var(--color-text-first)];
      }

      .selectRadio {
        background-color: #fff;
        border-color: var(--active-color);
      }
    }
  }
}
</style>