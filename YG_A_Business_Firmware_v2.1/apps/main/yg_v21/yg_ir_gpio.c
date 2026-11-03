/* GPIO5 IR active high; 30 ms debounce, independent 100 ms retrigger inhibition. */
#include "yg_ir_gpio.h"
#include "yg_care.h"
#include "driver/gpio.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#define IR_GPIO GPIO_NUM_5
static void task(void *arg){
 (void)arg;uint32_t high_ms=0;bool latched=false;
 for(;;){
  bool high=gpio_get_level(IR_GPIO)!=0;
  if(high){if(high_ms<1000)high_ms+=10;
    if(high_ms>=30&&!latched){latched=true;yg_care_ir_high((uint64_t)(esp_timer_get_time()/1000));}}
  else{high_ms=0;latched=false;}
  vTaskDelay(pdMS_TO_TICKS(10));
 }
}
esp_err_t yg_ir_gpio_start(void){
 gpio_config_t cfg={.pin_bit_mask=1ULL<<IR_GPIO,.mode=GPIO_MODE_INPUT,
 .pull_up_en=GPIO_PULLUP_DISABLE,.pull_down_en=GPIO_PULLDOWN_ENABLE,.intr_type=GPIO_INTR_DISABLE};
 esp_err_t err=gpio_config(&cfg);if(err!=ESP_OK)return err;
 return xTaskCreate(task,"yg_ir_gpio5",2048,NULL,4,NULL)==pdPASS?ESP_OK:ESP_ERR_NO_MEM;
}
