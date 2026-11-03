<script setup lang="ts">
import { ref } from 'vue'

interface Props {
    deleteWidth?: number
    deleteThreshold?: number
    deleteText?: string
    deleteBgColor?: string
    cardBgColor?: string
    rounded?: string
    marginBottom?: string
    paddingClass?: string
}

const props = withDefaults(defineProps<Props>(), {
    deleteWidth: 80,
    deleteThreshold: 40,
    deleteText: '删除',
    deleteBgColor: '#fb2c00',
    cardBgColor: '#ffffff',
    rounded: '16px',
    marginBottom: '12px',
    paddingClass: 'p-5'
})

const emit = defineEmits<{
    delete: []
    click: []
    open: []
}>()

const swiping = ref(false)
const startX = ref(0)
const startY = ref(0)
const currentTranslateX = ref(0)
const isDragging = ref(false)

const onTouchStart = (e: TouchEvent) => {
    startX.value = e.touches[0].clientX
    startY.value = e.touches[0].clientY
    swiping.value = true
    currentTranslateX.value = 0
    isDragging.value = false
}

const onTouchMove = (e: TouchEvent) => {
    if (!swiping.value) return
    const diffX = e.touches[0].clientX - startX.value
    const diffY = e.touches[0].clientY - startY.value

    if (Math.abs(diffX) > 5 || Math.abs(diffY) > 5) {
        isDragging.value = true
    }

    if (diffX < 0) {
        currentTranslateX.value = Math.max(diffX, -props.deleteWidth)
    } else if (currentTranslateX.value < 0) {
        currentTranslateX.value = Math.min(0, currentTranslateX.value + diffX)
    }
}

const onTouchEnd = () => {
    if (!swiping.value) return
    if (currentTranslateX.value < -props.deleteThreshold) {
        currentTranslateX.value = -props.deleteWidth
        emit('open')
    } else {
        currentTranslateX.value = 0
        swiping.value = false
    }
}

const handleDelete = (e: Event) => {
    e.stopPropagation()
    emit('delete')
    closeSwipe()
}

const handleClick = () => {
    if (!isDragging.value && currentTranslateX.value === 0) {
        emit('click')
    }
}

const closeSwipe = () => {
    swiping.value = false
    currentTranslateX.value = 0
}

defineExpose({ closeSwipe })
</script>

<template>
    <div class="relative overflow-hidden" :style="{ marginBottom }">
        <div class="absolute right-0 top-0 bottom-0 flex items-center justify-center z-0 transition-opacity duration-200 mr-4"
            :style="{
                width: `${deleteWidth - 16}px`,
                backgroundColor: deleteBgColor,
                borderTopRightRadius: rounded,
                borderBottomRightRadius: rounded,
                opacity: swiping && currentTranslateX < 0 ? 1 : 0,
                pointerEvents: swiping && currentTranslateX < 0 ? 'auto' : 'none'
            }" @touchend.prevent="handleDelete" @click.stop="handleDelete">
            <span class="text-white text-sm font-medium">{{ deleteText }}</span>
        </div>

        <div class="relative z-10 p-5  transition-transform duration-200 cursor-pointer shadow-sm"
            :class="swiping && currentTranslateX < 0 ? '' : ' mx-4'" :style="{
                backgroundColor: cardBgColor,
                borderRadius: swiping && currentTranslateX < 0 ? `${rounded} 0 0 ${rounded}` : rounded,
                transform: swiping ? `translateX(${currentTranslateX}px)` : 'translateX(0)'
            }" @touchstart="onTouchStart" @touchmove="onTouchMove" @touchend="onTouchEnd" @click="handleClick">
            <slot />
        </div>
    </div>
</template>