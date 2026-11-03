<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { toast } from "xjiang-ui";
import {
    getFamilyList,
    getRoomList,
    type UserDevice
} from "@/utils/apis/iotApi";
import { setDeviceInfo } from "@/stores";

/** 设备卡片数据（附带所属家庭/房间信息） */
interface DeviceItem {
    device: UserDevice;
    familyName: string;
    roomName: string;
}

const router = useRouter();
const route = useRoute();

const loading = ref(true);
const devices = ref<DeviceItem[]>([]);

/** 接口成功判断：兼容 status=0 与 ok=true 两种响应壳 */
function isOk(res: { status?: number; ok?: boolean } | undefined) {
    return !!res && (res.status === 0 || res.ok === true);
}

async function loadDevices() {
    loading.value = true;
    try {
        const familyRes = await getFamilyList();
        if (!isOk(familyRes)) {
            toast({ text: familyRes?.msg || "获取家庭列表失败" });
            return;
        }
        const families = familyRes?.result?.list ?? [];

        const roomResults = await Promise.all(
            families.map(item => getRoomList({ id: item.family.id }))
        );

        const list: DeviceItem[] = [];
        roomResults.forEach((roomRes, index) => {
            const family = families[index].family;
            const familyName = family.familyName || family.name || "";
            (roomRes?.result?.list ?? []).forEach(({ room, device }) => {
                const roomName = room.roomName || room.name || "";
                (device ?? []).forEach(d => {
                    list.push({ device: d, familyName, roomName });
                });
            });
        });
        devices.value = list;
    } catch {
        // 请求拦截器已统一提示
    } finally {
        loading.value = false;
    }
}

function handleSelect(item: DeviceItem) {
    // 写入 store 的 info，首页直接使用该设备（含 did）
    setDeviceInfo({ ...item.device });
    toast({ text: `已选择 ${item.device.deviceName || item.device.did}` });
    const redirect = (route.query.redirect as string) || "/";
    router.replace(redirect);
}

onMounted(loadDevices);
</script>

<template>
    <div class="device-page">
        <div class="device-header">
            <h1 class="device-title">选择设备</h1>
            <p class="device-subtitle">请选择要使用的设备</p>
        </div>

        <div v-if="loading" class="device-tip">加载中...</div>

        <div v-else-if="devices.length === 0" class="device-tip">
            暂无设备
        </div>

        <div v-else class="device-list">
            <div v-for="item in devices" :key="item.device.did" class="device-card" @click="handleSelect(item)">
                <img class="device-icon" :src="item.device.productIcon" :alt="item.device.deviceName" />
                <div class="device-info">
                    <div class="device-name">{{ item.device.deviceName }}</div>
                    <div class="device-meta">
                        {{ [item.device.productName, item.roomName].filter(Boolean).join(" · ") }}
                    </div>
                </div>
                <span class="device-arrow">&#8250;</span>
            </div>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.device-page {
    min-height: 100vh;
    padding: 32px 20px;
    background-color: #fff;
}

.device-header {
    margin-bottom: 24px;
}

.device-title {
    font-size: 22px;
    font-weight: 600;
    color: #0b0a0a;
}

.device-subtitle {
    margin-top: 6px;
    font-size: 13px;
    color: #999;
}

.device-tip {
    padding: 40px 0;
    text-align: center;
    font-size: 14px;
    color: #999;
}

.device-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.device-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    border-radius: 16px;
    background-color: #f6f6f6;

    &:active {
        background-color: #efefef;
    }
}

.device-icon {
    width: 48px;
    height: 48px;
    flex-shrink: 0;
    border-radius: 12px;
    object-fit: cover;
    background-color: #fff;
}

.device-info {
    flex: 1;
    min-width: 0;
}

.device-name {
    font-size: 16px;
    font-weight: 500;
    color: #0b0a0a;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.device-meta {
    margin-top: 4px;
    font-size: 12px;
    color: #999;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.device-arrow {
    flex-shrink: 0;
    font-size: 20px;
    color: #ccc;
}
</style>