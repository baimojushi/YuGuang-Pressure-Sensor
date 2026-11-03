<script setup lang="ts">
/**
 * 课程表页面
 * --------------------------------------------------------------------------
 * 部署形态：Taro/Vue3 H5 打包后，作为「小匠云平台」微信小程序 WebView 内嵌面板。
 * 核心策略：
 *   1. 拍照：隐藏 <input type="file" capture="environment">，由「开始拍照」按钮
 *      原生点击事件同步调用 input.click() 调起系统后置摄像头。
 *      —— 硬性限制：必须用户手势同步触发，绝不能放进异步回调/定时器/Promise.then，
 *         否则微信 WebView 安全策略会拦截摄像头权限。
 *   2. 识别：上传图片进行识别，
 *      成功即成功，失败即失败，不再做本地降级。
 *   3. 持久化：查询 / 保存课表数据，失败即失败，不再降级 localStorage。
 *   4. 编辑：右上角「修改」开启当前天行内编辑；识别结果弹窗可编辑整周课表。
 * --------------------------------------------------------------------------
 */
import { ref, computed, onMounted } from "vue";
import { info } from "@/stores";
import type { CourseItem } from "./types";
import {
    parseCourseTable,
    fetchCourseTable,
    saveCourseTable,
    type SaveCourseTableBody,
} from "@/utils/apis/aiEyeCareApi";
import cameraCaptureImg from "@/assets/images/course/Capture.png";
import { openNativeCamera, isMiniProgramEnv } from "@/utils/nativeCamera";

/* ============================== 常量 ============================== */
const weekdays = ["周一", "周二", "周三", "周四", "周五"];
const weekdayEn = ["Mo", "Tu", "We", "Th", "Fr"];
// 第一节~第八节，共 8 节
const PERIOD_COUNT = 8;
const timeSlots = ref(
    Array.from({ length: PERIOD_COUNT }, (_, i) => `第${"一二三四五六七八"[i]}节课`)
);

// 图片压缩最大边（px）：防止高分辨率照片导致微信 WebView 内存溢出闪退
// 真机测试若仍闪退，可继续降到 640 或 480
const MAX_IMAGE_SIZE = 1080;

/* ============================== 课表数据 ============================== */
// 生成空课表兜底：5 天 x 6 节
const createEmptyCourseMap = (): CourseItem[][] =>
    Array.from({ length: 5 }, () =>
        Array.from({ length: PERIOD_COUNT }, (_, i) => ({ time: timeSlots.value[i], name: "" }))
    );

const courseMap = ref<CourseItem[][]>(createEmptyCourseMap());
const activeDay = ref(0);
const currentCourses = ref<CourseItem[]>(courseMap.value[0]);

/* ============================== 第七/八节按需显示 ============================== */
// 判断整周课表是否填写过任何课程数据
const hasAnyCourseData = computed(() =>
    courseMap.value.some((dayCourses) => dayCourses.some((c) => !!c.name))
);

// 判断整周课表中第七、八节（索引 6、7）是否填写过课程：
// 任意一天的第 7/8 节有课程名，即视为「有数据」
const hasLatePeriodData = computed(() =>
    courseMap.value.some((dayCourses) =>
        dayCourses.some((c, idx) => idx >= 6 && !!c.name)
    )
);

// 查看模式实际渲染的课程列表：
// 1. 初始无任何课表数据：完整展示第一~八节
// 2. 有数据但整周第 7/8 节均为空：只显示前六节，隐藏第七/八节
// 3. 任意一天第 7/8 节有课：显示全部八节
const visibleCourses = computed(() => {
    if (!hasAnyCourseData.value) return currentCourses.value;
    return hasLatePeriodData.value ? currentCourses.value : currentCourses.value.slice(0, 6);
});

/* ============================== 编辑模式（行内） ============================== */
const isEditMode = ref(false);
const editCourses = ref<CourseItem[]>([]);

/* ============================== 拍照 / 识别 状态 ============================== */
// 隐藏的 file input：必须静态常驻 DOM，不能动态创建，微信 WebView 才稳定放行
const cameraInputRef = ref<HTMLInputElement | null>(null);
const ocrLoading = ref(false);
const ocrStatus = ref(""); // loading 时的提示文案
const ocrError = ref(""); // 识别失败时的错误文案
const ocrProgress = ref(0); // 识别加载进度 0-100

// 识别结果编辑弹窗
const isOcrDialogOpen = ref(false);
const ocrDialogMap = ref<CourseItem[][]>(createEmptyCourseMap());

/* ============================== 图片处理：低内存压缩 ============================== */
/**
 * 压缩图片到最大边 targetSize，返回压缩后的 base64。
 * 关键优化：
 *   1. 使用 URL.createObjectURL 而非 FileReader 读取大文件，避免复制完整 base64 到内存。
 *   2. 读取图片时直接限制 CSS 尺寸，触发浏览器预缩放。
 *   3. Canvas 输出 JPEG 0.65，平衡清晰度与体积。
 *   4. 及时 revokeObjectURL、清空 canvas，降低微信 WebView 内存峰值。
 */
const compressImage = (file: File, targetSize: number = MAX_IMAGE_SIZE): Promise<string> =>
    new Promise((resolve, reject) => {
        const objectUrl = URL.createObjectURL(file);
        const img = new Image();
        let cleaned = false;

        const cleanup = () => {
            if (cleaned) return;
            cleaned = true;
            try { URL.revokeObjectURL(objectUrl); } catch { }
        };

        img.onload = () => {
            try {
                // 根据方向计算目标尺寸
                let width = img.naturalWidth || img.width;
                let height = img.naturalHeight || img.height;
                const scale = Math.min(1, targetSize / Math.max(width, height));
                width = Math.max(1, Math.round(width * scale));
                height = Math.max(1, Math.round(height * scale));

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d', { alpha: false });

                if (!ctx) {
                    cleanup();
                    reject(new Error("Canvas 初始化失败"));
                    return;
                }

                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);

                // 低质量优先保证不闪退；课表文字粗体大，0.65 通常足够
                const base64 = canvas.toDataURL('image/jpeg', 0.65);

                // 立即释放
                cleanup();
                canvas.width = 0;
                canvas.height = 0;

                resolve(base64);
            } catch (err: any) {
                cleanup();
                reject(err);
            }
        };

        img.onerror = () => {
            cleanup();
            reject(new Error("图片加载失败"));
        };

        // 让 Image 在解码前按目标尺寸渲染，降低内存峰值
        img.style.maxWidth = targetSize + 'px';
        img.style.maxHeight = targetSize + 'px';
        img.src = objectUrl;
    });

/* ============================== 课程数据格式转换 ============================== */
// 课程数据（weekday/period/subject）→ 本地 CourseItem[][]（5天×6节）
const apiCoursesToLocalMap = (courses: Array<{ weekday: number; period: number; subject: string }>): CourseItem[][] => {
    const map = createEmptyCourseMap();
    for (const c of courses) {
        if (c.weekday >= 1 && c.weekday <= 5 && c.period >= 1 && c.period <= PERIOD_COUNT) {
            map[c.weekday - 1][c.period - 1].name = c.subject;
        }
    }
    return map;
};

// 本地 CourseItem[][] → SaveCourseTableBody
// 注意：被清空的格子不删除记录，而是以空字符串提交，由后端覆盖为空内容
const localMapToApiBody = (map: CourseItem[][]): SaveCourseTableBody => {
    const courses: Array<{ weekday: number; period: number; subject: string }> = [];
    for (let d = 0; d < 5; d++) {
        for (let p = 0; p < PERIOD_COUNT; p++) {
            // 清空的格子提交空字符串，保留 weekday/period 记录
            courses.push({ weekday: d + 1, period: p + 1, subject: (map[d][p].name || "").trim() });
        }
    }
    return { courses };
};

/* ============================== 交互方法 ============================== */
const selectDay = (idx: number) => {
    activeDay.value = idx;
    currentCourses.value = courseMap.value[idx];
    if (isEditMode.value) {
        editCourses.value = JSON.parse(JSON.stringify(courseMap.value[idx]));
    }
};

/**
 * 触发拍照：
 *  - 小程序环境：走宿主原生拍照（wx.chooseMedia），避免 <input type="file">
 *    调起系统相机时 WebView 切后台被小米等系统回收导致闪退。
 *  - 浏览器环境：回退到原生 <input type="file">，必须由按钮点击事件同步调用
 *    input.click()，严禁放进 setTimeout / Promise.then / 异步回调。
 */
const triggerCamera = () => {
    if (isMiniProgramEnv()) {
        // 小程序环境：loading 由 handleImageFile 在用户选完图后才显示
        startNativeCameraCapture();
        return;
    }
    cameraInputRef.value?.click();
};

// file input change：拿到照片后 -> 共用识别流程
const onCameraCapture = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    // 重置 value，确保同一张照片可被再次选择
    input.value = "";
    if (!file) return;
    await handleImageFile(file);
};

/**
 * 小程序原生拍照：调起宿主 wx.chooseMedia，拿回 dataUrl 转 File 后走同一套识别。
 * 拍照在原生层完成，不切后台；取消拍照静默返回，不做错误提示。
 */
const startNativeCameraCapture = async () => {
    // loading 不在这里打开，由 handleImageFile 在拿到图之后控制
    try {
        const dataUrl = await openNativeCamera();
        const imgFile = dataUrlToFile(dataUrl);
        await handleImageFile(imgFile);
    } catch (err: any) {
        // 取消 / 环境不支持（fallback 兜底）静默返回，不向用户报错
        const msg = err?.message || "";
        if (msg === "已取消拍照" || msg === "当前环境不支持原生拍照") {
            return;
        }
        console.error("原生拍照失败", err);
        ocrError.value = msg || "拍照失败，请重试或手动录入";
    }
};

// dataURL -> File：宿主回传的是 base64 图片，转成 File 供上传
const dataUrlToFile = (dataUrl: string): File => {
    const [meta, b64] = dataUrl.split(",");
    const mime = /^data:([^;,]+)/.exec(meta)?.[1] || "image/jpeg";
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new File([bytes], "course-table.jpg", { type: mime });
};

// 拿到图片文件后：压缩 + 上传识别 + 打开结果弹窗（浏览器/原生两条入口共用）
const handleImageFile = async (file: File) => {
    ocrError.value = "";
    ocrLoading.value = true;
    ocrProgress.value = 0;
    ocrStatus.value = "正在处理图片…";

    // 将后续处理放到下一个事件循环，避免在回调中同步占用大量内存
    await new Promise((resolve) => setTimeout(resolve, 50));

    try {
        // Step 1: 压缩图片
        ocrStatus.value = "正在处理图片…";
        ocrProgress.value = 3;
        const compressedBase64 = await compressImage(file);
        ocrProgress.value = 5;

        // 压缩完成后让 GC 有机会回收大图相关内存
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Step 2: 上传图片识别
        const deviceId = info?.did;
        const pid = info?.pid;
        if (!deviceId || !pid) {
            throw new Error("设备信息缺失，无法识别");
        }

        ocrStatus.value = "识别中~";
        ocrProgress.value = 10;
        // base64 转 Blob 再转 File，用于 multipart/form-data 上传
        const blob = await (await fetch(compressedBase64)).blob();
        const imgFile = new File([blob], "course-table.jpg", { type: "image/jpeg" });
        const res = await parseCourseTable(deviceId, pid, imgFile);

        ocrStatus.value = "正在生成课程表…";
        ocrProgress.value = 97;

        if (res?.code !== 200 || !res.data?.courses?.length) {
            // 识别失败或空结果，直接报错，不再降级
            // 不透传 res.message，避免成功文案（如"识别成功"）被当错误显示
            throw new Error("");
        }

        const parsed = apiCoursesToLocalMap(res.data.courses);

        // 打开结果编辑弹窗（深拷贝，避免直接改原数据）
        ocrDialogMap.value = JSON.parse(JSON.stringify(parsed));
        isOcrDialogOpen.value = true;
        ocrProgress.value = 100;
    } catch (err: any) {
        console.error("识别失败", err);
        ocrError.value = err?.message || "未能识别到课程信息，请重新拍摄清晰课程表";
    } finally {
        // 延迟关闭 loading，让用户看到进度完成
        setTimeout(() => {
            ocrLoading.value = false;
            ocrStatus.value = "";
            ocrProgress.value = 0;
        }, 300);
    }
};

// 识别弹窗：取消
const closeOcrDialog = () => {
    isOcrDialogOpen.value = false;
};

// 识别弹窗：保存 -> 保存课表
const saveOcrDialog = async () => {
    courseMap.value = JSON.parse(JSON.stringify(ocrDialogMap.value));
    currentCourses.value = courseMap.value[activeDay.value];
    await saveCourseToBackend(courseMap.value);
    isOcrDialogOpen.value = false;
};

// 关闭识别错误提示
const dismissOcrError = () => {
    ocrError.value = "";
};

// 右上角「修改」/「保存」
const editCourse = async () => {
    if (isEditMode.value) {
        // 保存：写回当天 + 持久化课表
        courseMap.value[activeDay.value] = JSON.parse(JSON.stringify(editCourses.value));
        currentCourses.value = courseMap.value[activeDay.value];
        await saveCourseToBackend(courseMap.value);
        isEditMode.value = false;
    } else {
        // 进入行内编辑
        editCourses.value = JSON.parse(JSON.stringify(currentCourses.value));
        isEditMode.value = true;
    }
};

/* ============================== 课表持久化（查询 / 保存） ============================== */
// 保存课表，失败抛出由调用方处理
const saveCourseToBackend = async (map: CourseItem[][]) => {
    const deviceId = info?.did;
    const pid = info?.pid;
    if (!deviceId || !pid) {
        console.warn("设备信息缺失，无法保存课表");
        return;
    }
    try {
        const body = localMapToApiBody(map);
        await saveCourseTable(deviceId, pid, body);
    } catch (e) {
        console.error("保存课表失败", e);
        // 不再降级 localStorage，由调用方决定是否提示
        throw e;
    }
};

// 查询课表，失败返回 null
const loadCourseFromBackend = async (): Promise<CourseItem[][] | null> => {
    const deviceId = info?.did;
    const pid = info?.pid;
    if (!deviceId || !pid) return null;
    try {
        const res = await fetchCourseTable(deviceId, pid);
        if (res?.code === 200 && res.data?.courses?.length) {
            return apiCoursesToLocalMap(res.data.courses);
        }
    } catch (e) {
        console.error("查询课表失败", e);
    }
    return null;
};

/* ============================== 生命周期 ============================== */
onMounted(async () => {
    // 查询课表，失败则保留空课表
    const backendData = await loadCourseFromBackend();
    if (backendData) {
        courseMap.value = backendData;
        currentCourses.value = courseMap.value[activeDay.value];
    }
});
</script>

<template>
    <div class="page-course-table">
        <!--
            隐藏的 file input：用于选择图片。
            之前使用 capture="environment" 直接调起后置摄像头，但在微信 WebView 中
            部分机型拍照确认后会因返回大图导致 WebView 内存溢出崩溃。
            因此去掉 capture 属性，让用户在弹窗中选择「拍照」或「从相册选择」，
            系统会预压缩图片，稳定性更好。
            仍必须由「开始拍照」按钮原生点击事件同步触发 input.click()，
            否则微信会拦截摄像头/相册权限。
        -->
        <input ref="cameraInputRef" type="file" accept="image/*" class="camera-input-hidden"
            @change="onCameraCapture" />

        <div class="course-wrap">
            <!-- 拍照录入入口 -->
            <div class="camera-card">
                <div class="camera-avatar">
                    <img :src="cameraCaptureImg" alt="相机" />
                </div>
                <div class="camera-title">拍照识别课程表</div>
                <div class="camera-desc">对准纸质课程表拍照，自动识别并生成电子课程表</div>
                <!-- @click 同步触发 triggerCamera -> input.click()，不可异步化 -->
                <button class="camera-btn" @click="triggerCamera">开始拍照</button>
            </div>

            <!-- 当前课程表预览 -->
            <div class="preview-header">
                <div class="preview-title">本周课程表</div>
                <div v-if="!isEditMode" class="preview-edit" @click="editCourse">
                    <svg class="edit-icon" width="16" height="16" viewBox="2 1 13 13" fill="none">
                        <path
                            d="M12.24173828125,13.99453075L4.11705088125,13.99453075C2.95001948125,13.99453075,2.00048828125,13.04499875,2.00048828125,11.87796875L2.00048828125,3.75328135C2.00048828125,2.58624995,2.95001948125,1.63671875,4.11705088125,1.63671875L8.17939428125,1.63671875C8.52455088125,1.63671875,8.804394681249999,1.9165625,8.804394681249999,2.26171875C8.804394681249999,2.60687494,8.52455088125,2.88671875,8.17939428125,2.88671875L4.11705088125,2.88671875C3.63923828125,2.88671875,3.25048828125,3.27546875,3.25048828125,3.75328135L3.25048828125,11.87796875C3.25048828125,12.35578175,3.63923828125,12.74453075,4.11705088125,12.74453075L12.24173828125,12.74453075C12.71955128125,12.74453075,13.10830028125,12.35578175,13.10830028125,11.87796875L13.10830028125,7.81562475C13.10830028125,7.47046855,13.38814428125,7.19062475,13.73330028125,7.19062475C14.07845728125,7.19062475,14.35830028125,7.47046855,14.35830028125,7.81562475L14.35830028125,11.87796875C14.35830028125,13.04499875,13.40876828125,13.99453075,12.24173828125,13.99453075Z"
                            fill="#F1B100" />
                        <path
                            d="M7.15470701625,9.52474596875C6.9947070162500005,9.52474596875,6.83486327625,9.46365256875,6.71283203625,9.34162096875C6.46876953125,9.09755806875,6.46876953125,8.70177696875,6.71283203625,8.45771506875L13.60908225625,1.56146484875C13.85314415625,1.31740234375,14.24892525625,1.31740234375,14.49298815625,1.56146484875C14.73705005625,1.80552729875,14.73705005625,2.20130854875,14.49298815625,2.44537106875L7.59673825625,9.34162096875C7.47470706625,9.46380896875,7.31470703625,9.52474596875,7.15470701625,9.52474596875Z"
                            fill="#F1B100" />
                    </svg>
                    <span>修改</span>
                </div>
                <div v-else class="preview-save" @click="editCourse">保存</div>
            </div>

            <!-- 晨间唤醒播报提示（位于课程表卡片上方） -->
            <div class="preview-hint">提示：晨间唤醒任务完成后，将自动播报当日课程</div>

            <div class="preview-card">
                <!-- 周几切换 -->
                <div class="day-tabs">
                    <div v-for="(day, idx) in weekdays" :key="day" class="day-tab"
                        :class="{ active: activeDay === idx }" @click="selectDay(idx)">
                        <div class="day-en">{{ weekdayEn[idx] }}</div>
                        <div class="day-zh">{{ day }}</div>
                    </div>
                </div>

                <!-- 课程列表 -->
                <div class="course-list">
                    <template v-if="isEditMode">
                        <div v-for="(item, idx) in editCourses" :key="idx" class="course-row-edit"
                            :class="{ 'with-divider': idx < editCourses.length - 1 }">
                            <div class="edit-time-slot">{{ editCourses[idx].time }}</div>
                            <div class="edit-course-box">
                                <input v-model="editCourses[idx].name" type="text" class="edit-course-input"
                                    placeholder="请输入课程" maxlength="20" />
                            </div>
                        </div>
                    </template>
                    <template v-else>
                        <div v-for="(item, idx) in visibleCourses" :key="idx" class="course-item"
                            :class="{ 'with-divider': idx < visibleCourses.length - 1 }">
                            <div class="course-time-badge">{{ timeSlots[idx] }}</div>
                            <div class="course-divider-vertical"></div>
                            <div class="course-name">{{ item.name }}</div>
                        </div>
                    </template>
                </div>
            </div>
        </div>

        <!-- 识别 Loading 遮罩 -->
        <div v-if="ocrLoading" class="ocr-mask">
            <div class="ocr-loading-box">
                <div class="ocr-spinner"></div>
                <div class="ocr-loading-text">{{ ocrStatus || '识别中…' }}</div>
                <div class="ocr-progress-bar">
                    <div class="ocr-progress-fill" :style="{ width: ocrProgress + '%' }"></div>
                </div>
                <div class="ocr-loading-sub">正在识别，请稍候</div>
            </div>
        </div>

        <!-- 识别错误提示 -->
        <div v-if="ocrError" class="ocr-mask" @click.self="dismissOcrError">
            <div class="ocr-error-box">
                <div class="ocr-error-title">识别失败</div>
                <div class="ocr-error-desc">{{ ocrError }}</div>
                <div class="ocr-error-tip">可点击「修改」手动录入课程</div>
                <button class="ocr-error-btn" @click="dismissOcrError">知道了</button>
            </div>
        </div>

        <!-- 识别结果编辑弹窗：5 天 x 6 节 -->
        <div v-if="isOcrDialogOpen" class="ocr-dialog-mask">
            <div class="ocr-dialog">
                <div class="ocr-dialog-header">
                    <div class="ocr-dialog-title">识别结果（可编辑）</div>
                    <div class="ocr-dialog-close" @click="closeOcrDialog">✕</div>
                </div>
                <div class="ocr-dialog-body">
                    <table class="ocr-table">
                        <thead>
                            <tr>
                                <th class="ocr-table-corner"></th>
                                <th v-for="(day, d) in weekdays" :key="d">{{ day }}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="(period, p) in PERIOD_COUNT" :key="p">
                                <td class="ocr-table-rowhead">{{ timeSlots[p] }}</td>
                                <td v-for="(day, d) in weekdays" :key="d" class="ocr-table-cell">
                                    <input v-model="ocrDialogMap[d][p].name" type="text" class="ocr-cell-input"
                                        placeholder="—" maxlength="20" />
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div class="ocr-dialog-footer">
                    <button class="ocr-dialog-btn cancel" @click="closeOcrDialog">取消</button>
                    <button class="ocr-dialog-btn confirm" @click="saveOcrDialog">保存</button>
                </div>
            </div>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.page-course-table {
    min-height: 100vh;
    background: #fafafc;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
}

/* 隐藏的拍照 input：仅作相机触发媒介，不占布局；pointer-events:none 防止误触 */
.camera-input-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    border: 0;
    overflow: hidden;
    clip: rect(0 0 0 0);
    opacity: 0;
    pointer-events: none;
}

.course-wrap {
    padding: 8px 12px 24px;
}

/* 拍照录入入口卡片 */
.camera-card {
    width: 351px;
    height: 204px;
    margin: 0 auto 24px;
    background: #ffffff;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-top: 16px;
    box-sizing: border-box;

    .camera-avatar {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: #f7f7f7;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 12px;

        img {
            width: 30px;
            height: 27.87px;
            object-fit: contain;
        }
    }

    .camera-title {
        font-family: 'PingFang SC', sans-serif;
        font-size: 14px;
        font-weight: 500;
        color: #0c121f;
        line-height: 20px;
        margin-bottom: 6px;
    }

    .camera-desc {
        font-family: 'PingFang SC', sans-serif;
        font-size: 11px;
        font-weight: 400;
        color: rgba(12, 18, 31, 0.6);
        line-height: 12px;
        margin-bottom: 20px;
    }

    .camera-btn {
        width: 263px;
        height: 40px;
        border: none;
        border-radius: 8px;
        background: linear-gradient(271deg, #00b988 0%, #5cd2c1 98%);
        color: #ffffff;
        font-family: 'PingFang SC', sans-serif;
        font-size: 16px;
        font-weight: 500;
        line-height: 22px;
        cursor: pointer;
    }
}

.preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding: 0 4px;

    .preview-title {
        font-family: 'PingFang SC', sans-serif;
        font-size: 16px;
        font-weight: 500;
        color: #0b0a0a;
        line-height: 22px;
    }

    .preview-edit {
        display: flex;
        align-items: center;
        gap: 4px;
        font-family: 'PingFang SC', sans-serif;
        font-size: 12px;
        font-weight: 400;
        color: #f1b100;
        line-height: 17px;
        cursor: pointer;

        .edit-icon {
            width: 16px;
            height: 16px;
            flex-shrink: 0;
        }
    }

    .preview-save {
        font-family: 'PingFang SC', sans-serif;
        font-size: 12px;
        font-weight: 400;
        color: #02ba89;
        line-height: 17px;
        cursor: pointer;
    }
}

// 晨间唤醒播报提示（位于课程表卡片上方）
.preview-hint {
    width: 351px;
    margin: 0 auto 8px;
    font-family: 'PingFang SC', sans-serif;
    font-size: 12px;
    color: #8f9098;
    line-height: 17px;
}

.preview-card {
    width: 351px;
    min-height: 518px;
    margin: 0 auto;
    background: #ffffff;
    border-radius: 16px;
    padding: 16px;
    box-sizing: border-box;

    .day-tabs {
        display: flex;
        justify-content: space-between;
        gap: 11px;
        margin-bottom: 4px;
    }

    .day-tab {
        flex: 1;
        min-width: 56px;
        height: 64px;
        border-radius: 16px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 4px;
        cursor: pointer;

        .day-en {
            font-family: 'PingFang SC', sans-serif;
            font-size: 10px;
            font-weight: 600;
            color: #8f9098;
            line-height: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .day-zh {
            font-family: 'PingFang SC', sans-serif;
            font-size: 16px;
            font-weight: 400;
            color: #494a50;
            line-height: 22px;
        }

        &.active {
            background: #02ba89;

            .day-en,
            .day-zh {
                color: #ffffff;
            }
        }
    }

    .course-list {
        display: flex;
        flex-direction: column;
    }

    .course-item {
        display: flex;
        align-items: center;
        padding: 16px 0;

        &.with-divider {
            border-bottom: 0.5px solid rgba(33, 33, 33, 0.06);
        }
    }

    .course-time-badge {
        min-width: 80px;
        height: 28px;
        padding: 0 16px;
        box-sizing: border-box;
        border-radius: 16px;
        background: rgba(241, 177, 0, 0.12);
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'PingFang SC', sans-serif;
        font-size: 13px;
        font-weight: 500;
        color: #f1b100;
        line-height: 20px;
        margin-right: 12px;
        flex-shrink: 0;
    }

    .course-divider-vertical {
        width: 0.5px;
        height: 20px;
        background: #eeeeee;
        margin-right: 12px;
        flex-shrink: 0;
    }

    .course-name {
        flex: 1;
        font-family: 'PingFang SC', sans-serif;
        font-size: 18px;
        font-weight: 500;
        color: #0b0a0a;
        line-height: 25px;
        // 课程名称在单元格内水平居中显示
        text-align: center;
    }

    /* 行内编辑模式 */
    .course-row-edit {
        display: flex;
        align-items: center;
        padding: 10px 0;

        &.with-divider {
            border-bottom: 0.5px solid rgba(33, 33, 33, 0.06);
        }
    }

    .edit-time-slot {
        min-width: 80px;
        height: 28px;
        padding: 0 16px;
        box-sizing: border-box;
        border-radius: 16px;
        background: rgba(241, 177, 0, 0.12);
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'PingFang SC', sans-serif;
        font-size: 13px;
        font-weight: 500;
        color: #f1b100;
        line-height: 20px;
        margin-right: 12px;
        flex-shrink: 0;
    }

    .edit-course-box {
        flex: 1;
        height: 40px;
        border-radius: 8px;
        background: #f5f7fa;
        border: 1px solid #02ba89;
        box-sizing: border-box;
        display: flex;
        align-items: center;

        .edit-course-input {
            width: 100%;
            height: 100%;
            border: none;
            background: transparent;
            padding: 0 16px;
            font-family: 'PingFang SC', sans-serif;
            font-size: 18px;
            font-weight: 500;
            color: #0b0a0a;
            line-height: 25px;
            outline: none;
            text-align: center;
            box-sizing: border-box;

            &::placeholder {
                color: rgba(11, 10, 10, 0.4);
                font-size: 14px;
                font-weight: 400;
            }
        }
    }
}

/* ===================== 识别 Loading / 错误 遮罩 ===================== */
.ocr-mask {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.ocr-loading-box {
    width: 260px;
    padding: 28px 20px 24px;
    background: #ffffff;
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
}

.ocr-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(2, 186, 137, 0.2);
    border-top-color: #02ba89;
    border-radius: 50%;
    animation: ocr-spin 0.8s linear infinite;
}

@keyframes ocr-spin {
    to {
        transform: rotate(360deg);
    }
}

.ocr-loading-text {
    font-family: 'PingFang SC', sans-serif;
    font-size: 15px;
    font-weight: 500;
    color: #0b0a0a;
    line-height: 21px;
}

.ocr-progress-bar {
    width: 100%;
    height: 4px;
    background: rgba(2, 186, 137, 0.1);
    border-radius: 2px;
    overflow: hidden;
}

.ocr-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #00b988, #5cd2c1);
    border-radius: 2px;
    transition: width 0.3s ease;
}

.ocr-loading-sub {
    font-family: 'PingFang SC', sans-serif;
    font-size: 12px;
    color: rgba(11, 10, 10, 0.5);
    line-height: 17px;
    text-align: center;
}

.ocr-error-box {
    width: 280px;
    padding: 24px 20px 20px;
    background: #ffffff;
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    align-items: center;

    .ocr-error-title {
        font-family: 'PingFang SC', sans-serif;
        font-size: 17px;
        font-weight: 600;
        color: #0b0a0a;
        margin-bottom: 10px;
    }

    .ocr-error-desc {
        font-family: 'PingFang SC', sans-serif;
        font-size: 14px;
        color: rgba(11, 10, 10, 0.7);
        line-height: 20px;
        text-align: center;
        margin-bottom: 6px;
    }

    .ocr-error-tip {
        font-family: 'PingFang SC', sans-serif;
        font-size: 12px;
        color: rgba(11, 10, 10, 0.5);
        line-height: 17px;
        margin-bottom: 18px;
    }

    .ocr-error-btn {
        width: 100%;
        height: 40px;
        border: none;
        border-radius: 8px;
        background: linear-gradient(271deg, #00b988 0%, #5cd2c1 98%);
        color: #ffffff;
        font-family: 'PingFang SC', sans-serif;
        font-size: 15px;
        font-weight: 500;
        cursor: pointer;
    }
}

/* ===================== 识别结果编辑弹窗 ===================== */
.ocr-dialog-mask {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    z-index: 1001;
}

.ocr-dialog {
    width: 100%;
    max-width: 420px;
    max-height: 86vh;
    background: #ffffff;
    border-radius: 16px 16px 0 0;
    display: flex;
    flex-direction: column;
    animation: ocr-dialog-up 0.22s ease;
}

@keyframes ocr-dialog-up {
    from {
        transform: translateY(100%);
    }

    to {
        transform: translateY(0);
    }
}

.ocr-dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    border-bottom: 0.5px solid rgba(33, 33, 33, 0.06);

    .ocr-dialog-title {
        font-family: 'PingFang SC', sans-serif;
        font-size: 16px;
        font-weight: 600;
        color: #0b0a0a;
    }

    .ocr-dialog-close {
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: rgba(11, 10, 10, 0.5);
        font-size: 16px;
        cursor: pointer;
    }
}

.ocr-dialog-body {
    flex: 1;
    overflow: auto;
    -webkit-overflow-scrolling: touch;
    padding: 8px 8px 16px;
}

.ocr-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;

    th,
    td {
        border: 0.5px solid rgba(33, 33, 33, 0.08);
        text-align: center;
        font-family: 'PingFang SC', sans-serif;
    }

    th {
        height: 36px;
        font-size: 12px;
        font-weight: 600;
        color: #494a50;
        background: #f7f8fa;
    }

    .ocr-table-corner {
        width: 44px;
        background: #f7f8fa;
    }

    .ocr-table-rowhead {
        height: 44px;
        font-size: 12px;
        font-weight: 500;
        color: #f1b100;
        background: rgba(241, 177, 0, 0.06);
    }

    .ocr-table-cell {
        padding: 2px;
    }

    .ocr-cell-input {
        width: 100%;
        height: 40px;
        border: none;
        background: transparent;
        text-align: center;
        font-size: 13px;
        font-weight: 500;
        color: #0b0a0a;
        outline: none;

        &::placeholder {
            color: rgba(11, 10, 10, 0.25);
        }

        &:focus {
            background: rgba(2, 186, 137, 0.08);
        }
    }
}

.ocr-dialog-footer {
    display: flex;
    gap: 12px;
    padding: 12px 16px 20px;
    border-top: 0.5px solid rgba(33, 33, 33, 0.06);

    .ocr-dialog-btn {
        flex: 1;
        height: 44px;
        border: none;
        border-radius: 8px;
        font-family: 'PingFang SC', sans-serif;
        font-size: 15px;
        font-weight: 500;
        cursor: pointer;

        &.cancel {
            background: #f5f7fa;
            color: #494a50;
        }

        &.confirm {
            background: linear-gradient(271deg, #00b988 0%, #5cd2c1 98%);
            color: #ffffff;
        }
    }
}
</style>
