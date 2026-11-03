/* V2.1: LED is rendered solely from local BLE guidance; no radar in A. */
#include "led_status.h"
#include "bsp_ws2812.h"
#include "iot_control_light.h"
#include "yg_a_app.h"
#include "yg_care.h"
#include "yg_breath_led.h"
#include "iot_control_v21.h"
#include "qm_log.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include <math.h>
#define LED_PERIOD_MS 50u
#define TAG "yg-led"
static uint8_t ramp(uint32_t now,uint32_t period){
 if(!period){
  return 0;
 }
 uint32_t t=now%period,half=period/2;
 if(!half){
  return 0;
 }
 if(t>half){
  t=period-t;
 }
 return (uint8_t)(t*255U/half);
}
static void led_task(void *p){
 (void)p;
 uint8_t previous_mode=0;
 for(;;){
  vTaskDelay(pdMS_TO_TICKS(LED_PERIOD_MS));
  uint32_t now=(uint32_t)(esp_timer_get_time()/1000ULL);
  if(!iot_control_light_care_allowed()){
   (void)bsp_ws2812_clear();previous_mode=0;continue;
  }
  yg_a_snapshot_t s;yg_a_app_get(&s);
  if(s.guidance.focus){
   if(iot_control_light_is_on()){
    if(previous_mode!=4)iot_control_light_restore();
    previous_mode=4;
   }else{(void)bsp_ws2812_clear();previous_mode=0;}
   continue;
  }
  uint8_t rgb[3]={0};
  if(yg_breath_led_frame(&s,now,rgb,NULL)){
   (void)bsp_ws2812_fill(rgb[0],rgb[1],rgb[2]);previous_mode=1;continue;
  }
  uint8_t reply_brightness=0;
  if(yg_care_reply_glow(&reply_brightness)){
   (void)bsp_ws2812_fill(reply_brightness,
     (uint8_t)(reply_brightness/2),(uint8_t)(reply_brightness/5));
   previous_mode=2;continue;
  }
  if(yg_care_lamp_active()){
   if(yg_care_render_rgb(rgb)&&bsp_ws2812_fill(rgb[0],rgb[1],rgb[2])==QM_EOK)
    yg_care_mark_lamp_drawn();
   previous_mode=2;continue;
  }
  if(yg_iot_preview_frame(now,rgb)){
   (void)bsp_ws2812_fill(rgb[0],rgb[1],rgb[2]);previous_mode=3;continue;
  }
  if(iot_control_light_is_on()){
   if(previous_mode!=4)iot_control_light_restore();
   previous_mode=4;continue;
  }
  uint8_t a=ramp(now,6000u);
  if(!s.ble_connected)
   (void)bsp_ws2812_fill(0,0,(uint8_t)(3+a/14));
  else
   (void)bsp_ws2812_fill(0,(uint8_t)(6+a/16),(uint8_t)(8+a/11));
  previous_mode=5;
 }
}
esp_err_t led_status_start(void){
 static TaskHandle_t task;if(task)return ESP_OK;
 return xTaskCreate(led_task,"yg_led",4096,NULL,3,&task)==pdPASS?ESP_OK:ESP_ERR_NO_MEM;
}
