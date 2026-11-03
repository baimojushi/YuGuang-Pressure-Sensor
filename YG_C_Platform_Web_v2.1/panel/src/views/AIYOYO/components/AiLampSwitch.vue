<script setup lang="ts">
type Props = {
  modelValue: boolean;
  loading?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
};

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  disabled: false,
});

const emit = defineEmits<{ click: [] }>();

function onClick() {
  if (props.disabled || props.loading) return;
  emit("click");
}
</script>

<template>
  <button
    class="ailamp-switch"
    :class="{
      'is-on': modelValue,
      'is-loading': loading,
    }"
    type="button"
    :disabled="disabled || loading"
    :aria-pressed="modelValue ? 'true' : 'false'"
    :aria-busy="loading || undefined"
    :aria-label="ariaLabel"
    @click="onClick" />
</template>

<style scoped lang="scss">
.ailamp-switch {
  @apply relative flex-shrink-0 rounded-full border-0 bg-[#ccc] transition-colors;
  width: 2.8571rem;
  height: 1.5714rem;

  &::after {
    @apply absolute top-1/2 -translate-y-1/2 rounded-full bg-white transition-all;
    content: "";
    left: 0.2857rem;
    width: 1rem;
    height: 1rem;
  }

  &.is-on {
    @apply bg-[#ff6600];

    &::after {
      left: 1.5714rem;
    }
  }

  &.is-loading {
    &::before {
      content: "";
      position: absolute;
      z-index: 1;
      left: 50%;
      top: 50%;
      width: 0.7857rem;
      height: 0.7857rem;
      margin-left: -0.3929rem;
      margin-top: -0.3929rem;
      box-sizing: border-box;
      border-radius: 50%;
      border: 2px solid rgba(12, 18, 31, 0.14);
      border-top-color: #ff6600;
      animation: ailamp-switch-spin 0.65s linear infinite;
    }

    &::after {
      opacity: 0.28;
    }

    &.is-on::before {
      border-color: rgba(255, 255, 255, 0.35);
      border-top-color: #ffffff;
    }
  }
}

@keyframes ailamp-switch-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
