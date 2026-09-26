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
`deploy/seed-showcase.py` 重新生成可供网页用户端和后台共同操作的模拟业务数据。
这是真实数据库中的展示样例，不是前端内存 Mock；重建后原网页会话需要重新登录。

需要只恢复空白底座时使用 `./deploy/dev reset-demo --empty`，它不会生成展示样例。
开发者可以再单独执行 `python3 deploy/seed-showcase.py`。重置期间请暂停操作两端。
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

在已经安装基础展示数据及当前版本服务后，执行 `./deploy/dev seed-catalog`。它通过真实接口追加六类轮播、媒体、阵地、人物、咨询场景，按本地checkpoint跳过已完成项，不覆盖用户编辑；不清空数据。`reset-demo`未来重建时也会追加此批目录，`--empty`仍保留空环境。详情见[目录管理](../docs/frontend/catalog-management.md)。
