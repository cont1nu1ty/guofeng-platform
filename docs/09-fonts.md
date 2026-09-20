# 思源字体本地交付与兼容边界

本版附带实际字体文件，不再仅在 `font-family` 中填写思源名称。正文使用思源黑体 Regular（400），标题使用思源宋体 SemiBold（600）。裁剪后的内部字体名称为 `JiafengSans`、`JiafengSerif`，以遵守原字体的保留名称条款。600 之外的宋体字重、400 之外的黑体字重由浏览器匹配/合成，不宣称附带全部字重。

## 文件与大小

| 本地文件 | 官方原字体 | 当前子集大小 |
| --- | --- | --- |
| `apps/miniapp/src/static/fonts/JiafengSans-Regular.woff` | Source Han Sans SC Regular，2.005R | 409,012 bytes |
| `apps/miniapp/src/static/fonts/JiafengSerif-SemiBold.woff` | Source Han Serif SC SemiBold，2.003R | 555,424 bytes |

2026-09-21 阶段 3 扩容后合计 **964,436 bytes，约 942 KiB**。每次扩容后的准确大小、SHA256、版本与码位数以 `scripts/font-data/manifest.json` 为准。这里选择 WOFF，避免低版本 iOS 对 WOFF2 的兼容差异。原始 16/24 MB OTF 仅用于构建，未打入应用。构建脚本与元数据位于 `scripts/`，不随 `static/` 打包；运行包内字体目录只保留两份 WOFF。

字符集合由以下部分并集产生：

- Unicode 17.0.0 Unihan `kHanyuPinlu` 各读音频率求和后，按总频率取前 1800 个汉字；相同频率按码位排序。它是扩展演示输入的经验集合，不等同于国家通用规范汉字完整表。
- 构建时 `apps/miniapp/src` 的 Vue、TypeScript、JSON、SCSS 中出现的全部字符，字体工具自身目录除外。
- 英文大小写、数字、常用中西文标点、全角标点。

当前两份字体各覆盖 **2300 个实际码位**，包括最新典籍、AI 示例与个人中心；当前源码的 995 个不同中文码位均被覆盖。码位数从保存后的字体 `cmap` 读取，包含保留竖排特性时带入的额外映射。保留 `vert` / `vrt2` 竖排替代特性，但这不等于已经验证微信竖排排版。未包含的生僻字、用户输入或后续动态内容逐字回退系统字体；新增文案应重新运行裁剪，不能把子集称为完整思源字库。

## H5 加载与验证

`src/styles/fonts.scss` 的 `@font-face` 通过相对路径 `../static/fonts/…` 引用本地 WOFF，无需外部字体 CDN。当前 Uni-app/Vite 构建保留此路径，并提示无法在构建阶段解析；它没有重写成带 hash 的字体资源地址。产物 CSS 位于 `assets/`，静态字体复制至同级的 `static/fonts/`，浏览器以 CSS 文件地址为基准解析 `../static/fonts/…`。此机制依赖保留 `assets/` 与 `static/` 的产物目录关系。`src/composables/loadFonts.ts` 通过 `document.fonts.load` 触发并检测实际加载，采用 `font-display: swap` 保持首屏可读。

接入方式：在全局样式导入 `fonts.scss`；正文字体栈首项设置为 `JiafengSans`，标题/典籍字体栈首项设置为 `JiafengSerif`。在 `App.onLaunch()` 调用 `void loadFonts()`。函数返回 `{ platform, allLoaded, fonts }`，每个字体包含 `loaded`、`source`，失败包含 `error`；重复调用共用一次加载结果，8 秒超时不阻塞界面。

浏览器应同时确认 Network 字体请求成功和 `document.fonts.load('600 16px "JiafengSerif"', '家风中华行')` 返回已加载字体；仅 `getComputedStyle().fontFamily` 显示字体名不能证明字体加载成功。

2026-09-21 已用实际 H5 生产产物在 `http://localhost:5190/demo/` 子目录验证：样式从 `/demo/assets/index-*.css` 加载，两份字体实际请求 `/demo/static/fonts/JiafengSans-Regular.woff`、`/demo/static/fonts/JiafengSerif-SemiBold.woff`，均返回 HTTP 200 和 `font/woff`，响应字节数与 SHA256 匹配当时构建使用的清单。`document.fonts` 中两个家族均为 `loaded`，400/600 字重的 `load` 与 `check` 检查均通过；无页面 JavaScript 异常、无失败请求。这验证了当前产物目录结构下的子目录加载，不代表任意 CDN 路径改写都兼容。

## 微信加载：已实现离线尝试，仍需真机验收

小程序条件编译分支从包内 `static/fonts` 读取 WOFF，并转成 base64 data URI 后调用 `uni.loadFontFace({ global: true })`。这使演示不强制依赖第三方网络；字体文件只存一份，不额外在 JS 中内嵌另一份 base64。

**官方明确支持的微信 `loadFontFace` 资源方式是 HTTPS 网络字体，且需满足跨域条件。** 本版离线 data URI 路径是兼容尝试，不是该正式契约保证的能力；没有 iOS/Android 微信真机验证前，不能承诺全部微信环境成功。API 失败或超时会返回失败状态，页面继续使用字体栈中的系统宋体/黑体，不伪造加载成功。[uni-app 字体 API](https://uniapp.dcloud.net.cn/api/ui/font.html)

后续微信正式交付应：

1. 在 iOS、Android 真机验证返回状态、首页标题/正文、表单输入、横竖排标点及多页面全局字体；开发工具截图不能代替此项。
2. 若离线 data URI 被运行时拒绝，将同一 WOFF 上传自有 HTTPS 静态域名，设置跨域响应与相应小程序域名配置，把 `source` 替换为该地址。接口支持 `global` 需基础库 2.10.0 及以上，并由 `App.onLaunch` 调用。
3. 随页面增长检查编译后的实际包体；完整多字重/全字库应使用按需网络字体或明确分包方案，不要直接把原始 CJK OTF 放入主包。

## 来源、许可与校验

- [Adobe Source Han Sans](https://github.com/adobe-fonts/source-han-sans)，固定提交 `a4f7cf94edfb9d7ffbdfc4841de276358bd7e0f2`，发布版 2.005R。
- [Adobe Source Han Serif](https://github.com/adobe-fonts/source-han-serif)，固定提交 `7889f11bf31170b5d092a083b357c8c8130f89e0`，发布版 2.003R。
- 两者均为 SIL Open Font License 1.1，原始许可位于 `licenses/source-han-sans-OFL.txt`、`licenses/source-han-serif-OFL.txt`。版权及许可元数据随子集保留；修改包括裁剪、移除 hinting、重命名，未替换字形设计。
- [Unicode 17.0.0 Unihan](https://www.unicode.org/Public/17.0.0/ucd/Unihan.zip) 用于构建常用字集合，许可位于 `licenses/Unicode-LICENSE.txt`；[Unihan 属性说明](https://www.unicode.org/reports/tr38/)。数据不在运行时请求。

原始 OTF SHA256：

```text
SourceHanSansSC-Regular.otf
f1d8611151880c6c336aabeac4640ef434fa13cbfbf1ffe82d0a71b2a5637256
SourceHanSerifSC-SemiBold.otf
faf16caeaf207e1926e01af8d9f1a8e71b0e9d8f51bf3b5d9a78f9f30e7e3e31
Unihan.zip
f7a48b2b545acfaa77b2d607ae28747404ce02baefee16396c5d2d7a8ef34b5e
```

本次交付子集 SHA256：

```text
JiafengSans-Regular.woff
b6c64c0a00201fad404ce73fb905a6cdcb13bcdea45d35ee1bd0dec089855566
JiafengSerif-SemiBold.woff
da47b9e36889675426a845057d3820159c2b3a3ea54aa7870b18b40a3535a827
```

## 可复现扩容

脚本位于 `scripts/build-font-subsets.py`。从项目根目录运行；下载仅在开发时发生，固定源文件均做 SHA256 校验。缓存路径放在交付项目外的 `work/` 目录。

```bash
python3 -m venv ../../work/font-venv
../../work/font-venv/bin/pip install fonttools==4.65.0
../../work/font-venv/bin/python scripts/build-font-subsets.py --cache ../../work/font-sources
```

更新组件文案后重新执行即可覆盖新字。可用 `--common-count 2500` 扩大常用字，但必须再次检查微信包体。脚本会刷新两份 WOFF、`scripts/font-data/charset.txt` 和 `scripts/font-data/manifest.json`；字体源版本升级必须同时更新脚本固定提交、SHA256、许可、第三方声明与本说明。

阶段 3 验证：可复现脚本二次生成 SHA256 一致；FontTools 读取内部家族名/字重正常；当前源文件中文码位全部覆盖，`vert/vrt2` 存在。H5 开发预览与生产 `/demo/` 子目录中两个字体的 `document.fonts` 状态均为 `loaded`，相对路径请求无失败。微信真机的最终结果仍需单独补充，不能仅凭构建成功判定真机字体生效。

## 微信包体记录与后续分包

2026-09-21 阶段 2 构建目录 `apps/miniapp/dist/build/mp-weixin` 的 126 个普通文件合计 **1,778,368 bytes（约 1.70 MiB）**，分项如下。此处是本地文件原始大小；它不能替代微信开发者工具的上传包体检查，也不等于真机验收。

| 内容 | 原始大小（bytes） |
| --- | ---: |
| 两份 WOFF | 951,644 |
| 当时随 static 打包的字体脚本/元数据 | 14,343 |
| 页面、业务代码与样式 | 479,013 |
| 框架及组件 | 169,366 |
| 三段演示视频与封面 | 164,002 |

阶段 3 已将字体构建脚本、清单和字表迁出 `static/`，下一次构建应不再包含这 14,343 bytes；本次字体扩容增加 12,792 bytes，页面代码与样式仍会改变最终大小。以 2 MiB 为内部主包预算，阶段 2 剩余 318,784 bytes，不能据此推定后续所有功能都可以继续塞入主包。[uni-app 分包与限制说明](https://uniapp.dcloud.net.cn/collocation/pages.html#subpackages)

当前两份约 1 MB 字体被全部主页面共同使用，暂留主包可避免字体重复和首屏等待。下一轮的优先拆分顺序：

1. 建立 `pkg-content` 功能分包，将资讯、课堂、传习阵地、视频、名人馆、文创及各自数据、样式、媒体放进该包；主包只保留首页入口需要的轻量摘要。分包自己的 `static` 目录能使媒体真正离开主包。
2. 如后台和 AI 功能继续增加，再拆 `pkg-tools`（专家/运营、AI 工具）。核心投稿、进度、个人中心与公共导航留在主包。
3. 同时拆开当前 `AppShell` 对所有 View 的静态导入；共享壳以 slot 接收分包页面，或由独立页面明确导入其自身 View。仅在 `pages.json` 写分包而继续从主包导入全部组件，不能完成预期减包。
4. 全量构建后逐项检查主包/分包文件归属，核查是否重复打包字体与 Wot 组件。对包体留至少约 200 KiB 的迭代余量；超出预算先减少公共依赖、迁移媒体，避免每加一个页面就删字。

以上是后续结构方案，当前仍是两页入口的单主包实现；没有为了通过本地编译而声称已经完成分包、上传或微信容量验收。

## 最终集成复核（2026-09-21）

`v0.4.0-showcase` 构建后主包目录 132 个普通文件合计 **1,886,040 bytes（约 1.80 MiB）**，距离内部 2 MiB 预算还有 211,112 bytes（约 206 KiB）。两份字体 964,436 bytes；字体脚本与清单已移出运行产物。新增功能应优先按上面的分包方案调整，避免耗尽余量。

补入“履”后的最终生产构建已重新在 `/demo/` 子目录验证，两份字体 HTTP 200 且均为 `loaded`；同时确认静态视频可播放。H5 结果不等于微信真机字体通过。
