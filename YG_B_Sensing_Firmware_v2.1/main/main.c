/* Sensing board B — no Lingji MQTT, account, partner data, audio, or LED. */
#include "radar_ld6002.h"
#include "yg_b_ble.h"
#include "yg_b_uart_fallback.h"
#include "yg_iface.h"
#include "yg_fusion.h"
#include "yg_b_sensor_inputs.h"
#include "bsp_camera.h"
#include "pose_runtime_b.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "esp_random.h"
#include "driver/gpio.h"
#include "nvs_flash.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include <string.h>
#include <math.h>
#define TAG "yg-b"
static yg_fusion_t fusion;
/* Inputs are invalid until validated posture, respiration and focus models
 * supply normalized scores. Never fabricate missing camera/pose results. */
static yg_fusion_input_t inputs;
static portMUX_TYPE inputs_guard=portMUX_INITIALIZER_UNLOCKED;
static uint32_t inputs_received_ms;
static uint32_t boot_id;
static uint16_t breath_seq,event_seq;
static uint32_t button_down;
static bool opened;
static uint32_t ms(void){return (uint32_t)(esp_timer_get_time()/1000ULL);}
/* Hook for validated on-board models; consumer must observe quality gating. */
void yg_b_set_load_inputs(const yg_fusion_input_t *v){
 if(!v)return;
 portENTER_CRITICAL(&inputs_guard);
 inputs=*v;inputs_received_ms=(uint32_t)(esp_timer_get_time()/1000ULL);
 portEXIT_CRITICAL(&inputs_guard);
}
static void task(void *p){
 (void)p;uint32_t last_status=0,last_fusion=0;
 for(;;){
  vTaskDelay(pdMS_TO_TICKS(200));uint32_t now=ms();
  /* GPIO14 held LOW for 2s opens one local BLE pairing window. */
  if(gpio_get_level(GPIO_NUM_14)==0){
   if(!button_down)button_down=now;
   if(!opened&&(uint32_t)(now-button_down)>=2000){yg_b_ble_pair_window(120);opened=true;}
  }else{button_down=0;opened=false;}
  yg_fusion_input_t local;
  uint32_t received;
  portENTER_CRITICAL(&inputs_guard);
  local=inputs;received=inputs_received_ms;
  portEXIT_CRITICAL(&inputs_guard);
  /* An external model must refresh all calibrated inputs within 1.5 seconds. */
  if(!received||(uint32_t)(now-received)>1500){
    local.r_ok=local.p_ok=local.f_ok=false;
  }
  /* 板载姿态模型：有新鲜判定时以板上结果作为 P；无判定则保持 p_ok=false，
   * 不伪造缺失数据（README 第 1 条）。 */
  float pose_p=0.0f;
  if(pose_runtime_b_indicator(&pose_p,1500)){local.p=pose_p;local.p_ok=true;}
  radar_snapshot_t r={0};radar_ld6002_snapshot(&r);
  bool fresh=r.ready&&r.human==1&&r.last_phase_ms!=0&&
   (uint32_t)(now-r.last_phase_ms)<700;
  bool rate_ok=fresh&&isfinite(r.br)&&r.br>=6.0f&&r.br<=35.0f&&
    (strcmp(r.q,"ok")==0||strcmp(r.q,"module")==0);
  /* No reliable orientation calibration in baseline: stage remains UNKNOWN. */
  yg_breath_t b={0};b.seq=++breath_seq;b.uptime_ms=now;
  b.stage=0;b.progress_permille=65535;
  b.sample_age_ms=r.last_phase_ms?(uint16_t)fminf(65535.0f,(float)(uint32_t)(now-r.last_phase_ms)):65535;
  if(fresh&&isfinite(r.hil_ph)){
   float wave=fmaxf(-1.0f,fminf(1.0f,r.hil_ph/0.3f));
   b.wave_q15=(int16_t)(wave*32767.0f);b.flags|=YG_FLAG_WAVE;
  }
  if(rate_ok){b.flags|=YG_FLAG_BPM;
   b.bpm_x10=(uint16_t)(r.br*10.0f+0.5f);
   /* Conservative confidence estimate: uncalibrated module -> lower bound. */
   b.confidence_pct=(uint8_t)(strcmp(r.q,"module")==0?65:fmaxf(0,fminf(100,r.conf*100)));
   b.flags|=YG_FLAG_CONFIDENCE;
  }
  yg_b_ble_send_breath(&b);
  yg_b_uart_send_breath(&b);
  if((uint32_t)(now-last_status)>=1000){
   last_status=now;yg_status_t s={0};s.boot_id=boot_id;s.uptime_ms=now;
   s.radar=fresh?1:0;s.pose=local.p_ok?1:0;
   s.fusion=(local.r_ok&&local.p_ok&&local.f_ok)?1:0;
   s.demo_auth=0; /* Demo API disabled until explicit local consent */
   s.dropped=(uint16_t)(r.crc_errors>65535?65535:r.crc_errors);
   s.phase_hz_x10=(uint16_t)(r.fs>0?fminf(65535,r.fs*10.0f):0);
   yg_b_ble_send_status(&s);
   yg_b_uart_send_status(&s);
  }
  if((uint32_t)(now-last_fusion)>=1000){
   last_fusion=now;
   if(yg_fusion_step(&fusion,&local,now)){
    yg_pressure_t e={.event_id=esp_random()|1U,.seq=++event_seq,.uptime_ms=now,
      .score_x10=(uint16_t)(fusion.score*10.0f),.confidence_pct=75,
      .ttl_ms=10000,.flags=0};
    yg_b_ble_queue_pressure(&e);
    yg_b_uart_send_pressure(&e);
   }
  }
  yg_b_ble_poll(now);
 }
}
void app_main(void){
 esp_err_t e=nvs_flash_init();
 if(e==ESP_ERR_NVS_NO_FREE_PAGES||e==ESP_ERR_NVS_NEW_VERSION_FOUND){
  ESP_ERROR_CHECK(nvs_flash_erase());e=nvs_flash_init();
 }
 ESP_ERROR_CHECK(e);
 yg_fusion_init(&fusion);
 gpio_config_t pair_button={.pin_bit_mask=1ULL<<GPIO_NUM_14,.mode=GPIO_MODE_INPUT,
   .pull_up_en=GPIO_PULLUP_ENABLE,.pull_down_en=GPIO_PULLDOWN_DISABLE,.intr_type=GPIO_INTR_DISABLE};
 ESP_ERROR_CHECK(gpio_config(&pair_button));
 boot_id=esp_random();if(!boot_id)boot_id=1;
 /* 姿态：先读模型（必须早于开流，避免读 Flash 与取流并发），再开摄像头流供推理循环取帧。 */
 if(pose_runtime_b_init()!=ESP_OK)ESP_LOGE(TAG,"pose init failed");
 if(bsp_camera_early_init()!=ESP_OK)ESP_LOGE(TAG,"camera early init failed");
 if(bsp_camera_stream_start()!=ESP_OK)ESP_LOGE(TAG,"camera stream start failed");
 ESP_ERROR_CHECK(radar_ld6002_start());
 ESP_ERROR_CHECK(yg_b_uart_fallback_start());
 ESP_ERROR_CHECK(yg_b_ble_start());
 if(xTaskCreate(task,"yg_sensor",6144,NULL,4,NULL)!=pdPASS)ESP_LOGE(TAG,"sensor task create fail");
 ESP_LOGI(TAG,"v2.1 B sensor boot=%u: radar GPIO%d; no private-data uplink",(unsigned)boot_id,RADAR_RX_GPIO);
}
