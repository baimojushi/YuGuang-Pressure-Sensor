#include "video_stream.h"

#include "qm_log.h"
#include "esp_heap_caps.h"
#include "esp_http_server.h"
#include "esp_jpeg_enc.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "freertos/task.h"

#include <stdio.h>
#include <string.h>

#define LOG_TAG "video_stream"

#define VS_HTTP_PORT      80
#define VS_JPEG_MAX       (64 * 1024)
#define VS_JPEG_QUALITY   45
#define VS_POLL_MS        30
#define VS_BOUNDARY       "frame"

/* COCO 17 点骨架连线 */
static const uint8_t kSkeleton[][2] = {
    {5, 6}, {5, 7}, {7, 9}, {6, 8}, {8, 10},
    {5, 11}, {6, 12}, {11, 12},
    {11, 13}, {13, 15}, {12, 14}, {14, 16},
    {0, 1}, {0, 2}, {1, 3}, {2, 4}, {0, 5}, {0, 6},
};

static jpeg_enc_handle_t s_enc;
static int s_enc_w;
static int s_enc_h;
static uint8_t *s_jpg;
static size_t s_jpg_len;
static uint32_t s_jpg_seq;
static SemaphoreHandle_t s_lock;
static volatile int s_clients;
static httpd_handle_t s_server;

static const char kIndexHtml[] =
    "<!doctype html><html><head><meta charset=\"utf-8\">"
    "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
    "<title>XJWB03 pose</title></head>"
    "<body style=\"margin:0;background:#111;display:flex;align-items:center;"
    "justify-content:center;min-height:100vh\">"
    "<img src=\"/stream\" style=\"max-width:100%;max-height:100vh\">"
    "</body></html>";

static inline void put_px(uint8_t *rgb, int w, int h, int x, int y,
                          uint8_t r, uint8_t g, uint8_t b)
{
    if (x < 0 || y < 0 || x >= w || y >= h) {
        return;
    }
    uint8_t *p = rgb + ((size_t)y * (size_t)w + (size_t)x) * 3u;
    p[0] = r;
    p[1] = g;
    p[2] = b;
}

static void put_thick(uint8_t *rgb, int w, int h, int x, int y,
                      uint8_t r, uint8_t g, uint8_t b)
{
    put_px(rgb, w, h, x, y, r, g, b);
    put_px(rgb, w, h, x + 1, y, r, g, b);
    put_px(rgb, w, h, x, y + 1, r, g, b);
    put_px(rgb, w, h, x + 1, y + 1, r, g, b);
}

static void draw_line(uint8_t *rgb, int w, int h,
                      int x0, int y0, int x1, int y1,
                      uint8_t r, uint8_t g, uint8_t b)
{
    int dx = x1 > x0 ? (x1 - x0) : (x0 - x1);
    int dy = y1 > y0 ? (y1 - y0) : (y0 - y1);
    int sx = x0 < x1 ? 1 : -1;
    int sy = y0 < y1 ? 1 : -1;
    int err = dx - dy;
    int guard = 0;

    for (;;) {
        put_thick(rgb, w, h, x0, y0, r, g, b);
        if ((x0 == x1 && y0 == y1) || ++guard > 4096) {
            break;
        }
        int e2 = err * 2;
        if (e2 > -dy) {
            err -= dy;
            x0 += sx;
        }
        if (e2 < dx) {
            err += dx;
            y0 += sy;
        }
    }
}

static void draw_overlay(uint8_t *rgb, int w, int h,
                         const yolo11_pose_frame_result_t *res)
{
    /* 框：正常绿框，姿态异常红框 */
    if (res->box[2] > res->box[0] && res->box[3] > res->box[1]) {
        const bool bad = (res->status == YOLO11_POSE_FRAME_BAD_POSTURE);
        const uint8_t br = bad ? 255 : 0;
        const uint8_t bg = bad ? 40 : 220;
        draw_line(rgb, w, h, res->box[0], res->box[1], res->box[2], res->box[1], br, bg, 0);
        draw_line(rgb, w, h, res->box[2], res->box[1], res->box[2], res->box[3], br, bg, 0);
        draw_line(rgb, w, h, res->box[2], res->box[3], res->box[0], res->box[3], br, bg, 0);
        draw_line(rgb, w, h, res->box[0], res->box[3], res->box[0], res->box[1], br, bg, 0);
    }

    for (size_t i = 0; i < sizeof(kSkeleton) / sizeof(kSkeleton[0]); ++i) {
        const int a = kSkeleton[i][0];
        const int b = kSkeleton[i][1];
        const int ax = res->keypoint[2 * a];
        const int ay = res->keypoint[2 * a + 1];
        const int bx = res->keypoint[2 * b];
        const int by = res->keypoint[2 * b + 1];
        if (ax == 0 && ay == 0) {
            continue;
        }
        if (bx == 0 && by == 0) {
            continue;
        }
        draw_line(rgb, w, h, ax, ay, bx, by, 255, 170, 0);
    }

    for (int i = 0; i < 17; ++i) {
        const int x = res->keypoint[2 * i];
        const int y = res->keypoint[2 * i + 1];
        if (x == 0 && y == 0) {
            continue;
        }
        put_thick(rgb, w, h, x, y, 0, 220, 255);
    }
}

static esp_err_t index_handler(httpd_req_t *req)
{
    httpd_resp_set_type(req, "text/html; charset=utf-8");
    return httpd_resp_send(req, kIndexHtml, HTTPD_RESP_USE_STRLEN);
}

static esp_err_t stream_handler(httpd_req_t *req)
{
    esp_err_t ret = httpd_resp_set_type(req, "multipart/x-mixed-replace; boundary=" VS_BOUNDARY);
    if (ret != ESP_OK) {
        return ret;
    }

    uint8_t *buf = heap_caps_malloc(VS_JPEG_MAX, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
    if (buf == NULL) {
        QM_LOGE(LOG_TAG, "stream buffer alloc failed");
        return httpd_resp_send_500(req);
    }

    s_clients++;
    QM_LOGI(LOG_TAG, "stream client connected (n=%d)", (int)s_clients);

    uint32_t last_seq = 0;
    for (;;) {
        size_t len = 0;
        bool fresh = false;

        if (xSemaphoreTake(s_lock, pdMS_TO_TICKS(100)) == pdTRUE) {
            if (s_jpg_seq != last_seq && s_jpg_len > 0 && s_jpg_len <= VS_JPEG_MAX) {
                last_seq = s_jpg_seq;
                len = s_jpg_len;
                memcpy(buf, s_jpg, len);
                fresh = true;
            }
            xSemaphoreGive(s_lock);
        }

        if (!fresh) {
            vTaskDelay(pdMS_TO_TICKS(VS_POLL_MS));
            continue;
        }

        char hdr[96];
        int n = snprintf(hdr, sizeof(hdr),
                         "--" VS_BOUNDARY "\r\nContent-Type: image/jpeg\r\n"
                         "Content-Length: %u\r\n\r\n", (unsigned)len);
        if (httpd_resp_send_chunk(req, hdr, n) != ESP_OK) {
            break;
        }
        if (httpd_resp_send_chunk(req, (const char *)buf, len) != ESP_OK) {
            break;
        }
        if (httpd_resp_send_chunk(req, "\r\n", 2) != ESP_OK) {
            break;
        }
    }

    s_clients--;
    heap_caps_free(buf);
    QM_LOGI(LOG_TAG, "stream client gone (n=%d)", (int)s_clients);
    return ESP_OK;
}

static const httpd_uri_t kUriIndex = {
    .uri = "/",
    .method = HTTP_GET,
    .handler = index_handler,
    .user_ctx = NULL,
};

static const httpd_uri_t kUriStream = {
    .uri = "/stream",
    .method = HTTP_GET,
    .handler = stream_handler,
    .user_ctx = NULL,
};

static esp_err_t enc_ensure(int w, int h)
{
    if (s_enc != NULL && s_enc_w == w && s_enc_h == h) {
        return ESP_OK;
    }
    if (s_enc != NULL) {
        jpeg_enc_close(s_enc);
        s_enc = NULL;
    }
    jpeg_enc_config_t cfg = DEFAULT_JPEG_ENC_CONFIG();
    cfg.width = w;
    cfg.height = h;
    cfg.src_type = JPEG_PIXEL_FORMAT_RGB888;
    cfg.subsampling = JPEG_SUBSAMPLE_420;
    cfg.quality = VS_JPEG_QUALITY;
    cfg.rotate = JPEG_ROTATE_0D;
    cfg.task_enable = false;

    if (jpeg_enc_open(&cfg, &s_enc) != JPEG_ERR_OK || s_enc == NULL) {
        QM_LOGE(LOG_TAG, "jpeg_enc_open failed %dx%d", w, h);
        s_enc = NULL;
        return ESP_FAIL;
    }
    s_enc_w = w;
    s_enc_h = h;
    QM_LOGI(LOG_TAG, "jpeg encoder %dx%d q%d", w, h, VS_JPEG_QUALITY);
    return ESP_OK;
}

esp_err_t video_stream_start(void)
{
    if (s_server != NULL) {
        return ESP_OK;
    }
    if (s_lock == NULL) {
        s_lock = xSemaphoreCreateMutex();
        if (s_lock == NULL) {
            return ESP_ERR_NO_MEM;
        }
    }
    if (s_jpg == NULL) {
        s_jpg = heap_caps_malloc(VS_JPEG_MAX, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
        if (s_jpg == NULL) {
            QM_LOGE(LOG_TAG, "jpeg buffer alloc failed");
            return ESP_ERR_NO_MEM;
        }
    }

    httpd_config_t cfg = HTTPD_DEFAULT_CONFIG();
    cfg.server_port = VS_HTTP_PORT;
    cfg.stack_size = 6144;
    cfg.lru_purge_enable = true;

    if (httpd_start(&s_server, &cfg) != ESP_OK) {
        QM_LOGE(LOG_TAG, "httpd_start failed on port %d", VS_HTTP_PORT);
        s_server = NULL;
        return ESP_FAIL;
    }
    httpd_register_uri_handler(s_server, &kUriIndex);
    httpd_register_uri_handler(s_server, &kUriStream);

    QM_LOGI(LOG_TAG, "http server ready on :%d (open / for live view)", VS_HTTP_PORT);
    return ESP_OK;
}

void video_stream_publish(uint8_t *rgb888, uint16_t w, uint16_t h,
                          const yolo11_pose_frame_result_t *res)
{
    if (rgb888 == NULL || w == 0 || h == 0 || s_clients <= 0) {
        return;
    }
    if (enc_ensure((int)w, (int)h) != ESP_OK) {
        return;
    }
    if (res != NULL) {
        draw_overlay(rgb888, (int)w, (int)h, res);
    }

    int out_size = 0;
    jpeg_error_t err = jpeg_enc_process(s_enc, rgb888, (int)((size_t)w * h * 3u),
                                        s_jpg, VS_JPEG_MAX, &out_size);
    if (err != JPEG_ERR_OK || out_size <= 0) {
        QM_LOGW(LOG_TAG, "encode failed err=%d", (int)err);
        return;
    }

    if (xSemaphoreTake(s_lock, pdMS_TO_TICKS(100)) == pdTRUE) {
        s_jpg_len = (size_t)out_size;
        s_jpg_seq++;
        xSemaphoreGive(s_lock);
    }
}

bool video_stream_has_clients(void)
{
    return s_clients > 0;
}
