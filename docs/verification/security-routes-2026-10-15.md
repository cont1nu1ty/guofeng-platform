# 独立部署安全检查：业务入口与授权调用链（2026-10-15）

本表逐条记录当前 `ruoyi-jiafeng` Controller 声明的 `/api/v1/**` 方法。它是本轮源码检查证据，不把逐路由源码阅读写成逐路由HTTP运行通过；实际运行结果以主安全检查记录为准。

统一调用链：HTTP → Controller 的 `auth.optional/require/admin` 或服务内 `auth.require` → `JfAccess` 功能权限 → 领域服务 owner/地区/岗位/版本/状态 → 最小投影或事务副作用。`application-compose.yml` 将 `/api/v1/**` 排除通用拦截器，业务层检查因此必须逐条存在。

| 入口 | 身份与功能权限 | 对象/范围/状态/返回或副作用 | 源码入口 | 本轮证据状态 |
| --- | --- | --- | --- | --- |
| `GET /api/v1/admin/accounts` | admin + users:read | JfAccounts.target地区全集包含；create/roles/resetPassword限全国；版本与authEpoch | [JfAccountsController:13](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfAccountsController.java#L13) | 源码已检查；运行见主记录 |
| `GET /api/v1/admin/accounts/{id}` | admin + users:read | JfAccounts.target地区全集包含；create/roles/resetPassword限全国；版本与authEpoch | [JfAccountsController:20](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfAccountsController.java#L20) | 源码已检查；运行见主记录 |
| `POST /api/v1/admin/accounts` | admin + users:create + 全国 | JfAccounts.target地区全集包含；create/roles/resetPassword限全国；版本与authEpoch | [JfAccountsController:23](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfAccountsController.java#L23) | 源码已检查；运行见主记录 |
| `POST /api/v1/admin/accounts/{id}/{action}` | admin + JfAccounts.permissionFor(action)；create/roles/resetPassword另限全国 | JfAccounts.target地区全集包含；create/roles/resetPassword限全国；版本与authEpoch | [JfAccountsController:29](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfAccountsController.java#L29) | 源码已检查；运行见主记录 |
| `GET /api/v1/ai/status` | 公开 | JfAi owner/ai:read/ai:write；知识引用按当前版本与地区重验 | [JfAiController:13](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfAiController.java#L13) | 源码已检查；运行见主记录 |
| `POST /api/v1/ai/tasks` | require（当前账号本人任务） | JfAi owner/ai:read/ai:write；知识引用按当前版本与地区重验 | [JfAiController:14](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfAiController.java#L14) | 源码已检查；运行见主记录 |
| `GET /api/v1/ai/tasks` | require（当前账号本人任务） | JfAi owner/ai:read/ai:write；知识引用按当前版本与地区重验 | [JfAiController:18](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfAiController.java#L18) | 源码已检查；运行见主记录 |
| `GET /api/v1/ai/tasks/{id}` | require（当前账号本人任务） | JfAi owner/ai:read/ai:write；知识引用按当前版本与地区重验 | [JfAiController:19](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfAiController.java#L19) | 源码已检查；运行见主记录 |
| `GET /api/v1/admin/ai/tasks` | admin + ai:read | JfAi owner/ai:read/ai:write；知识引用按当前版本与地区重验 | [JfAiController:20](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfAiController.java#L20) | 源码已检查；运行见主记录 |
| `POST /api/v1/admin/ai/knowledge/{id}/index` | admin + ai:write | JfAi owner/ai:read/ai:write；知识引用按当前版本与地区重验 | [JfAiController:21](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfAiController.java#L21) | 源码已检查；运行见主记录 |
| `POST /api/v1/admin/ai/knowledge/{id}/withdraw` | admin + ai:write | JfAi owner/ai:read/ai:write；知识引用按当前版本与地区重验 | [JfAiController:26](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfAiController.java#L26) | 源码已检查；运行见主记录 |
| `GET /api/v1/admin/certificates/eligible` | admin + certificates:write | JfCertificates持有人或certificates:read+地区；签发资格由稿件/学习记录得出；撤销拒绝新链接 | [JfCertificatesController:9](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfCertificatesController.java#L9) | 源码已检查；运行见主记录 |
| `GET /api/v1/admin/certificates` | admin + certificates:read | JfCertificates持有人或certificates:read+地区；签发资格由稿件/学习记录得出；撤销拒绝新链接 | [JfCertificatesController:10](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfCertificatesController.java#L10) | 源码已检查；运行见主记录 |
| `GET /api/v1/me/certificates` | require（本人列表） | JfCertificates持有人或certificates:read+地区；签发资格由稿件/学习记录得出；撤销拒绝新链接 | [JfCertificatesController:11](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfCertificatesController.java#L11) | 源码已检查；运行见主记录 |
| `POST /api/v1/admin/certificates` | admin + certificates:write | JfCertificates持有人或certificates:read+地区；签发资格由稿件/学习记录得出；撤销拒绝新链接 | [JfCertificatesController:12](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfCertificatesController.java#L12) | 源码已检查；运行见主记录 |
| `POST /api/v1/admin/certificates/{id}/revoke` | admin + certificates:write | JfCertificates持有人或certificates:read+地区；签发资格由稿件/学习记录得出；撤销拒绝新链接 | [JfCertificatesController:13](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfCertificatesController.java#L13) | 源码已检查；运行见主记录 |
| `GET /api/v1/certificates/{id}/download` | require（下载另允许certificates:read + 地区） | JfCertificates持有人或certificates:read+地区；签发资格由稿件/学习记录得出；撤销拒绝新链接 | [JfCertificatesController:14](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfCertificatesController.java#L14) | 源码已检查；运行见主记录 |
| `GET /api/v1/certificates/verify/{token}` | 公开（仅最小验真字段） | JfCertificates持有人或certificates:read+地区；签发资格由稿件/学习记录得出；撤销拒绝新链接 | [JfCertificatesController:15](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfCertificatesController.java#L15) | 源码已检查；运行见主记录 |
| `GET /api/v1/admin/consultations/{id}` | admin + welfare:read | JfConsultations.claim仅custom申领；本人owner或运营+地区；更新锁/版本/未取消 | [JfConsultationsController:11](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfConsultationsController.java#L11) | 源码已检查；运行见主记录 |
| `POST /api/v1/admin/consultations/{id}` | admin + welfare:write | JfConsultations.claim仅custom申领；本人owner或运营+地区；更新锁/版本/未取消 | [JfConsultationsController:12](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfConsultationsController.java#L12) | 源码已检查；运行见主记录 |
| `GET /api/v1/me/consultations/{id}` | require（本人） | JfConsultations.claim仅custom申领；本人owner或运营+地区；更新锁/版本/未取消 | [JfConsultationsController:16](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfConsultationsController.java#L16) | 源码已检查；运行见主记录 |
| `GET /api/v1/health` | 公开 | 仅schema.ready+SELECT 1；不代表Redis/搜索/模型就绪 | [JfController:69](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfController.java#L69) | 源码已检查；运行见主记录 |
| `POST /api/v1/auth/login` | 公开；devLogin/passwordLogin开关 | JfAuth BCrypt+IP/用户名失败计数；admin入口额外要求运营或专家；token标记jiafeng并限制路径 | [JfController:76](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfController.java#L76) | 源码已检查；运行见主记录 |
| `GET /api/v1/auth/me` | 登录 | JfAuth.require每请求查账号启用、岗位菜单、authEpoch；返回最小身份DTO | [JfController:81](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfController.java#L81) | 源码已检查；运行见主记录 |
| `POST /api/v1/auth/logout` | 登录 | 只退出当前Sa-Token会话；历史签名URL最多余300秒 | [JfController:86](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfController.java#L86) | 源码已检查；运行见主记录 |
| `POST /api/v1/auth/wechat` | 公开 | 固定503未配置，不回落模拟成功 | [JfController:93](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfController.java#L93) | 源码已检查；运行见主记录 |
| `GET /api/v1/workspace` | 公开可选身份 | JfProjection只缓存publicBase/publicStats；私人数组由actor.owner单独拼装 | [JfController:98](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfController.java#L98) | 源码已检查；运行见主记录 |
| `GET /api/v1/admin/workspace` | 后台 | JfProjection地区/专家owner盲材料投影+JfAccess.trimWorkspace按功能裁剪 | [JfController:103](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfController.java#L103) | 源码已检查；运行见主记录 |
| `GET /api/v1/me/draft` | 登录（服务层） | JfSubmissions.getDraft仅actor.id；不进入公共缓存 | [JfController:108](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfController.java#L108) | 源码已检查；运行见主记录 |
| `PUT /api/v1/me/draft` | 登录（服务层） | JfSubmissions.saveDraft仅actor.id；If-Match+行锁；字段与附件owner白名单校验 | [JfController:113](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfController.java#L113) | 源码已检查；运行见主记录 |
| `DELETE /api/v1/me/draft` | 登录（服务层） | JfSubmissions.saveDraft仅actor.id；If-Match+行锁 | [JfController:120](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfController.java#L120) | 源码已检查；运行见主记录 |
| `POST /api/v1/files` | 登录（服务层） | JfFiles.upload用途/扩展名/头/大小；recitation仅member；服务端生成对象键；FFmpeg有界槽位 | [JfController:130](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfController.java#L130) | 源码已检查；运行见主记录 |
| `GET /api/v1/files/{id}/public` | 公开 | JfCatalog.publicAssetAllowed只当前已发布banner/media引用；302签发300秒URL | [JfController:138](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfController.java#L138) | 源码已检查；运行见主记录 |
| `GET /api/v1/files/{id}/download` | 登录（服务层） | JfFiles.download本人或业务引用+读取权限+地区；expert不能据原件ID取文件；拒绝generated | [JfController:147](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfController.java#L147) | 源码已检查；运行见主记录 |
| `GET /api/v1/files/{id}/url` | 登录（服务层） | 与download同一方法，授权相同；签名有效期300秒 | [JfController:147](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfController.java#L147) | 源码已检查；运行见主记录 |
| `POST /api/v1/submissions` | 登录（服务层） | JfSubmissions.submit服务端owner/地区/状态/revision；账号动作幂等、附件owner、事务 | [JfController:152](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfController.java#L152) | 源码已检查；运行见主记录 |
| `POST /api/v1/submissions/{id}/revisions` | 登录（服务层） | 仅owner+returned+If-Match；新增不可变revision，不覆盖已绑定评审版本 | [JfController:159](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfController.java#L159) | 源码已检查；运行见主记录 |
| `GET /api/v1/submissions/{id}/progress` | 登录（服务层） | JfSubmissions.progress本人或submissions:read+地区；专家不能由原稿ID取得原件 | [JfController:168](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfController.java#L168) | 源码已检查；运行见主记录 |
| `POST /api/v1/admin/commands` | 后台+JfAccess.authorizeCommand功能权限 | 按command白名单；全国限制；领域对象地区/状态/版本；幂等重放重新构造workspace并重验内容结果 | [JfController:173](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfController.java#L173) | 源码已检查；运行见主记录 |
| `POST /api/v1/commands` | 登录+领域对象规则 | review.submit共享JfReview.score，本轮补reviews:score；其余owner、公开目标或任务/课程状态；账号动作幂等 | [JfController:223](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfController.java#L223) | 源码已检查；运行见主记录 |
| `GET /api/v1/education/courses` | 公开 | JfEducation.accessible已上架+本人历史版本/班组；成员、身份与承诺单独校验 | [JfEducationController:17](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfEducationController.java#L17) | 源码已检查；运行见主记录 |
| `GET /api/v1/education/courses/{id}` | optional（当前公开版本；历史版本本人/班组） | JfEducation.accessible已上架+本人历史版本/班组；成员、身份与承诺单独校验 | [JfEducationController:18](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfEducationController.java#L18) | 源码已检查；运行见主记录 |
| `GET /api/v1/education/me` | require（本人） | JfEducation.accessible已上架+本人历史版本/班组；成员、身份与承诺单独校验 | [JfEducationController:21](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfEducationController.java#L21) | 源码已检查；运行见主记录 |
| `GET /api/v1/admin/education` | admin + education:read | JfEducation.accessible已上架+本人历史版本/班组；成员、身份与承诺单独校验 | [JfEducationController:22](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfEducationController.java#L22) | 源码已检查；运行见主记录 |
| `GET /api/v1/admin/education/members` | admin + education:read | JfEducation.accessible已上架+本人历史版本/班组；成员、身份与承诺单独校验 | [JfEducationController:26](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfEducationController.java#L26) | 源码已检查；运行见主记录 |
| `POST /api/v1/admin/education/commands` | admin + education:write | JfEducation.accessible已上架+本人历史版本/班组；成员、身份与承诺单独校验 | [JfEducationController:29](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfEducationController.java#L29) | 源码已检查；运行见主记录 |
| `POST /api/v1/education/commands` | require（本人） | JfEducation.accessible已上架+本人历史版本/班组；成员、身份与承诺单独校验 | [JfEducationController:42](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfEducationController.java#L42) | 源码已检查；运行见主记录 |
| `POST /api/v1/engagement/events` | require | 服务端读取公开目标状态；owner与地区取actor/目标；账号目标动作日期唯一去重 | [JfEngagementController:11](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfEngagementController.java#L11) | 源码已检查；运行见主记录 |
| `POST /api/v1/admin/exports` | admin + 对应export权限 + 源数据read权限 | JfJobs.owned要求owner+当前权限+快照地区；卷导出再查当前对象；生成文件拒绝通用下载 | [JfJobController:9](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfJobController.java#L9) | 源码已检查；运行见主记录 |
| `GET /api/v1/admin/exports` | admin（仅owner历史元数据；见剩余项） | JfJobs.owned要求owner+当前权限+快照地区；卷导出再查当前对象；生成文件拒绝通用下载 | [JfJobController:10](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfJobController.java#L10) | 源码已检查；运行见主记录 |
| `POST /api/v1/admin/exports/{id}/{action}` | admin + 对应export权限 + 源数据read权限 | JfJobs.owned要求owner+当前权限+快照地区；卷导出再查当前对象；生成文件拒绝通用下载 | [JfJobController:11](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfJobController.java#L11) | 源码已检查；运行见主记录 |
| `GET /api/v1/admin/exports/{id}/download` | admin + 对应export权限 + 源数据read权限 | JfJobs.owned要求owner+当前权限+快照地区；卷导出再查当前对象；生成文件拒绝通用下载 | [JfJobController:12](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfJobController.java#L12) | 源码已检查；运行见主记录 |
| `GET /api/v1/media/{id}/accessibility` | 公开（已发布当前版本） | JfMediaAccessibility.editable地区；published检查媒体当前发布状态与sourceFileId；录音限本人新上传 | [JfMediaAccessibilityController:11](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfMediaAccessibilityController.java#L11) | 源码已检查；运行见主记录 |
| `GET /api/v1/admin/media/{id}/accessibility` | admin + content:read | JfMediaAccessibility.editable地区；published检查媒体当前发布状态与sourceFileId；录音限本人新上传 | [JfMediaAccessibilityController:12](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfMediaAccessibilityController.java#L12) | 源码已检查；运行见主记录 |
| `POST /api/v1/admin/media/{id}/accessibility` | admin + content:write | JfMediaAccessibility.editable地区；published检查媒体当前发布状态与sourceFileId；录音限本人新上传 | [JfMediaAccessibilityController:13](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfMediaAccessibilityController.java#L13) | 源码已检查；运行见主记录 |
| `GET /api/v1/admin/bootstrap` | admin；按reviews/settings/content:read分别裁剪 | JfQueries.filter先服务端岗位地区/专家owner，再叠加请求地区；统计同filter；详情受同filter | [JfQueryController:11](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfQueryController.java#L11) | 源码已检查；运行见主记录 |
| `GET /api/v1/admin/records/{collection}` | admin + JfQueries.RESOURCES[collection].permission | JfQueries.filter先服务端岗位地区/专家owner，再叠加请求地区；统计同filter；详情受同filter | [JfQueryController:12](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfQueryController.java#L12) | 源码已检查；运行见主记录 |
| `GET /api/v1/admin/records/{collection}/{id}` | admin + JfQueries.RESOURCES[collection].permission | JfQueries.filter先服务端岗位地区/专家owner，再叠加请求地区；统计同filter；详情受同filter | [JfQueryController:18](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfQueryController.java#L18) | 源码已检查；运行见主记录 |
| `GET /api/v1/admin/statistics` | admin + analytics:read | JfQueries.filter先服务端岗位地区/专家owner，再叠加请求地区；统计同filter；详情受同filter | [JfQueryController:21](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfQueryController.java#L21) | 源码已检查；运行见主记录 |
| `GET /api/v1/admin/collection-candidates` | admin + collections:write | JfQueries.filter先服务端岗位地区/专家owner，再叠加请求地区；统计同filter；详情受同filter | [JfQueryController:24](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfQueryController.java#L24) | 源码已检查；运行见主记录 |
| `GET /api/v1/admin/activities/{id}/registrations` | admin + activities:read | JfQueries.filter先服务端岗位地区/专家owner，再叠加请求地区；统计同filter；详情受同filter | [JfQueryController:25](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfQueryController.java#L25) | 源码已检查；运行见主记录 |
| `GET /api/v1/regions/children` | 公开（启用节点/已发布阵地） | JfRegions仅enabled公开地区/已发布阵地；管理按全国/省级范围约束 | [JfRegionsController:11](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfRegionsController.java#L11) | 源码已检查；运行见主记录 |
| `GET /api/v1/regions/venues` | 公开（启用节点/已发布阵地） | JfRegions仅enabled公开地区/已发布阵地；管理按全国/省级范围约束 | [JfRegionsController:12](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfRegionsController.java#L12) | 源码已检查；运行见主记录 |
| `GET /api/v1/regions/venue-map/{id}` | 公开（启用节点/已发布阵地） | JfRegions仅enabled公开地区/已发布阵地；管理按全国/省级范围约束 | [JfRegionsController:13](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfRegionsController.java#L13) | 源码已检查；运行见主记录 |
| `GET /api/v1/regions/venue-coordinates` | 公开（启用节点/已发布阵地） | JfRegions仅enabled公开地区/已发布阵地；管理按全国/省级范围约束 | [JfRegionsController:14](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfRegionsController.java#L14) | 源码已检查；运行见主记录 |
| `GET /api/v1/admin/regions` | admin + regions:read | JfRegions仅enabled公开地区/已发布阵地；管理按全国/省级范围约束 | [JfRegionsController:15](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfRegionsController.java#L15) | 源码已检查；运行见主记录 |
| `POST /api/v1/admin/regions` | admin + regions:write | JfRegions仅enabled公开地区/已发布阵地；管理按全国/省级范围约束 | [JfRegionsController:16](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfRegionsController.java#L16) | 源码已检查；运行见主记录 |
| `GET /api/v1/admin/regions/venues/{id}` | admin + content:write | JfRegions仅enabled公开地区/已发布阵地；管理按全国/省级范围约束 | [JfRegionsController:20](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfRegionsController.java#L20) | 源码已检查；运行见主记录 |
| `POST /api/v1/admin/regions/venues/{id}` | admin + content:write | JfRegions仅enabled公开地区/已发布阵地；管理按全国/省级范围约束 | [JfRegionsController:21](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfRegionsController.java#L21) | 源码已检查；运行见主记录 |
| `GET /api/v1/resources` | optional（公开目录按身份裁剪） | JfResources下载须published+audience/地区+当版许可；新文件本人；生成私有文件不可发布 | [JfResourcesController:9](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfResourcesController.java#L9) | 源码已检查；运行见主记录 |
| `GET /api/v1/admin/resources` | admin + resources:read | JfResources下载须published+audience/地区+当版许可；新文件本人；生成私有文件不可发布 | [JfResourcesController:10](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfResourcesController.java#L10) | 源码已检查；运行见主记录 |
| `POST /api/v1/admin/resources` | admin + resources:write | JfResources下载须published+audience/地区+当版许可；新文件本人；生成私有文件不可发布 | [JfResourcesController:11](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfResourcesController.java#L11) | 源码已检查；运行见主记录 |
| `POST /api/v1/admin/resources/{id}` | admin + resources:write | JfResources下载须published+audience/地区+当版许可；新文件本人；生成私有文件不可发布 | [JfResourcesController:12](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfResourcesController.java#L12) | 源码已检查；运行见主记录 |
| `POST /api/v1/resources/{id}/download` | require（许可确认后授权下载） | JfResources下载须published+audience/地区+当版许可；新文件本人；生成私有文件不可发布 | [JfResourcesController:13](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfResourcesController.java#L13) | 源码已检查；运行见主记录 |
| `GET /api/v1/admin/review-alerts` | admin + reviews:read（本轮补齐） | JfReviewWindows.alerts运营地区或专家owner；提醒不含正文 | [JfReviewAlertsController:17](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfReviewAlertsController.java#L17) | 源码已检查；运行见主记录 |
| `GET /api/v1/admin/review-assignments/candidates` | admin + reviews:manage | JfReviewAssignments预览与确认重新查稿件版本/岗位/地区/专家适用范围/自审冲突 | [JfReviewAssignmentsController:15](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfReviewAssignmentsController.java#L15) | 源码已检查；运行见主记录 |
| `POST /api/v1/admin/review-assignments/preview` | admin + reviews:manage | JfReviewAssignments预览与确认重新查稿件版本/岗位/地区/专家适用范围/自审冲突 | [JfReviewAssignmentsController:17](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfReviewAssignmentsController.java#L17) | 源码已检查；运行见主记录 |
| `POST /api/v1/admin/review-assignments/confirm` | admin + reviews:manage | JfReviewAssignments预览与确认重新查稿件版本/岗位/地区/专家适用范围/自审冲突 | [JfReviewAssignmentsController:20](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfReviewAssignmentsController.java#L20) | 源码已检查；运行见主记录 |
| `GET /api/v1/rights/agreement` | 公开 | JfRights.submit仅稿件owner、当前revision和声明版本；非正式签章 | [JfRightsController:10](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfRightsController.java#L10) | 源码已检查；运行见主记录 |
| `GET /api/v1/me/copyright-confirmations` | require（本人稿件/本人确认记录） | JfRights.submit仅稿件owner、当前revision和声明版本；非正式签章 | [JfRightsController:11](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfRightsController.java#L11) | 源码已检查；运行见主记录 |
| `POST /api/v1/submissions/{id}/copyright-confirmations` | require（本人稿件/本人确认记录） | JfRights.submit仅稿件owner、当前revision和声明版本；非正式签章 | [JfRightsController:12](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfRightsController.java#L12) | 源码已检查；运行见主记录 |
| `GET /api/v1/me/delivery-preferences` | require（本人） | JfSchedules以actor.id读写偏好；拒绝客户端设置owner | [JfScheduleController:9](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfScheduleController.java#L9) | 源码已检查；运行见主记录 |
| `PUT /api/v1/me/delivery-preferences` | require（本人） | JfSchedules以actor.id读写偏好；拒绝客户端设置owner | [JfScheduleController:10](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfScheduleController.java#L10) | 源码已检查；运行见主记录 |
| `GET /api/v1/search` | 公开 | JfSearch仅公开投影+固定kind/地区/查询DSL；返回前检查当前公开状态；不接收ES DSL | [JfSearchController:20](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfSearchController.java#L20) | 源码已检查；运行见主记录 |
| `GET /api/v1/admin/search/status` | admin + operator角色（无单独菜单权限） | JfSearch仅公开投影+固定kind/地区/查询DSL；返回前检查当前公开状态；不接收ES DSL | [JfSearchController:41](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfSearchController.java#L41) | 源码已检查；运行见主记录 |
| `POST /api/v1/admin/search/rebuild` | admin + national_admin角色（无单独菜单权限） | JfSearch仅公开投影+固定kind/地区/查询DSL；返回前检查当前公开状态；不接收ES DSL | [JfSearchController:47](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfSearchController.java#L47) | 源码已检查；运行见主记录 |
| `POST /api/v1/admin/submission-imports/preview` | admin + submissions:write | JfSubmissionImports每行重查owner有效性与地区；来源唯一；confirm指纹重验；作者同意不能代填 | [JfSubmissionImportsController:13](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfSubmissionImportsController.java#L13) | 源码已检查；运行见主记录 |
| `POST /api/v1/admin/submission-imports/confirm` | admin + submissions:write | JfSubmissionImports每行重查owner有效性与地区；来源唯一；confirm指纹重验；作者同意不能代填 | [JfSubmissionImportsController:16](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfSubmissionImportsController.java#L16) | 源码已检查；运行见主记录 |

共 88 个 HTTP 方法/路径（数组映射按两个入口分别列出）。

## 上游保留入口与跨入口边界

这些方法全部位于类级 `@SaIgnore` 的 `ruoyi-admin/.../AuthController.java`；不可把通用 token 路径限制当成它们的保护。独立部署入口现默认拒绝未使用的上游前缀，内网各方法实际检查见下表。

| 上游方法 | 实际调用链与保护 | 本轮状态 |
| --- | --- | --- |
| POST /auth/login | 公开；若依client状态、grant类型、IAuthStrategy密码等认证；无家风session标记 | 源码核对；家风业务不接受此token |
| GET /auth/binding/{source} | 公开；仅配置社会平台对象，再生成授权URL | 源码核对；不调用外部社会平台 |
| POST /auth/social/callback | StpUtil.checkLogin；配置source；SocialUtils外部认证后socialRegister | 源码核对；本轮不启用/不调用外部平台 |
| DELETE /auth/unlock/{socialId} | StpUtil.checkLogin；SysSocialServiceImpl单SQL id+当前user_id删除 | 本轮修复原先仅id删除的水平越权；隔离内网实测见主记录 |
| POST /auth/logout | SysLoginService.logout；Sa-Token当前会话清除 | 源码核对；外部独立入口关闭 |
| POST /auth/register | 公开；selectRegisterEnabled；SysRegisterService校验注册 | 源码核对；外部独立入口关闭 |

- 业务 `JfAuth.optional` 要求当前 tokenSession 的 `jiafeng` 标记，若依登录token不能直接成为家风身份；家风 token 的 `clientAccessPath=/api/v1/**` 限制通用受保护路由。上游 `@SaIgnore` 方法的自身检查与外部入口限制分别列证据。
- Compose关闭社会登录/上游客户端启用状态是否符合独立部署策略，应由隔离HTTP与具体配置核实；本轮不改既有AI/OCR配置。
- `JfAuth.byId/JfAccess.populate` 每请求实时读取账号停用与若依岗位菜单；账号管理状态、密码、岗位/地区写入增加 `authEpoch`，旧业务会话下次请求被拒绝。8小时超时与显式退出复用Sa-Token/Redis；高权限账号二次验证、正式初始化/恢复流程仍为独立上线决策。

## 本轮确认并修复的业务授权缺口

`POST /api/v1/admin/commands` 对 `submitReview` 校验 `reviews:score`；`POST /api/v1/commands` 的 `review.submit` 经 `JfMember.command` 直达 `JfReview.score`，此前只检查专家角色、owner、任务窗口与稿件版本。撤销菜单评分权限而保留专家角色的账号可绕过功能授权。现将 `reviews:score` 检查放到共享评分方法，两个入口保持相同策略；新增 `JfReviewAuthorizationTest` 包含合法评分、撤权拒绝、其他专家任务拒绝与失效修订拒绝。真实测试命令和结果以主记录为准。

`JfReviewWindows.alerts` 原先仅 `auth.admin`，内容运营可读同地区评审任务标题、专家、日期等元数据；现共享提醒列表入口补 `reviews:read`，合法评审/专家保留原有地区/owner规则。`JfReviewWindowsTest` 增加缺权操作在查询前拒绝，隔离HTTP用独立内容岗位账号复核。

多岗位反例在独立环境使用明确标记的他人盲审任务读取样本：单专家详情为404，临时添加无评审读取权限的内容运营岗位后，详情变200并返回盲审正文，分页和旧工作区也出现他人任务。临时绑定及样本在 `finally` 清理，修复前证据保存在隔离本机 `multi-role-before.json`。现以 `JfAccess.reviewOperator` 复用现有全国、区域综合运营、评审管理岗位与 `reviews:read` 共同判定地区任务读取；专家与无关内容岗位组合保持本人任务范围。管理岗位撤销写权限但保留读权限仍可地区只读，没有新增角色或菜单权限。共享规则同时用于分页/详情、旧工作区与提醒列表，`security_multi_role_probe.py` 可复跑修复后反例。

## 所有签名下载调用方

| 调用方 | 签发前检查 | 现存签名链接边界 |
| --- | --- | --- |
| `JfController.publicAsset` | `JfCatalog.publicAssetAllowed` 当前发布引用/轮播窗口 | 最多余300秒 |
| `JfFiles.download` | owner 或业务关联读取岗位+地区；generated一律拒绝通用方法 | 最多余300秒 |
| `JfResources.download` | 登录、发布状态、audience/地区、当版许可确认 | 下架/撤权停止新签发，旧链接最多余300秒 |
| `JfCertificates.download` | 本人或证书读取+地区、issued | 撤销停止新签发，旧链接最多余300秒 |
| `JfJobs.download` | 当前owner/导出+读权限、快照范围、卷当前授权、完成状态、临时导出期限 | 撤权停止新签发，旧链接最多余300秒 |
| `JfMediaAccessibility.published` | 媒体当前发布、字幕来源版本相同、受管朗读文件引用 | 下架停止新签发，旧链接最多余300秒 |

签名由同一 `JfDownloadLinks.url` 生成，使用私有对象存储。300秒链接是持有即访问的凭据；不宣称业务撤销能让既有S3签名立即失效。稿件/文件Hash以同库元数据为可信基准，用于传输/引用一致性；不抗有权同时修改数据库与文件的管理员，不是正式签章。

## 本轮运行证据范围

- 最终 Java 源码通过 `Dockerfile.server --target verify`：179项、0失败、0错误。包含评分功能拒绝/合法评分、社交解绑单SQL归属、提醒缺权拒绝、多岗位任务范围和管理只读反例，以及既有业务测试。它们不是179项真实HTTP验收。
- `security_auth_probe.py` 在独立项目 `jiafeng-demo-security-20261015` 的177测试对应版本实测16项：两评分入口撤权拒绝/恢复后合法成功、原稿/两个原文件URL拒绝、内网社交解绑他人拒绝/本人成功、两类token不能跨身份面、Cookie单独认证拒绝、地区改授权双端旧会话失效、账号停用再启用不复活旧会话、改密及退出。随后多岗位修复单独构建179测试版本。
- `security_multi_role_probe.py` 在最终179测试对应版本实测2项组合断言：专家加无关内容岗位后详情/分页/旧工作区/提醒均保持本人任务范围；评审管理岗位撤写留读后地区读取仍成功，其他地区筛选只收窄。修复前与修复后证据分别保存为隔离本机 `multi-role-before.json`、`multi-role-after.json`，所有临时岗位/菜单绑定与任务样本清理完成。
- 正常锁定运行镜像构建在普通网络与host网络均被Alpine仓库DNS阻断。隔离运行验证使用现有本地 `dualstack-20261015` 镜像基底，覆盖正常Maven构建的当前jar与许可证；未将此步骤称为干净运行镜像构建成功。

## 源码范围内的剩余项（不直接认定漏洞）

- 事务行锁与版本更新、幂等账号动作隔离已见实现；真实并发与服务故障的已执行范围见主记录；锁等待中撤权和全部并发组合仍未测，不能由Mock推断。
- `JfJobs.listJobs` 为本人历史任务列表，只按owner，下载/执行另查当前功能与地区；撤权后历史筛选条件/文件名是否仍应展示需明确保留规则，并验证列表与下载的授权一致性。
- 普通数据库审计覆盖多项成功写入与业务下载，不等于不可篡改；本轮已补/api/v1请求关联与失败/拒绝日志；关键差异、长期留存和异步关联仍需补齐。
- `JfSearchController` 搜索状态为运营角色、重建为全国角色，无独立菜单权限；当前是否需要单独配置搜索管理功能权限应明确后再扩展。
- 授权撤销之前已在执行的请求、历史已分配专家任务的保留期，以及高权限二次验证不从框架配置推断已验证。
