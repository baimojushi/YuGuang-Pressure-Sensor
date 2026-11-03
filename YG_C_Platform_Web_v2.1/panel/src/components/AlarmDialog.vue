<script setup lang="ts">
import { ref, computed } from "vue";
import { ScrollPicker } from "xjiang-ui";
import type { ScrollPickerOption } from "xjiang-ui/components/scroll-picker/src/ScrollPicker.vue";
import { checkTextSafety } from "../utils/apis/aiAlarmApi";
import { NavigationBar, Icon, theme, ThinSlider, toast, centerConfirmDialog } from 'xjiang-ui';

const props = withDefaults(defineProps<{
    label: string;
    modelValue: string | number;
    type?: "text" | "picker";
    options?: ScrollPickerOption[][];
    showArrow?: boolean;
    border?: boolean;
    disabled?: boolean;
    maxlength?: number;
}>(), {
    disabled: false,
    maxlength: undefined,
});

const emit = defineEmits<{
    (e: "update:modelValue", value: string | number): void;
    (e: "confirm", value: string | number): void;
}>();

const showDialog = ref(false);
const isFocused = ref(false);
const tempValue = ref<string | number>(props.modelValue);
const isChecking = ref(false);
const errorMsg = ref("");

const displayValue = computed(() => {
    if (props.type === 'picker' && props.options && props.options.length > 0) {
        const option = props.options[0].find(opt => opt.value === props.modelValue);
        return option ? option.text : props.modelValue;
    }
    return props.modelValue;
});

const currentLength = computed(() => {
    if (typeof tempValue.value === 'number') {
        return String(tempValue.value).length;
    }
    return tempValue.value?.length || 0;
});

const pickerValue = computed({
    get: () => [tempValue.value],
    set: (val) => {
        tempValue.value = val[0];
    },
});

const openDialog = () => {
    if (props.disabled) return;
    tempValue.value = props.modelValue;
    errorMsg.value = "";
    showDialog.value = true;
};

const confirm = async () => {
    if (isChecking.value) return;
    errorMsg.value = "";

    if (props.type === "text" || !props.type) {
        const textValue = String(tempValue.value || "").trim();
        if (!textValue) {
            errorMsg.value = `请输入${props.label}`;
            return;
        }

        isChecking.value = true;
        try {
            const res = await checkTextSafety({ content: textValue });
            if (res.ok && res.result?.suggestion && res.result?.suggestion >= 1) {
                errorMsg.value = "内容包含敏感词，请修改后重试";
                return;
            }
        } catch (e) {
            console.error("敏感词校验失败", e);
        } finally {
            isChecking.value = false;
        }
    }

    emit("update:modelValue", tempValue.value);
    emit("confirm", tempValue.value);
    showDialog.value = false;
};

const cancel = () => {
    showDialog.value = false;
};
</script>

<template>
    <div>
        <!-- 展示行 -->
        <div class="yoyo-button" @click="openDialog">
            <Icon name="icon-bianji1" width="1rem" height="1rem" color="#5D616B" />

        </div>

        <!-- 弹窗 -->
        <div v-if="showDialog" class="fixed inset-0 z-50 flex items-end justify-center bg-black/50" @click="cancel"
            @touchmove.prevent>
            <div class="w-full bg-white rounded-t-2xl p-6" @click.stop>
                <div class="flex items-center justify-between mb-6">
                    <span class="text-gray-500" @click="cancel">取消</span>
                    <span class="font-medium">{{ label }}</span>
                    <span class="text-[#FB2C00] font-medium" @click="confirm">确定</span>
                </div>

                <!-- input 模式 -->
                <div v-if="type === 'text' || !type" class="flex justify-center h-[200px] flex-col items-center">
                    <input v-model="tempValue" type="text"
                        class="w-full h-[44px] text-center text-lg py-3 border-b outline-none transition-colors"
                        :class="errorMsg ? 'border-red-500' : 'border-gray-200'"
                        :placeholder="isFocused ? '' : `请输入${label}`" :maxlength="maxlength" autofocus
                        @focus="isFocused = true" @blur="isFocused = false" @input="errorMsg = ''" />
                    <div v-if="errorMsg" class="w-full mt-2 text-sm text-red-500 text-center">
                        {{ errorMsg }}
                    </div>
                    <div v-else-if="maxlength" class="w-full mt-3 text-right text-sm text-gray-400">
                        {{ currentLength }}/{{ maxlength }}
                    </div>
                </div>

                <!-- picker 模式 -->
                <div v-else-if="type === 'picker' && options" class="flex justify-center">
                    <ScrollPicker v-model="pickerValue" :options="options" class="h-[200px] w-[120px]" />
                </div>
            </div>
        </div>
    </div>
</template>
<style lang="scss" scoped>
.yoyo-button {
    @apply flex items-center justify-center rounded-full flex-col;
    width: 24px;
    height: 24px;
    background: rgba(255, 255, 255, 0.4);
    gap: 2px;
}
</style>