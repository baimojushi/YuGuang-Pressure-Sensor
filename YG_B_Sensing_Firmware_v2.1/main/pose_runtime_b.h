#ifndef POSE_RUNTIME_B_H
#define POSE_RUNTIME_B_H

#include "esp_err.h"
#include "yolo11_pose.h"

#include <stdbool.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/*
 * 摄像头实时姿态循环（B 板原生版，无 qumios / 无 HTTP 推流）：
 * 等摄像头开流 → 取帧 → UYVY 转 RGB888(顺时针 90°) → YOLO11n-pose 推理 →
 * 保存最近一次结果（含 17 个关键点）。
 * 必须在 bsp_camera_early_init() 之后、bsp_camera_stream_start() 之前调用，
 * 因为模型要从 Flash 读，不能和摄像头取流并发。
 */
esp_err_t pose_runtime_b_init(void);

/* 取最近一次推理结果；还没出过结果时返回 false。 */
bool pose_runtime_b_get(yolo11_pose_frame_result_t *out, uint32_t *out_seq,
                        uint32_t *out_analyzed);

/*
 * 把最近一次姿态结果折算成融合用的 P 指标（0..100）。
 * 只在模型给出确定判定时返回 true：
 *   FRAME_OK         -> *p = 100（坐姿合格）
 *   FRAME_BAD_POSTURE-> *p = 30 （判定为不良坐姿）
 *   NO_PERSON/UNKNOWN/无结果 -> 返回 false，调用方必须置 p_ok=false，
 *   不伪造缺失数据（见 README 第 1 条）。
 * 结果超过 max_age_ms 未刷新也返回 false。
 */
bool pose_runtime_b_indicator(float *p, uint32_t max_age_ms);

#ifdef __cplusplus
}
#endif

#endif
