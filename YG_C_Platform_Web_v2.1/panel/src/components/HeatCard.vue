<script setup lang="ts">
import { ref } from "vue";
import { Icon, XJTitle, XJSwitch, SliderCard } from 'xjiang-ui';
import TimeItemCard from "./TimeItemCard.vue";

export type HeatCardProps = {
  text: string;
  subtext?: string;
  icon?: string;
  disabled?: boolean;
  isCard?: boolean;
  value?: string | number | boolean;

  heatOpt?: Array<{
    title: string;
    text?: string;
    onClick?: () => void;
  }>;
};

const emits = defineEmits(["change"]);

const props = withDefaults(defineProps<HeatCardProps>(), {
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

    <div class="flex items-end">
      <TimeItemCard :list="heatOpt" />

      <div class="relative timeImgBox">
        <img src="../assets/images/img_heat.png" class="timeImg" :class="`${!value ? 'timeImgOn' : 'timeImgOff'}`" />
        <img src="../assets/images/img_heatLight.png" class="timeImg timeLightImg"
          :class="`${value ? 'timeImgOn' : 'timeImgOff'}`" />
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

.timeImgBox {
  @apply relative w-[50vw] right-[-1.1rem];

}

.timeImg {
  @apply relative w-[50vw];

  &.timeLightImg {
    @apply absolute top-0 right-0;
  }

  &.timeImgOn {
    animation: timeImgOn .6s linear;
    animation-fill-mode: forwards;
  }

  &.timeImgOff {
    animation: timeImgOff .6s linear;
    animation-fill-mode: forwards;
  }
}

@keyframes timeImgOn {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@keyframes timeImgOff {
  from {
    opacity: 1;
  }

  to {
    opacity: 0;
  }
}
</style>