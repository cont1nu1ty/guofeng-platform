# 家风中华行 · 后台建设项目

更新：2026-09-26。按用户已确认计划，现已引入固定若依源码并实现家风模块；原 13 页后台保留，连接真实数据库、私有 S3 和会话。用户端相应基础流程同步接入。当前定位为本机试点业务系统，正式微信登录、AI 推理和全国生产验收另行迭代。

- [实际实现与数据模型](../../docs/engineering/backend-implementation.md)
- [Docker Compose 启动、备份与恢复](../../deploy/README.md)
- [本轮验证与证据](../../docs/verification/backend-runtime.md)
- [当前 API 契约](../../contracts/openapi.yaml)
- [后台界面使用](../../docs/frontend/admin-demo.md)

下列立项材料保留原调研日期，不能覆盖上面的实际状态：

| 文件 | 用途 |
| --- | --- |
| [后台需求](requirements.md) | PDF B-01 至 B-11 的完整范围 |
| [开源选型](selection.md) | 固定来源与历史候选比较；本轮实际引入看根 source-lock.json |
| [原整合计划](delivery-plan.md) | 立项时的任务划分和接口差距 |
| [候选快照](upstream-candidates.json) | 历史查询结果，不是实际安装依赖锁 |

所选若依提交没有可直接使用的租户模块。当前为单 MySQL 库，家风业务在服务端按岗位、本人归属、地区授权和分配任务隔离。原 PDF 的省级物理分库不属于本次交付。既有设备级样例不迁入真实数据库。
