#ifndef WAKE_WORD_H
#define WAKE_WORD_H

#include "esp_err.h"

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef void (*wake_word_cb_t)(int word_index);

/* 初始化 AFE + WakeNet，并起 fetch 任务。模型来自 model 分区（srmodels.bin）。 */
esp_err_t wake_word_init(void);

void wake_word_set_cb(wake_word_cb_t cb);

uint32_t wake_word_count(void);

#ifdef __cplusplus
}
#endif

#endif
