<script setup lang="ts">
import { onMounted, ref, setBlockTracking } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { info, initData, data, xj } from "../../stores";
import { isMiniProgramEnv } from "../../utils";
import { nativeRouter } from "../../utils/nativeRouter";
import { NavigationBar, Icon, theme, ThinSlider, toast, centerConfirmDialog } from "xjiang-ui";;
import type { ScrollPickerOption } from "xjiang-ui/components/scroll-picker/src/ScrollPicker.vue";
import AlarmConfigItem from "../../components/AlarmConfigItem.vue";
import { editDeviceName, fetchUserInfo, getPlayTimeInfo, setPlayTime, unbind, updateUserInfo, UserInterest } from "@/utils/apis/aiAlarmApi";
import { clearConvoList } from "@/utils/apis/rtc";

const router = useRouter();
const { t } = useI18n();

function onBack() {
    nativeRouter.goBack();
}
// 设置表单数据
const settingsForm = ref({
    id: info?.id || 0,
    userId: 0,
    childProfile: '',
    pid: info?.pid,
    deviceId: info?.did,
    deviceName: info?.deviceName,
    wifi: 'Home-5G',
    eyeProtection: true,
    brightness: 50,
    lowBatteryNotify: true,
    dailyPlayLimit: 60,
    dateOfBirth: 0,
    gender: 0,
    interests: [] as UserInterest[],
});
const setData = (key: string, value: number) => {
    if (data[key] !== value) {
        xj.device.set?.({ [key]: value });
    }
};
console.log('data', data);
// 亮度选项
const brightnessOptions: ScrollPickerOption[][] = [
    Array.from({ length: 101 }, (_, i) => ({
        text: `${i}%`,
        value: i,
    }))
];

const getListenData = async () => {
    const res = await getPlayTimeInfo({
        pid: info?.pid,
        did: info?.did,
    })
    if (res.ok) {
        console.log("--getPlayTimeInfo---->", res)
        settingsForm.value.dailyPlayLimit = res.result?.playDurationLimit || 0

    }
}
// 播放上限选项
const playLimitOptions: ScrollPickerOption[][] = [
    [
        { text: '15分钟', value: 15 },
        { text: '30分钟', value: 30 },
        { text: '60分钟', value: 60 },
        { text: '90分钟', value: 90 },
        { text: '120分钟', value: 120 },
    ]
];
const wifiOptions: ScrollPickerOption[][] = [
    [{ text: 'Home-5G', value: 'Home-5G' },
    { text: 'Home-2.4G', value: 'Home-2.4G' },
    { text: 'Guest-5G', value: 'Guest-5G' },
    { text: 'Guest-2.4G', value: 'Guest-2.4G' },]

];
// 保存设置
const saveSettings = () => {
    console.log('保存设置', settingsForm.value);
    // TODO: 调用接口保存
};
const setBrightness = (value: number) => {
    setBlockTracking(value);
    setData('brightness_Brightness', value);
    console.log('设置亮度', value);
};
// 解绑设备
const unbindDevice = () => {
    centerConfirmDialog({
        title: '确认解绑',
        message: '解绑后将无法继续管理该设备，是否继续？',
        cancelText: '取消',
        confirmText: '确认',
        onConfirm: () => {
            console.log('解绑设备');
            unbind([settingsForm.value.deviceId]).then(res => {
                if (res.ok) {
                    toast({ text: '解绑成功' });
                    onBack();
                } else {
                    toast({ text: res.msg || '解绑失败' });
                }
            });
        }
    });
};

const getUserInfo = async () => {
    const res = await fetchUserInfo();
    if (res.ok) {
        settingsForm.value.childProfile = res.result?.name || '';
        settingsForm.value.userId = res.result?.id || 0;
        settingsForm.value.dateOfBirth = res.result?.dateOfBirth || 0;
        settingsForm.value.gender = res.result?.gender || 0;
        settingsForm.value.interests = res.result?.interests || [];
    }
}

const updateUser = async () => {
    const res = await updateUserInfo({
        name: settingsForm.value.childProfile,
        id: settingsForm.value.userId,
        dateOfBirth: settingsForm.value.dateOfBirth,
        gender: settingsForm.value.gender,
        interests: settingsForm.value.interests,
    });
    if (res.ok) {
        toast({ text: '修改成功' });
    } else {
        toast({ text: '修改失败' });
    }
}
const updateDeviceName = async () => {
    const res = await editDeviceName({
        id: settingsForm.value.id,
        deviceName: settingsForm.value.deviceName,
    });
    if (res.ok) {
        toast({ text: '修改成功' });
        //修改到info?.deviceName
        if (info) {
            info.deviceName = settingsForm.value.deviceName;
        }
    } else {
        toast({ text: res.msg || '修改失败' });
    }
}
const setPlayTimeFuc = async () => {
    const res = await setPlayTime({
        pid: settingsForm.value.pid,
        did: settingsForm.value.deviceId,
        playDurationLimit: settingsForm.value.dailyPlayLimit,
    });
    if (res.ok) {
        toast({ text: res.msg || '设置成功' });
    } else {
        toast({ text: res.msg || '设置失败' });
    }
}
const upgradeFirmware = () => {
    console.log('升级固件');
    nativeRouter.navigate("upgrade-wifi-device", info);

}
// 清空全部聊天记录
const clearChatRecords = () => {
    centerConfirmDialog({
        title: '确认清空',
        message: '清空后将无法恢复，是否继续？',
        cancelText: '取消',
        confirmText: '确认',
        onConfirm: () => {
            console.log('清空全部聊天记录');
            clearConvoList({
                did: settingsForm.value.deviceId,
            }).then(res => {
                if (res.status === 0) {
                    toast({ text: '清空成功' });
                } else {
                    toast({ text: res.msg || '清空失败' });
                }
            });
        }
    });
}



onMounted(async () => {
    if (!info.did) return;
    await getUserInfo();
    await getListenData();
});
</script>

<template>
    <div class="settings-root">
        <!-- 导航栏 -->
        <div v-if="!isMiniProgramEnv" class="settings-nav">
            <NavigationBar :statusbar-height="initData?.statusBarHeight || 24" :title="t('aiclock.title')" />
        </div>

        <!-- 页面内容 -->
        <div class="min-h-screen p-4 pb-24 flex flex-col gap-3">
            <!-- 设置表单 -->
            <form class="bg-white rounded-2xl px-6 shadow-sm space-y-0" @submit.prevent="saveSettings">
                <AlarmConfigItem label="设备名称" v-model="settingsForm.deviceName" type="text" border
                    @confirm="updateDeviceName" :maxlength="16" />
                <AlarmConfigItem label="儿童档案" v-model="settingsForm.childProfile" type="text" border :maxlength="16"
                    @confirm="updateUser" />
                <!-- <AlarmConfigItem label="Wi-Fi重配" v-model="settingsForm.wifi" type="picker" :options="wifiOptions"
                    border /> -->

                <!-- 护眼模式开关 -->
                <div class="flex items-center justify-between py-4 border-b border-gray-100">
                    <span class="text-[#0B0A0A] font-medium">护眼模式</span>
                    <div @click="setData('brightness_LightMode', data.brightness_LightMode === 2 ? 1 : 2)"
                        class="w-[40px] h-[22px] rounded-full flex items-center px-1 transition-all cursor-pointer"
                        :class="[data.brightness_LightMode === 2 ? 'bg-red-500 justify-end' : 'bg-gray-300 justify-start']">
                        <div class="w-[14px] h-[14px] bg-white rounded-full"></div>
                    </div>
                </div>

                <!-- 屏幕亮度 -->
                <!-- <div class="py-4 border-b border-gray-100">
                    <div class="flex items-center justify-between mb-3">
                        <span class="text-[#0B0A0A] font-medium">屏幕亮度</span>
                    </div>
                    <div class="flex items-center  flex-col ">

                        <ThinSlider :value="data.brightness_Brightness" :range="[0, 100, 1]" :show-button="false"
                            :show-mark="false" track-color="#EEEEEE" track-tint-color="#FB2C00"
                            @complete="v => setBrightness(v)" />

                        <div class="flex justify-between w-full">
                            <Icon name="icon-liangdudi" width="1.7rem" height="1.7rem" color="#999" />
                            <Icon name="icon-liangdugao" width="1.7rem" height="1.7rem" color="#999" />
                        </div>

                    </div>
                </div> -->



                <AlarmConfigItem label="每日播放上限" v-model="settingsForm.dailyPlayLimit" type="picker" border
                    @confirm="setPlayTimeFuc" :options="playLimitOptions" />


            </form>

            <div class="bg-white rounded-2xl px-6 shadow-sm space-y-0">
                <div class="flex items-center justify-between py-4">
                    <span class="text-[#0B0A0A] font-medium">隐私授权管理</span>
                    <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                </div>
            </div>

            <div class="bg-white rounded-2xl px-6 shadow-sm space-y-0" @click="upgradeFirmware">
                <div class="flex items-center justify-between py-4">
                    <span class="text-[#0B0A0A] font-medium">固件升级</span>
                    <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                </div>
            </div>

            <div class="bg-white rounded-2xl px-6 shadow-sm space-y-0" @click="clearChatRecords">
                <div class="flex items-center justify-between py-4">
                    <span class="text-[#0B0A0A] font-medium">清空全部聊天记录</span>
                    <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                </div>
            </div>

            <!-- 解绑设备按钮 -->
            <button
                class=" fixed bottom-8 left-12 right-12 w-[calc(100%-6rem)] py-3 rounded-full text-[#FB2C00] font-medium text-lg border border-[#FB2C00] bg-white"
                @click="unbindDevice">
                解绑设备
            </button>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.settings-root {
    min-height: 100vh;
    background: linear-gradient(181deg, #fdf4ea 13%, #ffffff 99%);
}

.settings-nav {
    @apply relative z-[20] flex-shrink-0;
}

.bg-red-500 {
    background-color: var(--active-color);
}
</style>