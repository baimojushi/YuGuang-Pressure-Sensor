# XJ_H5

## 环境

```sh
node 18.0或更高版本
```

## 使用方式

### 1. 安装依赖

```sh
npm install
```

### 2. 运行

```sh
npm run dev
npm run debug --- 本地调试，模拟数据上报
```

### 3. 打包

```sh
npm run build
```

## config.json介绍

### 1. 物模型

```sh
1. 平台上复制设备物模型至./src/thingModel/Cat.json，运行之后会自动生成config.json
2. 本地已存在config.json文件，则不再更新该文件
```

### 2. config.json格式

```sh
{
    "type": "wifi",  // 设备类型
    "basicConfig": {
        "defaultData": true  // 首次是否需要初始值，默认true
    },

    // 设备信息
    "info": {
        "displayName": "测试Mesh网关"  // 设备名称
    },

    // 物模型
    "data": {
        "deviceInfo_Manufacturer": {
            "key": "prop.1.1",
            "value": ""
        },
        "deviceInfo_Model": {
            "key": "prop.1.2",
            "value": ""
        },
        "deviceInfo_FirmwareVersion": {
            "key": "prop.1.3",
            "value": ""
        },
        "deviceInfo_Did": {
            "key": "prop.1.4",
            "value": ""
        },
        "deviceInfo_Pid": {
            "key": "prop.1.5",
            "value": ""
        },
        "deviceInfo_Sn": {
            "key": "prop.1.6",
            "value": ""
        },
        "gateway_Power": {
            "key": "prop.2.1",
            "value": false
        },
        "Mode": {
            "key": "prop.2.2",
            "value": 0
        }
    }
}
```
