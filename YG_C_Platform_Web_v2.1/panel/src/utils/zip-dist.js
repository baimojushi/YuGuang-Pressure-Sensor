import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置项
// 本文件位于 src/utils/，项目根目录需回退两级
const PROJECT_DIR = path.resolve(__dirname, "../..");
const DIST_DIR = path.join(PROJECT_DIR, "dist");
const TARGET_DIR = "/Users/cole/Desktop/安卓h5压缩包/yoyo/test";
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const ZIP_NAME = `dist_${TIMESTAMP}.zip`;
const ZIP_PATH = path.join(PROJECT_DIR, ZIP_NAME);

console.log("==========================================");
console.log("开始打包dist文件夹...");
console.log("==========================================");

// 检查dist目录是否存在
if (!fs.existsSync(DIST_DIR)) {
  console.error("❌ 错误: dist目录不存在，请先执行build命令");
  process.exit(1);
}

// 检查目标目录是否存在，不存在则创建
if (!fs.existsSync(TARGET_DIR)) {
  console.log("📁 目标目录不存在，正在创建...");
  try {
    fs.mkdirSync(TARGET_DIR, { recursive: true });
    console.log(`✅ 目标目录创建成功: ${TARGET_DIR}`);
  } catch (err) {
    console.error("❌ 错误: 无法创建目标目录", err.message);
    process.exit(1);
  }
}

// 压缩dist文件夹内的所有文件（不包含dist文件夹本身）
console.log("📦 正在压缩dist文件夹内的所有文件...");
try {
  // 进入dist目录，压缩所有内容，排除.DS_Store文件
  execSync(`cd "${DIST_DIR}" && zip -r "${ZIP_PATH}" . -x "*.DS_Store"`, {
    stdio: "inherit"
  });
  console.log(`✅ 压缩完成: ${ZIP_NAME}`);
} catch (err) {
  console.error("❌ 错误: 压缩失败", err.message);
  process.exit(1);
}

// 移动压缩包到目标目录
console.log("📤 正在移动压缩包到目标目录...");
try {
  const targetPath = path.join(TARGET_DIR, ZIP_NAME);
  fs.renameSync(ZIP_PATH, targetPath);
  console.log(`✅ 移动成功: ${targetPath}`);
} catch (err) {
  console.error("❌ 错误: 移动失败", err.message);
  process.exit(1);
}

console.log("==========================================");
console.log("🎉 全部完成！");
console.log(`📂 文件位置: ${path.join(TARGET_DIR, ZIP_NAME)}`);
console.log("==========================================");

// 尝试打开目标文件夹
try {
  execSync(`open "${TARGET_DIR}"`);
} catch (err) {
  // 忽略打开文件夹的错误
}
