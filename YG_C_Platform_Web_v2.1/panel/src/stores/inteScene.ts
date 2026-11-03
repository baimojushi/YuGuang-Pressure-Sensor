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


import { handleHMArr2HMStr, getArrayValText } from "../utils";

export const DEFAULT_TIME = {
  TimingNightLight: "010816000600001e7f",
  TimingInteScene: "040000010000000002000000e4babae6849fe785a7e6988e00000000000000000000050000020000000000e5a48fe697a5e590b9e9a38e000000000000000000000a0000070000000000e4babae6849fe68da2e6b09400000000000000000000140000150000000000e4babae6849fe999a4e887ad0000000000000000"
}
export const FuncValues = {
    // 模式对应的值
    Mode_Blow: 2,
    Mode_Dry: 4,
    Mode_Vent: 7,
    Mode_AI: 18,
    Mode_Deodor: 21,

    // 区间
    TargetTemp_AI: [30, 42],
    Level_Vent: [1, 5],
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

export const FuncConfig = {
  TimeFuncArr,
  TimeFuncArr1: TimeFuncArr.slice(0, TimeFuncArr.length),

  TopList: TimeFuncArr
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
}>;

const TimeType = {
    "TimingFunc": 0,
    "TimingHeat": 1
}

export const _Mode_TOTAL = 24, _Mode_LEN = 22;

export const useTimeStore = defineStore("time", {
  state: () => ({
    TimingFuncCache: DefaultTimeData,
    TimingHeatCache: DefaultTimeData,

    TimingFunc: DefaultTimeData,
    TimingHeat: DefaultTimeData
  }),
  getters: {
    getTimeObj: (
      state
    ): {
      TimingFunc: TimingFuncType;
      TimingHeat: TimingFuncType;
    } => {
      return {
        TimingFunc: state.TimingFunc,
        TimingHeat: state.TimingHeat
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
      } else if (TimeType?.[type]) {
        this.TimingHeatCache = JSON.parse(JSON.stringify(this.TimingHeat));
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
      } else if (TimeType?.[type]) {
        this.TimingHeatCache[ID][`${key}`] = v;
        if (isWeeks) {
          this.TimingHeatCache[ID].Repeat = RepeatArr?.Repeat;
          this.TimingHeatCache[ID].RepeatStr = RepeatArr?.RepeatStr;
        }
      }
      console.log("RepeatArr--->", RepeatArr, this.TimingHeatCache)
    },

    /**
     * 处理时间字符串
     * @param type 0 - TimingFunc; 1 - TimingHeat
     */
    handleTimeStr2Obj(str, type) {
      let list: TimingFuncType = [];

      if (!str || !str.length) {
        str = DEFAULT_TIME?.[type];
      }

      if (str && str.length && str.length >= _Mode_TOTAL) {
        // const regex = new RegExp(/.{1,26}/g);
        const PackCount = convert16To10(str.slice(0, 2)),
          _arr = str.slice(2, str.length);
        const regex = new RegExp(`.{1,${ _Mode_LEN }}`, 'g');
        const result = _arr.match(regex);
        if (result && result.length) {
          for (const item of result) {
            const _i = result.indexOf(item);
            if (item.length >= _Mode_LEN) {
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
                ExternalLightValue = convert16To10(item.slice(20, _Mode_LEN));

              const StartTimes = [_StartTime_0, _StartTime_1];
              // EndTimes = convertTimestamp2Date(_EndTime);
              list = [...list, {
                ID: _i, PackCount, Value, TimeZone, StartTimes, ModeValue, TargetTempValue,
                LightValue, VentValue, BlowValue, ExternalLightValue, RawStr: item,
                ...(_time ?? {})
              }];
            }
          }
        }
      };

      console.log(type, list)
      if (!TimeType?.[type]) {
        this.TimingFunc = list;
        this.TimingFuncCache = list;
      } else if (TimeType?.[type] === 1) {
        this.TimingHeat = list;
        this.TimingHeatCache = list;
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
     * 组合时间字符串
     * @param opt
     * @returns { code, value } code: -1-失败  0-成功
     */
    handleTiming2Str(list: TimingFuncType) {
      if (!list || !list.length) {
        return { code: -1 };
      }

      try {
        const PackCount = list.length;
        let _arr: string[] = [convertValue(PackCount)];

        for (const item of list) {
          const _v = convertValues([
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
          _arr = [..._arr, _v.join("")];
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
        etStr = handleHMArr2HMStr(endTime, "", ":");
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