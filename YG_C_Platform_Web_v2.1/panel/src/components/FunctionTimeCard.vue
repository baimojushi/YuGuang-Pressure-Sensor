<script setup lang="ts">
import { ref } from "vue";
import { Icon, XJTitle, XJSwitch } from 'xjiang-ui';

export type FunctionTimeCardProps = {
  text: string;
  subtext?: string;
  icon?: string;
  disabled?: boolean;
  isCard?: boolean;
  value?: string | number | boolean;

  cardList?: Array<{
    title: string;
    text?: string;
    onClick?: () => void;
  }>;
};

const emits = defineEmits(["change"]);

const props = withDefaults(defineProps<FunctionTimeCardProps>(), {
  isCard: true
});
const onClick = (v?: boolean | number) => {
  if (props.disabled) return;
  emits("change", v);
};
</script>

<template>
  <div :class="{ 'card': isCard, 'cardDisabled': disabled }" class="functionTimeCard">
    <div class="functionSwitch">
      <div class="flex flex-row flex-1 pr-[5px]">
        <div class="flex flex-col justify-center" :class="{ 'ml-[10px]': icon }">
          <XJTitle :text="text" />
          <span v-if="subtext" class="text-third">{{ subtext }}</span>
        </div>
      </div>

      <XJSwitch :disabled="disabled" :active="!!value" @click="onClick" />
    </div>

    <div class="functionTimes" :class="{ 'cardDisabled': !disabled && !value }">
      <div class="functionTime" v-for="(item, index) in cardList" :key="index" @click="item.onClick">
        <div>
          <p>{{ item.title }}</p>
          <span>{{ item.text }}</span>
        </div>
        <Icon name="icon-arrowright" width="1.3rem" height="1.3rem" color="var(--icon-color)" />
      </div>
    </div>
  </div>
</template>

<style lang="scss">
.functionTimeCard {
  min-height: 5rem;
  background: rgba(255, 255, 255, .6);

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
    @apply flex flex-1 items-center justify-between px-[10px] py-[5px];
    background-color: #E9EBEE;
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