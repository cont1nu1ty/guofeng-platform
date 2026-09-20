# 家风中华行 · 前端优先项目起点

根据《小程序制做要求.pdf》（2026-08-13 内部讨论稿）整理。当前目标是**可展示、可操作、可继续开发**的前端原型；本轮已经有可运行源码，而不仅是选型建议。

本地预览运行时访问：**http://localhost:5173/**。用手机宽度查看小程序布局，用桌面宽度用于沟通演示。它是 H5 预览，不是线上发布地址。

## 先看这几份文件

| 文件 | 用途 |
|---|---|
| [需求整理](docs/01-requirements.md) | 10 个用户端模块、11 个后台模块、角色、非功能要求、原文页码与待确认项 |
| [敏捷待办](docs/02-backlog.md) | P0 演示 / P1 业务闭环 / P2 扩展，以及验收条件。待办不代表已实现 |
| [开源复用选型](docs/03-open-source.md) | 已核实的候选、版本与许可、推荐路线、不可直接复用的边界 |
| [架构与替换路径](docs/04-architecture.md) | 当前本机 Mock、未来异步 API、服务端鉴权与租户边界 |
| [演示范围与操作](docs/05-demo-guide.md) | 可演示功能、顺序、已知缺口 |
| [后端开发路线](docs/06-backend-roadmap.md) | 若依 / 芋道、评审、物理分库与私有 AI 的接入顺序 |
| [验证记录](docs/07-validation.md) | 实際执行的构建、测试、浏览器检查及未验证项 |
| [OpenAPI 草案](contracts/openapi.yaml) | 12 条核心路径；设计文件，尚无对应服务 |
| [第三方声明](THIRD_PARTY_NOTICES.md) | 实际复用内容、许可证、素材来源 |

## 本轮实现

- 8 个视图：首页、投稿、典藏、传习、评审查询、个人中心、AI 示例、只读运营概览。
- 8 体裁、4 通道；文字投稿校验；草稿自动保存与恢复；勾选演示须知；提交生成 DEMO- 编号并进入待初审。
- 作品/典籍搜索、地区筛选、阅读弹层、横竖排与大字阅读、收藏与取消。
- 研学样例预约、取消、人数同步、个人记录；编号查询与六级拟定流程。
- 本机持久化；异常存储提示；明确的空结果及尚未实现功能提示。
- 中国红、古金、宣纸米白的响应式界面，复用 Wot UI 基础控件。

所有提交、预约、收藏只存当前设备；无登录、真实审核、AI 推理、支付、证书签发、省级分库或云端同步。首页愿景数字不是运营数据。未接入机构账号或上传文档中的数据到第三方平台。

## 启动与检查

建议 Node.js 22 LTS 或更高的兼容版本（引入底座要求至少 20.19）；本次环境为 Node.js 26.8.2。依赖已在当前机器安装；其他机器用锁文件安装：

```bash
cd apps/miniapp
npm ci
npm run dev:h5
```

```bash
npm run typecheck
npm run format:check
npm test
npm run build:h5
npm run build:mp-weixin
```

H5 构建产物：`apps/miniapp/dist/build/h5`。微信产物：`apps/miniapp/dist/build/mp-weixin`。

### 微信开发者工具预览

在 `apps/miniapp` 目录运行并保持终端开启：

```bash
npm run dev:mp-weixin
```

等待 `Build complete. Watching for changes...` 后，在微信开发者工具中导入 **`apps/miniapp/dist/dev/mp-weixin`**。所选目录内应直接看到 `app.json`、`app.js`、`project.config.json` 和 `pages/`。不要选择 `dist/dev`、`dist` 或 `apps/miniapp` 源码目录；这些目录没有可直接运行的小程序入口。

若只查看一次性构建，运行 `npm run build:mp-weixin` 后导入 **`apps/miniapp/dist/build/mp-weixin`**。开发命令只更新 `dev`，构建命令只更新 `build`。

AppID 的持久配置入口是 `apps/miniapp/src/manifest.json` 中的 `mp-weixin.appid`，不要只修改 `dist` 内的配置（再次编译会覆盖）。已将本机开发者工具项目中填写的 AppID 同步到该入口；需确保当前登录微信账号有该小程序的开发权限。

如果仍为空白：检查「详情 → 本地设置」中的项目目录和小程序目录，再使用普通编译模式、入口 `pages/index/index`，查看「调试器 → Console」第一条红色报错。无需执行「构建 npm」，当前产物已由 Uni-app 打包依赖。不要为此清空存储，以免丢失演示草稿。

已修复全局样式中 H5 专用通配选择器导致的微信 WXSS 编译错误；开发及构建产物的原生样式编译检查通过，用户已确认微信模拟器首页显示。尚未完成微信端全部交互和真机验证。**编译通过不代表满足文档中的微信 2.10.0 兼容要求**；Vue 3/Wot UI 和该旧版本要求需专项评估后明确最低基础库，见选型文档。

## 项目结构

```text
jiafeng-platform/
  apps/miniapp/
    src/components/         按业务拆分的页面视图
    src/composables/        界面状态、导航与存储适配
    src/domain/             DTO、示例数据、纯 TS 仓库和校验
    src/pages/index/        演示壳；后续拆为正式路由与分包
    src/styles/             主题、响应式样式与本地图标字体
    tests/                  13 项业务状态测试
    package-lock.json       可重复安装的精确依赖锁定
  contracts/openapi.yaml    后端接口草案
  docs/                     需求、待办、选型、架构、演示与验证
  licenses/                 已复用项目的原始许可
  source-lock.json          上游提交、实际引入范围与改动记录
```

页面暂用单页壳切换组件，便于快速沟通。它不是完整的小程序导航栈；上线前需分路由/分包、补返回行为、平台无障碍与真机布局验证。图片和 Word/PDF 上传、富文本、语言切换、朗读、重置按钮、专家评分工作台等目前尚未实现，不能按目标 backlog 认定完成。

## 复用与后续开发原则

前端采用 Wot Starter 的工程基础进行裁剪，实际使用 Wot UI 组件，保留 MIT 文本与锁定版本。后端建议先验证 **RuoYi-Vue-Plus + 匹配 plus-ui Vue 分支**；若复杂工作流和商城提前成为核心，可改选芋道配套体系。不要把两套后台整仓拼装在一起。

先确认投稿→审核→公示的一条业务闭环；随后用 `contracts/` 的契约接入服务层。前端 `region` 只用于内容筛选，后台必须从已认证身份确定租户和数据源。省级物理隔离、全国总库同步与私有 AI 都需要独立技术验证和验收，现有模板不会自动解决。
