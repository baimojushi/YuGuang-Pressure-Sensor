<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { toast } from "xjiang-ui";
import { getNewSmsCode, loginByCode, iotLogin } from "@/utils/apis/authApi";
import {
    setStoredAgentToken,
    setStoredIotToken
} from "@/utils/nativeApiRequestHeaders";

const router = useRouter();
const route = useRoute();

const mobile = ref("");
const captcha = ref("");
const countdown = ref(0);
const sending = ref(false);
const submitting = ref(false);

let timer: number | undefined;

/** 接口成功判断：兼容 status=0 与 ok=true 两种响应壳 */
function isOk(res: { status?: number; ok?: boolean } | undefined) {
    return !!res && (res.status === 0 || res.ok === true);
}

const mobileValid = computed(() => /^1[3-9]\d{9}$/.test(mobile.value));
const canSend = computed(
    () => mobileValid.value && countdown.value === 0 && !sending.value
);
const canSubmit = computed(
    () =>
        mobileValid.value &&
        /^\d{4,6}$/.test(captcha.value) &&
        !submitting.value
);

function startCountdown() {
    countdown.value = 60;
    timer = window.setInterval(() => {
        countdown.value -= 1;
        if (countdown.value <= 0) {
            window.clearInterval(timer);
            timer = undefined;
        }
    }, 1000);
}

async function handleSendCode() {
    if (!mobileValid.value) {
        toast({ text: "请输入正确的手机号" });
        return;
    }
    if (!canSend.value) return;
    sending.value = true;
    try {
        const res = await getNewSmsCode({ mobile: mobile.value, loginType: 0 });
        if (isOk(res)) {
            toast({ text: "验证码已发送" });
            startCountdown();
        } else {
            toast({ text: res?.msg || "验证码发送失败" });
        }
    } catch {
        // 请求拦截器已统一提示
    } finally {
        sending.value = false;
    }
}

async function handleLogin() {
    if (!mobileValid.value) {
        toast({ text: "请输入正确的手机号" });
        return;
    }
    if (!/^\d{4,6}$/.test(captcha.value)) {
        toast({ text: "请输入正确的验证码" });
        return;
    }
    if (!canSubmit.value) return;
    submitting.value = true;
    try {
        const res = await loginByCode({
            mobile: mobile.value,
            captcha: captcha.value
        });
        const agentToken = res?.result?.content?.tokenValue;
        if (isOk(res) && agentToken) {
            // Agent token 用于 Agent-Authorization 头
            setStoredAgentToken(agentToken);
            // 登录成功后，用 Agent token 换取 IoT token（用于 Authorization 头）
            await exchangeIotToken(agentToken);
            toast({ text: "登录成功" });
            // 登录成功后进入设备列表，选择设备拿到 did
            const redirect = route.query.redirect as string | undefined;
            router.replace({
                name: "deviceList",
                query: redirect ? { redirect } : undefined
            });
        } else {
            toast({ text: res?.msg || "登录失败" });
        }
    } catch {
        // 请求拦截器已统一提示
    } finally {
        submitting.value = false;
    }
}

/** 用 Agent token 换取 IoT token，失败不阻塞登录 */
async function exchangeIotToken(agentToken: string) {
    try {
        const res = await iotLogin({ token: agentToken });
        const iotToken = res?.result?.token;
        if (isOk(res) && iotToken) {
            setStoredIotToken(iotToken);
        }
    } catch {
        // 换取失败不阻塞登录，由请求拦截器提示
    }
}

onUnmounted(() => {
    if (timer) window.clearInterval(timer);
});
</script>

<template>
    <div class="login-page">
        <div class="login-header">
            <h1 class="login-title">登录</h1>
            <p class="login-subtitle">使用手机号验证码登录</p>
        </div>

        <form class="login-form" @submit.prevent="handleLogin">
            <div class="login-field">
                <span class="login-prefix">+86</span>
                <input v-model="mobile" class="login-input" type="tel" inputmode="numeric" maxlength="11"
                    placeholder="请输入手机号" />
            </div>

            <div class="login-field">
                <input v-model="captcha" class="login-input" type="tel" inputmode="numeric" maxlength="6"
                    placeholder="请输入验证码" />
                <button type="button" class="login-code-btn" :disabled="!canSend" @click="handleSendCode">
                    {{ countdown > 0 ? `${countdown}s后重发` : "获取验证码" }}
                </button>
            </div>

            <button type="submit" class="login-submit" :disabled="!canSubmit">
                {{ submitting ? "登录中..." : "登录" }}
            </button>
        </form>
    </div>
</template>

<style lang="scss" scoped>
.login-page {
    min-height: 100vh;
    padding: 0 32px;
    background-color: #fff;
    display: flex;
    flex-direction: column;
    justify-content: center;
}

.login-header {
    margin-bottom: 40px;
}

.login-title {
    font-size: 28px;
    font-weight: 600;
    color: #0b0a0a;
}

.login-subtitle {
    margin-top: 8px;
    font-size: 14px;
    color: #999;
}

.login-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.login-field {
    display: flex;
    align-items: center;
    height: 52px;
    padding: 0 16px;
    border-radius: 12px;
    background-color: #f6f6f6;
}

.login-prefix {
    font-size: 16px;
    color: #0b0a0a;
    margin-right: 8px;
}

.login-input {
    flex: 1;
    min-width: 0;
    height: 100%;
    border: none;
    outline: none;
    background: transparent;
    font-size: 16px;
    color: #0b0a0a;

    &::placeholder {
        color: #bbb;
    }
}

.login-code-btn {
    flex-shrink: 0;
    padding-left: 12px;
    font-size: 14px;
    color: var(--active-color, #fb2c00);
    background: transparent;
    border: none;

    &:disabled {
        color: #bbb;
    }
}

.login-submit {
    height: 52px;
    margin-top: 8px;
    border: none;
    border-radius: 26px;
    font-size: 16px;
    font-weight: 500;
    color: #fff;
    background-color: var(--active-color, #fb2c00);

    &:disabled {
        opacity: 0.4;
    }
}
</style>