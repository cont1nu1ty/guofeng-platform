# 开源后台选型决策

> 2026-09-26 实施纠正：本轮实际采用版本、许可和部署结果见根 source-lock.json 与 [后端实现](../../docs/engineering/backend-implementation.md)。所选 RuoYi-Vue-Plus 提交没有现成租户模块，地区权限由家风业务实现；下文历史候选不等于已安装能力。

核查日期：2026-09-21。决策状态：**推荐RuoYi-Vue-Plus体系进入R0验证，未完成运行兼容性验收**。已核查官方源码、许可、构建文件、发行记录与功能边界；没有将宣传的节省比例或Star数作为选型依据。

后续实现进展：用户优先要求后台界面，已在 `apps/admin` 完成13页演示，使用选定Vue分支的依赖子集及两个裁剪组件；实际复用见根目录 `source-lock.json` 的 `adminFrontend`。本页保留服务端选型依据，Java后端与WarmFlow运行验证仍待后续开展。

## 1. 推荐组合与原因

**主后台：RuoYi-Vue-Plus + 配套plus-ui的Vue分支；评审编排：其已有WarmFlow集成；用户端：现有Uni-app/Wot UI。** 系统账号、组织、角色、字典、文件、日志、调度和CRUD页面优先复用。主业务以一个Spring Boot模块化应用启动，家风功能置于独立模块。

判断依据是当前先完成投稿、评审和发布，这些业务在候选中都需要定制；Plus现有基础设施与任务管理已经足够开展验证，采用整套商城或低代码平台暂不能消除家风领域开发。后续若复杂BPMN或完整交易成为近期主线，可在R0决策点整体改选芋道，避免业务规模扩大后同时维护两套身份与流程。

| 候选 | 能直接进入复用验证的内容 | 额外工作与使用边界 | 决策 |
| --- | --- | --- | --- |
| [RuoYi-Vue-Plus](https://github.com/dromara/RuoYi-Vue-Plus) + [plus-ui Vue](https://github.com/CrazyLionCat/plus-ui/tree/6.X-Vue) | 用户/部门/岗位/角色/菜单、数据权限、租户/客户端、字典、文件、日志、调度、代码生成、WarmFlow集成 | 家风会员、投稿版本、盲审/评分/回避、公示/典藏/活动需开发；区域物理隔离需专项建设 | **主方案**；公开基础模块与本轮业务匹配，先做兼容性PoC |
| [ruoyi-vue-pro](https://github.com/YunaiV/ruoyi-vue-pro) + [yudao-ui-admin-vue3](https://github.com/yudaocode/yudao-ui-admin-vue3) | 系统/基础设施、Flowable、会员、微信、支付、商城等已有模块 | 模块较多，需裁剪；部分配套SQL有单独使用条件；当前调查分支存在流程依赖兼容疑点 | **整体备选**；近期必须上复杂BPMN/商城且愿意承担资料与整合成本时重选 |
| [JeecgBoot](https://github.com/jeecgboot/JeecgBoot) | 组织/权限、生成器、导入导出、报表、Online运行能力 | 流程设计/审批/监控、表单设计器、部分Online源码在官方版本对比中列为商业差异；家风业务仍需写 | 不作默认方案；以已取得授权的低代码能力为核心时另评估 |
| [yudao-cloud](https://github.com/YunaiV/yudao-cloud) | 芋道生态的服务化拆分 | 增加服务治理、部署、观测与一致性工作；不能替代省级数据治理 | 不在首期引入；实际独立发布/扩容需求形成后再评估 |

能力依据：[Plus官方说明](https://github.com/dromara/RuoYi-Vue-Plus/blob/6.X/README.md)、[芋道官方说明](https://github.com/YunaiV/ruoyi-vue-pro/blob/master/README.md)、[Jeecg官方版本清单](https://help.jeecg.com/java/)。上表的成本与优先级是针对本项目的判断，不是实测开发量或通用排名。

## 2. 许可证与获取边界

- **Plus与配套Vue前端：MIT。** 实际引入时保留原始版权和许可；附带依赖与素材分别登记。[后端LICENSE](https://github.com/dromara/RuoYi-Vue-Plus/blob/6.X/LICENSE)、[前端LICENSE](https://github.com/CrazyLionCat/plus-ui/blob/6.X-Vue/LICENSE)。
- **芋道后端与Vue3管理端：代码MIT；配套资料不能一概视作无条件免费。** 官方BPM、会员、商城开启说明对下载SQL规定芋道星球成员使用条件；公共基础SQL未包含调查所需的相应业务建表集。可取得相应资料授权，或依据公开代码自行编写迁移，但后者有明确工程成本。[代码LICENSE](https://github.com/YunaiV/ruoyi-vue-pro/blob/master/LICENSE)、[BPM开启](https://doc.iocoder.cn/bpm/)、[会员开启](https://doc.iocoder.cn/member/build/)、[商城开启](https://doc.iocoder.cn/mall/build/)、[公共SQL](https://github.com/YunaiV/ruoyi-vue-pro/blob/master/sql/mysql/ruoyi-vue-pro.sql)。
- **JeecgBoot顶层Apache-2.0不覆盖“演示中一切能力均提供免费源码”的推断。** Online组件和流程相关能力逐项看版本与实际包的条款；官方源码获取和商业版说明应与主仓库LICENSE一起记录。[LICENSE](https://github.com/jeecgboot/JeecgBoot/blob/main/LICENSE)、[版本对比](https://help.jeecg.com/java/)、[商业服务说明](https://sn.jeecg.com/vip)。

本页所述调查阶段只做选型，未下载需购买的材料、未开通付费服务。实际部署清单还必须包括数据库、缓存、搜索、文件服务、字体、模型、容器镜像和传递依赖；主仓库许可不能覆盖整套部署。

## 3. 版本与维护证据

下表是查验时快照，日期为UTC。主后台候选及配套前端查询时均未归档。最近提交和发行记录用于判断可获取版本，不证明安全性、稳定性或本项目兼容性。完整SHA与链接在 [候选快照](upstream-candidates.json)。

| 仓库 / 查验分支 | 最近提交 / 日期 | latest release | 采用注意 |
| --- | --- | --- | --- |
| Plus / `6.X` | `de394a0e21f1` / 2026-09-18 | `v6.0.0` / 2026-07-30 | POM为Java21、Boot4.1.0、WarmFlow1.8.9；先验证依赖与部署环境 |
| plus-ui / `6.X-Vue` | `259325b4eecd` / 2026-09-10 | `v6.0.0-React` / 2026-07-30 | latest是React，不能用来锁本项目Vue端；该Vue分支packageManager为pnpm10.34.5 |
| 芋道 / `master` | `8e80602b875f` / 2026-09-19 | `v2026.08(jdk25)` / 2026-09-02 | 默认master、JDK17分支、JDK25发行口径不同，须选一条完整兼容路线 |
| 芋道Vue3 / `master` | `aab14fb0e747` / 2026-09-05 | `v2026.08` / 2026-09-14 | 独立于Uni-app安装锁文件；Node要求至少20.19 |
| Jeecg / `main` | `8149187635c8` / 2026-09-17 | `v3.9.5` / 2026-08-27 | POM为Java17/Boot4.1.0；以固定提交实际构建为准 |

证据读取为各仓库官方REST `commits`/`releases/latest`/`license`及固定提交的POM/package.json，不采用搜索摘要推定版本。主方案构建文件：[Plus POM](https://github.com/dromara/RuoYi-Vue-Plus/blob/de394a0e21f1e0648ef229d027c3a927d98200a2/pom.xml)、[Vue package.json](https://github.com/CrazyLionCat/plus-ui/blob/259325b4eecd715279b66b70f90eb9a2f741133c/package.json)。

**版本选择闸口：** R0先验证上表Plus 6.X/Vue组合，记录Java、Node、pnpm、数据库/缓存的实际版本和构建结果。若存在Boot4兼容阻碍，可验证Plus 5.X（查验POM为Java17/Boot3.5.16/WarmFlow1.8.9），前端也必须使用配套5.X。5.X不是未经验证的“更稳定”承诺，不能混配两代模块。

**芋道流程兼容阻断：** 本次读取 `master-jdk17` 的BOM包含Boot3.5.15和Flowable8.0.0；Flowable8官方明确要求Spring7/Boot4且不再支持Boot3。根POM与server POM默认注释BPM，BPM模块未覆盖该版本，默认系统构建不能证明流程兼容。此固定提交暂不作为可直接启动的评审底座；须选上游匹配分支/tag并启用BPM完成验证，不能只改一个版本号就认定解决。[芋道固定提交BOM](https://github.com/YunaiV/ruoyi-vue-pro/blob/7cab3a7241d1342728087b949d83c87edb9193d9/yudao-dependencies/pom.xml)、[server POM](https://github.com/YunaiV/ruoyi-vue-pro/blob/7cab3a7241d1342728087b949d83c87edb9193d9/yudao-server/pom.xml)、[Flowable8破坏性变更](https://github.com/flowable/flowable-engine/releases/tag/flowable-8.0.0)。

### 已查验的复用落点

以下路径来自上述固定的Plus 6.X与Vue提交，便于下一轮直接开始；不是本仓库已导入目录。

| 能力 | 后端路径 | 管理端路径 |
| --- | --- | --- |
| 用户、角色、组织、文件 | `ruoyi-modules/ruoyi-system/` | `src/views/system/user/`、`role/`、`dept/`、`oss/` |
| 权限、数据访问、文件与日志封装 | `ruoyi-common/` 下的satoken、security、mybatis、oss、log模块 | `src/store/modules/permission.ts`、`src/utils/request.ts` |
| 流程定义、实例、待办 | `ruoyi-modules/ruoyi-workflow/` | `src/views/workflow/processDefinition/`、`processInstance/`、`task/taskWaiting.vue` |
| 代码生成 / 任务 | `ruoyi-modules/ruoyi-gen/`、`ruoyi-job/` | `src/views/tool/gen/`；任务页本次未独立查验 |
| 基础与流程SQL | `script/sql/ry_vue.sql`、`ry_workflow.sql`；任务有`ry_job.sql` | 流程菜单component对应上述Vue页面 |

注意6.X生成器为`ruoyi-gen`，不要套用旧分支路径。`ruoyi-admin/pom.xml`默认还引入AI、MCP和demo模块，R0须按依赖与配置裁剪；选择Plus不代表默认工程已是最小运行组合。工作流POM采用`warm-flow-mybatis-plus-sb4-starter`，方向与Boot4匹配，仍须实际运行验证。[模块POM](https://github.com/dromara/RuoYi-Vue-Plus/blob/de394a0e21f1e0648ef229d027c3a927d98200a2/ruoyi-modules/pom.xml)、[入口POM](https://github.com/dromara/RuoYi-Vue-Plus/blob/de394a0e21f1e0648ef229d027c3a927d98200a2/ruoyi-admin/pom.xml)、[流程POM](https://github.com/dromara/RuoYi-Vue-Plus/blob/de394a0e21f1e0648ef229d027c3a927d98200a2/ruoyi-modules/ruoyi-workflow/pom.xml)。

## 4. 专项组件只按需求启用

| 能力 / 时机 | 推荐验证项 | 复用内容与边界 | 官方证据 |
| --- | --- | --- | --- |
| 评审 / R0–R2 | **WarmFlow，跟随Plus依赖1.8.9**，Apache-2.0 | 复用已有编排与管理页；专家量表/盲审/回避/决定由业务实现。GitHub latest release不一定对应Maven当前版本，不另追latest | [上游](https://github.com/dromara/warm-flow)、[Plus流程模块](https://github.com/dromara/RuoYi-Vue-Plus/tree/6.X/ruoyi-modules/ruoyi-workflow) |
| 复杂BPMN备选 | **Flowable**，Apache-2.0 | 若整体改选芋道，复用其现有集成并先解决版本兼容。引擎不等同全部商业设计/运维产品；不与WarmFlow同时承载同一评审 | [引擎](https://github.com/flowable/flowable-engine)、[8.0.0说明](https://github.com/flowable/flowable-engine/releases/tag/flowable-8.0.0) |
| 微信 / R1 | **WxJava小程序模块**，Apache-2.0 | 只接`weixin-java-miniapp`需要的能力；code交换、微信调用由后端完成，平台账号/区域授权独立；版本跟底座依赖验证 | [v4.8.0](https://github.com/binarywang/WxJava/tree/v4.8.0) |
| 文件 / R0–R1 | **底座文件抽象 + 私有S3存储；自建候选SeaweedFS**，Apache-2.0 | 业务存fileId；先验上传/短期下载/大小类型/权限/备份。SeaweedFS 4.47支持S3，但未完成与所选JavaSDK验证 | [SeaweedFS](https://github.com/seaweedfs/seaweedfs/tree/4.47) |
| OCR / R4 | **PaddleOCR**，Apache-2.0 | Python独立服务处理图片/PDF，保留原件与人工校对；真实手稿、竖排古籍、碑文须分别评测；权重许可另登记 | [v3.7.0](https://github.com/PaddlePaddle/PaddleOCR/tree/v3.7.0)、[服务化](https://paddlepaddle.github.io/PaddleOCR/latest/en/version3.x/inference_deployment/serving/serving.html) |
| 私有知识问答 / R4 | **RAGFlow**，Apache-2.0（主项目） | 解析、分块、引用与HTTP API适合典籍问答；本地模型另部署，主后台做授权、配额、审计；不是首期依赖 | [v0.27.2](https://github.com/infiniflow/ragflow/tree/v0.27.2)、[本地模型](https://ragflow.io/docs/deploy_local_llm) |
| 编纂/证书 / R3–R4 | **Apache POI / PDFBox**，Apache-2.0 | Word模板与PDF处理，先用现有Excel能力；不是出版排版、版权签章或证书验真系统；中文字体/竖排单测样稿 | [POI](https://poi.apache.org/)、[PDFBox](https://pdfbox.apache.org/) |
| 看板 / R2起 | **管理端已有ECharts能力**，Apache-2.0 | 复用图表组件，开发真实指标/授权聚合；不额外安装BI平台，不拿示例统计上线 | [ECharts](https://github.com/apache/echarts) |

**不沿旧教程默认安装MinIO：** 官方仓库已于2026-04-25归档，并标为不再维护；代码许可为AGPL-3.0。原有S3客户端与文件业务接口可以保留，服务端重新评估维护和部署方案。[MinIO官方仓库](https://github.com/minio/minio)。

**AI备选差异：**

- [Dify 1.17.1](https://github.com/langgenius/dify/blob/1.17.1/LICENSE) 是带附加条件的Apache派生许可，对其定义的多租户环境和前端标识有条件；不可默认把各省分别建workspace理解为无条件免费。只有许可与部署边界匹配时再选。
- [MaxKB v2.10.6-lts](https://github.com/1Panel-dev/MaxKB/tree/v2.10.6-lts) 为GPL-3.0；[官方版本比较](https://maxkb.cn/price/)中社区版为单租户，用户/组知识权限、RBAC、系统操作日志等列付费档。不能按产品总介绍推定社区版含全国机构权限；“开放API”与应用聊天调用也应区分。
- RAGFlow本身Apache-2.0不代表整套部署均为此许可。v0.27.2的Compose存储服务名虽为`minio`，实际镜像为`pgsty/silo`，该fork仍为AGPL-3.0；另有数据库、缓存、搜索等依赖。更换组件同样要实际兼容验证。[固定Compose](https://github.com/infiniflow/ragflow/blob/v0.27.2/docker/docker-compose-base.yml)、[Silo许可](https://github.com/pgsty/silo/blob/main/LICENSE)。

AI阶段先验一个知识问答和OCR场景：内网解析、embedding、reranker、LLM与审查均本地运行，镜像/权重提前取得，禁用出网插件及外部模型，断网执行完整任务并检查检索授权。RAGFlow官方最低4核/16GB/50GB只是平台起步条件，不包含本项目模型效果或吞吐承诺；具体模型权重、推理软件与硬件另立清单。

## 5. 复用的边界与切换条件

可优先整合的是系统基础能力与通用界面；真正的作品版本、评审规则、匿名材料、公益额度、典籍编校以及区域治理需在家风模块中开发。因此不承诺“开源覆盖百分之多少”或“几周完成全平台”。

原文的省级物理分库仍需专门实现。Plus 多数据源可作为基础工具，但所选提交没有可直接使用的租户模块；芋道默认租户拦截器也是行级机制。芋道有数据库隔离文章，但快速体验涉及旧分支和SQL时效提示，不能据此认定当前默认部署已满足全国分库、总库同步与恢复要求。[芋道默认实现](https://github.com/YunaiV/ruoyi-vue-pro/blob/master/yudao-framework/yudao-spring-boot-starter-biz-tenant/src/main/java/cn/iocoder/yudao/framework/tenant/core/db/TenantDatabaseInterceptor.java)、[数据库隔离说明](https://doc.iocoder.cn/saas-tenant/dynamic/)。

R0的选择成立条件：公开源码/脚本足以启动；前后端版本匹配；权限、文件、流程满足试点路径；家风模块能独立开发升级。若失败，先记录具体缺口再整体比较备选。近期必须上完整交易、标准BPMN或运营低代码设计时重新计算总成本，不因模块名字相似就复制另一框架代码。

下一步任务已经列入 [整合与迭代计划](delivery-plan.md)，无需继续漫无边际地筛选更多后台模板。
