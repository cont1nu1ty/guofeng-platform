# 项目协作说明

- 产品为「家风中华行」文化平台，首期以可沟通界面为优先。原始需求是讨论稿，当前用户优先级高于文档中的远期交付计划。
- 开始业务变更前，查看 `docs/01-requirements.md`、`docs/02-backlog.md` 和 `docs/05-demo-guide.md`，区分原文、建议和实际实现。
- 用户端为 Uni-app/Vue3/TypeScript；用 `view/text/input/textarea` 及跨端 API。DOM 专属逻辑必须隔离 H5，不能让网页能跑成为小程序兼容的证据。
- 优先复用 Wot UI 现有组件、所选后台基础模块。避免再实现一套按钮、弹层、身份权限或通用流程引擎。
- 共享业务状态和校验留在 `src/domain/`，内容分包私有逻辑留在 `src/pkg-content/domain/`，对应适配器放在分包的 `composables/`。共享跨平台存储在 `src/composables/useDemo.ts` 注入。真实 HTTP 接入需要异步接口适配，参照 `contracts/openapi.yaml`，不能在页面散布后台专属响应结构。
- 当前 Mock 是设备级单用户，不是真实租户系统。`region` 是展示筛选；权限、作品归属和数据源由未来服务端负责。
- 不把预设文本说成 AI 结果，不把原型版权勾选说成正式签章，不把示例统计说成运营数据，不把编译成功说成真机或容量验收通过。
- 引入开源代码保留 LICENSE，更新 `source-lock.json` 与 `THIRD_PARTY_NOTICES.md`。框架升级单独处理并锁定匹配编译版本。
- 页面/接口完成状态变化时同步 `docs/05-demo-guide.md`；测试记录只写实际执行的结果。
- 在 `apps/miniapp` 运行 `npm run typecheck`、`npm test`、`npm run build:h5` 和 `npm run build:mp-weixin`；界面变更检查桌面/手机样式与受影响交互。
