#ifndef YG_CARE_H
#define YG_CARE_H
#include <stdint.h>
#include <stdbool.h>
/* Called only from authenticated owner-device platform command adapter. */
int yg_care_init(void);
/* 平台受限灯语：RGB 原色由云端映射，亮度百分数最大 18。 */
typedef struct {
 uint8_t rgb[2][3];
 uint8_t color_count; /* 1..2 */
 uint8_t pattern;     /* 1=slow_breathe 2=soft_pulse 3=slow_fade */
 uint8_t brightness_pct;
 uint32_t period_ms;
 uint32_t cycles;
 uint32_t duration_ms;
} yg_care_light_t;
bool yg_care_arm(const char *message_id,const char *device_id,uint32_t window_ms);
/* Attach server command ID while still armed, before display; needed to confirm real render. */
bool yg_care_bind_command(const char *command_id);
bool yg_care_arm_light(const char *message_id,const char *device_id,uint32_t window_ms,
                       const yg_care_light_t *light);
bool yg_care_render_rgb(uint8_t rgb[3]); /* 单次 LED 帧的低亮度值 */
bool yg_care_lamp_active(void);  /* display window only, not pending network retry */
void yg_care_mark_lamp_drawn(void); /* 仅实际 LED 刷新成功后调用 */
void yg_care_cancel_display(void); /* 专注或明确关灯时取消待显示窗口 */
bool yg_care_reply_glow(uint8_t *brightness); /* 本地 0.9s 温暖确认光 */
void yg_care_ir_high(uint64_t now_monotonic_ms);
/* Called only after server committed the ACK (not after MQTT PUB succeeded). */
bool yg_care_confirm(const char *event_id,const char *message_id);
void yg_care_tick(uint32_t now_monotonic_ms);
#endif
