<script setup lang="ts">
export interface OfflineDialogProps {
  imgUrl?: string;
  title?: string;
  subTitle?: string;
}
const props = defineProps<OfflineDialogProps>();
// const { imgUrl, title, subTitle } = toRefs(props);
</script>

<template>
  <div class="mt-[2rem] pb-[1rem]">
    <Img :src="imgUrl" v-if="imgUrl && imgUrl.length" class="offline-img" />
    <p class="offline-title" v-if="title && title.length">{{ title }}</p>
    <p class="offline-subtitle" v-if="subTitle && subTitle.length">{{ subTitle }}</p>
  </div>
</template>

<style lang="scss" scoped>
.offline-img {
  @apply w-[6rem] h-[6rem];
  margin: 0 auto;
}
.offline-title {
  @apply text-center text-[1.4rem] mt-[1rem];
  color: var(--color-text-first);
}
.offline-subtitle {
  @apply text-center text-[1.1rem] mt-[.2rem];
  color: var(--color-text-second);
}
</style>
