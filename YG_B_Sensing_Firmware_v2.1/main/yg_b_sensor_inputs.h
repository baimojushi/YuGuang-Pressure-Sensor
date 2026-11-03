#ifndef YG_B_SENSOR_INPUTS_H
#define YG_B_SENSOR_INPUTS_H
#include "yg_fusion.h"
/* For validated local posture / focus / respiration models only.
 * Values 0..100, freshness 1.5s; all three validity flags must be true.
 * Supply only after calibration and explicit user authorization where needed.
 */
void yg_b_set_load_inputs(const yg_fusion_input_t *v);
#endif
