/* User-initiated device-side light preview. Never carries a care message ID or ACK. */
#ifndef YG_PREVIEW_LAMP_H
#define YG_PREVIEW_LAMP_H
#include <stdint.h>
#include <stdbool.h>
typedef struct {
 char nonce[41];
 uint32_t started_ms;
 uint8_t preset; /* 1 miss; 2 meal; 3 rest; 4 cheer */
} yg_preview_lamp_t;
bool yg_preview_apply(yg_preview_lamp_t *s, const char *preset, const char *nonce, uint32_t now);
bool yg_preview_render(const yg_preview_lamp_t *s, uint32_t now, uint8_t rgb[3]);
void yg_preview_cancel(yg_preview_lamp_t *s);
#endif
