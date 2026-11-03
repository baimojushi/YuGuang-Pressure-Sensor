#ifndef YG_VOICE_INTENT_H
#define YG_VOICE_INTENT_H
#include <stdbool.h>
/* 仅识别“用户明确要求朗读已收到消息”，不接受否定、取消、随意闲聊。 */
bool yg_voice_read_intent(const char *utf8_text);
#endif
