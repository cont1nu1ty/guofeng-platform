# 家风中华行 · 本机容器部署

需要 Docker Engine、Docker Compose 和 Python 3。首次启动会下载固定摘要的
Java 21、Maven、Node、MySQL、Redis、SeaweedFS 和 Nginx 镜像并构建两端。

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

## 显式导入演示数据

演示数据分支为 `codex/demo-data-bootstrap`。在新电脑准备独立工作目录：

```bash
git clone --branch codex/demo-data-bootstrap --single-branch https://github.com/cont1nu1ty/guofeng-platform.git
cd guofeng-platform
./deploy/dev up
./deploy/dev seed-demo
```

已有检出目录时，在切换到该分支后执行最后两条命令即可。`up` 等待服务健康并完成基础数据库初始化，默认只有开发账号及基础配置，不导入演示业务。`seed-demo` 是单独的显式操作；不在应用启动或重启时自动执行，也没有常驻导入容器。它复用宿主机Python 3、Docker Compose和运行中的后端。

完整数据源、PDF和原创音视频素材随Git提供，见[数据包清单](fixtures/README.md)。导入会新建业务ID、使用本机随机开发密码，并将附件通过真实接口上传到当前S3，关联稿件和媒体。它重建仓库定义的虚构场景，不复制其他电脑的运行数据库、会话或临时下载链接。

初始场景包括13个账号、16篇稿件及17份修订、51条历史/当前评审任务、2份云草稿、资讯与典籍、6种活动情形、课程进度与公益申领，以及10条轮播、7条媒体、4处阵地、3份人物档案和2条人工咨询。公开端按发布状态、地区、语言和时间窗口过滤，并非所有记录都公开显示。详细操作见[演示路线](../docs/frontend/showcase-data.md)与[目录管理](../docs/frontend/catalog-management.md)。

导入完成后直接打开首页和后台，密码仍在本机 `deploy/.env` 的 `JIAFENG_DEV_PASSWORD`。后续启动只需 `./deploy/dev up`，数据库和文件都会保留。

### 重复执行、失败与已有数据

- 同一数据版本完整导入后，重复 `seed-demo` 返回已完成并跳过，保留之后修改过的内容。完成标记保存在数据库中；保留该环境的部署配置和数据卷时，更换检出目录或丢失本地清单不会导致重新导入。
- 没有可信导入标记的非空业务数据库，或已经修改过基础账号的环境，会被拒绝，不会自动合并或覆盖。当前已经在使用的旧演示环境无需再次导入。
- 基础稿件/评审阶段中断时，命令停止并保留现场；需要重新开始时显式执行 `./deploy/dev reset-demo`，先备份再清理重建。不会因重试而自动删除数据。
- 基础阶段完成后，目录阶段使用数据库中的检查点恢复；再次执行 `seed-demo` 即可继续，完成记录和已有编辑会被跳过。
- 仓库中的数据版本发生改变时，不自动重放到旧库。需要全新场景时使用独立环境，或明确执行会备份并清理的 `reset-demo`。

导入仅允许启用开发账号的 `jiafeng-dev` 或 `jiafeng-demo-*` 项目，并核对容器和数据卷归属。要使用其他本机演示环境，将 `JIAFENG_ENV_FILE` 指向该环境配置，再使用相同命令；端口和项目名应与既有环境分开。

## 局域网

先修改 `deploy/.env`，例如电脑可达地址为 `192.168.1.20`：

```dotenv
JIAFENG_BIND_ADDRESS=0.0.0.0
JIAFENG_S3_PUBLIC_ENDPOINT=http://192.168.1.20:18333
```

再次运行 `./deploy/dev up`。两端共用 `18080` 入口；下载链接使用 `18333`。
电脑防火墙和校园网的设备隔离仍会影响访问。本脚本不修改防火墙。
MySQL、Redis、SeaweedFS 管理端口不发布到宿主机。正式公网需另配 HTTPS，
关闭开发登录并配置真实身份提供方，不应直接使用本机测试配置。

## 备份与隔离恢复

```bash
./deploy/dev backup
./deploy/dev restore deploy/backups/生成的目录
```

备份先停止应用写入，导出 MySQL，再停止存储以一致地复制整个 SeaweedFS 数据卷。
最后恢复原先运行的服务。备份包含数据库、文件与元数据、本地凭据、镜像来源和
SHA-256 清单；按含敏感业务数据的文件妥善保存。

恢复先校验清单，再创建唯一的 `jiafeng-restore-*` Compose 项目和新卷，不覆盖
原环境。默认恢复入口 `18081`，S3 `18334`；可使用
`JIAFENG_RESTORE_HTTP_PORT` / `JIAFENG_RESTORE_S3_PORT` 调整。完成后命令输出
恢复环境的 `JIAFENG_ENV_FILE=...` 管理方式。Redis 会话不迁移，恢复后重新登录。

## 清理并重建展示数据

```bash
./deploy/dev reset-demo
```

该命令先生成并校验完整备份，再清空本项目当前业务数据、稿件版本与附件、
评审流程及任务、会话、家风账号和关联记录；保留数据库迁移、上游菜单字典、
本地配置及原开发密码。随后恢复六个初始开发账号，并调用
统一演示导入流程重新生成可供网页用户端和后台共同操作的模拟业务数据。
这是真实数据库中的展示样例，不是前端内存 Mock；重建后原网页会话需要重新登录。

需要只恢复空白底座时使用 `./deploy/dev reset-demo --empty`，它不会生成展示样例。
随后需要样例时再执行 `./deploy/dev seed-demo`。重置期间请暂停操作两端。
重复执行会先保存一份新的完整备份，再重建数据，不会叠加旧的投稿或文件。

为避免清理其他环境，命令只接受启用了开发账号的 `jiafeng-dev` 或
`jiafeng-demo-*` Compose 项目，并核对数据库、Redis、S3 容器与数据卷的项目标签。
它不删除任何数据卷、旧备份或其他项目容器，也不会重新生成密码或构建镜像。
整个备份到清理期间应用停止写入；备份或校验失败即停止，不进入数据清理。
如果清理或样例生成中途失败，命令保留并输出备份位置；可按上一节恢复到独立环境。
最后一次执行摘要记录在 Git 忽略的 `deploy/.local/reset-demo.json`。

## 验证记录

部署验收脚本位于 `deploy/tests/`。`storage_probe.py` 验证私有桶、签名与中文文件；
`backup_restore.py` 创建标明用途的测试稿件和附件，执行备份并恢复到隔离的新项目；
随后可运行 `restart_probe.py`，复用该稿件验证重复启动、整个本项目停止重建后的
业务表行数、稿件与文件校验和。后两项会短暂停止本项目服务，运行期间暂停其他写入。
去敏结果保存在 `deploy/.local/*-check.json`；原始备份和凭据不进入版本控制。

镜像摘要见 [images.lock.json](images.lock.json)。数据库与文件持久化、权限和
业务验收以仓库验证文档中的实际运行记录为准；镜像可启动不代表全国容量验收。

## 增量首页与目录展示数据

`seed-demo` 已包含基础场景及目录场景，无需再调用其他导入命令。单独的 `./deploy/dev seed-catalog` 保留为基础场景完成后的目录维护入口；它根据数据库检查点跳过已完成项，不覆盖用户编辑、不清空数据。旧环境如果只有本地清单、已有目录记录但没有数据库安装标记，会拒绝再次导入并提示需要核对迁移；原数据仍可正常使用，无需为了此命令清空旧环境。`reset-demo`会统一重建两批场景，`--empty`仍保留空环境。详情见[目录管理](../docs/frontend/catalog-management.md)。
