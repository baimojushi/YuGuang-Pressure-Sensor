<script setup lang="ts">
import { nextTick, onMounted, ref, watch, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { info } from "../../stores";
import { getConvoList, type ConvoRecord } from "@/utils/apis/rtc";
import yoyoIcon from "@/assets/images/yoyo/yoyo.png";
import yoyoShadow from "@/assets/images/yoyo/yoyo-shadow.png";
import { fetchTerminalUserInfo, TerminalUserInfoContent } from "@/utils/apis/aiAlarmApi";
import { loading, theme } from "xjiang-ui";
import iconEmotionHappy from "@/assets/images/yoyo/emoGif/happy.gif";
import iconEmotionTrust from "@/assets/images/yoyo/emoGif/trust.gif";
import iconEmotionFear from "@/assets/images/yoyo/emoGif/fear.gif";
import iconEmotionAmaze from "@/assets/images/yoyo/emoGif/amaze.gif";
import iconEmotionSad from "@/assets/images/yoyo/emoGif/sad.gif";
import iconEmotionHate from "@/assets/images/yoyo/emoGif/hate.gif";
import iconEmotionAngry from "@/assets/images/yoyo/emoGif/angry.gif";
import iconEmotionWish from "@/assets/images/yoyo/emoGif/hope.gif";

const { t } = useI18n();

const load = loading({ type: "loading" });
// 加载更多历史的loading
const loadMoreLoading = ref(false);
const cursor = ref<[number, string]>([0, ""]);
const records = ref<ConvoRecord[]>([

]);
const scrollRef = ref<HTMLElement | null>(null);
// 是否还有更早数据
const hasMore = ref(true);

const scrollToBottom = async () => {
    console.log("scrollToBottom");
    await nextTick();
    const el = scrollRef.value;
    if (el) {
        el.scrollTop = el.scrollHeight;
    }
};

// 加载最新消息（初始化/切换did）
const fetchConvoList = async (shouldScrollToBottom = true, showLoading = true) => {
    try {
        const res = await getConvoList({
            did: info.did,
            beforeId: null,
            afterId: null,
            limit: 20,
        });
        if (res.status === 0 && res.result?.records) {
            // 接口返回是倒序，反转后最新在数组末尾
            records.value = [...res.result.records].reverse();
            // 判断是否还有更早数据
            hasMore.value = res.result.records.length >= 20;
            if (shouldScrollToBottom) {
                await scrollToBottom();
            }
            // 保存下一页游标
            cursor.value = res.result.nextCursor || [0, ""];
        }
    } finally {
        if (showLoading) {
            load.close();
        }
    }
};

// 定时拉取新增消息，基于最新一条 ID 追加，不覆盖历史记录
const fetchLatestConvoList = async () => {
    if (records.value.length === 0) {
        await fetchConvoList(false, false);
        return;
    }
    const lastRecordId = records.value[records.value.length - 1].id;
    const startTime = records.value[records.value.length - 1].created_at;
    try {
        const res = await getConvoList({
            did: info.did,
            beforeId: lastRecordId,
            afterId: null,
            limit: 20,
            startTime: startTime + 5, // 避免重复拉取最后一条

        });
        if (res.status === 0 && res.result?.records) {
            const newList = [...res.result.records].reverse();
            if (newList.length > 0) {
                records.value = [...records.value, ...newList];
            }

        }
    } catch (error) {
        console.error("fetchLatestConvoList failed", error);
    }
};

// 加载更早历史记录（滚动到顶部触发）
const loadMoreHistory = async () => {
    if (loadMoreLoading.value || !hasMore.value || records.value.length === 0) return;
    loadMoreLoading.value = true;
    try {
        // 取当前第一条消息id作为beforeId，查询更早数据
        const firstRecordId = records.value[0].id;
        const res = await getConvoList({
            did: info.did,
            afterId: firstRecordId,
            limit: 20,
            //cursor
            searchAfter: cursor.value,
        });
        if (res.status === 0 && res.result?.records) {
            const oldList = [...res.result.records].reverse();
            // 没有拉取到数据，标记无更多
            if (oldList.length === 0) {
                hasMore.value = false;
                return;
            }
            // 保存当前滚动高度 + 内容高度差值，加载后维持视口位置
            const scrollEl = scrollRef.value;
            const oldScrollHeight = scrollEl?.scrollHeight || 0;

            // 旧数据拼在数组前面
            records.value = [...oldList, ...records.value];
            // 更新是否还有更多
            hasMore.value = res.result.records.length >= 20;
            // 保存下一页游标
            cursor.value = res.result.nextCursor || [0, ""];
            await nextTick();
            // 加载历史后不自动滚到底，维持原有浏览位置
            if (scrollEl) {
                scrollEl.scrollTop = scrollEl.scrollHeight - oldScrollHeight;
            }
        }
    } finally {
        loadMoreLoading.value = false;
    }
};

// 滚动监听处理
const handleScroll = () => {
    const el = scrollRef.value;
    if (!el) return;
    // 距离顶部 30px 阈值触发加载更多
    const isTop = el.scrollTop <= 30;
    if (isTop) {
        loadMoreHistory();
    }
};
const userInfo = ref<TerminalUserInfoContent>({} as TerminalUserInfoContent);
// 获取用户信息
const getUserInfo = async () => {
    const res = await fetchTerminalUserInfo();
    if (res.status === 0 && res.result?.content) {
        userInfo.value = res.result.content;
    }
};
const didReady = ref(false);
let autoRefreshTimer: ReturnType<typeof setInterval> | null = null;

// 启动自动刷新，每1分钟拉取最新会话数据（追加新消息，不覆盖历史）
const startAutoRefresh = () => {
    stopAutoRefresh();
    autoRefreshTimer = setInterval(() => {
        fetchLatestConvoList();
    }, 6000);
};

const stopAutoRefresh = () => {
    if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
        autoRefreshTimer = null;
    }
};
theme.setTheme("#F90626");
onMounted(() => {
    if (!info.did) return;
    didReady.value = true;
    fetchConvoList();
    getUserInfo();
    startAutoRefresh();
    // 绑定滚动事件
    scrollRef.value?.addEventListener("scroll", handleScroll);
});

// 组件销毁移除监听，防止内存泄漏
onUnmounted(() => {
    stopAutoRefresh();
    scrollRef.value?.removeEventListener("scroll", handleScroll);
});

watch(() => info.did, (newVal) => {
    if (newVal && !didReady.value) {
        didReady.value = true;
        // 切换设备重置分页状态
        hasMore.value = true;
        records.value = [];
        fetchConvoList();
    }
});

const formateEmotion = (content: string) => {
    const map: Record<string, string> = {
        "1": iconEmotionHappy, // 喜悦
        "2": iconEmotionTrust, // 信任
        "3": iconEmotionFear, // 恐惧
        "4": iconEmotionAmaze, // 惊讶
        "5": iconEmotionSad, // 悲伤
        "6": iconEmotionHate, // 厌恶
        "7": iconEmotionAngry, // 愤怒
        "8": iconEmotionWish, // 期待
    };
    return map[content] || iconEmotionSad;
}

const formatTime = (ts: number) => {
    if (!ts) return "";
    const d = new Date(ts);
    const pad = (n: number) => String(n).padStart(2, "0");
    return ` ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
</script>

<template>
    <div class="aiclock-tab-page">
        <div ref="scrollRef" class="aiclock-chat-scroll p-5 ">
            <div class="flex flex-col gap-4">
                <!-- 加载更多占位提示 -->
                <div v-if="loadMoreLoading" class="text-center text-sm text-gray-400 py-2">
                    {{ t("aiclock.loadMore") }}
                </div>
                <!-- 无更多历史提示 -->
                <div v-if="!hasMore && records.length > 0" class="text-center text-sm text-gray-300 py-2">
                    {{ t("aiclock.noMoreHistory") }}
                </div>

                <div v-for="item in records" :key="item.id" class="flex gap-2 items-start"
                    :class="item.role === 'user' ? 'flex-row-reverse' : 'flex-row'">
                    <!-- 头像 -->
                    <div class="flex flex-col gap-1 max-w-[75%] justify-center items-center">
                        <div class="yoyo-device-img" v-if="item.role !== 'user'">
                            <img :src="yoyoIcon" alt="闹钟" class="yoyo-device-icon" />
                        </div>

                        <img v-if="item.role === 'user' && userInfo.avatar" :src="userInfo.avatar" alt="闹钟"
                            class="w-11 h-11 rounded-full  flex items-center justify-center flex-shrink-0" />

                        <div class="text-xs text-gray-400 text-center">{{ formatTime(item.created_at) }}</div>
                    </div>

                    <div class="flex flex-col gap-1 max-w-[75%]"
                        :class="item.role === 'user' ? 'items-end' : 'items-start'">
                        <div class="  rounded-2xl text-base break-words" :class="item.role === 'user'
                            ? 'bg-red-500 text-white py-2.5 px-4 '
                            : 'bg-white text-gray-800 py-1 px-2'">
                            <template v-if="item.role === 'user'">
                                {{ item.content }}
                            </template>
                            <img v-else :src="formateEmotion(item.emotion || '1')" alt="情绪" style="height: 48px;" />
                        </div>
                    </div>
                </div>

            </div>
            <div v-if="records.length == 0" class=" h-full  p-5  flex flex-col items-center py-12 justify-center">
                <img :src="yoyoShadow" alt="" style="width: 200px; height: 100px;" />
                <div class=" text-gray-500 mt-4 text-[12px]">暂无对话记录，快去和YOYO聊天吧</div>
            </div>
        </div>


    </div>
</template>

<style lang="scss" scoped>
.aiclock-tab-page {
    display: flex;
    background-image: url("@/assets/images/yoyo/bg-chat.png");
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    flex-direction: column;
    gap: 1rem;
    height: 100vh;
    box-sizing: border-box;
}

.aiclock-chat-scroll {
    flex: 1;
    overflow-y: scroll;
    -webkit-overflow-scrolling: touch;
}

.bg-red-500 {
    background-color: var(--active-color);
}

.yoyo-device-img {
    @apply flex items-center justify-center;
    width: 40px;
    height: 40px;
    background: #D9D8E6;
    border: 2px solid #FFFFFF;
    border-radius: 50%;

}

.yoyo-device-icon {
    @apply flex-shrink-0 rounded-lg object-contain;
    width: 32px;
    height: 28px;

}
</style>