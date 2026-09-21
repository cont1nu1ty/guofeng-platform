# 文档重组与旧路径对照

2026-09-21按内容职责整理；需求编号保留。旧文件不再保留内容副本，避免两个“当前状态”分别更新。

| 原docs根文件                        | 新位置                                               |
| ----------------------------------- | ---------------------------------------------------- |
| `01-requirements.md`                | [需求基线](../requirements/baseline.md)              |
| `02-backlog.md`                     | [产品级待办](../requirements/product-backlog.md)     |
| `03-open-source.md`                 | [开源选型](../engineering/open-source.md)            |
| `04-architecture.md`                | [架构说明](../engineering/architecture.md)           |
| `05-demo-guide.md`                  | [用户端演示](../frontend/user-demo.md)               |
| `06-backend-roadmap.md`             | [后端路线](../engineering/backend-roadmap.md)        |
| `07-validation.md`                  | [历史验证](../verification/history.md)               |
| `08-iteration-record.md`            | [迭代记录](iterations.md)                            |
| `09-fonts.md`                       | [字体说明](../engineering/fonts.md)                  |
| `10-pdf-coverage-audit.md`          | [PDF文档覆盖审计](../requirements/pdf-coverage.md)   |
| `11-wechat-startup-performance.md`  | [微信启动测量](../verification/wechat-startup.md)    |
| `12-font-comparison.md`             | [字体对比](../verification/font-comparison.md)       |
| `13-implementation-gap-analysis.md` | [接入与交付差距](../engineering/integration-gaps.md) |

旧05的后台段另拆为 [后台演示](../frontend/admin-demo.md)；旧07的后台界面验证拆为 [后台验证](../verification/admin-ui.md)。截图与基准分别移至 `docs/verification/previews/` 和 `docs/verification/benchmarks/`。原始JSON中的采集路径与时间保留，表示当时证据。

新增 [用户端状态](../frontend/user-status.md)、[用户端待办](../frontend/user-backlog.md)、[验证索引](../verification/README.md)，从 [文档入口](../README.md)访问。旧需求覆盖审计只检查“要求是否被记录”；全平台接入差距保留服务与生产范围，均不替代用户端前端状态。

工作区已有的后台说明、需求补录和历史记录已保留；本轮未更改后台源码或业务行为。
