# 家风中华行 · 本机真实业务平台

根据《小程序制做要求.pdf》（2026-08-13 内部讨论稿）建设。保留 Uni-app 用户端和独立运营后台，使用若依 Java 后端、MySQL、Redis、私有 S3、Elasticsearch、独立 AI 适配服务及 Docker Compose。本机 HTTP 模式使用真实会话与持久业务记录，原演示模式仍可独立运行。完整生产平台边界见 [实际实现](docs/engineering/backend-implementation.md)。

AI 新增能力、开发 API 和本地 URL 配置见 [AI 接入](docs/engineering/ai-applications.md) 与 [部署说明](deploy/README.md)。当前源码整合既有非 AI V014 与 AI V015，检查见[本次整合记录](docs/verification/ai-sync-2026-10-13.md)；原 AI V005 的实联证据保留日期，源码提交不代表运行环境已升级。

**当前用户端完成情况与待补界面已经按PDF重新核对，统一从 [docs文档导航](docs/README.md) 进入。**

**`main` 包含完整功能代码与部署配置，不包含可导入的模拟业务数据包及专用种子脚本。** 空卷启动只初始化开发账号和基础配置，重复启动保留已有数据。 分支拆分与空环境检查见[main 同步验证](docs/verification/main-sync-2026-09-27.md)。完整演示内容保留在 [codex/demo-data-bootstrap](https://github.com/cont1nu1ty/guofeng-platform/tree/codex/demo-data-bootstrap)，需在该分支显式导入；既有前端 Mock、静态示例资源与历史验证说明仍保留。

| 要看什么                       | 文档                                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| 用户端哪些已完成、哪些仍需补   | [需求与界面对照](docs/frontend/user-status.md)                                                                                  |
| 下一轮只做前端的任务与验收条件 | [用户端前端待办](docs/frontend/user-backlog.md)                                                                                 |
| 用户端演示及微信导入方式       | [演示操作](docs/frontend/user-demo.md) · [微信预览](docs/frontend/wechat-preview.md)                                            |
| 已有后台界面及其本机边界       | [后台说明](docs/frontend/admin-demo.md) · [后台应用](apps/admin/README.md)                                                      |
| 原始PDF与完整需求              | [原PDF](docs/requirements/source/小程序制做要求.pdf) · [需求基线](docs/requirements/baseline.md)                                |
| 测试、截图、字体和包体结果     | [验证索引](docs/verification/README.md)                                                                                         |
| 架构、开源与真实后端接入       | [架构](docs/engineering/architecture.md) · [开源复用](docs/engineering/open-source.md) · [后台专项](projects/backend/README.md) |

## 一键启动真实系统

```bash
./deploy/dev up
```

用户端访问 [18080](http://127.0.0.1:18080/)，后台访问 [18080/admin/](http://127.0.0.1:18080/admin/)。开发账号及随机密码位置、局域网配置、日志、停止、备份和隔离恢复见 [部署说明](deploy/README.md)。默认仅本机可达，不占用原有 5173/5174。

需要带内容演示时，另行检出 [演示数据分支](https://github.com/cont1nu1ty/guofeng-platform/tree/codex/demo-data-bootstrap)，按[演示数据启动说明](deploy/README.md#显式导入演示数据)启动并导入。`main` 上的导入及非空重置命令会在缺少数据包时提前拒绝，不下载数据、不清理现有业务；备份、恢复和默认启动仍可正常使用。

本轮实现与运行限制见 [后端实现](docs/engineering/backend-implementation.md)，实际执行的检查见 [真实后端验证](docs/verification/backend-runtime.md)。公开发布、专家材料和本人数据由服务端分别授权；不把既有设备演示数据自动导入数据库。

2026-09-27 新增本人云端诵读与家庭约定、网页录音转 MP3、后台音频故事及九类公开内容搜索。私人记录不公开，后台仅提供授权地区汇总。演示分支上的升级、重启、搜索故障补偿及新卷恢复历史结果见[功能验证](docs/verification/records-search-2026-09-27.md)。

## 单独启动用户端演示

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

未设置 `VITE_DATA_MODE=http` 时，后台仍为内存演示；真实模式通过异步 service 调用 `/api/v1`，13 个页面的基础操作连接持久数据和服务端权限。Compose 默认构建 HTTP 模式，独立前端联调方法见各应用 README。

## 工程组织

```text
apps/miniapp/       Uni-app/Vue3/TypeScript用户端；Wot UI；H5与微信
  src/domain/      共享领域数据、状态与校验
  src/composables/ 共享界面/存储/平台适配
  src/pkg-content/ 内容分包组件、私有domain/composables及音视频
apps/admin/         Vue3/Element Plus运营后台；HTTP / 演示适配
apps/server/        固定若依源码 + ruoyi-jiafeng 业务模块
apps/ai/            可配置模型与 OCR 适配器、受限资料解析
deploy/             Compose、版本镜像、备份恢复与真实接口验证
contracts/          当前已实现的 /api/v1 OpenAPI
projects/backend/   后台专项需求、选型证据与整合计划
docs/               需求、当前前端状态、操作、工程与验证入口
licenses/           实际复用内容的许可证
source-lock.json    上游版本、引入范围与改动记录
```

用户端已有门户、投稿/进度、公示、典藏、传习、资讯、个人记录、视频、名人馆及助手页面。HTTP 模式已接真实聊天、OCR、知识问答和审核辅助，原 demo 模式仍保留预设演示。HTTP 已接市县目录、显式 H5 地图/球面全景、多章课程及人工 PDF 证书；真实地图素材、微信降级、录音、文件播放与缓存按各端已有实现和证据说明。当前完成范围以 [用户端对照](docs/frontend/user-status.md) 为准，不按入口数量推算生产完成率。

当前已接开发账号真实会话、云稿/私有文件、站内消息与基础运营流程。正式微信登录与实名、第三方正式版权存证、本地模型部署与高级多模态、交易订单及生产验收仍待专项实现。手机字体/竖排、编辑器/权限、全量双语与适老等仍有待验证项；最新微信扫描主包及媒体总量建议也未全部通过。

优先复用已选组件和领域适配，第三方来源见 [声明](THIRD_PARTY_NOTICES.md)；版本检查点见 [迭代与回退](docs/history/iterations.md)。后续API通过适配层接入，身份与地区权限由真实服务端校验。
