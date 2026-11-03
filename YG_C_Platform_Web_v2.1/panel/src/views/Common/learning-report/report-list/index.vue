<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { initData, info, xj } from "../../../../stores";
import { centerConfirmDialog, NavigationBar, toast } from "xjiang-ui";
import { isMiniProgramEnv } from "../../../../utils";
import SwipeDeleteList from "@/components/SwipeDeleteList.vue";

import { getToken, } from "@/utils/nativeApiRequestHeaders";
import GradeEmpty from "./Empty.vue";
import reportIcon from "@/assets/images/report/report.png";
import { deleteDeviceUsageReport, getHistoryList, weeklyReports, deleteHistoryReport } from "@/utils/apis/report";
import dayjs from 'dayjs'
defineOptions({ name: "EnglishTestGradeListPage" });

const router = useRouter();
const { t } = useI18n();

const historyList = ref<weeklyReports[]>([


]);
const loading = ref(false);

const sortedList = computed(() => {
    return [...historyList.value].sort((a, b) => b.id - a.id);
});
// 格式化：本地时区  YYYY-MM-DD HH:mm:ss
function formatUtcDate(utcStr: string) {
    if (!utcStr) {
        return ""
    }
    return dayjs(utcStr).format('MM.DD')
}
function formatStartDate(utcStr: string) {
    if (!utcStr) {
        return ""
    }
    return dayjs(utcStr).format('YYYY.MM.DD')
}
async function loadList() {
    const pid = info?.pid;
    const did = info?.did;

    loading.value = true;
    try {
        const res = await getHistoryList({
            deviceId: did,
            type: activeType.value,
        });
        if (res.ok) {
            if (activeType.value === "week") {
                historyList.value = res.result?.content?.weeklyReports || [];
            } else {
                historyList.value = res.result?.content?.monthlyReports || [];
            }

        } else {
            historyList.value = [];
        }
    } finally {
        loading.value = false;
    }
}
const handleDelete = (item: weeklyReports) => {
    centerConfirmDialog({
        title: '删除提醒',
        message: '确认删除当前测评报告记录，删除后将不可恢复，请谨慎操作',
        cancelText: '取消',
        confirmText: '确认',
        onConfirm: () => {

            deleteDeviceUsageReport({
                reportId: item.id,
                period_type: activeType.value,
            }).then((res) => {
                if (res.ok) {
                    toast({ text: '删除成功' });
                    console.log("--deleteItem---->", res)
                    loadList();

                } else {
                    toast({ text: '删除失败' });
                }
            })

            deleteHistoryReport({
                period_type: activeType.value,
                date: item.periodStart
            }).then((res) => {
                if (res.ok) {
                    console.log("--deleteHistoryReport success---->")

                } else {
                    console.log("--deleteHistoryReport fail---->",)
                }
            })
        }
    })
}
async function onOpenLearningReport(item: weeklyReports) {
    const platformBase = String(
        import.meta.env.VITE_APP_PLATFORM_BASE ?? "",
    ).replace(/\/+$/, "");
    if (!platformBase) {
        console.warn("[aiLamp] VITE_APP_PLATFORM_BASE is not set");
        return;
    }
    const url = new URL(activeType.value === "week" ? "/week-report" : "/month-report", platformBase);
    const did = info?.did ?? "";
    if (did) url.searchParams.set("did", did);
    if (item.periodStart) url.searchParams.set("date", item.periodStart);
    const token = await getToken();
    url.searchParams.set("token", token);
    url.searchParams.set("_t", String(Date.now()));
    router.push({
        name: "learningReport",
        query: { url: encodeURIComponent(url.toString()) },
    });
}
function onViewResult(item: weeklyReports) {
    onOpenLearningReport(item);
}
type ReportType = "week" | "month";
const activeType = ref<ReportType>("week");
const setType = (type: ReportType) => {
    if (activeType.value === type) return;
    activeType.value = type;
    loadList();
};
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

        <div class="learning-report-toggle">
            <div class="learning-report-toggle-indicator"
                :class="{ 'learning-report-toggle-indicator--month': activeType === 'month' }"></div>
            <div class="learning-report-toggle-item"
                :class="{ 'learning-report-toggle-item--active': activeType === 'week' }" @click="setType('week')">
                周报
            </div>
            <div class="learning-report-toggle-item"
                :class="{ 'learning-report-toggle-item--active': activeType === 'month' }" @click="setType('month')">
                月报
            </div>
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
                                        <img class="english-grade-item-card-img" :src="reportIcon" alt="" />
                                    </div>
                                    <div class="english-grade-item-text">
                                        <div class="english-grade-item-text-title">
                                            {{ item.reportType === 'WEEK' ? '周报' : '月报' }}
                                        </div>
                                        <div class="english-grade-item-text-line">{{ (formatStartDate(item.periodStart
                                            ||
                                            "") || "") + "-" +
                                            (formatUtcDate(item.periodEnd || "") || "") }}
                                        </div>
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
    background-image: url("@/assets/images/report/bg.png");
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
    padding-top: 12px;
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
    background: #FFF7DC;
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

.english-grade-item-text-title {
    font-family: PingFang SC;
    font-size: 16px;
    font-weight: 500;
    color: #0B0A0A;
}

.english-grade-item-btn {
    display: flex;
    justify-content: center;
    align-items: center;
    border: none;
    border-radius: 30px;
    background: #FFF7DC;
    padding: 4px 16px;

    cursor: pointer;
}

.english-grade-item-btn-text {
    color: #000000;
    font-size: 12px;
    line-height: 18px;
    letter-spacing: 0;
    text-align: center;
}

.learning-report-toggle {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    margin: 24px auto;
    border-radius: 45px;
    background: #fff;
    padding: 0px;
    width: fit-content;
}

.learning-report-toggle-indicator {
    position: absolute;
    top: 0;
    left: 0;
    border-radius: 45px;
    background: #FAE290;
    width: 50%;
    height: 100%;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
    transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.learning-report-toggle-indicator--month {
    transform: translateX(100%);
}

.learning-report-toggle-item {
    position: relative;
    z-index: 1;
    border-radius: 45px;
    padding: 8px 32px;
    color: rgba(0, 0, 0, 0.6);
    font-size: 14px;
    line-height: 20px;
    cursor: pointer;
    transition: color 0.25s ease;
}

.learning-report-toggle-item--active {
    color: #000000;
}
</style>