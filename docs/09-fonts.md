# 思源字体本地交付与兼容边界

本版附带实际字体文件，不再仅在 `font-family` 中填写思源名称。正文使用思源黑体 Regular（400），标题使用思源宋体 SemiBold（600）。裁剪后的内部字体名称为 `JiafengSans`、`JiafengSerif`，以遵守原字体的保留名称条款。600 之外的宋体字重、400 之外的黑体字重由浏览器匹配/合成，不宣称附带全部字重。

## 文件与大小

| 本地文件 | 官方原字体 | 初次子集大小 |
| --- | --- | --- |
| `apps/miniapp/src/static/fonts/JiafengSans-Regular.woff` | Source Han Sans SC Regular，2.005R | 403,716 bytes |
| `apps/miniapp/src/static/fonts/JiafengSerif-SemiBold.woff` | Source Han Serif SC SemiBold，2.003R | 547,928 bytes |

初次生成合计 **951,644 bytes，约 929 KiB**。每次扩容后的准确大小、SHA256、版本与码位数以同目录 `manifest.json` 为准。这里选择 WOFF，避免低版本 iOS 对 WOFF2 的兼容差异。原始 16/24 MB OTF 仅用于构建，未打入应用。

字符集合由以下部分并集产生：

- Unicode 17.0.0 Unihan `kHanyuPinlu` 各读音频率求和后，按总频率取前 1800 个汉字；相同频率按码位排序。它是扩展演示输入的经验集合，不等同于国家通用规范汉字完整表。
- 构建时 `apps/miniapp/src` 的 Vue、TypeScript、JSON、SCSS 中出现的全部字符，字体工具自身目录除外。
- 英文大小写、数字、常用中西文标点、全角标点。

初次字体各覆盖 2272 个实际码位；中文 UI 码位检查无缺字。保留 `vert` / `vrt2` 竖排替代特性，但这不等于已经验证微信竖排排版。未包含的生僻字、用户输入或后续动态内容逐字回退系统字体；新增文案应重新运行裁剪，不能把子集称为完整思源字库。

## H5 加载与验证

`src/styles/fonts.scss` 的 `@font-face` 直接读取同站点 `/static/fonts/*.woff`，无需外部字体 CDN。`src/composables/loadFonts.ts` 通过 `document.fonts.load` 触发并检测实际加载，采用 `font-display: swap` 保持首屏可读。

接入方式：在全局样式导入 `fonts.scss`；正文字体栈首项设置为 `JiafengSans`，标题/典籍字体栈首项设置为 `JiafengSerif`。在 `App.onLaunch()` 调用 `void loadFonts()`。函数返回 `{ platform, allLoaded, fonts }`，每个字体包含 `loaded`、`source`，失败包含 `error`；重复调用共用一次加载结果，8 秒超时不阻塞界面。

浏览器应同时确认 Network 字体请求成功和 `document.fonts.load('600 16px "JiafengSerif"', '家风中华行')` 返回已加载字体；仅 `getComputedStyle().fontFamily` 显示字体名不能证明字体加载成功。

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

## 可复现扩容

脚本位于 `apps/miniapp/src/static/fonts/build-subsets.py`。从项目根目录运行；下载仅在开发时发生，固定源文件均做 SHA256 校验。缓存路径放在交付项目外的 `work/` 目录。

```bash
python3 -m venv ../../work/font-venv
../../work/font-venv/bin/pip install fonttools==4.65.0
../../work/font-venv/bin/python apps/miniapp/src/static/fonts/build-subsets.py --cache ../../work/font-sources
```

更新组件文案后重新执行即可覆盖新字。可用 `--common-count 2500` 扩大常用字，但必须再次检查微信包体。脚本会刷新两份 WOFF、`charset.txt` 和 `manifest.json`；字体源版本升级必须同时更新脚本固定提交、SHA256、许可、第三方声明与本说明。

初次验证：可复现脚本二次生成 SHA256 一致；FontTools 读取内部家族名/字重正常；当前源文件中文码位全部覆盖，`vert/vrt2` 存在。整页 H5 与微信字体的最终验证由集成后的演示检查记录补充，不能仅凭构建成功判定真机字体生效。
