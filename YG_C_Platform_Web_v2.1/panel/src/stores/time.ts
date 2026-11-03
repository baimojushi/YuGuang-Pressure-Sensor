import { defineStore, acceptHMRUpdate } from "pinia";
import { handleHMArr2HMStr } from "../utils";

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

export const DefaultTimeData = {
    StartTimes: [0, 0],
    EndTimes: [23, 59],
    Weeks: [],
    Repeat: 0
};

type NightLightTimeType = {
  StartTimes: number[];
  EndTimes: number[];
  Weeks: number[];
  Repeat: number;
};

const TimeType = {
    "NightLight": 0,
    "AutoLight": 1,
    "AutoOff": 2
}
export const useTimeStore = defineStore("time", {
  state: () => ({
    NightLightTimeCache: {
      StartTimes: [0, 0],
      EndTimes: [23, 59],
      Weeks: [],
      Repeat: 0
    } as NightLightTimeType,
    AutoLightTimeCache: {
      StartTimes: [0, 0],
      EndTimes: [23, 59],
      Weeks: [],
      Repeat: 0
    } as NightLightTimeType,
    AutoOffTimeCache: {
      StartTimes: [0, 0],
      EndTimes: [23, 59],
      Weeks: [],
      Repeat: 0
    } as NightLightTimeType,

    NightLightTime: {
      StartTimes: [22, 1],
      EndTimes: [7, 59],
      Weeks: [],
      Repeat: 0
    },
    AutoLightTime: {
      StartTimes: [8, 0],
      EndTimes: [22, 0],
      Weeks: [],
      Repeat: 0
    } as NightLightTimeType,
    AutoOffTime: {
      StartTimes: [0, 0],
      EndTimes: [23, 59],
      Weeks: [],
      Repeat: 0
    } as NightLightTimeType
  }),
  getters: {
    getTimeObj: (
      state
    ): {
      NightLightTime: NightLightTimeType;
      AutoLight: NightLightTimeType;
      AutoOff: NightLightTimeType;
    } => {
      return {
        NightLightTime: state.NightLightTime,
        AutoLight: state.AutoLightTime,
        AutoOff: state.AutoOffTime
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
        this.NightLightTimeCache = JSON.parse(JSON.stringify(this.NightLightTime));
      } else if (TimeType?.[type] === 1) {
        this.AutoLightTimeCache = JSON.parse(JSON.stringify(this.AutoLightTime));
      } else if (TimeType?.[type] === 2) {
        this.AutoOffTimeCache = JSON.parse(JSON.stringify(this.AutoOffTime));
      }
    },
    /**
     * 设置缓存数据
     * @param type
     */
    setTimeStates(key, v, type) {
      let Repeat = 0;
      const isWeeks = key === "Weeks";
      if (isWeeks) {
        Repeat = this.getRepeatByWeeks(v);
      }

      if (!TimeType?.[type]) {
        this.NightLightTimeCache[`${key}`] = v;
        if (isWeeks) {
          this.NightLightTimeCache.Repeat = Repeat;
        }
      } else if (TimeType?.[type] === 1) {
        this.AutoLightTimeCache[`${key}`] = v;
        if (isWeeks) {
          this.AutoLightTimeCache.Repeat = Repeat;
        }
      } else if (TimeType?.[type] === 2) {
        this.AutoOffTimeCache[`${key}`] = v;
        if (isWeeks) {
          this.AutoOffTimeCache.Repeat = Repeat;
        }
      }
    },

    /**
     * 处理时间字符串
     * @param type
     */
    handleTimeStr2Obj(str, type) {
      if (!str || !str.length || str.length < 10) return;

      const _StartTimes_0 = str.slice(0, 2),
        _StartTimes_1 = str.slice(2, 4),
        _EndTimes_0 = str.slice(4, 6),
        _EndTimes_1 = str.slice(6, 8),
        _Repeat = str.slice(8, 10);

      const StartTimes = [
          convert16To10(_StartTimes_0),
          convert16To10(_StartTimes_1)
        ],
        EndTimes = [convert16To10(_EndTimes_0), convert16To10(_EndTimes_1)],
        RepeatObj = this.handleRepeatStr2Arr(_Repeat);

      const _t = {
        StartTimes,
        EndTimes,
        ...RepeatObj
      };
      if (!TimeType?.[type]) {
        this.NightLightTime = _t;
        this.NightLightTimeCache = _t;
      } else if (TimeType?.[type] === 1) {
        this.AutoLightTime = _t;
        this.AutoLightTimeCache = _t;
      } else if (TimeType?.[type] === 2) {
        this.AutoOffTime = _t;
        this.AutoOffTimeCache = _t;
      }
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
    handleTimeObj2Str(opt: NightLightTimeType) {
      if (!opt.StartTimes || !opt.EndTimes || !opt.Weeks) {
        return { code: -1 };
      }

      try {
        const ST_0 = opt.StartTimes?.[0],
          ST_1 = opt.StartTimes?.[1],
          ET_0 = opt.EndTimes?.[0],
          ET_1 = opt.EndTimes?.[1];

        const ST_0_16 = convert10To16_len(ST_0),
          ST_1_16 = convert10To16_len(ST_1),
          ET_0_16 = convert10To16_len(ET_0),
          ET_1_16 = convert10To16_len(ET_1),
          Repeat = convert10To16_len(
            this.handleRepeatArr2Str(opt.Repeat, opt.Weeks)
          );

        const timeArr = [ST_0_16, ST_1_16, ET_0_16, ET_1_16, Repeat];
        const _timeStr = timeArr.join("");

        return {
          code: 0,
          value: _timeStr.slice(0, 10)
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

    handleTimeSplit(startTime, endTime) {
      const stStr = handleHMArr2HMStr(startTime, "", ":"),
        etStr = handleHMArr2HMStr(endTime, "", ":");
      const str = handleHMArr2HMStr([stStr ?? "", etStr ?? ""], "", "-");
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
