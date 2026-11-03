import { defineStore, acceptHMRUpdate } from "pinia";
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


import { handleHMArr2HMStr, getArrayValText, getNumberArr } from "../utils";

export const DEFAULT_TIME = {
  TimingHeat: "010008070080121e00230000",
  TimingFunc: "02000806008007000005000000080a0080150000000000",
  TimingNightLight: "010816000600001e7f",
  TimingInteSceneV1: "040000010000000002000000e4babae6849fe785a7e6988e00000000000000000000050000020000000000e5a48fe697a5e590b9e9a38e000000000000000000000a0000070000000000e4babae6849fe68da2e6b09400000000000000000000140000150000000000e4babae6849fe999a4e887ad0000000000000000",
  TimingInteScene: "03000001000000000200000000000000000000000001000002000000000000000000000000000"
}

export const Timing_DurationTimeList = [
    ...getNumberArr(60, 10, 10),
    ...getNumberArr(480, 90, 30)
].map((item, index) => {
    return {
        value: item,
        text: handleMins2HMStr(item, ["小时", "分钟"]) || item
    };
});
const _Mode_Values = {
    // 模式对应的值
    Mode_Blow: 2,
    Mode_Dry: 4,
    Mode_Vent: 7,
    Mode_AI: 18,
    Mode_Deodor: 21,
};
export const FuncValues = {
    // 模式对应的值
    ..._Mode_Values,

    FanLevelTimes: {
      3: {
        3: 30,
        2: 60,
        1: 180
      },
      5: {
        5: 30,
        4: 60,
        3: 180,
        2: 300,
        1: 480
      }
    },

    Timing_Duration: {
        [`${ _Mode_Values.Mode_Deodor }`]: Timing_DurationTimeList.slice(0, 6), // 除臭除菌预约时长
        [`${ _Mode_Values.Mode_Vent }`]: {
            3: Timing_DurationTimeList.slice(0, 10),
            5: Timing_DurationTimeList
        }, // 换气预约时长
        [`${ _Mode_Values.Mode_Blow }`]: Timing_DurationTimeList.slice(0, 3), // 吹风预约时长
        [`${ _Mode_Values.Mode_Dry }`]: Timing_DurationTimeList.slice(0, 8), // 干衣预约时长
    },

    // 区间
    TargetTemp_AI: [30, 42],
    Level_Vent: [1, 3],
    StopTime_Timing: [10, 90],
};

export const TimeKeys = {
    // 预约保存
    Timing_Func: "TimingFunc", // 预约模式功能
    Timing_Heat: "TimingHeat", // 预约暖房
    Timing_InteScene: "TimingInteScene", // 人感
    Timing_NightLight: "TimingNightLight", // 预约小夜灯
};

const TimeFuncArr = [
  {
      text: "AI恒温暖",
      value: FuncValues?.Mode_AI,
      icon: IMG_AI
  },
  {
      text: "换气",
      value: FuncValues?.Mode_Vent,
      icon: IMG_VENT
  },
  {
      text: "吹风",
      value: FuncValues?.Mode_Blow,
      icon: IMG_BLOW
  },
  {
      text: "干燥",
      value: FuncValues?.Mode_Dry,
      icon: IMG_DRY
  },
  {
      text: "除臭除菌",
      value: FuncValues?.Mode_Deodor,
      icon: IMG_NBSS2,
      iconSize: "4rem"
  },
];
const TimeInteSceneArr = [
  ...TimeFuncArr,
  {
      text: "照明",
      value: 0, // 用于人感场景显示，照明值为0
      icon: IMG_LIGHT
  }
];

export const FuncConfig = {
  TimeFuncArr,
  TimeFuncArr1: TimeFuncArr.slice(0, TimeFuncArr.length),

  TopList: TimeFuncArr,
  TimeInteSceneArr,
  ShowHorizontalSwing: true
}

export const WEEKEND_VALUE = [0, 6]; // 周末
export const WEEKDAY_VALUE = Array.from({ length: 5 }).map(
  (item, index) => index + 1
); // 工作日
export const ALLDAY_VALUE = Array.from({ length: 7 }).map(
  (item, index) => index
); // 每天
export const NONE_STR = Array.from({ length: 7 })
  .map(() => "0")
  .join(""); // 不重复字符串

export const DefaultTimeData = [
  {
    ID: 0,
    Value: 0,
    StartTimes: [0, 0],
    EndTimes: [23, 59],
    Weeks: [],
    Repeat: 0,
    TimeZone: 8,
      
    ModeValue: 0,
    TargetTempValue: 0,
    LightValue: 0,
    VentValue: 0,
    BlowValue: 0,
    ExternalLightValue: 0,
    RepeatStr: "00"
  }
];
export const DefaultInteSceneData = [
  {
    ID: 0,
    Value: 0,
    SomeoneTimes: [0, 0],
    NooneTimes: [0, 0],
      
    ModeValue: 0,
    TargetTempValue: 0,
    LightValue: 0,
    VentValue: 0,
    BlowValue: 0,
    ExternalLightValue: 0,
    SceneName: ""
  }
];
export const DefaultInteNightLightData = [
  {
    ID: 0,
    Value: 0,
    Weeks: [],
    Repeat: 0,
    TimeZone: 8,
    StartTimes: [0, 0],
    EndTimes: [0, 0],
    NooneTime: 0,
    RepeatStr: "00"
  }
];

type TimingFuncType = Array<{
  ID: number;
  Value: number;
  StartTimes: number[];
  EndTimes: number[];
  Weeks: number[];
  Repeat: number;
  ModeValue: number;
  TargetTempValue: number;
  LightValue: number;
  VentValue: number;
  BlowValue: number;
  ExternalLightValue: number;
  TimeZone: number;
  RepeatStr: string;
  HorizontalSwing?: number;
  BeautyMode?: number;
  BeautyTime?: number;
  DurationTime?: number;
}>;
type TimingInteSceneType = Array<{
  ID: number;
  Value: number;
  SomeoneTimes: number[];
  NooneTimes: number[];
  PackCount?: number;

  ModeValue: number;
  TargetTempValue: number;
  LightValue: number;
  VentValue: number;
  BlowValue: number;
  ExternalLightValue: number;
  SceneName: string;
  StartTimes?: number[];
  EndTimes?: number[];
  HorizontalSwing?: number;
  BeautyMode?: number;
  BeautyTime?: number;
}>;
type TimingNightLightType = Array<{
  ID: number;
  Value: number;
  TimeZone: number;
  StartTimes: number[];
  EndTimes: number[];
  NooneTime: number;
  RepeatStr: string;
}>;

const TimeType = {
    "TimingFunc": 0,
    "TimingHeat": 1,
    "TimingInteScene": 2,
    "TimingNightLight": 3
}

export const _Mode_TOTAL_V1 = 24, _Mode_LEN_V1 = 22, 
  _Mode_TOTAL = 34, _Mode_LEN = 32, 
  _NightLight_LEN = 18, 
  _InteScene_TOTAL_V1 = 64, _InteScene_LEN_V1 = 62,
  _InteScene_TOTAL = 38, _InteScene_LEN = 36,
  _InteSceneName_LEN = 15,
  StrStopCode = "0000",
  SceneConfigs = {
    0: {
      SceneName: "人感照明"
    },
    2: {
      SceneName: "夏日吹风",
      ShowHorizontalSwing: true
    },
    7: {
      SceneName: "人感换气"
    },
    21: {
      SceneName: "人感除臭除菌",
      ShowHorizontalSwing: true
    }
  },
  SceneNames = {
    0: "人感照明", 
    2: "夏日吹风", 
    7: "人感换气", 
    21: "人感除臭除菌"
  };

export const useTimeStore = defineStore("time", {
  state: () => ({
    TimingFuncCache: DefaultTimeData,
    TimingHeatCache: DefaultTimeData,

    TimingFunc: DefaultTimeData,
    TimingHeat: DefaultTimeData,

    TimingInteSceneCache: DefaultInteSceneData,
    TimingInteScene: DefaultInteSceneData,

    TimingNightLightCache: DefaultInteNightLightData,
    TimingNightLight: DefaultInteNightLightData,

    InteSceneVer: 2, // 人感场景和本地预约版本号  --  1- 旧版 2 - 新版(去除人感场景名称，添加时间段区间风向美容光；添加预约风向美容光工作时长)
  }),
  getters: {
    getTimeObj: (
      state
    ): {
      TimingFunc: TimingFuncType;
      TimingHeat: TimingFuncType;
      
      TimingInteScene: TimingInteSceneType;
      TimingNightLight: TimingNightLightType;
    } => {
      return {
        TimingFunc: state.TimingFunc,
        TimingHeat: state.TimingHeat,
        TimingInteScene: state.TimingInteScene,
        TimingNightLight: state.TimingNightLight
      };
    }
  },
  actions: {
    /**
     * 统一设置缓存所有数据
     * @param type
     */
    setAllState(type) {
      if (!TimeType?.[type]) {
        this.TimingFuncCache = JSON.parse(JSON.stringify(this.TimingFunc));
      } else if (TimeType?.[type] === 1) {
        this.TimingHeatCache = JSON.parse(JSON.stringify(this.TimingHeat));
      } else if (TimeType?.[type] === 2) {
        this.TimingInteSceneCache = JSON.parse(JSON.stringify(this.TimingInteScene));
      } else if (TimeType?.[type] === 3) {
        this.TimingNightLightCache = JSON.parse(JSON.stringify(this.TimingNightLight));
      }
    },
    /**
     * 设置缓存数据
     * @param type
     */
    setTimeStates(key, v, type, ID) {
      let RepeatArr: any = {};
      const isWeeks = key === "Weeks";
      if (isWeeks) {
        RepeatArr = getWeeks2RepeatStr(v);
      }

      if (!TimeType?.[type]) {
        this.TimingFuncCache[ID][`${key}`] = v;
        if (isWeeks) {
          this.TimingFuncCache[ID].Repeat = RepeatArr?.Repeat;
          this.TimingFuncCache[ID].RepeatStr = RepeatArr?.RepeatStr;
        }
      } else if (TimeType?.[type] === 1) {
        this.TimingHeatCache[ID][`${key}`] = v;
        if (isWeeks) {
          this.TimingHeatCache[ID].Repeat = RepeatArr?.Repeat;
          this.TimingHeatCache[ID].RepeatStr = RepeatArr?.RepeatStr;
        }
      } else if (TimeType?.[type] === 2) {
        this.TimingInteSceneCache[ID][`${key}`] = v;
      } else if (TimeType?.[type] === 3) {
        this.TimingNightLightCache[ID][`${key}`] = v;
        if (isWeeks) {
          this.TimingNightLightCache[ID].Repeat = RepeatArr?.Repeat;
          this.TimingNightLightCache[ID].RepeatStr = RepeatArr?.RepeatStr;
        }
      }
      console.log("RepeatArr--->", RepeatArr, this.TimingHeatCache)
    },

    /**
     * 处理时间字符串
     * @param type 0 - TimingFunc; 1 - TimingHeat; 2 - TimingInteScene; 3 - TimingNightLight
     */
    handleTimeStr2Obj(str, type) {
      // let list: TimingFuncType | TimingInteSceneType = [];
      let list: any = [];

      if (!str || !str.length) {
        str = DEFAULT_TIME?.[type];
        if (this.InteSceneVer === 1 && type === "TimingInteScene") {
          str = DEFAULT_TIME?.TimingInteSceneV1;
        }
      }

      if ((!TimeType?.[type]) || TimeType?.[type] === 1) {
        const _ver = this.InteSceneVer === 1 || TimeType?.[type] === 1;
        const ___Mode_TOTAL = _ver ? _Mode_TOTAL_V1 : _Mode_TOTAL,
          ___Mode_LEN = _ver ? _Mode_LEN_V1 : _Mode_LEN;
        if (str && str.length && str.length >= ___Mode_TOTAL) {
          // const regex = new RegExp(/.{1,26}/g);
          const PackCount = convert16To10(str.slice(0, 2)),
            _arr = str.slice(2, str.length);
          const regex = new RegExp(`.{1,${ ___Mode_LEN }}`, 'g');
          const result = _arr.match(regex);
          if (result && result.length) {
            for (const item of result) {
              const _i = result.indexOf(item);
              if (item.length >= ___Mode_LEN) {
                const Value = convert16To10(item.slice(0, 2)),
                  TimeZone = convert16To10(item.slice(2, 4)),
                  _StartTime_0 = convert16To10(item.slice(4, 6)),
                  _StartTime_1 = convert16To10(item.slice(6, 8)),
                  // _EndTime = convert16To10(item.slice(8, 10)),
                  _time = this.getWeekStr2Value(item.slice(8, 10)),
                  ModeValue = convert16To10(item.slice(10, 12)),
                  TargetTempValue = convert16To10(item.slice(12, 14)),
                  LightValue = convert16To10(item.slice(14, 16)),
                  VentValue = convert16To10(item.slice(16, 18)),
                  BlowValue = convert16To10(item.slice(18, 20)),
                  ExternalLightValue = convert16To10(item.slice(20, 22));

                const StartTimes = [_StartTime_0, _StartTime_1];
                // EndTimes = convertTimestamp2Date(_EndTime);

                if (_ver) {
                  list = [...list, {
                    ID: _i, PackCount, Value, TimeZone, StartTimes, ModeValue, TargetTempValue,
                    LightValue, VentValue, BlowValue, ExternalLightValue, RawStr: item,
                    ...(_time ?? {})
                  }];
                } else {
                  const HorizontalSwing = convert16To10(item.slice(22, 24)),
                    BeautyMode = convert16To10(item.slice(24, 26)),
                    BeautyTime = convert16To10(item.slice(26, 28)),
                    DurationTime = convert16To10(item.slice(28, 32));

                  list = [...list, {
                    ID: _i, PackCount, Value, TimeZone, StartTimes, ModeValue, TargetTempValue,
                    LightValue, VentValue, BlowValue, ExternalLightValue, RawStr: item,
                    HorizontalSwing, ShowHorizontalSwing: SceneConfigs?.[ModeValue]?.ShowHorizontalSwing || false, 
                    BeautyMode, BeautyTime, DurationTime,
                    ...(_time ?? {})
                  }];
                }
              }
            }
          }
        };
      } else if (TimeType?.[type] === 2) {
        const ___InteScene_TOTAL = this.InteSceneVer === 1 ? _InteScene_TOTAL_V1 : _InteScene_TOTAL,
          ___InteScene_LEN = this.InteSceneVer === 1 ? _InteScene_LEN_V1 : _InteScene_LEN;
        if (str && str.length && str.length >= ___InteScene_TOTAL) {
          const PackCount = convert16To10(str.slice(0, 2)),
            _arr = str.slice(2, str.length);
          const regex = new RegExp(`.{1,${ ___InteScene_LEN }}`, 'g');
          const result = _arr.match(regex);
          if (result && result.length) {
            for (const item of result) {
              const _i = result.indexOf(item);
              if (item.length >= ___InteScene_LEN) {
                const Value = convert16To10(item.slice(0, 2)),
                  _SomeoneTime = convert16To10(item.slice(2, 6)),
                  _NooneTime = convert16To10(item.slice(6, 10)),
                  ModeValue = convert16To10(item.slice(10, 12)),
                  TargetTempValue = convert16To10(item.slice(12, 14)),
                  LightValue = convert16To10(item.slice(14, 16)),
                  VentValue = convert16To10(item.slice(16, 18)),
                  BlowValue = convert16To10(item.slice(18, 20)),
                  ExternalLightValue = convert16To10(item.slice(20, 22));

                if (this.InteSceneVer === 1) {
                  const _SceneName = item.slice(22, ___InteScene_LEN);

                  const _SceneNameArr = _SceneName.split(StrStopCode);
                  let __SceneNameNew = _SceneNameArr?.[0] ?? "";
                  if (_SceneNameArr && _SceneNameArr.length <= 1 && _SceneName.slice(-2) === "00") {
                    __SceneNameNew = __SceneNameNew.slice(0, __SceneNameNew.length - 2);
                  }
                  const SceneName = convertHex2Str(_SceneNameArr?.[0] ?? "");
                  
                  if (SceneName && SceneName.length) {
                    const SomeoneTimes = handleMins2HM(_SomeoneTime),
                      NooneTimes = handleMins2HM(_NooneTime);
                    list = [...list, {
                      ID: _i, PackCount, Value, SomeoneTimes, NooneTimes, ModeValue, 
                      TargetTempValue, LightValue, VentValue, BlowValue, ExternalLightValue, SceneName,
                      RawStr: item
                    }];
                  }
                } else {
                  const HorizontalSwing = convert16To10(item.slice(22, 24)),
                    BeautyMode = convert16To10(item.slice(24, 26)),
                    BeautyTime = convert16To10(item.slice(26, 28)),
                    _StartTime_0 = convert16To10(item.slice(28, 30)),
                    _StartTime_1 = convert16To10(item.slice(30, 32)),
                    _EndTime_0 = convert16To10(item.slice(32, 34)),
                    _EndTime_1 = convert16To10(item.slice(34, 36));

                  const StartTimes = [_StartTime_0, _StartTime_1],
                    EndTimes = [_EndTime_0, _EndTime_1];

                  const SceneName = SceneConfigs?.[ModeValue]?.SceneName || "";
                  const SomeoneTimes = handleMins2HM(_SomeoneTime),
                    NooneTimes = handleMins2HM(_NooneTime);
                  if (SceneName && SceneName.length) {
                    list.push({
                      ID: _i, PackCount, Value, SomeoneTimes, NooneTimes, ModeValue, 
                      TargetTempValue, LightValue, VentValue, BlowValue, ExternalLightValue, 
                      HorizontalSwing, BeautyMode, BeautyTime, SceneName, StartTimes, EndTimes,
                      ShowHorizontalSwing: SceneConfigs?.[ModeValue]?.ShowHorizontalSwing || false,
                      RawStr: item
                    });
                  }
                }
              }
            }
          }
        }
      } else if (TimeType?.[type] === 3 && str.length >= _NightLight_LEN) {
        const regex = new RegExp(`.{1,${ _NightLight_LEN }}`, 'g');
        const result = str.match(regex);
        if (result && result.length) {
          for (const item of result) {
            const _i = result.indexOf(item);
            if (item.length >= _NightLight_LEN) {
              const Value = convert16To10(item.slice(0, 2)),
                TimeZone = convert16To10(item.slice(2, 4)),
                _StartTime_0 = convert16To10(item.slice(4, 6)),
                _StartTime_1 = convert16To10(item.slice(6, 8)),
                _EndTime_0 = convert16To10(item.slice(8, 10)),
                _EndTime_1 = convert16To10(item.slice(10, 12)),
                NooneTime = convert16To10(item.slice(12, 16)),
                _time = this.getWeekStr2Value(item.slice(16, _NightLight_LEN));

              const StartTimes = [_StartTime_0, _StartTime_1],
                EndTimes = [_EndTime_0, _EndTime_1];
              list.push({
                ID: _i, Value, TimeZone, StartTimes, EndTimes, NooneTime, RawStr: item,
                ...(_time ?? {})
              });
            }
          }
        }
      }

      console.log(type, list)
      if (!TimeType?.[type]) {
        this.TimingFunc = list;
        this.TimingFuncCache = list;
      } else if (TimeType?.[type] === 1) {
        this.TimingHeat = list;
        this.TimingHeatCache = list;
      } else if (TimeType?.[type] === 2) {
        this.TimingInteScene = list;
        this.TimingInteSceneCache = list;
      } else if (TimeType?.[type] === 3) {
        this.TimingNightLight = list;
        this.TimingNightLightCache = list;
      }
    },
    
    /**
     * 转换星期字符串
     * @param str 永不|周日|周六|...|周二|周一
     * @returns newWeek [周日,周一,...,周五,周六]
     */
    getWeekStr2Value(str = "") {
      let newWeek: any = [], Repeat = 0, _v2 = "";
      try {
        const _v10 = convert16To10(str);
        _v2 = _v10.toString(2);
        const _v2Arr = (`00000000${ _v2 }`).slice(-8).split("");

        if (_v2Arr.length > 2) {
          const _r = parseInt(_v2Arr[0]);
          const __v2Arr_r = _v2Arr.slice(1, _v2Arr.length);
          const __v2Arr = __v2Arr_r.reverse();
          const lastElement = __v2Arr.splice(__v2Arr.length - 1, 1);
          __v2Arr.splice(0, 0, ...lastElement);

          newWeek = __v2Arr.map((item, index) => parseInt(item) ? index : -1)
            .filter((item) => item !== -1);
            
          if (!_r) {
            if (JSON.stringify(newWeek) === JSON.stringify(ALLDAY_VALUE)) {
              Repeat = 1;
            } else if (JSON.stringify(newWeek) === JSON.stringify(WEEKDAY_VALUE)) {
              Repeat = 2;
            } else if (JSON.stringify(newWeek) === JSON.stringify(WEEKEND_VALUE)) {
              Repeat = 3;
            } else {
              Repeat = 4;
            }
          }
        }
      } catch (e) { }
      return { Weeks: newWeek, Repeat, RepeatStr: _v2 };
    },

    /**
     * 根据星期数组获取Repeat
     * @returns Repeat  0-不重复；1-每天；2-工作日；3-周末；4-根据Weeks显示
     */
    getRepeatByWeeks(Weeks) {
      let Repeat = 0;
      try {
        if (Weeks && Weeks.length) {
          const _Weeks = Weeks.sort((a, b) => a - b);
          if (JSON.stringify(_Weeks) === JSON.stringify(ALLDAY_VALUE)) {
            Repeat = 1;
          } else if (JSON.stringify(_Weeks) === JSON.stringify(WEEKDAY_VALUE)) {
            Repeat = 2;
          } else if (JSON.stringify(_Weeks) === JSON.stringify(WEEKEND_VALUE)) {
            Repeat = 3;
          } else {
            Repeat = 4;
          }
        }
      } catch (e) {}

      return Repeat;
    },

    /**
     * 星期字符串转成数组
     * @param str 永不|周日|周六|...|周二|周一
     * @returns Weeks [周日,周一,...,周五,周六]；    Repeat  0-不重复；1-每天；2-工作日；3-周末；4-根据Weeks显示
     */
    handleRepeatStr2Arr(str) {
      if (typeof str !== "string") str = "";
      let repeat_2 = convert16To2(str);
      repeat_2 = `0000000${repeat_2}`.slice(-7);

      const WeekArr = repeat_2
        .split("")
        .map((item, index) => (parseInt(item) ? index : -1))
        .filter(item => item !== -1);

      const Repeat = this.getRepeatByWeeks(WeekArr);
      return { Weeks: WeekArr ?? [], Repeat, RepeatStr: repeat_2 };
    },

    /**
     * 组合人感场景字符串
     * @param opt
     * @returns { code, value } code: -1-失败  0-成功
     */
    handleInteScene2Str(list: TimingInteSceneType) {
      if (!list || !list.length) {
        return { code: -1 };
      }
      try {
        const PackCount = list.length;
        let _arr: string[] = [convertValue(PackCount)];

        if (list && list.length) {
          for (const item of list) {
            const _st = (item.SomeoneTimes?.[0] ?? 0) * 60 + (item.SomeoneTimes?.[1] ?? 0),
              _nt = (item.NooneTimes?.[0] ?? 0) * 60 + (item.NooneTimes?.[1] ?? 0);
              
            let _v = [];
            if (this.InteSceneVer === 1) {
              _v = convertValues([
                [item.Value ? 1 : 0],
                [_st, 4],
                [_nt, 4],
                [item.ModeValue], 
                [item.TargetTempValue], 
                [item.LightValue], 
                [item.VentValue], 
                [item.BlowValue], 
                [item.ExternalLightValue], 
                [item.SceneName, 40, 1]
              ]);
            } else {
              _v = convertValues([
                [item.Value ? 1 : 0],
                [_st, 4],
                [_nt, 4],
                [item.ModeValue], 
                [item.TargetTempValue], 
                [item.LightValue], 
                [item.VentValue], 
                [item.BlowValue], 
                [item.ExternalLightValue], 
                [item.HorizontalSwing], 
                [item.BeautyMode], 
                [item.BeautyTime], 
                [item.StartTimes?.[0]], [item.StartTimes?.[1]],
                [item.EndTimes?.[0]], [item.EndTimes?.[1]]
              ]);
            }
            _arr = [..._arr, _v.join("")];
          }
        }

        return {
          code: 0,
          value: _arr.join("")
        };
      } catch (e) {
        return { code: -1 };
      }
    },
    /**
     * 组合感应夜灯字符串
     * @param opt
     * @returns { code, value } code: -1-失败  0-成功
     */
    handleInteNightLight2Str(list: TimingNightLightType) {
      if (!list || !list.length) {
        return { code: -1 };
      }

      try {
        let _arr: string[] = [];
        if (list && list.length) {
          for (const item of list) {
            const _v = convertValues([
              [item.Value ? 1 : 0], [item.TimeZone],
              [item.StartTimes?.[0]], [item.StartTimes?.[1]],
              [item.EndTimes?.[0]], [item.EndTimes?.[1]],
              [item.NooneTime, 4], 
              [convert2To10(item.RepeatStr)]
            ]);
            _arr = [..._arr, _v.join("")];
          }
        }

        return {
          code: 0,
          value: _arr.join("")
        };
      } catch (e) {
        return { code: -1 };
      }
    },
    /**
      * 组合时间字符串
      * @param opt
      * @param type - 0: 预约暖房 1: 本地预约
      * @returns { code, value } code: -1-失败  0-成功
      */
    handleTiming2Str(list: TimingFuncType, type = 1) {
      if (!list || !list.length) {
        return { code: -1 };
      }

      try {
        const PackCount = list.length;
        let _arr: string[] = [convertValue(PackCount)];
        
        if (list && list.length) {
          for (const item of list) {
            let _v = [];
            if (this.InteSceneVer === 1 || !type) {
              _v = convertValues([
                [item.Value ? 1 : 0], [item.TimeZone],
                [item.StartTimes?.[0]], [item.StartTimes?.[1]],
                [convert2To10(item.RepeatStr)], 
                [item.ModeValue], 
                [item.TargetTempValue], 
                [item.LightValue], 
                [item.VentValue], 
                [item.BlowValue], 
                [item.ExternalLightValue]
              ]);
            } else {
              _v = convertValues([
                [item.Value ? 1 : 0], [item.TimeZone],
                [item.StartTimes?.[0]], [item.StartTimes?.[1]],
                [convert2To10(item.RepeatStr)], 
                [item.ModeValue], 
                [item.TargetTempValue], 
                [item.LightValue], 
                [item.VentValue], 
                [item.BlowValue], 
                [item.ExternalLightValue],
                [item.HorizontalSwing], 
                [item.BeautyMode], 
                [item.BeautyTime],
                [item.DurationTime, 4]
              ]);
            } 
            _arr = [..._arr, _v.join("")];
          }
        }

        return {
          code: 0,
          value: _arr.join("")
        };
      } catch (e) {
        return { code: -1 };
      }
    },

    /**
     * 重复数组转成字符串
     * @param Repeat  0-不重复；1-每天；2-工作日；3-周末；4-根据Weeks显示
     * @param Weeks
     */
    handleRepeatArr2Str(Repeat, Weeks) {
      let str = NONE_STR;
      if (Repeat) {
        const _RepeatArr = Array.from({ length: 7 }).map((item, index) =>
          Weeks.includes(index) ? 1 : 0
        );
        str = _RepeatArr.join("");
      }
      return convert2To10(str);
    },

    handleTimeSplit(startTime, endTime?) {
      const stStr = handleHMArr2HMStr(startTime, "", ":");
      let etStr = ""
      if (endTime) {
        etStr = getCompareTime(startTime, endTime)?.t + handleHMArr2HMStr(endTime, "", ":");
      }
       
      const str = !endTime ? stStr : handleHMArr2HMStr([stStr ?? "", etStr ?? ""], "", "-");
      return str;
    }
  }
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useTimeStore, import.meta.hot));
}

function convert16To10(str) {
  if (!str || !str.length) return 0;
  return parseInt(str, 16);
}
function convert10To16(num) {
  if (typeof num !== "number") return "";
  return num.toString(16);
}
function convert10To2(num) {
  if (typeof num !== "number") return "";
  return num.toString(2);
}
function convert2To10(str) {
  if (!str || !str.length) return 0;
  return parseInt(str, 2);
}
function convert16To2(str) {
  if (!str || !str.length) return 0;
  const _str10 = parseInt(str, 16);
  return convert10To2(_str10);
}

/**
 * 转换成16进制,并补充长度
 * @param v
 * @param len - 输出长度，默认两个
 * @returns
 */
function convert10To16_len(v, len = 2) {
  const _v16 = convert10To16(v);
  const _pix0 = Array.from({ length: len + 1 }).map(item => "0");

  return `${_pix0}${_v16}`.slice(-len);
}

export function handleMins2HM(minutes) {
    if (!minutes || typeof minutes !== "number") return[0, 0];

    const _m = parseInt(`${ minutes % 60 }`),
        _h = parseInt(`${ minutes / 60 }`);
    return [_h || 0, _m || 0];
}
export function handleMins2HMStr(minutes, units, isPrefix = false) {
    if (typeof minutes !== "number") return "";
    if (!minutes) return `0${ units && units.length ? units[units.length - 1] : "" }`;

    const _hm = handleMins2HM(minutes);
    const _hmStr = _hm.map((item, index) => {
        return `${ (isPrefix ? isPreZero(item) : item) || "" }${ item && units ? (units?.[index] || "") : "" }`
    })
    return _hmStr.join("");
}

export function convertStr2Hex(str) {
  const re = /[\u4E00-\u9FA5]/;
  const ar: string[] = [];
  for (let i = 0; i < str.length; i++) {
    let a = '';
    if (re.test(str.charAt(i))) { // 中文
      a = encodeURI(str.charAt(i)).replace(/%/g, '');
    } else {
      a = str.charCodeAt(i).toString(16);
    }
    ar.push(a);
  }
  str = ar.join('');
  return str;
}
export function convertHex2Str(str) {
  let ret = '';
  let tmp = '';
  for (let i = 0; i < str.length - 1; i += 2) {
    const c = String.fromCharCode(parseInt(str.substr(i, 2), 16));
    if (c.charCodeAt(0) > 127) {
      tmp += '%' + str.substr(i, 2);
      if (tmp.length == 9) {
        ret += decodeURI(tmp);
        tmp = '';
      }
    } else {
      ret += c;
    }
  }
  return ret;
}
/**
 * 转换成16进制,并补充长度
 * @param value 
 * @param len - 输出长度，默认两个
 * @param type 0 - 十进制转16进制 ；   1 - 中文转hex
 * @returns 
 */
export function convertValue(value, len = 2, type = 0) {
  let v16 = "";
  if (type) {
    const _hex = convertStr2Hex(value);
    v16 = (`${ _hex }000000000000000000000000000000000000000000000000000000000`).slice(0, len);
  } else {
    const _v16 = convert10To16(value);
    v16 = (`00000000${ _v16 }`).slice(-len);
  }
  return v16;
}
export function convertValues(values) {
  if (!values || !values.length) return [];
  const _array = values.map((item, index) => {
    return convertValue(item?.[0], item?.[1], item?.[2]);
  });
  return _array;
}

export function getWeeks2Repeat(Weeks) {
  let Repeat = 0;
  const _Weeks = Weeks.sort((a, b) => a - b);
  try {
    if (_Weeks && _Weeks.length) {
      if (JSON.stringify(_Weeks) === JSON.stringify(ALLDAY_VALUE)) {
        Repeat = 1;
      } else if (JSON.stringify(_Weeks) === JSON.stringify(WEEKDAY_VALUE)) {
        Repeat = 2;
      } else if (JSON.stringify(_Weeks) === JSON.stringify(WEEKEND_VALUE)) {
        Repeat = 3;
      } else {
        Repeat = 4;
      }
    }
  } catch (e) { }

  return Repeat;
}
export function getWeeks2RepeatStr(Weeks) {
  let RepeatStr = "00";
  const Repeat = getWeeks2Repeat(Weeks);
  const _Weeks = Weeks.sort((a, b) => a - b);
  try {
    if (_Weeks && _Weeks.length) {
      const RepeatArr = Array.from({ length: 8 }).map((item, index) => index ? 0 : 1);
      let _oRepeatStr = RepeatArr.join("");
      if (Repeat) {
        let _RepeatArr = Array.from({ length: 7 })
          .map((item, index) => Weeks.includes(index) ? 1 : 0);
        _RepeatArr = [...(_RepeatArr.slice(1, _RepeatArr.length)), _RepeatArr[0]];
        _RepeatArr = _RepeatArr.reverse();
        _oRepeatStr = _RepeatArr.join("");
        RepeatStr = `0${ _oRepeatStr }`;
      }
    }
  } catch (e) { }

  return { RepeatStr, Repeat };
}

/**
 * 用于拼接 时间 功能值 重复时间
 * @param param
 * @returns 字符串
 */
export function getTimeRepeatText(timeItem, timeStr = "") {
  const _arr = getTimeRepeatArr(timeItem);
  console.log("getTimeRepeatText--->", timeItem, timeStr, _arr)
  return `${ _arr?.time ?? "" }${ timeStr ?? "" },${ _arr?.repeat ?? "" }`;
}

export function isPreZero(n) {
  return n < 10 ? `0${ n }` : n;
}
export function getTimeText(times) {
  if (!times || !times.length) return "";
  const _h = times[0], _m = times.length > 1 ? times[1] : 0;
  return `${ isPreZero(_h) }:${ isPreZero(_m) }`;
}
/**
 * 用于拼接 时间 功能值 重复时间
 * @param param
 * @returns 
 */
export function getTimeRepeatArr({ 
  StartTimes, EndTimes, Repeat, RepeatArr, Weeks, WeekArr, 
  TargetTempValue, TargetTempUnit, NooneTime, NooneTimeUnit,
  VentValue, VentUnit, BlowValue, Timing_ExtendFunc = false, showTargetTemp = true
}) {
  let _s: any = {};
  if (StartTimes && StartTimes.length) {
    let _T = getTimeText(StartTimes);
    if (EndTimes && EndTimes.length) {
      _T += `-${ getCompareTime(StartTimes, EndTimes)?.t ?? "" }${ getTimeText(EndTimes) }`;
    }
    _s = { ..._s, time: _T };
  }

  if (Timing_ExtendFunc) {
    if (TargetTempValue && showTargetTemp) {
      _s = { ..._s, other: `${ TargetTempValue ?? "" }${ TargetTempUnit || "" }` };
    }
    if (VentValue) {
      _s = { ..._s, other: `${ VentValue ?? "" }${ VentUnit || "" }` };
    }
    if (BlowValue) {
      _s = { ..._s, other: `${ BlowValue ?? "" }${ BlowValue || "" }` };
    }
  }

  if (NooneTime) {
    _s = { ..._s, nightLightOther: `${ NooneTime ?? "" }${ NooneTimeUnit || "" }` };
  }

  if (RepeatArr && RepeatArr.length && WeekArr && WeekArr.length) {
    const _rStr = Repeat === 4 ? 
      getArrayValText(WeekArr, Weeks) : 
      getArrayValText(RepeatArr, Repeat);
    _s = { ..._s, repeat: _rStr };
  }
  return _s;
}
/**
 * 对比开始和结束时间，开始时间大于等于结束时间，返回 "次日" 文案
 * @param StartTimes 
 * @param EndTimes 
 * @returns 
 */
export function getCompareTime(StartTimes, EndTimes) {
  let _t: any = "", v = 0;
  if (StartTimes && StartTimes.length) {
    const _st = StartTimes[0] * 60 + (StartTimes.length > 1 ? StartTimes[1] : 0);
    if (EndTimes && EndTimes.length) {
      const _et = EndTimes[0] * 60 + (EndTimes.length > 1 ? EndTimes[1] : 0);
      
      if (_st >= _et) {
        _t = "次日";
        v = 1;
      }
    }
  }
  return { t: _t, v };
}