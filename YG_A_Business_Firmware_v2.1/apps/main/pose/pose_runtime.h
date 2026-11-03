#ifndef POSE_RUNTIME_H
#define POSE_RUNTIME_H

#include "esp_err.h"
#include "yolo11_pose.h"

#include <stdbool.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/*
 * 摄像头实时姿态循环：等摄像头开流后，取帧 → UYVY 转 RGB888(顺时针 90°) →
 * YOLO11n-pose 推理 → 保存最近一次结果（含 17 个关键点）。
 * 必须在摄像头开流之前调用（模型要从 Flash 读，不能和摄像头并发）。
 */
esp_err_t pose_runtime_init(void);

/* 取最近一次推理结果；还没出过结果时返回 false。 */
bool pose_runtime_get(yolo11_pose_frame_result_t *out, uint32_t *out_seq,
                      uint32_t *out_analyzed);

#ifdef __cplusplus
}
#endif

#endif
