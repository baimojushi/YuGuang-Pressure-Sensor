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
    ThinSlider,
    XJSwitch,
    toast
} from "xjiang-ui";
import iconVolume from "@/assets/images/yoyo/volume.png";
import iconMessage from "@/assets/images/yoyo/message.png";
import iconDelete from "@/assets/images/yoyo/delete.png";
import iconUnBind from "@/assets/images/yoyo/unbind.png";
import iconOTA from "@/assets/images/yoyo/ota.png";
import { clearConvoList } from "@/utils/apis/rtc";
import { editDeviceName, unbind, getFirmwareUpdateDeviceStatusV2 } from "@/utils/apis/aiAlarmApi";
import AlarmDialog from "../../components/AlarmDialog.vue";
import config from "../../config/config_CutePet.json";

const router = useRouter();

const { t } = useI18n();

theme.setTheme("#FF7BA9");

// 内部/协议服务：不生成用户控件（Token/Uid/TTS 地址/语料请求/固件状态/设备元信息）
const HIDDEN_SERVICES = ["deviceInfo", "rtcLogin", "ota", "audio", "quitChat", "voiceControl"];
// 已在专用卡片展示的属性，不再生成通用控件
const SPECIAL_ATTRS = ["voice_Volume"];

// 属性名 -> 展示文案
const LABELS: Record<string, string> = {
    voice_Volume: "音量调节",
    voice_VolumeAdjust: "音量调整",
    voice_MuteMode: "静音模式",
    power_Power: "电源开关",
    battery_K: "充电电池"
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
    info?.deviceName || t("aiLamp.common.deviceName") || "萌宠互动手办"
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
    <div class="pet-page">
        <div class="pet-wrap">
            <section class="pet-hero">
                <div class="pet-hero-top">
                    <div class="pet-device-img">
                        <img class="pet-device-icon" :src="info.productIcon" alt="" />
                    </div>

                    <div class="pet-hero-info">
                        <div class="flex flex-row gap-1.5">
                            <div class="pet-name">{{ deviceTitle }}</div>
                            <AlarmDialog label="设备名称" v-model="settingsForm.deviceName" type="text"
                                @confirm="updateDeviceName" :maxlength="16" />
                        </div>

                        <div class="pet-status-row">
                            <span class="pet-dot" :class="onlineStatus ? 'is-online' : 'is-offline'"></span>
                            <span class="pet-status" :class="onlineStatus ? 'is-online' : 'is-offline'">
                                {{ onlineStatus ? t("online") : t("offline") }}
                            </span>
                        </div>
                    </div>
                    <div v-if="onlineStatus" class="pet-button-group">
                        <div class="pet-button" @click="goToChat">
                            <Icon name="icon-liaotianjilu" width="1.5rem" height="1.5rem" color="#5D616B" />
                        </div>
                    </div>
                </div>
            </section>

            <section class="pet-hero" style="margin-top: -20px;">
                <img class="pet-hero-img" :src="info.productIcon" alt="" />
            </section>

            <section>
                <div class="pet-card">
                    <!-- 音量调节 -->
                    <div class="flex items-center flex-row justify-start gap-1 py-5">
                        <div class="font-medium flex items-center gap-1 text-[16px]">
                            <img class="w-6 h-6" :src="iconVolume" alt="" />音量调节
                        </div>
                        <span class="opacity-60">|</span>
                        <span class="opacity-60">{{ data.voice_Volume || 0 }}%</span>
                    </div>
                    <div class="flex items-center flex-col">
                        <div class="flex justify-between w-full">
                            <span class="opacity-60">1%</span>
                            <span class="opacity-60">100%</span>
                        </div>
                        <ThinSlider :value="data.voice_Volume || 0" :range="[1, 100, 1]" :show-button="false"
                            :show-mark="false" track-color="#E5E5E5" track-tint-color="#FF7BA9"
                            @complete="v => setVolume(v)" />
                    </div>
                </div>
            </section>

            <!-- 由 config.data 自动推导的属性控件 -->
            <section v-for="c in controls" :key="c.name">
                <div class="pet-card">
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
                                :show-mark="false" track-color="#E5E5E5" track-tint-color="#FF7BA9"
                                @complete="v => setData(c.name, v)" />
                        </div>
                    </template>

                    <!-- 枚举：分段按钮 -->
                    <div v-else-if="c.type === 'enum'" class="flex items-center flex-row justify-between gap-1 py-5">
                        <div class="font-medium flex items-center gap-1 text-[16px]">{{ labelOf(c.name) }}</div>
                        <div class="flex items-center gap-2 flex-wrap justify-end">
                            <button v-for="opt in enumOptions(c.options)" :key="opt.value" class="pet-segment"
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

            <section>
                <div class="pet-card py-5" @click="upgradeFirmware">
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
                                <span class="pet-dot-alarm"></span>
                            </div>
                            <Icon name="icon-arrowright" width="1rem" height="1rem" color="var(--icon-color)" />
                        </div>
                    </div>
                </div>
            </section>

            <section>
                <div class="pet-card py-5" @click="goToMessage">
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
                <div class="pet-card py-5" @click="clearChatRecords">
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
                <div class="pet-card py-5" @click="unbindDevice">
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
.pet-page {
    @apply relative z-[1] text-[#0c121f];
    height: 100vh;
    box-sizing: border-box;
    overflow-y: auto;
    background-image: url("@/assets/images/yoyo/yoyo-bg.png");
    background-size: cover;
    background-attachment: local;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;

    .pet-wrap {
        @apply relative z-[1] flex w-full flex-col gap-3 px-3 pb-6;
    }

    .pet-card {
        @apply rounded-2xl bg-white px-5;

        .pet-dot-alarm {
            @apply aspect-square w-[4px] rounded-[2px] bg-[#FF7BA9];
        }
    }

    .pet-segment {
        @apply rounded-full px-3 py-1 text-[13px] leading-none;
        color: rgba(12, 18, 31, 0.6);
        background: #f7f8fc;

        &.is-active {
            color: #fff;
            background: #FF7BA9;
        }
    }

    .pet-hero {
        @apply px-3 flex w-full items-center flex-col;

        .pet-hero-top {
            @apply py-5 flex items-start gap-3 w-full;
        }

        .pet-hero-img {
            @apply w-[200px] h-[200px] object-contain;
        }

        .pet-device-img {
            @apply flex items-center justify-center;
            width: 56px;
            height: 56px;
            background: #D9D8E6;
            border: 2px solid #FFFFFF;
            border-radius: 50%;
        }

        .pet-device-icon {
            @apply flex-shrink-0 rounded-lg object-contain;
            width: 44px;
            height: 40px;
        }

        .pet-hero-info {
            @apply min-w-0 flex-1;
        }

        .pet-button-group {
            @apply flex items-center gap-3 flex-col;
        }

        .pet-button {
            @apply flex items-center justify-center rounded-full flex-col;
            width: 40px;
            height: 40px;
            background: rgba(255, 255, 255, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.6);
            gap: 2px;
        }

        .pet-name {
            @apply truncate text-[#FFFFFF];
            font-weight: 500;
            font-size: 18px;
        }

        .pet-status-row {
            @apply mt-1 flex items-center gap-1.5 leading-none;
            font-size: 12px;
            font-weight: 400;
        }

        .pet-dot {
            @apply aspect-square w-1.5 rounded-full;

            &.is-online {
                @apply bg-[#5FEE92];
            }

            &.is-offline {
                @apply bg-[#999];
            }
        }

        .pet-status {
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