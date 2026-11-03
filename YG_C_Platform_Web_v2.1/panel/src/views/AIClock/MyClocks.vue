<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { xj, initData, info } from "../../stores";
import { NavigationBar, centerConfirmDialog, theme, toast, Icon, loading } from "xjiang-ui";;
import { isMiniProgramEnv } from "../../utils";
import alarmClock from '@/assets/images/ai-clock/alarm-clock.png'
import { AlarmListItem, deleteAlarm, fetchAlarmList, toggleAlarm } from "@/utils/apis/aiAlarmApi";
import alarmEmpty from '@/assets/images/ai-clock/alarm-empty.png'
import SwipeDeleteList from "../../components/SwipeDeleteList.vue";
const router = useRouter();
const { t } = useI18n();

const mockAlarmList: AlarmListItem[] = [

];

const alarmList = ref<AlarmListItem[]>([...mockAlarmList])

const handleDelete = (item: AlarmListItem, index: number) => {
  deleteAlarmItem(index, item.scheduleId)
}
const handleClick = (item: AlarmListItem) => {
  editAlarm(item)
}
const getAlarmList = async () => {
  const res = await fetchAlarmList({
    deviceId: info?.did,
    scope: 'all'
  })
  if (res.code == 200) {
    console.log("--fetchAlarmList---->", res)
    alarmList.value = res.data || []
  }
}
const toggleAlarmItem = async (item: AlarmListItem) => {
  const load = loading({ type: "loading" });
  const res = await toggleAlarm({
    deviceId: info?.did || '123',
    scheduleId: item.scheduleId,
    enabled: item.enabled === 1 ? '0' : '1'
  })
  if (res.code == 200) {
    console.log("--toggleAlarm---->", res)
    item.enabled = item.enabled === 1 ? 0 : 1
  }
  load.close();
}
const formItemValidateStates = (value: string) => {
  if (!value) return ''
  const match = value.match(/\d{2}:\d{2}/)
  return match ? match[0] : value
}

const deleteAlarmItem = async (index: number, scheduleId: string) => {
  const load = loading({ type: "loading" });
  const res = await deleteAlarm({
    deviceId: info?.did,
    scheduleId
  });
  if (res.code == 200) {
    toast({ text: '删除成功' });
    console.log("--deleteAlarm---->", res)
    alarmList.value.splice(index, 1)
  } else {
    toast({ text: '删除失败' });
  }
  load.close();
}
const editAlarm = (item: AlarmListItem) => {
  router.push({
    path: '/addAlarm',
    query: {
      scheduleId: item.scheduleId || ''
    }
  })
}
let alarmPollingTimer: ReturnType<typeof setInterval> | null = null;

const startAlarmPolling = () => {
  if (alarmPollingTimer) return;
  alarmPollingTimer = setInterval(() => {
    getAlarmList();
  }, 60 * 1000);
};

const stopAlarmPolling = () => {
  if (alarmPollingTimer) {
    clearInterval(alarmPollingTimer);
    alarmPollingTimer = null;
  }
};
onMounted(async () => {
  xj.hideNavigationBar();
  if (!info.did) return;
  await getAlarmList()
  startAlarmPolling();

});
onUnmounted(() => {
  stopAlarmPolling();
});

</script>

<template>
  <div class="ailamp-root">
    <div class="ailamp-nav" v-if="!isMiniProgramEnv">
      <NavigationBar :statusbar-height="initData?.statusBarHeight || 24" :title="t('aiclock.myClocks')" />
    </div>
    <div class="min-h-screen flex flex-col gap-4  pt-4">


      <!-- 今日安排卡片 -->


      <!-- 循环渲染闹钟列表 -->
      <div class="geofence-list mb-32" v-if="alarmList.length > 0">
        <SwipeDeleteList :list="alarmList" key-field="scheduleId" :delete-width="80" :delete-threshold="40"
          delete-text="删除" delete-bg-color="#fb2c00" card-bg-color="#ffffff" rounded="16px" margin-bottom="16px"
          padding-class="p-5" @delete="handleDelete" @click="handleClick">
          <template #default="{ item }">
            <div class="flex flex-col justify-between gap-4">
              <div class="flex justify-between items-center pb-4 border-b border-gray-100">
                <div>
                  <div class="flex items-center gap-3">
                    <span class="text-[2rem] font-bold text-gray-900">{{ formItemValidateStates(item.execStartTime)
                    }}</span>
                    <span class="flex items-center gap-1 px-3 py-1 rounded-full text-sm" :class="[
                      item.template.templateCode === 'wakeup' ? 'bg-green-50 text-[#34C759]' :
                        item.template.templateCode === 'study' ? 'bg-red-50 text-[#FB2C00]' :
                          item.template.templateCode === 'goodnight' ? 'bg-indigo-50 text-[#937DF6]' :
                            item.template.templateCode === 'reading' ? 'bg-blue-50 text-[#458CFF]' :
                              item.template.templateCode === 'sport' ? 'bg-amber-50 text-[#FFA500]' :
                                'bg-[#FFF3FE] text-[#F46CED]'
                    ]">
                      <Icon v-if="item.template.templateCode === 'wakeup'" name="icon-qichuang" width="0.85rem"
                        height="0.85rem" color="#34C759" />
                      <Icon v-if="item.template.templateCode === 'study'" name="icon-xuexi" width="0.85rem"
                        height="0.85rem" color="#FB2C00" />
                      <Icon v-if="item.template.templateCode === 'goodnight'" name="icon-wanan" width="0.85rem"
                        height="0.85rem" color="#937DF6" />
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

                <div @click.stop="toggleAlarmItem(item)"
                  class="w-[40px] h-[22px] rounded-full flex items-center px-1 transition-all cursor-pointer"
                  :class="[item.enabled == 1 ? 'bg-red-500 justify-end' : 'bg-gray-300 justify-start']">
                  <div class="w-[14px] h-[14px] bg-white rounded-full"></div>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <div class="w-[44px] h-[44px]">
                  <img :src="alarmClock" alt="超级飞侠闹钟" class="w-full h-full object-contain" />
                </div>
                <div class="text-[12px] text-gray-500" style="word-break: break-all;">{{ item.template.message }}</div>
              </div>
            </div>
          </template>
        </SwipeDeleteList>
      </div>

      <section v-else
        class=" bg-white h-[calc(100vh-10rem)] rounded-2xl p-5 shadow-sm z-10 mx-4 flex justify-center py-8 flex-col items-center">
        <img :src="alarmEmpty" alt="暂无闹钟" style="width: 100px; height: 100px;" />
        <div class="text-sm text-gray-500">当还没有闹钟哦，快去添加吧</div>
      </section>


      <button type="button"
        class="fixed bottom-8 left-12 right-12 w-[calc(100%-6rem)] bg-red-500 rounded-full p-4 shadow-sm flex items-center justify-center gap-4 z-20"
        @click="router.push('/addAlarm')">
        <Icon name="icon-plus" width="1.5rem" height="1.5rem" color="#ffffff" />
        <span class="text-[16px] font-medium text-white">添加闹钟</span>
      </button>
    </div>

  </div>
</template>

<style lang="scss" scoped>
.ailamp-root {
  overflow-x: hidden;
  background: linear-gradient(181deg, #fdf4ea 13%, #ffffff 99%);


}

.geofence-list {
  display: flex;
  flex-direction: column;
}

.bg-red-500 {
  background-color: var(--active-color);
}

.ailamp-nav {
  @apply relative z-[20] flex-shrink-0;
}
</style>