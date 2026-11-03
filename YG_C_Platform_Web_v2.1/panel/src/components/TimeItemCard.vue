<script setup lang="ts">
import { Icon } from 'xjiang-ui';

export type TimeItemCardProps = {
  disabled?: boolean;
  list?: Array<{
    title: string;
    text?: string;
    onClick?: () => void;
  }>;
};

const emits = defineEmits(["change"]);

const props = withDefaults(defineProps<TimeItemCardProps>(), {
});
const onClick = (v?: boolean | number) => {
  if (props.disabled) return;
  emits("change", v);
};
</script>

<template>
  <div v-if="list && list.length" class="functionTime" v-for="(item, index) in list" :key="index" @click="item.onClick"
    :class="{ 'cardDisabled': disabled }">
    <div>
      <p>{{ item.title }}</p>
      <span>{{ item.text }}</span>
    </div>
    <Icon name="icon-arrowright" width="1.3rem" height="1.3rem" color="var(--icon-color)" />
  </div>
</template>

<style lang="scss">
.functionTimeCard {
  min-height: 5rem;
  background: #E1EAF1;

  .functionSwitch {
    @apply flex flex-1 items-center;
  }

  button {
    width: 4rem;
    height: 2rem;
    border-radius: 2rem;
    border: 1px solid rgb(255, 81, 0);
    background-color: rgb(255, 81, 0, .05);
    color: rgb(255, 81, 0);
  }


  .functionTimes {
    @apply flex flex-1 items-center mt-[10px];

  }

  .functionTime {
    @apply flex px-[10px] py-[5px];
    background-color: #E1EAF1;
    border-radius: 5px;

    &:nth-child(2n) {
      @apply ml-[15px];
    }

    p {
      @apply text-[1.1rem];
    }

    span {
      @apply mt-[2px] text-[.9rem] text-[#888];
    }
  }
}
</style>