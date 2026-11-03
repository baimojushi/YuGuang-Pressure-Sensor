#include "ljyd_method.h"
#include "agent_app.h"
#include "qm_config.h"
#include "yg_care.h"
#include "yg_a_app.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_random.h"
#include "esp_system.h"
#include <sys/time.h>

#if defined(CONFIG_LJYD_PLAYBACK_SUPPORT) && CONFIG_LJYD_PLAYBACK_SUPPORT
#include "playback.h"
#endif

#include "cJSON.h"
#include "qm.h"
#include "qm_iot_api.h"
#include "qm_iot_mqtt.h"

#include <stdio.h>
#include <string.h>

#define LOG_TAG "method"

#define LJYD_METHOD_NEED_REPLY (1u << 0)

typedef struct {
    cJSON *root;
    cJSON *params;
    const char *method;
    const char *submethod;
    uint32_t msg_id;
    int code;
    int has_code;
} ljyd_method_ctx_t;

typedef int (*ljyd_method_fn)(const ljyd_method_ctx_t *ctx);

typedef struct {
    const char *method;
    const char *submethod; /* NULL：这个 method 下任意 subMethod */
    ljyd_method_fn action;
    unsigned flags;
} ljyd_method_entry_t;

static void *s_iot;

static int action_chat_quit(const ljyd_method_ctx_t *ctx);
static int action_care_present(const ljyd_method_ctx_t *ctx);
static int action_care_committed(const ljyd_method_ctx_t *ctx);
static int action_care_read_text(const ljyd_method_ctx_t *ctx);
static int action_voice_relax(const ljyd_method_ctx_t *ctx);
#if defined(CONFIG_LJYD_PLAYBACK_SUPPORT) && CONFIG_LJYD_PLAYBACK_SUPPORT
static int action_player_play(const ljyd_method_ctx_t *ctx);
#endif

static const ljyd_method_entry_t s_table[] = {
    {"chat", "quit", action_chat_quit, LJYD_METHOD_NEED_REPLY},
    /* The cloud adapter must register/marshal these application methods. */
    {"care", "present", action_care_present, LJYD_METHOD_NEED_REPLY},
    {"care", "ackCommitted", action_care_committed, LJYD_METHOD_NEED_REPLY},
    {"care", "readText", action_care_read_text, LJYD_METHOD_NEED_REPLY},
    {"voice", "intent", action_voice_relax, LJYD_METHOD_NEED_REPLY},
#if defined(CONFIG_LJYD_PLAYBACK_SUPPORT) && CONFIG_LJYD_PLAYBACK_SUPPORT
    {"player", "play", action_player_play, LJYD_METHOD_NEED_REPLY},
#endif
};

static int params_source_is_local(const cJSON *params)
{
    const cJSON *src;

    if (params == NULL) {
        return 0;
    }
    src = cJSON_GetObjectItemCaseSensitive(params, "source");
    return (cJSON_IsString(src) && src->valuestring != NULL &&
            strcmp(src->valuestring, "local") == 0) ? 1 : 0;
}

static int json_read_int(const cJSON *obj, const char *key, int *out)
{
    const cJSON *item;

    if (obj == NULL || key == NULL || out == NULL) {
        return 0;
    }
    item = cJSON_GetObjectItem(obj, key);
    if (cJSON_IsNumber(item)) {
        *out = (int)item->valuedouble;
        return 1;
    }
    if (cJSON_IsString(item) && item->valuestring != NULL &&
        item->valuestring[0] != '\0') {
        return sscanf(item->valuestring, "%d", out) == 1;
    }
    return 0;
}

#if defined(CONFIG_LJYD_PLAYBACK_SUPPORT) && CONFIG_LJYD_PLAYBACK_SUPPORT
static int json_read_u32(const cJSON *obj, const char *key, uint32_t *out)
{
    int value;

    if (out == NULL || !json_read_int(obj, key, &value) || value < 0) {
        return 0;
    }
    *out = (uint32_t)value;
    return 1;
}
#endif

static const ljyd_method_entry_t *table_find(const char *method, const char *submethod)
{
    size_t i;
    const ljyd_method_entry_t *wild = NULL;

    if (method == NULL || method[0] == '\0') {
        return NULL;
    }
    for (i = 0; i < QM_ARRAY_SIZE(s_table); i++) {
        const ljyd_method_entry_t *e = &s_table[i];

        if (strcmp(e->method, method) != 0) {
            continue;
        }
        if (e->submethod == NULL) {
            if (wild == NULL) {
                wild = e;
            }
            continue;
        }
        if (submethod != NULL && submethod[0] != '\0' &&
            strcmp(e->submethod, submethod) == 0) {
            return e;
        }
    }
    return wild;
}

static int method_needs_reply(const char *method)
{
    size_t i;

    for (i = 0; i < QM_ARRAY_SIZE(s_table); i++) {
        if (strcmp(s_table[i].method, method) == 0 &&
            (s_table[i].flags & LJYD_METHOD_NEED_REPLY)) {
            return 1;
        }
    }
    return 0;
}

static const char *json_string(const cJSON *params,const char *key)
{
 const cJSON *v=cJSON_GetObjectItemCaseSensitive(params,key);
 return cJSON_IsString(v)&&v->valuestring?v->valuestring:NULL;
}
static int nibble(char c){
 if(c>='0'&&c<='9')return c-'0';
 if(c>='A'&&c<='F')return c-'A'+10;
 if(c>='a'&&c<='f')return c-'a'+10;
 return -1;
}
static int parse_rgb(const char *s,uint8_t rgb[3]){
 if(!s||strlen(s)!=7||s[0]!='#')return 0;
 for(int i=0;i<3;i++){
  int a=nibble(s[1+i*2]),b=nibble(s[2+i*2]);
  if(a<0||b<0)return 0;
  rgb[i]=(uint8_t)(a*16+b);
 }
 return 1;
}
static int read_light_number(const cJSON *obj,const char *key,int lo,int hi,int *out){
 const cJSON *item=cJSON_GetObjectItemCaseSensitive(obj,key);
 if(!cJSON_IsNumber(item)||item->valuedouble<(double)lo||item->valuedouble>(double)hi||
    (double)(int)item->valuedouble!=item->valuedouble)return 0;
 *out=(int)item->valuedouble;
 return 1;
}
static bool parse_mapped_light(const cJSON *v,yg_care_light_t *fx){
 if(!cJSON_IsObject(v)||!fx)return false;
 const cJSON *schema=cJSON_GetObjectItemCaseSensitive(v,"schema");
 const cJSON *pattern=cJSON_GetObjectItemCaseSensitive(v,"pattern");
 const cJSON *colors=cJSON_GetObjectItemCaseSensitive(v,"colors");
 const cJSON *max=cJSON_GetObjectItemCaseSensitive(v,"maxBrightness");
 if(!cJSON_IsString(schema)||strcmp(schema->valuestring,"yuguang.light.v1")!=0||
    !cJSON_IsString(pattern)||!cJSON_IsArray(colors)||
    !cJSON_IsNumber(max)||max->valuedouble<=0||max->valuedouble>0.18||
    !cJSON_IsFalse(cJSON_GetObjectItemCaseSensitive(v,"sound"))||
    !cJSON_IsFalse(cJSON_GetObjectItemCaseSensitive(v,"vibration"))||
    !cJSON_IsTrue(cJSON_GetObjectItemCaseSensitive(v,"autoFade")))return false;
 memset(fx,0,sizeof(*fx));
 if(strcmp(pattern->valuestring,"slow_breathe")==0)fx->pattern=1;
 else if(strcmp(pattern->valuestring,"soft_pulse")==0)fx->pattern=2;
 else if(strcmp(pattern->valuestring,"slow_fade")==0)fx->pattern=3;
 else return false;
 int period=0,cycles=0,duration=0;
 if(!read_light_number(v,"periodMs",500,12000,&period)||
    !read_light_number(v,"cycles",1,5,&cycles)||
    !read_light_number(v,"durationMs",500,120000,&duration)||
    period*cycles!=duration)return false;
 fx->period_ms=(uint32_t)period;
 fx->cycles=(uint32_t)cycles;
 fx->duration_ms=(uint32_t)duration;
 fx->brightness_pct=(uint8_t)(max->valuedouble*100.0+0.5);
 int count=cJSON_GetArraySize(colors);
 if(count<1||count>2||fx->brightness_pct<1||fx->brightness_pct>18)return false;
 fx->color_count=(uint8_t)count;
 for(int i=0;i<count;i++){
  const cJSON *c=cJSON_GetArrayItem(colors,i);
  if(!cJSON_IsString(c)||!parse_rgb(c->valuestring,fx->rgb[i]))return false;
 }
 return true;
}

static int action_care_present(const ljyd_method_ctx_t *ctx)
{
 if(!ctx||!ctx->params||params_source_is_local(ctx->params))return -QM_EINVAL;
 const char *message=json_string(ctx->params,"message_id");
 const char *device=json_string(ctx->params,"device_id");
 const char *command=json_string(ctx->params,"command_id");
 int duration=0;
 if(!json_read_int(ctx->params,"window_ms",&duration)||duration<100||duration>120000)return -QM_EINVAL;
 const cJSON *light=cJSON_GetObjectItemCaseSensitive(ctx->params,"light");
 yg_care_light_t effect;
 /* 新版心意必须包含平台保存的受限灯语快照，禁止静默退回固定灯效。 */
 if(!parse_mapped_light(light,&effect)||effect.duration_ms>(uint32_t)duration)return -QM_EINVAL;
 if(!command||!yg_care_arm_light(message,device,(uint32_t)duration,&effect))return -QM_EINVAL;
 if(!yg_care_bind_command(command)){yg_care_cancel_display();return -QM_EINVAL;}
 return QM_EOK;
}
static int action_care_committed(const ljyd_method_ctx_t *ctx)
{
 if(!ctx||!ctx->params||params_source_is_local(ctx->params))return -QM_EINVAL;
 const cJSON *ack=cJSON_GetObjectItemCaseSensitive(ctx->params,"acknowledged");
 const char *event=json_string(ctx->params,"event_id");
 const char *message=json_string(ctx->params,"message_id");
 if(!cJSON_IsTrue(ack))return -QM_EINVAL;
 return yg_care_confirm(event,message)?QM_EOK:-QM_EINVAL;
}

/* 朗读下行只接收“已授权适配器返回的原文”。个人文本从不写入日志。 */
typedef struct {
 char request_id[37];
 char device_id[129];
 char message_id[129];
 char text[520];
} care_voice_task_data_t;
static portMUX_TYPE s_read_mux=portMUX_INITIALIZER_UNLOCKED;
static bool s_read_busy;
static care_voice_task_data_t s_read_task_data;
static char s_last_read_request_id[37];
static bool valid_ascii_id(const char *text,size_t cap){
 size_t i,n;
 if(!text)return false;
 n=strlen(text);
 if(n==0||n>=cap)return false;
 for(i=0;i<n;i++){
  char c=text[i];
  if(!((c>='0'&&c<='9')||(c>='a'&&c<='z')||
       (c>='A'&&c<='Z')||c=='_'||c=='-'))return false;
 }
 return true;
}
static bool valid_request_uuid(const char *id){
 if(!id||strlen(id)!=36)return false;
 for(int i=0;i<36;i++){
  const char c=id[i];
  if(i==8||i==13||i==18||i==23){if(c!='-')return false;}
  else if(!((c>='0'&&c<='9')||(c>='a'&&c<='f')||
            (c>='A'&&c<='F')))return false;
 }
 return true;
}
static void read_text_worker(void *arg){
 (void)arg;
 care_voice_task_data_t *task=&s_read_task_data;
 int ret=agent_app_user_corpus(task->text);
 if(ret==QM_EOK)ret=agent_app_wait_tts_complete(40000);
 struct timeval tv;
 uint64_t epoch=0;
 if(gettimeofday(&tv,NULL)==0&&tv.tv_sec>1600000000)
  epoch=(uint64_t)tv.tv_sec*1000ULL+(uint64_t)tv.tv_usec/1000ULL;
 uint8_t random[16];esp_fill_random(random,sizeof(random));
 random[6]=(uint8_t)((random[6]&0x0F)|0x40);
 random[8]=(uint8_t)((random[8]&0x3F)|0x80);
 char event_id[37];
 (void)snprintf(event_id,sizeof(event_id),
  "%02x%02x%02x%02x-%02x%02x-%02x%02x-%02x%02x-%02x%02x%02x%02x%02x%02x",
  random[0],random[1],random[2],random[3],random[4],random[5],random[6],random[7],
  random[8],random[9],random[10],random[11],random[12],random[13],random[14],random[15]);
 cJSON *root=cJSON_CreateObject();
 if(root){
  cJSON_AddStringToObject(root,"schema_version","yuguang.voice-read.v1");
  cJSON_AddStringToObject(root,"type","voice_playback");
  cJSON_AddStringToObject(root,"source","device_audio_result");
  cJSON_AddStringToObject(root,"event_id",event_id);
  cJSON_AddStringToObject(root,"request_id",task->request_id);
  cJSON_AddStringToObject(root,"device_id",task->device_id);
  cJSON_AddStringToObject(root,"status",ret==QM_EOK?"played":"failed");
  cJSON_AddNumberToObject(root,"occurred_at_ms",(double)epoch);
  char *payload=cJSON_PrintUnformatted(root);
  if(payload){
   (void)ljyd_method_up("care","readPlayed",payload);
   cJSON_free(payload);
  }
  cJSON_Delete(root);
 }
 QM_LOGI(LOG_TAG,"care TTS completed ret=%d",ret);
 portENTER_CRITICAL(&s_read_mux);
 memset(&s_read_task_data,0,sizeof(s_read_task_data));
 s_read_busy=false;
 portEXIT_CRITICAL(&s_read_mux);
 vTaskDelete(NULL);
}
static int action_care_read_text(const ljyd_method_ctx_t *ctx){
 if(!ctx||!ctx->params||params_source_is_local(ctx->params))return -QM_EINVAL;
 const char *request_id=json_string(ctx->params,"request_id");
 const char *device_id=json_string(ctx->params,"device_id");
 const char *message_id=json_string(ctx->params,"message_id");
 const char *text=json_string(ctx->params,"text");
 if(!valid_request_uuid(request_id)||!valid_ascii_id(device_id,129)||
    !valid_ascii_id(message_id,129)||!text||strlen(text)>=sizeof(s_read_task_data.text)||
    strncmp(text,"你收到的消息是：",strlen("你收到的消息是："))!=0)
  return -QM_EINVAL;
 bool accepted=false;
 portENTER_CRITICAL(&s_read_mux);
 if(strcmp(s_last_read_request_id,request_id)==0){
  portEXIT_CRITICAL(&s_read_mux);
  return QM_EOK; /* 同一请求重发不会再次外放 */
 }
 if(!s_read_busy){
  s_read_busy=true;
  memset(&s_read_task_data,0,sizeof(s_read_task_data));
  strncpy(s_read_task_data.request_id,request_id,sizeof(s_read_task_data.request_id)-1);
  strncpy(s_read_task_data.device_id,device_id,sizeof(s_read_task_data.device_id)-1);
  strncpy(s_read_task_data.message_id,message_id,sizeof(s_read_task_data.message_id)-1);
  strncpy(s_read_task_data.text,text,sizeof(s_read_task_data.text)-1);
  strncpy(s_last_read_request_id,request_id,sizeof(s_last_read_request_id)-1);
  accepted=true;
 }
 portEXIT_CRITICAL(&s_read_mux);
 if(!accepted)return -QM_EBUSY;
 if(xTaskCreate(read_text_worker,"yg_read_tts",8192,NULL,4,NULL)!=pdPASS){
  portENTER_CRITICAL(&s_read_mux);
  s_read_busy=false;
  s_last_read_request_id[0]='\0';
  memset(&s_read_task_data,0,sizeof(s_read_task_data));
  portEXIT_CRITICAL(&s_read_mux);
  return -QM_ENOMEM;
 }
 return QM_EOK;
}

static int action_voice_relax(const ljyd_method_ctx_t *ctx)
{
 if(!ctx||!ctx->params||params_source_is_local(ctx->params))return -QM_EINVAL;
 const char *intent=json_string(ctx->params,"text");
 if(intent&&strcmp(intent,"我需要放松一下")==0){
  return yg_a_app_relax_request()?QM_EOK:-QM_EINVAL;
 }
 return -QM_EINVAL;
}

static int action_chat_quit(const ljyd_method_ctx_t *ctx)
{
    const cJSON *it;
    const char *speak = NULL;

    if (ctx == NULL) {
        return -QM_EINVAL;
    }
    if (params_source_is_local(ctx->params)) {
        QM_LOGI(LOG_TAG, "chat quit source=local ignore");
        return 0;
    }
    if (ctx->params != NULL) {
        it = cJSON_GetObjectItemCaseSensitive(ctx->params, "speakText");
        if (cJSON_IsString(it) && it->valuestring != NULL &&
            it->valuestring[0] != '\0') {
            speak = it->valuestring;
        }
    }
    QM_LOGI(LOG_TAG, "chat quit speak=%s", speak != NULL ? speak : "");
    return agent_app_leave();
}

#if defined(CONFIG_LJYD_PLAYBACK_SUPPORT) && CONFIG_LJYD_PLAYBACK_SUPPORT
static int action_player_play(const ljyd_method_ctx_t *ctx)
{
    playback_cloud_play_request_t request;
    const cJSON *item;

    if (ctx == NULL || !cJSON_IsObject(ctx->params)) {
        return -QM_EINVAL;
    }
    memset(&request, 0, sizeof(request));
    item = cJSON_GetObjectItemCaseSensitive(ctx->params, "url");
    if (!cJSON_IsString(item) || item->valuestring == NULL ||
        item->valuestring[0] == '\0') {
        return -QM_EINVAL;
    }
    request.url = item->valuestring;

    item = cJSON_GetObjectItemCaseSensitive(ctx->params, "guideWords");
    if (cJSON_IsString(item) && item->valuestring != NULL &&
        item->valuestring[0] != '\0') {
        request.guide_words = item->valuestring;
    }
    item = cJSON_GetObjectItemCaseSensitive(ctx->params, "audioType");
    if (cJSON_IsString(item) && item->valuestring != NULL &&
        item->valuestring[0] != '\0') {
        request.audio_type = item->valuestring;
    } else {
        request.audio_type = "pcm";
    }
    item = cJSON_GetObjectItemCaseSensitive(ctx->params, "title");
    if (cJSON_IsString(item) && item->valuestring != NULL &&
        item->valuestring[0] != '\0') {
        request.title = item->valuestring;
    }
    (void)json_read_u32(ctx->params, "fileSize", &request.file_size);
    (void)json_read_u32(ctx->params, "totalDuration", &request.duration_s);
    QM_LOGI(LOG_TAG, "player play url=%s type=%s size=%u duration=%u guide=%u",
            request.url,
            request.audio_type,
            (unsigned)request.file_size,
            (unsigned)request.duration_s,
            request.guide_words != NULL ? 1U : 0U);
    return playback_submit_cloud_play(&request);
}
#endif

static void method_down_dispatch(void *handle, const qm_iot_mqtt_recv_t *packet, void *userdata)
{
    const char *method = (const char *)userdata;
    cJSON *root = NULL;
    cJSON *item;
    ljyd_method_ctx_t ctx;
    const ljyd_method_entry_t *entry;
    char submethod[24];
    int code;
    int ret;

    (void)handle;
    memset(&ctx, 0, sizeof(ctx));
    ctx.code = -1;
    ctx.method = method;
    ctx.submethod = "";
    submethod[0] = '\0';

    if (s_iot == NULL || method == NULL || packet == NULL ||
        packet->type != QM_IOT_MQTTRECV_PUB ||
        packet->data.pub.payload == NULL ||
        packet->data.pub.payload_len == 0) {
        QM_LOGW(LOG_TAG, "down ignore invalid packet method=%s",
                method != NULL ? method : "");
        return;
    }

    /* MQTT payloads are length-delimited and are not guaranteed to be NUL-terminated. */
    /* care/readText 内含亲友原文；禁止记录 MQTT 内容及十六进制转储。 */
    if(strcmp(method,"care")==0){
        QM_LOGI(LOG_TAG,"MQTT downlink care (redacted) len=%u",
                (unsigned)packet->data.pub.payload_len);
    }else{
        QM_LOGI(LOG_TAG,"MQTT downlink method=%s len=%u",
                method,(unsigned)packet->data.pub.payload_len);
    }

    root = cJSON_ParseWithLength((const char *)packet->data.pub.payload,
                                 packet->data.pub.payload_len);
    if (root == NULL) {
        QM_LOGW(LOG_TAG, "down parse failed method=%s", method);
        return;
    }

    ctx.root = root;
    item = cJSON_GetObjectItem(root, "id");
    if (cJSON_IsNumber(item)) {
        ctx.msg_id = (uint32_t)item->valuedouble;
    }

    item = cJSON_GetObjectItem(root, "subMethod");
    if (!cJSON_IsString(item) || item->valuestring == NULL) {
        item = cJSON_GetObjectItem(root, "submethod");
    }
    if (cJSON_IsString(item) && item->valuestring != NULL &&
        item->valuestring[0] != '\0') {
        strncpy(submethod, item->valuestring, sizeof(submethod) - 1);
        submethod[sizeof(submethod) - 1] = '\0';
        ctx.submethod = submethod;
    }

    ctx.params = cJSON_GetObjectItem(root, "params");
    if (json_read_int(root, "code", &ctx.code) ||
        json_read_int(ctx.params, "code", &ctx.code)) {
        ctx.has_code = 1;
    }

    entry = table_find(method, ctx.submethod);
    if (entry == NULL || entry->action == NULL) {
        QM_LOGW(LOG_TAG, "down no match method=%s subMethod=%s msg_id=%u",
                method, ctx.submethod[0] != '\0' ? ctx.submethod : "",
                (unsigned)ctx.msg_id);
        if (method_needs_reply(method)) {
            (void)qm_iot_down_reply_ex(s_iot, (char *)method,
                                       submethod[0] != '\0' ? submethod : NULL,
                                       ctx.msg_id, -QM_EINVAL, NULL, 0);
        }
        cJSON_Delete(root);
        return;
    }

    code = entry->action(&ctx);
    if (entry->flags & LJYD_METHOD_NEED_REPLY) {
        ret = qm_iot_down_reply_ex(s_iot, (char *)method,
                                   submethod[0] != '\0' ? submethod : NULL,
                                   ctx.msg_id, code, NULL, 0);
        QM_LOGI(LOG_TAG, "down method=%s subMethod=%s msg_id=%u code=%d reply=%d",
                method, ctx.submethod[0] != '\0' ? ctx.submethod : "",
                (unsigned)ctx.msg_id, code, ret);
    }

    cJSON_Delete(root);
}

int ljyd_method_on_connected(void *iot_handle)
{
    size_t i;
    size_t j;
    int ret;

    if (iot_handle == NULL) {
        return -QM_EINVAL;
    }
    s_iot = iot_handle;

    for (i = 0; i < QM_ARRAY_SIZE(s_table); i++) {
        const char *method = s_table[i].method;
        int dup = 0;

        for (j = 0; j < i; j++) {
            if (strcmp(s_table[j].method, method) == 0) {
                dup = 1;
                break;
            }
        }
        if (dup) {
            continue;
        }
        ret = qm_iot_down_register(s_iot, (char *)method,
                                   method_down_dispatch, (void *)method);
        if (ret != QM_EOK) {
            QM_LOGW(LOG_TAG, "down reg %s failed ret=%d", method, ret);
            return ret;
        }
        QM_LOGI(LOG_TAG, "down registered: %s", method);
    }
    return QM_EOK;
}

int ljyd_method_up(const char *method, const char *submethod, const char *params_json)
{
    static const char local_params[] = "{\"source\":\"local\"}";
    const char *payload = params_json;
    int ret;

    if (method == NULL || method[0] == '\0' ||
        submethod == NULL || submethod[0] == '\0') {
        return -QM_EINVAL;
    }
    if (s_iot == NULL) {
        QM_LOGW(LOG_TAG, "iot handle not ready, skip %s/%s", method, submethod);
        return -QM_EINVAL;
    }
    if (payload == NULL || payload[0] == '\0') {
        payload = local_params;
    }
    ret = qm_iot_up_report_ex(s_iot, (char *)method, (char *)submethod, 0,
                              (char *)payload, (int)strlen(payload));
    if (ret != QM_EOK) {
        QM_LOGW(LOG_TAG, "%s %s up failed ret=%d", method, submethod, ret);
        return ret;
    }
    QM_LOGI(LOG_TAG, "%s %s up ok", method, submethod);
    return QM_EOK;
}
