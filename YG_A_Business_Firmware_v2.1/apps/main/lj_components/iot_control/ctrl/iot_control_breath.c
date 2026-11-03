/* 10.3 owner-only measured rate. No raw stream or pressure score in cloud. */
#include "iot_control_breath.h"
#include "yg_a_app.h"
#include "ljyd_cloud.h"
#include "qm.h"
#include "qm_iot_api.h"
#include "qm_spec_api.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_timer.h"
#include <stdlib.h>
#include <string.h>
#define TAG "breath-shadow"
static uint8_t started;
static void append_number(qm_spec_property_operation_t *op,uint16_t piid,int v){
 qm_spec_property_t *p=qm_spec_property_creat();if(!p)return;
 qm_spec_property_pack_xiid(p,10,piid);qm_spec_property_pack_number(p,v);qm_spec_property_add(op,p);
}
static void append_string(qm_spec_property_operation_t *op,uint16_t piid,const char *v){
 qm_spec_property_t *p=qm_spec_property_creat();if(!p)return;
 qm_spec_property_pack_xiid(p,10,piid);qm_spec_property_pack_string(p,(char *)v,(int)strlen(v));qm_spec_property_add(op,p);
}
static void breath_report(void *arg){
 (void)arg;int previous_ok=-1,previous_bpm10=-1;
 uint32_t sent_ms=0;
 for(;;){vTaskDelay(pdMS_TO_TICKS(1000));
  uint32_t now=(uint32_t)(esp_timer_get_time()/1000ULL);
  int bpm10=yg_a_app_bpm_x10();int ok=(bpm10>0);
  bool changed=ok&&(previous_bpm10<0||abs(bpm10-previous_bpm10)>=5);
  bool due=(previous_ok<0||ok!=previous_ok)||
   (ok&&((uint32_t)(now-sent_ms)>=60000 || (changed&&(uint32_t)(now-sent_ms)>=10000)));
  if(!due)continue;
  void *iot=ljyd_cloud_get_handle();if(!iot)continue;
  qm_spec_property_operation_t *op=qm_spec_property_operation_creat();if(!op)continue;
  if(ok)append_number(op,3,(bpm10+5)/10); /* v2 10.3 is integer BPM */
  append_string(op,4,ok?"ok":"no_signal");
  int ret=qm_iot_report(iot,op);
  if(ret!=QM_EOK){qm_spec_property_operation_delete(op);QM_LOGW(TAG,"report failed %d",ret);continue;}
  previous_ok=ok;previous_bpm10=ok?bpm10:-1;sent_ms=now;
 }
}
int iot_control_breath_start(void){
 if(started)return QM_EOK;
 if(xTaskCreate(breath_report,"yg_breath_cloud",4096,NULL,3,NULL)!=pdPASS)return -QM_EIO;
 started=1;return QM_EOK;
}
