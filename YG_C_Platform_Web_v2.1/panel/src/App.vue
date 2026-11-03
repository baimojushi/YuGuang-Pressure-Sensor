<script setup lang="ts">
import { onBeforeMount, onUnmounted, watch, createVNode } from "vue";
import { RouterView } from 'vue-router'
import { xj, info } from "./stores";
import { i18n, popup } from "xjiang-ui";
import OfflineDialog from "./components/OfflineDialog.vue";

import { useI18n } from 'vue-i18n';
const { t } = useI18n();

onBeforeMount(() => {
});


onUnmounted(() => {
  xj.exit();
});

let pageConnectPopup: any = null
watch(
  () => info.onlionStatus,
  (value: boolean) => {
    if (!value) {
      // 离线提示弹窗
      pageConnectPopup = popup({
        canDismiss: false,
        type: "dialog-custom",
        customNode: createVNode(
          OfflineDialog,
          {
            imgUrl: "https://preview.qiantucdn.com/auto_machine/20220421/77fa64b7-ea94-4d28-bf18-56915aaad853.png!w1024_new_small_1",
            title: t("dialog.offline.title"),
            subTitle: t("dialog.offline.message")
          },
          "<div></div>"
        ),
        rightButton: {
          text: t("dialog.offline.confirm"),
          color: "var(--error-color)",
          onClick: () => {
            return true
          }
        },
        leftButton: {
          text: t("dialog.offline.cancel"),
          onClick: () => {
            xj.exit();
            return true
          }
        }
      });
    } else {
      pageConnectPopup.close();
    }
  }
);
</script>

<template>
  <!-- <header></header> -->
  <RouterView />
</template>

<style>
/* xjiang-ui 全局样式把 body 的直接子元素锁成 height:100vh;overflow:hidden，
   页面内容超过一屏时既不能滚动也被裁切。让 #app 自身成为滚动容器。 */
body > #app {
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
}
</style>