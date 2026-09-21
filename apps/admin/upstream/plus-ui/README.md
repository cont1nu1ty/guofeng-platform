# plus-ui 组件来源

仓库：https://github.com/CrazyLionCat/plus-ui

固定提交：`259325b4eecd715279b66b70f90eb9a2f741133c`（6.X-Vue）。

本目录的 `Pagination.vue`、`RightToolbar.vue` 为该提交中 `src/components/Pagination/index.vue`、`src/components/RightToolbar/index.vue` 的原始快照，不参与运行构建。原MIT许可证保存在根目录 `licenses/plus-ui.MIT.txt`。

实际适配组件在 `src/components/upstream/`：显式导入Vue与图标，移除上游propTypes/自动导入依赖、持久缓存、未使用列选择与全局滚动；保留分页/事件及搜索工具栏的复用逻辑。来源与两版本SHA256记录于根 `source-lock.json`。
