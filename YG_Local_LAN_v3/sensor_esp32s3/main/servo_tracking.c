#include "servo_tracking.h"
#include "sdkconfig.h"
#include "driver/ledc.h"
#include "esp_log.h"
#include "esp_check.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include <math.h>
#include <stdint.h>

#define SERVO_PWM_HZ 50
#define SERVO_PWM_BITS LEDC_TIMER_14_BIT
#define SERVO_TIMER LEDC_TIMER_0
#define SERVO_CHANNEL LEDC_CHANNEL_0
#define SERVO_DUTY_FULL ((1U << 14) - 1U)
#define SERVO_PULSE_LOW 1000U
#define SERVO_PULSE_HIGH 2000U
#define SERVO_TICK_MS 40
#define SERVO_MAX_STEP_DEG 2.0f

static const char *TAG = "yg_servo";
static portMUX_TYPE s_mux = portMUX_INITIALIZER_UNLOCKED;
static float s_current = CONFIG_YG_SERVO_HOME_DEG;
static float s_target = CONFIG_YG_SERVO_HOME_DEG;
static int64_t s_valid_until_us = 0;

static float clamp_angle(float value)
{
    if (value < CONFIG_YG_SERVO_MIN_DEG) return CONFIG_YG_SERVO_MIN_DEG;
    if (value > CONFIG_YG_SERVO_MAX_DEG) return CONFIG_YG_SERVO_MAX_DEG;
    return value;
}

static void write_angle(float angle)
{
    /* Default SG90-safe soft range: 1000..2000us at 50 Hz.
       Verify direction and physical stops on your exact installation. */
    const uint32_t pulse_us = SERVO_PULSE_LOW +
        (uint32_t)lroundf(clamp_angle(angle) / 180.0f *
                          (SERVO_PULSE_HIGH - SERVO_PULSE_LOW));
    const uint32_t duty = (uint32_t)(((uint64_t)pulse_us * SERVO_DUTY_FULL) / 20000ULL);
    ESP_ERROR_CHECK(ledc_set_duty(LEDC_LOW_SPEED_MODE, SERVO_CHANNEL, duty));
    ESP_ERROR_CHECK(ledc_update_duty(LEDC_LOW_SPEED_MODE, SERVO_CHANNEL));
}

static void motor_task(void *arg)
{
    (void)arg;
    for (;;) {
        float current;
        portENTER_CRITICAL(&s_mux);
        /* No new data -> HOLD, never sweep/search blindly. */
        if (esp_timer_get_time() > s_valid_until_us) s_target = s_current;
        float step = s_target - s_current;
        if (step > SERVO_MAX_STEP_DEG) step = SERVO_MAX_STEP_DEG;
        if (step < -SERVO_MAX_STEP_DEG) step = -SERVO_MAX_STEP_DEG;
        s_current = clamp_angle(s_current + step);
        current = s_current;
        portEXIT_CRITICAL(&s_mux);
        write_angle(current);
        vTaskDelay(pdMS_TO_TICKS(SERVO_TICK_MS));
    }
}

esp_err_t servo_tracking_start(void)
{
    if (CONFIG_YG_SERVO_MIN_DEG >= CONFIG_YG_SERVO_MAX_DEG) return ESP_ERR_INVALID_ARG;
    ledc_timer_config_t timer = {
        .speed_mode = LEDC_LOW_SPEED_MODE, .duty_resolution = SERVO_PWM_BITS,
        .timer_num = SERVO_TIMER, .freq_hz = SERVO_PWM_HZ,
        .clk_cfg = LEDC_AUTO_CLK
    };
    ESP_RETURN_ON_ERROR(ledc_timer_config(&timer), TAG, "LEDC timer");
    ledc_channel_config_t channel = {
        .gpio_num = CONFIG_YG_SERVO_GPIO, .speed_mode = LEDC_LOW_SPEED_MODE,
        .channel = SERVO_CHANNEL, .intr_type = LEDC_INTR_DISABLE,
        .timer_sel = SERVO_TIMER, .duty = 0, .hpoint = 0
    };
    ESP_RETURN_ON_ERROR(ledc_channel_config(&channel), TAG, "LEDC channel");
    s_current = s_target = clamp_angle(CONFIG_YG_SERVO_HOME_DEG);
    s_valid_until_us = esp_timer_get_time();
    write_angle(s_current);
    if (xTaskCreate(motor_task, "servo_smooth", 3072, NULL, 5, NULL) != pdPASS) return ESP_ERR_NO_MEM;
    ESP_LOGI(TAG, "servo ready GPIO%d angle %.1f safe %d..%d deg", CONFIG_YG_SERVO_GPIO,
             (double)s_current, CONFIG_YG_SERVO_MIN_DEG, CONFIG_YG_SERVO_MAX_DEG);
    return ESP_OK;
}

float servo_tracking_angle(void)
{
    portENTER_CRITICAL(&s_mux);
    const float current = s_current;
    portEXIT_CRITICAL(&s_mux);
    return current;
}

void servo_tracking_hold(void)
{
    portENTER_CRITICAL(&s_mux);
    s_target = s_current;
    s_valid_until_us = esp_timer_get_time();
    portEXIT_CRITICAL(&s_mux);
}

bool servo_tracking_command(float target, unsigned ttl_ms)
{
    if (!isfinite(target) || ttl_ms < 100 || ttl_ms > 3000) return false;
    if (target < CONFIG_YG_SERVO_MIN_DEG || target > CONFIG_YG_SERVO_MAX_DEG) return false;
    portENTER_CRITICAL(&s_mux);
    s_target = target;
    s_valid_until_us = esp_timer_get_time() + (int64_t)ttl_ms * 1000;
    portEXIT_CRITICAL(&s_mux);
    return true;
}
