#include "yg_preview_lamp.h"
#include <string.h>
#include <ctype.h>
static int preset_number(const char *v){
 if(!v)return 0;
 if(strcmp(v,"miss")==0)return 1;
 if(strcmp(v,"meal")==0)return 2;
 if(strcmp(v,"rest")==0)return 3;
 if(strcmp(v,"cheer")==0)return 4;
 return 0;
}
static bool safe_nonce(const char *v){
 if(!v)return false;
 size_t n=strlen(v);
 if(n<8||n>40)return false;
 for(size_t i=0;i<n;i++)if(!((v[i]>='0'&&v[i]<='9')||
  (v[i]>='A'&&v[i]<='Z')||(v[i]>='a'&&v[i]<='z')||v[i]=='-'))return false;
 return true;
}
void yg_preview_cancel(yg_preview_lamp_t *s){if(s)s->preset=0;}
bool yg_preview_apply(yg_preview_lamp_t *s,const char *preset,const char *nonce,uint32_t now){
 if(!s||!safe_nonce(nonce))return false;
 int n=preset_number(preset);if(!n)return false;
 if(strcmp(s->nonce,nonce)==0)return s->preset==n; /* replay is idempotent, never restarts */
 s->preset=(uint8_t)n;
 s->started_ms=now;
 (void)strcpy(s->nonce,nonce);
 return true;
}
bool yg_preview_render(const yg_preview_lamp_t *s,uint32_t now,uint8_t rgb[3]){
 if(!s||!rgb||s->preset<1||s->preset>4)return false;
 static const uint16_t periods[]={0,6000,2800,6000,2100};
 static const uint8_t cycles[]={0,1,2,1,2};
 static const uint8_t brightness[]={0,12,12,9,16};
 static const uint8_t colors[][2][3]={
  {{0,0,0},{0,0,0}},
  {{230,180,183},{230,180,183}},
  {{232,165,104},{255,240,213}},
  {{224,171,118},{224,171,118}},
  {{230,180,183},{230,180,183}},
 };
 uint8_t p=s->preset;
 uint32_t elapsed=(uint32_t)(now-s->started_ms);
 uint32_t period=periods[p];
 if(elapsed>=period*(uint32_t)cycles[p])return false;
 uint32_t phase=(elapsed%period)*2000u/period;
 uint32_t rise=(phase<=1000u)?phase:2000u-phase;
 uint32_t level=(p==3)?1000u-rise*700u/1000u:
  (p==4?100u+rise*900u/1000u:200u+rise*800u/1000u);
 uint8_t color=(uint8_t)((elapsed/period)%2u);
 for(int i=0;i<3;i++){
  rgb[i]=(uint8_t)((uint32_t)colors[p][color][i]*brightness[p]*level/100000u);
 }
 return true;
}
