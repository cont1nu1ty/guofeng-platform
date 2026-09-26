import { createApp } from "vue";
import ElementPlus from "element-plus";
import zhCn from "element-plus/es/locale/lang/zh-cn";
import "element-plus/dist/index.css";
import "./styles/main.css";
import App from "./App.vue";
import { router } from "./router";

import { hasPermi } from "./services/session";
import { ApiError, reportError } from "./services/http";
import { ElMessage } from "element-plus";
const app = createApp(App).use(router).use(ElementPlus, { locale: zhCn });
app.directive("has-permi", hasPermi);
app.config.errorHandler = (error) => {
  if (error instanceof ApiError) {
    reportError(error);
    ElMessage.error(error.message);
  } else {
    console.error(error);
  }
};
app.mount("#app");
