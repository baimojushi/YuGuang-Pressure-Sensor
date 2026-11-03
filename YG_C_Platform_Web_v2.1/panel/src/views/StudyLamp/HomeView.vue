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
    ModeCard,
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
import TodayScheduleCard from "../../components/TodayScheduleCard.vue";
import RecommendResourcesCard from "../../components/RecommendResourcesCard.vue";
import config from "../../config/config_studyLamp.json";

const router = useRouter();

const { t } = useI18n();

theme.setTheme("#FF9F1C");

// 内部/协议服务：不生成用户控件（Token/Uid/TTS 地址/语料请求/固件状态/设备元信息）
const HIDDEN_SERVICES = ["deviceInfo", "rtcLogin", "ota", "audio", "quitChat", "voiceControl"];
// 已在专用卡片展示的属性，不再生成通用控件
const SPECIAL_ATTRS = ["light_Brightness", "light_LightCCT", "light_LightMode", "voice_Volume"];

// 属性名 -> 展示文案
const LABELS: Record<string, string> = {
    light_OnOff: "台灯开关",
    light_LightSwitching: "变光",
    light_LightCCTMode: "色温模式",
    light_BrightnessRatio: "亮度配比",
    light_BrightGrad: "亮度微调",
    light_UpLight: "上光灯",
    light_DownLight: "下光灯",
    timingReset_DelayOff: "定时关灯",
    timingReset_Reset: "重置灯光",
    voice_VolumeAdjust: "音量调整",
    voice_MuteMode: "静音模式",
    lightRGB_OnOff: "氛围灯开关",
    lightRGB_ColorMode: "氛围灯颜色",
    lightRGB_Color: "氛围灯色值"
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

// 场景模式图标：小夜灯 / 阅读 / 休闲 / 睡觉
const MODE_ICONS: Record<number, string> = {
    1: "icon-xiaoyedeng",
    2: "icon-yuedu",
    3: "icon-xiuxian",
    4: "icon-shuijue"
};
const ModeArr = computed(() =>
    enumOptions(config.data.light_LightMode.options).map(opt => ({
        text: opt.text,
        value: opt.value,
        icon: MODE_ICONS[opt.value] || "icon-kaiguan",
        iconSize: 2
    }))
);

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
    info?.deviceName || "智能伴学台灯"
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
const setBrightness = (value: number) => {
    setData('light_Brightness', value);
    console.log('设置亮度', value);
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
        //修改到info?.deviceName
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
    <div class="lamp-page">
        <div class="lamp-wrap">
            <section class="lamp-hero">
                <div class="lamp-hero-top">
                    <div class="lamp-device-img">
                        <img class="lamp-device-icon" :src="info.productIcon" alt="" />
                    </div>

                    <div class="lamp-hero-info">
                        <div class="flex flex-row gap-1.5">
                            <div class="lamp-name">{{ deviceTitle }}</div>
                            <AlarmDialog label="设备名称" v-model="settingsForm.deviceName" type="text"
                                @confirm="updateDeviceName" :maxlength="16" />
                        </div>

                        <div class="lamp-status-row">
                            <span class="lamp-dot" :class="onlineStatus ? 'is-online' : 'is-offline'"></span>
                            <span class="lamp-status" :class="onlineStatus ? 'is-online' : 'is-offline'">
                                {{ onlineStatus ? t("online") : t("offline") }}
                            </span>
                        </div>
                    </div>
                    <div v-if="onlineStatus" class="lamp-button-group">
                        <div class="lamp-button" @click="goToChat">
                            <Icon name="icon-liaotianjilu" width="1.5rem" height="1.5rem" color="#5D616B" />
                        </div>
                    </div>
                </div>
            </section>


            <section>
                <div class="lamp-card py-5">
                    <!-- 亮度调节 -->
                    <SliderCard :is-card="false" text="亮度调节" unit="%" slider-type="COARSE" :show-mark="false"
                        :icons="['icon-a-liangdu', 'icon-a-liangdu1']" :value="data.light_Brightness || 100"
                        :range="[8, 100, 1]" @complete="v => setBrightness(v)" />
                </div>
            </section>

            <section>
                <div class="lamp-card py-5">
                    <!-- 色温调节 -->
                    <SliderCard :is-card="false"
                        trackColor="linear-gradient(90deg, #FFCD9D 3%, #FFE9C4 28%, #FFF9E8 51%, #C8E4FF 76%, #96C2FF 99%)"
                        text="色温" unit="k" slider-type="COARSE" :value="data.light_LightCCT || 2700"
                        :range="[2700, 5700, 100]" @complete="v => setData('light_LightCCT', v)" />
                </div>
            </section>

            <section>
                <div class="lamp-card py-5">
                    <!-- 场景模式 -->
                    <ModeCard :is-card="false" text="场景模式" :list="ModeArr" :value="data.light_LightMode"
                        @click="v => setData('light_LightMode', v)" />
                </div>
            </section>

            <section>
                <div class="lamp-card py-5">
                    <!-- 音量调节 -->
                    <SliderCard :is-card="false" text="音量调节" unit="%" slider-type="COARSE" :show-mark="false"
                        :value="data.voice_Volume || 50" :range="[0, 100, 1]" @complete="v => setVolume(v)" />
                </div>
            </section>

            <!-- 由 config.data 自动推导的属性控件 -->
            <section v-for="c in controls" :key="c.name">
                <div class="lamp-card">
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
                                :show-mark="false" track-color="#E5E5E5" track-tint-color="#FF9F1C"
                                @complete="v => setData(c.name, v)" />
                        </div>
                    </template>

                    <!-- 枚举：分段按钮 -->
                    <div v-else-if="c.type === 'enum'" class="flex items-center flex-row justify-between gap-1 py-5">
                        <div class="font-medium flex items-center gap-1 text-[16px]">{{ labelOf(c.name) }}</div>
                        <div class="flex items-center gap-2 flex-wrap justify-end">
                            <button v-for="opt in enumOptions(c.options)" :key="opt.value" class="lamp-segment"
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
                <div class="lamp-card py-5" @click="upgradeFirmware">
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
                                <span class="lamp-dot-alarm"></span>
                            </div>
                            <Icon name="icon-arrowright" width="1rem" height="1rem" color="var(--icon-color)" />
                        </div>
                    </div>
                </div>
            </section>

            <section>
                <div class="lamp-card py-5" @click="goToMessage">
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
                <div class="lamp-card py-5" @click="goToCourseManage">
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
                <div class="lamp-card py-5" @click="clearChatRecords">
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
                <div class="lamp-card py-5" @click="unbindDevice">
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
.lamp-page {
    @apply relative z-[1] text-[#0c121f];
    height: 100vh;
    box-sizing: border-box;
    overflow-y: auto;
    background: linear-gradient(180deg, #f1a0c44d 0%, #ffffff4d 57%, #ffffff4d 98%);
    background-attachment: local;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;

    .lamp-wrap {
        @apply relative z-[1] flex w-full flex-col gap-3 px-3 pb-6;
    }

    .lamp-card {
        @apply rounded-2xl bg-white px-5;

        .lamp-dot-alarm {
            @apply aspect-square w-[4px] rounded-[2px] bg-[#FF9F1C];
        }
    }

    .lamp-segment {
        @apply rounded-full px-3 py-1 text-[13px] leading-none;
        color: rgba(12, 18, 31, 0.6);
        background: #f7f8fc;

        &.is-active {
            color: #fff;
            background: #FF9F1C;
        }
    }

    .lamp-hero {
        @apply px-3 flex w-full items-center flex-col;

        .lamp-hero-top {
            @apply py-5 flex items-start gap-3 w-full;
        }

        .lamp-hero-img {
            @apply w-[200px] h-[200px] object-contain;
        }

        .lamp-device-img {
            @apply flex items-center justify-center;
            width: 56px;
            height: 56px;
            background: #D9D8E6;
            border: 2px solid #FFFFFF;
            border-radius: 50%;
        }

        .lamp-device-icon {
            @apply flex-shrink-0 rounded-lg object-contain;
            width: 44px;
            height: 40px;
        }

        .lamp-hero-info {
            @apply min-w-0 flex-1;
        }

        .lamp-button-group {
            @apply flex items-center gap-3 flex-col;
        }

        .lamp-button {
            @apply flex items-center justify-center rounded-full flex-col;
            width: 40px;
            height: 40px;
            background: rgba(255, 255, 255, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.6);
            gap: 2px;
        }

        .lamp-name {
            @apply truncate text-[#FFFFFF];
            font-weight: 500;
            font-size: 18px;
        }

        .lamp-status-row {
            @apply mt-1 flex items-center gap-1.5 leading-none;
            font-size: 12px;
            font-weight: 400;
        }

        .lamp-dot {
            @apply aspect-square w-1.5 rounded-full;

            &.is-online {
                @apply bg-[#5FEE92];
            }

            &.is-offline {
                @apply bg-[#999];
            }
        }

        .lamp-status {
            &.is-online {
                @apply text-[#fff];
            }

            &.is-offline {
                @apply text-[#999];
            }
        }
    }
}
</style>