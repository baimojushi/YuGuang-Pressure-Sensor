#include "yg_fusion.h"
#include <string.h>
#include <math.h>
void yg_fusion_init(yg_fusion_t *s){if(s)memset(s,0,sizeof(*s));}
bool yg_fusion_step(yg_fusion_t *s,const yg_fusion_input_t *v,uint32_t now){
 if(!s||!v||!v->r_ok||!v->p_ok||!v->f_ok||!isfinite(v->r)||!isfinite(v->p)||!isfinite(v->f)||
   v->r<0||v->r>100||v->p<0||v->p>100||v->f<0||v->f>100)return false;
 float score=0.40f*v->r+0.35f*v->p+0.25f*v->f;
 s->score=score;
 if((int32_t)(now-s->quiet_until)<0)return false;
 if(score>=65.0f){
  if(!s->above_since)s->above_since=now;
  if((uint32_t)(now-s->above_since)>=15000){s->armed=true;if(score>s->peak)s->peak=score;}
  s->fall_since=0;return false;
 }
 if(!s->armed){s->above_since=0;return false;}
 if(s->peak-score<10.0f){s->fall_since=0;return false;}
 if(!s->fall_since)s->fall_since=now;
 if((uint32_t)(now-s->fall_since)<3000)return false;
 s->above_since=s->fall_since=0;s->peak=0;s->armed=false;s->quiet_until=now+60000;
 return true;
}
