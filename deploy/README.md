# 家风中华行 · 本机容器部署

需要 Docker Engine、Docker Compose 和 Python 3。首次启动会下载固定摘要的
Java 21、Maven、Node、MySQL、Redis、SeaweedFS、Elasticsearch 和 Nginx 镜像并构建两端。
服务器镜像安装固定版本 FFmpeg/ffprobe，用于将私人诵读录音转换为 MP3。

```bash
./deploy/dev up
./deploy/dev status
./deploy/dev logs server
```

- 用户端：`http://127.0.0.1:18080/`
- 后台：`http://127.0.0.1:18080/admin/`
- S3 签名下载：`http://127.0.0.1:18333/`（私有桶，匿名访问返回 403）
- 开发账号密码：本机 `deploy/.env` 中的 `JIAFENG_DEV_PASSWORD`。

| 账号 | 身份与范围 |
| --- | --- |
| `devadmin` | 全国管理 |
| `region_zj` / `region_bj` | 浙江 / 北京区域运营 |
| `expert_zj` | 浙江评审专家，仅已分配任务 |
| `member_zj` / `member_bj` | 浙江 / 北京投稿用户，仅本人记录 |

`deploy/.env` 首次自动生成随机口令，文件权限为 0600。它与 S3 凭据配置、备份
均已加入 Git 忽略；不要将这些文件放入公共仓库。原若依示例账号全部禁用。
Jiafeng 开发账号由业务迁移初始化；`JIAFENG_DEV_ACCOUNTS_ENABLED=false`
关闭开发账号初始化/登录开关。

基础表只在 MySQL 空卷首次启动时导入，业务结构由版本化迁移升级。
重复 `up` 保留卷和数据。`./deploy/dev down` 停止并移除本项目容器及网络，
**不删除数据卷**。不要手工使用 `docker compose down -v`。

## 私人记录与公开搜索

诵读打卡和家庭约定保存到本人账号；音频保存在私有 S3。家庭约定可跨浏览器修改，
人物下架后仍可在个人中心找到。录音默认本人可听，主动投稿后才进入后台媒体审核。
后台工作台仅展示授权地区的记录数量，不返回私人正文、录音或标题。
旧设备数据不会自动导入当前账号；丢失原文件的本机录音需重新选取。

Elasticsearch 9.5.4 默认随 `up` 启动，使用私有网络、随机密码、独立数据卷，
不向宿主机发布 9200/9300 端口。单节点初始上限 2GiB、JVM 堆 1GiB；整个环境需
预留现有 Java/MySQL 等服务之外的资源。首次 `init/up` 会给旧配置追加搜索密码，
不会替换已有数据库、S3 或用户密码。当前配置用于本机联调，不包含全国容量承诺。

`up` 先确认业务服务健康，再等待公开搜索初始化完成。搜索服务临时不可用时，
业务保存继续写入 MySQL 和待同步事件；搜索页面明确提示更新或不可用，恢复后自动补齐。
后台「系统设置 → 搜索服务」可查看状态，只有全国管理员可重建索引。
索引只包含九类公开内容的实际发布语言版本；下架同步未完成时暂不返回旧结果或旧计数。
搜索不直接暴露 Elasticsearch，也不依赖浏览器预先加载完整目录。

浏览器麦克风要求浏览器认可的安全环境（本机 localhost 可用；普通局域网 HTTP
通常不可用），拒绝权限时仍可选取文件上传。支持 MP3/WAV/M4A/AAC/OGG/WebM，
上限 10MiB、180秒；服务端实际解码、转换成功后才返回有效文件编号。
这项音频处理不代表视频直播、自动字幕或微信真机验收完成。

## 显式导入演示数据

`main` 提供功能与部署，当前文件树不包含可导入的 JSON/PDF 数据包、三个专用种子脚本及依赖它们的演示探针。空卷 `up` 只初始化开发账号和基础配置；已有业务数据原样保留。`seed-demo`、`seed-demo-records`、`seed-catalog` 及非 `--empty` 的 `reset-demo` 在缺包时提前拒绝，不会自动下载数据，也不会先清理再报错。

完整数据包保留在 [codex/demo-data-bootstrap](https://github.com/cont1nu1ty/guofeng-platform/tree/codex/demo-data-bootstrap)。需要演示时，在独立工作目录检出该分支：

```bash
git clone --branch codex/demo-data-bootstrap --single-branch https://github.com/cont1nu1ty/guofeng-platform.git
cd guofeng-platform
./deploy/dev up
./deploy/dev seed-demo
```

下列导入、增量与重建说明均适用于演示数据分支。使用已有检出目录时，先确认该目录已切换到演示分支，再执行最后两条命令；不要用另一个检出目录同时管理正在运行的同一 Compose 项目。`up` 等待服务健康并完成基础数据库初始化，默认只有开发账号及基础配置，不导入演示业务。`seed-demo` 是单独的显式操作；不在应用启动或重启时自动执行，也没有常驻导入容器。它复用宿主机Python 3、Docker Compose和运行中的后端。

完整 JSON/PDF 数据包及专用种子脚本仅在演示分支提供；原有前端 Mock 的静态音视频仍在主分支保留，见[数据包边界](fixtures/README.md)。导入会新建业务ID、使用本机随机开发密码，并将附件通过真实接口上传到当前S3，关联稿件和媒体。它重建仓库定义的虚构场景，不复制其他电脑的运行数据库、会话或临时下载链接。

初始场景包括13个账号、16篇稿件及17份修订、51条历史/当前评审任务、2份云草稿、资讯与典籍、6种活动情形、课程进度与公益申领，以及10条轮播、7条媒体、4处阵地、3份人物档案和2条人工咨询。公开端按发布状态、地区、语言和时间窗口过滤，并非所有记录都公开显示。详细操作见[演示路线](../docs/frontend/showcase-data.md)与[目录管理](../docs/frontend/catalog-management.md)。

导入完成后直接打开首页和后台，密码仍在本机 `deploy/.env` 的 `JIAFENG_DEV_PASSWORD`。后续启动只需 `./deploy/dev up`，数据库和文件都会保留。

### 重复执行、失败与已有数据

- 同一数据版本完整导入后，重复 `seed-demo` 返回已完成并跳过，保留之后修改过的内容。完成标记保存在数据库中；保留该环境的部署配置和数据卷时，更换检出目录或丢失本地清单不会导致重新导入。
- 没有可信导入标记的非空业务数据库，或已经修改过基础账号的环境，会被拒绝，不会自动合并或覆盖。当前已经在使用的旧演示环境无需再次导入。
- 基础稿件/评审阶段中断时，命令停止并保留现场；需要重新开始时显式执行 `./deploy/dev reset-demo`，先备份再清理重建。不会因重试而自动删除数据。
- 基础阶段完成后，目录阶段使用数据库中的检查点恢复；再次执行 `seed-demo` 即可继续，完成记录和已有编辑会被跳过。
- 仓库中的数据版本发生改变时，不自动重放到旧库。需要全新场景时使用独立环境，或明确执行会备份并清理的 `reset-demo`。

导入仅允许启用开发账号的 `jiafeng-dev` 或 `jiafeng-demo-*` 项目，并核对容器和数据卷归属。要使用其他本机演示环境，将 `JIAFENG_ENV_FILE` 指向该环境配置，再使用相同命令；端口和项目名应与既有环境分开。

## 追加个人记录演示

在演示数据分支，完整 `seed-demo` 包含独立的个人记录阶段。已在使用的旧演示环境可只执行：

```bash
./deploy/dev seed-demo-records
```

它要求现有两个开发会员账号及至少一份已发布中文人物档案，通过真实API追加
私人打卡、待审/退回/已发布的音频投稿、两人的家庭约定、人物下架后的历史约定，
以及四份中英文故事音频。内容与声音均为明确标注的原创虚构/合成演示素材。
独立数据库标记记录完成状态，重复执行保留用户之后的编辑和删除；不会改写旧阶段的
数据指纹，不清空数据、不调整账号。此命令和 `seed-demo` 都不会在默认启动时执行。

## 局域网访问

先修改 `deploy/.env`，例如电脑可达地址为 `192.168.1.20`：

```dotenv
JIAFENG_BIND_ADDRESS=0.0.0.0
JIAFENG_S3_PUBLIC_ENDPOINT=http://192.168.1.20:18333
```

再次运行 `./deploy/dev up`。两端共用 `18080` 入口；下载链接使用 `18333`。
电脑防火墙和校园网的设备隔离仍会影响访问。本脚本不修改防火墙。
MySQL、Redis、SeaweedFS 管理端口不发布到宿主机。正式公网需另配 HTTPS，
关闭开发登录并配置真实身份提供方，不应直接使用本机测试配置。

### 同时保留 IPv4 与 IPv6

已有 IPv4 环境可以在同一份本机环境文件追加：

```dotenv
JIAFENG_BIND_ADDRESS=0.0.0.0
JIAFENG_IPV6_ENABLED=true
JIAFENG_IPV6_BIND_ADDRESS=::
JIAFENG_S3_PUBLIC_ENDPOINT=http://192.168.1.20:18333
JIAFENG_S3_PUBLIC_IPV6_ENDPOINT=http://[你的全局IPv6地址]:18333
```

替换为实际地址和附件端口，再使用原 `JIAFENG_ENV_FILE` 执行 `./deploy/dev up`。
生命周期工具自动合并 `compose.ipv6.yaml`，保留原 IPv4 映射，仅给网页和 S3 增加
IPv6 端口；默认仍关闭 IPv6，启用后未指定绑定地址时只监听 `::1`。
直接调用 Docker Compose 时也需显式包含这两个配置文件。

IPv6 页面 URL 使用 `http://[地址]:网页端口/`，后台加 `admin/`。浏览器以 IPv6
地址请求时，文件签名使用配置的 IPv6 S3 地址；IPv4和域名请求仍使用原地址。
请求 Host 只选择固定配置，不成为签名目标；Forwarded/X-Forwarded-Host 不参与选择。
两类下载保留同样的权限和五分钟有效期。修改绑定端口时也要同步两种 S3 公开地址。

使用 firewalld 的机器需允许网页和 S3 对应的 IPv6 TCP 入站端口；仅修改本机实际使用的
区域和端口，不关闭防火墙。Docker 默认 userland proxy 可将宿主 IPv6 发布端口转到
容器 IPv4，无需给数据库或 Docker 内部网络新增外部入口。
完整验证同时包括两个地址族的页面、登录、公开媒体和私有附件实际下载，
本机访问不能代替另一台校园设备或校外网络的入站验证。

关闭 `JIAFENG_IPV6_ENABLED` 后再次 `up` 可取消 IPv6 发布，原 IPv4与数据保留；
不再使用时单独移除本次添加的防火墙规则。隔离恢复会关闭继承的外部 IPv6，避免与原环境争用端口。
本机实际执行见 [2026-10-15 双栈验证](../docs/verification/ipv6-access-2026-10-15.md)。

## 备份与隔离恢复

```bash
./deploy/dev backup
./deploy/dev restore deploy/backups/生成的目录
```

备份先停止应用写入，导出 MySQL，再停止存储以一致地复制整个 SeaweedFS 数据卷。
最后恢复原先运行的服务。备份包含数据库、文件与元数据、本地凭据、镜像来源和
SHA-256 清单；按含敏感业务数据的文件妥善保存。

搜索索引不作为原始数据备份。恢复环境使用新的搜索卷，从恢复后的 MySQL 全量重建；
即使数据库包含旧索引完成版本，也必须校验索引身份与内容版本，不能直接视作搜索就绪。

恢复先校验清单，再创建唯一的 `jiafeng-restore-*` Compose 项目和新卷，不覆盖
原环境。默认恢复入口 `18081`，S3 `18334`；可使用
`JIAFENG_RESTORE_HTTP_PORT` / `JIAFENG_RESTORE_S3_PORT` 调整。完成后命令输出
恢复环境的 `JIAFENG_ENV_FILE=...` 管理方式。Redis 会话不迁移，恢复后重新登录。

## 清理并重建展示数据

以下带数据重建只适用于演示数据分支；`main` 缺少数据包时会在清理前拒绝。

```bash
./deploy/dev reset-demo
```

该命令先生成并校验完整备份，再清空本项目当前业务数据、稿件版本与附件、
评审流程及任务、会话、家风账号和关联记录；保留数据库迁移、上游菜单字典、
本地配置及原开发密码。随后恢复六个初始开发账号，并调用
统一演示导入流程重新生成可供网页用户端和后台共同操作的模拟业务数据。
这是真实数据库中的展示样例，不是前端内存 Mock；重建后原网页会话需要重新登录。

需要只恢复空白底座时使用 `./deploy/dev reset-demo --empty`，它不会生成展示样例。
`main` 也支持 `--empty`，但它会真实清空当前开发业务，须按自身需要明确执行；普通启动不需要重置。随后需要样例时，在演示分支按导入说明操作。重置期间请暂停操作两端。
重复执行会先保存一份新的完整备份，再重建数据，不会叠加旧的投稿或文件。

为避免清理其他环境，命令只接受启用了开发账号的 `jiafeng-dev` 或
`jiafeng-demo-*` Compose 项目，并核对数据库、Redis、S3 容器与数据卷的项目标签。
它不删除任何数据卷、旧备份或其他项目容器，也不会重新生成密码或构建镜像。
整个备份到清理期间应用停止写入；备份或校验失败即停止，不进入数据清理。
如果清理或样例生成中途失败，命令保留并输出备份位置；可按上一节恢复到独立环境。
最后一次执行摘要记录在 Git 忽略的 `deploy/.local/reset-demo.json`。

## 验证记录

本次 main 分支不含数据包的专门检查见[主分支同步验证](../docs/verification/main-sync-2026-09-27.md)。

部署验收脚本位于 `deploy/tests/`。`storage_probe.py` 验证私有桶、签名与中文文件；
`backup_restore.py` 创建标明用途的测试稿件和附件，执行备份并恢复到隔离的新项目；
随后可运行 `restart_probe.py`，复用该稿件验证重复启动、整个本项目停止重建后的
业务表行数、稿件与文件校验和。后两项会短暂停止本项目服务，运行期间暂停其他写入。
去敏结果保存在 `deploy/.local/*-check.json`；原始备份和凭据不进入版本控制。

镜像摘要见 [images.lock.json](images.lock.json)。数据库与文件持久化、权限和
业务验收以仓库验证文档中的实际运行记录为准；镜像可启动不代表全国容量验收。

个人记录、搜索与恢复的演示分支历史证据见[2026-09-27验证](../docs/verification/records-search-2026-09-27.md)，不作为本次 `main` 拆分后的重新运行结果。依赖模拟数据的[私人记录探针](https://github.com/cont1nu1ty/guofeng-platform/blob/a94f4949b47ca08cb006a032aaa6b77ba91d12ee/deploy/tests/private_records_probe.py)、[重启恢复探针](https://github.com/cont1nu1ty/guofeng-platform/blob/a94f4949b47ca08cb006a032aaa6b77ba91d12ee/deploy/tests/records_lifecycle_probe.py)和[搜索探针](https://github.com/cont1nu1ty/guofeng-platform/blob/a94f4949b47ca08cb006a032aaa6b77ba91d12ee/deploy/tests/search_probe.py)仅在演示分支提供，必须显式选择 `jiafeng-demo-*` 隔离环境；搜索故障测试拒绝当前展示项目。

## 增量首页与目录展示数据

在演示数据分支，`seed-demo` 已包含基础场景、目录场景及个人记录阶段，新环境无需再调用其他导入命令。单独的 `./deploy/dev seed-catalog` 保留为基础场景完成后的目录维护入口；它根据数据库检查点跳过已完成项，不覆盖用户编辑、不清空数据。旧环境如果只有本地清单、已有目录记录但没有数据库安装标记，会拒绝再次导入并提示需要核对迁移；原数据仍可正常使用，无需为了此命令清空旧环境。`reset-demo`会统一重建三个阶段的场景，`--empty`仍保留空环境。详情见[目录管理](../docs/frontend/catalog-management.md)。

## 公开业务缓存

默认启用公开目录与统计缓存；配置 `JIAFENG_PUBLIC_CACHE_ENABLED=false` 后重建 server 容器可禁用。Compose 项目名隔离缓存键，发布/下架自动切换内容版本，不需要手工清空 Redis。目录最长300秒，统计最长30秒，私人工作区不缓存。详细规则见[评审窗口与缓存](../docs/engineering/review-windows-cache.md)。`JIAFENG_SERVER_IMAGE`、`JIAFENG_WEB_IMAGE` 可为隔离验证指定镜像标签，默认仍为本地构建标签。

## AI 文本、知识问答、OCR 与审核辅助

2026-10-13 新增内网 `ai` 容器；MySQL V015 保存任务和知识分块。`up` 会构建适配器，
但新配置默认 `JIAFENG_AI_ENABLED=false`，不会自动调用付费模型。密钥只写本机
`deploy/.env`（0600、Git忽略），不要放入前端环境变量、源码、截图或接口示例。
开发阶段可以在同一文件配置以下非秘密选项，并另行填入 `JIAFENG_AI_API_KEY`：

```dotenv
JIAFENG_AI_ENABLED=true
JIAFENG_AI_PROVIDER=zhipu
JIAFENG_AI_EXTERNAL=true
JIAFENG_AI_BASE_URL=https://open.bigmodel.cn/api/paas/v4
JIAFENG_AI_MODEL=glm-5.2
JIAFENG_AI_OCR_MODEL=glm-ocr
JIAFENG_AI_OCR_PROTOCOL=layout
JIAFENG_AI_TIMEOUT_SECONDS=110
```

修改后执行 `./deploy/dev up` 使容器配置生效。后台「AI 运维」显示服务与模型状态，
用户端「助手」可发起任务；AI 开发接口实际会产生供应商调用费用。AI进程健康、模型已配置、
一次真实任务成功是三个不同检查：无效密钥、限流、超时均明确返回失败，不使用预设回答替代。
适配器不公开宿主机端口，不开放供应商代理给浏览器。

本地兼容模型示例（本轮实现适配入口，尚未部署/验证具体本地模型）：

```dotenv
JIAFENG_AI_PROVIDER=openai-compatible
JIAFENG_AI_EXTERNAL=false
JIAFENG_AI_BASE_URL=http://host.docker.internal:8000/v1
JIAFENG_AI_MODEL=your-local-model
JIAFENG_AI_OCR_BASE_URL=http://host.docker.internal:8001/v1
JIAFENG_AI_OCR_MODEL=your-local-vision-model
JIAFENG_AI_OCR_PROTOCOL=chat
```

`BASE_URL` 是基础路径，适配器追加 `/chat/completions`；容器的 localhost 指向容器自身，
宿主机模型用 `host.docker.internal`。同一 Compose 网络中的模型可用其服务名。
文本模型和 OCR 可分别配置 `JIAFENG_AI_OCR_API_KEY`；未配置独立 OCR 地址/密钥时继承文本配置。
本地 `chat` OCR 接口需支持图片 `image_url` 数据输入，目前仅 PNG/JPEG，PDF 需先转图片；
`layout` 协议对接智谱文档解析，支持 PNG/JPEG/PDF。两种协议不会互相猜测或静默降级。

知识资料支持 PDF、DOCX、PNG/JPEG（不支持旧二进制 DOC）。上传后选择公开/内部及语言，
显式建立索引后才参与检索。PDF文本解析最多30页，扫描件会转OCR；不把“上传成功”当作
“索引完成”。撤回、资料修改和稿件版本变化会使引用旧资料的结果停止展示。
后台审核辅助只提供建议，不自动改变人工结果或公开状态。

备份继续覆盖 MySQL 与完整 S3，包含任务和知识分块；不需要另备份 AI 容器。
恢复时运行中的模型任务按超时规则失败，避免自动重放收费请求。已完成任务和文件保留。
`./deploy/dev logs ai server` 可定位固定错误码；日志不应包含请求正文与密钥。

显式模型集成验收脚本保留在[演示分支固定提交](https://github.com/cont1nu1ty/guofeng-platform/blob/32131f59d221c38124b49ca7060252184092afe2/deploy/tests/ai_probe.py)，main 不携带。仅在单独的演示检出中执行 `python3 deploy/tests/ai_probe.py`：它会调用已配置 API、创建少量
标有联调字样的原创虚构记录，不清空现有数据。它不是默认启动步骤，不作为模型质量基准。
实现和限制见 [AI 应用接入](../docs/engineering/ai-applications.md)，依赖、锁定摘要和许可证
见 `source-lock.json`、`deploy/images.lock.json`、`licenses/ai/inventory.json`。

本机早期AI试装曾占用V005；整合版本仅对已知AI迁移校验和将记录重定位到V015（保留原应用时间），然后补齐正式V005–V014。未知校验或冲突记录会拒绝启动。升级前备份，原迁移内容不改写。此次整合未启动或迁移已停止的业务容器。
