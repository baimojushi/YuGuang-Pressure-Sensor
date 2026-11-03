<script setup lang="ts">
import { ref } from "vue";
import { Icon, XJTitle, XJSwitch, SliderCard } from 'xjiang-ui';

export type AITempCardProps = {
  text: string;
  subtext?: string;
  icon?: string;
  disabled?: boolean;
  isCard?: boolean;
  value?: string | number | boolean;

  slider?: {
    disabled?: boolean;
    text?: string;
    value?: number;
    onSliderComplete?: (v?: number) => void;
    min: number;
    max: number;
    unit?: string;
  }
};

const emits = defineEmits(["change"]);

const props = withDefaults(defineProps<AITempCardProps>(), {
  isCard: true
});
const onClick = (v?: boolean | number) => {
  if (props.disabled) return;
  emits("change", v);
};

const sliderValue = ref(props.slider.value);
const onSliderChange = (v) => {
  sliderValue.value = v;
}
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

    <div class="flex" :class="{ 'cardDisabled': !value }">
      <div class="relative w-[18vw] mt-[20px]">
        <img src="../assets/images/img_man.png" class="manImg" :class="`${value ? 'manImgOn' : 'manImgOff'}`" />
        <div class="measureBox" :class="`${value ? 'measureBoxOn' : 'measureBoxOff'}`">
          <div>
            <p class="text-right">测试点：胸口温度</p>
            <img src="../assets/images/img_measure.png" class="measureImg" />
          </div>
        </div>
      </div>

      <div class="ml-[40px] flex-1 mr-[10px] flex items-center justify-center">
        <div class="flex-1 w-[100%]">
          <div class="text-center">
            <span class="text-[1.6rem] ">{{ sliderValue ?? "--" }}</span>
            ℃
          </div>
          <p class="text-center text-five">温度</p>

          <SliderCard :is-card="false" :disabled="disabled || !value" unit="℃" :value="slider.value || slider.min"
            :range="[slider.min, slider.max, 1]" @change="v => onSliderChange(v)"
            @complete="v => slider.onSliderComplete(v)" />

          <div class="flex justify-between text-four">
            <span>{{ slider.min }}{{ slider.unit || "" }}</span>
            <span>{{ slider.max }}{{ slider.unit || "" }}</span>
          </div>
        </div>
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

.manImg {
  @apply relative w-[100%];

  &.manImgOn {
    animation: manOn 1.2s linear;
    animation-fill-mode: forwards;
  }

  &.manImgOff {
    animation: manOff 1.2s linear;
    animation-fill-mode: forwards;
  }
}

.measureBox {
  @apply absolute bottom-[0px] right-[-4vw] w-[0px] h-[0px];
  overflow: hidden;

  &.measureBoxOn {
    animation: measureOn 1.2s linear;
    animation-fill-mode: forwards;
  }

  &.measureBoxOff {
    animation: measureOff 1.2s linear;
    animation-fill-mode: forwards;
  }

  &>div {
    @apply absolute bottom-[30vw] right-0 flex-1;
    display: flex;
    flex-direction: column;
    align-items: flex-end;

    p {
      @apply w-[18vw] text-[8px] text-[rgba(0, 0, 0, .4)];
    }

    .measureImg {
      @apply w-[15.5vw];
      max-width: fit-content;

    }
  }
}

@keyframes manOn {
  from {
    filter: brightness(1);
  }

  to {
    filter: brightness(2);
  }
}

@keyframes manOff {
  from {
    filter: brightness(2);
  }

  to {
    filter: brightness(1);
  }
}

@keyframes measureOn {
  0% {
    width: 0;
    height: 0;
  }

  25% {
    width: 25%;
    height: 25%;
  }

  50% {
    width: 50%;
    height: 50%;
  }

  100% {
    width: 100%;
    height: 100%;
  }
}

@keyframes measureOff {
  0% {
    width: 100%;
    height: 100%;
  }

  25% {
    width: 50%;
    height: 50%;
  }

  50% {
    width: 25%;
    height: 25%;
  }

  100% {
    width: 0;
    height: 0;
  }
}
</style>