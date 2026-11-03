import baseConfig from "./vite.config";

/**
 * 灵机平台发布专用构建配置。
 *
 * 平台会把 zip 内所有资源平铺托管在 /<pid>/<version>/ 下，且对子目录支持不稳定
 * （实测 static/ 目录整体未被部署），因此这里输出扁平结构：所有 js/css 直接位于
 * 产物根级。同时关闭 CSS 代码分割，避免 Vite 为异步 chunk 生成 css/ 预加载路径
 * （扁平化后该路径不存在，会抛 Unable to preload CSS 导致路由空白）。
 */
export default (env: Parameters<typeof baseConfig>[0]) => {
  const base = baseConfig(env) as any;
  return {
    ...base,
    base: "./",
    build: {
      ...(base.build || {}),
      cssCodeSplit: false,
      rollupOptions: {
        ...((base.build || {}).rollupOptions || {}),
        output: {
          assetFileNames: "[name]-[hash][extname]",
          chunkFileNames: "[name]-[hash].js",
          entryFileNames: "[name]-[hash].js"
        }
      }
    }
  };
};
