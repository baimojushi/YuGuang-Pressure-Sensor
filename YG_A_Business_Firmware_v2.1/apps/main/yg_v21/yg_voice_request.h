#ifndef YG_VOICE_REQUEST_H
#define YG_VOICE_REQUEST_H
/* 最终 ASR 文本由后台任务通过已认证的灵机 SDK device/up 上报。
 * 平台适配器负责绑定到真正的设备身份并生成签名的 VoiceRead 请求。 */
void yg_voice_request_on_asr_final(const char *text);
#endif
