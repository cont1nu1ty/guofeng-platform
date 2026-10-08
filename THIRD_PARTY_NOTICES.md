# 第三方来源与许可

2026-10-07 新增服务端文档生成：Apache PDFBox 3.0.7 用于 PDF，保留 `licenses/pdfbox-3.0.7-LICENSE.txt` 与 `licenses/pdfbox-3.0.7-NOTICE.txt`；Noto Sans SC 字体用于中文 PDF 嵌入，保留 `licenses/NotoSansSC-OFL.txt`。固定来源、SHA256 与 FontTools 4.65.0 构建步骤见 `scripts/font-data/server-manifest.json` 和 `scripts/build_server_font.py`。Word 文件由本项目 OOXML 写入器生成。字体用于报表、典籍与证书正文，不代表正式电子签章。

本项目包含需求沟通界面及本机真实服务试点，原创业务代码尚未替用户选择对外开源许可。第三方软件保留其原许可；`private: true` 不替代许可证义务。

| 内容                                                      | 本次使用方式                                                                                       | 来源与许可证                                                                                                                                                                                                                |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wot Starter                                               | 基于已锁定提交裁剪依赖组合、Vite 配置、应用入口；并非完整分叉或完整继承全部功能                    | [上游](https://github.com/wot-ui/wot-starter/tree/c9813573b73f45fc08b0eb249f0f28c5ca0fe401)，原始 MIT 文本保留于 `licenses/wot-starter.MIT.txt`                                                                             |
| Wot UI 2.3.1                                              | 实际引入按钮、图标、复选框、弹层、开关；没有复制手写同等基础控件                                   | [上游](https://github.com/wot-ui/wot-ui)，MIT 文本保留于 `licenses/wot-ui.MIT.txt`                                                                                                                                          |
| Wot UI 图标字体                                           | npm 包内 51KB 字体转换为本地 CSS data URI，避免演示依赖外部字体请求，原字体不修改                  | 同上                                                                                                                                                                                                                        |
| Uni-app 4.85 对应编译包、Vue、Vite、TypeScript、Vitest 等 | npm 依赖；准确版本、下载来源、完整性哈希由 package-lock.json 锁定                                  | 以安装版本自带 LICENSE/NOTICE 为准；Uni-app 仓库含 Apache-2.0 及额外许可文件，应在正式发布时核对运行时与 SDK 适用范围                                                                                                       |
| 书卷、山形、拱门等插画                                    | 项目原创 CSS 图形，无外部图片下载                                                                  | 本项目原创                                                                                                                                                                                                                  |
| 篇章、资讯、活动样例                                      | 为沟通编写的原创演示文本；不是官方资讯、出版物或真实活动                                           | 在界面和数据内标示；历史人物馆使用注明公开来源的简短介绍与公版古文短句                                                                                                                                                      |
| 思源黑体 / 思源宋体                                       | H5／微信分别附带 WOFF 子集；微信构建内联 Data URL。重命名 JiafengSans / JiafengSerif，保留竖排特性 | [Adobe 黑体](https://github.com/adobe-fonts/source-han-sans) / [Adobe 宋体](https://github.com/adobe-fonts/source-han-serif)，SIL OFL 1.1；原始许可位于 `licenses/`，固定来源、哈希与构建方法见 `docs/engineering/fonts.md` |
| Unihan 常用字数据                                         | 构建时选取字形子集，不运行时联网                                                                   | Unicode 17.0.0；原始许可 `licenses/Unicode-LICENSE.txt`                                                                                                                                                                     |
| 三条视频及封面                                            | 原创 12 秒静音文字动画，H.264，不含外部影像/录音                                                   | 素材说明与人物馆公开资料出处见 `apps/miniapp/src/pkg-content/static/media/README.md`；渲染用系统 Noto CJK，字体文件未嵌入视频                                                                                               |

| Quill 1.3.7 | Uni H5 富文本编辑器所用上游版本随项目本地加载，免外部 CDN 请求；只移除 sourcemap 引用 | [上游](https://github.com/quilljs/quill/tree/v1.3.7)，BSD-3-Clause，完整许可 `licenses/quill-BSD-3-Clause.txt` |
| 八份双语音频 | 原创虚构故事、清廉日常和名人馆讲解；本机离线合成，不是真人/历史录音 | 脚本与生成过程见 `scripts/audio-sample-manifest.json`；构建工具 [eSpeak NG 1.52.0](https://github.com/espeak-ng/espeak-ng) 与 FFmpeg 的二进制没有分发，项目无运行时语音服务依赖 |

准确来源见 `source-lock.json`。2026-09-26 已实际引入固定提交的 RuoYi-Vue-Plus Java、WarmFlow 及数据库/S3容器；plus-ui 继续按需复用。芋道、OCR、全景和模型平台仍未引入。不能把一个项目的许可套用于其素材、模型或全部依赖。

2026-09-21 新增的 [后台候选快照](projects/backend/upstream-candidates.json) 仅记录当时调研版本与官方证据，不是已安装依赖。具体代码、配套SQL、商业模块、镜像与模型许可边界见 [后台选型](projects/backend/selection.md)；该次调研未引入源码，随后后台界面实际采用内容见下表。

## 2026-09-21 · 后台界面实际复用

| 内容                                   | 使用范围                                                                                                                                                 | 来源与许可                                                                                                                             |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| plus-ui Vue                            | 固定提交的依赖组合子集，实际裁剪Pagination与RightToolbar；原始组件存于`apps/admin/upstream/plus-ui`，适配版存于`src/components/upstream`；未引入完整框架 | [固定上游](https://github.com/CrazyLionCat/plus-ui/tree/259325b4eecd715279b66b70f90eb9a2f741133c)，MIT，保留`licenses/plus-ui.MIT.txt` |
| Element Plus 2.14.5                    | 后台按钮、表格、表单、弹层、导航控件等npm组件                                                                                                            | MIT，`licenses/element-plus.MIT.txt`                                                                                                   |
| Element Plus Icons 2.3.2               | 后台功能图标                                                                                                                                             | MIT，`licenses/element-plus-icons.MIT.txt`                                                                                             |
| Apache ECharts 6.1.0                   | 后台折线、环图、区域条形图；HTTP模式读取服务统计，Mock模式为示例                                                                                         | Apache-2.0及包内第三方声明，保留`licenses/echarts.LICENSE.txt`、`licenses/echarts.NOTICE.txt`                                          |
| Vue / Vue Router / Vite / TypeScript等 | 管理站独立npm依赖；未升级用户端Uni-app组合                                                                                                               | 精确版本和完整性见`apps/admin/package-lock.json`，以每个安装包自身LICENSE为准                                                          |
| 思源宋体/黑体子集                      | 后台引用用户端现有WOFF，由Vite构建复制至后台产物                                                                                                         | 沿用原OFL及根字体来源记录，未新增外部字体或运行时CDN                                                                                   |

后台布局、家风业务页面、图形装饰与所有示例内容为本项目编写。页面用到浏览器API属于独立H5工程，不主张为小程序跨端实现。

## 2026-09-26 · 真实服务与部署实际使用

| 内容 | 实际使用范围 | 原始来源与保留许可 |
| --- | --- | --- |
| RuoYi-Vue-Plus 6.X | 完整固定源码保留于 `apps/server`；应用装配复用system、Sa-Token、MyBatis、OSS、workflow，排除AI/MCP/demo/生成器/外部调度与监控客户端；新增独立家风模块与Compose配置 | [固定提交](https://github.com/dromara/RuoYi-Vue-Plus/tree/de394a0e21f1e0648ef229d027c3a927d98200a2)，MIT；`apps/server/LICENSE`、归档校验与修改文件清单 `apps/server/UPSTREAM.lock.json` |
| 上游系统与流程SQL | 原样保留并在空MySQL卷首次导入 `script/sql/ry_vue.sql`、`ry_workflow.sql`；独立后置SQL禁用上游演示用户，业务迁移另建 | 系统SQL随固定若依MIT源码保留；流程SQL注明WarmFlow来源，其Apache-2.0许可另行保留 |
| WarmFlow 1.8.9 | 官方Maven流程引擎、任务、定义、轨迹及若依工作流模块；本项目未复制自造通用流程引擎 | [版本源码与许可](https://github.com/dromara/warm-flow/blob/v1.8.9/LICENSE)，`licenses/warm-flow-1.8.9.Apache-2.0.txt`；Maven包内第三方声明随原JAR保留 |
| plus-ui 登录与权限适配 | 在原固定提交基础上新增6份只读源码快照；适配token存取、请求错误/Bearer边界、登录生命周期、权限匹配和Element Plus登录表单；保留自有布局与业务DTO，不引入完整动态路由/加密协议 | [同一固定提交](https://github.com/CrazyLionCat/plus-ui/tree/259325b4eecd715279b66b70f90eb9a2f741133c)，MIT；`apps/admin/upstream/plus-ui/README.md` 逐项映射，`source-lock.json` 原始/适配SHA-256 |
| MySQL Community Server 8.4.9 | 独立官方数据库镜像；未修改MySQL程序 | [该版本完整许可](https://github.com/mysql/mysql-server/blob/mysql-8.4.9/LICENSE)，GPLv2与指定附加许可及组件例外；完整文本 `licenses/mysql-8.4.9.LICENSE.txt` |
| MySQL Connector/J 9.7.0 | 固定若依/Spring Boot依赖管理实际解析的JDBC驱动，打包在Java应用中；不是若依MIT的一部分 | 从实际JAR原样保存 `licenses/mysql-connector-j-9.7.0.LICENSE.txt`；GPLv2、附加许可和Universal FOSS Exception按该文本适用 |
| Redis 8.6.3 | 独立官方缓存/会话镜像；不修改Redis本体 | [Redis 8.6.3许可](https://github.com/redis/redis/blob/8.6.3/LICENSE.txt) 为RSALv2 / SSPLv1 / AGPLv3三选一，本项目采用AGPLv3选项；保留完整 `licenses/redis-8.6.3.LICENSE.txt` 与历史BSD贡献说明 `licenses/redis-8.6.3.CONTRIBUTIONS.txt`，不标为BSD或MIT |
| SeaweedFS 4.47 | 原镜像以单节点mini运行私有S3桶；未修改存储程序 | [固定版本许可](https://github.com/seaweedfs/seaweedfs/blob/4.47/LICENSE)，Apache-2.0；`licenses/seaweedfs-4.47.Apache-2.0.txt` |
| Nginx 1.29.6 | 静态站点与同源反向代理镜像，项目仅添加站点配置 | [版本许可](https://github.com/nginx/nginx/blob/release-1.29.6/LICENSE)，BSD-2-Clause；`licenses/nginx-1.29.6.BSD-2-Clause.txt` |
| Eclipse Temurin Java 21 | Maven构建JDK与运行JRE镜像，未修改JDK；运行镜像摘要已锁定 | 从实际JRE镜像保留 `licenses/temurin-21.GPL-2-with-Classpath-Exception.txt`、`ADDITIONAL_LICENSE_INFO`、`ASSEMBLY_EXCEPTION`；其它JDK组件保留镜像内各模块legal文件 |
| Maven 3.9.11 / Node 22 | 多阶段镜像中的构建工具，不进入最终Nginx站点产物 | 实际镜像提取 `licenses/maven-3.9.11.LICENSE.txt`、`maven-3.9.11.NOTICE.txt`、`node-22-image.LICENSE.txt`；Node文件含其MIT及捆绑第三方声明 |
| AWS SDK S3 2.48.1 / Sa-Token 1.45.0 / MyBatis 3.5.19 / MyBatis-Plus / Redisson 4.6.1 / LiteFlow 2.16.1.2 | 随固定上游的Java依赖组合使用，保留原JAR；MyBatis-Plus starter实际3.5.17、core/extension实际3.5.15，不改写成统一版本 | 对应原许可/NOTICE已保存在 `licenses/`；LiteFlow版本发布POM声明与通用Apache-2.0文本同存。实际303个第三方运行JAR的哈希及内嵌许可位置见 `licenses/server-runtime-inventory.json` |

所有部署镜像的完整tag和digest见 `deploy/images.lock.json`；源码归档、SQL、许可文件和前端适配哈希见 `source-lock.json`。原镜像内OS包、JDK模块、npm/Maven传递依赖按自身许可保留，上表不将整个镜像或应用概括为单一MIT许可。构建没有移除运行JAR内的LICENSE/NOTICE。

## 2026-09-26 首页与内容目录接入

轮播、首页配置、媒体/阵地/人物目录、订阅与咨询的业务代码和 `deploy/fixtures/catalog_content.json` 场景文案为本项目原创，未引入新第三方库。后台继续复用既有 Element Plus、RuoYi认证/数据库层及 AWS S3 SDK；用户端继续使用 Uni-app、Wot UI。私有存储展示文件复用 `apps/miniapp/src/pkg-content/static/media/README.md` 已登记的三组原创静音文字动画与封面，不是第三方盛典视频、真人录音或AI生成内容。数据与主要新增模块摘要登记在 `source-lock.json` 的 `catalogManagement`。

演示数据分支的显式导入、数据库安装标记、项目隔离清单及验证工具为本项目原创，使用Python标准库和既有部署组件，没有新增运行依赖。可重建JSON、三份原创PDF和既有原创媒体随仓库提供；来源清单的 `showcaseData` 同步登记导入工具及摘要。运行数据库、密码和会话不属于此数据包。

## 2026-09-27 · 私人记录与公开搜索

| 内容 | 使用范围 | 来源与许可 |
| --- | --- | --- |
| Elasticsearch 9.5.4 | 独立私有单节点容器，仅索引已发布公开内容；MySQL与S3是原始数据；不启用若依旧7.17客户端或商业试用功能 | 官方镜像tag/digest见`deploy/images.lock.json`；发行包为Elastic License 2.0，原文`licenses/elasticsearch-9.5.4.LICENSE.txt`。镜像内第三方NOTICE继续保留；不将AGPL源码选项或Apache客户端许可误标为整个镜像许可。 |
| FFmpeg / ffprobe 8.1.2-r0 | 在固定Alpine 3.24/Temurin镜像内通过官方apk安装，作为独立进程将私人录音转换为MP3；不修改FFmpeg源码 | [FFmpeg n8.1.2源码](https://github.com/FFmpeg/FFmpeg/tree/n8.1.2)；Alpine包声明GPL-2.0-or-later与LGPL-2.1-or-later，实际构建含`--enable-gpl --enable-version3`，`ffmpeg -L`明确声明**GPL-3.0-or-later**，不能仅标LGPL或GPLv2。保留`licenses/ffmpeg-8.1.2.COPYING.GPLv2`、`COPYING.LGPLv2.1`、`COPYING.GPLv3`及`LICENSE.md`，实际构建和许可输出见`licenses/ffmpeg-8.1.2.runtime-inventory.txt`；依赖OS组件遵从各自许可。 |

私人记录、搜索同步与接口、增量种子和验证代码为本项目编写。四份故事MP3复用既有原创文字与合成音频（`scripts/audio-sample-manifest.json`），通过显式导入上传S3，明确为演示声音，不是用户真实录音。FFmpeg二进制进入本轮服务器镜像，与早期仅用本机工具生成样例的历史范围不同。

## 2026-10-08 · 非 AI 场景全景素材

演示人物沈守约使用 Greg Zaal 的 [Autumn Hockey](https://polyhaven.com/a/autumn_hockey) Tonemapped JPG 作为球面浏览技术示例，资产依据 [Poly Haven CC0 许可](https://polyhaven.com/license)。通过原站 HTTPS URL 引用，未将公园摄影说成展馆实景；人物和故事为项目原创虚构。来源/文件标识见 `source-lock.json` 的 `nonAiShowcase` 与 `deploy/fixtures/non_ai/education-media-sources.md`。本地几何书屋纹理为程序绘制的原创样例，没有引入第三方代码或新增运行库。
