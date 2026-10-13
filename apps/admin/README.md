# 家风中华行 · 运营管理界面

当前支持独立演示与真实 HTTP 两种数据模式；真实部署入口为 `/admin/`，配置见本文后半部。

版本：0.1.0。独立Vue3/TypeScript/Element Plus后台前端，H5开发预览端口 **5174**；用户端继续使用5173。

```bash
cd apps/admin
npm ci
npm run dev
```

打开 http://localhost:5174/ 。构建与规则检查：

```bash
npm run typecheck
npm test
npm run build
```

## 演示模式页面与交互

13个页面覆盖11类后台业务：运营工作台、投稿作品、评审中心、专家库、内容资讯、典籍编纂、全国活动、廉政教育、文创公益、用户与权限、AI运维、数据智库、系统设置。

- 稿件：搜索、多条件筛选、分页、批量初审、详情、退回理由校验、专家分配；初审通过不会自动公示。
- 评审：任务列表、匿名阅读样例、分项评分与评语校验、流程配置示意、专家分组与可接单状态。
- 内容：新增/编辑、预览、模拟发布和下架；典籍分卷/章节编辑与排序、入藏样例、阅读预览。
- 活动：新增/编辑、发布/开始/结束、报名名单、示例签到及撤销。
- 运营：示例用户与岗位调整、课程及学习台账、公益申领处理、AI样例日志与词库、系统配置及消息草稿预览。
- 数据：当前会话统计、地区筛选、预设历史趋势、报告预览和明确标为示例的CSV导出。

以上描述适用于 `VITE_DATA_MODE=demo`：数据为虚构样例，仅存在当前会话内存；刷新即恢复，不调用后端或读取5173用户端的本地记录。右上角“重置全部示例”清除本次后台修改。真实模式按下文接入登录、业务接口和存储。HTTP模式的AI推理/资料索引/审核辅助已在2026-10-13增量接通，见[AI说明](../../docs/engineering/ai-applications.md)；正式签章和支付仍未接入。

## 工程与复用

```text
src/domain/               共享界面状态、演示样例、校验与本地动作
src/services/             HTTP/演示动作适配、会话、文件与错误边界
src/views/                各后台业务页面
src/components/upstream/  实际复用并裁剪的plus-ui分页与工具栏
src/components/           页面标题、导航、图表封装
src/router.ts             固定页面路由；真实授权由服务端验证
src/styles/main.css       后台主题、桌面和手机布局
upstream/plus-ui/          固定版本组件的原始快照
tests/                    关键状态规则测试
```

采用已选plus-ui Vue分支的依赖组合子集，实际裁剪其Pagination和RightToolbar；按钮、表单、弹层、表格、树等使用Element Plus，图表使用ECharts。家风品牌布局及业务页面是本项目代码，不是完整 fork。真实模式通过家风业务接口接入若依服务，登录、请求和权限逻辑按同一锁定来源适配。保留原始组件快照和MIT许可证；完整来源、修改与哈希见根目录 `source-lock.json` 与 `THIRD_PARTY_NOTICES.md`。复用用户端已有的思源宋体/黑体子集及原许可，后台Vite只额外开放该字体目录用于开发读取。

当前在 domain 外增加异步 service 和 HTTP 适配器，接入同一业务语义；页面不直接依赖若依响应结构。后台是普通Web应用，DOM与浏览器API仅用于此独立H5工程，不作为Uni-app跨端代码。实际演示范围与测试记录见仓库 [后台演示](../../docs/frontend/admin-demo.md)、[后台验证](../../docs/verification/admin-ui.md)。

## 真实服务模式

Compose 的后台构建使用 `VITE_DATA_MODE=http`，入口 `/admin/`，通过同源 `/api/v1` 读取业务接口。独立联调可运行：

```bash
VITE_DATA_MODE=http VITE_BASE_URL=/ npm run dev
```

Vite 将 `/api` 代理至 `http://127.0.0.1:18080`；可用 `VITE_API_PROXY` 修改。前端只读取服务端返回的授权数据，菜单与操作按钮按 `permissions` 控制；服务端继续验证账号、地区、归属、任务与版本。登录令牌保存在项目独立的会话存储中，业务数据不写浏览器存储。

- 13 页读取 `/admin/workspace`，写操作通过 `/admin/commands`；命令适配集中于 `src/services/`，页面不依赖若依原生响应包装。
- 写入成功才更新界面。请求失败保留编辑内容并显示错误和请求编号；登录失效返回登录页；真实模式不会回退样例数据。
- 空库可创建内容、分卷、活动、课程、文创资源、知识资料和通知草稿。投稿来自用户端；运营可初审、准备脱敏材料、分配专家、确认结果和发布。评分不会自动发布。
- 知识资料经后端上传私有 S3 桶；上传不等于建立检索索引。模型未接入时显示不可用和空调用记录。
- `VITE_DATA_MODE=demo` 保留内存演示；刷新重置。设备演示数据不会自动导入服务端。

`tests/http.test.ts` 检查真实模式的数据与权限边界；浏览器合同 fixture 测试只能证明界面适配，真实服务联调结果另由项目验证记录维护。


可选浏览器验收需要本机 Playwright 和 Chromium，分别用 `PLAYWRIGHT_MODULE` / `CHROMIUM_PATH` 指定路径。以下脚本从仓库根运行：

- `node apps/admin/tests/http-browser.cjs`：合同 fixture，默认访问 `http://127.0.0.1:5175/admin/`，可用 `ADMIN_TEST_URL` 修改；不调用真实业务服务。
- `ADMIN_LIVE_URL=http://127.0.0.1:18080/admin/ node apps/admin/tests/http-live.cjs`：真实服务联调，从 `deploy/.env` 读取开发密码，可用 `DEPLOY_ENV_FILE` 指定配置；新增带“联调验证”前缀的开发数据，不自动清除记录。

两者可用 `ADMIN_TEST_OUTPUT` 指定截图和 JSON 输出目录。实际执行日期、数据模式和边界见仓库验证记录；脚本存在不代表已在所有目标环境运行。

本轮首页与内容目录增量：六类Banner、可配置首页栏目/数据库统计、媒体上传审核与私有S3播放、阵地/人物目录、账号资讯订阅与即时站内消息、人工咨询已接通。实际边界和操作见 [目录管理](../../docs/frontend/catalog-management.md)。媒体样片仍为原创模拟内容；真实转码与直播未由此完成；AI增量见上述专题。
