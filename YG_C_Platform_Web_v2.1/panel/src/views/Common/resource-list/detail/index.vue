<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { initData, info, xj } from "../../../../stores";
import { isMiniProgramEnv } from "../../../../utils";
import { NavigationBar, loading, toast } from "xjiang-ui";
import {
    fetchResourceDetail,
    sendIOTEvent,
    type ResourceCategoryDetail,
    type ResourceDetailItem,
} from "@/utils/apis/aiClockResourceApi";
import { useMediaPlayerStore } from "../../../../stores/mediaPlayer";
defineOptions({ name: "ResourceListDetailPage" });

const route = useRoute();
const { t } = useI18n();
const mediaStore = useMediaPlayerStore();
const categoryId = ref<string>("");
const resourceCategory = ref<ResourceCategoryDetail | undefined>();
const musicList = ref<ResourceDetailItem[]>([]);
const currentSource = ref<number>(mediaStore.curMedia?.id || 0);

const isSubmitting = ref(false);

watch(
    () => initData.mediaPlayer,
    playerState => {
        if (!playerState?.resourceId) {
            currentSource.value = 0;
            mediaStore.setMedia(null);
            return;
        }
        if (playerState.playStatus === "stopped") {
            if (Number(playerState.resourceId) !== currentSource.value) return;
            currentSource.value = 0;
            mediaStore.setMedia(null);
            return;
        }

        if (playerState.playStatus === "paused") {
            currentSource.value = Number(playerState.resourceId);
            mediaStore.syncFromPlayerState(playerState);
            return;
        }

        mediaStore.syncFromPlayerState(playerState);
        currentSource.value = Number(playerState.resourceId);
    },
    { deep: true, immediate: true },
);

const getRecommendResource = async () => {
    const id = route.query.id;
    if (!id) return;
    categoryId.value = String(id);
    const load = loading({ type: "loading" });
    try {
        const res = await fetchResourceDetail(categoryId.value, Number(info?.pid || 0));
        if (res.success) {
            resourceCategory.value = res.data?.category;
            musicList.value = res.data?.resources || [];
        }
    } finally {
        load.close();
    }
};

const selectSource = async (item: ResourceDetailItem) => {
    const did = info?.did;
    const pid = info?.pid;
    if (!did || !pid || isSubmitting.value) {
        console.warn("[resourceList] missing did or pid");
        return;
    }

    const isCurrentSource = currentSource.value === item.id;
    const isPlaying = isCurrentSource && mediaStore.curMedia?.status === 1;
    const isPaused = isCurrentSource && mediaStore.curMedia?.status === 0;
    const prevMedia = mediaStore.curMedia ? { ...mediaStore.curMedia } : null;
    const prevCurrentSource = currentSource.value;

    isSubmitting.value = true;

    try {
        if (isPlaying) {
            mediaStore.toggleStatus();
            const res = await sendIOTEvent({
                topicName: `/${pid}/${did}/device/up`,
                receiveBody: {
                    method: "playerReply",
                    subMethod: "pause",
                    id: 6,
                    code: 0,
                    params: {
                        resourceId: item.id,
                    }
                }
            });
            if (res.status !== 0) {
                console.warn("[resourceList] pause failed", res);
                toast({ text: res.msg || "播放失败" });
                currentSource.value = 0;
                return;
            }
            return
        }

        if (isPaused) {
            mediaStore.toggleStatus();
            const res = await sendIOTEvent({
                topicName: `/${pid}/${did}/device/up`,
                receiveBody: {
                    method: "playerReply",
                    subMethod: "resume",
                    id: 6,
                    code: 0,
                    params: {
                        resourceId: item.id,
                    }
                }
            });
            if (res.status !== 0) {
                console.warn("[resourceList] pause failed", res);
                toast({ text: res.msg || "播放失败" });
                currentSource.value = 0;
                return;
            }
            return;
        }


        currentSource.value = item.id;
        mediaStore.setMedia({
            id: item.id,
            categoryId: Number(categoryId.value),
            icon: item.icon || resourceCategory.value?.backgroundImage || "",
            name: item.title,
            desc: item.description,
            durationSeconds: item.durationSeconds || 0,
            pid,
            did,
            status: 1,
        });
        // await sendResourceCustomEvent({ pid, did, event: `play_music/${did}/${item.id}` });
        const res = await sendIOTEvent({
            topicName: `/${pid}/${did}/device/up`,
            receiveBody: {
                method: "playerReply",
                subMethod: "play",
                id: 6,
                code: 0,
                params: {
                    resourceId: item.id,
                }
            }
        });
        if (res.status !== 0) {
            console.warn("[resourceList] pause failed", res);
            currentSource.value = 0;
            toast({ text: res.msg || "播放失败" });
            return;
        }
    } catch (error) {
        currentSource.value = prevCurrentSource;
        mediaStore.setMedia(prevMedia);
        throw error;
    } finally {
        isSubmitting.value = false;
    }
};

onMounted(() => {
    xj.hideNavigationBar();
    getRecommendResource();

});

onUnmounted(() => {
    if (mediaStore.curMedia?.status === 1) {
        const did = info?.did;
        const pid = info?.pid;
        if (did && pid && mediaStore.curMedia) {
            mediaStore.toggleStatus();
            sendIOTEvent({
                topicName: `/${pid}/${did}/device/up`,
                receiveBody: {
                    method: "playerReply",
                    subMethod: "pause",
                    id: 6,
                    code: 0,
                    params: {
                        resourceId: mediaStore.curMedia.id,
                    }
                }
            });
        }
    }
});
</script>

<template>
    <div class="resource-detail-page">
        <div v-if="!isMiniProgramEnv" class="resource-detail-nav">
            <NavigationBar :statusbar-height="initData?.statusBarHeight || 24" :title="resourceCategory?.name" />
        </div>

        <div class="resource-detail-scroll">
            <div class="resource-detail-container">
                <img v-if="resourceCategory?.backgroundImage" class="resource-detail-header"
                    :src="resourceCategory?.backgroundImage" :alt="resourceCategory?.name" />

                <div class="resource-detail-body">
                    <div class="resource-detail-intro">
                        <span class="resource-detail-intro-title">{{ t("aiclock.introduction") }}</span>
                        <span class="resource-detail-intro-desc">{{ resourceCategory?.description }}</span>
                    </div>

                    <div class="resource-detail-list">
                        <span class="resource-detail-list-title">{{ resourceCategory?.name }}</span>
                        <div class="resource-detail-list-items">
                            <div v-for="(item, index) in musicList" :key="item.id" class="resource-detail-list-item"
                                :class="{ 'resource-detail-list-item-active': currentSource === item.id }"
                                @click="selectSource(item)">
                                <div class="resource-detail-list-item-name">
                                    <div class="resource-detail-list-item-name-content">
                                        <span class="resource-detail-list-item-name-content-index">{{ index + 1
                                            }}.</span>
                                        <span class="resource-detail-list-item-name-content-title">{{ "《" + item.title +
                                            "》" }}</span>
                                        <!--未播放-->
                                        <svg v-if="currentSource !== item.id" class="resource-detail-play-icon"
                                            viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M8 5v14l11-7z" />
                                        </svg>
                                        <!--未播放-->
                                        <svg v-if="currentSource == item.id && mediaStore.curMedia?.status === 0"
                                            class="resource-detail-play-icon resource-detail-play-icon--active"
                                            viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M8 5v14l11-7z" />
                                        </svg>
                                        <!--播放-->
                                        <svg v-if="currentSource == item.id && mediaStore.curMedia?.status === 1"
                                            class="resource-detail-play-icon resource-detail-play-icon--active"
                                            viewBox="0 0 24 24" fill="currentColor">
                                            <rect x="6" y="5" width="4" height="14" rx="1" />
                                            <rect x="14" y="5" width="4" height="14" rx="1" />
                                        </svg>
                                    </div>
                                    <span class="resource-detail-list-item-name-type">{{ item.description }}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.resource-detail-page {
    display: flex;
    flex-direction: column;
    height: 100vh;
    font-family: PingFang SC, sans-serif;
}

.resource-detail-nav {
    position: relative;
    z-index: 20;
    flex-shrink: 0;
}

.resource-detail-scroll {
    flex: 1;
    height: 0;
    overflow-y: auto;
}

.resource-detail-container {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
}

.resource-detail-header {
    width: 100%;
    object-fit: contain;
}

.resource-detail-body {
    display: flex;
    flex-direction: column;
    gap: 30px;
    margin-top: -12px;
    border-radius: 12px;
    background: linear-gradient(180deg, #eff8ff 0%, #ffffff 27%);
    padding: 30px 24px;
    width: 100%;
}

.resource-detail-intro {
    display: flex;
    flex-direction: column;
    gap: 17px;
}

.resource-detail-intro-title {
    color: #191919;
    font-weight: 500;
    font-size: 18px;
    line-height: 18px;
}

.resource-detail-intro-desc {
    color: #191919;
    font-weight: normal;
    font-size: 13px;
    line-height: 18px;
}

.resource-detail-list {
    display: flex;
    flex-direction: column;
    gap: 17px;
}

.resource-detail-list-title {
    color: #191919;
    font-weight: 500;
    font-size: 18px;
    line-height: 18px;
}

.resource-detail-list-items {
    display: flex;
    flex-direction: column;
    gap: 26px;
}

.resource-detail-list-item {
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
    align-items: center;
    gap: 10px;
    color: #191919;
}

.resource-detail-list-item-active {
    color: #ff6600;
}

.resource-detail-list-item-name {
    display: flex;
    flex-direction: column;
    gap: 5px;
}

.resource-detail-list-item-name-content {
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
    align-items: center;
    gap: 6px;
}

.resource-detail-list-item-name-content-index {
    font-weight: 500;
    font-size: 14px;
}

.resource-detail-list-item-name-content-title {
    flex: 1;
    font-weight: 500;
    font-size: 14px;
}

.resource-detail-list-item-name-type {
    opacity: 0.6;
    margin-left: 20px;
    font-size: 11px;
    line-height: 11px;
}

.resource-detail-play-icon {
    flex-shrink: 0;
    width: 1.2rem;
    height: 1.2rem;
    color: #999999;
}

.resource-detail-play-icon--active {
    color: #ff6600;
}
</style>