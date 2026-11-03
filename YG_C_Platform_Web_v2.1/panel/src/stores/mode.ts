import { defineStore, acceptHMRUpdate } from "pinia";

export const MaxCustomModeCount = 2;
export const StaticModeCount = 2;
export const MaxModeItemDataCout = 8;

type ModeItemType = {
  text: string;
  icon?: string;
  value: number;
  brightness: number;
};
type ModeListType = Array<ModeItemType>;

export const useModetore = defineStore("mode", {
  state: () => ({
    ModeList: [] as ModeListType
  }),
  getters: {
  },
  actions: {
    /**
     * 处理模式字符串
     * @param str text,value,brightness;text,value,brightness
     */
    handleStr2Arr(str) {
      if (!str || !str.length || str.length < 4) {
        this.ModeList = [];
        return;
      }

      let strArr = str.split(";");
      let arr: ModeListType = [];

      if (strArr && strArr.length) {
        strArr = strArr.map((item) => item && item.length ? item.split(",") : []);
        for (let i = 0; i < strArr.length; i++) {
          const item = strArr[i];
          if (item && item.length >= 3) {
            arr = [
              ...arr,
              {
                text: item?.[0],
                icon: "icon-custom",
                value: parseInt(item?.[1]),
                brightness: parseInt(item?.[2])
              }
            ];
          }
        }
      }
      this.ModeList = arr;
    },

    /**
     * 删除模式
     * @returns { code, value } code: -1-模式id异常 -4-保存失败  
     *  0-成功  value: text,value,brightness;text,value,brightness
     */
    deleteMode(value) {
      if (!value) {
        return { code: -1 };
      }

      try {
        const _i = this.ModeList.findIndex((item) => item.value === value);
        const _ModeList = JSON.parse(JSON.stringify(this.ModeList));

        if (_i > -1) {
          _ModeList.splice(_i, 1);
        } else {
          return { code: -1 };
        }
        console.log("value--ww->", value, _i)
        const strBack = this.handleObj2Str(_ModeList);
        console.log("-handleObj2Str-->", strBack)
        return strBack;
      } catch (e) {
        return { code: -4 };
      }
    },
    /**
     * 添加模式字符串
     * @param opt
     * @param Mode - 用于判断执行中的模式
     * @returns { code, value } code: -1-参数异常 -2-已达上限 -3-模式正在运行中无法编辑  -4-保存失败  
     *  0-成功  value: text,value,brightness;text,value,brightness
     */
    addMode(data: ModeItemType, Mode) {
      if (!data || !data.text) {
        return { code: -1 };
      }

      try {
        if (Mode && Mode === data?.value) {
          return { code: -3 };
        }

        const _i = this.ModeList.findIndex((item) => item.value === data?.value);
        let _ModeList = JSON.parse(JSON.stringify(this.ModeList));

        if (_i > -1) {
          _ModeList[_i] = data;
        } else {
          if (this.ModeList.length >= MaxCustomModeCount) {
            return { code: -2 };
          }
          
          let newValue: number = data?.value;
          if (!data?.value) {
            if (this.ModeList && this.ModeList.length) {
              const values = this.ModeList.map((item) => parseInt(`${ item.value }`));
              const autoModeIDs = Array.from({ length: MaxCustomModeCount }).map((item, index) => index + 1 + StaticModeCount);
              newValue = autoModeIDs.find((item) => !values.includes(item));
            } else newValue = 1 + StaticModeCount;

            if (!newValue) {
              return { code: -2 };
            }
          }
          
          _ModeList = [..._ModeList, { ...data, value: newValue }];
        }
        const strBack = this.handleObj2Str(_ModeList);
        console.log("-handleObj2Str-->", strBack)
        return strBack;
      } catch (e) {
        return { code: -3 };
      }
    },

    /**
     * 组合模式字符串
     * @param opt
     * @param Mode - 用于判断执行中的模式
     * @returns { code, value } code: -1-参数异常 -2-已达上限 -3-模式正在运行中无法编辑  -4-保存失败  
     *  0-成功  value: text,value,brightness;text,value,brightness
     */
    handleObj2Str(ModeList) {
      if (!ModeList || !ModeList.length) {
        return {
          code: 0,
          value: ""
        };
      }

      try {
        const newArr = ModeList.map((item) => {
          if (!item.text || !item.value) {
            return ""
          } else {
            const _s = [item.text, item.value, item.brightness];
            return _s.join(",")
          }
        }).filter((item) => item && item.length);
        return {
          code: 0,
          value: newArr.join(";")
        };
      } catch (e) {
        return { code: -3 };
      }
    }
  }
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useModetore, import.meta.hot));
}
