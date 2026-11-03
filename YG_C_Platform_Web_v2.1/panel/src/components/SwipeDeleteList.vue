<script setup lang="ts" generic="T extends { [key: string]: any }">
import { onMounted, onUnmounted, ref } from 'vue'
import SwipeDeleteItem from './SwipeDeleteItem.vue'

interface Props {
    list: T[]
    keyField?: string
    deleteWidth?: number
    deleteThreshold?: number
    deleteText?: string
    deleteBgColor?: string
    cardBgColor?: string
    rounded?: string
    marginBottom?: string
    paddingClass?: string
}

withDefaults(defineProps<Props>(), {
    keyField: 'id',
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
    delete: [item: T, index: number]
    click: [item: T, index: number]
}>()

const listRef = ref<HTMLElement>()
const swipeRefs = ref<any[]>([])
const openIndex = ref(-1)

const closeAll = () => {
    if (openIndex.value === -1) return
    swipeRefs.value.forEach(ref => {
        if (ref) ref.closeSwipe()
    })
    openIndex.value = -1
}

const handleOpen = (index: number) => {
    if (openIndex.value !== index) {
        swipeRefs.value.forEach((ref, i) => {
            if (ref && i !== index) ref.closeSwipe()
        })
        openIndex.value = index
    }
}

const handleDelete = (item: T, index: number) => {
    emit('delete', item, index)
}

const handleClick = (item: T, index: number) => {
    emit('click', item, index)
}

const setRef = (el: any, index: number) => {
    if (el) {
        swipeRefs.value[index] = el
    }
}

const handleDocumentPointerDown = (e: MouseEvent | TouchEvent) => {
    if (listRef.value && !listRef.value.contains(e.target as Node)) {
        closeAll()
    }
}

onMounted(() => {
    document.addEventListener('touchstart', handleDocumentPointerDown, { passive: true })
    document.addEventListener('mousedown', handleDocumentPointerDown)
})

onUnmounted(() => {
    document.removeEventListener('touchstart', handleDocumentPointerDown)
    document.removeEventListener('mousedown', handleDocumentPointerDown)
})
</script>

<template>
    <div ref="listRef">
        <SwipeDeleteItem v-for="(item, index) in list" :key="(item as any)[keyField]" :delete-width="deleteWidth"
            :delete-threshold="deleteThreshold" :delete-text="deleteText" :delete-bg-color="deleteBgColor"
            :card-bg-color="cardBgColor" :rounded="rounded" :margin-bottom="marginBottom" :padding-class="paddingClass"
            :ref="(el: any) => setRef(el, index)" @open="handleOpen(index)" @delete="handleDelete(item, index)"
            @click="handleClick(item, index)">
            <slot :item="item" :index="index" />
        </SwipeDeleteItem>
    </div>
</template>