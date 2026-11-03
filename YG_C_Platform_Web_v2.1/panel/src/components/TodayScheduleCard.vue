<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { info } from "../stores";
import {
    AlarmListItem,
    fetchAlarmList,
    toggleAlarm
} from "@/utils/apis/aiAlarmApi";
import { Icon, loading } from "xjiang-ui";
import alarmEmpty from "@/assets/images/ai-clock/alarm-empty.png";

/**
 * 今日安排（闹钟列表）通用卡片
 * 不依赖物模型，只依赖设备 info.did 与闹钟后端接口，可在任意设备插件复用。
 */
const props = withDefaults(
    defineProps<{
        /** 卡片标题 */
        title?: string;
        /** 「更多」跳转路由 */
        moreRoute?: string;
        /** 空态点击跳转的添加闹钟路由 */
        addRoute?: string;
        /** 轮询间隔（ms） */
        pollInterval?: number;
    }>(),
    {
        title: "今日安排",
        moreRoute: "/myClocks",
        addRoute: "/addAlarm",
        pollInterval: 60 * 1000
    }
);

const router = useRouter();

const alarmList = ref<AlarmListItem[]>([]);

const getAlarmList = async () => {
    const res = await fetchAlarmList({
        deviceId: info?.did,
        scope: "today"
    });
    if (res.code == 200) {
        alarmList.value = res.data || [];
    }
};

const toggleAlarmItem = async (item: AlarmListItem) => {
    const load = loading({ type: "loading" });
    const res = await toggleAlarm({
        deviceId: info?.did,
        scheduleId: item.scheduleId,
        enabled: item.enabled === 1 ? "0" : "1"
    });
    if (res.code == 200) {
        item.enabled = item.enabled === 1 ? 0 : 1;
    }
    load.close();
};

const formItemValidateStates = (value: string) => {
    if (!value) return "";
    // 从 "2026-06-10 07:00:00" 中提取 "07:00"
    const match = value.match(/\d{2}:\d{2}/);
    return match ? match[0] : value;
};

const didReady = ref(false);
let pollingTimer: ReturnType<typeof setInterval> | null = null;

const startPolling = () => {
    if (pollingTimer) return;
    pollingTimer = setInterval(() => {
        getAlarmList();
    }, props.pollInterval);
};

const stopPolling = () => {
    if (pollingTimer) {
        clearInterval(pollingTimer);
        pollingTimer = null;
    }
};

onMounted(() => {
    if (info.did) {
        didReady.value = true;
        getAlarmList();
        startPolling();
    }
});

onUnmounted(() => {
    stopPolling();
});

watch(
    () => info.did,
    newVal => {
        if (newVal && !didReady.value) {
            didReady.value = true;
            getAlarmList();
            startPolling();
        }
    }
);
</script>

<template>
    <div class="bg-white rounded-2xl p-5 shadow-sm z-10">
        <div class="flex justify-between items-center">
            <h2 class="text-[1.14rem] font-semibold text-gray-900">{{ props.title }}</h2>
            <div class="flex items-center text-gray-500 text-sm" @click="router.push(props.moreRoute)">
                <span>更多</span>
                <svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                </svg>
            </div>
        </div>

        <div v-if="alarmList.length > 0">
            <!-- 循环渲染闹钟列表 -->
            <div v-for="(item, index) in alarmList" :key="index">
                <div class="flex justify-between items-center py-4"
                    :class="{ 'border-b border-gray-100': index !== alarmList.length - 1 }">
                    <div>
                        <div class="flex items-center gap-3">
                            <span class="text-[2rem] font-bold text-gray-900"> {{
                                formItemValidateStates(item.execStartTime)
                                }}</span>
                            <!-- 动态标签颜色 -->
                            <span class="flex items-center gap-1 px-3 py-1 rounded-full text-sm" :class="[
                                item.template.templateCode === 'wakeup' ? 'bg-green-50 text-[#34C759]' :
                                    item.template.templateCode === 'study' ? 'bg-red-50 text-[#FB2C00]' :
                                        item.template.templateCode === 'goodnight' ? 'bg-indigo-50 text-[#937DF6]' :
                                            item.template.templateCode === 'reading' ? 'bg-blue-50 text-[#458CFF]' :
                                                item.template.templateCode === 'sport' ? 'bg-amber-50 text-[#FFA500]' :
                                                    'bg-[#FFF3FE] text-[#F46CED]'
                            ]">
                                <Icon v-if="item.template.templateCode === 'wakeup'" name="icon-qichuang"
                                    width="0.85rem" height="0.85rem" color="#34C759" />
                                <Icon v-if="item.template.templateCode === 'study'" name="icon-xuexi" width="0.85rem"
                                    height="0.85rem" color="#FB2C00" />
                                <Icon v-if="item.template.templateCode === 'goodnight'" name="icon-wanan"
                                    width="0.85rem" height="0.85rem" color="#937DF6" />
                                <Icon v-if="item.template.templateCode === 'reading'" name="icon-kanshu" width="0.85rem"
                                    height="0.85rem" color="#458CFF" />
                                <Icon v-if="item.template.templateCode === 'sport'" name="icon-yundong" width="0.85rem"
                                    height="0.85rem" color="#FFA500" />
                                <Icon v-if="item.template.templateCode === ''" name="icon-zidingyi" width="0.85rem"
                                    height="0.85rem" color="#F46CED" />
                                {{ item.template.templateName || "自定义" }}
                            </span>
                        </div>
                        <p class="text-gray-500 mt-2 text-sm">{{ item.theme + '，' + item.repeatDesc }}</p>
                    </div>

                    <!-- 开关组件，点击切换状态 -->
                    <div @click="toggleAlarmItem(item)"
                        class="w-[40px] h-[22px] rounded-full flex items-center px-1 transition-all cursor-pointer"
                        :class="[item.enabled === 1 ? 'schedule-toggle-on justify-end' : 'bg-gray-300 justify-start']">
                        <div class="w-[14px] h-[14px] bg-white rounded-full"></div>
                    </div>
                </div>
            </div>
        </div>

        <section v-else class="flex justify-center py-8 flex-col items-center" @click="router.push(props.addRoute)">
            <img :src="alarmEmpty" alt="暂无闹钟" style="width: 100px; height: 100px;" />
            <div class="text-sm text-gray-500">当前暂无安排，快去<span class="schedule-add-link">添加闹钟</span></div>
        </section>
    </div>
</template>

<style lang="scss" scoped>
.schedule-toggle-on {
    background-color: var(--active-color);
}

.schedule-add-link {
    color: var(--active-color);
}
</style>