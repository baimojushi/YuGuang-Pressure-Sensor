#include "yg_iface.h"
#include <string.h>
static void wr16(uint8_t *p,uint16_t v){p[0]=(uint8_t)v;p[1]=(uint8_t)(v>>8);}
static void wr32(uint8_t *p,uint32_t v){wr16(p,(uint16_t)v);wr16(p+2,(uint16_t)(v>>16));}
static uint16_t rd16(const uint8_t *p){return (uint16_t)(p[0]|((uint16_t)p[1]<<8));}
static uint32_t rd32(const uint8_t *p){return (uint32_t)rd16(p)|((uint32_t)rd16(p+2)<<16);}
bool yg_breath_pack(uint8_t out[20],const yg_breath_t *v){
 if(!out||!v||v->stage>3||v->confidence_pct>100|| (v->progress_permille!=65535&&v->progress_permille>1000))return false;
 memset(out,0,20);out[0]=1;out[1]=v->flags&15;wr16(out+2,v->seq);wr32(out+4,v->uptime_ms);
 wr16(out+8,(uint16_t)v->wave_q15);wr16(out+10,v->bpm_x10);out[12]=v->stage;out[13]=v->confidence_pct;
 wr16(out+14,v->progress_permille);wr16(out+16,v->sample_age_ms);return true;
}
bool yg_breath_unpack(yg_breath_t *out,const uint8_t *p,size_t n){
 if(!out||!p||n!=20||p[0]!=1||p[1]&~15||rd16(p+18)!=0||p[12]>3||p[13]>100)return false;
 uint16_t progress=rd16(p+14);if(progress>1000&&progress!=65535)return false;
 yg_breath_t v={.flags=p[1],.seq=rd16(p+2),.uptime_ms=rd32(p+4),.wave_q15=(int16_t)rd16(p+8),
   .bpm_x10=rd16(p+10),.stage=p[12],.confidence_pct=p[13],.progress_permille=progress,.sample_age_ms=rd16(p+16)};
 *out=v;return true;
}
bool yg_pressure_pack(uint8_t out[20],const yg_pressure_t *v){
 if(!out||!v||!v->event_id||!v->ttl_ms||v->ttl_ms>10000||v->confidence_pct>100)return false;
 memset(out,0,20);out[0]=1;out[1]=YG_EVENT_PRESSURE_FALL;wr32(out+2,v->event_id);wr16(out+6,v->seq);
 wr32(out+8,v->uptime_ms);wr16(out+12,v->score_x10);out[14]=v->confidence_pct;out[15]=v->flags;wr16(out+16,v->ttl_ms);return true;
}
bool yg_pressure_unpack(yg_pressure_t *out,const uint8_t *p,size_t n){
 if(!out||!p||n!=20||p[0]!=1||p[1]!=YG_EVENT_PRESSURE_FALL||rd16(p+18)!=0||p[14]>100)return false;
 yg_pressure_t v={.event_id=rd32(p+2),.seq=rd16(p+6),.uptime_ms=rd32(p+8),.score_x10=rd16(p+12),
 .confidence_pct=p[14],.flags=p[15],.ttl_ms=rd16(p+16)};
 if(!v.event_id||v.ttl_ms==0||v.ttl_ms>10000)return false;
 *out=v;return true;
}
bool yg_status_pack(uint8_t out[20],const yg_status_t *v){
 if(!out||!v)return false;
 memset(out,0,20);out[0]=1;out[1]=v->radar;out[2]=v->pose;out[3]=v->fusion;
 out[4]=v->demo_auth;out[5]=v->flags;wr32(out+6,v->boot_id);wr32(out+10,v->uptime_ms);
 wr16(out+14,v->dropped);wr16(out+16,v->phase_hz_x10);return true;
}
bool yg_status_unpack(yg_status_t *out,const uint8_t *p,size_t n){
 if(!out||!p||n!=20||p[0]!=1||rd16(p+18)!=0)return false;
 *out=(yg_status_t){.radar=p[1],.pose=p[2],.fusion=p[3],.demo_auth=p[4],.flags=p[5],
 .boot_id=rd32(p+6),.uptime_ms=rd32(p+10),.dropped=rd16(p+14),.phase_hz_x10=rd16(p+16)};return true;
}
bool yg_control_pack(uint8_t out[8],const yg_control_t *v){
 if(!out||!v||v->opcode<1||v->opcode>3)return false;
 out[0]=1;out[1]=v->opcode;wr16(out+2,v->param);wr32(out+4,v->command_id);return true;
}
bool yg_control_unpack(yg_control_t *out,const uint8_t *p,size_t n){
 if(!out||!p||n!=8||p[0]!=1||p[1]<1||p[1]>3)return false;
 *out=(yg_control_t){.opcode=p[1],.param=rd16(p+2),.command_id=rd32(p+4)};return true;
}
bool yg_ack_pack(uint8_t out[8],const yg_ack_t *v){
 if(!out||!v||v->kind!=1||v->result>2||!v->event_id)return false;
 memset(out,0,8);out[0]=1;out[1]=v->kind;wr32(out+2,v->event_id);out[6]=v->result;return true;
}
bool yg_ack_unpack(yg_ack_t *out,const uint8_t *p,size_t n){
 if(!out||!p||n!=8||p[0]!=1||p[1]!=1||p[6]>2||p[7]!=0||rd32(p+2)==0)return false;
 *out=(yg_ack_t){.kind=p[1],.event_id=rd32(p+2),.result=p[6]};return true;
}
bool yg_event_expired(uint32_t event_uptime,uint16_t ttl,uint32_t status_uptime){
 return ttl==0||ttl>10000||((uint32_t)(status_uptime-event_uptime)>ttl &&
 (uint32_t)(status_uptime-event_uptime)<0x80000000u);
}
