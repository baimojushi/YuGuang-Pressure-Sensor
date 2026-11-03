#ifndef VIDEO_STREAM_H
#define VIDEO_STREAM_H

#include "esp_err.h"
#include "yolo11_pose.h"

#include <stdbool.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/*
 * 板内 MJPEG 画面输出：HTTP :80，`/` 看网页，`/stream` 拉流。
 * 没有客户端时不做叠加与编码，避免白耗 CPU。
 */
esp_err_t video_stream_start(void);

/* 把一帧 RGB888 叠加骨架后编码为 JPEG 并发布；rgb888 会被就地绘制，调用方此后不应再用它做推理。 */
void video_stream_publish(uint8_t *rgb888, uint16_t w, uint16_t h,
                          const yolo11_pose_frame_result_t *res);

bool video_stream_has_clients(void);

#ifdef __cplusplus
}
#endif

#endif
