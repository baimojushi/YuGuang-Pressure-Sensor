/* Constrained local ASR light intents. No arbitrary JSON, GPIO, color or brightness. */
#ifndef YG_VOICE_LIGHT_H
#define YG_VOICE_LIGHT_H
#include <stdint.h>
typedef enum { YG_VOICE_LIGHT_NONE=0, YG_VOICE_POWER_ON=1, YG_VOICE_POWER_OFF=2,
 YG_VOICE_PREVIEW_MISS=3, YG_VOICE_PREVIEW_MEAL=4,
 YG_VOICE_PREVIEW_REST=5, YG_VOICE_PREVIEW_CHEER=6 } yg_voice_light_action_t;
yg_voice_light_action_t yg_voice_light_intent(const char *text);
#endif
