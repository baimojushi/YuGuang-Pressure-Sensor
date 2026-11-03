#include "yg_voice_light.h"
#include <string.h>
static int has(const char *s,const char *x){return strstr(s,x)!=0;}
yg_voice_light_action_t yg_voice_light_intent(const char *text){
 if(!text)return YG_VOICE_LIGHT_NONE;
 size_t n=strlen(text);
 if(n<6||n>480)return YG_VOICE_LIGHT_NONE;
 /* Ambiguous/negated expressions must never trigger light changes. */
 if(has(text,"不要")||has(text,"别")||has(text,"不用")||has(text,"不许")||
    has(text,"不要开")||has(text,"别给")||has(text,"先不")||has(text,"取消")||
    has(text,"假如")||has(text,"如果")||has(text,"不是")||has(text,"问一下"))return YG_VOICE_LIGHT_NONE;
 if(!(has(text,"余光")||has(text,"灯")||has(text,"光效")||has(text,"灯语")))return YG_VOICE_LIGHT_NONE;
 if(has(text,"关闭")||has(text,"关掉")||has(text,"熄灭"))return YG_VOICE_POWER_OFF;
 if(has(text,"打开")||has(text,"开启")||has(text,"开灯")||has(text,"亮起来"))return YG_VOICE_POWER_ON;
 if(!(has(text,"播放")||has(text,"试播")||has(text,"显示")||has(text,"来一段")||has(text,"切换")))return YG_VOICE_LIGHT_NONE;
 if(has(text,"想念")||has(text,"想你"))return YG_VOICE_PREVIEW_MISS;
 if(has(text,"吃饭")||has(text,"暖橙"))return YG_VOICE_PREVIEW_MEAL;
 if(has(text,"休息")||has(text,"渐隐"))return YG_VOICE_PREVIEW_REST;
 if(has(text,"加油")||has(text,"鼓励"))return YG_VOICE_PREVIEW_CHEER;
 return YG_VOICE_LIGHT_NONE;
}
