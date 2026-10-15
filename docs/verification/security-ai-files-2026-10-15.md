# 独立部署安全检查：AI、OCR 与文件处理

日期：2026-10-15。本附表属于本轮独立部署安全检查；源码检查、离线受控测试和隔离部署接口验证分别标记。本轮没有调用真实模型，也没有改现用 AI/OCR 配置或操作展示环境的数据卷。

## 调用链与入口

| 入口 | 身份与功能权限 | 对象、范围与状态 | 返回字段与副作用 |
| --- | --- | --- | --- |
| `GET /api/v1/ai/status` | 公开；只返回挑选过的配置状态 | 不接受模型地址或密钥参数 | 仅 enabled/provider/model/ocrEnabled/external、公开知识数；进程存活、配置存在和实际模型可用仍是三种状态 |
| `POST /api/v1/ai/tasks` | `JfAiController.create → JfAuth.require`；稿件辅助再要求 `submissions:write/read` | `JfAi.normalize/create/submission` 使用当前账号、服务端稿件正文和版本；OCR 文件须本人持有；不接受客户端 owner、权限或成功状态 | `JfStore.idempotent` 按账号、动作、键隔离并锁账号；写入 durable task，未直接改变投稿、评分、发布或权限 |
| `GET /api/v1/ai/tasks[/{id}]` | 登录 | 私人任务仅本人；管理任务要求运营岗位、对应功能权限和当前地区；来源版本与发布/撤回状态重新检查 | `dto` 才挑选返回字段；旧来源失效时隐藏答案/引文；本人任务列表不通过公开缓存 |
| `GET /api/v1/admin/ai/tasks` | 后台身份、`ai:read`、运营岗位 | 当前地区；全国岗位可查全局运行元数据 | 他人私人任务只显示去敏运行字段，无输入、文件 ID 或结果 |
| `POST /api/v1/admin/ai/knowledge/{id}/index` | 后台身份、`ai:write`、运营岗位 | 资料地区、版本、绑定文件；公开/内部必须显式选择；提交与完成前再次核对 | 解析分块与资料版本在事务中保存，不凭上传直接宣布可检索 |
| `POST /api/v1/admin/ai/knowledge/{id}/withdraw` | 后台身份、`ai:write` | 地区、当前版本、资料行锁 | 同事务撤回资料、删除分块、失败化在途索引；历史问答与存档读取继续核对来源 |
| 内部 `/v1/status/generate/extract` | Python `authenticate` 的独立随机服务密钥；Compose 内网入口 | Pydantic 字段/长度约束；2 个执行槽；只使用服务端配置 URL，文件以私有存储字节传入 | 不执行工具；固定错误消息；无访问日志；供应商错误正文不回传 |
| `POST /api/v1/files` 的媒体/稿件用途 | `JfFiles.upload → JfAuth.require`；诵读限定会员 | 用途、扩展名、大小、文件头；对象键由服务端生成；诵读/视频实际解码转码 | 私有 S3；慢处理后复核账号；元数据事务失败删除已上传对象；临时文件 finally 清理 |

代码入口：[JfAiController](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfAiController.java)、[JfAi](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfAi.java)、[JfAiKnowledge](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfAiKnowledge.java)、[JfAiClient](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfAiClient.java)、[JfFiles](../../apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/JfFiles.java)。通用文件授权的其他签发调用方见本轮总检查表。

## 检查表

| 检查项 | 现有实现及代码位置 | 本轮验证结果 | 缺口与影响 | 优先级 | 处理方式 |
| --- | --- | --- | --- | --- | --- |
| 内部鉴权、状态字段去敏 | `service.py:authenticate`、`JfAiClient.status/call` | Python 真 HTTP：错误密钥 401；状态无 key；验证错误不回显私人正文 | 全部 Java 路由权限的运行证据另列，不由框架存在推定 | P1 | 复用现有机制，补反例 |
| 私人任务、内部知识与来源撤权 | `JfAi.readable/dto/archiveView/complete`、`JfAiKnowledge.retrieve/valid` | 本轮隔离 HTTP：本人可读，另一会员/全国管理员/专家详情均 404，其他会员列表不含该任务，后台只见去敏元数据；知识撤权链路本轮为源码逐入口核对 | 真实模型的回答正确率及提示注入对抗效果未测试；不将系统提示当作完整防护，未重跑旧的真实模型撤回探针 | P1 | 保留二次授权与版本复核；不新增身份系统 |
| 模型畸形 JSON | `service.py:response_text` | 原 HEAD 的 `choices:[null]` 实际抛 `AttributeError`；修改后 null/string 与其他错误形状统一失败；28 项测试通过 | 已证实错误未归一化，原来会成为适配器 500；未发现因此泄露私人数据或执行代码 | P1（健壮性） | 最小补捕获 `AttributeError`，不改变配置或正常答案 |
| URL/凭据转发/SSRF 边界 | `service.py:provider_call/NoRedirect`；`JfFiles.aiFile` | 本地真实 HTTP 桩：合法调用成功、307 不跟随、不转凭据、外部 HTTP 在连接前被拒绝；401/403/429/500 消息去敏 | 本地模型允许私网 HTTP，是部署配置权限；管理员配置 URL 不等于用户可传 URL。未做完整网络沙箱验证 | P1 | 保留配置 URL 与文件 ID 边界，不增外部服务 |
| 文档上传与解析失败 | `JfFiles.upload/aiFile`、`service.py:decode_file/local_extract/ocr`、`parse_document.py` | 实际子进程：正常 UTF-8/DOCX 成功；31 页、加密/损坏 PDF、伪装图片、超大文件、损坏/解压正文超过 8MiB 的 DOCX、XML 外部实体、旧 DOC 均按预期失败 | 文件头仅证明初步格式；不等于完整格式验证、查毒或沙箱。允许旧 DOC 作为投稿原件，AI 解析明确要求转 DOCX | P1 | 复用现有大小/解析限制与固定错误；补受控样本 |
| 文件 Hash 的可信基准 | `JfFiles.aiFile` 从 S3 读取后比较大小和 SHA-256，基准保存在 `jf_file` | 源码核对 | 能发现相对数据库元数据的损坏/对象替换；同时可修改数据库和存储的管理员能替换两者，不提供正式签章或抗管理员篡改保证 | P1 | 保留完整性校验，明确保障边界 |
| 解析资源与密钥隔离 | `local_extract` 的 env 白名单/18 秒；子进程 `RLIMIT_AS=512MiB`、CPU=12 秒；PDF30 页/正文上限 | 配置源码核对；异常文档在受限子进程中运行。离线测试容器禁止外网、只读、非 root | 本轮没有逼近每一个 CPU/内存上限，也没有证明子进程具备独立网络命名空间。生产解析仍与 AI 容器共享 UID/网络 | P1/P2 | 如实记录；完整解析沙箱属更高风险增强，不宣称已实现 |
| FFmpeg 媒体 | `JfAudio/JfVideo`：参数数组、`file,pipe` 协议白名单、格式白名单、线程/分配/尺寸/时长/输出上限、超时、信号量、finally 清理 | 隔离真实上传：0.2 秒合成 WAV 转 MP3 成功，其他会员/专家下载 404；损坏 WAV、损坏 MP4、伪装成 MP3 的播放列表均 422；之后合成 0.4 秒 MP4 仍正常转码成功 | 受限子进程仍继承 Java 进程环境与 UID；无完整进程沙箱。媒体普通上传中的 MP3/WAV只检查文件头，私人诵读和视频路径才强制转码 | P1/P2 | 保留现有受限转码；不将所有附件宣称为已解码 |
| 并发、额度与失败回收 | `JfAi.enqueue/dispatch/complete/fail`、`JfStore.idempotent`、Python `bounded` | 真并发 HTTP：2 请求占槽，第三请求 503；前两请求失败后新合法请求 200。隔离 Java/MySQL：同时同键创建两请求获得同一任务 ID，改内容重放 409；关闭模型的任务持久失败且无结果 | Java 单账号计数由现有账号行锁串行；全局50个计数跨账号的极限争用及4分钟/20分钟租约尚未本轮重验；单机限制不是抗 DDoS | P1 | 不将未重现关注点写成漏洞；保留显式失败且不自动重复收费调用 |
| 供应商输出与请求/响应大小 | `limit_body` 15MiB；`provider_call` 4MiB；`response_text`/Java输出白名单；`safeUsage` | 真 HTTP 的普通与 chunked 超大请求均 413；桩 4MiB+1 响应拒绝；无效 JSON、空结果与截断拒绝；固定错误不回显桩秘密/正文 | 模型可能在正常结果中表达错误事实；审核建议不能代替人工决策 | P1 | 使用本地桩，不调用外部模型 |
| AI 私密内容与审计 | `JfAi.log`、`service.py`、`JfAiClient.call` | 日志源码核对；错误去敏真 HTTP 已验证 | `jf_ai_task` 按功能保存私人请求/结果；备份也包含，留存/删除/未成年人规则尚待运营确定。普通数据库审计可被有库权限者改动 | P1/运营 | 不编造留存期限或不可否认保证；完整留存清理另列 |
| AI/OCR 展示与取消 | 后台 `AiTaskResult.vue`、用户端 `AiCitations.vue`、`aiTasks.ts:citationTarget` 和 `services/ai.ts` | 源码核对：结果/引文走 Vue 转义文本；原文跳转只解析约定内部 screen/id；无 HTML 渲染或模型工具调用 | 未专门新增浏览器攻击载荷回归；停止轮询/关闭页面不取消已经受理的服务端任务，后台已有这一提示 | P1/产品 | 保留纯文本展示和人工采用动作；不宣称模型输出能够自动提交/审批/发布 |

## 本轮实际执行

1. 在原 HEAD 的 Python 源码上，隔离容器调用 `response_text({"choices":[None]})`，实际异常类型为 `AttributeError`。工作区仅补充这一异常类型的失败映射。
2. 构建独立 `jiafeng-ai:security-20261015`，没有覆盖 `jiafeng-ai:local`。构建成功不等于模型实际可用。
3. 使用新镜像、只挂载测试文件，以 `--network none --read-only --cap-drop ALL --security-opt no-new-privileges:true --memory 768m --pids-limit 128` 执行 `python -m unittest -v test_service`。网络命名空间内仅 loopback HTTP 桩可用，没有外部模型请求。**28 项通过，9.950 秒**，原始输出：[ai-unit.log](previews/security-2026-10-15/ai-unit.log)。
4. 在新隔离项目 `jiafeng-demo-security-20261015` 的 AI 容器内，经 loopback HTTP 实测：health 200；错误服务密钥对 status/generate/extract 均 401；正确密钥 status 显示 disabled 且无 key 字段；正确生成请求 503 `AI_NOT_CONFIGURED`；合法 DOCX 本地解析 200。**7 项通过**，去敏结果：[ai-internal-boundary.json](previews/security-2026-10-15/ai-internal-boundary.json)。该容器仍为初始依赖镜像，畸形 JSON 的修复由上一项独立新镜像测试验证。
5. 在独立项目 `jiafeng-demo-security-20261015`、HTTP `127.0.0.1:19185`、独立 MySQL/Redis/S3 卷执行下列命令，**9 组通过**。结果：[ai-api.json](previews/security-2026-10-15/ai-api.json)。包括合法处理与异常拒绝、真实并发幂等、账号/专家/管理员边界和持久失败，不调用真实模型。第一次执行在前 8 组通过后，因辅助脚本把 Nginx 限流的 HTML 429 当作 JSON 解析而终止；补齐非 JSON 错误处理和仅对 429 的有界等待后，最终完整执行通过。该失败属于测试辅助代码，不是服务端接受了异常文件。

```sh
JIAFENG_TEST_URL=http://127.0.0.1:19185 \
JIAFENG_ENV_FILE=deploy/.local/security-2026-10-15/audit.env \
JIAFENG_SECURITY_AI_REPORT=docs/verification/previews/security-2026-10-15/ai-api.json \
python3 deploy/tests/ai_security_probe.py
```

探针在请求前复用 `probe_scope.py` 校验隔离环境、容器与卷标签，并额外限定 `jiafeng-demo-security-*`、loopback 与配置端口一致，拒绝现用 `deploy/.env` 和已启用模型。它只创建虚构任务与合成小文件，不改账号、停止服务、删除记录或重置环境。

测试源：[test_service.py](../../apps/ai/test_service.py)、[ai_security_probe.py](../../deploy/tests/ai_security_probe.py)。合法文本/DOCX、合法本地 HTTP 模型桩与失败后的恢复请求均实际成功；异常样本均为小规模受控或合成数据。没有外发真实家庭、稿件或模型数据。

## 依赖公告与实际使用路径

2026-10-15 查询上游官方公告与发布页，未升级框架。这里是所列公告与当前调用路径的核对，不是“依赖树无漏洞”结论，也没有订阅外部安全平台。

| 依赖/锁定版本 | 实际路径 | 官方依据及本轮结论 |
| --- | --- | --- |
| pypdf `6.20.1` | `parse_document.py` 的 `PdfReader → pages/get_contents/extract_text`，只有受限子进程；不写表单，不访问附件或书签 | [6.20.1 发布页](https://github.com/py-pdf/pypdf/releases/tag/6.20.1)包含循环树处理修复；[官方 GHSA-fc8x-2rww-xw9m](https://github.com/py-pdf/pypdf/security/advisories/GHSA-fc8x-2rww-xw9m)影响 `<6.15.0`；[GHSA-php9-fj8v-98fj](https://github.com/py-pdf/pypdf/security/advisories/GHSA-php9-fj8v-98fj)影响 `<6.19.0` 的表单外观生成。当前锁定版本不在这两个范围；仍保留资源限额 |
| FastAPI `0.143.0` | 内网 JSON 接口、Header 服务密钥，无 Cookie 登录和可执行工具 | [官方 GHSA-8h2j-cgx8-6xv7](https://github.com/fastapi/fastapi/security/advisories/GHSA-8h2j-cgx8-6xv7)影响 `<0.65.2` 的 JSON/Cookie 认证场景；当前版本/身份路径不符合该范围 |
| Starlette `1.7.0` | FastAPI ASGI/JSON/middleware；本项目适配器无 `request.form()`、StaticFiles、FileResponse | [官方 GHSA-82w8-qh3p-5jfq](https://github.com/Kludex/starlette/security/advisories/GHSA-82w8-qh3p-5jfq)影响 `>=0.4.1,<1.3.1` 的 urlencoded `request.form()`；当前版本与调用路径不符合此项条件。其他公告仍须按实际入口持续维护 |
| FFmpeg/系统包 | 运行镜像发行版包；Java严格限定格式/协议并转码 | 本轮查验路径与受控样本，不将系统包版本号或构建成功视作全部编解码器 CVE 审计；系统镜像补丁与框架升级应单列执行 |

锁定文件：[requirements.lock](../../apps/ai/requirements.lock)、[AI Dockerfile](../../deploy/Dockerfile.ai)、[许可证清单](../../licenses/ai/inventory.json)。没有新增依赖、修改许可证来源或替换锁定摘要。

## 待部署及运营决定

- 模型 URL 与密钥由部署者配置；外部模型必须 HTTPS，本轮保留现用配置不变。正式私有模型兼容性、OCR/事实准确率及提示注入效果集未执行。
- 正式私密数据保留/删除、备份中的删除延迟、未成年人规则和外部模型告知需要运营明确。不能把当前长期保存在任务表中的内容说成已有自动到期清理。
- 子进程限制、非 root/只读容器和格式白名单减少资源消耗面；没有提供查毒或完整解析沙箱。本轮没有新增独立安全服务、中间件或通用 WAF。
