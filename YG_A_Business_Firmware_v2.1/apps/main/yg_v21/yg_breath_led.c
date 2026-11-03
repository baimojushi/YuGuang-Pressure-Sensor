#include "yg_breath_led.h"

#define MAX_SAMPLE_AGE_MS 1500u
/* Warm, low-luminance guide. The actual brightness never exceeds 16%. */
bool yg_breath_led_frame(const yg_a_snapshot_t *s,uint32_t now,uint8_t rgb[3],uint16_t *period_100ms){
 if(!s||!rgb)return false;
 const yg_guidance_t *g=&s->guidance;
 const yg_breath_t *b=&s->breath;
 if(!g->enabled||g->focus||g->care_active||!s->ble_connected||!s->have_breath||
    (g->state!=YG_SYNCING&&g->state!=YG_GUIDING)||
    (uint32_t)(now-s->last_breath_ms)>MAX_SAMPLE_AGE_MS||
    (uint32_t)(now-g->last_valid_ms)>MAX_SAMPLE_AGE_MS||
    b->sample_age_ms>MAX_SAMPLE_AGE_MS||b->confidence_pct<65||
    (b->flags&(YG_FLAG_BPM|YG_FLAG_CONFIDENCE))!=(YG_FLAG_BPM|YG_FLAG_CONFIDENCE)||
    b->bpm_x10<60||b->bpm_x10>350)return false;
 uint32_t period_ms;
 if(g->state==YG_GUIDING){
  uint16_t p=yg_guidance_period_100ms(g);
  if(p<17||p>100)return false; /* 6..35 BPM; 1.7..10s */
  period_ms=(uint32_t)p*100u;
 }else{
  period_ms=600000u/(uint32_t)b->bpm_x10;
 }
 if(period_ms<1700||period_ms>10000)return false;
 if(period_100ms)*period_100ms=(uint16_t)((period_ms+50u)/100u);
 uint32_t phase=(uint32_t)(now-g->since_ms)%period_ms;
 uint32_t envelope;
 /* Waveform is only used while syncing and only with the same fresh, high-quality sample. */
 if(g->state==YG_SYNCING&&(b->flags&YG_FLAG_WAVE)){
  envelope=(uint32_t)((int32_t)b->wave_q15+32768)/65u;
  if(envelope>1000u)envelope=1000u;
 }else{
  uint32_t half=period_ms/2u;
  envelope=(phase<=half?phase:period_ms-phase)*1000u/half;
 }
 uint32_t brightness=4u+(12u*envelope)/1000u; /* 4..16 percent */
 rgb[0]=(uint8_t)(255u*brightness/100u);
 rgb[1]=(uint8_t)(158u*brightness/100u);
 rgb[2]=(uint8_t)(92u*brightness/100u);
 return true;
}
