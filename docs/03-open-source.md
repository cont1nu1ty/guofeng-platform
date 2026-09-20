# 开源复用选型与整合方案

查询日期：2026-09-20。本文区分“已核实的上游能力”和“本项目拟采用方案”。以下后端、工作流、AI、OCR、VR、商城均为候选或路线，**不代表已在本项目集成**。当前优先交付可沟通的前端演示，业务服务以独立接口替换模拟数据。

## 本轮已落地的前端复用

本轮基于 [wot-ui/wot-starter](https://github.com/wot-ui/wot-starter/tree/c9813573b73f45fc08b0eb249f0f28c5ca0fe401) 的依赖组合和工程配置做裁剪，保留 H5/微信两个目标、Uni-app 4.85 对应整组编译依赖、Vue 3.4.38 与 TypeScript。实际安装并使用 [Wot UI](https://github.com/wot-ui/wot-ui) 2.3.1 的按钮、图标、复选框、弹层与开关；它支持 Uni-app 多端、自定义主题，采用 MIT 许可。[官方模板说明](https://wot-ui.cn/guide/templates.html)、[组件库介绍](https://wot-ui.cn/en-US/)。

上游 Starter 固定于 `c9813573b73f45fc08b0eb249f0f28c5ca0fe401`（提交时间 2026-08-29）。保留源码许可，使用 npm 锁文件；没有把全套示例、所有平台、ECharts 与商城打入首期。通道选择、内容布局与家风业务是定制内容。不是完整 fork，也没有声称继承上游的 Alova、Pinia、自动路由等全部能力。后续若需要这些能力可按边界逐项接回，避免升级时覆盖领域代码。

另比较了 [vitesse-uni-app](https://github.com/uni-helper/vitesse-uni-app)（MIT，干净的 Vue3/Uni-app 工程模板）与 Wot Starter；后者已有配套组件组合，更符合本次快速演示要求。没有选择独立 React 网页原型，以减少后续迁回小程序的工作。

**兼容性待决：**原文基础库 2.10.0 与现代 Vue 3 路线不能直接视为兼容。Uni Helper 的官方工具说明提到 Vue 3 需要微信基础库至少 2.11.2，但这只是其中一个最低条件，并不证明 Wot UI 2.3.1、CSS Grid、全部组件及实际机型均能运行。最低版本须在微信开发者工具和真机矩阵中重新确定，必要时调整文档要求或采用原生方案。[上游兼容提示](https://github.com/uni-helper/uni-use)。当前仅两端编译和 H5 浏览器验证。

准确引入版本与复用文件见 `source-lock.json`、`THIRD_PARTY_NOTICES.md`。未引入的后端候选如下。

## 1. 推荐组合

1. **用户端：Uni-app + Vue 3 + TypeScript**。保持原生小程序组件与跨端 API，先验证首页、投稿、进度、典藏、活动、个人中心。国风视觉和家风业务页面需要定制，后台模板不能直接充当小程序。
2. **后台与主业务：优先评估 RuoYi-Vue-Plus + 配套 plus-ui Vue 分支**。复用组织、角色、权限、文件、字典、日志、代码生成、工作流基础设施；投稿、专家盲审、典籍、公示必须建立自己的领域模块。
3. **工作流：首先验证所选底座自带 WarmFlow**；若六级评审确定要求 BPMN 标准建模、复杂会签和流程迁移，改选芋道 + Flowable 或独立 Flowable 服务。一个评审业务只选一个流程引擎。
4. **商城：后置复用 yudao-mall-uniapp 与匹配的芋道商城后端**。只有进入真实交易阶段才接会员、库存、订单、支付、退款；不能把完整电商工程混入首期投稿应用。
5. **AI：先用服务接口留出边界；PaddleOCR 优先独立验证；Dify/FastGPT 暂列有条件备选**。两者的源码许可都有额外限制，不能简单写“Apache 2.0、无限制商用”。
6. **数据图表采用 ECharts；全景采用 Photo Sphere Viewer 的 H5 原型**。小程序 Canvas/WebView 需要单独适配和真机验证，浏览器能运行不等于微信端可直接运行。

## 2. 业务底座比较

| 候选 | 可直接复用的基础内容 | 需要自建或改造的内容 | 相对成本与判断 |
|---|---|---|---|
| [RuoYi-Vue-Plus](https://github.com/dromara/RuoYi-Vue-Plus) + [plus-ui](https://github.com/CrazyLionCat/plus-ui) | 用户/组织/角色、权限与日志、文件存储配置、字典、代码生成、WarmFlow 集成入口 | C 端身份与小程序登录、投稿版本、六级评分、匿名专家视图、版权协议、典籍与省级数据路由 | **推荐先做技术验证**；基础管理复用成本低，文化业务成本中，物理分库成本高。plus-ui 是桌面管理端 |
| [ruoyi-vue-pro](https://github.com/YunaiV/ruoyi-vue-pro) | 系统与基础设施、Flowable、会员、支付、商城等模块 | 家风领域模型、评分/回避、公示、稿件与各省库的数据治理 | **功能优先备选**；若商城和复杂流程提前，减少跨框架拼装；需裁剪无关模块。选 Spring Boot 多模块版即可 |
| [yudao-cloud](https://github.com/YunaiV/yudao-cloud) | 与芋道体系相近的业务模块，微服务部署方式 | 同上；还需服务发现、网关、分布式故障与观测体系 | **后期备选**；当前为了演示上微服务不划算，不把“全国平台”直接等同于“从第一天微服务” |
| [yudao-mall-uniapp](https://github.com/yudaocode/yudao-mall-uniapp) | Vue 3/Uni-app 商城界面、商品/购物车/订单等现成结构 | 家风主题视觉、公益额度申领、政务定制、与主业务会员和地区边界对接 | **商城阶段复用**；前后端接口绑定芋道生态。若主后台选 RuoYi-Vue-Plus，建议独立商城服务与接口适配，避免复制整个商城表结构 |

上述四个项目仓库许可为 MIT；复用时保留实际 LICENSE 中要求的版权与许可声明。仓库 README 的宣传文字不能覆盖 LICENSE，也不保证附带素材、字体、插件及其传递依赖具有相同许可。[后端许可证](https://github.com/dromara/RuoYi-Vue-Plus/blob/6.X/LICENSE)、[plus-ui 许可证](https://github.com/CrazyLionCat/plus-ui/blob/6.X-Vue/LICENSE)、[芋道许可证](https://github.com/YunaiV/ruoyi-vue-pro/blob/master/LICENSE)、[商城许可证](https://github.com/yudaocode/yudao-mall-uniapp/blob/master/LICENSE)。

### 版本必须配对

2026-09-20 核实：RuoYi-Vue-Plus 默认 `6.X`，其当前 POM 为 Java 21、Spring Boot 4.1.0、WarmFlow 1.8.9；官方链接指向 `CrazyLionCat/plus-ui`，Vue 默认分支为 `6.X-Vue`。主框架页面有历史描述，不能仅凭标题选分支。应锁定经过验证的后端 tag/commit、对应 Vue 前端 commit 和锁文件，先做登录/权限/文件/流程兼容性验证。[POM](https://github.com/dromara/RuoYi-Vue-Plus/blob/6.X/pom.xml)、[前端 package.json](https://github.com/CrazyLionCat/plus-ui/blob/6.X-Vue/package.json)。

plus-ui 的 GitHub “latest release” 查询返回 `v6.0.0-React`，**它不是本项目建议的 Vue 前端版本**。芋道也有不同 JDK/Spring Boot 分支，默认 master 不能直接被理解为建议的运行时；在后端立项时根据部署环境选择对应受维护分支。

### 多租户并不自动满足物理隔离

“租户 ID 过滤”解决同库行级隔离；“动态数据源”提供连接切换能力；“省级独立数据库/实例、账号、备份、密钥和同步治理”才接近原文的物理隔离要求。三者不同。芋道 `TenantDatabaseInterceptor` 实现 `TenantLineHandler`，属于行级租户机制；不能将其宣传为开箱即用的 34 省物理分库。[上游实现](https://github.com/YunaiV/ruoyi-vue-pro/blob/master/yudao-framework/yudao-spring-boot-starter-biz-tenant/src/main/java/cn/iocoder/yudao/framework/tenant/core/db/TenantDatabaseInterceptor.java)。RuoYi-Vue-Plus 提供的多数据源能力也不能替代省级隔离方案与验收。

## 3. 专项能力选择

| 能力与候选 | 已核实许可 | 复用范围与适用边界 | 本项目决策 / 集成成本 |
|---|---|---|---|
| [WarmFlow](https://github.com/dromara/warm-flow) | Apache-2.0 | 流程与审批；RuoYi-Vue-Plus 当前自带。专家评分、回避、盲审与异议处理仍是业务代码 | 首选验证既有集成；中。用一条完整评审流程验证退回、会签、超时和版本冻结 |
| [Flowable Engine](https://github.com/flowable/flowable-engine) | Apache-2.0 | Java BPMN/CMMN/DMN 引擎、人工任务与历史；开源 engine 不等于全部商业设计/运营产品 | 复杂评审批量化时备选；中至高。采用芋道现有集成优于再给若依接第二引擎 |
| [Dify](https://github.com/langgenius/dify) | 修改版 Apache 2.0，附加条件 | RAG、工作流、模型适配和运行记录；不是模型，也不自动保证离线、隔离、审核 | 暂不作为无条件基础依赖；高。许可对多租户环境有书面授权条件，并以 workspace 定义租户；使用其前端还涉及标识条款。[LICENSE](https://github.com/langgenius/dify/blob/main/LICENSE) |
| [FastGPT](https://github.com/labring/FastGPT) | Apache 2.0 加附加条件 | 知识库问答、工作流/API；不是模型 | 有条件备选；中至高。条款限制未经授权运营与 FastGPT 类似的多租户 SaaS，并限制控制台标识修改；与 Dify 条款不完全相同。按最终产品用途确认，不能一概认定全免费或全收费。[LICENSE](https://github.com/labring/FastGPT/blob/main/LICENSE) |
| [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) | Apache-2.0 | 图片/PDF OCR、文档解析，可部署独立 Python 服务 | 推荐技术验证；中。先用真实手稿/碑文/竖排古籍样本评测，识别结果需人工确认；模型权重与数据集另建清单 |
| [Photo Sphere Viewer](https://github.com/mistic100/Photo-Sphere-Viewer) | MIT | 浏览器 360°全景、热点、漫游；依赖 DOM/WebGL/Three.js 环境 | VR 阶段复用；H5 低、小程序中至高。需准备全景素材、域名与终端适配，先用普通馆藏图文兜底。[使用指南](https://photo-sphere-viewer.js.org/guide/) |
| [Apache ECharts](https://github.com/apache/echarts) | Apache-2.0 | 后台看板、地区/时间维度趋势图 | 后台推荐；低。小程序接入需专门 Canvas 适配层及包体控制，避免全国复杂大图挤占首屏 |
| [echarts-for-weixin](https://github.com/ecomfe/echarts-for-weixin) | BSD-3-Clause（适配库） | 微信 `ec-canvas` 示例与适配组件 | 仅作为适配参考；维护较慢，核对 Canvas 接口与 ECharts 版本，真机验证后才纳入产品。内含 ECharts 的许可应分别保留 |

## 4. 可核实的维护证据

以下通过 GitHub 官方 REST API 读取默认分支最近提交与 latest release；日期为 UTC。`latest release` 只是仓库标记的最新正式发布，并非推荐采用的版本；提交频率不能证明稳定性或安全性。表中项目查询时均未归档，未按 Star 数排序。

| 项目 | 默认分支最近提交（短 SHA / 日期） | latest release（发布日期） | 来源 |
|---|---|---|---|
| RuoYi-Vue-Plus | `de394a0e21f1` / 2026-09-18 | `v6.0.0` / 2026-07-30 | [commits](https://api.github.com/repos/dromara/RuoYi-Vue-Plus/commits?per_page=1)、[release](https://api.github.com/repos/dromara/RuoYi-Vue-Plus/releases/latest) |
| plus-ui | `259325b4eecd` / 2026-09-10 | `v6.0.0-React` / 2026-07-30；不是 Vue 版 | [commits](https://api.github.com/repos/CrazyLionCat/plus-ui/commits?per_page=1)、[release](https://api.github.com/repos/CrazyLionCat/plus-ui/releases/latest) |
| ruoyi-vue-pro | `8e80602b875f` / 2026-09-19 | `v2026.08(jdk25)` / 2026-09-02 | [commits](https://api.github.com/repos/YunaiV/ruoyi-vue-pro/commits?per_page=1)、[release](https://api.github.com/repos/YunaiV/ruoyi-vue-pro/releases/latest) |
| yudao-cloud | `1a1b64beb605` / 2026-09-19 | `v2026.08(jdk25)` / 2026-09-02 | [commits](https://api.github.com/repos/YunaiV/yudao-cloud/commits?per_page=1)、[release](https://api.github.com/repos/YunaiV/yudao-cloud/releases/latest) |
| yudao-mall-uniapp | `3c4bf3864415` / 2026-08-30 | `v2026.08` / 2026-09-14 | [commits](https://api.github.com/repos/yudaocode/yudao-mall-uniapp/commits?per_page=1)、[release](https://api.github.com/repos/yudaocode/yudao-mall-uniapp/releases/latest) |
| WarmFlow | `c083ee8b647c` / 2026-08-07 | 本次未核实发布号 | [commits](https://api.github.com/repos/dromara/warm-flow/commits?per_page=1) |
| Flowable | `c72f39686367` / 2026-09-17 | `flowable-8.0.0` / 2026-02-27 | [commits](https://api.github.com/repos/flowable/flowable-engine/commits?per_page=1)、[release](https://api.github.com/repos/flowable/flowable-engine/releases/latest) |
| Dify | `3a0acfedbb01` / 2026-09-20 | `1.17.1` / 2026-09-10 | [commits](https://api.github.com/repos/langgenius/dify/commits?per_page=1)、[release](https://api.github.com/repos/langgenius/dify/releases/latest) |
| FastGPT | `d87b66548896` / 2026-09-20 | `v4.17.0` / 2026-09-11 | [commits](https://api.github.com/repos/labring/FastGPT/commits?per_page=1)、[release](https://api.github.com/repos/labring/FastGPT/releases/latest) |
| PaddleOCR | `dab3fe353790` / 2026-09-16 | `v3.7.0` / 2026-06-11 | [commits](https://api.github.com/repos/PaddlePaddle/PaddleOCR/commits?per_page=1)、[release](https://api.github.com/repos/PaddlePaddle/PaddleOCR/releases/latest) |
| Photo Sphere Viewer | `51451d59e1d6` / 2026-09-14 | `5.15.1` / 2026-08-02 | [commits](https://api.github.com/repos/mistic100/Photo-Sphere-Viewer/commits?per_page=1)、[release](https://api.github.com/repos/mistic100/Photo-Sphere-Viewer/releases/latest) |
| ECharts | `984bf46b2f90` / 2026-09-12 | `6.1.0` / 2026-05-19 | [commits](https://api.github.com/repos/apache/echarts/commits?per_page=1)、[release](https://api.github.com/repos/apache/echarts/releases/latest) |
| echarts-for-weixin | `82e6cdfe5347` / 2024-03-12 | 本次未核实发布号 | [commits](https://api.github.com/repos/ecomfe/echarts-for-weixin/commits?per_page=1) |

## 5. 整合规则与下一步验证

- 保持一个后台底座、一个权限体系、一个投稿领域模型和一个评审引擎；不把若依与芋道整仓拼合。
- 每个引入项记录来源 URL、tag/完整 commit、原许可证、修改目录、升级方式和责任人；保留上游 remote，通过独立业务模块减少对框架核心的改动。
- 前端先固定业务 DTO 与状态转换，`mock` 与 `http` 适配器使用同一接口；页面不依赖若依/芋道专属返回结构。
- 后台验证先覆盖登录权限、文件上传、一个完整投稿和审核流程，再决定正式 fork；版本以本地构建、回归和部署验证结果为准，不盲目追主分支。
- 对接商城、AI、OCR、VR 时通过接口和作业状态交互；错误、取消、超时必须有界面状态，不将外部服务 SDK 蔓延到页面。
- 本期不宣称已完成容量指标、真实支付、实名认证、六级业务规则、私有模型或省级物理分库；这些均有独立开发与验收工作。
