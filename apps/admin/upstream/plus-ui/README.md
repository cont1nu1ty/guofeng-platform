# plus-ui 组件来源

仓库：https://github.com/CrazyLionCat/plus-ui

固定提交：`259325b4eecd715279b66b70f90eb9a2f741133c`（6.X-Vue）。

本目录的 `Pagination.vue`、`RightToolbar.vue` 为该提交中 `src/components/Pagination/index.vue`、`src/components/RightToolbar/index.vue` 的原始快照，不参与运行构建。原MIT许可证保存在根目录 `licenses/plus-ui.MIT.txt`。

实际适配组件在 `src/components/upstream/`：显式导入Vue与图标，移除上游propTypes/自动导入依赖、持久缓存、未使用列选择与全局滚动；保留分页/事件及搜索工具栏的复用逻辑。来源与两版本SHA256记录于根 `source-lock.json`。

## 本轮真实服务接入

继续固定同一提交，新增原始快照：

- `auth.ts` ← `src/utils/auth.ts`
- `request.ts` ← `src/utils/request.ts`
- `permission-directive.ts` ← `src/directive/permission/index.ts`
- `auth-plugin.ts` ← `src/plugins/auth.ts`
- `user-store.ts` ← `src/store/modules/user.ts`
- `login.vue` ← `src/views/login.vue`

复用边界：`src/utils/auth.ts` 保留 get/set/remove token 结构，改为项目独立的 sessionStorage key；`src/services/session.ts` 复用登录、恢复信息、退出生命周期和权限匹配；`src/services/http.ts` 保留 Bearer/登录失效请求边界，改为原生 fetch、直接业务 DTO 与统一错误码；`src/views/LoginView.vue` 复用 Element Plus 表单验证、登录状态和回车提交流程，保留现有国风视觉。移除与本项目无关的验证码、第三方登录、记住密码、路由菜单生成、Pinia/VueUse 自动导入和原始加密协议。权限仅控制界面可见性，服务端负责真正授权。

许可证仍为根目录 `licenses/plus-ui.MIT.txt`。原始快照不参与构建。
