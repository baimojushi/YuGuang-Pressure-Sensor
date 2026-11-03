/* End-device intent and breathing guidance; no radio, cloud, or GPIO dependencies. */
#ifndef YG_GUIDANCE_H
#define YG_GUIDANCE_H
#include <stdint.h>
#include <stdbool.h>
#include "yg_iface.h"
typedef enum {YG_IDLE=0,YG_SYNCING=1,YG_GUIDING=2,YG_COOLDOWN=3} yg_guidance_state_t;
typedef struct {
  yg_guidance_state_t state;
  bool enabled,focus,care_active;
  float measured_bpm, target_bpm;
  uint32_t last_valid_ms, since_ms, last_adjust_ms;
  uint8_t valid_count;
} yg_guidance_t;
void yg_guidance_init(yg_guidance_t *g);
void yg_guidance_enable(yg_guidance_t *g,bool enabled,uint32_t now);
void yg_guidance_focus(yg_guidance_t *g,bool focus,uint32_t now);
void yg_guidance_set_care(yg_guidance_t *g,bool active);
bool yg_guidance_request(yg_guidance_t *g,uint32_t now);
void yg_guidance_breath(yg_guidance_t *g,const yg_breath_t *b,uint32_t now);
void yg_guidance_tick(yg_guidance_t *g,uint32_t now);
uint16_t yg_guidance_period_100ms(const yg_guidance_t *g);
const char *yg_guidance_state_name(yg_guidance_state_t s);
#endif
