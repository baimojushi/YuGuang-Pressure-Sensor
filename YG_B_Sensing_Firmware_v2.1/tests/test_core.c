#include "yg_iface.h"
#include "yg_guidance.h"
#include "yg_fusion.h"
#include <assert.h>
#include <stdio.h>
#include <string.h>
int main(void){
 uint8_t buf[20];yg_breath_t b={.flags=11,.seq=0x1234,.uptime_ms=0xabcdef01,.wave_q15=-900,.bpm_x10=150,
 .stage=0,.confidence_pct=90,.progress_permille=65535,.sample_age_ms=100},out={0};
 assert(yg_breath_pack(buf,&b));assert(buf[2]==0x34&&buf[3]==0x12&&buf[18]==0&&buf[19]==0);
 assert(yg_breath_unpack(&out,buf,20)&&out.wave_q15==-900&&out.bpm_x10==150);
 assert(!yg_breath_unpack(&out,buf,19));buf[0]=2;assert(!yg_breath_unpack(&out,buf,20));buf[0]=1;
 yg_pressure_t p={.event_id=0x31415926,.seq=23,.uptime_ms=2000,.score_x10=720,.confidence_pct=90,.ttl_ms=10000},o={0};
 assert(yg_pressure_pack(buf,&p));assert(yg_pressure_unpack(&o,buf,20)&&o.event_id==p.event_id);
 assert(yg_event_expired(2000,10000,12001));assert(!yg_event_expired(2000,10000,12000));
 yg_status_t s={.radar=1,.pose=2,.fusion=3,.boot_id=0x01234567,.uptime_ms=999},s2={0};
 assert(yg_status_pack(buf,&s));assert(yg_status_unpack(&s2,buf,20)&&s2.boot_id==s.boot_id);
 uint8_t small[8];yg_control_t ctrl={.opcode=3,.param=1,.command_id=1024},ctrl2={0};
 assert(yg_control_pack(small,&ctrl));assert(yg_control_unpack(&ctrl2,small,8)&&ctrl2.command_id==1024);
 yg_ack_t ack={.kind=1,.event_id=12345,.result=0},ack2={0};
 assert(yg_ack_pack(small,&ack));assert(yg_ack_unpack(&ack2,small,8)&&ack2.event_id==12345);
 yg_guidance_t g;yg_guidance_init(&g);assert(g.enabled&&yg_guidance_request(&g,1000));
 for(unsigned t=1200;t<=5200;t+=200)yg_guidance_breath(&g,&b,t);
 assert(g.state==YG_GUIDING);assert(yg_guidance_period_100ms(&g)>0);
 float initial=g.target_bpm;yg_guidance_tick(&g,15200);assert(g.state==YG_COOLDOWN); /* stale fallback */
 yg_guidance_tick(&g,20200);assert(g.state==YG_IDLE);
 assert(initial>0);yg_guidance_focus(&g,true,21000);assert(!yg_guidance_request(&g,21100));
 yg_fusion_t f;yg_fusion_init(&f);yg_fusion_input_t high={.r=80,.p=80,.f=80,.r_ok=true,.p_ok=true,.f_ok=true};
 yg_fusion_input_t low={.r=54,.p=54,.f=54,.r_ok=true,.p_ok=true,.f_ok=true};
 assert(!yg_fusion_step(&f,&high,1000));assert(!yg_fusion_step(&f,&high,18000));
 assert(!yg_fusion_step(&f,&low,19000));assert(yg_fusion_step(&f,&low,23000));
 assert(!yg_fusion_step(&f,&high,24000));
 /* Care visual priority gates new relaxation requests. */
 yg_guidance_t care;yg_guidance_init(&care);yg_guidance_set_care(&care,true);
 assert(!yg_guidance_request(&care,105));yg_guidance_set_care(&care,false);
 assert(yg_guidance_request(&care,106));
 /* Invalid payloads must not bypass frozen version/length/flags checks. */
 assert(yg_breath_pack(buf,&b));buf[18]=1;assert(!yg_breath_unpack(&out,buf,20));
 assert(yg_pressure_pack(buf,&p));buf[0]=3;assert(!yg_pressure_unpack(&o,buf,20));
 buf[0]=1;buf[16]=0;buf[17]=0;assert(!yg_pressure_unpack(&o,buf,20));
 assert(yg_ack_pack(small,&ack));small[7]=1;assert(!yg_ack_unpack(&ack2,small,8));
 high.p_ok=false;assert(!yg_fusion_step(&f,&high,100000));
 puts("PASS: YG-IFACE codec + guidance + 3D fusion safety");return 0;
}
