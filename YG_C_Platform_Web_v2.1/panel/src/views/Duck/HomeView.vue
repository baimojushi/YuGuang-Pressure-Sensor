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
const router = useRouter();


const { t } = useI18n();

theme.setTheme("#FFB300");
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
    info?.deviceName || t("aiLamp.common.deviceName") || "Duck"
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
const setData = (key: string, value: number) => {
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
    <div class="yoyo-page">
        <div class="yoyo-wrap">
            <section class=" yoyo-hero">
                <div class="yoyo-hero-top">
                    <div class="yoyo-device-img">
                        <img class="yoyo-device-icon" :src="info.productIcon" alt="" />
                    </div>

                    <div class="yoyo-hero-info">
                        <div class="flex flex-row gap-1.5">
                            <div class="yoyo-name">{{ deviceTitle }}</div>
                            <AlarmDialog label="设备名称" v-model="settingsForm.deviceName" type="text"
                                @confirm="updateDeviceName" :maxlength="16" />

                        </div>

                        <div class="yoyo-status-row">
                            <span class="yoyo-dot" :class="onlineStatus ? 'is-online' : 'is-offline'"></span>
                            <span class="yoyo-status" :class="onlineStatus ? 'is-online' : 'is-offline'">
                                {{ onlineStatus ? t("online") : t("offline") }}
                            </span>
                        </div>
                    </div>
                    <div v-if="onlineStatus" class="yoyo-button-group">
                        <div class="yoyo-button" @click="goToChat">
                            <Icon name="icon-liaotianjilu" width="1.5rem" height="1.5rem" color="#5D616B" />
                        </div>
                        <div class="yoyo-button">
                            <BatteryIcon style="margin-top: 4px;" :level="data?.systemControl_Battery || 100"
                                :charging="data?.systemControl_Power" :vertical="true" width="12px" height="18px" />
                            <div class="yoyo-battery-text">{{ data?.systemControl_Battery || 100 }}%</div>
                        </div>

                    </div>
                </div>

            </section>
            <section class="yoyo-hero" style="margin-top: -20px;">
                <img class="yoyo-hero-img" :src="info.productIcon" alt="" />

                <div class="yoyo-device-status">
                    <div class="yoyo-emotion-text">设备情绪</div>
                    <img class="yoyo-emotion-icon" :src="formateEmotion(data.emotion_Emotion || 1)" alt="" />

                </div>

            </section>

            <section>
                <div class="yoyo-card">
                    <!-- 屏幕亮度 -->
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
                            :show-mark="false" track-color="#E5E5E5" track-tint-color="#FFB300"
                            @complete="v => setVolume(v)" />
                    </div>
                </div>

            </section>
            <section>
                <div class="yoyo-card py-5" @click="upgradeFirmware">
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
                                <span class="yoyo-dot-alarm"></span>

                            </div>

                            <Icon name="icon-arrowright" width="1rem" height="1rem" color="var(--icon-color)" />
                        </div>
                    </div>
                </div>
            </section>

            <section>
                <div class="yoyo-card py-5" @click="goToMessage">
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
                <div class="yoyo-card py-5" @click="clearChatRecords">
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
                <div class="yoyo-card py-5" @click="unbindDevice">
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
        <div class="yoyo-breath">
            <img class="w-full h-full object-contain" :src="breathImg" alt="" />

        </div>
    </div>
</template>

<style lang="scss" scoped>
.yoyo-page {
    @apply relative z-[1] text-[#0c121f];
    height: 100vh;
    box-sizing: border-box;
    overflow-y: auto;
    background-image: url("@/assets/images/yoyo/yoyo-bg.png");
    background-size: cover;
    background-attachment: local;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;

    .yoyo-breath {
        @apply absolute top-[40px] left-[0px] w-[290px] h-[180px];
    }

    .yoyo-wrap {
        @apply relative z-[1] flex w-full flex-col gap-3 px-3 pb-6;
    }

    .yoyo-card {
        @apply rounded-2xl bg-white px-5;

        .yoyo-dot-alarm {
            @apply aspect-square w-[4px] rounded-[2px] bg-[#FFB300];
        }

    }

    .yoyo-hero {
        @apply px-3 flex w-full items-center flex-col;

        .yoyo-hero-top {
            @apply py-5 flex items-start gap-3 w-full;
        }

        .yoyo-device-img {
            @apply flex items-center justify-center;
            width: 56px;
            height: 56px;
            background: #D9D8E6;
            border: 2px solid #FFFFFF;
            border-radius: 50%;

        }

        .yoyo-device-icon {
            @apply flex-shrink-0 rounded-lg object-contain;
            width: 44px;
            height: 40px;

        }

        .yoyo-hero-info {
            @apply min-w-0 flex-1;
        }

        .yoyo-button-group {
            @apply flex items-center gap-3 flex-col;
        }

        .yoyo-button {
            @apply flex items-center justify-center rounded-full flex-col;
            width: 40px;
            height: 40px;
            background: rgba(255, 255, 255, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.6);
            gap: 2px;
        }

        .yoyo-battery-text {
            color: rgba(0, 0, 0, 0.6);
            font-size: 10px;
        }

        .yoyo-name {
            @apply truncate text-[#FFFFFF];
            font-weight: 500;
            font-size: 18px;
        }

        .yoyo-status-row {
            @apply mt-1 flex items-center gap-1.5 leading-none;
            font-size: 12px;
            font-weight: 400;
        }



        .yoyo-dot {
            @apply aspect-square w-1.5 rounded-full;

            &.is-online {
                @apply bg-[#5FEE92];
            }

            &.is-offline {
                @apply bg-[#999];
            }
        }

        .yoyo-status {
            &.is-online {
                @apply text-[#fff];
            }

            &.is-offline {
                @apply text-[#999];
            }
        }

        .yoyo-state-pill {
            @apply box-border flex flex-shrink-0 items-center gap-1 rounded-full bg-[#f7f8fc] px-2.5 py-1 leading-none;
            font-size: 0.8571rem;
            line-height: 1.35;
            font-weight: 400;
            color: rgba(12, 18, 31, 0.6);

            &.is-active {
                @apply text-[#00aaff];
                background: rgba(230, 242, 254, 0.5);
            }

            .yoyo-pill-icon {
                @apply aspect-square w-[1.2em] flex-shrink-0 object-contain;
            }
        }

        .yoyo-gray-text {
            color: rgba(0, 0, 0, 0.4);
        }

        .yoyo-device-status {
            @apply flex items-center gap-1.5 leading-none justify-center;
            font-size: 12px;
            font-weight: 400;
            border-radius: 20px;
            margin-top: -20px;
            background: #FFFFFF;
            border: 1px solid #FFFFFF;
            box-shadow: 0px 4px 10px 0px rgba(0, 0, 0, 0.1);
            width: 110px;
            height: 40px;
        }

        .yoyo-emotion-text {
            @apply text-[#FFB300];
            font-size: 12px;
        }

        .yoyo-emotion-icon {
            @apply w-[2.4em] h-[2.4em] flex-shrink-0 object-contain;
        }


    }


}

.ailamp-nav {
    @apply relative z-[20] flex-shrink-0;
}
</style>