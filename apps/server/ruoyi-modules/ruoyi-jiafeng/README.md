# 家风业务模块

本模块中 cont1nu1ty 有权授权的原创软件部分采用仓库根目录的[家风中华行非商业源码许可证 1.0](../../../../LICENSE)，个人学习和非商业用途免费，商业用途须书面授权。`apps/server/LICENSE` 保留的是若依上游 MIT 许可，不是本模块原创代码的许可。第三方代码和依赖仍按各自许可使用；当前 MySQL JDBC 驱动组合分发问题见[商业授权说明](../../../../COMMERCIAL-LICENSE.txt)。

本模块依赖固定版本的 `ruoyi-system`、`ruoyi-workflow` 及公共组件。业务 HTTP 为 `/api/v1`，两端通过适配层接入；不要在页面解释若依原生响应，也不要把浏览器给出的地区/角色当作授权。

| 文件 | 职责 |
| --- | --- |
| `JfController` / `JfErrors` | 直接 DTO、ETag、幂等头、事务与语义 HTTP 错误 |
| `JfAuth` | 若依 Sa-Token 会话、开发登录、每次从数据库读取当前授权 |
| `JfStore` | 索引实体文档、乐观版本、幂等记录、审计与签到时间 |
| `JfSchema` / `db/jiafeng` | 顺序迁移、checksum、命名锁、仅开发配置的账号种子 |
| `JfFiles` | 校验 multipart、复用 OSS 上传、私有文件权限、公共端点短签名 |
| `JfSubmissions` | 草稿版本、不可变修订、协议记录、匹配草稿清理 |
| `JfReviewFlow` | 调用真实 WarmFlow 定义、实例、任务和轨迹 |
| `JfReview` | 匿名材料、专家权限、评分窗口、冻结版本、人工结果与发布 |
| `JfOperations` / `JfMember` | 后台与本人业务命令，活动、内容、典籍、公益、学习等 |
| `JfProjection` | 公开、本人、运营、专家的不同字段集合 |

写事务使用 READ COMMITTED，关键操作显式锁账户/业务记录。默认 REPEATABLE READ 的早期会话读取会创建旧快照，等待名额行锁后仍可能读到旧计数；不要去掉这里的隔离设置而仅保留行锁。权限在事务内校验，幂等只缓存操作结果，回放重新生成当前权限工作区。

`jf_entity` 保存一条一条的领域记录，归属、地区、状态和版本是索引列，领域正文为 JSON。稿件修订、文件元数据、版本附件关系和活动报名另有表与外键/唯一约束。当前适合本机试点；未来可把高频领域迁到专表，通过 service 保持契约兼容。

新增业务时同步契约、适配器和实际操作测试。已执行的 SQL 不能改写，追加 `V003__...sql` 并登记迁移顺序；SQL 需考虑 MySQL DDL 隐式提交后的可重入。不要在启动时覆盖既有账号、流程或业务记录。

从仓库根目录启动 `./deploy/dev up`。真实用例：`python3 deploy/tests/business_probe.py`、`python3 deploy/tests/workflow_probe.py`。它们操作开发账号并保留标记的验收记录，不能直接运行于生产数据。完整状态与部署边界见根目录 `docs/engineering/backend-implementation.md` 和 `docs/verification/backend-runtime.md`。
