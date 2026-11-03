#ifndef BSP_CAMERA_H
#define BSP_CAMERA_H

#ifdef __cplusplus
extern "C" {
#endif

#include "esp_err.h"
#include <stdbool.h>
#include <stddef.h>

/*
 * BF3901 模组丝印是 DVP 名，驱动按 1-bit SPI 收：
 *   VSYNC = CS（帧有效）
 *   PCLK  = SCLK
 *   D0    = DATA
 * HREF、D1 1-bit 模式不接。
 *
 * 丝印        ESP32-S3     说明
 * VCC         3.3V         不要接 5V
 * GND         GND          必须共地
 * SDA         GPIO21       I2C 数据
 * SCL         GPIO47       I2C 时钟
 * VSYNC       GPIO4        接到驱动的 CS（原 GPIO6）
 * PCLK        GPIO13       接到驱动的 SCLK
 * D0          GPIO8        接到驱动的 DATA0（原 GPIO16）
 * PWDN        GPIO41       低有效，软件拉低
 * HREF        悬空         不要接到 CS
 * D1          悬空
 * XCLK        没有丝印就不用接（模组自带 24 MHz）
 *
 * 开机先 early_init（申请 PSRAM 帧缓冲），再 stream_start。
 * 新工程只传输约 1FPS 原始 UYVY 帧到局域网 PC；驱动可保持 12FPS 采集。
 * 注意：若相机 driver 返回包含 SPI 额外帧头的 bytesused，必须先修复
 * auto_decode/数据预处理路径，不能把截断数据谎称为 UYVY 图像。
 */
#define BSP_CAM_I2C_PORT        0
#define BSP_CAM_SDA_GPIO        21
#define BSP_CAM_SCL_GPIO        47
#define BSP_CAM_CS_GPIO         4
#define BSP_CAM_SCLK_GPIO       13
#define BSP_CAM_DATA0_GPIO      8
#define BSP_CAM_PWDN_GPIO       41
#define BSP_CAM_RESET_GPIO      (-1)
#define BSP_CAM_XCLK_GPIO       (-1)

esp_err_t bsp_camera_early_init(void);
esp_err_t bsp_camera_stream_start(void);
esp_err_t bsp_camera_start(void);
bool bsp_camera_is_available(void);
bool bsp_camera_stream_is_on(void);

/*
 * 帧出口：等待一帧比 *inout_seq 更新的 UYVY 画面，拷进调用方缓冲。
 * 首次调用传 *inout_seq = 0；成功后写回新序号，可用于丢帧判断。
 * dst 至少 width*height*2 字节。wait_ms 内无新帧返回 ESP_ERR_TIMEOUT。
 * out_dequeue_timestamp_us 是收到 V4L2 完整帧之后的 ESP 单调时间戳，
 * 不承诺等于传感器物理曝光中点时刻。
 */
esp_err_t bsp_camera_frame_copy(uint8_t *dst, size_t dst_len,
                                size_t *out_len, uint16_t *out_w, uint16_t *out_h,
                                uint32_t *inout_seq, uint32_t wait_ms,
                                int64_t *out_dequeue_timestamp_us);

#ifdef __cplusplus
}
#endif

#endif
