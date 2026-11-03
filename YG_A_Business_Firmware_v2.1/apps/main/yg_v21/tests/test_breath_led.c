#include "yg_breath_led.h"
#include <assert.h>
#include <stdio.h>
#include <string.h>
static yg_a_snapshot_t init(void){
 yg_a_snapshot_t s;memset(&s,0,sizeof(s));
 s.guidance.enabled=true;s.guidance.state=YG_SYNCING;s.guidance.since_ms=1000;
 s.guidance.last_valid_ms=10000;s.guidance.measured_bpm=12.0f;
 s.ble_connected=true;s.have_breath=true;s.last_breath_ms=10000;
 s.breath.flags=YG_FLAG_BPM|YG_FLAG_CONFIDENCE;
 s.breath.bpm_x10=120;s.breath.confidence_pct=85;s.breath.sample_age_ms=100;
 return s;
}
int main(void){
 yg_a_snapshot_t s=init();uint8_t rgb[3];uint16_t period=0;
 assert(yg_breath_led_frame(&s,10000,rgb,&period));assert(period==50);
 assert(rgb[0]>=10&&rgb[0]<=40);
 assert(!yg_breath_led_frame(&s,11600,rgb,&period)); /* stale sample */
 s.guidance.state=YG_GUIDING;s.guidance.target_bpm=10.0f;
 assert(yg_breath_led_frame(&s,10000,rgb,&period));assert(period==60);
 s.guidance.focus=true;assert(!yg_breath_led_frame(&s,10000,rgb,&period));s.guidance.focus=false;
 s.guidance.care_active=true;assert(!yg_breath_led_frame(&s,10000,rgb,&period));s.guidance.care_active=false;
 s.breath.confidence_pct=64;assert(!yg_breath_led_frame(&s,10000,rgb,&period));s.breath.confidence_pct=85;
 s.breath.sample_age_ms=1501;assert(!yg_breath_led_frame(&s,10000,rgb,&period));s.breath.sample_age_ms=100;
 s.ble_connected=false;assert(!yg_breath_led_frame(&s,10000,rgb,&period));s.ble_connected=true;
 s.guidance.enabled=false;assert(!yg_breath_led_frame(&s,10000,rgb,&period));s.guidance.enabled=true;
 s.breath.flags|=YG_FLAG_WAVE;s.guidance.state=YG_SYNCING;s.breath.wave_q15=32767;
 assert(yg_breath_led_frame(&s,10000,rgb,&period));assert(rgb[0]<=40);
 puts("yg_breath_led PASS");return 0;
}
