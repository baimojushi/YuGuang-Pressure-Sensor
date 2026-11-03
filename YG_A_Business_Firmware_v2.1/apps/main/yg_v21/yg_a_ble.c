/* ESP-IDF Bluedroid encrypted GATT Central, retaining original QUMIOS BLE
 * provisioning by delaying startup until CLOUD_CONN. UUIDs and frames frozen.
 * Just Works + bond is not MITM-safe; first pairing requires local CLI window.
 */
#include "yg_a_ble.h"
#include "yg_a_app.h"
#include "yg_a_uart_fallback.h"
#include "yg_iface.h"
#include "qm_ble_gap.h"
#include "qm_cli.h"
#include "qm_log.h"
#include "nvs.h"
#include "esp_gap_ble_api.h"
#include "esp_gattc_api.h"
#include "esp_gatt_common_api.h"
#include "esp_bt_main.h"
#include "esp_heap_caps.h"
#include "esp_timer.h"
#include <string.h>
#include <stdio.h>
#include "sdkconfig.h"
#define TAG "yg-a-ble"
#define APP_ID 0x71
#ifdef CONFIG_YG_BLE_UNENCRYPTED_DEBUG
#define YG_GATT_AUTH ESP_GATT_AUTH_REQ_NONE
#else
#define YG_GATT_AUTH ESP_GATT_AUTH_REQ_NO_MITM
#endif
static const uint8_t service_uuid[16]=YG_SERVICE_UUID;
/* 索引与 s_chars[] 对齐：1 呼吸 / 2 压力事件 / 3 状态 / 5 控制 / 6 回执；4 预留。
 * 早期版本把 6 个 UUID 连续放在 [0..5] 却按 1..6 取用，导致 [6] 越界、
 * control 与 ack 句柄错位（ACK 句柄为 0 时还会触发下面的“不完整服务”断开）。 */
static const uint8_t char_uuid[7][16]={
 [1]=YG_BREATH_UUID,[2]=YG_PRESSURE_UUID,[3]=YG_STATUS_UUID,
 [5]=YG_CONTROL_UUID,[6]=YG_ACK_UUID};
static esp_gatt_if_t s_if=ESP_GATT_IF_NONE;
static uint16_t s_conn,s_begin,s_end,s_chars[7];
static esp_bd_addr_t s_bda,s_pinned;
static bool s_started,s_open,s_secure,s_pinned_valid,s_searching,s_authorized;
static uint32_t s_pair_until,s_boot_id,s_latest_status_uptime,s_status_arrived;
/* Deduplicate all recent event IDs, including out-of-order retries. */
#define EVENT_HISTORY 32
static uint32_t s_seen_events[EVENT_HISTORY];
static uint32_t s_seen_boots[EVENT_HISTORY];
static unsigned s_seen_cursor;
static uint32_t s_next_cmd;
static uint8_t s_ble_state; /* 0 lost, 1 negotiating, 2 connected */
static uint32_t ms(void){return (uint32_t)(esp_timer_get_time()/1000ULL);}
static esp_bt_uuid_t uuid128(const uint8_t *raw){
 esp_bt_uuid_t v={.len=ESP_UUID_LEN_128};memcpy(v.uuid.uuid128,raw,16);return v;
}
static bool adv_has_service(const uint8_t *p,uint8_t n){
 for(unsigned i=0;i<n;){uint8_t count=p[i];if(!count||i+count>=n+1u)break;
  /* 完整(0x07)与不完整(0x06)的 128 位服务列表都要接受：不同 IDF 版本的
   * Bluedroid 对 service_uuid_len 的 AD 类型选择不一致。 */
  if((p[i+1]==ESP_BLE_AD_TYPE_128SRV_CMPL||p[i+1]==ESP_BLE_AD_TYPE_128SRV_PART)&&count>=17){
    for(unsigned j=i+2;j+16<=i+count+1;j+=16){if(memcmp(p+j,service_uuid,16)==0)return true;}
  }i+=count+1u;
 }return false;
}
static bool allowed_peer(const uint8_t *bda){
#ifdef CONFIG_YG_BLE_UNENCRYPTED_DEBUG
 static const esp_bd_addr_t allowed_b={0x68,0xee,0x8f,0x44,0xb5,0xae};
 return memcmp(bda,allowed_b,sizeof(allowed_b))==0;
#else
 if(s_pinned_valid)return memcmp(bda,s_pinned,6)==0;
 return s_pair_until&&(int32_t)(s_pair_until-ms())>0;
#endif
}
static bool link_ready(void){
#ifdef CONFIG_YG_BLE_UNENCRYPTED_DEBUG
 return s_open&&s_authorized;
#else
 return s_open&&s_authorized&&s_secure;
#endif
}
static void scan_again(void){
 if(s_started&&!s_open&&!s_searching){
  if(esp_ble_gap_start_scanning(0)==ESP_OK){s_searching=true;s_ble_state=0;}
 }
}
static void subscribe(uint8_t idx){
 if(!s_chars[idx])return;
 (void)esp_ble_gattc_register_for_notify(s_if,s_bda,s_chars[idx]);
}
static void update_status(const uint8_t *p,size_t n){
 yg_status_t v;if(!yg_status_unpack(&v,p,n))return;
 if(!v.boot_id)return;
 uint32_t previous_boot=s_boot_id;
 s_boot_id=v.boot_id;s_latest_status_uptime=v.uptime_ms;s_status_arrived=ms();
 s_ble_state=2;yg_a_app_ble_connected(true,v.boot_id);
 if(previous_boot!=v.boot_id)QM_LOGI(TAG,"status RX valid; sensor boot=%u",(unsigned)v.boot_id);
}
static void event_notify(const uint8_t *p,size_t n){
 yg_pressure_t e;if(!yg_pressure_unpack(&e,p,n)||!link_ready())return;
 /* Stale status cannot prove event's age; refuse until next status. */
 bool fresh=s_boot_id&&s_status_arrived&&(uint32_t)(ms()-s_status_arrived)<3000;
 uint8_t result=(!fresh)?2:(yg_event_expired(e.uptime_ms,e.ttl_ms,s_latest_status_uptime)?1:0);
 bool duplicate=false;
 for(unsigned i=0;i<EVENT_HISTORY;i++){
   if(s_seen_boots[i]==s_boot_id&&s_seen_events[i]==e.event_id){duplicate=true;break;}
 }
 if(result==0&&!duplicate){
  unsigned slot=s_seen_cursor++%EVENT_HISTORY;
  s_seen_boots[slot]=s_boot_id;s_seen_events[slot]=e.event_id;
  yg_a_app_on_pressure(&e);
 }
 yg_ack_t ack={.kind=YG_ACK_PRESSURE,.event_id=e.event_id,.result=result};uint8_t buf[8];
 if(yg_ack_pack(buf,&ack)&&s_chars[6]){
  (void)esp_ble_gattc_write_char(s_if,s_conn,s_chars[6],8,buf,
    ESP_GATT_WRITE_TYPE_RSP,YG_GATT_AUTH);
 }
}
static void gattc_cb(esp_gattc_cb_event_t e,esp_gatt_if_t iface,esp_ble_gattc_cb_param_t *p){
 switch(e){
 case ESP_GATTC_REG_EVT:
  if(p->reg.status!=ESP_GATT_OK){QM_LOGE(TAG,"register failed %d",p->reg.status);return;}
  s_if=iface;
  {esp_ble_scan_params_t scan={.scan_type=BLE_SCAN_TYPE_ACTIVE,.own_addr_type=BLE_ADDR_TYPE_PUBLIC,
   .scan_filter_policy=BLE_SCAN_FILTER_ALLOW_ALL,.scan_interval=0x50,.scan_window=0x30,
   .scan_duplicate=BLE_SCAN_DUPLICATE_DISABLE};(void)esp_ble_gap_set_scan_params(&scan);}
  break;
 case ESP_GATTC_OPEN_EVT:
  QM_LOGI(TAG,"open status=%d",(int)p->open.status);
  if(p->open.status!=ESP_GATT_OK){s_open=false;s_authorized=false;s_ble_state=0;scan_again();}
#ifdef CONFIG_YG_BLE_UNENCRYPTED_DEBUG
  else if(link_ready()){
   esp_bt_uuid_t srv=uuid128(service_uuid);
   QM_LOGI(TAG,"UNENCRYPTED DEBUG: discovering fixed B service");
   (void)esp_ble_gattc_search_service(iface,s_conn,&srv);
  }
#endif
  break;
 case ESP_GATTC_CONNECT_EVT:
  s_conn=p->connect.conn_id;memcpy(s_bda,p->connect.remote_bda,6);s_open=true;s_searching=false;
  s_secure=false;s_authorized=allowed_peer(s_bda);s_ble_state=1;
  memset(s_chars,0,sizeof(s_chars));s_begin=s_end=0;s_boot_id=0;s_status_arrived=0;
  if(!s_authorized){(void)esp_ble_gattc_close(iface,s_conn);break;}
#ifndef CONFIG_YG_BLE_UNENCRYPTED_DEBUG
  QM_LOGI(TAG,"link up; requesting encryption");
  QM_LOGI(TAG,"encryption request rc=%d",(int)esp_ble_set_encryption(s_bda,ESP_BLE_SEC_ENCRYPT));
#endif
  break;
 case ESP_GATTC_DISCONNECT_EVT:
  QM_LOGW(TAG,"link down reason=0x%02x",(unsigned)p->disconnect.reason);
  s_open=false;s_secure=false;s_authorized=false;s_ble_state=0;s_boot_id=0;s_status_arrived=0;
  if(!yg_a_uart_fallback_active())yg_a_app_ble_connected(false,0);
  scan_again();break;
 case ESP_GATTC_SEARCH_RES_EVT:
  if(p->search_res.srvc_id.uuid.len==ESP_UUID_LEN_128&&
   memcmp(p->search_res.srvc_id.uuid.uuid.uuid128,service_uuid,16)==0){
   s_begin=p->search_res.start_handle;s_end=p->search_res.end_handle;
  }break;
 case ESP_GATTC_SEARCH_CMPL_EVT:
  if(p->search_cmpl.status!=ESP_GATT_OK||!s_begin||!link_ready())break;
  for(uint8_t i=1;i<=6;i++){
   esp_gattc_char_elem_t found[2];uint16_t count=2;
   esp_bt_uuid_t uid=uuid128(char_uuid[i]);
   if(esp_ble_gattc_get_char_by_uuid(iface,s_conn,s_begin,s_end,uid,found,&count)==ESP_GATT_OK&&count){
    s_chars[i]=found[0].char_handle;
   }
  }
  if(!s_chars[1]||!s_chars[2]||!s_chars[3]||!s_chars[5]||!s_chars[6]){
   QM_LOGW(TAG,"incomplete frozen BLE service");(void)esp_ble_gattc_close(iface,s_conn);break;
  }
  subscribe(1);subscribe(2);subscribe(3);
  /* B 板只有收到 control opcode=1(param!=0) 才把 stream 打开并开始推送呼吸/状态；
   * 之前订阅完成却从不发这条，链路看起来"连着"但永远没有数据。 */
  yg_a_ble_control(1,1);
  break;
 case ESP_GATTC_REG_FOR_NOTIFY_EVT:
  if(p->reg_for_notify.status==ESP_GATT_OK){
   uint16_t char_handle=p->reg_for_notify.handle;
   esp_bt_uuid_t cccd={.len=ESP_UUID_LEN_16,.uuid.uuid16=ESP_GATT_UUID_CHAR_CLIENT_CONFIG};
   esp_gattc_descr_elem_t d[1];uint16_t n=1;
   if(esp_ble_gattc_get_descr_by_char_handle(iface,s_conn,char_handle,cccd,d,&n)==ESP_GATT_OK&&n){
    uint16_t enable=1; (void)esp_ble_gattc_write_char_descr(iface,s_conn,d[0].handle,
       sizeof(enable),(uint8_t *)&enable,ESP_GATT_WRITE_TYPE_RSP,YG_GATT_AUTH);
   }
  }break;
 case ESP_GATTC_NOTIFY_EVT:
  if(!link_ready()||p->notify.conn_id!=s_conn||memcmp(p->notify.remote_bda,s_bda,6)!=0)return;
  if(p->notify.handle==s_chars[1]){
   yg_breath_t b;if(yg_breath_unpack(&b,p->notify.value,p->notify.value_len)){
    yg_a_app_on_breath(&b);
    QM_LOGI(TAG,"{\"type\":\"a_radar\",\"source\":\"a_ble_rx\",\"rx_ms\":%u,\"seq\":%u,\"uptime_ms\":%u,\"flags\":%u,\"wave_q15\":%d,\"bpm_x10\":%u,\"confidence_pct\":%u,\"sample_age_ms\":%u}",
      (unsigned)ms(),(unsigned)b.seq,(unsigned)b.uptime_ms,(unsigned)b.flags,
      (int)b.wave_q15,(unsigned)b.bpm_x10,(unsigned)b.confidence_pct,(unsigned)b.sample_age_ms);
   }
  }
  else if(p->notify.handle==s_chars[2])event_notify(p->notify.value,p->notify.value_len);
  else if(p->notify.handle==s_chars[3])update_status(p->notify.value,p->notify.value_len);
  break;
 default:break;
 }
}
static void gap_cb(esp_gap_ble_cb_event_t e,esp_ble_gap_cb_param_t *p){
 switch(e){
 case ESP_GAP_BLE_SCAN_PARAM_SET_COMPLETE_EVT:scan_again();break;
 case ESP_GAP_BLE_SCAN_RESULT_EVT:
  if(p->scan_rst.search_evt==ESP_GAP_SEARCH_INQ_RES_EVT&&s_if!=ESP_GATT_IF_NONE&&
    !s_open&&adv_has_service(p->scan_rst.ble_adv,p->scan_rst.adv_data_len)){
   bool ok=allowed_peer(p->scan_rst.bda);
   /* 现场排查用：命中服务广播时记录 RSSI 与是否被配对门禁拦住。 */
   QM_LOGI(TAG,"peer adv rssi=%d allowed=%d",(int)p->scan_rst.rssi,(int)ok);
   if(ok){
    s_searching=false;s_ble_state=1;(void)esp_ble_gap_stop_scanning();
    (void)esp_ble_gattc_open(s_if,p->scan_rst.bda,p->scan_rst.ble_addr_type,true);
   }
  }break;
 case ESP_GAP_BLE_SEC_REQ_EVT:
#ifdef CONFIG_YG_BLE_UNENCRYPTED_DEBUG
  (void)esp_ble_gap_security_rsp(p->ble_security.ble_req.bd_addr,false);
#else
  (void)esp_ble_gap_security_rsp(p->ble_security.ble_req.bd_addr,
       allowed_peer(p->ble_security.ble_req.bd_addr));
#endif
  break;
 case ESP_GAP_BLE_AUTH_CMPL_EVT:
#ifdef CONFIG_YG_BLE_UNENCRYPTED_DEBUG
  QM_LOGW(TAG,"UNENCRYPTED DEBUG: unexpected authentication event ignored");
#else
  QM_LOGI(TAG,"auth cmpl success=%d reason=0x%02x mode=0x%02x allowed=%d",
    (int)p->ble_security.auth_cmpl.success,(unsigned)p->ble_security.auth_cmpl.fail_reason,
    (unsigned)p->ble_security.auth_cmpl.auth_mode,(int)allowed_peer(p->ble_security.auth_cmpl.bd_addr));
  if(p->ble_security.auth_cmpl.success&&allowed_peer(p->ble_security.auth_cmpl.bd_addr)){
   s_secure=true;
   if(!s_pinned_valid){
     memcpy(s_pinned,p->ble_security.auth_cmpl.bd_addr,6);s_pinned_valid=true;
     nvs_handle_t h;if(nvs_open("yg_peer",NVS_READWRITE,&h)==ESP_OK){
       nvs_set_blob(h,"bda",s_pinned,6);nvs_commit(h);nvs_close(h);}
   }
   esp_bt_uuid_t srv=uuid128(service_uuid);
   if(s_open)(void)esp_ble_gattc_search_service(s_if,s_conn,&srv);
  }else if(s_open){(void)esp_ble_gattc_close(s_if,s_conn);}
#endif
  break;
 case ESP_GAP_BLE_SCAN_STOP_COMPLETE_EVT:
  if(!s_open&&s_ble_state!=1){
   scan_again();
  }
  break;
 default:break;
 }
}
const char *yg_a_ble_state(void){return s_ble_state==2?"connected":(s_ble_state==1?"negotiating":"lost");}
bool yg_a_ble_data_fresh(uint32_t max_age_ms){
 return s_ble_state==2&&s_status_arrived&&(uint32_t)(ms()-s_status_arrived)<max_age_ms;
}
void yg_a_ble_control(uint8_t opcode,uint16_t param){
 if(!link_ready()){QM_LOGW(TAG,"ctl TX dropped opcode=%u: link not ready",(unsigned)opcode);return;}
 if(!s_chars[5]){QM_LOGW(TAG,"ctl TX dropped opcode=%u: no control char",(unsigned)opcode);return;}
 yg_control_t c={.opcode=opcode,.param=param,.command_id=++s_next_cmd};uint8_t buf[8];
 if(yg_control_pack(buf,&c)){
  QM_LOGI(TAG,"ctl TX opcode=%u param=%u cmd=%u",(unsigned)opcode,(unsigned)param,(unsigned)c.command_id);
  esp_err_t rc=esp_ble_gattc_write_char(s_if,s_conn,s_chars[5],8,buf,
    ESP_GATT_WRITE_TYPE_RSP,YG_GATT_AUTH);
  if(rc!=ESP_GATT_OK)QM_LOGW(TAG,"ctl TX rc=%d",(int)rc);
 }
}
void yg_a_ble_pair_window(uint32_t seconds){
 if(seconds<10||seconds>120)return;
 s_pair_until=ms()+seconds*1000U;scan_again();QM_LOGW(TAG,"pairing window %us; verify device identity out-of-band",(unsigned)seconds);
}
static void cli_ygble(char *wbuf,int wlen,int argc,char **argv){
 (void)wbuf;(void)wlen;
 if(argc==3&&strcmp(argv[1],"pair")==0){
  unsigned secs=0;if(sscanf(argv[2],"%u",&secs)==1){yg_a_ble_pair_window(secs);return;}
 }
 qm_cli_printf("ygble pair 120 (local USB commissioning only)\\r\\n");
}
static const struct qm_cli_command cli={.name="ygble",.help="YG sensor BLE commissioning",.function=cli_ygble};
void yg_a_ble_start(void){
 if(s_started)return;
 /* BLE 控制器需要较大的连续内部 RAM，失败时只报 "BLE_INIT: Malloc failed"，
  * 这里先把启动前的水位打出来，便于对照剪裁。 */
 QM_LOGI(TAG,"start: internal free=%u largest=%u",
   (unsigned)heap_caps_get_free_size(MALLOC_CAP_INTERNAL),
   (unsigned)heap_caps_get_largest_free_block(MALLOC_CAP_INTERNAL));
 if(esp_bluedroid_get_status()!=ESP_BLUEDROID_STATUS_ENABLED){
  if(qm_ble_gap_register_callback(NULL)!=0){QM_LOGE(TAG,"BLE controller init failed");return;}
 }
#ifdef CONFIG_YG_BLE_UNENCRYPTED_DEBUG
 QM_LOGW(TAG,"UNENCRYPTED DEBUG: fixed B only; no confidentiality or authenticated identity");
#else
 nvs_handle_t h;if(nvs_open("yg_peer",NVS_READONLY,&h)==ESP_OK){
  size_t n=6;if(nvs_get_blob(h,"bda",s_pinned,&n)==ESP_OK&&n==6)s_pinned_valid=true;
  nvs_close(h);
 }
 uint8_t sec=ESP_LE_AUTH_REQ_SC_BOND,iocap=ESP_IO_CAP_NONE;
 esp_err_t auth_rc=esp_ble_gap_set_security_param(ESP_BLE_SM_AUTHEN_REQ_MODE,&sec,1);
 esp_err_t io_rc=esp_ble_gap_set_security_param(ESP_BLE_SM_IOCAP_MODE,&iocap,1);
 QM_LOGI(TAG,"security setup auth=0x%02x io=%u rc=%d/%d",(unsigned)sec,(unsigned)iocap,(int)auth_rc,(int)io_rc);
#endif
 if(esp_ble_gap_register_callback(gap_cb)!=ESP_OK||
    esp_ble_gattc_register_callback(gattc_cb)!=ESP_OK||
    esp_ble_gattc_app_register(APP_ID)!=ESP_OK){QM_LOGE(TAG,"GATT init failed");return;}
 s_started=true;(void)qm_cli_register_command(&cli);
 QM_LOGI(TAG,"GATT central started; peer pinned=%d",(int)s_pinned_valid);
}
