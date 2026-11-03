#include "yg_guidance.h"
#include <string.h>
#include <math.h>
#define SYNC_MS 4000u
#define BREATH_STALE_MS 1500u
#define ABORT_MS 3000u
#define GUIDANCE_MIN_BPM 6.0f
/* Max rate change: 0.2 BPM / 10 seconds, never force if no reliable breath. */
void yg_guidance_init(yg_guidance_t *g){if(g){memset(g,0,sizeof(*g));g->enabled=true;}}
void yg_guidance_enable(yg_guidance_t *g,bool enabled,uint32_t now){if(!g)return;g->enabled=enabled;if(!enabled){g->state=YG_IDLE;g->target_bpm=0;g->since_ms=now;}}
void yg_guidance_focus(yg_guidance_t *g,bool focus,uint32_t now){if(!g)return;g->focus=focus;if(focus&&g->state!=YG_IDLE){g->state=YG_COOLDOWN;g->since_ms=now;g->target_bpm=0;}}
void yg_guidance_set_care(yg_guidance_t *g,bool active){if(g)g->care_active=active;}
bool yg_guidance_request(yg_guidance_t *g,uint32_t now){
 if(!g||!g->enabled||g->focus||g->care_active||g->state!=YG_IDLE)return false;
 g->state=YG_SYNCING;g->since_ms=now;g->last_valid_ms=0;g->valid_count=0;g->target_bpm=0;return true;
}
void yg_guidance_breath(yg_guidance_t *g,const yg_breath_t *b,uint32_t now){
 if(!g||!b)return;
 if(!(b->flags&YG_FLAG_BPM)||!(b->flags&YG_FLAG_CONFIDENCE)||b->confidence_pct<65||
 b->sample_age_ms>BREATH_STALE_MS||b->bpm_x10<60||b->bpm_x10>350)return;
 const float bpm=(float)b->bpm_x10/10.0f;
 g->measured_bpm=(g->measured_bpm>0.0f)?0.8f*g->measured_bpm+0.2f*bpm:bpm;
 g->last_valid_ms=now;if(g->valid_count<255)g->valid_count++;
 if(g->state==YG_SYNCING&&g->valid_count>=10&&(uint32_t)(now-g->since_ms)>=SYNC_MS){
   g->state=YG_GUIDING;g->since_ms=now;g->last_adjust_ms=now;g->target_bpm=g->measured_bpm;
 }
}
void yg_guidance_tick(yg_guidance_t *g,uint32_t now){
 if(!g||g->state==YG_IDLE)return;
 if(!g->enabled||g->focus){g->state=YG_COOLDOWN;g->since_ms=now;g->target_bpm=0;return;}
 if(g->state==YG_COOLDOWN){if((uint32_t)(now-g->since_ms)>=5000){g->state=YG_IDLE;g->target_bpm=0;}return;}
 if(g->last_valid_ms==0||(uint32_t)(now-g->last_valid_ms)>ABORT_MS){
   if((uint32_t)(now-g->since_ms)>ABORT_MS){g->state=YG_COOLDOWN;g->since_ms=now;g->target_bpm=0;}return;
 }
 if(g->state==YG_GUIDING&&!g->care_active&& (uint32_t)(now-g->last_adjust_ms)>=10000 &&
 (uint32_t)(now-g->last_valid_ms)<BREATH_STALE_MS){
   g->last_adjust_ms=now;
   /* If user no longer entrains, never push faster/deeper. */
   if(g->measured_bpm>g->target_bpm+3.0f){g->state=YG_COOLDOWN;g->since_ms=now;g->target_bpm=0;return;}
   if(g->target_bpm>GUIDANCE_MIN_BPM)g->target_bpm=fmaxf(GUIDANCE_MIN_BPM,g->target_bpm-0.2f);
 }
}
uint16_t yg_guidance_period_100ms(const yg_guidance_t *g){
 if(!g||g->target_bpm<=0||g->state!=YG_GUIDING)return 0;
 float v=600.0f/g->target_bpm;return v>=65535?65535:(uint16_t)(v+0.5f);
}
const char *yg_guidance_state_name(yg_guidance_state_t s){
 switch(s){case YG_IDLE:return "idle";case YG_SYNCING:return "syncing";case YG_GUIDING:return "guiding";case YG_COOLDOWN:return "cooldown";default:return "idle";}
}
