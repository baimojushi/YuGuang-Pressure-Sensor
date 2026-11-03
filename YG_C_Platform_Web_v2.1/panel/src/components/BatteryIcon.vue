<script setup lang="ts">
import { computed } from "vue";

export type BatteryIconProps = {
    /** 电量百分比 0-100 */
    level?: number;
    /** 是否充电中 */
    charging?: boolean;
    /** 低电量阈值，默认 20 */
    lowThreshold?: number;
    /** 自定义宽度 */
    width?: string;
    /** 自定义高度 */
    height?: string;
    /** 外框/正极颜色 */
    currentColor?: string;
    /** 是否竖向展示 */
    vertical?: boolean;
};

const props = withDefaults(defineProps<BatteryIconProps>(), {
    level: 100,
    charging: false,
    lowThreshold: 20,
    width: "1.5rem",
    height: "0.85rem",
    currentColor: "#4C535D",
    vertical: false,
});

const containerStyle = computed(() =>
    props.vertical ? { width: props.height, height: props.width } : { width: props.width, height: props.height }
);

const normalizedLevel = computed(() => {
    const val = Math.max(0, Math.min(100, props.level));
    return val;
});

const isLow = computed(() => normalizedLevel.value <= props.lowThreshold);

const fillColor = computed(() => {
    if (props.charging) return "#34C759";
    if (isLow.value) return "#FF3B30";
    return "#9FA1AE";
});

const boltColor = computed(() => "#FFFFFF");

const bgColor = computed(() => "#E5E5E5");
</script>

<template>
    <div class="battery-icon" :style="containerStyle">
        <svg viewBox="0 0 28 16" xmlns="http://www.w3.org/2000/svg" class="battery-svg" fill="currentColor"
            :class="{ vertical }">
            <!-- 电池外框 -->
            <rect x="0.5" y="0.5" width="25" height="15" rx="2.5" :stroke="currentColor" stroke-width="1.44"
                fill="none" />
            <!-- 电池正极 -->
            <path d="M26.5 5.5V10.5C27.0523 10.5 27.5 10.0523 27.5 9.5V6.5C27.5 5.94772 27.0523 5.5 26.5 5.5Z"
                :fill="currentColor" />
            <!-- 电池背景 -->
            <rect x="2" y="2" width="22" height="12" rx="1.5" :fill="bgColor" />
            <!-- 电量填充 -->
            <rect class="battery-fill" x="2" y="2" :width="(normalizedLevel / 100) * 22" height="12" rx="1.5"
                :fill="fillColor" />
            <!-- 充电闪电 -->
            <g v-if="charging">
                <path d="M14.5 2L10 8.5H13L11.5 14L16 7.5H13L14.5 2Z" fill="#FFFFFF" />
                <path d="M14.5 2L10 8.5H13L11.5 14L16 7.5H13L14.5 2Z" fill="none" stroke="#333333" stroke-width="0.4" />
            </g>
        </svg>
    </div>
</template>

<style lang="scss" scoped>
.battery-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #333;
}

.battery-svg {
    width: 100%;
    height: 100%;
    display: block;
}

.battery-svg.vertical {
    transform: rotate(-90deg);
}

.battery-fill {
    transition: width 0.3s ease, fill 0.3s ease;
}
</style>