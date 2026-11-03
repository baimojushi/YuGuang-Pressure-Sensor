<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { info } from "../stores";
import {
    fetchRecommendResources,
    type RecommendResourceItem
} from "@/utils/apis/aiClockResourceApi";

/**
 * 推荐资源通用卡片
 * 不依赖物模型，只依赖设备 info.pid 与资源后端接口，可在任意设备插件复用。
 * 「更多」跳 Common 资源列表页（resourceList），点单项跳资源详情页（resourceListDetail）。
 */
const router = useRouter();
const { t } = useI18n();

const recommendList = ref<RecommendResourceItem[]>([]);
const loading = ref(false);

const getRecommendResources = async () => {
    loading.value = true;
    try {
        const res = await fetchRecommendResources(info?.pid ?? 0);
        if (res.success) {
            recommendList.value = res.data || [];
        }
    } finally {
        loading.value = false;
    }
};

const onMoreResources = () => {
    router.push({ name: "resourceList" });
};

const onItemClick = (item: RecommendResourceItem) => {
    router.push({
        name: "resourceListDetail",
        query: { id: String(item.id) }
    });
};

const didReady = ref(false);
onMounted(() => {
    if (!info.did) return;
    didReady.value = true;
    getRecommendResources();
});

watch(
    () => info.did,
    newVal => {
        if (newVal && !didReady.value) {
            didReady.value = true;
            getRecommendResources();
        }
    }
);
</script>

<template>
    <div class="bg-white rounded-2xl p-5 shadow-sm">
        <div class="flex items-center justify-between mb-3">
            <h2 class="text-[1.14rem] font-semibold text-[#222]">{{ t("aiclock.recommendedResources") }}</h2>
            <div class="flex items-center text-[0.857rem] text-[#999] cursor-pointer" @click="onMoreResources">
                <span>{{ t("more") }}</span>
                <svg class="w-3.5 h-3.5 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                </svg>
            </div>
        </div>

        <div v-if="loading" class="py-6 text-center text-xs text-[#999]">{{ t("aiclock.loading") }}</div>
        <div v-else-if="recommendList.length === 0" class="py-6 text-center text-xs text-[#999]">
            {{ t("aiclock.recommendEmpty") }}
        </div>
        <div v-else class="resource-list">
            <div v-for="item in recommendList" :key="item.id" class="resource-card" @click="onItemClick(item)">
                <div class="resource-card__image-wrapper">
                    <img :src="item.backgroundImage" alt="" class="resource-card__image" />
                </div>
                <div class="resource-card__title">{{ item.name }}</div>
                <div class="resource-card__subtitle">{{ item.description }}</div>
            </div>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.resource-list {
    display: flex;
    gap: 0.625rem;
    overflow-x: auto;
    padding-bottom: 0.25rem;
    scrollbar-width: none;

    &::-webkit-scrollbar {
        display: none;
    }
}

.resource-card {
    flex: 0 0 auto;
    width: 6.5rem;

    &__image-wrapper {
        width: 100%;
        height: 8.12rem;
        border-radius: 0.75rem;
        overflow: hidden;
        background: #f5f5f5;
    }

    &__image {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    &__title {
        margin-top: 0.5rem;
        font-size: 1rem;
        font-weight: 500;
        color: #191919;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    &__subtitle {
        margin-top: 0.125rem;
        font-size: 0.6875rem;
        color: #999999;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
}
</style>