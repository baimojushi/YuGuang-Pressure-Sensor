#include "yg_a_uart_fallback.h"

#include "yg_a_app.h"
#include "yg_a_ble.h"
#include "yg_iface.h"
#include "driver/uart.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include <string.h>

#define TAG "yg-a-uart"
#define YG_UART_SOF0 0x59u
#define YG_UART_SOF1 0x47u
#define YG_UART_VERSION 1u
#define YG_UART_TYPE_BREATH 1u
#define YG_UART_TYPE_PRESSURE 2u
#define YG_UART_TYPE_STATUS 3u
#define YG_UART_PAYLOAD_BYTES 20u
#define YG_UART_STALE_MS 3000u
#define EVENT_HISTORY 32u

static const uart_port_t s_port=UART_NUM_2;
static portMUX_TYPE s_lock=portMUX_INITIALIZER_UNLOCKED;
static uint32_t s_last_status_ms,s_status_uptime,s_boot_id;
static uint32_t s_seen_events[EVENT_HISTORY],s_seen_boots[EVENT_HISTORY];
static unsigned s_seen_cursor;

static uint32_t now_ms(void){return (uint32_t)(esp_timer_get_time()/1000ULL);}
static uint16_t crc16_update(uint16_t crc,uint8_t value){
 crc^=(uint16_t)value<<8;
 for(unsigned i=0;i<8;i++)crc=(crc&0x8000u)?(uint16_t)((crc<<1)^0x1021u):(uint16_t)(crc<<1);
 return crc;
}
bool yg_a_uart_fallback_active(void){
 uint32_t last;
 portENTER_CRITICAL(&s_lock);last=s_last_status_ms;portEXIT_CRITICAL(&s_lock);
 return !yg_a_ble_data_fresh(YG_UART_STALE_MS)&&last&&(uint32_t)(now_ms()-last)<YG_UART_STALE_MS;
}
static void handle_status(const uint8_t *payload){
 yg_status_t value;if(!yg_status_unpack(&value,payload,YG_UART_PAYLOAD_BYTES)||!value.boot_id)return;
 if(yg_a_ble_data_fresh(YG_UART_STALE_MS))return;
 uint32_t now=now_ms();
 portENTER_CRITICAL(&s_lock);
 s_boot_id=value.boot_id;s_status_uptime=value.uptime_ms;s_last_status_ms=now;
 portEXIT_CRITICAL(&s_lock);
 yg_a_app_ble_connected(true,value.boot_id);
}
static void handle_breath(const uint8_t *payload){
 if(!yg_a_uart_fallback_active())return;
 yg_breath_t value;if(yg_breath_unpack(&value,payload,YG_UART_PAYLOAD_BYTES))yg_a_app_on_breath(&value);
}
static void handle_pressure(const uint8_t *payload){
 if(!yg_a_uart_fallback_active())return;
 yg_pressure_t value;if(!yg_pressure_unpack(&value,payload,YG_UART_PAYLOAD_BYTES))return;
 uint32_t boot,uptime;
 portENTER_CRITICAL(&s_lock);boot=s_boot_id;uptime=s_status_uptime;portEXIT_CRITICAL(&s_lock);
 if(!boot||yg_event_expired(value.uptime_ms,value.ttl_ms,uptime))return;
 bool duplicate=false;
 portENTER_CRITICAL(&s_lock);
 for(unsigned i=0;i<EVENT_HISTORY;i++)if(s_seen_boots[i]==boot&&s_seen_events[i]==value.event_id){duplicate=true;break;}
 if(!duplicate){unsigned slot=s_seen_cursor++%EVENT_HISTORY;s_seen_boots[slot]=boot;s_seen_events[slot]=value.event_id;}
 portEXIT_CRITICAL(&s_lock);
 if(!duplicate)yg_a_app_on_pressure(&value);
}
static void handle_frame(uint8_t type,const uint8_t *payload){
 if(type==YG_UART_TYPE_STATUS)handle_status(payload);
 else if(type==YG_UART_TYPE_BREATH)handle_breath(payload);
 else if(type==YG_UART_TYPE_PRESSURE)handle_pressure(payload);
}
static void rx_task(void *arg){
 (void)arg;
 enum {WAIT_SOF0,WAIT_SOF1,READ_VERSION,READ_TYPE,READ_LEN,READ_PAYLOAD,READ_CRC0,READ_CRC1} state=WAIT_SOF0;
 uint8_t type=0,payload[YG_UART_PAYLOAD_BYTES];unsigned pos=0;uint16_t crc=0xffffu,received_crc=0;
 uint8_t input[128];
 for(;;){
  int count=uart_read_bytes(s_port,input,sizeof(input),pdMS_TO_TICKS(100));
  for(int i=0;i<count;i++){
   uint8_t value=input[i];
   switch(state){
    case WAIT_SOF0:if(value==YG_UART_SOF0)state=WAIT_SOF1;break;
    case WAIT_SOF1:state=value==YG_UART_SOF1?READ_VERSION:WAIT_SOF0;break;
    case READ_VERSION:
     if(value!=YG_UART_VERSION){state=WAIT_SOF0;break;}
     crc=crc16_update(0xffffu,value);state=READ_TYPE;break;
    case READ_TYPE:
     if(value<YG_UART_TYPE_BREATH||value>YG_UART_TYPE_STATUS){state=WAIT_SOF0;break;}
     type=value;crc=crc16_update(crc,value);state=READ_LEN;break;
    case READ_LEN:
     if(value!=YG_UART_PAYLOAD_BYTES){state=WAIT_SOF0;break;}
     crc=crc16_update(crc,value);pos=0;state=READ_PAYLOAD;break;
    case READ_PAYLOAD:
     payload[pos++]=value;
     crc=crc16_update(crc,value);
     if(pos==YG_UART_PAYLOAD_BYTES)state=READ_CRC0;
     break;
    case READ_CRC0:received_crc=value;state=READ_CRC1;break;
    case READ_CRC1:
     received_crc|=(uint16_t)value<<8;
     if(received_crc==crc)handle_frame(type,payload);
     state=WAIT_SOF0;break;
   }
  }
  uint32_t now=now_ms();bool expired=false;
  portENTER_CRITICAL(&s_lock);
  if(s_last_status_ms&&(uint32_t)(now-s_last_status_ms)>=YG_UART_STALE_MS){s_last_status_ms=0;s_boot_id=0;s_status_uptime=0;expired=true;}
  portEXIT_CRITICAL(&s_lock);
  if(expired&&!yg_a_ble_data_fresh(YG_UART_STALE_MS))yg_a_app_ble_connected(false,0);
 }
}
esp_err_t yg_a_uart_fallback_start(void){
 uart_config_t config={
  .baud_rate=YG_FALLBACK_BAUD,
  .data_bits=UART_DATA_8_BITS,
  .parity=UART_PARITY_DISABLE,
  .stop_bits=UART_STOP_BITS_1,
  .flow_ctrl=UART_HW_FLOWCTRL_DISABLE,
  .source_clk=UART_SCLK_DEFAULT,
 };
 esp_err_t err=uart_param_config(s_port,&config);if(err!=ESP_OK)return err;
 err=uart_set_pin(s_port,UART_PIN_NO_CHANGE,YG_FALLBACK_RX_GPIO,UART_PIN_NO_CHANGE,UART_PIN_NO_CHANGE);
 if(err!=ESP_OK)return err;
 err=uart_driver_install(s_port,2048,0,0,NULL,0);if(err!=ESP_OK)return err;
 if(xTaskCreate(rx_task,"yg_uart_rx",4096,NULL,5,NULL)!=pdPASS){uart_driver_delete(s_port);return ESP_ERR_NO_MEM;}
 ESP_LOGI(TAG,"fallback RX ready uart=%d gpio=%d baud=%d",(int)s_port,YG_FALLBACK_RX_GPIO,YG_FALLBACK_BAUD);
 return ESP_OK;
}
