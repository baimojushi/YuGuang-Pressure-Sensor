#include "yg_preview_lamp.h"
#include <assert.h>
#include <string.h>
#include <stdio.h>
int main(void){
 yg_preview_lamp_t s={0};uint8_t rgb[3];
 assert(!yg_preview_apply(&s,"blink","abcdefgh",1000));
 assert(!yg_preview_apply(&s,"miss","..unsafe..",1000));
 assert(!yg_preview_apply(&s,"miss","123",1000));
 assert(yg_preview_apply(&s,"meal","abcD1234",1000));
 assert(yg_preview_render(&s,2500,rgb));
 assert(rgb[0]<=46&&rgb[1]<=46&&rgb[2]<=46);
 assert(yg_preview_apply(&s,"meal","abcD1234",2500));
 assert(s.started_ms==1000); /* same nonce no replay */
 assert(!yg_preview_apply(&s,"rest","abcD1234",2500));
 assert(!yg_preview_render(&s,6600,rgb));
 assert(yg_preview_apply(&s,"rest","abcD5678",7000));
 assert(yg_preview_render(&s,7000,rgb));
 yg_preview_cancel(&s);assert(!yg_preview_render(&s,7200,rgb));
 puts("yg_preview_lamp PASS");return 0;
}
