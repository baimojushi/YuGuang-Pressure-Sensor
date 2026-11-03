<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { initData, info } from "../../stores";
import { isMiniProgramEnv } from "../../utils";
import { NavigationBar, Icon, ScrollPicker, loading, toast } from "xjiang-ui";
import type { ScrollPickerOption } from "xjiang-ui/components/scroll-picker/src/ScrollPicker.vue";
import AlarmConfigItem from "../../components/AlarmConfigItem.vue";
import { addAlarm, AddAlarmParams, AlarmTemplateItem, checkTextSafety, editAlarm, fetchAlarmDetail, fetchAlarmTemplates, fetchIntensities, fetchRepeatOptions, fetchRingTones, fetchSnoozeOptions } from "@/utils/apis/aiAlarmApi";


const router = useRouter();
const scheduleId = ref<string | null>(null);
scheduleId.value = router.currentRoute.value.query.scheduleId as string || null;
const { t } = useI18n();
const templates = ref<AlarmTemplateItem[]>([]);
// 铃声选项
const ringtoneOptions = ref<ScrollPickerOption[][]>([
    []
]);
const getRingOptions = async () => {
    const res = await fetchRingTones({ deviceId: info.did });
    if (res.data) {
        ringtoneOptions.value[0] = res.data.map(item => ({
            text: item.name,
            value: item.code
        }));
    }
}

// 重复选项
const repeatOptions = ref<ScrollPickerOption[][]>([
    []
]);

const getRepeatOptions = async () => {
    const res = await fetchRepeatOptions();
    if (res.data) {
        repeatOptions.value[0] = res.data.map(item => ({
            text: item.name,
            value: item.repeatCode
        }));
    }
}

// 唤醒强度选项
const strengthOptions = ref<ScrollPickerOption[][]>([
    []
]);
const getRingstrengthOptions = async () => {
    const res = await fetchIntensities();
    if (res.data) {
        strengthOptions.value[0] = res.data.map(item => ({
            text: item.name,
            value: item.code
        }));
    }
}

// 贪睡设置选项
const snoozeOptions = ref<ScrollPickerOption[][]>([
    [
        {
            text: "不开启",
            value: 0
        },
        {
            text: "开启",
            value: 1
        },
    ]
]);

const snoozeIntervalOptions = ref<ScrollPickerOption[][]>([
    [
        {
            text: "1分钟",
            value: 1
        },
        {
            text: "2分钟",
            value: 2
        },
        {
            text: "3分钟",
            value: 3
        },
        {
            text: "4分钟",
            value: 4
        },
        {
            text: "5分钟",
            value: 5
        },
        {
            text: "6分钟",
            value: 6
        },
        {
            text: "7分钟",
            value: 7
        },
        {
            text: "8分钟",
            value: 8
        },
        {
            text: "9分钟",
            value: 9
        },
        {
            text: "10分钟",
            value: 10
        },
        {
            text: "11分钟",
            value: 11
        },
        {
            text: "12分钟",
            value: 12
        },
        {
            text: "13分钟",
            value: 13
        },
        {
            text: "14分钟",
            value: 14
        },
        {
            text: "15分钟",
            value: 15
        },

    ]
]);
// 贪睡次数选项
const snoozeCountOptions = ref<ScrollPickerOption[][]>([
    [
        {
            text: "1次",
            value: 1
        },
        {
            text: "2次",
            value: 2
        },
        {
            text: "3次",
            value: 3
        },
        {
            text: "4次",
            value: 4
        },
        {
            text: "5次",
            value: 5
        },
    ]
]);



// 提醒类型定义（与 HomeView / MyClocks 保持一致）
interface ReminderType {
    templateCode: 'wakeup' | 'study' | 'goodnight' | 'reading' | 'sport' | 'other' | ""
    label: string
    icon: string
    iconColor: string
    bgClass: string
}

// 提醒类型列表（与 HomeView / MyClocks 的 AlarmItem.type 对应）
const reminderTypes = ref<ReminderType[]>([
    {
        templateCode: "wakeup",
        label: "起床提醒",
        icon: "icon-qichuang",
        iconColor: "#34C759",
        bgClass: "bg-green-50",
    },
    {
        templateCode: "goodnight",
        label: "晚安提醒",
        icon: "icon-wanan",
        iconColor: "#937DF6",
        bgClass: "bg-indigo-50",
    },
    {
        templateCode: "study",
        label: "学习提醒",
        icon: "icon-xuexi",
        iconColor: "#FB2C00",
        bgClass: "bg-red-50",
    },
    {
        templateCode: "reading",
        label: "看书提醒",
        icon: "icon-kanshu",
        iconColor: "#458CFF",
        bgClass: "bg-blue-50",
    },
    {
        templateCode: "sport",
        label: "运动提醒",
        icon: "icon-yundong",
        iconColor: "#FFA500",
        bgClass: "bg-amber-50",
    },

    {
        templateCode: "other",
        label: "自定义",
        icon: "icon-zidingyi",
        iconColor: "#F46CED",
        bgClass: "bg-[#FFF3FE]",
    },
]);
const getTemplates = async () => {
    const res = await fetchAlarmTemplates();
    if (res.data) {
        templates.value = res.data;
    }
}

// 根据 templateCode 填充 alarmForm
const applyTemplate = (templateCode: string) => {
    const template = templates.value.find(t => t.templateCode === templateCode);
    if (template) {
        alarmForm.value.theme = template.templateName;
        alarmForm.value.repeatCode = template.defaultRepeatCode;
        alarmForm.value.extJson.templateCode = template.templateCode;
        alarmForm.value.extJson.templateName = template.templateName;
        alarmForm.value.extJson.message = template.defaultMessage;
        alarmForm.value.extJson.ring = template.defaultRing;
        alarmForm.value.extJson.toneResourceId = template.defaultToneResourceId;
        alarmForm.value.extJson.snoozeEnabled = template.defaultSnoozeEnabled;
        alarmForm.value.extJson.snoozeInterval = template.defaultSnoozeInterval;
        alarmForm.value.extJson.snoozeMaxCount = template.defaultSnoozeMaxCount;
        alarmForm.value.extJson.intensity = template.defaultIntensity;

    }
};


// 时间选择数据
const hourOptions: ScrollPickerOption[][] = [
    Array.from({ length: 24 }, (_, i) => ({
        text: String(i).padStart(2, '0'),
        value: i,
    }))
];

const minuteOptions: ScrollPickerOption[][] = [
    Array.from({ length: 60 }, (_, i) => ({
        text: String(i).padStart(2, '0'),
        value: i,
    }))
];

// 当前选中的时间


// 闹钟表单数据
const alarmForm = ref<AddAlarmParams>({
    deviceId: info?.did,
    pid: info?.pid,
    theme: "",
    repeatCode: "",
    bizType: "ledi_alarm",
    clockTime: "00:00",
    extJson: {
        templateCode: "",
        templateName: "",
        message: "",
        ring: "",
        toneResourceId: "",
        intensity: "",
        snoozeEnabled: 1,
        snoozeInterval: 5,
        snoozeMaxCount: 2,
    }
}
);

const hourValue = ref([0]);
const minuteValue = ref([0]);

// 选择提醒类型
const selectType = (templateCode: ReminderType['templateCode'], label: ReminderType['label']) => {
    alarmForm.value.extJson.templateCode = templateCode;
    alarmForm.value.extJson.templateName = label;
    applyTemplate(templateCode);
};
const load = loading({ type: "loading" });
const getAlarmDetail = async () => {
    if (scheduleId.value) {

        const res = await fetchAlarmDetail({
            scheduleId: scheduleId.value,
            deviceId: info?.did,
        });
        load.close();

        if (res.data) {
            alarmForm.value.scheduleId = res.data.scheduleId;
            alarmForm.value.repeatCode = res.data.repeatCode;
            alarmForm.value.deviceId = res.data.deviceId;
            alarmForm.value.theme = res.data.theme;
            alarmForm.value.bizType = res.data.bizType;
            alarmForm.value.clockTime = res.data.clockTime;
            alarmForm.value.extJson.templateCode = res.data.extJson.templateCode || "other";
            alarmForm.value.extJson.templateName = res.data.extJson.templateName;
            alarmForm.value.extJson.message = res.data.extJson.message || "";
            alarmForm.value.extJson.ring = res.data.extJson.ring || "";
            alarmForm.value.extJson.toneResourceId = res.data.extJson.toneResourceId || "";
            alarmForm.value.extJson.snoozeEnabled = res.data.extJson.snoozeEnabled || 0;
            alarmForm.value.extJson.snoozeInterval = res.data.extJson.snoozeInterval || 5;
            alarmForm.value.extJson.snoozeMaxCount = res.data.extJson.snoozeMaxCount || 2;
            alarmForm.value.extJson.intensity = res.data.extJson.intensity || "";
            // 更新时间选择器
            hourValue.value = [Number(alarmForm.value.clockTime.split(":")[0])];
            minuteValue.value = [Number(alarmForm.value.clockTime.split(":")[1])];
        }
    } else {
        // 应用默认模板
        if (templates.value.length > 0) {
            applyTemplate("wakeup");
        }
        const now = new Date();
        hourValue.value = [now.getHours()];
        minuteValue.value = [now.getMinutes()];
    }
    load.close();
}
// 判断是否是自定义模式
const isCustom = computed(() => {
    return alarmForm.value.extJson.templateCode === "other" || alarmForm.value.extJson.templateCode === "";
});
// 仅允许中文、英文、数字和基础标点符号（el-input 的 formatter/parser 使用）
const invalidCharReg = /[^\u4e00-\u9fa5a-zA-Z0-9\s.,!?'"(),，。！？、；：""'']/g
const filterValidChars = (value: string) => (value || '').replace(invalidCharReg, '')
// 保存闹钟
const saveAlarm = async () => {
    // TODO: 调用接口保存
    alarmForm.value.clockTime = `${hourValue.value[0]}:${minuteValue.value[0]}`;
    alarmForm.value.extJson.templateCode = alarmForm.value.extJson.templateCode === "other" ? "" : alarmForm.value.extJson.templateCode;
    // 敏感词校验
    const message = (alarmForm.value.extJson.message || "").trim();
    const theme = (alarmForm.value.theme || "").trim();
    if (message) {
        const res = await checkTextSafety({ content: message });
        if (res.ok && res.result?.suggestion && res.result?.suggestion >= 1) {
            toast({ text: '播报内容包含敏感词，请修改后重试' });
            return;
        }
    }
    if (theme) {
        const res = await checkTextSafety({ content: theme });
        if (res.ok && res.result?.suggestion && res.result?.suggestion >= 1) {
            toast({ text: '闹钟名称包含敏感词，请修改后重试' });
            return;
        }
    }
    if (scheduleId.value) {
        const res = await editAlarm(alarmForm.value);
        if (res.code === 200) {
            toast({ text: '更新成功' });
            router.back();
        } else {
            toast({ text: res.message || '更新失败' });
        }
    } else {
        const res = await addAlarm(alarmForm.value);
        if (res.code === 200) {
            toast({ text: '保存成功' });
            router.back();
        } else {
            toast({ text: res.message || '保存失败' });
        }
    }

};


onMounted(async () => {
    if (!info.did) return;
    await getRingOptions();
    await getRingstrengthOptions();
    await getRepeatOptions();
    //await getSnoozeOptions();
    await getTemplates();
    await getAlarmDetail();
})
</script>

<template>
    <div class="add-alarm-root">
        <!-- 导航栏 -->
        <div v-if="!isMiniProgramEnv" class="add-alarm-nav">
            <NavigationBar :statusbar-height="initData?.statusBarHeight || 24"
                :title="scheduleId ? t('aiclock.editAlarm') : t('aiclock.addAlarm')" />
        </div>

        <!-- 页面内容 -->
        <div class="min-h-screen p-4 flex flex-col">
            <!-- 主卡片 -->
            <div class="bg-white rounded-2xl p-6 shadow-sm" style="box-shadow: 0px 8px 20px 0px rgba(208, 90, 11, 0.1)">

                <!-- 提醒类型网格 -->
                <div class="grid grid-cols-2 gap-3">
                    <div v-for="item in reminderTypes" :key="item.templateCode" class="reminder-item"
                        :class="[item.templateCode, { active: alarmForm.extJson.templateCode === item.templateCode }]"
                        @click="selectType(item.templateCode, item.label)">
                        <!-- 图标容器 -->
                        <div class="icon-container">
                            <Icon :name="item.icon" width="1.714rem" height="1.714rem" :color="item.iconColor" />
                        </div>

                        <!-- 标签文字 -->
                        <span class="reminder-text">{{ item.label }}</span>
                    </div>
                </div>

                <!-- 时间选择区域 -->
                <div class="mt-6">
                    <div class="flex items-center justify-center py-2  rounded-xl time-picker-wrapper">
                        <div class="flex items-center gap-10">
                            <ScrollPicker v-model="hourValue" :options="hourOptions" loop class="time-picker-column" />
                            <span class="text-[40px] font-bold text-[#0B0A0A] pb-2">:</span>
                            <ScrollPicker v-model="minuteValue" :options="minuteOptions" loop
                                class="time-picker-column" />
                        </div>
                    </div>
                </div>

                <!-- 配置表单 -->
                <form class="mt-6 space-y-0" @submit.prevent="saveAlarm">
                    <AlarmConfigItem label="闹钟名称" v-model="alarmForm.theme" :disabled="!isCustom" type="text"
                        :maxlength="16" showArrow border />
                    <AlarmConfigItem label="闹钟铃声" v-model="alarmForm.extJson.toneResourceId" type="picker" showArrow
                        border :options="ringtoneOptions" />
                    <AlarmConfigItem label="重复" v-model="alarmForm.repeatCode" type="picker" :options="repeatOptions"
                        showArrow border />
                    <!-- <AlarmConfigItem label="唤醒强度" v-model="alarmForm.extJson.intensity" type="picker"
                        :options="strengthOptions" showArrow border /> -->

                    <div class="py-4 " :class="{ 'opacity-50': !isCustom }">
                        <label class="text-[#0B0A0A] font-medium block mb-3">播报内容</label>
                        <div class="bg-gray-50 rounded-xl p-4">
                            <el-input v-model="alarmForm.extJson.message" type="textarea" :rows="3" :maxlength="16"
                                :disabled="!isCustom" :formatter="filterValidChars" :parser="filterValidChars"
                                placeholder="请输入播报内容" />
                            <div class="mt-2 text-right text-sm text-gray-400">
                                {{ (alarmForm.extJson.message || '').length }}/16
                            </div>
                        </div>
                    </div>

                    <AlarmConfigItem label="贪睡设置" v-model="alarmForm.extJson.snoozeEnabled" type="picker"
                        :options="snoozeOptions" :border="false" showArrow />
                    <AlarmConfigItem v-if="alarmForm.extJson.snoozeEnabled" label="贪睡时间"
                        v-model="alarmForm.extJson.snoozeInterval" type="picker" :options="snoozeIntervalOptions"
                        :border="false" showArrow />
                    <AlarmConfigItem v-if="alarmForm.extJson.snoozeEnabled" label="贪睡次数"
                        v-model="alarmForm.extJson.snoozeMaxCount" type="picker" :options="snoozeCountOptions"
                        :border="false" showArrow />


                </form>
            </div>
            <!-- 保存按钮 -->
            <button type="submit"
                class=" mt-8 mx-8 w-[calc(100%-4rem)] py-4 rounded-full text-white font-medium text-lg bg-red-500"
                @click="saveAlarm">
                保存
            </button>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.add-alarm-root {
    overflow-x: hidden;
    background: linear-gradient(181deg, #fdf4ea 13%, #ffffff 99%);
}

.add-alarm-nav {
    @apply relative z-[20] flex-shrink-0;
}

// el-input textarea 无边框、透明背景，保留外层灰色卡片
:deep(.el-textarea) {
    --el-input-bg-color: transparent;
    --el-input-border-color: transparent;
    --el-input-hover-border-color: transparent;
    --el-input-focus-border-color: transparent;
}

:deep(.el-textarea__inner) {
    background: transparent;
    border: none;
    box-shadow: none;
    resize: none;
    padding: 0;
    color: #4b5563; // text-gray-600
    font-size: 14px; // text-sm
    line-height: 1.5;
}

:deep(.el-textarea__inner::placeholder) {
    color: #9ca3af; // gray-400
}

.reminder-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 22px;
    height: 44px;
    background: #ffffff;
    border: 1px solid #eeeeee;
    border-radius: 22px;
    cursor: pointer;
    transition: all 0.2s ease;





    // 起床提醒 - 绿色
    &.wakeup {
        &:hover {
            border-color: #34C759;
        }

        &.active {
            border-color: #34C759;
            background: #F0FDFD;
            color: #34C759;

        }

        .reminder-text {
            color: #34C759;
        }
    }

    // 学习提醒 - 红色
    &.study {
        &:hover {
            border-color: #FB2C00;
        }

        &.active {
            border-color: #FB2C00;
            background: #FEF9F6;
            color: #FB2C00;
        }

    }

    // 看书提醒 - 蓝色
    &.reading {
        &:hover {
            border-color: #458CFF;
        }

        &.active {
            border-color: #458CFF;
            background: #F0F9FF;
        }
    }

    // 运动提醒 - 橙色
    &.sport {
        &:hover {
            border-color: #FFA500;
        }

        &.active {
            border-color: #FFA500;
            background: #FFF9F1;
        }
    }

    // 睡觉提醒 - 紫色
    &.goodnight {
        &:hover {
            border-color: #937DF6;
        }

        &.active {
            border-color: #937DF6;
            background: #FAF6FF;
        }
    }

    // 自定义提醒 - 粉色
    &.other {
        &:hover {
            border-color: #F46CED;
        }

        &.active {
            border-color: #F46CED;
            background: #FFF3FE;
        }
    }
}

.icon-container {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.reminder-text {
    font-size: 14px;
    font-weight: 500;
    color: #0b0a0a;
    line-height: 16px;
    font-family: "PingFang SC", -apple-system, BlinkMacSystemFont, sans-serif;
}

.time-picker-wrapper {
    :deep(.hi-scroll-picker) {
        height: 180px;
    }

    :deep(.hi-scroll-picker__row-option) {
        height: 56px;

        span {
            font-size: 24px;
            color: #999999;
        }
    }

    :deep(.hi-scroll-picker__row-option--active) {
        height: 56px;

        span {
            font-size: 40px;
            font-weight: 600;
            color: #0B0A0A;
        }
    }

    :deep(.hi-scroll-picker__pad) {
        height: calc(50% - 28px);
    }

    :deep(.hi-scroll-picker__center-overlay-custom) {
        border-color: transparent;
    }
}

.time-picker-column {
    width: 80px;
}

.bg-red-500 {
    background-color: var(--active-color);
}
</style>