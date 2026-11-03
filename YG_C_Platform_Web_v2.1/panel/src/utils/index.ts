export const isMiniProgramEnv =
  (window as unknown as { __wxjs_environment?: string }).__wxjs_environment ===
    "miniprogram" ||
  (typeof (window as any).__wxjs_environment === "undefined" &&
    /MicroMessenger/i.test(navigator.userAgent));

export const JsonUtil = {
  parseJSON(str) {
    let rst;
    if (str && {}.toString.call(str) === "[object String]") {
      try {
        rst = JSON.parse(str);
      } catch (e) {
        try {
          // eslint-disable-next-line
          rst = eval(`(${str})`);
        } catch (e2) {
          rst = str;
        }
      }
    } else {
      rst = typeof str === "undefined" ? {} : str;
    }

    return rst;
  }
};

// 样式名称拼接
export const ClassConcat = (classNames?: string[]) => {
  if (!classNames || typeof classNames !== "object" || !classNames.length)
    return "";
  return (classNames ?? []).join(" ");
};

// 获取数组
export const getNumberArray = ({
  max = 10,
  min = 0,
  step = 1,
  isPrefix = true,
  unit = ""
}) => {
  const list = step
    ? Array.from({ length: Math.ceil((max - min) / step + 1) }).map(
        (item, index) => {
          const _v = index * step + min;
          const _maxLen = `${max}`.length;
          const _vStr = isPrefix
            ? `0000000000000${_v}`.slice(-_maxLen)
            : `${_v}`;
          return {
            text: _vStr,
            value: _v,
            unit
          };
        }
      )
    : [];
  return list;
};
export function getNumberArr(max = 5, min = 0, step = 1) {
  return Array.from({ length: (max - min) / (step || 1) + 1 }).map(
    (item, index) => index * (step || 1) + min
  );
}

export const numberPrefix = n => {
  return n < 10 ? `0${n}` : `${n}`;
};

export function handleMins2HM(minutes, isPrefix = false) {
  if (!minutes || typeof minutes !== "number") return [0, 0];

  const _m = parseInt(`${minutes % 60}`),
    _h = parseInt(`${minutes / 60}`);
  let _mm: string[] | number[] = [_h || 0, _m || 0];

  if (isPrefix) {
    _mm = _mm.map(item => numberPrefix(item));
  }
  return _mm;
}
export function handleMins2HMStr(
  minutes,
  units?,
  delimiter = "",
  isPrefix = true
) {
  if (!minutes) return "";

  const _hm = handleMins2HM(minutes);

  const _hmStr = _hm.map((item, index) => {
    return `${(isPrefix ? numberPrefix(item) : item) || ""}${item && units ? units?.[index] || "" : ""}`;
  });
  return _hmStr.join(delimiter);
}
export function handleMins2HMUnits(minutes, units?, isPrefix = true) {
  if (!minutes) return "";

  const _hm = handleMins2HM(minutes);
  const _hmStr = _hm.map((item, index) => {
    return item
      ? `${(isPrefix ? numberPrefix(item) : item) || ""}${item && units ? units?.[index] || "" : ""}`
      : "";
  });
  return _hmStr.join("");
}
export function handleHMArr2HMStr(
  arr,
  units?,
  delimiter = "",
  isPrefix = true
) {
  if (!arr || !arr.length) return "";

  const _hmStr = arr.map((item, index) => {
    return `${isPrefix ? numberPrefix(item) : (item ?? "")}${item && units ? units?.[index] || "" : ""}`;
  });

  console.log(_hmStr, delimiter, arr);
  return _hmStr.join(delimiter);
}

export function getArrayValText(list, value, unit?) {
  let _t: any = "";
  if (!list || !list.length) {
    return _t;
  }

  if (typeof value === "object" && value && value.length) {
    const curList = list.filter(
      item => value.includes(item?.value) && (item?.text?.value || item?.text)
    );
    if (curList && curList.length) {
      const _tArr = curList.map(item => item?.text?.value || item?.text);
      _t = _tArr.join(",");
    }
  } else {
    const curItem = list.find(item => item?.value === value);
    if (curItem) {
      _t = curItem?.text || curItem?.value || "";
      if (typeof _t === "object") {
        _t = _t?.value || _t;
      }
    }
  }
  return _t && _t.length ? `${_t}${unit || ""}` : _t;
}

export function getTimestamp(time, lastStamp?) {
  if (!time || time.length < 2) return 0;
  const today = new Date(),
    _y = today.getFullYear(),
    _m = today.getMonth() + 1,
    _d = today.getDate(),
    _timestamp = today.getTime();

  let newStamp = new Date(`${_y}/${_m}/${_d} ${time.join(":")}`).getTime();
  // let lastStamp = 0;
  // if (lastTime && lastTime.length > 1) {
  //   lastStamp = new Date(`${_y}/${_m}/${_d} ${lastTime.join(":")}`).getTime();
  // }

  if (newStamp < _timestamp) {
    newStamp = newStamp + 24 * 60 * 60 * 1000;
  }

  if (lastStamp && newStamp < lastStamp) {
    newStamp = newStamp + 24 * 60 * 60 * 1000;
  }

  return newStamp;
}

export function isTimeOverlap1(startA, endA, startB, endB) {
  console.log(startA, endA, startB, endB);
  // 检查时间段是否有效
  if (startA > endA || startB > endB) {
    // throw new Error("Invalid time range");
    return false;
  }

  // 判断是否重叠
  return startA <= endB && startB <= endA;
}

export function isTimeOverlap(startA, endA, startB, endB) {
  console.log(startA, endA, startB, endB);

  // 判断是否重叠
  return startA <= endB && startB <= endA;
}

// 将时间字符串转换为分钟数
function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr;
  return hours * 60 + minutes;
}
// 计算时间段重叠和调整后的时间段
export function calculateAdjustedPeriod(p1Start, p1End, p2Start, p2End) {
  p1Start = timeToMinutes(p1Start);
  p1End = timeToMinutes(p1End);
  p2Start = timeToMinutes(p2Start);
  p2End = timeToMinutes(p2End);
  // 检测重叠
  const overlapStart = Math.max(p1Start, p2Start);
  const overlapEnd = Math.min(p1End, p2End);

  let hasOverlap = isTimeOverlap(p1Start, p1End, p2Start, p2End);
  if (p1End <= p1Start) {
    hasOverlap =
      isTimeOverlap(p1Start, 1440, p2Start, p2End) ||
      isTimeOverlap(0, p1End, p2Start, p2End);
  } else if (p2End <= p2Start) {
    hasOverlap =
      isTimeOverlap(p1Start, p1End, p2Start, 1440) ||
      isTimeOverlap(p1Start, p1End, 0, p2End);
  }

  // 计算调整后的时间段
  let adjustedPeriod = null;

  if (hasOverlap) {
    if (p1End <= p1Start) {
      const t = isTimeOverlap(p1Start, 1440, p2Start, p2End);
      const t1 = isTimeOverlap(0, p1End, p2Start, p2End);
      if (t) {
      }
    }

    // 计算时间段1的两个非重叠部分
    const segmentBefore = { start: p1Start, end: overlapStart };
    const segmentAfter = { start: overlapEnd, end: p1End };

    // 计算两个片段的长度
    const lengthBefore = segmentBefore.end - segmentBefore.start;
    const lengthAfter = segmentAfter.end - segmentAfter.start;

    // 选择较长的片段
    if (lengthBefore > 0 && lengthAfter > 0) {
      if (lengthBefore >= lengthAfter) {
        adjustedPeriod = segmentBefore;
      } else {
        adjustedPeriod = segmentAfter;
      }
    } else if (lengthBefore > 0) {
      adjustedPeriod = segmentBefore;
    } else if (lengthAfter > 0) {
      adjustedPeriod = segmentAfter;
    }

    // 边界微调（1分钟安全边界）
    if (adjustedPeriod && adjustedPeriod.end - adjustedPeriod.start > 2) {
      adjustedPeriod.start += 1; // 开始时间延后1分钟
      adjustedPeriod.end -= 1; // 结束时间提前1分钟
    } else {
      adjustedPeriod = null; // 如果时间段太短则忽略
    }
  }

  return {
    hasOverlap,
    overlapStart: hasOverlap ? overlapStart : null,
    overlapEnd: hasOverlap ? overlapEnd : null,
    adjustedPeriod
  };
}

export function haveCommonItems(arr1, arr2) {
  if ((!arr1 || !arr1.length) && (!arr2 || !arr2.length)) return true;
  const set = new Set(arr1);
  return arr2.some(item => set.has(item));
}

function timeStrToMinutes(timeStr) {
  const [hours, minutes] = timeStr;
  return hours * 60 + minutes;
}

function minutesToTimeStr(minutes) {
  minutes = minutes < 0 ? minutes + 1440 : minutes % 1440;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}
function minutesToTimeArr(minutes) {
  minutes = minutes < 0 ? minutes + 1440 : minutes % 1440;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return [hours, mins];
}

export function calculateAdjustedPeriod1(
  originalStart1,
  originalEnd1,
  settingStart2,
  settingEnd2
) {
  const min1 = timeStrToMinutes(originalStart1);
  const max1 = timeStrToMinutes(originalEnd1);
  const min2 = timeStrToMinutes(settingStart2);
  const max2 = timeStrToMinutes(settingEnd2);

  // 将原始时间段1拆分为两天轴上的区间（0-2880分钟）
  const period1Intervals = [];
  if (max1 < min1) {
    // 跨天：拆分为 [开始, 24:00] 和 [00:00, 结束]
    period1Intervals.push([min1, 1440]);
    period1Intervals.push([1440, 1440 + max1]);
  } else {
    // 不跨天
    period1Intervals.push([min1, max1]);
  }

  // 构建设置时间段2在两天轴上的排除区间（0-2880分钟）
  const exclusionIntervals = [];
  if (max2 < min2) {
    // 跨天设置：添加前一日残留、当日、次日及下一周期开始部分
    exclusionIntervals.push([0, max2]); // 前一日残留（当日00:00至结束）
    exclusionIntervals.push([min2, 1440]); // 当日部分（开始至24:00）
    exclusionIntervals.push([1440, 1440 + max2]); // 次日部分（00:00至结束）
    exclusionIntervals.push([min2 + 1440, 2880]); // 下一周期当日部分（开始至24:00）
  } else {
    // 不跨天设置：添加当日和次日完整区间
    exclusionIntervals.push([min2, max2]); // 当日
    exclusionIntervals.push([min2 + 1440, max2 + 1440]); // 次日
  }

  // 从原始时间段1中排除设置时间段2
  let adjustedIntervals = [...period1Intervals];
  for (const excl of exclusionIntervals) {
    const newIntervals = [];
    for (const interval of adjustedIntervals) {
      // 跳过无效区间
      if (interval[0] >= interval[1]) continue;
      if (excl[0] >= excl[1]) continue;

      // 无重叠：直接保留
      if (interval[1] <= excl[0] || interval[0] >= excl[1]) {
        newIntervals.push(interval);
      } else {
        // 有重叠：分割区间
        if (interval[0] < excl[0]) {
          newIntervals.push([interval[0], excl[0]]);
        }
        if (excl[1] < interval[1]) {
          newIntervals.push([excl[1], interval[1]]);
        }
      }
    }
    adjustedIntervals = newIntervals;
  }

  // 合并相邻区间
  adjustedIntervals.sort((a, b) => a[0] - b[0]);
  const mergedIntervals = [];
  for (const interval of adjustedIntervals) {
    if (interval[0] >= interval[1]) continue; // 跳过空区间
    if (mergedIntervals.length === 0) {
      mergedIntervals.push(interval);
    } else {
      const last = mergedIntervals[mergedIntervals.length - 1];
      if (last[1] === interval[0]) {
        last[1] = interval[1]; // 合并相邻
      } else {
        mergedIntervals.push(interval);
      }
    }
  }

  // 边界调整：避开设置时间段2的边界
  const finalIntervals = [];
  for (const interval of mergedIntervals) {
    let [start, end] = interval;

    // 检查边界是否与排除区间重合
    let startBoundary = false;
    let endBoundary = false;
    for (const excl of exclusionIntervals) {
      if (start === excl[0] || start === excl[1]) startBoundary = true;
      if (end === excl[0] || end === excl[1]) endBoundary = true;
    }

    // 调整边界（加1分钟或减1分钟）
    if (startBoundary) start++;
    if (endBoundary) end--;
    if (start >= end) continue; // 跳过空区间

    // 转换为单日表示（处理跨天）
    if (start < 1440 && end > 1440) {
      // 跨1440分钟：转换为跨天表示 [开始, 结束-1440]
      finalIntervals.push([start, end - 1440]);
    } else {
      // 单日内：取模1440
      start %= 1440;
      end %= 1440;
      finalIntervals.push([start, end]);
    }
  }

  // 选择第一个非空区间作为结果
  if (finalIntervals.length === 0) return null;
  const [startMin, endMin] = finalIntervals[0];

  // 格式化为时间字符串
  return {
    startMin: minutesToTimeArr(startMin),
    endMin: minutesToTimeArr(endMin)
  };
}

export function isTimeOverlapA(p1Start, p1End, p2Start, p2End) {
  console.log(p1Start, p1End, p2Start, p2End);
  p1Start = timeToMinutes(p1Start);
  p1End = timeToMinutes(p1End);
  p2Start = timeToMinutes(p2Start);
  p2End = timeToMinutes(p2End);
  let hasOverlap = isTimeOverlap(p1Start, p1End, p2Start, p2End);
  if (p1End <= p1Start) {
    hasOverlap =
      isTimeOverlap(p1Start, 1440, p2Start, p2End) ||
      isTimeOverlap(0, p1End, p2Start, p2End);
  } else if (p2End <= p2Start) {
    hasOverlap =
      isTimeOverlap(p1Start, p1End, p2Start, 1440) ||
      isTimeOverlap(p1Start, p1End, 0, p2End);
  }
  return hasOverlap;
}

export function getArrayValItem(list, value, unit?) {
  let _t: any = {};
  if (!list || !list.length) {
    return _t;
  }

  if (typeof value === "object" && value && value.length) {
    const curList = list.filter(
      item => value.includes(item?.value) && (item?.text?.value || item?.text)
    );
    if (curList && curList.length) {
      const _tArr = curList.map(item => item?.text?.value || item?.text);
      _t = _tArr;
    }
  } else {
    const curItem = list.find(item => item?.value === value);
    if (curItem) {
      _t = curItem;
    }
  }
  return _t && _t.length ? `${_t}${unit || ""}` : _t;
}

/**
 * 获取字符长度
 */
export function getStrLen(str) {
  if (!str || !str.length) return 0;
  let len = 0;
  for (let i = 0; i < str.length; i++) {
    if (str.charCodeAt(i) > 127 || str.charCodeAt(i) == 94) {
      len += 2;
    } else {
      len++;
    }
  }
  return len;
}

export function getArray(max = 5, min = 0, step?, unit?, isPrefix?, textArr?) {
  return Array.from({ length: (max - min) / (step || 1) + 1 }).map(
    (item, index) => {
      const value = index * (step || 1) + min;
      let itemText = `${!!isPrefix && value < 10 ? `0${value}` : value}${unit || ""}`;
      if (!!textArr && !!textArr.length && textArr[index]) {
        itemText = textArr[index];
      }
      return { text: itemText, value };
    }
  );
}

/**
 * 判断两个时间段是否有重叠 - 支持跨天时间段
 * @param start1 第一个时间段开始时间 [小时, 分钟]
 * @param end1 第一个时间段结束时间 [小时, 分钟]
 * @param start2 第二个时间段开始时间 [小时, 分钟]
 * @param end2 第二个时间段结束时间 [小时, 分钟]
 * @returns boolean 是否有重叠
 */
export function isTimePeriodsOverlap(start1, end1, start2, end2) {
  // 转换为分钟数
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);

  // 判断是否跨天
  const period1CrossDay = e1 <= s1;
  const period2CrossDay = e2 <= s2;

  // 情况1: 都不跨天
  if (!period1CrossDay && !period2CrossDay) {
    return s1 < e2 && s2 < e1;
  }

  // 情况2: 第一个时间段跨天，第二个不跨天
  if (period1CrossDay && !period2CrossDay) {
    // 第一个时间段拆分为两部分：[s1, 1440] 和 [0, e1]
    return s1 <= s2 || s1 < e2 || s2 < e1 || e2 <= e1;
  }

  // 情况3: 第二个时间段跨天，第一个不跨天
  if (!period1CrossDay && period2CrossDay) {
    // 第二个时间段拆分为两部分：[s2, 1440] 和 [0, e2]
    return s2 <= s1 || s2 < e1 || s1 < e2 || e1 <= e2;
  }

  // 情况4: 都跨天
  if (period1CrossDay && period2CrossDay) {
    // 跨天的时间段基本都会重叠，除非完全分离
    // 检查是否有完全不重叠的情况：e1 < s2 && e2 < s1
    return !(e1 < s2 && e2 < s1);
  }

  return false;
}

/**
 * 对比开始和结束时间，开始时间大于等于结束时间，返回 "次日" 文案
 * @param StartTimes
 * @param EndTimes
 * @returns
 */
export function getCompareTime(StartTimes, EndTimes) {
  let _t: any = "",
    v = 0;
  if (StartTimes && StartTimes.length) {
    const _st =
      StartTimes[0] * 60 + (StartTimes.length > 1 ? StartTimes[1] : 0);
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
