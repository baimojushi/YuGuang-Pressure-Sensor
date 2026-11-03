#include "yg_b_uart_fallback.h"

#include "driver/uart.h"
#include "esp_log.h"
#include <string.h>

#define TAG "yg-b-uart"
#define YG_UART_SOF0 0x59u
#define YG_UART_SOF1 0x47u
#define YG_UART_VERSION 1u
#define YG_UART_TYPE_BREATH 1u
#define YG_UART_TYPE_PRESSURE 2u
#define YG_UART_TYPE_STATUS 3u
#define YG_UART_PAYLOAD_BYTES 20u
#define YG_UART_FRAME_BYTES 27u

static const uart_port_t s_port=UART_NUM_1;
static bool s_started;

static uint16_t crc16_update(uint16_t crc,uint8_t value){
 crc^=(uint16_t)value<<8;
 for(unsigned i=0;i<8;i++)crc=(crc&0x8000u)?(uint16_t)((crc<<1)^0x1021u):(uint16_t)(crc<<1);
 return crc;
}
static void send_frame(uint8_t type,const uint8_t payload[YG_UART_PAYLOAD_BYTES]){
 if(!s_started||!payload)return;
 uint8_t frame[YG_UART_FRAME_BYTES]={YG_UART_SOF0,YG_UART_SOF1,YG_UART_VERSION,type,YG_UART_PAYLOAD_BYTES};
 memcpy(frame+5,payload,YG_UART_PAYLOAD_BYTES);
 uint16_t crc=0xffffu;
 for(unsigned i=2;i<25;i++)crc=crc16_update(crc,frame[i]);
 frame[25]=(uint8_t)crc;frame[26]=(uint8_t)(crc>>8);
 (void)uart_write_bytes(s_port,frame,sizeof(frame));
}
esp_err_t yg_b_uart_fallback_start(void){
 if(s_started)return ESP_OK;
 uart_config_t config={
  .baud_rate=YG_FALLBACK_BAUD,
  .data_bits=UART_DATA_8_BITS,
  .parity=UART_PARITY_DISABLE,
  .stop_bits=UART_STOP_BITS_1,
  .flow_ctrl=UART_HW_FLOWCTRL_DISABLE,
  .source_clk=UART_SCLK_DEFAULT,
 };
 esp_err_t err=uart_param_config(s_port,&config);if(err!=ESP_OK)return err;
 err=uart_set_pin(s_port,YG_FALLBACK_TX_GPIO,UART_PIN_NO_CHANGE,UART_PIN_NO_CHANGE,UART_PIN_NO_CHANGE);
 if(err!=ESP_OK)return err;
 err=uart_driver_install(s_port,512,512,0,NULL,0);if(err!=ESP_OK)return err;
 s_started=true;
 ESP_LOGI(TAG,"fallback TX ready uart=%d gpio=%d baud=%d",(int)s_port,YG_FALLBACK_TX_GPIO,YG_FALLBACK_BAUD);
 return ESP_OK;
}
void yg_b_uart_send_breath(const yg_breath_t *value){
 uint8_t payload[YG_UART_PAYLOAD_BYTES];if(value&&yg_breath_pack(payload,value))send_frame(YG_UART_TYPE_BREATH,payload);
}
void yg_b_uart_send_pressure(const yg_pressure_t *value){
 uint8_t payload[YG_UART_PAYLOAD_BYTES];if(value&&yg_pressure_pack(payload,value))send_frame(YG_UART_TYPE_PRESSURE,payload);
}
void yg_b_uart_send_status(const yg_status_t *value){
 uint8_t payload[YG_UART_PAYLOAD_BYTES];if(value&&yg_status_pack(payload,value))send_frame(YG_UART_TYPE_STATUS,payload);
}
