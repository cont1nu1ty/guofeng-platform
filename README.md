# 家风中华行 · 前端展示项目

根据《小程序制做要求.pdf》（2026-08-13内部讨论稿）建设。当前有用户端Uni-app原型和独立运营后台Web原型，适合展示、操作和需求沟通；使用示例数据，不代表真实业务服务已经上线。

**当前用户端完成情况与待补界面已经按PDF重新核对，统一从 [docs文档导航](docs/README.md) 进入。**

| 要看什么                       | 文档                                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| 用户端哪些已完成、哪些仍需补   | [需求与界面对照](docs/frontend/user-status.md)                                                                                  |
| 下一轮只做前端的任务与验收条件 | [用户端前端待办](docs/frontend/user-backlog.md)                                                                                 |
| 用户端演示及微信导入方式       | [演示操作](docs/frontend/user-demo.md) · [微信预览](docs/frontend/wechat-preview.md)                                            |
| 已有后台界面及其本机边界       | [后台说明](docs/frontend/admin-demo.md) · [后台应用](apps/admin/README.md)                                                      |
| 原始PDF与完整需求              | [原PDF](docs/requirements/source/小程序制做要求.pdf) · [需求基线](docs/requirements/baseline.md)                                |
| 测试、截图、字体和包体结果     | [验证索引](docs/verification/README.md)                                                                                         |
| 架构、开源与真实后端接入       | [架构](docs/engineering/architecture.md) · [开源复用](docs/engineering/open-source.md) · [后台专项](projects/backend/README.md) |

## 启动用户端

建议使用与锁文件兼容的Node.js版本；工程最低要求20.19.0，本机使用26.9.0。在项目根目录执行：

```bash
cd apps/miniapp
npm ci
npm run dev:h5
```

浏览器访问 **http://localhost:5173/**。H5可用手机或桌面宽度展示；它不是微信发布地址。

```bash
npm run typecheck
npm run format:check
npm test
npm run build:h5
npm run build:mp-weixin
```

H5正式产物为 `apps/miniapp/dist/build/h5`；微信正式产物为 `apps/miniapp/dist/build/mp-weixin`。运行 `npm run dev:mp-weixin` 时导入 `dist/dev/mp-weixin`；开发与正式目录不能混用。AppID配置、编译缓存与权限排查见 [微信预览](docs/frontend/wechat-preview.md)。

## 启动已有后台界面

另开终端，在项目根目录执行：

```bash
cd apps/admin
npm ci
npm run dev
```

访问 **http://localhost:5174/**，不占用用户端5173。检查命令为 `npm run typecheck`、`npm test`、`npm run build`。

后台13个页面覆盖11类业务的界面演示；状态只在当前会话内，刷新恢复初始样例，不读取用户端本机数据。尚无真实登录、权限、Java服务、HTTP数据加载或用户端/后台同步。

## 工程组织

```text
apps/miniapp/       Uni-app/Vue3/TypeScript用户端；Wot UI；H5与微信
  src/domain/      共享领域数据、状态与校验
  src/composables/ 共享界面/存储/平台适配
  src/pkg-content/ 内容分包组件、私有domain/composables及音视频
apps/admin/         Vue3/Element Plus运营后台；示例内存交互
contracts/          OpenAPI草案，尚无对应真实服务
projects/backend/   后台专项需求、选型证据与整合计划
docs/               需求、当前前端状态、操作、工程与验证入口
licenses/           实际复用内容的许可证
source-lock.json    上游版本、引入范围与改动记录
```

用户端已有门户、投稿/进度、公示、典藏、传习、资讯、个人记录、视频、名人馆及助手页面。聊天/OCR/审核等仍有预设演示，地图/全景仍有示意；录音、文件播放、缓存、证书PNG等能力按各端已有实现和证据说明。当前完成范围以 [用户端对照](docs/frontend/user-status.md) 为准，不按入口数量推算生产完成率。

真实登录实名、云端稿件/文件、版权存证、AI推理、消息投递、订单和正式证书等仍需接入。手机字体/竖排、编辑器/权限、全量双语与适老等仍有待验证项；最新微信扫描主包及媒体总量建议也未全部通过。

优先复用已选组件和领域适配，第三方来源见 [声明](THIRD_PARTY_NOTICES.md)；版本检查点见 [迭代与回退](docs/history/iterations.md)。后续API通过适配层接入，身份与地区权限由真实服务端校验。
