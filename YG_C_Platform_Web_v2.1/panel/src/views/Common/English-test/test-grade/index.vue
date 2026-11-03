<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { initData, xj } from "../../../../stores";
import { NavigationBar, toast } from "xjiang-ui";
import { isMiniProgramEnv } from "../../../../utils";
import {
    fetchSpeakingEvaluationDetail,
    type SpeakingEvaluationDetail,
    type SpeakingEvaluationResultDetail
} from "@/utils/apis/englishTest";
import GradeEmpty from "./GradeEmpty.vue";
import GradeFail from "./GradeFail.vue";
import StarRate from "./StarRate.vue";

defineOptions({ name: "EnglishTestGradeDetailPage" });

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const gradeInfo = ref<SpeakingEvaluationDetail>({
    accuracyScore: "",
    completionScore: "",
    fluencyScore: "",
    score: "",
    createTime: "",
    sessionId: "",
    userEnglishLevel: "",
    levelDescription: "",
    wordsEncourage: "",
    totalQuestions: 0,
    error: "",
    sentenceDetail: [],
    resultDetail: [],
});
const shouldPoll = ref(true);
const isFailed = ref(false);
let intervalId: ReturnType<typeof setInterval> | null = null;

const gradeList = computed<SpeakingEvaluationResultDetail[]>(
    () => gradeInfo.value.resultDetail || [],
);

function formatDate(date: string): string {
    if (!date) return "";
    const timestamp = Number(date);
    const d = !isNaN(timestamp) && timestamp > 1000000000000
        ? new Date(timestamp)
        : new Date(date);
    if (isNaN(d.getTime())) return date;
    const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function onBack() {
    router.back();
}

async function fetchData() {
    const sessionId = route.query.sessionId;
    if (!sessionId) {
        return;
    }
    try {
        const res = await fetchSpeakingEvaluationDetail({ sessionId: String(sessionId) });
        if (res.status === 410) {
            isFailed.value = true;
            shouldPoll.value = false;
            return;
        }
        if (res.result?.content) {
            gradeInfo.value = res.result.content;
            if (res.result.content.error) {
                toast({ text: res.result.content.error });
            }
            shouldPoll.value = false;
        }
    } catch (e) {
        console.error("[EnglishTest] fetch detail failed", e);
    }
}

onMounted(() => {
    xj.hideNavigationBar();
    fetchData();
    intervalId = setInterval(() => {
        if (shouldPoll.value) {
            fetchData();
        }
    }, 3000);
});

onUnmounted(() => {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
});
</script>

<template>
    <div class="english-test-grade-page">
        <div v-if="!isMiniProgramEnv" class="english-test-grade-nav">
            <NavigationBar title="英语口语测评" :left="[{ key: 'back', onClick: onBack }]"
                :statusbar-height="initData?.statusBarHeight || 24" background-color="transparent" />
        </div>
        <template v-if="!shouldPoll && !isFailed">
            <div class="english-test-grade-scroll">
                <div class="english-test-grade-container">
                    <div class="english-test-grade-header">
                        <div class="english-test-grade-title">
                            <div class="english-test-grade-title-left">
                                <div class="english-test-grade-title-left-title">
                                    {{ t("English_test_grade") }}
                                </div>
                                <div class="english-test-grade-title-left-subtitle">
                                    {{ t("English_test_report_title") }}
                                </div>
                            </div>
                            <img class="english-test-grade-title-right"
                                src="https://agent-file-manger.tos-cn-shanghai.volces.com/agent-marchant-test/image%403x%20(1).png"
                                alt="" />
                        </div>
                        <div class="english-test-grade-rate">
                            <div class="english-test-grade-rate-title">
                                {{ gradeInfo.wordsEncourage }}
                            </div>
                            <div class="english-test-grade-rate-list">
                                <div v-for="item in gradeList" :key="item.category"
                                    class="english-test-grade-rate-item">
                                    <div class="english-test-grade-rate-item-title">
                                        {{ item.category }}
                                    </div>
                                    <StarRate class="english-test-grade-rate-item-stars" :value="item.starRating"
                                        readonly allow-half />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="english-test-grade-card">
                        <div class="english-test-grade-list">
                            <div v-for="item in gradeList.filter((i) => i.category !== '综合')" :key="item.category"
                                class="english-test-grade-list-item">
                                <div class="english-test-grade-list-item-title">
                                    {{ item.category }}
                                </div>
                                <div class="english-test-grade-list-item-desc">
                                    <p class="english-test-grade-list-item-desc-text">
                                        {{ item.description || "暂无评价和建议" }}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="english-test-grade-card">
                        <div class="english-test-grade-list">
                            <div class="english-test-grade-list-item">
                                <div class="english-test-grade-list-item-title orange-btn">
                                    <span>评价和建议</span>
                                </div>
                                <div class="english-test-grade-list-item-desc">
                                    <p class="english-test-grade-list-item-desc-text">
                                        {{
                                            gradeList.find((item) => item.category.indexOf("综合") > -1)
                                                ?.description || "暂无评价和建议"
                                        }}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </template>
        <GradeEmpty v-else-if="shouldPoll && !isFailed" />
        <GradeFail v-else-if="!shouldPoll && isFailed" />
    </div>
</template>

<style lang="scss" scoped>
.english-test-grade-page {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background: linear-gradient(180deg, #fff3eb 0%, #f3f1fd 100%);
    font-family: PingFang SC, sans-serif;
}

.english-test-grade-nav {
    position: relative;
    z-index: 20;
    flex-shrink: 0;
}

.english-test-grade-scroll {
    flex: 1;
    height: 0;
    overflow-y: auto;
}

.english-test-grade-container {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 12px 30px;
}

.english-test-grade-header {
    border: 1px solid #ffffff;
    border-radius: 16px;
    background: linear-gradient(180deg, #fff3eb 0%, #ffffff 27%);
    padding-bottom: 30px;
    width: 100%;
}

.english-test-grade-card {
    border: 1px solid #ffffff;
    border-radius: 16px;
    background: #ffffff;
    width: 100%;
}

.english-test-grade-title {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    padding-left: 20px;
    width: 100%;
}

.english-test-grade-title-left {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.english-test-grade-title-left-title {
    color: #191919;
    font-weight: bold;
    font-size: 28px;
    line-height: 28px;
    letter-spacing: 0;
}

.english-test-grade-title-left-subtitle {
    color: #6a6a6a;
    font-weight: normal;
    font-size: 14px;
    line-height: 14px;
    letter-spacing: 0;
}

.english-test-grade-title-right {
    width: 100px;
    height: 100px;
    object-fit: contain;
}

.english-test-grade-rate {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 30px;
    margin-top: 40px;
}

.english-test-grade-rate-title {
    width: 80%;
    color: #191919;
    font-weight: 500;
    font-size: 18px;
    line-height: 24px;
    letter-spacing: 0;
    text-align: center;
}

.english-test-grade-rate-list {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 16px;
    width: 100%;
}

.english-test-grade-rate-item {
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    gap: 22px;
    width: 100%;
}

.english-test-grade-rate-item-title {
    width: 70px;
    color: #010101;
    font-weight: normal;
    font-size: 14px;
    line-height: 24px;
    letter-spacing: 0;
    text-align: right;
}

.english-test-grade-rate-item-stars {
    --rate-icon-empty-color: #eeeeee;
    --rate-icon-full-color: #ffd21e;
}

.english-test-grade-list {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 12px;
    padding: 24px 16px;
    width: 100%;
}

.english-test-grade-list-item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 14px;
    width: 100%;
}

.english-test-grade-list-item-title {
    color: #010101;
    font-weight: 500;
    font-size: 16px;
    line-height: 22px;
    letter-spacing: 0;
    text-align: center;
}

.english-test-grade-list-item-desc {
    border-radius: 12px;
    background: #f9f9f9;
    padding: 16px;
    width: 100%;
}

.english-test-grade-list-item-desc-text {
    margin: 0;
    color: rgba(1, 1, 1, 0.6);
    font-weight: normal;
    font-size: 14px;
    line-height: 24px;
    letter-spacing: 0;
}

.orange-btn {
    display: flex;
    justify-content: center;
    align-items: center;
    border-radius: 4px;
    background: rgba(255, 102, 0, 0.06);
    width: 100px;
    height: 28px;
    color: #ff6600;
    font-weight: 500;
    font-size: 16px;
    line-height: 18px;
    letter-spacing: 0;
}
</style>