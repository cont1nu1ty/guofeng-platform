# 项目文档导航

更新：2026-10-13。当前新增**可配置 AI 应用、OCR、知识资料索引和审核辅助**，保留既有用户端和后台界面。先看 [实际实现与运行边界](engineering/backend-implementation.md)、[启动部署](../deploy/README.md) 和 [本次源码整合记录](verification/ai-sync-2026-10-13.md)。原 PDF 仍是完整需求基线，远期生产要求不混入本机完成状态。

AI 与非 AI 功能已统一到同一源码；当前源码采用 V015 AI 迁移。此前 AI V005 的模型与网页实联记录见[原 AI 验证](verification/ai-2026-10-13.md)，不能代替整合后的容器、数据库或网页重验。各运行环境以对应日期记录为准。

2026-10-08：非 AI 业务源码已同步。完整数据与新增场景保留在演示分支，见[账号与查看路线](https://github.com/cont1nu1ty/guofeng-platform/blob/152e886ffc0518c44120bd4029e574f90194365f/docs/frontend/non-ai-showcase-2026-10-08.md)及[演示环境核验](https://github.com/cont1nu1ty/guofeng-platform/blob/152e886ffc0518c44120bd4029e574f90194365f/docs/verification/non-ai-showcase-2026-10-08.md)；main 不包含专用数据包，也不会在启动时导入。

2026-10-07 新增：[非 AI 功能实施结果](engineering/non-ai-implementation-2026-10-07.md) · [本轮验证](verification/non-ai-2026-10-07.md)。岗位、版本评审与课程、人工证书、资源与导出、调度报表、地区咨询和普通媒体已接入独立 19084 验证环境；原展示环境保留，正式微信/生产验收另列。

2026-09-30 新增：[评审时间窗口、站内预警与公开缓存](engineering/review-windows-cache.md) · [本轮验证](verification/review-cache-2026-09-30.md)。

`main` 同步功能实现和容器配置，当前文件树不包含可导入的模拟数据包或专用种子脚本；空卷启动只初始化开发账号与基础配置。先前本机演示数据整理为原创虚构场景，用于网页联动展示：[账号与演示路线](frontend/showcase-data.md) · [数据重建与网页验证](verification/demo-data-2026-09-26.md)。使用真实 HTTP、数据库与私有文件，不代表实际运营记录；原测试数据已备份。

新环境需要同一套初始演示场景时，另行检出 [codex/demo-data-bootstrap](https://github.com/cont1nu1ty/guofeng-platform/tree/codex/demo-data-bootstrap)，在该分支启动后显式导入。main 缺包时提前拒绝导入与带数据重置；普通启动不会下载或导入数据，见[启动与导入说明](../deploy/README.md#显式导入演示数据)。 本次主分支单独检查见[main 同步验证](verification/main-sync-2026-09-27.md)。

显式导入的空卷安装、重复执行、丢失本地清单及容器重建结果见[演示分支历史部署验证](verification/demo-bootstrap-2026-09-26.md)，不作为本次 main 拆分后的重新运行证据。

个人诵读与家庭约定按账号保存，后台只看授权地区汇总；私人内容不进入搜索。演示分支的既有环境可显式追加 `./deploy/dev seed-demo-records`，默认启动仍不导入演示数据。音频故事、九类公开搜索及验证范围见[本轮记录](verification/records-search-2026-09-27.md)。

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

AI 专题：[实现与边界](engineering/ai-applications.md) · [V015 整合检查](verification/ai-sync-2026-10-13.md) · [原 V005 实联证据](verification/ai-2026-10-13.md)。

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
