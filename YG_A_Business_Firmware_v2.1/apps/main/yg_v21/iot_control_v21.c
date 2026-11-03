#include "iot_control_v21.h"
#include "yg_a_app.h"
#include "yg_a_ble.h"
#include "yg_a_uart_fallback.h"
#include "yg_care.h"
#include "yg_preview_lamp.h"
#include "iot_control_light.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "cJSON.h"
#include <stdio.h>
#include "ljyd_cloud.h"
#include "qm.h"
#include "qm_iot_api.h"
#include "qm_spec_api.h"
#include <string.h>
#define TAG "yg-v21"
static portMUX_TYPE s_preview_mux=portMUX_INITIALIZER_UNLOCKED;
static yg_preview_lamp_t s_preview;
void yg_iot_preview_cancel(void){
 portENTER_CRITICAL(&s_preview_mux);
 yg_preview_cancel(&s_preview);
 portEXIT_CRITICAL(&s_preview_mux);
}
bool yg_iot_preview_frame(uint32_t now,uint8_t rgb[3]){
 yg_preview_lamp_t copy;
 portENTER_CRITICAL(&s_preview_mux);copy=s_preview;portEXIT_CRITICAL(&s_preview_mux);
 return yg_preview_render(&copy,now,rgb);
}
bool yg_iot_preview_local(const char *preset){
 yg_a_snapshot_t snapshot;yg_a_app_get(&snapshot);
 if(!iot_control_light_care_allowed()||snapshot.guidance.focus||
    snapshot.guidance.state!=YG_IDLE||yg_care_lamp_active())return false;
 uint32_t now=(uint32_t)(esp_timer_get_time()/1000ULL);
 char nonce[41];
 static uint32_t voice_seq;
 uint32_t seq;
 portENTER_CRITICAL(&s_preview_mux);seq=++voice_seq;portEXIT_CRITICAL(&s_preview_mux);
 (void)snprintf(nonce,sizeof(nonce),"voice%08lx%08lx",(unsigned long)now,(unsigned long)seq);
 bool ok;
 portENTER_CRITICAL(&s_preview_mux);
 ok=yg_preview_apply(&s_preview,preset,nonce,now);
 portEXIT_CRITICAL(&s_preview_mux);
 return ok;
}
/* The property is a strict, bounded, repeat-safe UI preview command, not a sender message. */
static int light_preview_set(qm_spec_property_t *property){
 char *source=NULL;int len=0;
 if(qm_spec_property_unpack_string_direct(property,&source,&len)!=QM_EOK||
    !source||len<2||len>127)return -QM_EINVAL;
 char input[128];memcpy(input,source,(size_t)len);input[len]='\0';
 cJSON *root=cJSON_Parse(input);
 if(!cJSON_IsObject(root)){cJSON_Delete(root);return -QM_EINVAL;}
 const cJSON *v=cJSON_GetObjectItemCaseSensitive(root,"v");
 const cJSON *preset=cJSON_GetObjectItemCaseSensitive(root,"preset");
 const cJSON *nonce=cJSON_GetObjectItemCaseSensitive(root,"nonce");
 int count=0;for(const cJSON *c=root->child;c;c=c->next)count++;
 if(count!=3||!cJSON_IsNumber(v)||v->valuedouble!=1||
    !cJSON_IsString(preset)||!cJSON_IsString(nonce)||
    !preset->valuestring||!nonce->valuestring){
  cJSON_Delete(root);return -QM_EINVAL;
 }
 yg_a_snapshot_t snapshot;yg_a_app_get(&snapshot);
 if(!iot_control_light_care_allowed()||snapshot.guidance.focus||
    snapshot.guidance.state!=YG_IDLE||yg_care_lamp_active()){
  cJSON_Delete(root);return -QM_EINVAL;
 }
 uint32_t now=(uint32_t)(esp_timer_get_time()/1000ULL);
 bool ok;
 portENTER_CRITICAL(&s_preview_mux);
 ok=yg_preview_apply(&s_preview,preset->valuestring,nonce->valuestring,now);
 portEXIT_CRITICAL(&s_preview_mux);
 cJSON_Delete(root);
 return ok?QM_EOK:-QM_EINVAL;
}
static void add_bool(qm_spec_property_operation_t *op,uint16_t piid,bool val){
 qm_spec_property_t *p=qm_spec_property_creat();if(!p)return;
 qm_spec_property_pack_xiid(p,YG_SIID,piid);qm_spec_property_pack_bool(p,(bool_t)(val?1:0));qm_spec_property_add(op,p);
}
static void add_number(qm_spec_property_operation_t *op,uint16_t piid,uint16_t val){
 qm_spec_property_t *p=qm_spec_property_creat();if(!p)return;
 qm_spec_property_pack_xiid(p,YG_SIID,piid);qm_spec_property_pack_number(p,val);qm_spec_property_add(op,p);
}
static void add_string(qm_spec_property_operation_t *op,uint16_t piid,const char *value){
 qm_spec_property_t *p=qm_spec_property_creat();if(!p)return;
 qm_spec_property_pack_xiid(p,YG_SIID,piid);qm_spec_property_pack_string(p,(char *)value,(int)strlen(value));qm_spec_property_add(op,p);
}
void iot_control_v21_report(void){
 void *iot=ljyd_cloud_get_handle();if(!iot)return;
 yg_a_snapshot_t s;yg_a_app_get(&s);
 qm_spec_property_operation_t *op=qm_spec_property_operation_creat();if(!op)return;
 add_bool(op,1,s.guidance.enabled);
 add_string(op,2,yg_guidance_state_name(s.guidance.state));
 add_number(op,3,yg_guidance_period_100ms(&s.guidance));
 add_bool(op,4,yg_a_app_demo_desired());
 add_string(op,5,yg_a_uart_fallback_active()?"connected":yg_a_ble_state());
 add_bool(op,6,false); /* 19.6 self-clear; readback never latches true. */
 int ret=qm_iot_report(iot,op);
 if(ret!=QM_EOK){qm_spec_property_operation_delete(op);QM_LOGW(TAG,"v21 state report fail %d",ret);}
 else QM_LOGI(TAG,"v21 report ok enabled=%d demo=%d state=%s link=%s",
   (int)s.guidance.enabled,(int)yg_a_app_demo_desired(),
   yg_guidance_state_name(s.guidance.state),
   yg_a_uart_fallback_active()?"uart-fallback":yg_a_ble_state());
}
int iot_control_v21_set(qm_spec_property_t *property){
 if(!property||property->siid!=YG_SIID)return -QM_EINVAL;
 if(property->piid==YG_LIGHT_PREVIEW_PIID)return light_preview_set(property);
 bool_t v=0;
 if(property->piid!=1&&property->piid!=4&&property->piid!=6){return -QM_EINVAL;}
 if(qm_spec_property_unpack_bool(property,&v)!=QM_EOK)return -QM_EINVAL;
 switch(property->piid){
  case 1: yg_a_app_companion_enable(v!=0);break;
  case 4: yg_a_app_demo_intent(v!=0);break;
  case 6: if(v){(void)yg_a_app_relax_request();}break;
 }
 iot_control_v21_report();return QM_EOK;
}
