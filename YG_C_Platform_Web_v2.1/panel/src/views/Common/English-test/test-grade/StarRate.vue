<script setup lang="ts">
interface Props {
    value?: number;
    readonly?: boolean;
    allowHalf?: boolean;
    size?: number;
}

withDefaults(defineProps<Props>(), {
    value: 0,
    readonly: false,
    allowHalf: false,
    size: 27,
});
</script>

<template>
    <div class="star-rate" :style="{ '--star-size': `${size}px` }">
        <span v-for="i in 5" :key="i" class="star-rate-item" :class="{
            'is-full': i <= Math.floor(value || 0),
            'is-half': allowHalf && i - 0.5 === (value || 0),
        }">
            <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
            </svg>
        </span>
    </div>
</template>

<style lang="scss" scoped>
.star-rate {
    display: inline-flex;
    align-items: center;
    gap: 4px;
}

.star-rate-item {
    width: var(--star-size, 27px);
    height: var(--star-size, 27px);
    color: var(--rate-icon-empty-color, #eeeeee);
    transition: color 0.2s ease;

    svg {
        display: block;
        width: 100%;
        height: 100%;
    }

    &.is-full,
    &.is-half {
        color: var(--rate-icon-full-color, #ffd21e);
    }

    &.is-half {
        position: relative;
        color: var(--rate-icon-empty-color, #eeeeee);

        &::after {
            content: "";
            position: absolute;
            top: 0;
            left: 0;
            width: 50%;
            height: 100%;
            background: var(--rate-icon-full-color, #ffd21e);
            mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z'/%3E%3C/svg%3E");
            mask-size: var(--star-size, 27px) var(--star-size, 27px);
            mask-repeat: no-repeat;
            -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z'/%3E%3C/svg%3E");
            -webkit-mask-size: var(--star-size, 27px) var(--star-size, 27px);
            -webkit-mask-repeat: no-repeat;
        }
    }
}
</style>