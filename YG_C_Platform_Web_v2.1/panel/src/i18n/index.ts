import { i18n } from "xjiang-ui";

import zhCN from "./locale/zh-CN.json";
import enUS from "./locale/en-US.json";

i18n.global.mergeLocaleMessage("zh-CN", zhCN);
i18n.global.mergeLocaleMessage("en-US", enUS);

i18n.global.locale.value = "zh-CN" as any;

export default i18n;
