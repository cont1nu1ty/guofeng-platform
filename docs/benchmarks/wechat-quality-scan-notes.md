# 微信开发者工具代码质量扫描口径

2026-09-21 对本机 `/opt/wechat-devtools/package.nw/core.wxvpkg` 做只读源码检查，并读取当前正式构建项目的本地扫描缓存。没有调用内部运行时 API，也没有上传或请求预览。

## 体积阈值与统计对象

- `PACKAGE_SIZE_LIMIT` 本次规则的 `limit` 为 `1.5`，阈值实际为 **1,572,864 B（1.5 MiB）**，不是 1,500,000 B。实现使用大于判断，等于阈值通过。
- 扫描使用开发者工具编译后的 `compiledPkg`，按主包和声明的分包目录分组，累计各文件的 Buffer 字节数，只排除 `.js.map`。该实现检查各组，尽管界面名称为“主包大小”。
- 扫描请求 `resultType: dev`，编译结果还可能补入 `project.config.json`。它与磁盘逐文件加总、压缩包大小、上传包大小不是同一口径。
- “详情 → 基本信息 → 本地代码”的数值来自 `getMPFileInfo()`；可辅助比较，不能直接当作质量扫描的精确字节数。质量面板本身没有显示该规则的明细字节数。

## 本次保存的实际结果

项目为 `apps/miniapp/dist/build/mp-weixin`。本地项目缓存的 `codeQuality.lastScanTime` 为 `1789966945964`，即 **2026-09-21 13:02:25.964（UTC+8）**；`scanning: false`，`PACKAGE_SIZE_LIMIT.success: false`。

| 分组 | 扫描字节数 | 对比 1.5 MiB 阈值 |
| --- | ---: | --- |
| 主包 `__APP__` | 1,783,675 B | 超出 210,811 B |
| 分包 `pkg-content/` | 725,555 B | 低于阈值 |

因此，最终六模块迁移后的磁盘主包统计为 1,547,176 B 不能证明此质量项通过，应以对应版本的实际扫描结果为准。

## 本机证据定位

源码模块位于上述 `core.wxvpkg` 索引归档内，仅提取阅读，未执行：

- `00c118911cdeaeac6c199c6c0d5eaf98.js`：`checkPackageSizeLimit` 的阈值、加总、结果明细及扫描完成后的状态保存。
- `2dd43f7d1f89a60a9b13daa628e5cdd6.js`：`getPackagesInfo` 分组。
- `539421ffe5f210b96f9cc163bd317685.js`、`89ffdd01b12d81a806d8ec09f5156166.js`、`96e2c678762ca81d19246b2ba1cdbc0d.js`：界面重扫到开发模式编译结果的调用路径。
- `e90b7cb007787228bc8fe5535731b603.js`：项目记录以 `project2_<项目绝对路径>` 为键，MD5 作为文件名的一部分，存入 `WeappLocalData/localstorage_<MD5>.json`。

本次仅读取精确匹配当前项目的缓存文件 `~/.config/wechat-devtools/WeappLocalData/localstorage_e50410aa4726add737ab34a26a92a013.json` 中的 `codeQuality` 字段。缓存可能被后续重扫覆盖，上表只代表所列时间的构建。
