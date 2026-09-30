# 评审窗口、预警与公开缓存验证

> 主分支同步说明：本文的部署、API 与截图记录来自演示数据分支固定提交 [`9b2cd19`](https://github.com/cont1nu1ty/guofeng-platform/commit/9b2cd193b79a350870b642de85f6c77b5c5fc781)。`main` 同步功能、迁移和通用测试，继续不包含业务演示数据包；原始运行结果/截图及依赖已导入样例的[缓存探针](https://github.com/cont1nu1ty/guofeng-platform/blob/9b2cd193b79a350870b642de85f6c77b5c5fc781/deploy/tests/public_cache_probe.py)保留在演示分支。18080 的部署记录不表示本次又部署了 `main`。

日期：2026-09-30。分支：`codex/demo-data-bootstrap`，基于 `a94f494` 的本地工作区增量。验证记录形成时尚未提交 Git；本次没有重置演示数据。实现规则见[工程说明](../engineering/review-windows-cache.md)。

## 本次分支同步检查

同步时保留两分支已有的搜索图标修复。两端应用、后端、OpenAPI、Compose 及 Dockerfile 与演示分支提交 `9b2cd19` 逐文件一致；主分支的缺包保护继续保留。主分支部署单元测试 **21 项通过**。合并后的共享用户端代码重新执行类型检查、**123 项测试**、H5 和微信小程序构建，全部通过；本次微信主包为 **1,620,148 字节**。本次同步没有重启现有部署，没有再次进行后端 API、Redis 故障注入或网页交互验收，下文是对应功能交付时的实测记录。

## 范围与环境

评审任务增加 UTC 开始/截止时间、窗口版本、服务端评分资格、延期审计、临期及逾期站内消息；后台增加分页预警与个人已读入口。公开目录与统计独立缓存，私人数据实时按身份组装。没有增加消息队列、备份管理或独立调度平台。

迁移、写入、并发、重启及 Redis 停机测试在独立 Compose 项目 `jiafeng-demo-review-cache`、端口 `18082` 执行。测试使用独立数据库、Redis、文件卷及账号凭据，没有对原 `18080` 演示环境执行故障注入或测试业务写入。

## 后端与接口

- Java 58 项测试通过，0 失败/错误/跳过；[分类结果](https://github.com/cont1nu1ty/guofeng-platform/blob/9b2cd193b79a350870b642de85f6c77b5c5fc781/docs/verification/previews/review-cache-2026-09-30/backend-tests.json)。其中窗口 12 项、缓存与公开投影 16 项。可注入时钟覆盖开始瞬间及截止瞬间，评分区间为 `[startsAt, dueAt)`。
- [评审真实接口 22 项](https://github.com/cont1nu1ty/guofeng-platform/blob/9b2cd193b79a350870b642de85f6c77b5c5fc781/docs/verification/previews/review-cache-2026-09-30/review-probe.json)通过：未来开始、过期禁止、延期恢复、原因与版本校验、地区范围、通知本人已读、任务跳转字段、分页、同任务并发延期、完成/取消锁定，以及提醒开关。
- [并发评分与延期 7 项](https://github.com/cont1nu1ty/guofeng-platform/blob/9b2cd193b79a350870b642de85f6c77b5c5fc781/docs/verification/previews/review-cache-2026-09-30/review-race-probe.json)通过：同任务、同版本并发请求仅评分返回 200，延期返回 412；任务与索引版本、截止时间、评分、流程和审计一致，无部分提交。
- [既有业务 API 32 项回归](https://github.com/cont1nu1ty/guofeng-platform/blob/9b2cd193b79a350870b642de85f6c77b5c5fc781/docs/verification/previews/review-cache-2026-09-30/business-probe.json)通过，包含真实报名最后一个名额竞争、取消/重新报名、库存并发、私有附件、幂等及账号权限；报名容量和库存校验继续以数据库为准。
- 实际启动两台后端共用 MySQL 账本，临期仅通知专家、首次逾期通知专家及负责运营；缩回单实例并重启后，没有重复投递。关闭再开启后已有逾期不补发，延期后的新窗口重新提醒。
- 独立补测[匿名访问预警返回 401](https://github.com/cont1nu1ty/guofeng-platform/blob/9b2cd193b79a350870b642de85f6c77b5c5fc781/docs/verification/previews/review-cache-2026-09-30/anonymous-alert-access.json)；22 项中的普通会员检查为 403，两者不混记。
- [迁移检查](https://github.com/cont1nu1ty/guofeng-platform/blob/9b2cd193b79a350870b642de85f6c77b5c5fc781/docs/verification/previews/review-cache-2026-09-30/migration.json)：从旧镜像/schema 4 及完整演示数据升级至 schema 6，历史开始/截止时间保留、任务全部建立窗口索引，迁移时已有逾期没有集中补发。日期回填另核对整秒、毫秒及纳秒 UTC 格式。

取消任务沿用原接口行为：专家列表隐藏取消项，运营保留审计记录；完成/取消停止后续自动提醒。

## 查询与缓存

首次对比使用同一独立演示数据集，原镜像与新镜像均顺序请求公开工作区。每轮 30 次，冷启动另外单测一次；MySQL `performance_schema` 统计 `jf_entity` SELECT。

| 阶段 | 样本 | 每请求实体 SELECT | p50 | p95 |
| --- | ---: | ---: | ---: | ---: |
| [优化前](https://github.com/cont1nu1ty/guofeng-platform/blob/9b2cd193b79a350870b642de85f6c77b5c5fc781/docs/verification/previews/review-cache-2026-09-30/isolated-before.json) | 30 | 43 | 27.43 ms | 34.49 ms |
| [首次冷缓存](https://github.com/cont1nu1ty/guofeng-platform/blob/9b2cd193b79a350870b642de85f6c77b5c5fc781/docs/verification/previews/review-cache-2026-09-30/isolated-after-cold.json) | 1 | 28 | 160.71 ms | 单次值，不作分位数推断 |
| [热缓存](https://github.com/cont1nu1ty/guofeng-platform/blob/9b2cd193b79a350870b642de85f6c77b5c5fc781/docs/verification/previews/review-cache-2026-09-30/isolated-after-warm.json) | 30 | 0 | 13.15 ms | 21.64 ms |

热缓存仍执行 4 次轻量内容版本查询，因此“0”仅表示实体 SELECT，不是数据库零请求。上述首轮数据早于最后的 Redis 同步派发超时补强；最终部署的复测单列。样本仅代表本机、当前小型演示集与顺序访问，不是生产容量或全国性能承诺。

[真实缓存接口 21 项](https://github.com/cont1nu1ty/guofeng-platform/blob/9b2cd193b79a350870b642de85f6c77b5c5fc781/docs/verification/previews/review-cache-2026-09-30/cache-probe.json)通过：冷/热响应一致、共享条目无私人分区、跨账号隔离、发布/下架及首页配置即时生效、轮播无写入时自动开始/结束、统计时间刷新、命令读自身写入、Redis 停机回源及恢复、数据库 epoch 切换。受控 MySQL 事务将内容和版本一起修改后回滚，两者保持原值，公开响应未变化；这与命令缓存绕过单测共同验证回滚边界，没有故障注入实际业务命令的中途回滚。最终镜像在 Redis 停止后的首个匿名请求耗时 **124.11 毫秒**，随后恢复正常。

缓存单元测试使用模拟数据库/Redis，覆盖深拷贝隔离、版本/epoch 失效、并发旧版本回填、事务内不读写缓存、轮播时间边界、统计固定生命周期、缓存关闭、同进程合并及同步/异步超时。不得把模拟事务上下文测试表述为真实 MySQL 业务事务回滚。

最初 Redis 停机探针能返回数据，但一次请求超出 1.5 秒阈值；单独复测未复现，不能确定那一次延迟原因。代码审查发现同步派发尚未纳入截止时间，已用最多 8 个不排队的后台线程补齐整个可选缓存操作的 100 毫秒等待限制，并新增阻塞派发回归测试。登录会话 Redis 策略没有改变。

## 原演示部署更新与复测

原 `http://127.0.0.1:18080/` 与 `/admin/` 已更新至最终前后端镜像、schema 6，六个服务全部健康。[只读核验](https://github.com/cont1nu1ty/guofeng-platform/blob/9b2cd193b79a350870b642de85f6c77b5c5fc781/docs/verification/previews/review-cache-2026-09-30/deployed-probe.json)确认原有全部业务实体 ID 保留，**13 个账号、16 份稿件、17 个稿件版本、51 个评审任务、19 份文件记录**及原数据卷不变；51 个任务均已建立窗口索引。全国运营和专家登录、匿名私人数据为空、专家窗口字段及后台预警查询均通过。没有执行重置或重新导入数据。

使用原部署同一演示数据再次顺序测量，公开响应由 60,439 字节增加为 60,484 字节（增加统计时间字段）：

| 阶段 | 样本 | 每请求实体 SELECT | p50 | p95 |
| --- | ---: | ---: | ---: | ---: |
| [更新前](https://github.com/cont1nu1ty/guofeng-platform/blob/9b2cd193b79a350870b642de85f6c77b5c5fc781/docs/verification/previews/review-cache-2026-09-30/original-before-final.json) | 30 | 43.03 | 28.57 ms | 41.23 ms |
| [更新后冷缓存](https://github.com/cont1nu1ty/guofeng-platform/blob/9b2cd193b79a350870b642de85f6c77b5c5fc781/docs/verification/previews/review-cache-2026-09-30/original-after-cold-final.json) | 1 | 28 | 181.47 ms | 单次值 |
| [更新后热缓存](https://github.com/cont1nu1ty/guofeng-platform/blob/9b2cd193b79a350870b642de85f6c77b5c5fc781/docs/verification/previews/review-cache-2026-09-30/original-after-warm-final.json) | 30 | 0 | 12.93 ms | 18.96 ms |

数据库 digest 计数会包含同时发生的后台查询，更新前 30 次累计 1,291 次实体 SELECT，不能把其中多出的 1 次归因给某个请求。热缓存仍保留每次请求 4 次版本查询。冷缓存包含首次组装和 JVM 预热开销；该小样本未验证统计显著性。

[本次部署验证窗口的缓存计数](https://github.com/cont1nu1ty/guofeng-platform/blob/9b2cd193b79a350870b642de85f6c77b5c5fc781/docs/verification/previews/review-cache-2026-09-30/cache-metrics.json)为公开目录/统计各 32 次命中、1 次未命中，合计命中率 **96.97%**；包含首次冷请求、顺序测量和只读核验，不作为生产命中率预测。

独立测试项目完成后已停止，保留其数据卷与本地证据；原 18080 部署继续运行。之前未提交的两份 2026-09-29 部署记录仍保留。

## 前端与工程

[工程检查汇总](https://github.com/cont1nu1ty/guofeng-platform/blob/9b2cd193b79a350870b642de85f6c77b5c5fc781/docs/verification/previews/review-cache-2026-09-30/engineering-checks.json)：用户端类型检查、123 项测试、H5 构建及微信小程序构建通过；后台类型检查、42 项测试与构建通过。部署 Python 22 项单测通过，OpenAPI YAML 和内部引用检查通过。微信主包 1,620,138 字节，编译结果不代表微信真机通过。

本轮 HTTP 页面检查使用 Chromium，后台分别为 1440/390 像素宽度，专家端为 390 像素宽度。[18 项浏览器检查](https://github.com/cont1nu1ty/guofeng-platform/blob/9b2cd193b79a350870b642de85f6c77b5c5fc781/docs/verification/previews/review-cache-2026-09-30/ui-probe.json)通过，0 JavaScript 页面错误，包含本次延期通知的精确任务跳转及点击后已读。截图位于[本轮目录](https://github.com/cont1nu1ty/guofeng-platform/tree/9b2cd193b79a350870b642de85f6c77b5c5fc781/docs/verification/previews/review-cache-2026-09-30/)。检查包含预警筛选、窗口完整时间、开始后禁止修改开始时间、必填原因、真实延期保存和专家逾期禁用评分。Playwright 的 Element Plus/Uni-app 定位与导航错误作为测试脚本问题修正，没有据此认定产品层级故障。最后 Mock 补丁合入并重建 Web 镜像后，以上 18 项在最终镜像上再次全部通过。

后台 Mock 新分配的完整 ISO 窗口也有本机时间状态与提交校验，固定时钟测试覆盖开始前、开始瞬间和截止瞬间。历史仅日期样例保留旧演示行为并明确提示；用户端原三维 Mock 不冒充真实四维专家任务。延期、自动预警、通知与 Redis 由 HTTP 服务提供，Mock 不模拟后台投递。

## 验证边界

- 站内通知经过真实 MySQL/HTTP 验证；不代表微信订阅、短信或邮件发送。
- H5 检查与小程序编译分开记录；没有新增微信手机真机、跨端录音或全国容量结论。
- 同进程缓存合并用单元测试验证；没有进行 Redis 集群切换或分布式缓存压测。
- 手工 SQL 或外部脚本直接改业务表时必须同时更新对应版本/epoch，不能假定应用的事务失效逻辑自动覆盖外部写入。
- 保留此前部署验证文档，不将历史验证计入本轮测试数量。
