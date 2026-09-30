# 搜索入口图标修复验证

日期：2026-09-30。范围：用户端三个搜索图标与现有跳转／输入交互。本轮未修改后端、接口、数据库或演示数据。

## 原因与修复

`AppShell.vue`、`SearchView.vue`、`pkg-content/components/NewsView.vue` 使用了 `wd-icon name="search"`。当前锁定的 `@wot-ui/ui 2.3.1` 只提供 `search-line` 对应的字形，因此按钮及点击区域存在，页面却没有显示放大镜。三处改用 `search-line`；首页和典籍页原本使用正确名称，保持不变。

## 实际执行的检查

在 `apps/miniapp` 执行：

| 命令 | 本轮结果 |
| --- | --- |
| `npm run typecheck` | 通过 |
| `npm test` | 18个测试文件、121项测试通过 |
| `VITE_DATA_MODE=http VITE_API_BASE_URL=/api/v1 npm run build:h5` | 通过；保留既有两条字体路径由运行时解析的构建提示 |
| `VITE_DATA_MODE=http VITE_API_BASE_URL=/api/v1 npm run build:mp-weixin` | 通过；主包1,553,433字节，包检查通过 |

`docker compose` 重建 Web 镜像，并对本机 `jiafeng-dev` 仅执行 `up -d --no-deps --wait web`，Web 健康检查通过。此操作未重建数据库、存储、搜索服务或导入演示数据。

在实际 HTTP 地址 `http://127.0.0.1:18080/` 使用浏览器检查：

| 页面／操作 | 桌面1440×900 | 手机尺寸390×844 |
| --- | --- | --- |
| 首页顶部入口 | EN左侧放大镜可见，点击进入独立全站搜索页 | 同样可见且可点击，没有被地区／语言按钮遮挡 |
| 全站搜索页 | 输入框放大镜可见；输入关键词后显示服务端筛选结果及分类数量 | 图标可见、输入及结果更新正常，分类换行，无页面横向溢出 |
| 资讯页筛选 | 放大镜可见，输入框及筛选空态布局正常，无页面横向溢出 | 输入关键词后列表筛选正常，放大镜可见，无页面横向溢出 |

截图仅保留入口所在页头：[桌面](previews/search-icons-2026-09-30/desktop-header.png)、[手机尺寸](previews/search-icons-2026-09-30/mobile-header.png)。验证后已恢复浏览器原视口设置。

## 验证边界

手机尺寸检查在桌面浏览器内执行，不是手机硬件或微信真机证据。微信本轮只验证编译及包检查。未重复执行 Elasticsearch 权限／重建／故障矩阵，原验证仍见[个人记录与搜索](records-search-2026-09-27.md)。本轮没有新增依赖或变更开源版本。
