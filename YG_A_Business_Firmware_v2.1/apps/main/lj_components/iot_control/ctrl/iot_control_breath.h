#ifndef IOT_CONTROL_BREATH_H
#define IOT_CONTROL_BREATH_H

#ifdef __cplusplus
extern "C" {
#endif

/* 余光 v2 物模型：siid 10 piid 3 = 呼吸频率（uint8 只读），
 * piid 4 = 采集状态（string 只读，ok / no_signal）。
 * 只读属性不进下行表，由本组件周期从 LD6002 快照上报。 */
#define IOT_CONTROL_BREATH_SIID       10
#define IOT_CONTROL_BREATH_PIID_RATE  3
#define IOT_CONTROL_BREATH_PIID_STATE 4

/* 云连接就绪后调用一次（iot_control_init 里）；内部起周期任务，重复调用忽略。 */
int iot_control_breath_start(void);

#ifdef __cplusplus
}
#endif

#endif
