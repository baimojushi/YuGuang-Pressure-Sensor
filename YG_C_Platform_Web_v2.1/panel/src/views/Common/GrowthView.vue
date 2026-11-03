<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { xj, data, initData, info } from "../../stores";
import iconChildrenSong from "@/assets/images/resources/儿歌@3x.png";
import iconStory from "@/assets/images/resources/讲故事@3x.png";
import iconEnglishSong from "@/assets/images/resources/英文歌@3x.png";
import iconChinese from "@/assets/images/resources/大语文@3x.png";
import iconCantonese from "@/assets/images/resources/K12英语@3x.png";
import alarmClock from '@/assets/images/ai-clock/base-clock.png'
import { fetchMockApiRequestHeaders, fetchRnNativeApiRequestHeaders } from "@/utils/nativeApiRequestHeaders";
import MediaPlayer from "./components/media-player/index.vue";
import { getPlayTimeInfo } from "@/utils/apis/aiAlarmApi";
import { toast } from "xjiang-ui";
import RecommendResourcesCard from "../../components/RecommendResourcesCard.vue";
const router = useRouter();
const { t } = useI18n();

interface CategoryItem {
    key: string;
    label: string;
    icon: string;
}

const categories: CategoryItem[] = [
    { key: "childrenSong", label: t("aiclock.category.childrenSong"), icon: iconChildrenSong },
    { key: "story", label: t("aiclock.category.story"), icon: iconStory },
    { key: "englishSong", label: t("aiclock.category.englishSong"), icon: iconEnglishSong },
    { key: "chinese", label: t("aiclock.category.chinese"), icon: iconChinese },
    { key: "cantonese", label: t("aiclock.category.cantonese"), icon: iconCantonese },
];

async function onOpenLearningReport() {
    const platformBase = String(
        import.meta.env.VITE_APP_PLATFORM_BASE ?? "",
    ).replace(/\/+$/, "");
    if (!platformBase) {
        console.warn("[aiLamp] VITE_APP_PLATFORM_BASE is not set");
        return;
    }
    const url = new URL("/week-report", platformBase);
    const did = info?.did ?? "";
    if (did) url.searchParams.set("did", did);
    const h = await fetchMockApiRequestHeaders();
    for (const [key, value] of Object.entries(h)) {
        if (value == null || value === "") continue;
        url.searchParams.set(key, value);
    }
    router.push({
        name: "learningReport",
        query: { url: encodeURIComponent(url.toString()) },
    });
}
function onOpenLearningReportList() {
    // toast({ text: '成长报告暂未开放' })
    // return

    router.push({
        name: "learningReportList",
    });
}
const onCategoryClick = (category: CategoryItem) => {
    console.log("category click:", category.key);
    router.push({ name: "resourceList", query: { label: category.label } });
};

const onViewEnglishReport = () => {
    router.push({ name: "englishTestGradeList" });
};

const onViewGrowthReport = () => {
    console.log("view growth report");
    onOpenLearningReport();
};
interface ListenTimeInfo {
    totalLeft: number
    used: number
    percent: number
}
// 时长数据
const listenData = ref<ListenTimeInfo>({
    totalLeft: 0,
    used: 0,
    percent: 0
})

const getListenData = async () => {
    const res = await getPlayTimeInfo({
        pid: info?.pid,
        did: info?.did,
    })
    if (res.ok) {
        console.log("--getPlayTimeInfo---->", res)
        listenData.value.totalLeft = res.result?.remainingDuration || 0
        listenData.value.used = res.result?.todayPlayedDuration || 0
        listenData.value.percent = res.result?.playPercentage || 0
    }
}
const didReady = ref(false);
onMounted(() => {
    if (!info.did) return;
    didReady.value = true;
    getListenData();
});

watch(() => info.did, (newVal) => {
    if (newVal && !didReady.value) {
        didReady.value = true;
        getListenData();
    }
});
</script>

<template>
    <div class="aiclock-tab-page">
        <!-- 顶部时长卡片 -->
        <div class="bg-white rounded-2xl  shadow-sm z-10 overflow-hidden">
            <div class="flex justify-between items-stretch gap-4 ">
                <div class="p-5">
                    <p class="text-gray-900 text-[1.14rem] font-medium">今日还能听</p>
                    <div class="flex items-baseline mt-2">
                        <span class="text-[2.5rem] font-bold text-gray-900">{{ listenData.totalLeft }}</span>
                        <span class="text-xl ml-2 text-gray-700">分钟</span>
                    </div>
                    <div class="flex justify-between mt-4 text-gray-500 text-sm">
                        <span>已用{{ listenData.used }}分钟</span>
                        <span>{{ listenData.percent }}%</span>
                    </div>
                    <!-- 进度条 -->
                    <div class="w-full h-2 bg-gray-200 rounded-full mt-2 overflow-hidden" style="width: 180px;">
                        <div class="h-full bg-red-500 rounded-full transition-all"
                            :style="{ width: `${listenData.percent}%` }">
                        </div>
                    </div>
                </div>

                <div class="clockDocker">
                    <div class="relative flex items-end justify-center " style="width: 155px; height: 67px;">
                        <!-- 粉色椭圆 -->
                        <div class="absolute inset-0 rounded-[50%] bg-[#FB5E3D] opacity-10"></div>
                        <!-- 内层闹钟盒子 90px × 103.5px -->
                        <div class="relative mb-4" style="width: 90px; height: 122px;">
                            <img :src="alarmClock" alt="超级飞侠闹钟" class="w-full h-full object-contain clock" />
                        </div>
                    </div>

                </div>

            </div>
        </div>
        <!-- 资源分类 -->
        <div class="content-card category-card">
            <div class="category-grid">
                <div v-for="category in categories" :key="category.key" class="category-item"
                    @click="onCategoryClick(category)">
                    <img :src="category.icon" alt="" class="category-item__icon" />
                    <span class="category-item__label">{{ category.label }}</span>
                </div>
            </div>
        </div>

        <!-- 推荐资源 -->
        <RecommendResourcesCard />

        <!-- 报告卡片 -->
        <div class="report-grid">
            <div class="report-card report-card--english" @click="onViewEnglishReport">
                <div class="report-card__content">
                    <div class="report-card__title">{{ t("aiclock.englishTestReport") }}</div>
                    <div class="report-card__subtitle">{{ t("aiclock.funTest") }}</div>
                    <button class="report-card__btn report-card__btn--orange" @click.stop="onViewEnglishReport">
                        {{ t("aiclock.viewReport") }}
                    </button>
                </div>
                <div class="report-card__illustration">
                    <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="20" y="12" width="44" height="56" rx="6" fill="#FF8A4C" />
                        <rect x="26" y="22" width="32" height="4" rx="2" fill="#fff" fill-opacity="0.6" />
                        <rect x="26" y="32" width="24" height="4" rx="2" fill="#fff" fill-opacity="0.6" />
                        <rect x="26" y="42" width="28" height="4" rx="2" fill="#fff" fill-opacity="0.6" />
                        <circle cx="52" cy="54" r="12" fill="#FFE4D1" />
                        <path d="M46 54l4 4 8-8" stroke="#FF6B35" stroke-width="2.5" stroke-linecap="round"
                            stroke-linejoin="round" />
                    </svg>
                </div>
            </div>

            <div class="report-card report-card--growth" @click="onOpenLearningReportList">
                <div class="report-card__content">
                    <div class="report-card__title">{{ t("aiclock.growthReport") }}</div>
                    <div class="report-card__subtitle">{{ t("aiclock.growthReportDesc") }}</div>
                    <button class="report-card__btn report-card__btn--purple" @click.stop="onOpenLearningReportList">
                        {{ t("aiclock.viewReport") }}
                    </button>
                </div>
                <div class="report-card__illustration">
                    <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="20" y="12" width="44" height="56" rx="6" fill="#9B8AFB" />
                        <rect x="26" y="22" width="32" height="4" rx="2" fill="#fff" fill-opacity="0.6" />
                        <rect x="26" y="32" width="24" height="4" rx="2" fill="#fff" fill-opacity="0.6" />
                        <path d="M28 50l8-8 6 6 10-12" stroke="#fff" stroke-width="3" stroke-linecap="round"
                            stroke-linejoin="round" />
                        <circle cx="56" cy="20" r="10" fill="#E0DCFF" />
                        <path d="M52 20l3 3 6-6" stroke="#7B61FF" stroke-width="2.5" stroke-linecap="round"
                            stroke-linejoin="round" />
                    </svg>
                </div>
            </div>
        </div>

    </div>
</template>

<style lang="scss" scoped>
.aiclock-tab-page {
    display: flex;
    flex-direction: column;
    gap: 0.8571rem;
    padding: 1rem;
    padding-bottom: 9.5rem;
    min-height: 100vh;
    background: linear-gradient(180deg, #eef2fd 0%, #f8f8f8 56%);

    &::before {
        content: "";
        position: absolute;
        top: -1.6429rem;
        left: -1rem;
        width: 11.3571rem;
        height: 15.4286rem;
        border-radius: 50%;
        background: #dbebfa;
        filter: blur(71px);
        pointer-events: none;
        z-index: 1;
    }
}

.content-card {
    background: #ffffff;
    z-index: 2;
    border-radius: 1rem;
    padding: 1rem;
    box-shadow: 0px 8px 20px 0px rgba(208, 90, 11, 0.06);
}

.category-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 0.5rem;
}

.category-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;

    &__icon {
        width: 3.43rem;
        height: 3.43rem;
        object-fit: contain;
    }

    &__label {
        font-size: 0.85rem;
        color: #0B0A0A;
        font-weight: 500;
        line-height: 1.2;
    }
}

.clockDocker {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: center;
    margin-bottom: 5px;
    margin-right: -22px;
}

.report-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.625rem;
}

.report-card {
    position: relative;
    border-radius: 1rem;
    padding: 0.875rem;
    min-height: 7.5rem;
    overflow: hidden;
    cursor: pointer;

    &--english {
        background: linear-gradient(135deg, #fff8f0 0%, #ffe8d6 100%);

        .report-card__title {
            color: #ff6b35;
        }

        .report-card__subtitle {
            color: #ff9f6b;
        }
    }

    &--growth {
        background: linear-gradient(135deg, #f3f1ff 0%, #e6e2ff 100%);

        .report-card__title {
            color: #7b61ff;
        }

        .report-card__subtitle {
            color: #9b8afb;
        }
    }

    &__content {
        position: relative;
        z-index: 1;
    }

    &__title {
        font-size: 0.9375rem;
        font-weight: 600;
        line-height: 1.3;
    }

    &__subtitle {
        margin-top: 0.25rem;
        font-size: 0.6875rem;
        line-height: 1.3;
    }

    &__btn {
        margin-top: 0.625rem;
        padding: 0.375rem 0.75rem;
        border-radius: 9999px;
        border: none;
        font-size: 0.75rem;
        font-weight: 500;
        color: #ffffff;
        cursor: pointer;

        &--orange {
            background: linear-gradient(90deg, #ff8a4c 0%, #ff6b35 100%);
        }

        &--purple {
            background: linear-gradient(90deg, #9b8afb 0%, #7b61ff 100%);
        }
    }

    &__illustration {
        position: absolute;
        right: 0.25rem;
        bottom: 0.25rem;
        width: 4.5rem;
        height: 4.5rem;
        opacity: 0.9;

        svg {
            width: 100%;
            height: 100%;
        }
    }
}
</style>