<script setup lang="ts">
import { ref } from "vue";
import { Icon, XJTitle, XJSwitch } from 'xjiang-ui';
import TimeItemCard from "./TimeItemCard.vue";

const TimeNumCardType = {
  ITEM: "ITEM",
  SWITCH: "SWITCH",
  BUTTON: "BUTTON"
};
export type TimeNumCardProps = {
  text: string;
  subtext?: string;
  icon?: string;
  disabled?: boolean;
  isCard?: boolean;
  value?: string | number | boolean;
  type?: string;
  showArrow?: boolean;

  countOpt?: { value: number; text?: string; };
  timeOpt?: Array<{
    title: string;
    text?: string;
    onClick?: () => void;
  }>;
};

const emits = defineEmits(["change", "click"]);

const props = withDefaults(defineProps<TimeNumCardProps>(), {
  isCard: true,
  type: "ITEM",
  showArrow: true
});
const onChange = (v?: boolean | number) => {
  if (props.disabled) return;
  emits("change", v);
};
const onClick = () => {
  if (props.type !== "SWITCH") {
    emits("click");
  }
}


</script>

<template>
  <div :class="{ 'card': isCard, 'cardDisabled': disabled }" class="functionTimeCard" @click="onClick">
    <div class="functionSwitch">
      <div class="flex flex-row flex-1 pr-[5px]">
        <div class="flex flex-col justify-center" :class="{ 'ml-[10px]': icon }">
          <XJTitle :text="text" />
        </div>
      </div>


      <div v-if="type === TimeNumCardType.SWITCH" @click.stop>
        <XJSwitch :disabled="disabled" :active="!!value" @click="onChange" />
      </div>
      <Icon v-else-if="showArrow" name="icon-arrowright" width="1.3rem" height="1.3rem" color="var(--icon-color)" />
    </div>

    <p v-if="subtext" class="mt-[10px] text-third">{{ subtext }}</p>
    <div class="TimeNumCount" :class="{ 'cardDisabled': !disabled && !value }" v-if="countOpt">
      <span class="text-[2.4rem]">{{ countOpt.value }}</span>
      <p>{{ countOpt.text }}</p>
    </div>

    <div v-if="timeOpt && timeOpt.length" class="mt-[10px]">
      <TimeItemCard :list="timeOpt" />
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


  .TimeNumCount {
    @apply flex flex-1 items-center mt-[10px];

    span {
      margin-right: 4px;
    }

    p {
      margin-top: 12px;
    }
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