#include "yg_voice_light.h"
#include <assert.h>
#include <stdio.h>
int main(void){
 assert(yg_voice_light_intent("余光，打开情感灯光")==YG_VOICE_POWER_ON);
 assert(yg_voice_light_intent("余光，请关闭灯")==YG_VOICE_POWER_OFF);
 assert(yg_voice_light_intent("余光播放想念灯语")==YG_VOICE_PREVIEW_MISS);
 assert(yg_voice_light_intent("余光试播吃饭灯语")==YG_VOICE_PREVIEW_MEAL);
 assert(yg_voice_light_intent("余光试播休息灯语")==YG_VOICE_PREVIEW_REST);
 assert(yg_voice_light_intent("余光播放加油灯语")==YG_VOICE_PREVIEW_CHEER);
 assert(yg_voice_light_intent("不要打开灯")==YG_VOICE_LIGHT_NONE);
 assert(yg_voice_light_intent("余光，如果打开灯会怎样")==YG_VOICE_LIGHT_NONE);
 assert(yg_voice_light_intent("今天吃饭了吗")==YG_VOICE_LIGHT_NONE);
 assert(yg_voice_light_intent("余光，灯光怎么样")==YG_VOICE_LIGHT_NONE);
 assert(yg_voice_light_intent(NULL)==YG_VOICE_LIGHT_NONE);
 puts("yg_voice_light PASS");return 0;
}
