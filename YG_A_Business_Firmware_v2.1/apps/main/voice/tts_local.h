#ifndef TTS_LOCAL_H
#define TTS_LOCAL_H

#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

/* 创建队列与合成任务（不做合成，首次 tts_local_speak 才初始化语音库）。 */
esp_err_t tts_local_init(void);

/* 异步播报一段中文文本；文本会被复制进队列，调用方可立即返回。 */
esp_err_t tts_local_speak(const char *text);

#ifdef __cplusplus
}
#endif

#endif
