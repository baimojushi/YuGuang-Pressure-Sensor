#include "yg_voice_intent.h"
#include <string.h>
static bool has(const char *s,const char *needle){return strstr(s,needle)!=NULL;}
bool yg_voice_read_intent(const char *text){
 if(!text)return false;
 size_t n=strlen(text);
 if(n<6||n>480)return false;
 if(has(text,"不要")||has(text,"别读")||has(text,"不用")||has(text,"取消")||
    has(text,"停止")||has(text,"先别")||has(text,"不需要"))return false;
 bool verb=has(text,"读")||has(text,"念")||has(text,"朗读")||has(text,"播报")||
           has(text,"说给我听")||has(text,"讲给我听");
 bool target=has(text,"消息")||has(text,"心意")||has(text,"留言")||has(text,"刚才")||
             has(text,"上一条")||has(text,"文字")||has(text,"亲友")||has(text,"伴侣")||
             has(text,"家人");
 return verb&&target;
}
