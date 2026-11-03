/* 可在 PC 上以 -std=c11 -Wall -Wextra -Werror 编译的语音意图边界测试。 */
#include "yg_voice_intent.h"
#include <assert.h>
#include <stdio.h>
int main(void) {
 assert(yg_voice_read_intent("余光，朗读刚才收到的消息"));
 assert(yg_voice_read_intent("把亲友留言念给我听"));
 assert(yg_voice_read_intent("读一下上一条心意"));
 assert(!yg_voice_read_intent("不要朗读刚才收到的消息"));
 assert(!yg_voice_read_intent("先别读那条留言"));
 assert(!yg_voice_read_intent("请打开灯光"));
 assert(!yg_voice_read_intent("把消息删除"));
 assert(!yg_voice_read_intent("语音检测"));
 assert(!yg_voice_read_intent(NULL));
 puts("PASS: 余光用户主动朗读意图识别边界");
 return 0;
}
