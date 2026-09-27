# 个人云端记录、音频与搜索验证

日期：2026-09-27。范围为本机 Docker Compose、真实 MySQL/S3/Elasticsearch、HTTP H5 与后台界面。用户确认的规则为“个人记录仅本人可读，录音主动投稿后才进入后台审核”。本轮保留现有数据，新增 V003/V004 迁移；不修改已执行迁移。

## 实现范围

- 本人诵读、家庭约定保存、修改/删除、版本冲突、幂等与账号隔离；人物下架后历史约定仍可管理。私人正文、录音、标题不进入运营详情、导出或公开搜索，后台仅汇总授权地区数量。
- 上传用途 `recitation`：MP3/WAV/M4A/AAC/OGG/WebM 输入经实际音轨、大小、时长检查与受限 FFmpeg 处理后产生 MP3 和有效 fileId。删除私人打卡不破坏已主动投稿的媒体引用。已有五分钟签名不会因删除即时撤销，删除后未引用文件不再签发新链接。
- 音频故事由后台已发布的音频诵读目录提供；独立语言内容不跨语言补齐。旧设备约定需主动重新保存，旧录音缺原文件时需重选，设备数据不静默归账号。
- 搜索覆盖九类公开内容，含 CJK/English 分析、分类数量、地区加全国共享、语言与游标。业务事务写 generation/outbox，搜索前后核对版本；索引故障时业务可保存，搜索不会回落为本机成功。全量重建使用新索引、快照和事件补齐，再切换别名。
- Elasticsearch 9.5.4 默认随 Compose 启动，独立卷、内部网络与随机凭据；FFmpeg 实际为 Alpine 8.1.2-r0。镜像、来源与许可证记录见 [镜像锁](../../deploy/images.lock.json)、[来源清单](../../source-lock.json) 与 [第三方声明](../../THIRD_PARTY_NOTICES.md)。Elasticsearch 官方包为 ELv2；当前 FFmpeg 二进制启用 GPL/version3，按 GPL-3.0-or-later 登记。

## 执行结果

| 验证 | 本轮结果 | 原始证据 |
| --- | --- | --- |
| 用户端类型、单元测试、HTTP H5/微信构建 | 全部通过，18 个测试文件、121 项；微信主包 1,553,636B | [构建记录](previews/records-search-2026-09-27/miniapp-build-checks.json) |
| 后台类型、测试、HTTP 构建 | 全部通过，28 项测试 | [检查汇总](previews/records-search-2026-09-27/build-checks.json) |
| Java 21 服务端编译与 JUnit | 30 项全部通过：私人记录 8、音频 4、multipart 5、搜索 13 | [检查汇总](previews/records-search-2026-09-27/build-checks.json) |
| 部署工具 | 22 项单元测试通过；OpenAPI 内部引用检查通过 | [检查汇总](previews/records-search-2026-09-27/build-checks.json) |
| 私人记录与音频真实 API | 65 组通过；六输入格式、无时长元信息 WebM、中文文件名、超限、伪装视频、重试、并发幂等/版本冲突、跨账号/运营/专家隔离、下架历史、投稿引用保护 | [私人记录 API](previews/records-search-2026-09-27/private-api.json) |
| 签名实际过期 | 等待完整五分钟，原链接由 200 变为 403；本人重新取得链接后 200 且音频 SHA-256 相同 | [实际过期检查](previews/records-search-2026-09-27/signed-expiry.json) |
| 搜索真实 API 与故障注入 | 41 组通过；九类目录、中英/地区/分类/分页、权限、发布与撤回、重建期间编辑、搜索停机后补偿、派生索引丢失自动恢复 | [搜索 API](previews/records-search-2026-09-27/search-api.json) |
| 私人内容不入搜索 | 6 条实际私人标题/正文匿名搜索均无结果和计数；证据只保存 ID | [私人搜索排除](previews/records-search-2026-09-27/search-private-exclusion.json) |
| 受控 HTTP 网页交互 | 20 组通过，1440/390 宽度；失败保稿/重试、版本冲突、迟到响应、跨账号、复用云录音投稿 | [受控网页](previews/records-search-2026-09-27/controlled-http-ui.json) |
| 真实网页录音及回放 | 10 组通过；Chrome MediaRecorder WebM → MP3 3.24 秒 → MySQL/S3 → 刷新/重新登录 → 第二浏览器会话播放；另一账号不显示 | [真实网页](previews/records-search-2026-09-27/live-browser-recording.json) |
| 后台真实网页 | 9 组通过，1440/390 宽度；全国/浙江汇总隔离、搜索状态可读、区域设置权限限制，无私人明细、溢出或页面异常 | [后台网页](previews/records-search-2026-09-27/admin-live-ui.json) |
| 音频故事发布联动 | 6 组通过；草稿不可见、发布可见且实际播放、编辑回草稿、再发布后标题/正文更新、下架后页面消失；原故事记录未改 | [故事发布网页](previews/records-search-2026-09-27/story-publication-ui.json) |
| 传习页最终文案复验 | 6 组通过；1440/390 中英文列表、中文详情，账号保存和后台名额说明正确，无溢出、页面异常或业务写入 | [最终页面](previews/records-search-2026-09-27/learning-copy-ui.json) |
| 空卷安装 | 默认启动无业务样例、无文件；搜索就绪且为空，完整显式导入成功 | [空安装](previews/records-search-2026-09-27/empty-install.json) |
| 重复导入、重建容器、备份恢复 | 8 张业务表逐行摘要一致；本人记录及代表性音频字节相同；新卷恢复后搜索自动重建，结果和分类数量一致 | [生命周期](previews/records-search-2026-09-27/lifecycle.json) |
| 现有环境升级与增量导入 | 原 13 账号、180 实体、12 文件及稿件版本、草稿、报名逐行保留；只追加 16 实体、7 文件，不改旧完成标记 | [现有环境升级](previews/records-search-2026-09-27/main-upgrade.json) |

真实网页录音使用 Chromium 注入的 440Hz 测试音源，MediaRecorder 编码与上传、处理、播放均为真实链路。它不证明物理麦克风、手机权限或微信真机可用。受控 HTTP 网页检查使用独立响应夹具，不冒充 Java 实联。

截图举例：[手机回放](previews/records-search-2026-09-27/live-second-context-playback-390.png)、[手机搜索](previews/records-search-2026-09-27/live-real-search-390.png)、[后台目录驱动的故事页面](previews/records-search-2026-09-27/live-real-audio-story-catalog-1440.png)、[约定冲突保稿](previews/records-search-2026-09-27/controlled-promise-conflict-390.png)、[后台手机搜索状态](previews/records-search-2026-09-27/admin-devadmin-search-settings-390.png)。

## 部署及恢复范围

测试使用独立项目 `jiafeng-demo-records-check`（19082/19335）；恢复使用新项目 `jiafeng-restore-20260927090106-a37a`（19083/19336），未覆盖源卷。测试和恢复环境检查完成后停止，数据卷保留。本机 `jiafeng-dev`（18080/18333）另有升级前完整备份；升级通过原字段逐行摘要核对，然后仅运行独立 `seed-demo-records` 追加。

重复 `seed-demo` 和 `seed-demo-records` 不重建被用户删除的记录，也不覆盖编辑。备份暂停应用写入并保存 MySQL 与完整 S3 数据，校验清单后恢复到新卷；搜索为可重建派生数据，不作为业务备份来源。恢复比较包括浏览器本轮真实生成的 MP3 与其 MySQL 归属。

复现操作见 [部署说明](../../deploy/README.md)。API/故障/生命周期脚本分别为 [私人记录](../../deploy/tests/private_records_probe.py)、[搜索](../../deploy/tests/search_probe.py)、[重启恢复](../../deploy/tests/records_lifecycle_probe.py)。故障与生命周期验证必须使用隔离测试项目，不对当前展示环境执行。

本轮调试发现并修复 ES `_refresh` 请求体和 Spring 文本编码不匹配问题，并补了非法分页参数的稳定 422 响应。后台新增搜索页最初误显示操作日志表，已收窄条件分支并重新完成 28 项测试、构建及网页复验；表内成功结果均使用修复后的源码。H5 构建仍提示两处既有 WOFF 资源在运行时解析，网页截图中资源正常；未把构建提示改写为微信真机证据。

传习页遗留的“仅本机预约”文字已按 HTTP/demo 分开，真实模式说明按账号保存、更新后台名额，继续标明虚构场景和证书样张边界；修改后重新执行用户端四项检查。修改文件的格式检查通过；全项目 `format:check` 仍被本轮未改动的 `tests/catalog-live.cjs` 旧格式阻挡，因此不记为全量格式通过。

## 尚未取得的证据

- 物理麦克风、iOS/Android 微信真机、真实手机选文件/拒绝授权、弱网与软键盘矩阵。
- FFmpeg 超时与并发槽位耗尽的专门故障注入；限制已实现，正常转换、实际超限和处理失败拒绝已有验证。
- 大体量索引、长时间压力/容量、生产集群、跨机网络及公网 HTTPS。版本闸门保证查询在最后一次校验时对应已提交目录，不能阻止响应传输之后发生新的业务提交。
