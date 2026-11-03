#ifndef YG_FUSION_H
#define YG_FUSION_H
#include <stdint.h>
#include <stdbool.h>
/* 0..100 normalized indicators; no implicit substituting for unavailable data. */
typedef struct {float r,p,f;bool r_ok,p_ok,f_ok;} yg_fusion_input_t;
typedef struct {float score;float peak;uint32_t above_since,fall_since,quiet_until;bool armed;} yg_fusion_t;
void yg_fusion_init(yg_fusion_t *s);
/* True for a qualified pressure_fall_start edge. Needs reliable 3D inputs. */
bool yg_fusion_step(yg_fusion_t *s,const yg_fusion_input_t *v,uint32_t now);
#endif
