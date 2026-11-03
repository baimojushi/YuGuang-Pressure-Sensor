<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { initData, xj, info } from "../../../stores";
import { isMiniProgramEnv } from "../../../utils";
import {
    fetchRecommendResourcesCategories,
    type RecommendResourceItem,
} from "@/utils/apis/aiClockResourceApi";
import { NavigationBar } from "xjiang-ui";
defineOptions({ name: "ResourceListPage" });

const router = useRouter();
const route = useRoute();
const { t } = useI18n();

const resourceList = ref<RecommendResourceItem[]>([]);
const loading = ref(false);

const getRecommendResource = async () => {
    loading.value = true;
    try {
        const res = await fetchRecommendResourcesCategories(Number(info.pid));
        if (res.success) {
            const list = res.data || [];
            const label = route.query.label;
            if (label) {
                resourceList.value = list.filter((item) => item.name === label);
            } else {
                resourceList.value = list;
            }
        }
    } finally {
        loading.value = false;
    }
};

const onItemClick = (res: RecommendResourceItem) => {
    router.push({
        name: "resourceListDetail",
        query: { id: String(res.id) },
    });
};

onMounted(() => {
    xj.hideNavigationBar();
    getRecommendResource();
});
</script>

<template>
    <div class="resource-list-page">
        <div v-if="!isMiniProgramEnv" class="resource-list-nav">
            <NavigationBar :statusbar-height="initData?.statusBarHeight || 24"
                :title="t('aiclock.recommendedResources')" />
        </div>

        <div class="resource-list-scroll">
            <div class="resource-list-content">
                <div v-for="category in resourceList" :key="category.id" class="resource-category">
                    <div class="resource-category-title">
                        <span class="resource-category-title-text">{{ category.name }}</span>
                    </div>
                    <div class="resource-category-list">
                        <div v-for="res in category.children" :key="res.id" class="resource-category-item"
                            @click="onItemClick(res)">
                            <img class="resource-category-item-img" :src="res.icon" :alt="res.name" />
                            <span class="resource-category-item-title">{{ res.name }}</span>
                            <span class="resource-category-item-desc">{{ res.description }}</span>
                        </div>
                    </div>
                </div>

                <div v-if="!loading && resourceList.length === 0" class="resource-empty">
                    {{ t("aiclock.recommendEmpty") }}
                </div>
            </div>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.resource-list-page {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: linear-gradient(180deg, #d1eaff 0%, #f6f7fb 12%);
    font-family: PingFang SC, sans-serif;
}

.resource-list-nav {
    position: relative;
    z-index: 20;
    flex-shrink: 0;
}

.resource-list-scroll {
    flex: 1;
    height: 0;
    overflow-y: auto;
}

.resource-list-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 12px;
}

.resource-category {
    display: flex;
    flex-direction: column;
    gap: 19px;
    border-radius: 12px;
    background: #ffffff;
    padding: 19px 16px;
    width: 100%;
}

.resource-category-title {
    display: flex;
    justify-content: space-between;
    color: #333333;
    font-weight: 500;
    font-size: 16px;
}

.resource-category-title-text {
    display: flex;
    align-items: center;
    color: #191919;
    font-weight: 500;
    font-size: 16px;
    line-height: 16px;
    text-align: center;
}

.resource-category-list {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
}

.resource-category-item {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    gap: 11px;
    width: 100%;
}

.resource-category-item-img {
    border-radius: 12px;
    width: 100%;
    height: 88px;
    object-fit: cover;
}

.resource-category-item-title {
    color: #191919;
    font-weight: 500;
    font-size: 14px;
    line-height: 14px;
}

.resource-category-item-desc {
    opacity: 0.6;
    color: #191919;
    font-size: 11px;
    line-height: 11px;
}

.resource-empty {
    padding: 40px 16px;
    text-align: center;
    color: #999999;
    font-size: 14px;
}
</style>