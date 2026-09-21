# 思源字体本地交付与兼容边界

本版附带实际字体文件，不再仅在 `font-family` 中填写思源名称。正文使用思源黑体 Regular（400），标题使用思源宋体 SemiBold（600）。裁剪后的内部字体名称为 `JiafengSans`、`JiafengSerif`，以遵守原字体的保留名称条款。600 之外的宋体字重、400 之外的黑体字重由浏览器匹配/合成，不宣称附带全部字重。

**2026-09-21最终选择：API＋compact。** 微信保留 `loadFontFace` 的真实状态回调，两份WOFF从808,944降至569,396字节（减少29.6%）；全部1106个源码汉字仍覆盖，源码外额外常用字从600调整为200。H5字体和覆盖不变。四方案比较及测试边界见 [字体对比报告](../verification/font-comparison.md)；下文历史记录不代表当前包体。

## 当前文件与大小

| 平台 | 字体                  | WOFF字节 | 码位数 |
| ---- | --------------------- | -------: | -----: |
| H5   | JiafengSans Regular   |  420,216 |   2359 |
| H5   | JiafengSerif SemiBold |  569,420 |   2359 |
| 微信 | JiafengSans Regular   |  250,000 |   1608 |
| 微信 | JiafengSerif SemiBold |  319,396 |   1608 |

H5合计 **989,636 bytes**，路径为 `apps/miniapp/src/static/h5/fonts/`；微信WOFF合计 **569,396 bytes**，构建输入位于 `scripts/font-data/mp/`，转为Data URL后Base64数据部分合计 **759,200 bytes**。微信运行包不再附带独立WOFF。准确版本、SHA256和码位数分别见 `scripts/font-data/manifest.json` 与 `scripts/font-data/mp/manifest.json`。

两套字体都包含全部源码用字、英文数字和常用标点。H5继续合并Unihan频率最高的1800个汉字；微信合并源码之外频率最高的200个额外常用汉字。额外动态覆盖比上一版少400字；新用户输入或未来内容出现未收录字时逐字回退系统字体，不能称为两家族仍各有2008码点覆盖。频率依据Unicode17的`kHanyuPinlu`各读音频率求和，同频按码位排序；这不等于完整规范汉字字库。

2026-09-21最终扫描82份Vue/TypeScript/JSON/SCSS源码，共1106个不同汉字，两套字体缺失均为0，四份字体保留`vert`/`vrt2`竖排特性、OFL说明及重命名。未收录的动态内容和生僻字仍逐字回退系统字体。使用WOFF以兼顾微信官方建议格式；原始16/24MB OTF只在构建缓存中，不打入应用。

## H5 加载与验证

`src/styles/fonts.scss` 的 `@font-face` 通过相对路径 `../static/h5/fonts/…` 引用本地 WOFF，无需外部字体 CDN。当前 Uni-app/Vite 构建保留此路径，并提示无法在构建阶段解析；它没有重写成带 hash 的字体资源地址。产物 CSS 位于 `assets/`，静态字体复制至同级的 `static/h5/fonts/`，浏览器以 CSS 文件地址为基准解析 `../static/h5/fonts/…`。此机制依赖保留 `assets/` 与 `static/` 的产物目录关系。`src/composables/loadFonts.ts` 通过 `document.fonts.load` 触发并检测实际加载，采用 `font-display: swap` 保持首屏可读。

接入方式：在全局样式导入 `fonts.scss`；正文字体栈首项设置为 `JiafengSans`，标题/典籍字体栈首项设置为 `JiafengSerif`。在 `App.onLaunch()` 调用 `void loadFonts()`。函数返回 `{ platform, allLoaded, fonts }`，每个字体包含 `loaded`、`source`，未确认或失败包含 `errorCode`/`error`；微信来源为 `bundled-data-uri`。重复调用共用一次加载结果，8秒超时显示状态待确认，不阻塞界面，也不把超时等同于确定的渲染失败。

浏览器应同时确认 Network 字体请求成功和 `document.fonts.load('600 16px "JiafengSerif"', '家风中华行')` 返回已加载字体；仅 `getComputedStyle().fontFamily` 显示字体名不能证明字体加载成功。

历史记录（迁移至static/h5之前）：2026-09-21 已用实际 H5 生产产物在 `http://localhost:5190/demo/` 子目录验证：样式从 `/demo/assets/index-*.css` 加载，两份字体实际请求 `/demo/static/fonts/JiafengSans-Regular.woff`、`/demo/static/fonts/JiafengSerif-SemiBold.woff`，均返回 HTTP 200 和 `font/woff`，响应字节数与 SHA256 匹配当时构建使用的清单。`document.fonts` 中两个家族均为 `loaded`，400/600 字重的 `load` 与 `check` 检查均通过；无页面 JavaScript 异常、无失败请求。这验证了当前产物目录结构下的子目录加载，不代表任意 CDN 路径改写都兼容。

2026-09-21本次路径迁移后，已重新用H5正式产物的`/demo/`子目录验证：两份字体从`/demo/static/h5/fonts/`返回HTTP200，字节与SHA256匹配新清单；两个家族均为`loaded`，个人中心状态正确，无失败请求或JS异常。

## 微信加载：构建内联 Data URL

原方案在手机和模拟器读取包内 WOFF 时均失败；模拟器错误为 `readFile:fail permission denied`。现在移除运行时文件读取，Vite 在构建时把微信专用 WOFF 转成 Data URL，`App.onLaunch()` 调用 `uni.loadFontFace({ global: true })` 注册。整个过程不请求字体服务器，不需要部署 HTTPS 域名。

**更正旧文档：微信基础库从 3.7.9 起已正式支持 Data URL。** 先前依据 DCloud 旧 API 页面写出的“只有 HTTPS 属于正式支持”不准确，应以当前 [微信 `wx.loadFontFace` 官方文档](https://developers.weixin.qq.com/miniprogram/dev/api/ui/font/wx.loadFontFace.html) 为准。`global` 从2.10.0支持，要求应用入口调用；WOFF仍是官方建议格式。

- H5保留原有常用字覆盖，字体迁至 `src/static/h5/fonts/`；Uni-app构建微信时会排除其他平台静态目录，因此不重复带入H5字体。
- 微信子集覆盖全部当前源码文字，并补充源码之外频率最高的200个常用汉字。两份WOFF及对应清单放在 `scripts/font-data/mp/`，不会被静态资源复制；Vite虚拟模块按清单验证字节数和SHA256后，各内联一份。
- `npm run build:mp-weixin` 在构建后自动检查主包小于2MiB、两个字体各只有一份Data URL、没有重复的WOFF或H5字体。新增界面文字后重建子集，不能只修改二进制而不更新清单。
- 运行时按数字段检查基础库版本。低于3.7.9时明确提示升级微信并使用系统字体；加载失败使用系统字体，8秒超时显示状态待确认；均不阻塞页面、不误报成功。未知SDK版本按实际API结果判断。
- H5与微信子集外的生僻字仍逐字回退。成功回调表示字体注册成功，不等于所有用户输入、其他字重、原生输入控件和Canvas都已验收。

重新在手机测试时，请使用本次新构建生成预览包，退出旧小程序后重新扫码；在“我的”查看字体状态与两份字体明细，再核对首页标题、正文、典藏竖排和传习分包。模拟器结果见 [验证记录](../verification/history.md)，手机结果须实际复测确认。

将来需要覆盖更大字库时，可改为自有HTTPS字体及CORS配置，避免无限扩大主包；这是后续生产选项，当前离线演示不依赖它。

## 当前优化与验收

仅微信子集在裁剪后调用 FontTools 的 `CFF.desubroutinize()`，继续输出WOFF1/CFF1，不引入Zopfli或更换字体。保留的字形绘制、横纵度量、许可和竖排特性没有改变。严格审核逐个比较全部1656/1657个字形（包括每份55个未编码的替代字形），GSUB/GPOS按字形名称规范化后的XML与原2008字版本一致；审核工件SHA256与正式清单相同。证据摘要见 [对比报告](../verification/font-comparison.md#字形与覆盖审核)。

最终6模块迁移后，本地主包逐文件合计1,547,176字节，低于1.5MiB；微信开发工具13:02实际复扫的JS Files已通过，但Main Package仍未通过。该项基于 `compiler.compile` 的开发产物内存文件集，对所有分包逐项检查1.5MiB。同次扫描持久化明细中的主包 `__APP__` 为1,783,675字节（约1.701MiB），超过阈值210,811字节；内容分包为725,555字节。不能以本地加总代替通过结论，详见 [质量扫描口径与来源](../verification/benchmarks/wechat-quality-scan-notes.md)。字体各内联一次，没有重复WOFF。缩减字库与迁移6个内容分包模块共同减少包体，不能把全部差额归因于字体。API和WXSS的compact实验均未出现原1126KB大传输提醒；每方案仅同一开发工具下3轮冷启动，不能宣称启动明显提速。

最终正式构建在基础库3.17.2的首页、个人中心、典籍阅读、传习分包中，两种字体实际加载及竖排切换通过。字体方案选定后的单次冷启动12,023ms、首渲染1,416ms仅用于该次正式产物复核，不用于方案排序。真机字体、原生控件、Canvas和动态输入仍需后续验证；14个媒体资源共491,445字节维持离线演示，因此200K资源总量建议仍未通过。

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

迁移前H5子集 SHA256（当前准确值见两套manifest）：

```text
JiafengSans-Regular.woff
741ffcb384f294f83ea23cd5e44eafc4cc2799dcad7c2484b3b0075e761ba1e5
JiafengSerif-SemiBold.woff
2c818b39988f0b8fd8db985d4681c7ef15e5a9799560b800aedd5acd416ab717
```

## 可复现扩容

脚本位于 `scripts/build-font-subsets.py`，一次生成H5与微信两套子集。默认 `--common-count 1800` 和 `--mp-extra-count 200`；分别记录清单与字表。从项目根目录运行；下载仅在开发时发生，固定源文件均做 SHA256 校验。缓存路径放在交付项目外的 `work/` 目录。

```bash
python3 -m venv ../../work/font-venv
../../work/font-venv/bin/pip install fonttools==4.65.0
../../work/font-venv/bin/python scripts/build-font-subsets.py --cache ../../work/font-sources
```

更新组件文案后重新执行即可覆盖新字。H5可用 `--common-count 2500` 扩大常用字；微信可加 `--mp-extra-count 600` 恢复上一版的额外动态覆盖，仍保留CFF优化，须重新检查包体和真机。脚本刷新H5字体/清单及微信 `scripts/font-data/mp` 的两份字体、字表和清单；MP清单记录 `extra_common_character_count` 与 `cff_optimization`。H5不执行新增CFF优化。固定源码下两次生成的字体、字表和清单SHA256一致，见本轮对比报告。字体源版本升级必须同时更新固定提交、SHA256、许可、第三方声明与本说明。

v0.5 功能代码冻结后的历史补扫为 79 个源文件、1080 个不同中文码位，两份字体均无缺字；媒体文案调整没有新增未收录字。清单中的字节数和 SHA256 与字体文件一致，字表已涵盖当前全部源码字符，因此本次补扫未重新生成字体。

v0.5 字体刷新验证：在相同源码下执行原脚本两次，两份 WOFF、清单和字表的 SHA256 均一致。FontTools 读取内部家族名和字重正常，字形数分别为 2394 / 2395，当前源码的 1080 个中文码位全部覆盖，`vert/vrt2` 均保留。该历史刷新后的构建和包体见下方 v0.5 集成记录。

历史阶段 3 的 H5 开发预览与生产 `/demo/` 子目录中，两个字体的 `document.fonts` 状态均为 `loaded`，相对路径请求无失败。该记录对应 `v0.4.0-showcase` 的旧字体，不冒充本次新字体的生产产物验证；微信真机的最终结果仍需单独补充。

## 历史微信包体记录与分包建议

2026-09-21 阶段 2 构建目录 `apps/miniapp/dist/build/mp-weixin` 的 126 个普通文件合计 **1,778,368 bytes（约 1.70 MiB）**，分项如下。此处是本地文件原始大小；它不能替代微信开发者工具的上传包体检查，也不等于真机验收。

| 内容                                | 原始大小（bytes） |
| ----------------------------------- | ----------------: |
| 两份 WOFF                           |           951,644 |
| 当时随 static 打包的字体脚本/元数据 |            14,343 |
| 页面、业务代码与样式                |           479,013 |
| 框架及组件                          |           169,366 |
| 三段演示视频与封面                  |           164,002 |

阶段 3 当时已将字体构建脚本、清单和字表迁出 `static/`，后续构建不再包含这 14,343 bytes；该阶段字体扩容增加 12,792 bytes，页面代码与样式也改变了当时的最终大小。以 2 MiB 为内部主包预算，阶段 2 剩余 318,784 bytes，不能据此推定后续所有功能都可以继续塞入主包。[uni-app 分包与限制说明](https://uniapp.dcloud.net.cn/collocation/pages.html#subpackages)

`v0.4.0-showcase` 的两份约 1 MB 字体被全部主页面共同使用，当时暂留主包。以下为该版提出的分包建议，本轮实际文件归属与包体由最终集成记录：

1. 建立 `pkg-content` 功能分包，将资讯、课堂、传习阵地、视频、名人馆、文创及各自数据、样式、媒体放进该包；主包只保留首页入口需要的轻量摘要。分包自己的 `static` 目录能使媒体真正离开主包。
2. 如后台和 AI 功能继续增加，再拆 `pkg-tools`（专家/运营、AI 工具）。核心投稿、进度、个人中心与公共导航留在主包。
3. 同时拆开当前 `AppShell` 对所有 View 的静态导入；共享壳以 slot 接收分包页面，或由独立页面明确导入其自身 View。仅在 `pages.json` 写分包而继续从主包导入全部组件，不能完成预期减包。
4. 全量构建后逐项检查主包/分包文件归属，核查是否重复打包字体与 Wot 组件。对包体留至少约 200 KiB 的迭代余量；超出预算先减少公共依赖、迁移媒体，避免每加一个页面就删字。

以上是 `v0.4.0-showcase` 当时的结构方案和单主包背景；本轮正在调整分包，不能将这里的旧包体数据当作新版包体或微信容量验收结果。

## 历史 v0.4.0 集成复核（2026-09-21）

`v0.4.0-showcase` 构建后主包目录 132 个普通文件合计 **1,886,040 bytes（约 1.80 MiB）**，距离内部 2 MiB 预算还有 211,112 bytes（约 206 KiB）。两份字体 964,436 bytes；字体脚本与清单已移出运行产物。新增功能应优先按上面的分包方案调整，避免耗尽余量。

补入“履”后的最终生产构建已重新在 `/demo/` 子目录验证，两份字体 HTTP 200 且均为 `loaded`；同时确认静态视频可播放。H5 结果不等于微信真机字体通过。

## 历史 v0.5 最终分包核对

完成内容分包后，微信发布版主包为1,742,843 bytes，内容分包为656,637 bytes；字体仍仅在主包保留一份。最终生产子路径复查确认两份字体HTTP200且实际loaded。完整检查及微信尚未验证项目见 [历史验证](../verification/history.md)。

## 历史 v0.5.1 早期字符覆盖

六类首页轮播、聊天气泡和连续追问文案更新后重建子集。扫描81个源码文件、1102个不同中文码位，两份字体缺字均为0；每份覆盖2358码位，合计989,364字节。源码中的新字已覆盖，用户输入的未收录字仍回退系统字体。该条是本轮平台分字库优化前的记录；当前大小、覆盖和SHA256以本页现行表及两套manifest为准。
