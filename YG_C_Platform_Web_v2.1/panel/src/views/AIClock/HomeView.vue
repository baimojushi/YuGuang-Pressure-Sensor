<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { xj, data, initData, info } from "../../stores";
import { isMiniProgramEnv } from "../../utils";
import { nativeRouter } from "../../utils/nativeRouter";
import {
  theme,
  NavigationBar,
  Icon,
  centerConfirmDialog,
} from "xjiang-ui";;

import alarmClock from '@/assets/images/ai-clock/base-clock.png'
import BatteryIcon from "../../components/BatteryIcon.vue";
import TodayScheduleCard from "../../components/TodayScheduleCard.vue";
import ChatView from "../Common/ChatView.vue";
import GrowthView from "../Common/GrowthView.vue";
const router = useRouter();


const { t } = useI18n();

theme.setTheme("#FB2C00");

type AIClockTab = "alarm" | "chat" | "growth";
const ACTIVE_TAB_KEY = "ai-clock-active-tab";

const getStoredActiveTab = (): AIClockTab => {
  const stored = localStorage.getItem(ACTIVE_TAB_KEY);
  if (stored === "alarm" || stored === "chat" || stored === "growth") {
    return stored;
  }
  return "alarm";
};

const activeTab = ref<AIClockTab>(getStoredActiveTab());
watch(activeTab, (val) => {
  localStorage.setItem(ACTIVE_TAB_KEY, val);
});

const tabs: { key: AIClockTab; label: string; icon: string; activeIcon: string }[] = [
  { key: "alarm", label: t("aiclock.tabAlarm"), icon: "icon-naozhong", activeIcon: "icon-naozhongactive" },
  {
    key: "chat", label: t("aiclock.tabChat"), icon: "icon-duihua",
    activeIcon: "icon-duihuagaoliang"
  },
  {
    key: "growth", label: t("aiclock.tabGrowth"), icon: "icon-chengchang",
    activeIcon: "icon-chengchangxuanzhong"
  },
];

const deviceTitle = computed(() =>
  info?.deviceName || t("aiclock.title")
);

// 设备状态（后续可对接真实设备数据）
const isOnline = ref(true);
const batteryLevel = ref(10);
const isCharging = ref(true);

onMounted(() => {
  xj.pageInit({
    key: "XJ_PAGE_INIT",
    onLoad: options => {
      console.log("--onLoad-->", JSON.stringify(options));
      xj.device?.get?.([]);
    },
    onDeviceDataChange: (data) => {
      console.log("--page-onDeviceDataChange---->", data)
    },
    onDeviceInfoChange: (info) => {
      console.log("--page-onDeviceInfoChange---->", info)
    },
  });
  xj.hideNavigationBar();
});

function onBack() {
  nativeRouter.goBack();
}


</script>

<template>
  <div class="ailamp-root">
    <div v-if="!isMiniProgramEnv" class="ailamp-nav">
      <NavigationBar :statusbar-height="initData?.statusBarHeight || 24" :title="deviceTitle" :left="[]" />
    </div>
    <div v-if="activeTab === 'alarm'" class="min-h-screen ailamp-home p-4 flex flex-col gap-4">

      <!-- 设备信息卡片 -->
      <div class="device-info-card rounded-2xl  relative overflow-hidden">
        <div class="relative z-10 flex  justify-between items-stretch">
          <div class="flex flex-col  px-[16px] py-[24px]">
            <!-- 设备名称 + WiFi -->
            <div class="flex items-center gap-6 mb-[6px]">
              <h1 class="text-[1.43rem] font-medium text-gray-900 leading-tight">{{ deviceTitle }}</h1>
              <!-- <svg class="w-5 h-5 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 12.55a11 11 0 0 1 14.08 0" />
                <path d="M8.5 16.35a5.5 5.5 0 0 1 7 0" />
                <path d="M12 20h.01" />
              </svg> -->
              <Icon name="icon-ic_wifi" width="1.14rem" height="1.14rem" />
            </div>
            <!-- 在线状态 -->
            <div class="flex items-center gap-1.5 mb-[26px]">
              <span class="w-2 h-2 rounded-full" :class="isOnline ? 'bg-[#34C759]' : 'bg-gray-400'"></span>
              <span class="text-sm" :class="isOnline ? 'text-[#34C759]' : 'text-gray-500'">
                {{ isOnline ? '在线' : '离线' }}
              </span>
            </div>
            <!-- 电量 -->
            <div class="flex items-center gap-2 mb-[8px]">
              <BatteryIcon :level="data?.battery_BatteryLevel || 0" :charging="data?.battery_ChargeState" width="1.6rem"
                height="0.9rem" />
              <span class="text-[1.07rem] font-medium text-gray-800">{{ data?.battery_BatteryLevel || 0 }}%</span>
            </div>
          </div>
          <div class="clockDocker">
            <div class="relative flex items-end justify-center " style="width: 155px; height: 67px;">
              <!-- 粉色椭圆 -->
              <div class="absolute inset-0 rounded-[50%] bg-[#FB5E3D] opacity-10"></div>
              <!-- 内层闹钟盒子 90px × 103.5px -->
              <div class="relative mb-6" style="width: 90px; height: 122px;">
                <img :src="alarmClock" alt="超级飞侠闹钟" class="w-full h-full object-contain clock" />
              </div>
            </div>

          </div>
        </div>
      </div>

      <!-- 今日安排卡片 -->
      <TodayScheduleCard />

      <!-- 更多设置 -->
      <div class="bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between mb-[6rem]"
        @click="router.push('/settings')">
        <div class="flex items-center gap-3">
          <div
            class="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center">
            <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path
                d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94L14 2.81c0-.24-.2-.41-.41-.41h-3.18c-.24 0-.43.17-.43.41v.83c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94v.83c0 .24.2.41.41.41h3.18c.24 0 .44-.17.44-.41v-.83c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z">
              </path>
            </svg>
          </div>
          <span class="text-[1rem] font-medium text-gray-900">更多设置</span>
        </div>
        <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
        </svg>
      </div>
    </div>

    <ChatView v-if="activeTab === 'chat'" />
    <GrowthView v-if="activeTab === 'growth'" />

    <!-- 底部 Tab 导航 -->
    <nav class="aiclock-tabbar">
      <div v-for="tab in tabs" :key="tab.key" class="aiclock-tabbar-item"
        :class="{ 'is-active': activeTab === tab.key }" @click="activeTab = tab.key">
        <Icon v-if="activeTab !== tab.key" :name="tab.icon" width="1.5rem" height="1.5rem" color="#999" />
        <Icon v-if="activeTab === tab.key" :name="tab.activeIcon" width="1.5rem" height="1.5rem" />
        <span class="aiclock-tabbar-label">{{ tab.label }}</span>
      </div>
    </nav>

  </div>
</template>

<style lang="scss" scoped>
.ailamp-root {
  overflow-x: hidden;

}

.ailamp-home {
  overflow-x: hidden;
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
    z-index: 0;
  }
}

.shadow-sm {
  box-shadow: 0px 8px 20px 0px rgba(208, 90, 11, 0.1);
}

.device-info-card {
  background: linear-gradient(180deg, #ffffff 0%, #fef8f3 99%);
  box-shadow: 0px 8px 20px 0px rgba(208, 90, 11, 0.08);
  min-height: 8.5rem;



  .clockDocker {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: center;
    margin-bottom: -10px;
    margin-right: -10px;

  }
}




.ailamp-nav {
  @apply relative z-[20] flex-shrink-0;
}

.aiclock-tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 30;
  display: flex;
  align-items: stretch;
  height: 5.7143rem;
  padding-bottom: env(safe-area-inset-bottom);
  background: #ffffff;
  box-shadow: 0px -2px 12px 0px rgba(0, 0, 0, 0.06);

  .aiclock-tabbar-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.1429rem;
    cursor: pointer;
    transition: color 0.2s ease;
    color: #999;

    &.is-active {
      color: var(--active-color);
    }

    .aiclock-tabbar-label {
      font-size: 0.7143rem;
      line-height: 1.2;
    }
  }
}
</style>