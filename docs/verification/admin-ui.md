# 后台界面验证记录

独立后台 Web 的验证按日期与数据模式记录。后台手机宽度检查不能代替微信小程序真机证据。

## 2026-09-26 · HTTP 接入与真实服务联调

保留 13 页界面并接通 `/api/v1`。HTTP 模式清空设备示例，加载真实工作空间；令牌、会话失效、权限可见性、加载/空态/错误重试、实体版本与幂等键集中在适配层。演示模式继续独立运行。

### 自动检查

- `npm --prefix apps/admin run typecheck`：通过。
- `npm --prefix apps/admin test`：3 个文件、22 项通过，包含原有 8 项领域规则、9 项 HTTP 边界测试及 5 项地区映射/授权测试。
- `VITE_DATA_MODE=http npm --prefix apps/admin run build`：通过。Element Plus / 图表包仍较大；本轮未声称已完成性能容量验收。
- HTTP 边界测试覆盖空工作空间不回落样例、Bearer 与实体 `lockVersion`、服务端实体就地更新、失败写入不更改界面数据、401 清理会话并关闭权限、非 JSON 错误响应、结果不确定时复用幂等键、阻止重复在途命令、同稿件有效任务的分配资格、区域账号登录默认地区及写入后保留筛选。

### 合同 fixture 浏览器检查（不是真实后端证据）

使用拦截的接口 DTO 驱动 HTTP 模式，在 Chromium 检查 13 路由 × 1440/390 宽度，共 26 组：无页面横向溢出，页面异常为空；空业务库没有预置内容，历史趋势为空态。409 版本冲突保留编辑弹层与原有记录，重试成功后关闭并更新；专家菜单与配置入口受限，HTTP 流程配置的匿名评审开关锁定开启。

可复跑脚本：`apps/admin/tests/http-browser.cjs`。证据：[检查 JSON](previews/backend-2026-09-26/admin-http-fixture-checks.json)、[桌面内容](previews/backend-2026-09-26/admin-http-content-desktop.png)、[手机新增文创](previews/backend-2026-09-26/admin-http-product-mobile.png)。

### 最终分配资格与地区修正

专家库的 HTTP 候选稿件按整篇稿件的有效待评分任务排除：任意专家仍在处理则不可选；已完成、已取消、到期（包含精确截止时刻）后可以再选。每次打开分配弹层重取当前时刻，demo 保留历史任务去重规则；真正的当前流程节点由服务端校验。

HTTP 地区映射逐项对照后端 `Jf.REGION_IDS/REGION_NAMES`，覆盖 34 个省级地区、海外及全国；内容/活动/用户筛选复用同一目录，demo 保留原五省。全国管理员统计列出 35 地区；区域运营只显示其 `regionIds` 对应地区，不补未授权零值。登录默认选择首个有效授权地区，后续写入不覆盖用户手选筛选。

最新源码再次通过类型检查、22 项测试和 HTTP 构建，执行 `./deploy/dev build web` 并仅更新此项目的 web 容器，网页资源与本地最终构建一致；该操作没有重启 server（root 后续独立更新 server）。[部署记录](previews/backend-2026-09-26/admin-web-refresh.json)。

针对最终 Nginx 包的限定 fixture 检查通过：完成/取消/过期三个稿件可选，当前或另一专家仍在处理的两个稿件不可选；全国统计 35 行，浙江区域账号仅 1 行；新增资讯与活动均默认浙江，390px 无横向溢出、页面异常为空。证据：[边界 JSON](previews/backend-2026-09-26/admin-assignment-region-fixture.json)、[专家分配截图](previews/backend-2026-09-26/admin-assignment-desktop.png)、[区域统计手机截图](previews/backend-2026-09-26/admin-region-mobile.png)，截图已目视检查。这是受控 fixture，不冒充真实任务推进。

同时以真实 `region_zj` 账号首次登录最终容器入口，未手动改地区即保存一份浙江资讯草稿，响应 200，刷新后仍存在，页面异常为空：[真实区域默认保存](previews/backend-2026-09-26/admin-regional-default-live.json)。此检查只创建带“联调验证”前缀的开发草稿，没有发布。

### 初次统一构建的真实服务浏览器联调

先以 `http://127.0.0.1:5175/admin/` 联调最新源码，再在统一构建、重复启动与全栈重启后，对最终 Nginx 入口 `http://127.0.0.1:18080/admin/` 完整复跑。两轮均请求实际 Docker 服务（数据库迁移版本 2），没有接口拦截。以本机开发账号执行：

- 全国管理员登录；新增资讯、发布、刷新后记录保留。
- 新建活动并发布；新增文创资源、下架、重新上架；对应 7 次业务命令均返回 200。
- 通过 multipart 上传中文名 PNG，S3 保存成功后登记知识资料（第 8 次业务命令返回 200）；界面明确“未索引 / 模型不可用”。
- 匿名读取用户端工作空间，验证已发布资讯、活动和产品均可见。
- 从账号菜单真实退出后登录专家；评审页可见，内容菜单与流程配置按钮隐藏，直接访问内容路由被阻止。
- 390px 专家评审页面没有横向溢出，整个实联期间 `pageerror` 为空。桌面 AI 页与手机评审页截图已目视检查。

该次 Nginx 复跑证据：[检查 JSON](previews/backend-2026-09-26/admin-nginx-checks.json)、[桌面资料管理](previews/backend-2026-09-26/admin-nginx-ai-desktop.png)、[手机专家评审](previews/backend-2026-09-26/admin-nginx-expert-mobile.png)。同样 8 次命令均为 200，公开读取和专家权限通过，无页面异常或手机横向溢出；两张截图已目视检查。

此前源码联调证据：[真实联调 JSON](previews/backend-2026-09-26/admin-live-checks.json)、[桌面资料管理](previews/backend-2026-09-26/admin-live-ai-desktop.png)、[手机专家评审](previews/backend-2026-09-26/admin-live-expert-mobile.png)。复跑入口为 `apps/admin/tests/http-live.cjs`；从仓库根运行，读取本地 `deploy/.env`，报告不记录密码或令牌，创建带“联调验证”前缀的开发记录。可以用 `ADMIN_LIVE_URL` 改为容器入口复跑。

以上真实记录证明对应浏览器操作、服务响应和跨端公开读取，不将 fixture 权限检查替代服务端权限矩阵，最终 Nginx 包的复验另有上述独立记录。完整后端事务、隔离、签名过期、备份恢复与投稿评审链路见本轮后端验证记录。未取得微信真机证据；模型推理、正式签章、支付物流、公网 HTTPS 与全国容量未验收。

## 2026-09-21 · 后台界面 v0.1（历史演示模式）

按用户本轮优先级新增独立 `apps/admin`，预览端口5174。13个页面覆盖11类后台需求；示例状态只在内存中保留，刷新恢复，未接入真实数据服务或持久化。

- 后台 `npm run typecheck`、`npm test`、`npm run build` 全部通过。8项领域测试覆盖退回理由、初审、分配专家、评分校验与完成保护等关键状态规则。
- Chromium实际检查13个路由 × 1440/390两种宽度，共26组，均无页面横向溢出、页面异常、控制台警告或失败请求；未观察到外部网络请求。桌面与手机工作台、内容列表及审核弹层另经截图目视检查。
- 审核链路实测：空退回理由阻止提交、初审通过、分配专家、空评语阻止评分、完成后锁定；批量初审、专家分组/接单状态修改、390px退回/评分/流程示意配置均可操作。六级配置仅为前端讨论界面。
- 内容与运营实测：内容新增/编辑/发布/下架；典籍章节编辑、排序与加入样例；活动表单校验、发布及签到；用户岗位调整、公益示例发放、课程必填校验/新增、词条新增、设置保存及通知草稿预览。所有状态变化仅在当前后台会话内。
- 跨页面实测：功能搜索定位页面；初审后工作台待初审数6变5；浙江省筛选显示3篇样例；报告预览与实际CSV下载包含示例标记；取消重置保留修改、确认重置恢复全国14篇/6篇待初审；手机抽屉导航跳转后收起。检查上下文的localStorage/sessionStorage均为0。
- 原用户端按项目要求执行 `npm run typecheck`、`npm test`、`npm run build:h5`、`npm run build:mp-weixin`，全部通过，80项测试通过。H5仍有两条已知字体路径运行时解析提示；微信正式主包1,873,552 bytes，距2MiB剩余223,600 bytes，内联字体无重复文件。本轮没有新增用户端真机验收。

证据：[页面检查](previews/admin-browser-checks.json)、[跨页面交互检查](previews/admin-shell-checks.json)、[桌面工作台](previews/admin-desktop-overview.png)、[手机工作台](previews/admin-mobile-overview.png)；更多内容和审核截图见 `previews/admin-content-*.png`、`previews/admin-review-*.png`。开源组件原始快照、适配后哈希和许可证登记于 `source-lock.json`、`THIRD_PARTY_NOTICES.md`。

这些结果验证后台Web界面的可操作性，不代表真实鉴权、权限隔离、消息发送、工作流、AI服务、文件存储或用户端数据同步已经接通。

2026-09-26 首页与目录增量：内容页七个工作页签、28项单测、真实保存/发布/下架与私有媒体预览，以及1440/390页面检查见[本轮记录](catalog-2026-09-26.md)。
