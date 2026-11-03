#include "yg_voice_request.h"
#include "yg_voice_intent.h"
#include "yg_voice_light.h"
#include "iot_control_light.h"
#include "iot_control_v21.h"
#include "ljyd_method.h"
#include "cJSON.h"
#include "qm.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"
#include <string.h>
#define LOG_TAG "yg_read_req"
#define ASR_TEXT_BYTES 480
static QueueHandle_t s_queue;
typedef struct {int action;char text[ASR_TEXT_BYTES+1];} asr_msg_t;
static void worker(void *arg){
 (void)arg;
 asr_msg_t msg;
 for(;;){
  if(xQueueReceive(s_queue,&msg,portMAX_DELAY)!=pdTRUE)continue;
  if(msg.action!=0){
   if(msg.action==YG_VOICE_POWER_ON||msg.action==YG_VOICE_POWER_OFF){
    iot_control_light_set_local(msg.action==YG_VOICE_POWER_ON);
   }else{
    const char *preset=msg.action==YG_VOICE_PREVIEW_MISS?"miss":
     msg.action==YG_VOICE_PREVIEW_MEAL?"meal":
     msg.action==YG_VOICE_PREVIEW_REST?"rest":
     msg.action==YG_VOICE_PREVIEW_CHEER?"cheer":NULL;
    if(preset)(void)yg_iot_preview_local(preset);
   }
   memset(&msg,0,sizeof(msg));continue;
  }
  cJSON *root=cJSON_CreateObject();
  if(root){
   cJSON_AddStringToObject(root,"source","device_asr_final");
   cJSON_AddStringToObject(root,"transcript",msg.text);
   char *json=cJSON_PrintUnformatted(root);
   if(json){
    int ret=ljyd_method_up("care","readRequested",json);
    QM_LOGI(LOG_TAG,"voice read requested ret=%d",ret);
    cJSON_free(json);
   }
   cJSON_Delete(root);
  }
  memset(&msg,0,sizeof(msg));
 }
}
void yg_voice_request_on_asr_final(const char *text){
 const bool read=yg_voice_read_intent(text);
 const yg_voice_light_action_t action=read?YG_VOICE_LIGHT_NONE:yg_voice_light_intent(text);
 if(!read&&action==YG_VOICE_LIGHT_NONE)return;
 if(!s_queue){
  s_queue=xQueueCreate(2,sizeof(asr_msg_t));
  if(!s_queue)return;
  if(xTaskCreate(worker,"yg_voice_up",4096,NULL,4,NULL)!=pdPASS){
   vQueueDelete(s_queue);s_queue=NULL;return;
  }
 }
 asr_msg_t msg={0};
 if(read){strncpy(msg.text,text,ASR_TEXT_BYTES);msg.action=0;}
 else msg.action=(int)action; /* Do not store raw speech for local light actions. */
 (void)xQueueSend(s_queue,&msg,0);
}
