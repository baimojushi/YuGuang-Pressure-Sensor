<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";
import { ref, computed } from "vue";
import { initData } from "../../../stores";
import { isMiniProgramEnv } from "../../../utils";
import { NavigationBar } from "xjiang-ui";

defineOptions({ name: "LearningReportPage" });


const route = useRoute();
const router = useRouter();

const leftMenu = [
    {
        key: "back",
        badge: false,
        onClick: () => router.back()
    }
];

const currentUrl = decodeURIComponent(String(route.query.url || ""));




</script>

<template>
    <div class="learning-report-page">
        <div v-if="!isMiniProgramEnv" class="learning-report-nav">
            <NavigationBar :statusbar-height="initData?.statusBarHeight || 24" title="成长报告" :left="leftMenu" />
        </div>

        <div v-if="currentUrl" class="learning-report-iframe-wrapper">
            <iframe allow="clipboard-write" ref="iframeRef" width="100%" height="100%" frameborder="0"
                style="overflow: hidden; display: block;" :src="currentUrl" class="learning-report-iframe"></iframe>
        </div>
        <div v-else class="learning-report-empty">报告地址无效</div>
    </div>
</template>

<style lang="scss" scoped>
.learning-report-page {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: #fae18c;
}

.learning-report-nav {
    position: relative;
    z-index: 20;
    flex-shrink: 0;
}

.learning-report-toggle {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    margin: 24px auto;
    border-radius: 8px;
    background: #fff;
    padding: 0px;
    width: fit-content;
}

.learning-report-toggle-indicator {
    position: absolute;
    top: 0;
    left: 0;
    border-radius: 8px;
    background: #ff6600;
    width: 50%;
    height: 100%;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
    transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.learning-report-toggle-indicator--month {
    transform: translateX(100%);
}

.learning-report-toggle-item {
    position: relative;
    z-index: 1;
    border-radius: 8px;
    padding: 5px 32px;
    color: rgba(0, 0, 0, 0.6);
    font-size: 14px;
    line-height: 20px;
    cursor: pointer;
    transition: color 0.25s ease;
}

.learning-report-toggle-item--active {
    color: #fff;
}

.learning-report-iframe-wrapper {
    position: relative;
    flex: 1;
    width: 100%;
    overflow: hidden;
}

.learning-report-iframe {
    width: 100%;
    height: 100%;
    border: 0 !important;
    outline: none;
}

.learning-report-empty {
    display: flex;
    flex: 1;
    justify-content: center;
    align-items: center;
    color: rgba(0, 0, 0, 0.6);
    font-size: 14px;
}
</style>