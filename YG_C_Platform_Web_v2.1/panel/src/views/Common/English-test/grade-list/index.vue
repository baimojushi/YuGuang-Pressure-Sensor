<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { initData, info, xj } from "../../../../stores";
import { centerConfirmDialog, NavigationBar, toast } from "xjiang-ui";
import { isMiniProgramEnv } from "../../../../utils";
import SwipeDeleteList from "@/components/SwipeDeleteList.vue";
import {
    fetchSpeakingEvaluationResultList,
    deleteSpeakingEvaluationResult,
    type SpeakingEvaluationItem,
} from "@/utils/apis/englishTest";
import GradeEmpty from "./GradeEmpty.vue";

defineOptions({ name: "EnglishTestGradeListPage" });

const router = useRouter();
const { t } = useI18n();

const gradeList = ref<SpeakingEvaluationItem[]>([

]);
const loading = ref(false);

const sortedList = computed(() => {
    return [...gradeList.value].sort((a, b) => b.id - a.id);
});

async function loadList() {
    const pid = info?.pid;
    const did = info?.did;

    loading.value = true;
    try {
        const res = await fetchSpeakingEvaluationResultList({
            pid: Number(pid) || 0,
            did: Number(did) || 0,
        });
        if (res.result?.content && res.result.content.length > 0) {
            gradeList.value = res.result.content;
        }
    } finally {
        loading.value = false;
    }
}
const handleDelete = (item: SpeakingEvaluationItem) => {
    centerConfirmDialog({
        title: '删除提醒',
        message: '确认删除当前测评报告记录，删除后将不可恢复，请谨慎操作',
        cancelText: '取消',
        confirmText: '确认',
        onConfirm: () => {

            deleteSpeakingEvaluationResult({
                reportId: item.id
            }).then((res) => {
                if (res.ok) {
                    toast({ text: '删除成功' });
                    console.log("--deleteItem---->", res)
                    loadList();
                } else {
                    toast({ text: '删除失败' });
                }
            })
        }
    })
}
function onViewResult(item: SpeakingEvaluationItem) {
    router.push({
        name: "englishTestGrade",
        query: { sessionId: item.sessionId },
    });
}

onMounted(() => {
    xj.hideNavigationBar();
    loadList();
});
</script>

<template>
    <div class="english-grade-list-page">
        <div v-if="!isMiniProgramEnv" class="english-grade-list-nav">
            <NavigationBar :statusbar-height="initData?.statusBarHeight || 24" background-color="transparent"
                :title="t('English_test_history')" />
        </div>

        <div class="english-grade-list-container">
            <div v-if="loading" class="english-grade-list-loading">
                {{ t("aiclock.loading") }}
            </div>
            <template v-else>

                <div v-if="sortedList.length > 0" class="english-grade-list-scroll">

                    <SwipeDeleteList :list="sortedList" key-field="id" :delete-width="80" :delete-threshold="40"
                        delete-text="删除" delete-bg-color="#fb2c00" card-bg-color="#ffffff" rounded="16px"
                        margin-bottom="16px" padding-class="p-5" @delete="handleDelete" @click="onViewResult">
                        <template #default="{ item }">
                            <div class="english-grade-item">
                                <div class="english-grade-item-main">
                                    <div class="english-grade-item-card">
                                        <img class="english-grade-item-card-img"
                                            src="https://agent-file.xjiangiot.com/voice/tts/0/uploads/1761029614632-record.png"
                                            alt="" />
                                    </div>
                                    <div class="english-grade-item-text">
                                        <div class="english-grade-item-text-line">
                                            {{ t("english_test_current_star") }}
                                            <span class="english-grade-item-text-grade">
                                                {{ Number(item.starRating || 0).toFixed(0) }}
                                            </span>
                                        </div>
                                        <div class="english-grade-item-text-line">{{ item.createTime }}</div>
                                    </div>
                                </div>
                                <button type="button" class="english-grade-item-btn" @click="onViewResult(item)">
                                    <span class="english-grade-item-btn-text">{{ t("view_result") }}</span>
                                </button>
                            </div>
                        </template>
                    </SwipeDeleteList>
                </div>
                <div v-else class="english-grade-list-empty-box">
                    <div class="english-grade-list-empty">
                        <GradeEmpty />
                    </div>
                </div>

            </template>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.english-grade-list-page {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background-image: url("https://agent-file.xjiangiot.com/voice/tts/0/uploads/1762407793013-%E6%B8%90%E5%8F%98%E8%83%8C%E6%99%AF@3x.png");
    background-size: 100% 100%;
    background-repeat: no-repeat;
    font-family: PingFang SC, sans-serif;
    overflow-x: hidden;
}

.english-grade-list-nav {
    position: relative;
    z-index: 20;
    flex-shrink: 0;
}

.english-grade-list-container {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    gap: 30px;
    padding-top: 1rem;
}

.english-grade-list-title {
    font-family: Alimama ShuHeiTi;
    font-size: 28px;
    font-weight: bold;
    line-height: 28px;
    letter-spacing: 0px;
    padding: 12px;
    font-variation-settings: "opsz" auto;
    font-feature-settings: "kern" on;
    color: #191919;
}

.english-grade-list-loading {
    border-radius: 16px;
    background: #ffffff;
    padding: 24px;
    width: 100%;
    text-align: center;
    color: #999999;
    font-size: 14px;
}

.english-grade-list-scroll {
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    overflow-y: auto;
    border-radius: 16px;
    width: 100%;
}

.english-grade-list-empty-box {
    width: 100%;
    padding: 12px;
}

.english-grade-list-empty {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    border-radius: 16px;
    background: #ffffff;
    padding: 12px;
    width: 100%;
    min-height: calc(100vh - 200px);
}

.english-grade-item {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    width: 100%;
}

.english-grade-item-main {
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
    align-items: center;
    gap: 12px;
}

.english-grade-item-card {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    border-radius: 12px;
    background: #fff3eb;
    width: 76px;
    height: 80px;
}

.english-grade-item-card-img {
    width: 48px;
    height: 48px;
}

.english-grade-item-text {
    display: flex;
    flex-direction: column;
    gap: 10px;
    color: rgba(61, 61, 61, 0.6);
    font-weight: 400;
    font-size: 13px;
    line-height: 24px;
}

.english-grade-item-text-grade {
    color: #3d3d3d;
    font-weight: 500;
    font-size: 16px;
}

.english-grade-item-btn {
    display: flex;
    justify-content: center;
    align-items: center;
    border: none;
    border-radius: 30px;
    background: #fff3eb;
    width: 80px;
    height: 26px;
    cursor: pointer;
}

.english-grade-item-btn-text {
    color: #ff6600;
    font-size: 12px;
    line-height: 12px;
    letter-spacing: 0;
    text-align: center;
}
</style>