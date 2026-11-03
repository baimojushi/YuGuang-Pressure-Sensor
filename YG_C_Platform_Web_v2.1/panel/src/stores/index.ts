import { reactive } from "vue";
import XJIotSDK from "xjiang-sdk";
// import config from '../config/config.json';
// import config from '../config/config_Air_Conditioner_Infrared.json'; // 通用空调遥控器
// import config from '../config/config_curtain.json'; // GM智能电动窗帘xm
// import config from '../config/config_light.json'; // 米家吸顶灯D20
// import config from '../config/config_heater.json'; // 先锋暖风扇DNF-N1R-IOT
// import config from '../config/config_heater_DYT-Z9R-IOT.json'; // 电热油汀DYT-Z9R-IOT
// import config from '../config/config_AUPU_E372M.json'; // 奥普浴霸E372M
// import config from '../config/config_towel.json'; // 先锋毛巾架ZY-HD2210RB-22
// import config from '../config/config_fan.json'; // 飞利浦直流循环扇FKYT-L20XH3R
// import config from '../config/config_Arrow_light.json'; // 箭牌落地灯
// import config from '../config/config_AUPU_light.json'; // 奥普灯具
// import config from '../config/config_AUPU_MR009.json'; // 奥普mr009
// import config from "../config/config_Base_light.json"; // 奥普S2-S
import config from "../config/config_Yuguang.json"; // 余光
// import config from '../config/config_AUPU_light_ble.json'; // 奥普灯具ble
//import config from "../config/config_ces.json"; // 箭牌落地灯
//import config from "../config/config_AIToys.json"; // 灵机智玩
// import config from "../config/config_AIToys2.json"; // 灵机智玩2
//import config from "../config/config_AI_Lamp.json"; // AI台灯
//import config from "../config/config_AIAlarm.json"; // AI闹钟
// import config from "../config/config_AIYOYO.json"; // YOYO
// import config from "../config/config_Duck.json"; // Duck AI挂件
// import config from "../config/config_Cat.json"; // Cat AI挂件
// import config from "../config/config_CutePet.json"; // 萌宠互动手办
// import config from "../config/config_studyLamp.json"; // 智能伴学台灯
//import config from "../config/config_jingjing.json"; // 护眼玩具-晶晶

import { i18n } from "xjiang-ui";

const isDebug = import.meta.env?.MODE === "debug"; // 是否开启调试模式
const isMiniProgramEnv =
  (window as unknown as { __wxjs_environment?: string }).__wxjs_environment ===
    "miniprogram" ||
  (typeof (window as any).__wxjs_environment === "undefined" &&
    /MicroMessenger/i.test(navigator.userAgent));

// @ts-ignore
const xj = new XJIotSDK(config);
const status = reactive({
  bleState: xj.bleState,
  bleConnectState: xj.bleConnectState,
  pageConnectState: xj.pageConnectState,
  getDeviceSnapshot: false
});
const device = reactive(xj.device);
const data: any = reactive(xj.device?.data ?? {});
const info: any = !isDebug
  ? reactive(xj.device?.info)
  : reactive({
      bindGatewayDid: 0,
      bindTime: "2026-09-23T11:44:09.000+08:00",
      createTime: "2026-09-21T17:24:11.000+08:00",
      deviceName: "测试",
      deviceType: 1,
      did: 100000431,
      familyId: 504,
      gatewayType: 0,
      h5Url: "https://h5-plugins-test.xjiangiot.com/11525/1",
      id: 130338,
      isShare: 0,
      netSet: 2,
      netType: 6,
      pid: 11464,
      productIcon:
        "https://agent-file-manger.tos-cn-shanghai.volces.com/%E5%BE%AE%E4%BF%A1%E5%9B%BE%E7%89%87_2026-03-15_171539_735.png",
      productName: "测试",
      roleId: 0,
      shareUserCount: 0,
      sn: "FEF1188C47C8",
      status: 4
    });
const initData: any = reactive(xj.initData);

// 刷新或直接打开面板时宿主不会重放设备上下文，导致首页停在"等待设备状态"。
// 这里恢复上次在设备列表选中的设备，让 / 可直接使用。
const LAST_DEVICE_KEY = "yg_last_device";
try {
  const raw = localStorage.getItem(LAST_DEVICE_KEY);
  if (raw && !isDebug) {
    const saved = JSON.parse(raw);
    if (saved && (saved.did || saved.deviceId)) Object.assign(info, saved);
  }
} catch {
  /* 本地存储不可用时保持宿主下发的设备信息 */
}

xj.initProject({
  onPageInit: _data => {
    console.log("--初始化完成--->", initData, JSON.stringify(_data));
    if (
      "languageCode" in _data &&
      initData?.languageCode !== _data?.languageCode
    ) {
      i18n.global.locale.value = _data?.languageCode as any;
    }
    if (isMiniProgramEnv && _data?.device?.deviceName) {
      document.title = _data?.device?.deviceName as any;
    }
    Object.assign(initData, { ...(_data ?? {}) });
  },
  onBleStateChange: _status => {
    console.log("--onBleStateChange--->", JSON.stringify(_status));
    Object.assign(status, { bleState: _status });
  },
  onBleConnectStateChange: _status => {
    console.log("--onBleConnectStateChange--->", JSON.stringify(_status));
    Object.assign(status, { bleConnectState: _status });
  },
  onDeviceInfoChange: _info => {
    console.log("--设备的信息--->", JSON.stringify(_info));
    if (isMiniProgramEnv && _info?.deviceName) {
      document.title = _info?.deviceName;
    }
    Object.assign(info, _info);
  },
  onDeviceDataChange: _data => {
    console.log("--设备控制数据变化--->", JSON.stringify(_data));
    Object.assign(data ?? {}, _data ?? {});
  },
  onPageConnectChange: _status => {
    console.log("--websocket连接状态--->", JSON.stringify(_status));
    Object.assign(status, { pageConnectState: _status });
  },
  onDataStateChange: _status => {
    console.log("--websocket连接状态--->", JSON.stringify(_status));
    Object.assign(status, { getDeviceSnapshot: _status });
  }
});

// /** 获取多语言字段 */
// export default function getStrings(key: string): string {
//   /** 开发者模式默认中文 */
//   if (isDebug) {
//     return strings[key];
//   } else {
//     return xj.xj.strings[key];
//   }
// }

/**
 * 登录后在设备列表选中设备：把设备信息写入 store 的 info，
 * 首页等页面即可直接读取该设备的 did 等信息（宿主未注入设备信息时使用）。
 */
export function setDeviceInfo(next: Record<string, unknown>) {
  Object.keys(info).forEach(key => {
    delete info[key];
  });
  Object.assign(info, next);
  try {
    if (next?.did || next?.deviceId) localStorage.setItem(LAST_DEVICE_KEY, JSON.stringify(next));
  } catch {
    /* 隐私模式写入失败不影响当前会话 */
  }
}

export { xj, status, info, device, data, initData };
