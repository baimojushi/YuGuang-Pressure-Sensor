import path from "node:path";
import { fileURLToPath, URL } from "node:url";
import { UserConfigExport, ConfigEnv, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import vueJsx from "@vitejs/plugin-vue-jsx";
import legacy from "@vitejs/plugin-legacy";
// 注意：必须用相对路径引入，让 Vite 配置构建器（esbuild）转译该 .ts 插件；
// 若写成裸包名 "xjiang-sdk/bin/run-profile"，config 加载时会被当作外部模块，
// Node 无法直接加载 .ts 而报 ERR_UNKNOWN_FILE_EXTENSION
import runProfile from "./node_modules/xjiang-sdk/bin/run-profile";
import { viteVConsole } from "vite-plugin-vconsole";

function getPath(p: string) {
  return path.resolve(__dirname, p);
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default ({ command, mode }: ConfigEnv): UserConfigExport => {
  const env = loadEnv(mode, process.cwd(), "");
  const pdfOssOrigin = (env.VITE_DEV_PDF_OSS_ORIGIN || "").replace(/\/+$/, "");
  const pdfOssProxy = (
    env.VITE_DEV_PDF_OSS_PROXY || "/dev-proxy-pdf-oss"
  ).replace(/\/+$/, "");
  // IoT 接口域名未配置 CORS，本地 dev 通过代理转发，规避浏览器跨域限制
  const iotApiOrigin = (env.VITE_APP_IOT_API || "").replace(/\/+$/, "");
  const iotApiProxy = (env.VITE_DEV_IOT_API_PROXY || "/dev-proxy-iot").replace(
    /\/+$/,
    ""
  );
  const devProxy =
    command === "serve"
      ? {
          ...(pdfOssOrigin
            ? {
                [pdfOssProxy]: {
                  target: pdfOssOrigin,
                  changeOrigin: true,
                  secure: true,
                  rewrite: (p: string) =>
                    p.replace(
                      new RegExp(`^${escapeRegExp(pdfOssProxy)}`),
                      ""
                    ) || "/"
                }
              }
            : {}),
          ...(iotApiOrigin
            ? {
                [iotApiProxy]: {
                  target: iotApiOrigin,
                  changeOrigin: true,
                  secure: true,
                  rewrite: (p: string) =>
                    p.replace(
                      new RegExp(`^${escapeRegExp(iotApiProxy)}`),
                      ""
                    ) || "/"
                }
              }
            : {})
        }
      : undefined;
  const hasDevProxy = !!devProxy && Object.keys(devProxy).length > 0;

  return {
    plugins: [
      legacy({
        targets: ["defaults", "not IE 11"]
      }),
      vue(),
      vueJsx(),
      viteVConsole({
        entry: [path.resolve("src/main.ts")],
        enabled: true,
        config: {}
      }),
      runProfile({
        url: "./src/thingModel/Yuguang.json",
        configFile: getPath("src/config/config_Yuguang.json")
      })
    ],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url))
      }
    },
    optimizeDeps: {
      // xjiang-sdk/xjiang-ui 以 TS 源码发布且内部引用了 .vue 文件，
      // 不能交给 esbuild 预构建，否则会因无法处理 .vue 而报错
      exclude: ["xjiang-sdk", "xjiang-ui"]
    },
    base: "./",
    server: {
      open: "",
      host: "0.0.0.0",
      ...(hasDevProxy ? { proxy: devProxy } : {})
    },
    build: {
      rollupOptions: {
        output: {
          assetFileNames: assetInfo => {
            let extType = (assetInfo.name as string).split(".").at(1);
            if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType as string)) {
              extType = "img";
            }
            return `static/${extType}/[name]-[hash][extname]`;
          },
          chunkFileNames: "static/js/[name]-[hash].js",
          entryFileNames: "static/js/[name]-[hash].js"
        }
      }
    }
  };
};
