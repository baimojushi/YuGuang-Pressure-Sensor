<script setup lang="ts">
type Props = {
  imageSrc: string;
  text: string;
  imageClass?: string;
};

withDefaults(defineProps<Props>(), {
  imageClass: ""
});
</script>

<template>
  <section class="empty-card">
    <img class="empty-illustration" :class="imageClass" :src="imageSrc" alt="" />
    <p class="empty-text">{{ text }}</p>
  </section>
</template>

<style scoped lang="scss">
.empty-card {
  @apply flex flex-col items-center justify-center;
  padding-top: 2.5rem;
  padding-bottom: 2.5rem;
}

@media (min-height: 780px) {
  .empty-card {
    padding-top: 4rem;
    padding-bottom: 3.5rem;
  }
}

.empty-illustration {
  width: 42vw;
  min-width: 6.2857rem;
  max-width: 10rem;
  height: auto;
  object-fit: contain;
}

.empty-text {
  @apply mt-4 text-center;
  font-size: 0.8571rem;
  line-height: 1.35;
  font-weight: 400;
  color: #999999;
}
</style>
