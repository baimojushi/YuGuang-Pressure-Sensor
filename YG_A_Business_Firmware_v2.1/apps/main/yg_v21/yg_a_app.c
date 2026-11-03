#include "yg_a_app.h"
#include "yg_a_ble.h"
#include "yg_care.h"
#include "iot_control_v21.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_timer.h"
#include <string.h>
#include <math.h>
static portMUX_TYPE lock = portMUX_INITIALIZER_UNLOCKED;
static yg_a_snapshot_t state;
static bool demo_desired;
static uint32_t ms(void){return (uint32_t)(esp_timer_get_time()/1000ULL);}
void yg_a_app_get(yg_a_snapshot_t *out){
 if(!out){
  return;
 }
 portENTER_CRITICAL(&lock);
 *out=state;
 portEXIT_CRITICAL(&lock);
}
void yg_a_app_on_breath(const yg_breath_t *b){
 if(!b){
  return;
 }
 uint32_t now=ms();
 portENTER_CRITICAL(&lock);
 state.breath=*b;state.have_breath=true;state.last_breath_ms=now;
 yg_guidance_breath(&state.guidance,b,now);portEXIT_CRITICAL(&lock);
}
void yg_a_app_on_pressure(const yg_pressure_t *p){
 if(!p){
  return;
 }
 uint32_t now=ms();
 portENTER_CRITICAL(&lock);
 /* pressure_fall_start can strengthen relaxation only locally, not cloud. */
 if(!state.guidance.focus&&state.guidance.enabled&&state.guidance.state==YG_IDLE){
  (void)yg_guidance_request(&state.guidance,now);
 }
 portEXIT_CRITICAL(&lock);
}
void yg_a_app_ble_connected(bool connected,uint32_t boot_id){
 portENTER_CRITICAL(&lock);state.ble_connected=connected;
 if(!connected||state.sensor_boot_id!=boot_id){state.have_breath=false;state.last_breath_ms=0;}
 state.sensor_boot_id=connected?boot_id:0;portEXIT_CRITICAL(&lock);
}
void yg_a_app_companion_enable(bool enable){
 portENTER_CRITICAL(&lock);yg_guidance_enable(&state.guidance,enable,ms());portEXIT_CRITICAL(&lock);
}
void yg_a_app_focus(bool focus){
 portENTER_CRITICAL(&lock);yg_guidance_focus(&state.guidance,focus,ms());portEXIT_CRITICAL(&lock);
 if(focus){yg_care_cancel_display();yg_iot_preview_cancel();}
}
void yg_a_app_care_active(bool active){
 portENTER_CRITICAL(&lock);yg_guidance_set_care(&state.guidance,active);portEXIT_CRITICAL(&lock);
}
bool yg_a_app_relax_request(void){
 bool ret;portENTER_CRITICAL(&lock);ret=yg_guidance_request(&state.guidance,ms());portEXIT_CRITICAL(&lock);return ret;
}
void yg_a_app_demo_intent(bool enable){
 demo_desired=enable;yg_a_ble_control(3,enable?1:0);
}
bool yg_a_app_demo_desired(void){return demo_desired;}
int yg_a_app_bpm_x10(void){
 yg_a_snapshot_t s;yg_a_app_get(&s);uint32_t now=ms();
 if(!s.ble_connected||!s.have_breath|| (uint32_t)(now-s.last_breath_ms)>1500 ||
  !(s.breath.flags&YG_FLAG_BPM)||!(s.breath.flags&YG_FLAG_CONFIDENCE)||
  s.breath.confidence_pct<65||s.breath.sample_age_ms>1500||
  s.breath.bpm_x10<60||s.breath.bpm_x10>350)return 0;
 return s.breath.bpm_x10;
}
static void app_task(void *p){
 (void)p;uint32_t last_state=0;yg_guidance_state_t prev=YG_IDLE;uint16_t prev_period=0;bool prev_connected=false;
 for(;;){vTaskDelay(pdMS_TO_TICKS(200));uint32_t now=ms();
  portENTER_CRITICAL(&lock);yg_guidance_tick(&state.guidance,now);
  yg_guidance_state_t cur=state.guidance.state;uint16_t period=yg_guidance_period_100ms(&state.guidance);
  bool connected=state.ble_connected;
  portEXIT_CRITICAL(&lock);
  yg_care_tick(now);
  if(cur!=prev||period!=prev_period||connected!=prev_connected||(uint32_t)(now-last_state)>60000){
   iot_control_v21_report();prev=cur;prev_period=period;prev_connected=connected;last_state=now;
  }
 }
}
void yg_a_app_init(void){
 portENTER_CRITICAL(&lock);memset(&state,0,sizeof(state));yg_guidance_init(&state.guidance);portEXIT_CRITICAL(&lock);
 (void)yg_care_init();
 (void)xTaskCreate(app_task,"yg_a_state",4096,NULL,4,NULL);
}
