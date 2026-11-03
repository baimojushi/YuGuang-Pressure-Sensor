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
import BatteryIcon from "../../components/BatteryIcon.vue";
import iconEmotionHappy from "@/assets/images/yoyo/emoGif/happy.gif";
import iconEmotionTrust from "@/assets/images/yoyo/emoGif/trust.gif";
import iconEmotionFear from "@/assets/images/yoyo/emoGif/fear.gif";
import iconEmotionAmaze from "@/assets/images/yoyo/emoGif/amaze.gif";
import iconEmotionSad from "@/assets/images/yoyo/emoGif/sad.gif";
import iconEmotionHate from "@/assets/images/yoyo/emoGif/hate.gif";
import iconEmotionAngry from "@/assets/images/yoyo/emoGif/angry.gif";
import iconEmotionWish from "@/assets/images/yoyo/emoGif/hope.gif";
import { clearConvoList } from "@/utils/apis/rtc";
import { editDeviceName, unbind, getFirmwareUpdateDeviceStatusV2 } from "@/utils/apis/aiAlarmApi";
import AlarmDialog from "../../components/AlarmDialog.vue";
import breathImg from "@/assets/images/yoyo/breath.webp";
import config from "../../config/config_Cat.json";

const router = useRouter();

const { t } = useI18n();

theme.setTheme("#FF8C42");

// 内部/协议服务：不生成用户控件（Token/Uid/TTS 地址/语料请求/固件状态/设备元信息）
const HIDDEN_SERVICES = ["deviceInfo", "rtcLogin", "ota", "audio", "quitChat", "voiceControl"];
// 已由 Hero 区或专用组件展示的属性，不再生成通用控件
const SPECIAL_ATTRS = ["systemControl_Battery", "systemControl_Power", "emotion_Emotion", "systemControl_Voice"];

// 属性名 -> 展示文案
const LABELS: Record<string, string> = {
    systemControl_OnOff: "电源开关",
    systemControl_MuteMode: "静音模式",
    systemControl_Voice: "音量调节",
    emotion_Intensity: "情绪强度",
    sensorEvent_Touch: "触摸",
    sensorEvent_Shack: "摇晃",
    sensorEvent_Grop: "冲击跌落",
    sensorEvent_Standing: "静置"
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
    brightness: 50,
    upgradeableVersionList: [] as {
        version: string;
    }[]
});
const onlineStatus = computed(() => true);

const deviceTitle = computed(() =>
    info?.deviceName || t("aiLamp.common.deviceName") || "Cat"
);


const formateEmotion = (content: number) => {
    const map: Record<number, string> = {
        1: iconEmotionHappy, // 喜悦
        2: iconEmotionTrust, // 信任
        3: iconEmotionFear, // 恐惧
        4: iconEmotionAmaze, // 惊讶
        5: iconEmotionSad, // 悲伤
        6: iconEmotionHate, // 厌恶
        7: iconEmotionAngry, // 愤怒
        8: iconEmotionWish, // 期待
    };
    return map[content] || iconEmotionSad;
}

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
    setData('systemControl_Voice', value);
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
        // toast({ text: '查询成功' });
        settingsForm.value.upgradeableVersionList = res.result.upgradeableVersionList || [];
    } else {
    }
}
</script>

<template>
    <div class="cat-page">
        <div class="cat-wrap">
            <section class=" cat-hero">
                <div class="cat-hero-top">
                    <div class="cat-device-img">
                        <img class="cat-device-icon" :src="info.productIcon" alt="" />
                    </div>

                    <div class="cat-hero-info">
                        <div class="flex flex-row gap-1.5">
                            <div class="cat-name">{{ deviceTitle }}</div>
                            <AlarmDialog label="设备名称" v-model="settingsForm.deviceName" type="text"
                                @confirm="updateDeviceName" :maxlength="16" />

                        </div>

                        <div class="cat-status-row">
                            <span class="cat-dot" :class="onlineStatus ? 'is-online' : 'is-offline'"></span>
                            <span class="cat-status" :class="onlineStatus ? 'is-online' : 'is-offline'">
                                {{ onlineStatus ? t("online") : t("offline") }}
                            </span>
                        </div>
                    </div>
                    <div v-if="onlineStatus" class="cat-button-group">
                        <div class="cat-button" @click="goToChat">
                            <Icon name="icon-liaotianjilu" width="1.5rem" height="1.5rem" color="#5D616B" />
                        </div>
                        <div class="cat-button">
                            <BatteryIcon style="margin-top: 4px;" :level="data?.systemControl_Battery || 100"
                                :charging="data?.systemControl_Power" :vertical="true" width="12px" height="18px" />
                            <div class="cat-battery-text">{{ data?.systemControl_Battery || 100 }}%</div>
                        </div>

                    </div>
                </div>

            </section>
            <section class="cat-hero" style="margin-top: -20px;">
                <img class="cat-hero-img" :src="info.productIcon" alt="" />

                <div class="cat-device-status">
                    <div class="cat-emotion-text">设备情绪</div>
                    <img class="cat-emotion-icon" :src="formateEmotion(data.emotion_Emotion || 1)" alt="" />

                </div>

            </section>

            <section>
                <div class="cat-card">
                    <!-- 音量调节 -->
                    <div class="flex items-center flex-row justify-start gap-1  py-5 ">
                        <div class="font-medium flex items-center  gap-1 text-[16px]"> <img class="w-6 h-6"
                                :src="iconVolume" alt="" />音量调节
                        </div>
                        <span class="opacity-60">|</span>
                        <span class="opacity-60">{{ data.systemControl_Voice || 0 }}%</span>
                    </div>
                    <div class="flex items-center  flex-col ">
                        <div class="flex justify-between w-full">
                            <span class="opacity-60">0%</span>
                            <span class="opacity-60">100%</span>
                        </div>
                        <ThinSlider :value="data.systemControl_Voice || 0" :range="[0, 100, 1]" :show-button="false"
                            :show-mark="false" track-color="#E5E5E5" track-tint-color="#FF8C42"
                            @complete="v => setVolume(v)" />
                    </div>
                </div>

            </section>

            <!-- 由 config.data 自动推导的属性控件 -->
            <section v-for="c in controls" :key="c.name">
                <div class="cat-card">
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
                                :show-mark="false" track-color="#E5E5E5" track-tint-color="#FF8C42"
                                @complete="v => setData(c.name, v)" />
                        </div>
                    </template>

                    <!-- 枚举：分段按钮 -->
                    <div v-else-if="c.type === 'enum'" class="flex items-center flex-row justify-between gap-1 py-5">
                        <div class="font-medium flex items-center gap-1 text-[16px]">{{ labelOf(c.name) }}</div>
                        <div class="flex items-center gap-2 flex-wrap justify-end">
                            <button v-for="opt in enumOptions(c.options)" :key="opt.value" class="cat-segment"
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
                <div class="cat-card py-5" @click="upgradeFirmware">
                    <div class="flex items-center flex-row justify-between gap-1 ">
                        <div class="flex items-center flex-row justify-start gap-1 ">
                            <img class="w-6 h-6" :src="iconOTA" alt="" />
                            <span class="font-medium text-[16px]">固件更新</span>
                        </div>
                        <div class="flex items-center flex-row justify-start gap-1">
                            <span class="opacity-60 leading-tight">{{ settingsForm.upgradeableVersionList.length > 0 ?
                                settingsForm.upgradeableVersionList[0].version : '' }}

                            </span>
                            <div class="flex  flex-col justify-start self-stretch"
                                v-if="settingsForm.upgradeableVersionList.length > 0">
                                <span class="cat-dot-alarm"></span>

                            </div>

                            <Icon name="icon-arrowright" width="1rem" height="1rem" color="var(--icon-color)" />
                        </div>
                    </div>
                </div>
            </section>

            <section>
                <div class="cat-card py-5" @click="goToMessage">
                    <div class="flex items-center flex-row justify-between gap-1 ">
                        <div class="flex items-center flex-row justify-start gap-1 ">
                            <img class="w-6 h-6" :src="iconMessage" alt="" />
                            <div class="flex items-start flex-col justify-start ">
                                <div class="font-medium text-[16px] leading-tight">消息通知</div>
                                <div class=" text-[13px] opacity-60 leading-tight">查看该设备的平台状态提醒</div>
                            </div>

                        </div>
                        <div class="flex items-center flex-row justify-start gap-1">
                            <Icon name="icon-arrowright" width="1rem" height="1rem" color="var(--icon-color)" />
                        </div>
                    </div>
                </div>
            </section>

            <section>
                <div class="cat-card py-5" @click="clearChatRecords">
                    <div class="flex items-center flex-row justify-between gap-1 ">
                        <div class="flex items-center flex-row justify-start gap-1 ">
                            <img class="w-6 h-6" :src="iconDelete" alt="" />
                            <div class="flex items-start flex-col justify-start ">
                                <div class="font-medium text-[16px] leading-tight">删除设备信息</div>
                                <div class=" text-[13px] opacity-60 leading-tight">清除陪伴档案、对话与互动记录</div>
                            </div>

                        </div>
                        <div class="flex items-center flex-row justify-start gap-1">
                            <Icon name="icon-arrowright" width="1rem" height="1rem" color="var(--icon-color)" />
                        </div>
                    </div>
                </div>
            </section>

            <section>
                <div class="cat-card py-5" @click="unbindDevice">
                    <div class="flex items-center flex-row justify-between gap-1 ">
                        <div class="flex items-center flex-row justify-start gap-1 ">
                            <img class="w-6 h-6" :src="iconUnBind" alt="" />
                            <div class="flex items-start flex-col justify-start ">
                                <div class="font-medium text-[16px] leading-tight">解绑设备</div>
                                <div class=" text-[13px] opacity-60 leading-tight">解绑后可由其他账号重新绑定</div>
                            </div>

                        </div>
                        <div class="flex items-center flex-row justify-start gap-1">
                            <Icon name="icon-arrowright" width="1rem" height="1rem" color="var(--icon-color)" />
                        </div>
                    </div>
                </div>
            </section>





        </div>
        <div class="cat-breath">
            <img class="w-full h-full object-contain" :src="breathImg" alt="" />

        </div>
    </div>
</template>

<style lang="scss" scoped>
.cat-page {
    @apply relative z-[1] text-[#0c121f];
    height: 100vh;
    box-sizing: border-box;
    overflow-y: auto;
    background-image: url("@/assets/images/yoyo/yoyo-bg.png");
    background-size: cover;
    background-attachment: local;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;

    .cat-breath {
        @apply absolute top-[40px] left-[0px] w-[290px] h-[180px];
    }

    .cat-wrap {
        @apply relative z-[1] flex w-full flex-col gap-3 px-3 pb-6;
    }

    .cat-card {
        @apply rounded-2xl bg-white px-5;

        .cat-dot-alarm {
            @apply aspect-square w-[4px] rounded-[2px] bg-[#FF8C42];
        }

    }

    .cat-segment {
        @apply rounded-full px-3 py-1 text-[13px] leading-none;
        color: rgba(12, 18, 31, 0.6);
        background: #f7f8fc;

        &.is-active {
            color: #fff;
            background: #FF8C42;
        }
    }

    .cat-hero {
        @apply px-3 flex w-full items-center flex-col;

        .cat-hero-top {
            @apply py-5 flex items-start gap-3 w-full;
        }

        .cat-hero-img {
            @apply w-[200px] h-[200px] object-contain;
        }

        .cat-device-img {
            @apply flex items-center justify-center;
            width: 56px;
            height: 56px;
            background: #D9D8E6;
            border: 2px solid #FFFFFF;
            border-radius: 50%;

        }

        .cat-device-icon {
            @apply flex-shrink-0 rounded-lg object-contain;
            width: 44px;
            height: 40px;

        }

        .cat-hero-info {
            @apply min-w-0 flex-1;
        }

        .cat-button-group {
            @apply flex items-center gap-3 flex-col;
        }

        .cat-button {
            @apply flex items-center justify-center rounded-full flex-col;
            width: 40px;
            height: 40px;
            background: rgba(255, 255, 255, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.6);
            gap: 2px;
        }

        .cat-battery-text {
            color: rgba(0, 0, 0, 0.6);
            font-size: 10px;
        }

        .cat-name {
            @apply truncate text-[#FFFFFF];
            font-weight: 500;
            font-size: 18px;
        }

        .cat-status-row {
            @apply mt-1 flex items-center gap-1.5 leading-none;
            font-size: 12px;
            font-weight: 400;
        }



        .cat-dot {
            @apply aspect-square w-1.5 rounded-full;

            &.is-online {
                @apply bg-[#5FEE92];
            }

            &.is-offline {
                @apply bg-[#999];
            }
        }

        .cat-status {
            &.is-online {
                @apply text-[#fff];
            }

            &.is-offline {
                @apply text-[#999];
            }
        }

        .cat-state-pill {
            @apply box-border flex flex-shrink-0 items-center gap-1 rounded-full bg-[#f7f8fc] px-2.5 py-1 leading-none;
            font-size: 0.8571rem;
            line-height: 1.35;
            font-weight: 400;
            color: rgba(12, 18, 31, 0.6);

            &.is-active {
                @apply text-[#00aaff];
                background: rgba(230, 242, 254, 0.5);
            }

            .cat-pill-icon {
                @apply aspect-square w-[1.2em] flex-shrink-0 object-contain;
            }
        }

        .cat-gray-text {
            color: rgba(0, 0, 0, 0.4);
        }

        .cat-device-status {
            @apply flex items-center gap-1.5 leading-none justify-center;
            font-size: 12px;
            font-weight: 400;
            border-radius: 20px;
            background: #FFFFFF;
            border: 1px solid #FFFFFF;
            box-shadow: 0px 4px 10px 0px rgba(0, 0, 0, 0.1);
            width: 110px;
            height: 40px;
        }

        .cat-emotion-text {
            @apply text-[#FF8C42];
            font-size: 12px;
        }

        .cat-emotion-icon {
            @apply w-[2.4em] h-[2.4em] flex-shrink-0 object-contain;
        }


    }


}

.ailamp-nav {
    @apply relative z-[20] flex-shrink-0;
}
</style>