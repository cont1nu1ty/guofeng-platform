# 项目文档导航

更新：2026-09-26。当前新增**本机真实后端与容器部署**，保留既有用户端和后台界面。先看 [实际实现与运行边界](engineering/backend-implementation.md)、[启动部署](../deploy/README.md) 和 [本轮真实验证](verification/backend-runtime.md)。原 PDF 仍是完整需求基线，远期生产要求不混入本机完成状态。

当前本机数据已重新整理为原创虚构场景，用于网页联动展示：[账号与演示路线](frontend/showcase-data.md) · [数据重建与网页验证](verification/demo-data-2026-09-26.md)。使用真实 HTTP、数据库与私有文件，不代表实际运营记录；原测试数据已备份。

新环境需要同一套初始演示场景时，在 `./deploy/dev up` 成功后显式执行 `./deploy/dev seed-demo`；默认启动不导入。数据源与附件已随仓库提供，完成标记随数据库保留，见[启动与导入说明](../deploy/README.md#显式导入演示数据)。

显式导入的空卷安装、重复执行、丢失本地清单及容器重建结果见[本轮部署验证](verification/demo-bootstrap-2026-09-26.md)。

| 你想了解什么                                          | 阅读入口                                                                                                                                | 本文档负责什么                                                               |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| PDF 对照后，用户端哪些做了、还缺什么？                | [用户端需求与界面对照](frontend/user-status.md)                                                                                         | **用户端前端完成状态的唯一维护入口**，按原文编号列当前实现、缺口、来源与证据 |
| 下一轮还需补哪些能力？                                  | [用户端前端待办](frontend/user-backlog.md)                                                                                              | 用户端待办、HTTP 接入与真机验证边界                   |
| 如何演示和打开微信预览？                              | [用户端操作](frontend/user-demo.md) · [微信开发工具预览](frontend/wechat-preview.md)                                                    | 现有路径、操作方法及本机数据范围                                             |
| 原始要求具体写了什么？                                | [原 PDF](requirements/source/小程序制做要求.pdf) · [需求基线](requirements/baseline.md)                                                 | 原文与实施建议分开，保留 F/B/A/N/D/Q 编号及页码                              |
| 哪些要求曾漏记？                                      | [PDF 文档覆盖审计](requirements/pdf-coverage.md)                                                                                        | 47个原文来源单元是否记录；**不是功能完成率**                                 |
| 实际测过什么？                                        | [验证索引](verification/README.md)                                                                                                      | 当前证据、历史记录、未测环境、字体与质量扫描                                 |
| 当前后台前端能演示什么？                              | [后台界面说明](frontend/admin-demo.md) · [后台验证](verification/admin-ui.md)                                                           | 已有独立 Web 后台，和小程序用户端分开计数、分开验收                          |
| 后续如何接真实服务？                                  | [架构](engineering/architecture.md) · [接入与交付差距](engineering/integration-gaps.md) · [后台专项项目](../projects/backend/README.md) | 真实业务、权限、存储、AI及部署的后续工作，不挤入当前前端待办                 |
| 全国访问需要多少资源，私有模型/API 与云厂商如何选择？ | [部署与 AI 容量初评](engineering/deployment-assessment.md)                                                                              | PDF 部署约束、负载假设、算力/费用公式和官方价格来源；不等于已部署或压测通过  |

本轮新增：[首页轮播与内容目录管理](frontend/catalog-management.md) · [联动验证](verification/catalog-2026-09-26.md)。轮播、媒体、阵地、名人馆、订阅和咨询接入真实服务；采用增量数据，不再次清空旧记录。

## 目录分工

```text
docs/
  README.md                       文档入口与维护规则
  requirements/                   原始要求、整理基线、产品级路线
    source/                       原 PDF 与来源校验
  frontend/                       用户端完成状态、待办、用户/后台演示操作
  engineering/                    架构、开源复用、字体交付、未来服务接入
  verification/                   当前验证索引、运行记录与证据
    previews/                     截图及页面检查结果
    benchmarks/                   字体、字形、包体和启动测量
  history/                        迭代检查点、文档迁移映射
```

工程专题：[开源复用](engineering/open-source.md)、[字体交付](engineering/fonts.md)、[早期后端路线](engineering/backend-roadmap.md)。规划和历史：[产品级 Backlog](requirements/product-backlog.md)、[迭代与回退](history/iterations.md)、[旧文档位置对照](history/docs-migration.md)。

## 维护规则

1. 新需求先记录来源和原文编号；无法从 PDF 推导的设计建议明确标为建议。PDF 是需求输入，不自动授权下一阶段开发。
2. 功能变化先更新 [用户端状态](frontend/user-status.md)，再更新对应前端任务及演示步骤。后台界面变化只更新后台说明及其验证记录。
3. “已完成”只在指定范围内成立。预置对话不是 AI 服务，本机数据不是云端存储，平面空间示意不是720°全景，开发工具不是手机真机。
4. 验证记录注明日期、构建/源码范围、平台和实际执行项；最新结果从验证索引进入。保留历史失败，但注明后续是否已修复，不让旧记录覆盖新结论。
5. 截图、基准 JSON 等原始证据独立保存；历史 JSON 中的原采集路径不伪改。目录变更同步修正文档、根 README、协作说明及源码注释中的引用。
6. `projects/backend/` 继续维护后台专项需求与选型，不在 docs 再复制一份独立计划。原来的数字编号文档已按主题移动，编号追溯由需求 ID 和迁移表承担。
