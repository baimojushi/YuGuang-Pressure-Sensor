import "xjiang-ui/styles/common.css";
import "./assets/icons/iconfont.js";
import { createPinia } from "pinia";
import { createApp } from "vue";

import App from "./App.vue";
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import router from "./router";
import i18n from "./i18n";

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(i18n);
app.use(ElementPlus);
app.mount("#app");

// xjiang-sdk 的 WeappApi.initWS() 会弹一个 canDismiss:false 的全屏 loading，
// 只有小程序容器回应 getReqHeaders 时才关闭。容器不回应（或重连反复失败）时该遮罩
// 会永久驻留，页面可见却整页无法点击。这里只对"持续超过 5 秒的同一遮罩"兜底释放，
// 不影响正常的短时加载提示；SDK 每次重连都会新建遮罩，因此看门狗常驻。
const STUCK_AFTER_MS = 5000;
const seenAt = new WeakMap<HTMLElement, number>();
window.setInterval(() => {
  const now = Date.now();
  document
    .querySelectorAll<HTMLElement>(".hi-overlay")
    .forEach(el => {
      if (!el.querySelector(".hi-popup.loading")) return;
      const first = seenAt.get(el) ?? now;
      seenAt.set(el, first);
      if (now - first >= STUCK_AFTER_MS) {
        el.style.display = "none";
      }
    });
}, 1000);
