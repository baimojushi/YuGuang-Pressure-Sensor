<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { xj, data, info } from "../../stores";
import { nativeRouter } from "../../utils/nativeRouter";
import {
    theme,
    Icon,
    centerConfirmDialog,
    SliderCard,
    ThinSlider,
    XJSwitch,
    toast
} from "xjiang-ui";
import iconMessage from "@/assets/images/yoyo/message.png";
import iconCourseManage from "@/assets/images/course/courseTableIcon.png";
import iconDelete from "@/assets/images/yoyo/delete.png";
import iconUnBind from "@/assets/images/yoyo/unbind.png";
import iconOTA from "@/assets/images/yoyo/ota.png";
import { clearConvoList } from "@/utils/apis/rtc";
import { editDeviceName, unbind, getFirmwareUpdateDeviceStatusV2 } from "@/utils/apis/aiAlarmApi";
import AlarmDialog from "../../components/AlarmDialog.vue";
import BatteryIcon from "../../components/BatteryIcon.vue";
import TodayScheduleCard from "../../components/TodayScheduleCard.vue";
import RecommendResourcesCard from "../../components/RecommendResourcesCard.vue";
import config from "../../config/config_jingjing.json";

const router = useRouter();

const { t } = useI18n();

theme.setTheme("#34C7A6");

// 内部/协议服务：不生成用户控件（Token/Uid/TTS 地址/语料请求/固件状态/设备元信息）
const HIDDEN_SERVICES = ["deviceInfo", "rtcLogin", "ota", "audio", "quitChat", "voiceControl"];
// 已在专用卡片展示的属性，不再生成通用控件
const SPECIAL_ATTRS = [
    "voice_Volume",
    "battery_BatteryLevel",
    "battery_ChargeState",
    "poseMonitor_HintCorpus"
];

// 属性名 -> 展示文案
const LABELS: Record<string, string> = {
    voice_VolumeAdjust: "音量调整",
    power_Power: "设备开关",
    poseMonitor_StudyMode: "学习模式",
    course_Courseweekday: "课程播报"
};
const labelOf = (name: string) => LABELS[name] || name;

// 由 config.data 自动推导的通用控件列表
const controls = Object.entries(config.data as Record<string, any>)
    .map(([name, meta]) => ({ name, ...meta }))
    .filter(c => !HIDDEN_SERVICES.includes(c.name.split("_")[0]))
    .filter(c => !SPECIAL_ATTRS.includes(c.name));

// 枚举选项 {值:文案} -> [{ value, text }]
const enumOptions = (options: Record<string, string>) =>
    Object.entries(options || {}).map(([value, text]) => ({ value: Number(value), text }));

// 当前坐姿/护眼提醒语料
const hintText = computed(() => {
    const options = (config.data as Record<string, any>).poseMonitor_HintCorpus?.options || {};
    return options[data.poseMonitor_HintCorpus] || "";
});

// 设置表单数据
const settingsForm = ref({
    id: info?.id || 0,
    userId: 0,
    pid: info?.pid,
    deviceId: info?.did,
    deviceName: info?.deviceName,
    upgradeableVersionList: [] as {
        version: string;
    }[]
});
const onlineStatus = computed(() => true);

const deviceTitle = computed(() =>
    info?.deviceName || "护眼玩具-晶晶"
);

onMounted(() => {
    xj.pageInit({
        key: "XJ_PAGE_INIT",
        onLoad: options => {
            console.log("--onLoad-->", JSON.stringify(options));
            xj.device.get?.([]);
        },
        onDeviceDataChange: (data) => {
            console.log("--page-onDeviceDataChange---->", data)
        },
        onDeviceInfoChange: (info) => {
            console.log("--page-onDeviceInfoChange---->", info)
        },
    });
    xj.hideNavigationBar();
    if (info.did) {
        getOTA();
    }
});

function onBack() {
    nativeRouter.goBack();
}
const setData = (key: string, value: number | boolean | string) => {
    if (data[key] !== value) {
        xj.device.set?.({ [key]: value });
    }
};
const setVolume = (value: number) => {
    setData('voice_Volume', value);
    console.log('设置音量', value);
};
const upgradeFirmware = () => {
    console.log('升级固件');
    nativeRouter.navigate("upgrade-wifi-device", info);
}
const goToMessage = () => {
    console.log('去消息页面');
    router.push({ name: "messageNotify" });
}
const goToCourseManage = () => {
    console.log('去课程管理页面');
    router.push({ name: "courseManage" });
}
const goToChat = () => {
    console.log('去聊天页面');
    router.push({ name: "chat" });
}
// 清空全部聊天记录
const clearChatRecords = () => {
    centerConfirmDialog({
        title: '确认删除设备信息？',
        message: '删除后不可恢复，将清除当前账号下该设备的陪伴档案、对话记录和互动记录；设备绑定关系将保留',
        cancelText: '取消',
        confirmText: '确认删除',
        onConfirm: () => {
            console.log('清空全部聊天记录');
            clearConvoList({
                did: settingsForm.value.deviceId,
            }).then(res => {
                if (res.status === 0) {
                    toast({ text: '删除成功' });
                } else {
                    toast({ text: res.msg || '删除失败' });
                }
            });
            editDeviceName({
                id: info.id,
                deviceName: info.productName,
            });
        }
    });
}
// 解绑设备
const unbindDevice = () => {
    centerConfirmDialog({
        title: '确认解绑',
        message: '解绑仅解除设备与当前账号的归属关系，历史数据会为当前用户保留',
        cancelText: '取消',
        confirmText: '确认解绑',
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

const updateDeviceName = async () => {
    const res = await editDeviceName({
        id: info.id,
        deviceName: settingsForm.value.deviceName,
    });
    if (res.ok) {
        toast({ text: '修改成功' });
        if (info) {
            info.deviceName = settingsForm.value.deviceName;
        }
    } else {
        toast({ text: res.msg || '修改失败' });
    }
}
const getOTA = async () => {
    const res = await getFirmwareUpdateDeviceStatusV2({
        did: settingsForm.value.deviceId,
    });
    if (res.ok && res.result) {
        settingsForm.value.upgradeableVersionList = res.result.upgradeableVersionList || [];
    }
}
</script>

<template>
    <div class="jj-page">
        <div class="jj-wrap">
            <section class="jj-hero">
                <div class="jj-hero-top">
                    <div class="jj-device-img">
                        <img class="jj-device-icon" :src="info.productIcon" alt="" />
                    </div>

                    <div class="jj-hero-info">
                        <div class="flex flex-row gap-1.5">
                            <div class="jj-name">{{ deviceTitle }}</div>
                            <AlarmDialog label="设备名称" v-model="settingsForm.deviceName" type="text"
                                @confirm="updateDeviceName" :maxlength="16" />
                        </div>

                        <div class="jj-status-row">
                            <span class="jj-dot" :class="onlineStatus ? 'is-online' : 'is-offline'"></span>
                            <span class="jj-status" :class="onlineStatus ? 'is-online' : 'is-offline'">
                                {{ onlineStatus ? t("online") : t("offline") }}
                            </span>
                        </div>
                    </div>
                    <div v-if="onlineStatus" class="jj-button-group">
                        <div class="jj-button" @click="goToChat">
                            <Icon name="icon-liaotianjilu" width="1.5rem" height="1.5rem" color="#5D616B" />
                        </div>
                        <div class="jj-button">
                            <BatteryIcon style="margin-top: 4px;" :level="data?.battery_BatteryLevel || 0"
                                :charging="!!data?.battery_ChargeState" :vertical="true" width="12px" height="18px" />
                            <div class="jj-battery-text">{{ data?.battery_BatteryLevel || 0 }}%</div>
                        </div>
                    </div>
                </div>
            </section>

            <!-- 当前护眼/坐姿提醒（由 poseMonitor_HintCorpus 推导） -->
            <section v-if="hintText">
                <div class="jj-card py-5">
                    <div class="font-medium text-[16px] pb-2">当前提醒</div>
                    <div class="text-[14px] leading-relaxed opacity-70">{{ hintText }}</div>
                </div>
            </section>

            <section>
                <div class="jj-card py-5">
                    <!-- 音量调节 -->
                    <SliderCard :is-card="false" text="音量调节" unit="%" slider-type="COARSE" :show-mark="false"
                        :value="data.voice_Volume || 50" :range="[0, 100, 1]" @complete="v => setVolume(v)" />
                </div>
            </section>

            <!-- 由 config.data 自动推导的属性控件 -->
            <section v-for="c in controls" :key="c.name">
                <div class="jj-card">
                    <!-- 布尔：开关 -->
                    <div v-if="c.type === 'bool'" class="flex items-center flex-row justify-between gap-1 py-5">
                        <div class="font-medium flex items-center gap-1 text-[16px]">{{ labelOf(c.name) }}</div>
                        <XJSwitch :active="!!data[c.name]" @click="v => setData(c.name, v)" />
                    </div>

                    <!-- 数值：滑块 -->
                    <template v-else-if="c.type === 'number'">
                        <div class="flex items-center flex-row justify-start gap-1 py-5">
                            <div class="font-medium flex items-center gap-1 text-[16px]">{{ labelOf(c.name) }}</div>
                            <span class="opacity-60">|</span>
                            <span class="opacity-60">{{ data[c.name] || 0 }}{{ c.unit || '' }}</span>
                        </div>
                        <div class="flex items-center flex-col">
                            <div class="flex justify-between w-full">
                                <span class="opacity-60">{{ c.range[0] }}{{ c.unit || '' }}</span>
                                <span class="opacity-60">{{ c.range[1] }}{{ c.unit || '' }}</span>
                            </div>
                            <ThinSlider :value="data[c.name] || 0" :range="c.range" :show-button="false"
                                :show-mark="false" track-color="#E5E5E5" track-tint-color="#34C7A6"
                                @complete="v => setData(c.name, v)" />
                        </div>
                    </template>

                    <!-- 枚举：分段按钮 -->
                    <div v-else-if="c.type === 'enum'" class="flex items-center flex-row justify-between gap-1 py-5">
                        <div class="font-medium flex items-center gap-1 text-[16px]">{{ labelOf(c.name) }}</div>
                        <div class="flex items-center gap-2 flex-wrap justify-end">
                            <button v-for="opt in enumOptions(c.options)" :key="opt.value" class="jj-segment"
                                :class="{ 'is-active': data[c.name] === opt.value }"
                                @click="setData(c.name, opt.value)">
                                {{ opt.text }}
                            </button>
                        </div>
                    </div>

                    <!-- 字符串 / 只读：文本 -->
                    <div v-else class="flex items-center flex-row justify-between gap-1 py-5">
                        <div class="font-medium flex items-center gap-1 text-[16px]">{{ labelOf(c.name) }}</div>
                        <span class="opacity-60">{{ data[c.name] }}</span>
                    </div>
                </div>
            </section>

            <!-- 今日安排（通用卡片 TodayScheduleCard） -->
            <section>
                <TodayScheduleCard />
            </section>

            <!-- 推荐资源（通用卡片 RecommendResourcesCard） -->
            <section>
                <RecommendResourcesCard />
            </section>

            <section>
                <div class="jj-card py-5" @click="upgradeFirmware">
                    <div class="flex items-center flex-row justify-between gap-1">
                        <div class="flex items-center flex-row justify-start gap-1">
                            <img class="w-6 h-6" :src="iconOTA" alt="" />
                            <span class="font-medium text-[16px]">固件更新</span>
                        </div>
                        <div class="flex items-center flex-row justify-start gap-1">
                            <span class="opacity-60 leading-tight">{{ settingsForm.upgradeableVersionList.length > 0 ?
                                settingsForm.upgradeableVersionList[0].version : '' }}
                            </span>
                            <div class="flex flex-col justify-start self-stretch"
                                v-if="settingsForm.upgradeableVersionList.length > 0">
                                <span class="jj-dot-alarm"></span>
                            </div>
                            <Icon name="icon-arrowright" width="1rem" height="1rem" color="var(--icon-color)" />
                        </div>
                    </div>
                </div>
            </section>

            <section>
                <div class="jj-card py-5" @click="goToMessage">
                    <div class="flex items-center flex-row justify-between gap-1">
                        <div class="flex items-center flex-row justify-start gap-1">
                            <img class="w-6 h-6" :src="iconMessage" alt="" />
                            <div class="flex items-start flex-col justify-start">
                                <div class="font-medium text-[16px] leading-tight">消息通知</div>
                                <div class="text-[13px] opacity-60 leading-tight">查看该设备的平台状态提醒</div>
                            </div>
                        </div>
                        <div class="flex items-center flex-row justify-start gap-1">
                            <Icon name="icon-arrowright" width="1rem" height="1rem" color="var(--icon-color)" />
                        </div>
                    </div>
                </div>
            </section>

            <section>
                <div class="jj-card py-5" @click="goToCourseManage">
                    <div class="flex items-center flex-row justify-between gap-1">
                        <div class="flex items-center flex-row justify-start gap-1">
                            <img class="w-6 h-6" :src="iconCourseManage" alt="" />
                            <div class="flex items-start flex-col justify-start">
                                <div class="font-medium text-[16px] leading-tight">课程管理</div>
                                <div class="text-[13px] opacity-60 leading-tight">查看该设备的课程表</div>
                            </div>
                        </div>
                        <div class="flex items-center flex-row justify-start gap-1">
                            <Icon name="icon-arrowright" width="1rem" height="1rem" color="var(--icon-color)" />
                        </div>
                    </div>
                </div>
            </section>

            <section>
                <div class="jj-card py-5" @click="clearChatRecords">
                    <div class="flex items-center flex-row justify-between gap-1">
                        <div class="flex items-center flex-row justify-start gap-1">
                            <img class="w-6 h-6" :src="iconDelete" alt="" />
                            <div class="flex items-start flex-col justify-start">
                                <div class="font-medium text-[16px] leading-tight">删除设备信息</div>
                                <div class="text-[13px] opacity-60 leading-tight">清除陪伴档案、对话与互动记录</div>
                            </div>
                        </div>
                        <div class="flex items-center flex-row justify-start gap-1">
                            <Icon name="icon-arrowright" width="1rem" height="1rem" color="var(--icon-color)" />
                        </div>
                    </div>
                </div>
            </section>

            <section>
                <div class="jj-card py-5" @click="unbindDevice">
                    <div class="flex items-center flex-row justify-between gap-1">
                        <div class="flex items-center flex-row justify-start gap-1">
                            <img class="w-6 h-6" :src="iconUnBind" alt="" />
                            <div class="flex items-start flex-col justify-start">
                                <div class="font-medium text-[16px] leading-tight">解绑设备</div>
                                <div class="text-[13px] opacity-60 leading-tight">解绑后可由其他账号重新绑定</div>
                            </div>
                        </div>
                        <div class="flex items-center flex-row justify-start gap-1">
                            <Icon name="icon-arrowright" width="1rem" height="1rem" color="var(--icon-color)" />
                        </div>
                    </div>
                </div>
            </section>
        </div>
    </div>
</template>

<style lang="scss" scoped>
$jj-theme: #34C7A6;

.jj-page {
    @apply relative z-[1] text-[#0c121f];
    height: 100vh;
    box-sizing: border-box;
    overflow-y: auto;
    background: linear-gradient(180deg, #a0e9c94d 0%, #ffffff4d 57%, #ffffff4d 98%);
    background-attachment: local;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;

    .jj-wrap {
        @apply relative z-[1] flex w-full flex-col gap-3 px-3 pb-6;
    }

    .jj-card {
        @apply rounded-2xl bg-white px-5;

        .jj-dot-alarm {
            @apply aspect-square w-[4px] rounded-[2px];
            background: $jj-theme;
        }
    }

    .jj-segment {
        @apply rounded-full px-3 py-1 text-[13px] leading-none;
        color: rgba(12, 18, 31, 0.6);
        background: #f7f8fc;

        &.is-active {
            color: #fff;
            background: $jj-theme;
        }
    }

    .jj-hero {
        @apply px-3 flex w-full items-center flex-col;

        .jj-hero-top {
            @apply py-5 flex items-start gap-3 w-full;
        }

        .jj-device-img {
            @apply flex items-center justify-center;
            width: 56px;
            height: 56px;
            background: #D9D8E6;
            border: 2px solid #FFFFFF;
            border-radius: 50%;
        }

        .jj-device-icon {
            @apply flex-shrink-0 rounded-lg object-contain;
            width: 44px;
            height: 40px;
        }

        .jj-hero-info {
            @apply min-w-0 flex-1;
        }

        .jj-button-group {
            @apply flex items-center gap-3 flex-col;
        }

        .jj-button {
            @apply flex items-center justify-center rounded-full flex-col;
            width: 40px;
            height: 40px;
            background: rgba(255, 255, 255, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.6);
            gap: 2px;
        }

        .jj-battery-text {
            @apply leading-none;
            font-size: 10px;
            color: #0c121f;
        }

        .jj-name {
            @apply truncate;
            color: #0c121f;
            font-weight: 500;
            font-size: 18px;
        }

        .jj-status-row {
            @apply mt-1 flex items-center gap-1.5 leading-none;
            font-size: 12px;
            font-weight: 400;
        }

        .jj-dot {
            @apply aspect-square w-1.5 rounded-full;

            &.is-online {
                @apply bg-[#5FEE92];
            }

            &.is-offline {
                @apply bg-[#999];
            }
        }

        .jj-status {
            &.is-online {
                @apply text-[#4C535D];
            }

            &.is-offline {
                @apply text-[#999];
            }
        }
    }
}
</style>