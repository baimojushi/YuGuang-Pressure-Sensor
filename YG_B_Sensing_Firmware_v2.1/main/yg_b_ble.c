/* YG B Bluedroid encrypted GATT peripheral; 20/8 byte frozen profile.
 * IMPORTANT: ESP_IO_CAP_NONE + Just Works does not protect against MITM.
 * A companion authenticated identity channel is required for production.
 */
#include "yg_b_ble.h"
#include "esp_bt.h"
#include "esp_bt_main.h"
#include "esp_gap_ble_api.h"
#include "esp_gatts_api.h"
#include "esp_gatt_common_api.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "nvs.h"
#include "freertos/FreeRTOS.h"
#include <string.h>
#include "sdkconfig.h"
#define TAG "yg-b-ble"
#define APP_ID 0x72
#ifdef CONFIG_YG_BLE_UNENCRYPTED_DEBUG
#define YG_READ_PERM ESP_GATT_PERM_READ
#define YG_WRITE_PERM ESP_GATT_PERM_WRITE
#else
#define YG_READ_PERM ESP_GATT_PERM_READ_ENCRYPTED
#define YG_WRITE_PERM ESP_GATT_PERM_WRITE_ENCRYPTED
#endif
#define IDX_SVC 0
#define IDX_B_DEC 1
#define IDX_B_VAL 2
#define IDX_B_CCC 3
#define IDX_P_DEC 4
#define IDX_P_VAL 5
#define IDX_P_CCC 6
#define IDX_S_DEC 7
#define IDX_S_VAL 8
#define IDX_S_CCC 9
#define IDX_C_DEC 10
#define IDX_C_VAL 11
#define IDX_A_DEC 12
#define IDX_A_VAL 13
#define IDX_NB 14
#define VLEN sizeof(uint8_t)
static uint16_t handles[IDX_NB];
static esp_gatt_if_t gatt_if=ESP_GATT_IF_NONE;
static uint16_t conn_id;
static esp_bd_addr_t remote;
static bool connected,secure,subscribe_b,subscribe_p,subscribe_s,stream=true,demo_desired;
static yg_pressure_t queued;
static uint8_t attempts;
static uint32_t last_attempt;
static const uint16_t primary_uuid=ESP_GATT_UUID_PRI_SERVICE;
static const uint16_t characteristic_uuid=ESP_GATT_UUID_CHAR_DECLARE;
static const uint16_t ccc_uuid=ESP_GATT_UUID_CHAR_CLIENT_CONFIG;
static const uint8_t svc_uuid[16]=YG_SERVICE_UUID;
static const uint8_t breath_uuid[16]=YG_BREATH_UUID;
static const uint8_t event_uuid[16]=YG_PRESSURE_UUID;
static const uint8_t status_uuid[16]=YG_STATUS_UUID;
static const uint8_t control_uuid[16]=YG_CONTROL_UUID;
static const uint8_t ack_uuid[16]=YG_ACK_UUID;
static const uint8_t prop_notify=ESP_GATT_CHAR_PROP_BIT_NOTIFY;
static const uint8_t prop_read_notify=ESP_GATT_CHAR_PROP_BIT_READ|ESP_GATT_CHAR_PROP_BIT_NOTIFY;
static const uint8_t prop_write=ESP_GATT_CHAR_PROP_BIT_WRITE;
static const uint8_t ccc_zero[2]={0,0};
static uint8_t init20[20]={1};
static uint8_t init8[8]={1};
#define DECL(P) {{ESP_GATT_AUTO_RSP},{ESP_UUID_LEN_16,(uint8_t*)&characteristic_uuid,ESP_GATT_PERM_READ,1,1,(uint8_t*)&(P)}}
#define VAL20(UUID,PERM) {{ESP_GATT_AUTO_RSP},{ESP_UUID_LEN_128,(uint8_t*)(UUID),(PERM),20,20,init20}}
#define VAL8(UUID,PERM) {{ESP_GATT_AUTO_RSP},{ESP_UUID_LEN_128,(uint8_t*)(UUID),(PERM),8,8,init8}}
#define CCC {{ESP_GATT_AUTO_RSP},{ESP_UUID_LEN_16,(uint8_t*)&ccc_uuid,YG_READ_PERM|YG_WRITE_PERM,2,2,(uint8_t*)ccc_zero}}
static const esp_gatts_attr_db_t db[IDX_NB]={
 [IDX_SVC]={{ESP_GATT_AUTO_RSP},{ESP_UUID_LEN_16,(uint8_t*)&primary_uuid,ESP_GATT_PERM_READ,16,16,(uint8_t*)svc_uuid}},
 [IDX_B_DEC]=DECL(prop_notify),[IDX_B_VAL]=VAL20(breath_uuid,YG_READ_PERM),[IDX_B_CCC]=CCC,
 [IDX_P_DEC]=DECL(prop_notify),[IDX_P_VAL]=VAL20(event_uuid,YG_READ_PERM),[IDX_P_CCC]=CCC,
 [IDX_S_DEC]=DECL(prop_read_notify),[IDX_S_VAL]=VAL20(status_uuid,YG_READ_PERM),[IDX_S_CCC]=CCC,
 [IDX_C_DEC]=DECL(prop_write),[IDX_C_VAL]=VAL8(control_uuid,YG_WRITE_PERM),
 [IDX_A_DEC]=DECL(prop_write),[IDX_A_VAL]=VAL8(ack_uuid,YG_WRITE_PERM),
};
static esp_ble_adv_params_t adv_params={
 .adv_int_min=0x40,.adv_int_max=0x60,.adv_type=ADV_TYPE_IND,
 .own_addr_type=BLE_ADDR_TYPE_PUBLIC,.channel_map=ADV_CHNL_ALL,
 .adv_filter_policy=ADV_FILTER_ALLOW_SCAN_ANY_CON_ANY
};
static esp_ble_adv_data_t adv_data={
 .set_scan_rsp=false,.include_name=false,.include_txpower=false,
 .service_uuid_len=16,.p_service_uuid=(uint8_t*)svc_uuid,
 .flag=ESP_BLE_ADV_FLAG_GEN_DISC|ESP_BLE_ADV_FLAG_BREDR_NOT_SPT
};
static bool permit(const esp_bd_addr_t bda){
 static const esp_bd_addr_t allowed_a={0x68,0xee,0x8f,0x44,0xbd,0xb6};
 return memcmp(bda,allowed_a,sizeof(allowed_a))==0;
}
void yg_b_ble_pair_window(uint32_t seconds){
 (void)seconds;
 ESP_LOGI(TAG,"fixed A whitelist active; GPIO14 does not widen authorization");
}
static bool link_ready(void){
#ifdef CONFIG_YG_BLE_UNENCRYPTED_DEBUG
 return connected&&permit(remote);
#else
 return connected&&permit(remote)&&secure;
#endif
}
bool yg_b_ble_stream_enabled(void){return stream&&link_ready()&&subscribe_b;}
bool yg_b_ble_demo_desired(void){return demo_desired;}
static esp_timer_handle_t s_adv_timer;

static void ble_defer_adv_cb(void *arg){
 (void)arg;
 (void)esp_ble_gap_start_advertising(&adv_params);
}

static void ble_defer_adv(void){
 if(!s_adv_timer){
  const esp_timer_create_args_t args = { .callback = ble_defer_adv_cb, .name = "yg_ble_adv" };
  if(esp_timer_create(&args, &s_adv_timer) != ESP_OK){ s_adv_timer = NULL; return; }
 }
 (void)esp_timer_stop(s_adv_timer);
 (void)esp_timer_start_once(s_adv_timer, 50 * 1000);
}

static void gap_cb(esp_gap_ble_cb_event_t e,esp_ble_gap_cb_param_t *p){ switch(e){
 case ESP_GAP_BLE_ADV_DATA_SET_COMPLETE_EVT:
  (void)esp_ble_gap_start_advertising(&adv_params);break;
 case ESP_GAP_BLE_SEC_REQ_EVT:
  (void)esp_ble_gap_security_rsp(p->ble_security.ble_req.bd_addr,
#ifdef CONFIG_YG_BLE_UNENCRYPTED_DEBUG
    false);
#else
    permit(p->ble_security.ble_req.bd_addr));
#endif
  break;
 case ESP_GAP_BLE_AUTH_CMPL_EVT:
#ifdef CONFIG_YG_BLE_UNENCRYPTED_DEBUG
  ESP_LOGW(TAG,"UNENCRYPTED DEBUG: unexpected authentication event ignored");
#else
  if(p->ble_security.auth_cmpl.success&&
      memcmp(remote,p->ble_security.auth_cmpl.bd_addr,6)==0&&
      permit(remote)){secure=true;ESP_LOGI(TAG,"encrypted GATT link");}
  else if(connected)(void)esp_ble_gap_disconnect(remote);
#endif
  break;
 default:break;
 }
}
static void gatt_cb(esp_gatts_cb_event_t e,esp_gatt_if_t iface,esp_ble_gatts_cb_param_t *p){
 switch(e){
 case ESP_GATTS_REG_EVT:
  if(p->reg.status!=ESP_GATT_OK){ESP_LOGE(TAG,"register failed");return;}
  gatt_if=iface;(void)esp_ble_gatts_create_attr_tab(db,iface,IDX_NB,0);break;
 case ESP_GATTS_CREAT_ATTR_TAB_EVT:
  if(p->add_attr_tab.status==ESP_GATT_OK&&p->add_attr_tab.num_handle==IDX_NB){
    memcpy(handles,p->add_attr_tab.handles,sizeof(handles));
    (void)esp_ble_gatts_start_service(handles[IDX_SVC]);
    (void)esp_ble_gap_config_adv_data(&adv_data);
  }else ESP_LOGE(TAG,"attribute table failed");break;
 case ESP_GATTS_CONNECT_EVT:
  conn_id=p->connect.conn_id;memcpy(remote,p->connect.remote_bda,6);
  connected=true;secure=false;subscribe_b=subscribe_p=subscribe_s=false;
  if(!permit(remote)){
   ESP_LOGW(TAG,"connect from unpermitted peer; disconnecting");
   (void)esp_ble_gap_disconnect(remote);
   break;
  }
#ifdef CONFIG_YG_BLE_UNENCRYPTED_DEBUG
  ESP_LOGW(TAG,"UNENCRYPTED DEBUG: fixed A whitelist matched; link authorized, not authenticated");
#else
  ESP_LOGI(TAG,"fixed A whitelist matched; requesting encryption");
  (void)esp_ble_set_encryption(remote,ESP_BLE_SEC_ENCRYPT);
#endif
  break;
 case ESP_GATTS_DISCONNECT_EVT:
  connected=false;secure=false;subscribe_b=subscribe_p=subscribe_s=false;
  ble_defer_adv();break;
 case ESP_GATTS_WRITE_EVT:
  if(!link_ready()||p->write.is_prep)break;
  if(p->write.handle==handles[IDX_B_CCC]&&p->write.len==2)subscribe_b=p->write.value[0]==1&&p->write.value[1]==0;
  else if(p->write.handle==handles[IDX_P_CCC]&&p->write.len==2)subscribe_p=p->write.value[0]==1&&p->write.value[1]==0;
  else if(p->write.handle==handles[IDX_S_CCC]&&p->write.len==2)subscribe_s=p->write.value[0]==1&&p->write.value[1]==0;
  else if(p->write.handle==handles[IDX_C_VAL]){
    yg_control_t ctrl;
    if(yg_control_unpack(&ctrl,p->write.value,p->write.len)){
      ESP_LOGI(TAG,"ctl RX opcode=%u param=%u cmd=%u",(unsigned)ctrl.opcode,(unsigned)ctrl.param,(unsigned)ctrl.command_id);
      if(ctrl.opcode==1)stream=ctrl.param!=0;
      else if(ctrl.opcode==2){ /* A receives status on next scheduled frame. */ }
      else if(ctrl.opcode==3)demo_desired=(ctrl.param!=0); /* local consent also required */
    }
  }else if(p->write.handle==handles[IDX_A_VAL]){
    yg_ack_t ack;
    if(yg_ack_unpack(&ack,p->write.value,p->write.len)&&queued.event_id==ack.event_id){
      queued.event_id=0;attempts=0;
    }
  }
  break;
 default:break;
 }
}
static void notify(uint16_t handle,const uint8_t *buf,uint16_t n,bool subscribed){
 if(link_ready()&&subscribed&&gatt_if!=ESP_GATT_IF_NONE&&handle){
  (void)esp_ble_gatts_set_attr_value(handle,n,(uint8_t*)buf);
  (void)esp_ble_gatts_send_indicate(gatt_if,conn_id,handle,n,(uint8_t*)buf,false);
 }
}
void yg_b_ble_send_breath(const yg_breath_t *b){
 uint8_t data[20];if(stream&&yg_breath_pack(data,b))notify(handles[IDX_B_VAL],data,20,subscribe_b);
}
void yg_b_ble_send_status(const yg_status_t *s){
 uint8_t data[20];if(yg_status_pack(data,s)){
   if(handles[IDX_S_VAL]) (void)esp_ble_gatts_set_attr_value(handles[IDX_S_VAL],20,data);
   notify(handles[IDX_S_VAL],data,20,subscribe_s);
 }
}
void yg_b_ble_queue_pressure(const yg_pressure_t *p){
 if(!p||queued.event_id){
  return;
 }
 queued=*p;
 attempts=0;
 last_attempt=0;
}
void yg_b_ble_poll(uint32_t now){
 if(!queued.event_id)return;
 if((uint32_t)(now-queued.uptime_ms)>queued.ttl_ms || attempts>=5){queued.event_id=0;return;}
 if(link_ready()&&subscribe_p&&(!last_attempt||(uint32_t)(now-last_attempt)>=1000)){
  uint8_t data[20];if(yg_pressure_pack(data,&queued)){
   notify(handles[IDX_P_VAL],data,20,true);last_attempt=now;++attempts;
  }
 }
}
esp_err_t yg_b_ble_start(void){
 esp_bt_controller_config_t cfg=BT_CONTROLLER_INIT_CONFIG_DEFAULT();
 esp_err_t ret=esp_bt_controller_init(&cfg);if(ret!=ESP_OK)return ret;
 ret=esp_bt_controller_enable(ESP_BT_MODE_BLE);if(ret!=ESP_OK)return ret;
 ret=esp_bluedroid_init();if(ret!=ESP_OK)return ret;
 ret=esp_bluedroid_enable();if(ret!=ESP_OK)return ret;
#ifdef CONFIG_YG_BLE_UNENCRYPTED_DEBUG
 ESP_LOGW(TAG,"UNENCRYPTED DEBUG: fixed A only; no confidentiality or authenticated identity");
#else
 uint8_t sec=ESP_LE_AUTH_REQ_SC_BOND,io=ESP_IO_CAP_NONE;
 (void)esp_ble_gap_set_security_param(ESP_BLE_SM_AUTHEN_REQ_MODE,&sec,1);
 (void)esp_ble_gap_set_security_param(ESP_BLE_SM_IOCAP_MODE,&io,1);
#endif
 (void)esp_ble_gap_register_callback(gap_cb);
 (void)esp_ble_gatts_register_callback(gatt_cb);
 (void)esp_ble_gap_set_device_name("YG-Sense");
 return esp_ble_gatts_app_register(APP_ID);
}
