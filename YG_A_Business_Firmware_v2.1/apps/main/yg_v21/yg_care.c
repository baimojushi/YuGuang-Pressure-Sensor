/* Device-side care acknowledgement. One message -> one UUID, durable retry. */
#include "yg_care.h"
#include "yg_a_app.h"
#include "iot_control_light.h"
#include "ljyd_method.h"
#include "nvs.h"
#include "esp_random.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "qm_log.h"
#include <string.h>
#include <stdio.h>
#include <time.h>
#include <sys/time.h>
#include <inttypes.h>
#include <ctype.h>
#define TAG "yg-care"
#define MAX_WINDOW_MS 120000u
#define RETRY_MS 5000u
/* Monotonic lifetime only for armed display; UTC timestamp persisted for pending. */
typedef struct {
 uint8_t phase; /* 0 idle; 1 armed; 2 pending server receipt */
 char message_id[129];
 char device_id[129];
 char event_id[37];
 uint64_t occurred_at_ms;
 uint32_t expires_ms;
 uint32_t last_send_ms;
} care_state_t;
static care_state_t s;
/* 这些是仅运行期状态，不写入持久化 NVS blob，避免破坏旧待确认事务。 */
static bool s_displayed;
static uint32_t s_reply_until_ms;
static yg_care_light_t s_light;
static bool s_light_valid;
static uint32_t s_light_started_ms;
/* Runtime render event; never included in the legacy NVS ACK blob layout. */
static char s_command_id[129];
static uint64_t s_rendered_at_ms;
static uint32_t s_render_last_sent_ms;
static bool light_valid(const yg_care_light_t *light){
 if(!light)return false;
 return light->color_count>=1&&light->color_count<=2&&light->pattern>=1&&
  light->pattern<=3&&light->brightness_pct>=1&&light->brightness_pct<=18&&
  light->period_ms>=500&&light->period_ms<=12000&&
  light->cycles>=1&&light->cycles<=5&&light->duration_ms>=500&&
  light->duration_ms<=120000&&
  (uint64_t)light->period_ms*light->cycles==light->duration_ms;
}

static char last_message_id[129];
static portMUX_TYPE guard=portMUX_INITIALIZER_UNLOCKED;
static bool safe_id(const char *id){
 if(!id||!id[0])return false;
 size_t len=strnlen(id,129);if(len==0||len>128)return false;
 for(size_t i=0;i<len;++i){unsigned char c=(unsigned char)id[i];
  if(!((c>='a'&&c<='z')||(c>='A'&&c<='Z')||(c>='0'&&c<='9')||c=='_'||c=='-'))return false;}
 return true;
}
static uint64_t epoch_ms(void){
 struct timeval tv;
 if(gettimeofday(&tv,NULL)!=0||tv.tv_sec<=1600000000)return 0;
 return (uint64_t)tv.tv_sec*1000u+(uint64_t)tv.tv_usec/1000u;
}
static bool care_display_allowed(void){
 yg_a_snapshot_t a; yg_a_app_get(&a);
 return !a.guidance.focus && a.guidance.state==YG_IDLE &&
        iot_control_light_care_allowed();
}
static void persist_pending(void){
 nvs_handle_t h;if(nvs_open("yg_care",NVS_READWRITE,&h)!=ESP_OK)return;
 if(s.phase==2)nvs_set_blob(h,"pending",&s,sizeof(s));else nvs_erase_key(h,"pending");
 nvs_set_str(h,"last",last_message_id);nvs_commit(h);nvs_close(h);
}
int yg_care_init(void){
 nvs_handle_t h;memset(&s,0,sizeof(s));s_displayed=false;s_reply_until_ms=0;s_light_valid=false;s_light_started_ms=0;
 memset(s_command_id,0,sizeof(s_command_id));s_rendered_at_ms=0;s_render_last_sent_ms=0;
 if(nvs_open("yg_care",NVS_READWRITE,&h)!=ESP_OK)return -1;
 size_t n=sizeof(last_message_id);(void)nvs_get_str(h,"last",last_message_id,&n);
 n=sizeof(s);if(nvs_get_blob(h,"pending",&s,&n)==ESP_OK){
  if(n!=sizeof(s)||s.phase!=2||!safe_id(s.message_id)||!safe_id(s.device_id)||
     s.event_id[36]!='\0'||s.occurred_at_ms==0){memset(&s,0,sizeof(s));}
 }
 nvs_close(h);yg_a_app_care_active(s.phase==1);return 0;
}
bool yg_care_arm_light(const char *message_id,const char *device_id,uint32_t window_ms,
                       const yg_care_light_t *light){
 if(!safe_id(message_id)||!safe_id(device_id)||window_ms<100||window_ms>MAX_WINDOW_MS||
    (light&&(!light_valid(light)||light->duration_ms>window_ms))||
    !epoch_ms()||!care_display_allowed())return false;
 bool ok=false;uint32_t now=(uint32_t)(esp_timer_get_time()/1000ULL);
 portENTER_CRITICAL(&guard);
 if(s.phase==0&&strcmp(last_message_id,message_id)!=0){
  memset(&s,0,sizeof(s));s.phase=1;s_displayed=false;s_reply_until_ms=0;
  s_command_id[0]='\0';s_rendered_at_ms=0;s_render_last_sent_ms=now-RETRY_MS;
  s_light_valid=(light!=NULL);
  if(light) s_light=*light;
  else memset(&s_light,0,sizeof(s_light));
  s_light_started_ms=now;
  strncpy(s.message_id,message_id,sizeof(s.message_id)-1);
  strncpy(s.device_id,device_id,sizeof(s.device_id)-1);
  s.expires_ms=now+window_ms;ok=true;
 }
 portEXIT_CRITICAL(&guard);
 if(ok){yg_a_app_care_active(true);QM_LOGI(TAG,"armed for %u ms",(unsigned)window_ms);}return ok;
}
bool yg_care_bind_command(const char *command_id){
 if(!safe_id(command_id))return false;
 bool ok=false;
 portENTER_CRITICAL(&guard);
 if(s.phase==1){strncpy(s_command_id,command_id,sizeof(s_command_id)-1);ok=true;}
 portEXIT_CRITICAL(&guard);
 return ok;
}
bool yg_care_arm(const char *message_id,const char *device_id,uint32_t window_ms){
 return yg_care_arm_light(message_id,device_id,window_ms,NULL);
}
bool yg_care_lamp_active(void){
 bool active;uint32_t now=(uint32_t)(esp_timer_get_time()/1000ULL);
 portENTER_CRITICAL(&guard);
 active=s.phase==1&&(int32_t)(s.expires_ms-now)>0&&
   (!s_light_valid||(uint32_t)(now-s_light_started_ms)<s_light.duration_ms);
 portEXIT_CRITICAL(&guard);return active&&care_display_allowed();
}
bool yg_care_render_rgb(uint8_t rgb[3]){
 if(!rgb||!yg_care_lamp_active())return false;
 yg_care_light_t fx;bool has_fx;uint32_t started;
 portENTER_CRITICAL(&guard);
 fx=s_light;has_fx=s_light_valid;started=s_light_started_ms;
 portEXIT_CRITICAL(&guard);
 if(!has_fx){rgb[0]=24;rgb[1]=11;rgb[2]=8;return true;}
 uint32_t now=(uint32_t)(esp_timer_get_time()/1000ULL);
 uint32_t elapsed=(uint32_t)(now-started);
 if(elapsed>=fx.duration_ms)return false;
 uint32_t phase=(elapsed%fx.period_ms)*2000U/fx.period_ms;
 uint32_t rise=(phase<=1000U)?phase:2000U-phase;
 uint32_t level=200U+rise*800U/1000U;
 if(fx.pattern==3)level=1000U-rise*700U/1000U;
 if(fx.pattern==2)level=100U+rise*900U/1000U;
 uint32_t palette=(elapsed/fx.period_ms)%fx.color_count;
 for(int c=0;c<3;c++){
  uint32_t v=(uint32_t)fx.rgb[palette][c]*fx.brightness_pct*level;
  rgb[c]=(uint8_t)(v/(100U*1000U));
 }
 return true;
}
void yg_care_mark_lamp_drawn(void){
 if(!care_display_allowed())return;
 uint32_t now=(uint32_t)(esp_timer_get_time()/1000ULL);
 uint64_t utc=epoch_ms(); /* call outside spinlock */
 portENTER_CRITICAL(&guard);
 if(s.phase==1&&(int32_t)(s.expires_ms-now)>0){
  s_displayed=true;
  if(s_rendered_at_ms==0)s_rendered_at_ms=utc;
 }
 portEXIT_CRITICAL(&guard);
}
void yg_care_cancel_display(void){
 bool cancelled=false;
 portENTER_CRITICAL(&guard);
 if(s.phase==1){memset(&s,0,sizeof(s));cancelled=true;}
 s_displayed=false;s_reply_until_ms=0;s_light_valid=false;
 s_command_id[0]='\0';s_rendered_at_ms=0;
 portEXIT_CRITICAL(&guard);
 if(cancelled)yg_a_app_care_active(false);
}
bool yg_care_reply_glow(uint8_t *brightness){
 if(!brightness||!care_display_allowed())return false;
 uint32_t now=(uint32_t)(esp_timer_get_time()/1000ULL),remaining=0;
 portENTER_CRITICAL(&guard);
 if(s_reply_until_ms&&(int32_t)(s_reply_until_ms-now)>0)
  remaining=(uint32_t)(s_reply_until_ms-now);
 portEXIT_CRITICAL(&guard);
 if(remaining==0||remaining>900)return false;
 uint32_t elapsed=900-remaining,triangle=elapsed<=450?elapsed:900-elapsed;
 *brightness=(uint8_t)(8+triangle*32/450);
 return true;
}
void yg_care_ir_high(uint64_t ignored){
 (void)ignored;
 if(!yg_care_lamp_active())return;
 uint64_t utc=epoch_ms();if(!utc)return;
 uint32_t now=(uint32_t)(esp_timer_get_time()/1000ULL);
 uint8_t uuid[16];esp_fill_random(uuid,sizeof(uuid));uuid[6]=(uuid[6]&0x0f)|0x40;uuid[8]=(uuid[8]&0x3f)|0x80;
 bool fire=false;
 portENTER_CRITICAL(&guard);
 if(s.phase==1&&s_displayed&&(int32_t)(s.expires_ms-now)>0){
  s.phase=2;s_displayed=false;s_reply_until_ms=now+900u;
  s.occurred_at_ms=utc;s.last_send_ms=now-RETRY_MS;
  (void)snprintf(s.event_id,sizeof(s.event_id),
  "%02x%02x%02x%02x-%02x%02x-%02x%02x-%02x%02x-%02x%02x%02x%02x%02x%02x",
   uuid[0],uuid[1],uuid[2],uuid[3],uuid[4],uuid[5],uuid[6],uuid[7],
   uuid[8],uuid[9],uuid[10],uuid[11],uuid[12],uuid[13],uuid[14],uuid[15]);fire=true;
 }
 portEXIT_CRITICAL(&guard);
 if(fire){persist_pending();yg_a_app_care_active(false);QM_LOGI(TAG,"IR high -> durable ack pending");}
}
bool yg_care_confirm(const char *event_id,const char *message_id){
 if(!event_id||!message_id)return false;
 bool accepted=false;
 portENTER_CRITICAL(&guard);
 if(s.phase==2&&strcmp(s.event_id,event_id)==0&&strcmp(s.message_id,message_id)==0){
  strncpy(last_message_id,s.message_id,sizeof(last_message_id)-1);
  memset(&s,0,sizeof(s));accepted=true;
 }
 portEXIT_CRITICAL(&guard);
 if(accepted){
  portENTER_CRITICAL(&guard);s_command_id[0]='\0';s_rendered_at_ms=0;portEXIT_CRITICAL(&guard);
  persist_pending();yg_a_app_care_active(false);QM_LOGI(TAG,"server committed ack");
 }
 return accepted;
}
void yg_care_tick(uint32_t now){
 care_state_t snapshot;bool end=false,send=false,send_render=false;
 char command_id[129]={0};uint64_t rendered_at=0;
 portENTER_CRITICAL(&guard);
 if(s.phase==1&&(int32_t)(now-s.expires_ms)>=0){
  memset(&s,0,sizeof(s));s_displayed=false;s_command_id[0]='\0';
  s_rendered_at_ms=0;s_render_last_sent_ms=0;end=true;
 }
 if(s.phase==2&&(uint32_t)(now-s.last_send_ms)>=RETRY_MS){s.last_send_ms=now;send=true;}
 if(s.phase!=0&&s_rendered_at_ms!=0&&s_command_id[0]!=0&&
    (uint32_t)(now-s_render_last_sent_ms)>=RETRY_MS){
  s_render_last_sent_ms=now;send_render=true;
  strncpy(command_id,s_command_id,sizeof(command_id)-1);
  rendered_at=s_rendered_at_ms;
 }
 snapshot=s;
 portEXIT_CRITICAL(&guard);
 if(end)yg_a_app_care_active(false);
 if(send_render){
  char body[730];
  int n=snprintf(body,sizeof(body),
   "{\"schema_version\":\"YG-IFACE-2.1.0\",\"type\":\"care_displayed\","
   "\"command_id\":\"%s\",\"message_id\":\"%s\","
   "\"device_id\":\"%s\",\"rendered_at_ms\":%" PRIu64 "}",
   command_id,snapshot.message_id,snapshot.device_id,rendered_at);
  if(n>0&&(size_t)n<sizeof(body))(void)ljyd_method_up("care","displayed",body);
 }
 if(send){
  /* Fixed frozen semantic body; SDK handles envelope and TLS; adapter signs Web hop. */
  char payload[540];
  int n=snprintf(payload,sizeof(payload),
   "{\"schema_version\":\"YG-IFACE-2.1.0\",\"type\":\"care_ack\","
   "\"event_id\":\"%s\",\"message_id\":\"%s\",\"device_id\":\"%s\","
   "\"source\":\"gpio5_ir\",\"ack_type\":\"received\",\"reply_text\":\"收到了\","
   "\"occurred_at_ms\":%" PRIu64 "}",snapshot.event_id,snapshot.message_id,
   snapshot.device_id,snapshot.occurred_at_ms);
  if(n>0&&(size_t)n<sizeof(payload)){
   /* Deployment adapter must map care/ack -> signed bridge; SDK method is configurable. */
   (void)ljyd_method_up("care","ack",payload);
  }
 }
}
