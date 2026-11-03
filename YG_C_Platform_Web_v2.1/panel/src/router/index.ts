import {
  createRouter,
  // createWebHistory,
  createWebHashHistory
} from "vue-router";

import HomeView from "../views/Yuguang/HomeView.vue"; // 余光
import { resolveAgentToken } from "../utils/nativeApiRequestHeaders";
const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/login",
      name: "login",
      component: () => import("../views/Login/LoginView.vue")
    },
    {
      path: "/deviceList",
      name: "deviceList",
      component: () => import("../views/DeviceList/DeviceListView.vue")
    },
    {
      path: "/",
      name: "home",
      component: HomeView
    },
    {
      path: "/yuguang",
      redirect: "/"
    },
    {
      path: "/:pathMatch(.*)*",
      redirect: "/"
    }
  ]
});

// 无 token 时统一跳转登录页（登录页本身放行）
router.beforeEach(async to => {
  if (to.name === "login") return true;
  const token = await resolveAgentToken();
  if (!token) {
    return {
      name: "login",
      query: to.fullPath === "/" ? undefined : { redirect: to.fullPath }
    };
  }
  return true;
});

export default router;
