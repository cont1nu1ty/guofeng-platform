# 家风中华行 · 运营管理界面

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

## 页面与交互

13个页面覆盖11类后台业务：运营工作台、投稿作品、评审中心、专家库、内容资讯、典籍编纂、全国活动、廉政教育、文创公益、用户与权限、AI运维、数据智库、系统设置。

- 稿件：搜索、多条件筛选、分页、批量初审、详情、退回理由校验、专家分配；初审通过不会自动公示。
- 评审：任务列表、匿名阅读样例、分项评分与评语校验、流程配置示意、专家分组与可接单状态。
- 内容：新增/编辑、预览、模拟发布和下架；典籍分卷/章节编辑与排序、入藏样例、阅读预览。
- 活动：新增/编辑、发布/开始/结束、报名名单、示例签到及撤销。
- 运营：示例用户与岗位调整、课程及学习台账、公益申领处理、AI样例日志与词库、系统配置及消息草稿预览。
- 数据：当前会话统计、地区筛选、预设历史趋势、报告预览和明确标为示例的CSV导出。

所有数据都是虚构样例，仅存在于当前会话内存；刷新即恢复。没有HTTP数据加载、localStorage业务持久化、真实登录/权限、文件上传、消息发送、AI推理、工作流引擎、签章或支付。不会读取/修改5173用户端的本地记录。右上角“重置全部示例”带确认，清除本次后台修改。

## 工程与复用

```text
src/domain/               会话状态、样例、校验与动作
src/views/                各后台业务页面
src/components/upstream/  实际复用并裁剪的plus-ui分页与工具栏
src/components/           页面标题、导航、图表封装
src/router.ts             固定演示路由；不是权限校验
src/styles/main.css       后台主题、桌面和手机布局
upstream/plus-ui/          固定版本组件的原始快照
tests/                    关键状态规则测试
```

采用已选plus-ui Vue分支的依赖组合子集，实际裁剪其Pagination和RightToolbar；按钮、表单、弹层、表格、树等使用Element Plus，图表使用ECharts。家风品牌布局及业务页面是本项目代码，**不是完整fork或已经接通RuoYi后端**。保留原始组件快照和MIT许可证；完整来源、修改与哈希见根目录 `source-lock.json` 与 `THIRD_PARTY_NOTICES.md`。复用用户端已有的思源宋体/黑体子集及原许可，后台Vite只额外开放该字体目录用于开发读取。

后续在domain外增加异步service和HTTP适配器，接入同一业务语义；页面不直接依赖若依响应结构。后台是普通Web应用，DOM与浏览器API仅用于此独立H5工程，不作为Uni-app跨端代码。实际演示范围与测试记录见仓库 [后台演示](../../docs/frontend/admin-demo.md)、[后台验证](../../docs/verification/admin-ui.md)。
