# 微信开发者工具预览

本机H5预览是5173；本页介绍微信开发工具的导入路径，不表示真机验收通过。当前实测边界见 [验证索引](../verification/README.md)。

在 `apps/miniapp` 目录运行并保持终端开启：

```bash
npm run dev:mp-weixin
```

等待 `Build complete. Watching for changes...` 后，在微信开发者工具中导入 **`apps/miniapp/dist/dev/mp-weixin`**。所选目录内应直接看到 `app.json`、`app.js`、`project.config.json` 和 `pages/`。不要选择 `dist/dev`、`dist` 或 `apps/miniapp` 源码目录；这些目录没有可直接运行的小程序入口。

若只查看一次性构建，运行 `npm run build:mp-weixin` 后导入 **`apps/miniapp/dist/build/mp-weixin`**。开发命令只更新 `dev`，构建命令只更新 `build`。

AppID 的持久配置入口是 `apps/miniapp/src/manifest.json` 中的 `mp-weixin.appid`，不要只修改 `dist` 内的配置（再次编译会覆盖）。已将本机开发者工具项目中填写的 AppID 同步到该入口；需确保当前登录微信账号有该小程序的开发权限。

如果仍为空白：检查「详情 → 本地设置」中的项目目录和小程序目录，再使用普通编译模式、入口 `pages/index/index`，查看「调试器 → Console」第一条红色报错。无需执行「构建 npm」，当前产物已由 Uni-app 打包依赖。不要为此清空存储，以免丢失演示草稿。

已修复全局样式中 H5 专用通配选择器导致的微信 WXSS 编译错误；开发及构建产物的原生样式编译检查通过，用户已确认微信模拟器首页显示。尚未完成微信端全部交互和真机验证。**编译通过不代表满足文档中的微信 2.10.0 兼容要求**；Vue 3/Wot UI 和该旧版本要求需专项评估后明确最低基础库，见选型文档。
