import IMG_HEAT from "@/assets/images/ic_heat.png";
import IMG_LIGHT from "@/assets/images/ic_light.png";
import IMG_NBSS2 from "@/assets/images/ic_nbss2.png";
import IMG_NIGHTLIGHT from "@/assets/images/ic_nightLight.png";
import IMG_VENT from "@/assets/images/ic_ventilation.png";
import IMG_WIND from "@/assets/images/ic_wind.png";
import IMG_DRY from "@/assets/images/ic_dry.png";
import IMG_DEODOR from "@/assets/images/ic_deodorization.png";
import IMG_BLOW from "@/assets/images/ic_blow.png";
import IMG_AI from "@/assets/images/ic_ai.png";

// import { useI18n } from 'vue-i18n';
// const { t } = useI18n();
import i18n from "../i18n";
const { t } = i18n.global;

const ModeStrArr = [t("Bright"), t("NightLight1")],
  ModeIcons = ["icon-conservation", "icon-moon"];
export const ModeArr = ModeStrArr.map((item, index) => {
  return {
    text: item,
    value: index + 1,
    icon: ModeIcons[index]
  };
});

export const AmbientLightRangeArr = Array.from({ length: 4 }).map(
  (item, index) => {
    const _i = index === 3 ? 0 : index + 1;
    return {
      text: t(`AmbientLightRangeTitle${_i}`),
      value: _i
    };
  }
);

export const WallSwitchArr = Array.from({ length: 2 }).map((item, index) => {
  const _i = index;
  return {
    text: t(`WallSwitchTitle${_i}`),
    value: _i
  };
});
export const WallSwitchEffectArr = Array.from({ length: 2 }).map(
  (item, index) => {
    const _i = index + 1;
    return {
      text: `${t(`WallSwitchEffect`)}${_i}`,
      value: _i
    };
  }
);
export const WallSwitchEffectTitleArr = Array.from({ length: 3 }).map(
  (item, index) => {
    const _i = index + 1;
    return {
      text: t(`WallSwitchEffectTitle${_i}`),
      value: _i
    };
  }
);

export const SensitivityArr1 = Array.from({ length: 3 }).map((item, index) => {
  return {
    text: t(`Sensitivity${index + 1}`),
    value: index
  };
});

export const SensitivityArr = [
  {
    text: t(`Sensitivity1`),
    value: 1
  },
  {
    text: t(`Sensitivity3`),
    value: 3
  }
];

const WeekStrArr = [
  t("Sun"),
  t("Mon"),
  t("Tues"),
  t("Wed"),
  t("Thur"),
  t("Fri"),
  t("Sat")
];
export const WeeksArr = WeekStrArr.map((item, index) => {
  return {
    text: item,
    value: index
  };
});

const WeekStr1Arr = [
  t("Sun1"),
  t("Mon1"),
  t("Tues1"),
  t("Wed1"),
  t("Thur1"),
  t("Fri1"),
  t("Sat1")
];
export const Weeks1Arr = WeekStr1Arr.map((item, index) => {
  return {
    text: item,
    value: index
  };
});

const RepeatStrArr = [
  t("Repeat1"),
  t("Repeat2"),
  t("Repeat3"),
  t("Repeat4"),
  t("Repeat5")
];
export const RepeatArr = RepeatStrArr.map((item, index) => {
  return {
    text: item,
    value: index
  };
});

const LightModeStrArr = ["亮肤", "抗衰", "舒敏", "修护"];
export const LightModeArr = LightModeStrArr.map((item, index) => {
  return {
    text: item,
    icon: "icon-connect",
    value: index + 1
  };
});

const ModeMR009IconsArr = [
  IMG_NBSS2,
  IMG_VENT,
  IMG_BLOW,
  IMG_DRY,
  IMG_LIGHT,
  IMG_NIGHTLIGHT
];
const ModeMR009StrArr = ["除臭除菌", "换气", "吹风", "干燥", "灯光", "小夜灯"],
  ModeMR009Values = [21, 7, 2, 4, true, true];
export const ModeMR009Arr = ModeMR009StrArr.map((item, index) => {
  return {
    text: item,
    icon: ModeMR009IconsArr?.[index],
    iconSize: !index ? 3 : 2.4,
    value: ModeMR009Values?.[index],
    key: index === 4 ? "Light_Switch" : index === 5 ? "NightLight" : "Mode",
    type: index > 3 ? 0 : 1
  };
});

const BeautyModeStrArr = ["亮肤", "抗衰", "舒敏", "修护"];
export const BeautyModeArr = BeautyModeStrArr.map((item, index) => {
  return {
    text: item,
    icon: "icon-LF",
    value: index + 1
  };
});

// 数据定义
export const basicActions = [
  { icon: "icon-sitdown", text: "坐下", value: 7 },
  { icon: "icon-squat-copy", text: "蹲起", value: 4 },
  { icon: "icon-stretch", text: "伸懒腰", value: 1 },
  { icon: "icon-greet", text: "打招呼", value: 5 },
  { icon: "icon-a-actcoquettishly", text: "撒娇", value: 8 },
  { icon: "icon-dance", text: "跳舞", value: 10 },
  { icon: "icon-happy", text: "开心", value: 11 },
  { icon: "icon-play", text: "玩耍", value: 12 },
  { icon: "icon-sad", text: "难过", value: 13 }
];

export const emojiList = [
  { icon: "icon-smile", text: "微笑", value: "little_laughing" },
  { icon: "icon-laugh-copy", text: "大笑", value: "big_laughing" },
  { icon: "icon-calm", text: "平静", value: "calm" },
  { icon: "icon-shy", text: "害羞", value: "shy" }
];

export const VentLevelArr = Array.from({ length: 5 }).map((item, index) => {
  const _v = index + 1;
  return {
    text: `${_v}档`,
    value: _v
  };
});
export const VentLevel3Arr = Array.from({ length: 3 }).map((item, index) => {
  const _v = index + 1;
  return {
    text: `${_v}档`,
    value: _v
  };
});

const ModeS2SIconsArr = [
  IMG_VENT,
  IMG_BLOW,
  IMG_DRY,
  IMG_HEAT,
  IMG_LIGHT,
  IMG_NIGHTLIGHT
];
const ModeS2SStrArr = ["换气", "吹风", "干燥", "照明", "灯光", "小夜灯"],
  ModeS2SValues = [7, 2, 4, true, true, true];
export const ModeS2SSArr = ModeS2SStrArr.map((item, index) => {
  return {
    text: item,
    icon: ModeS2SIconsArr?.[index],
    iconSize: 2.4,
    value: ModeS2SValues?.[index],
    key:
      index === 3
        ? "Light_Switch"
        : index === 4
        ? "ExternalLight"
        : index === 5
        ? "NightLight"
        : "Mode",
    type: index > 2 ? 0 : 1,
    okState:
      index === 3
        ? { NightLight: false }
        : index === 5
        ? { Light_Switch: false }
        : {}
  };
});

export function getArray(max = 5, min = 0, step?, unit?, isPrefix?, textArr?) {
  return Array.from({ length: (max - min) / (step || 1) + 1 }).map(
    (item, index) => {
      const value = index * (step || 1) + min;
      let itemText = `${!!isPrefix && value < 10 ? `0${value}` : value}${
        unit || ""
      }`;
      if (!!textArr && !!textArr.length && textArr[index]) {
        itemText = textArr[index];
      }
      return { text: itemText, value };
    }
  );
}

export const GradientTimeArr = getArray(10, 0.5, 0.5, "秒");
