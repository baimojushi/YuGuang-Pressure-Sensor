#ifndef IOT_CONTROL_V21_H
#define IOT_CONTROL_V21_H
#include "qm_spec_api.h"
#include <stdbool.h>
#include <stdint.h>
#define YG_SIID 19
#define YG_LIGHT_PREVIEW_PIID 7 /* optional cloud extension, must be registered first */
/* Returns a preview frame. Only H5-owned test previews; never creates a care ACK. */
bool yg_iot_preview_frame(uint32_t now_ms,uint8_t rgb[3]);
void yg_iot_preview_cancel(void);
/* Local ASR preview from an existing authenticated audio session; no cloud property. */
bool yg_iot_preview_local(const char *preset);
int iot_control_v21_set(qm_spec_property_t *property);
void iot_control_v21_report(void);
#endif
