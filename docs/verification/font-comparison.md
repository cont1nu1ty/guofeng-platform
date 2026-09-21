# 离线字体方案对比 · 2026-09-21

最终采用 **API＋compact**：继续用 `loadFontFace` 注册离线Data URL，缩减源码外额外字并展开CFF子程序，两份微信WOFF由808,944降至569,396字节，减少239,548字节（29.6%）。当前1106个源码汉字、英文与标点全部保留，H5字体不变。该变化消除了本次compact实验的1126KB大消息提醒；**没有证据证明冷启动明显改善，真机尚未验收**。

选择依据与原始样本保存在仓库内 [font-comparison-2026-09-21.json](benchmarks/font-comparison-2026-09-21.json)。字体来源、SHA256、生成参数见 [当前微信字体清单](../../scripts/font-data/mp/manifest.json) 和 [字体交付说明](../engineering/fonts.md)。

## 四方案比较

`full`指上一版每家族2008码点的子集，并非完整思源字库；`compact`指全部源码文字/标点＋200个额外常用字，布局闭包后每家族1608码点，并执行CFF展开。API使用构建期内联Data URL和真实加载回调；WXSS实验将相同WOFF内联为字体规则。

| 方案                     |     两份WOFF | 每家族码点 | 本地逐文件主包 | 3轮appLaunch中位数 | 大消息提醒 |
| ------------------------ | -----------: | ---------: | -------------: | -----------------: | ---------- |
| API＋full                |     808,944B |       2008 |     1,866,621B |           15,144ms | 有         |
| WXSS＋full               |     808,944B |       2008 |     1,866,740B |           17,169ms | 无         |
| **API＋compact（选用）** | **569,396B** |   **1608** | **1,547,229B** |       **15,092ms** | **无**     |
| WXSS＋compact            |     569,396B |       1608 |     1,547,348B |           16,148ms | 无         |

环境为Linux、微信开发者工具2.01.2510290、基础库3.17.2、WebView、正式构建，每方案仅3轮。清理编译缓存、保留本机存储，无代码包下载；同组API/WXSS交替采样，先full后compact，完整顺序见JSON。桌面其他进程与开发工具启动存在波动，这不是手机网络与冷缓存测试。

API＋full的启动样本为18,184／14,883／15,144ms，API＋compact为14,440／15,540／15,092ms；两者中位数仅差52ms，不能据此宣称提速。WXSS虽然减少初始化桥接数据，但本次总启动没有明显优势，包体也与API几乎相同。API保留已有的真实成功/失败回调、旧SDK提示、8秒状态确认期限与个人中心说明，因此选择继续沿用API。

选定字体方案后、最后一个模块迁移前的正式产物另有一次冷启动12,023ms、首渲染1,416ms的复核记录，详见JSON的 `finalColdLaunch`。这是单次验证，不用于四方案排序，也不覆盖真实手机启动体验。

## 字形与覆盖审核

| 字体                      | 当前WOFF | 码点 | 已逐个审核字形 | 未编码替代字形 |
| ------------------------- | -------: | ---: | -------------: | -------------: |
| JiafengSans Regular 400   | 250,000B | 1608 |           1656 |             55 |
| JiafengSerif SemiBold 600 | 319,396B | 1608 |           1657 |             55 |

自动扫描整个 `src` 的Vue、TypeScript、JSON和SCSS，包括内容分包、隐藏界面、翻译、预设数据及插值来源，1106个不同源码汉字缺失为0。没有只抄首页标题，也没有删除界面正文、把当前正文改为系统字体。源码以外的用户输入不能靠静态扫描穷尽。

当前仍是WOFF1/OpenType-CFF1。严格审核对全部字形（含竖排替代字形）逐个比较绘制指令、横向/纵向度量，与普通compact候选及原2008字版本一致；GSUB/GPOS按字形名称规范化后的XML与原版本一致，`vert`/`vrt2`保留。CFF展开前后的14张已审核非轮廓表字节一致（不含需重算校验值的`head`表），许可name字段0/13/14保留。最终正式字体SHA256与审核候选一致：

```text
JiafengSans-Regular.woff
5abc4b633de13dd0441cbda4aa2faaa696f4b853423606c324c9295eb7dcec86
JiafengSerif-SemiBold.woff
1b7b50b01f986574f70e025179a3745d16872601e9c392eb79f683ffaab253a4
```

完整 [字形与竖排严格审计](benchmarks/font-glyph-audit-2026-09-21.json) 已随仓库保存，正式清单保存相同哈希。FontTools4.65.0即可生成，不引入Zopfli。固定源码连续两次生成，字体、字表和清单哈希相同，详见 [可复现性核对](benchmarks/font-determinism-2026-09-21.json)。

**覆盖权衡明确保留：** 原来源码外额外600个常用汉字降为200个，因此每家族从2008降到1608码点。原本额外覆盖中约400字的未来/用户动态内容将更频繁地逐字回退系统字体；这不是字体完整覆盖的承诺。29.6%减量来自缩减额外字与CFF优化共同作用，不能把它描述成全部无损压缩收益。H5维持原2359码点/家族和989,636字节总量。

## 包体与资源的取舍

对比前，`audioStories`、`hallExperience`、`newsPreferences`三个领域模块和 `useNewsPreferences`、`useReplayCache`两个适配模块迁入 `pkg-content`，编译后的主包JS减少6,931字节。对比表中的四方案共享这项5模块迁移基础，API＋compact为1,547,229字节。随后第6个模块 `useAssetUrl` 迁入分包，再减少53字节；当前主包为1,547,176字节，总JS迁移减少6,984字节。相对迁移前1,873,552字节的总差为326,376字节，不能全算作字体收益。

1,547,176字节约1.4755MiB，按本地逐文件口径距1.5MiB为25,688字节。**本地统计不等于微信开发工具质量扫描通过**。13:02实际执行关闭→仅清编译缓存→打开→Code Quality Rescan，[扫描记录](benchmarks/wechat-quality-scan-2026-09-21.json) 显示JS Files已通过，Main Package和媒体资源仍未通过。工具使用 `compiler.compile` 的 `resultType: 'dev'` 内存文件集逐包统计，并对所有分包检查1.5×1024×1024阈值；它不是本地磁盘文件加总。随后读取同次13:02:25.964扫描的持久化明细，主包 `__APP__` 为1,783,675字节（约1.701MiB），超出1,572,864字节阈值210,811字节；`pkg-content/` 为725,555字节。两种口径与取值来源详见 [质量扫描说明](benchmarks/wechat-quality-scan-notes.md)。内部2MiB构建校验与该质量扫描必须分开报告。

14个媒体资源合计491,445字节，文件内容未更改。继续保留可离线播放的演示资源，200K资源总量建议仍未通过；本次没有删媒体或改成必须联网的资源链接。若正式产品需要更大字库或媒体库，应单独设计下载、缓存、版权与离线边界。

曾比较只保留标题字形、按宋体/黑体不对称裁剪、拆第三个宋体扩展层等路径。标题与正文存在继承、用户稿件和竖排阅读交叉，严格按页面字面量分字体容易漏字；不对称方案又需要混用黑体兜底。最终采用两家族同一来源扫描与额外字策略，便于新增文案后统一重建与审核。

## 异常与验证边界

API＋compact第3轮曾出现一次 `SystemError (appServiceSDKScriptError): too early`，原始堆栈保留在基准JSON。`work/font-lab/sdk-too-early-analysis.json`确认SDK会剥离报错中的API名称，现有通用包装堆栈无法锁定具体调用；不能断言是字体或采样API造成。正式构建复测未重现，不等于已经定位并修复根因。再次出现时应在首页渲染就绪后取性能数据，并保留完整SDK/原生日志。

本轮代码验证为13个测试文件、80条测试，以及类型、格式、H5和微信正式构建检查通过。H5开发环境及生产 `/demo/` 子路径中，资讯订阅持久化、回放缓存循环、音频播放/暂停、场馆内容与讲解、14个媒体资源读取回归通过；媒体模块迁移没有改变这些功能。微信正式产物的首页、个人中心、典籍阅读、传习分包两字体加载及竖排切换通过；第6模块迁移后，资讯、视频、名人馆再次检查无运行错误，标题与正文实际字形均确认 `isCustomFont: true`。

上述结论限于实际执行的环境。真机不同系统、微信版本、原生输入框、Canvas、录音/相册权限及用户未收录字仍需复测；质量扫描未通过项不能被单元测试或构建通过替代。总体记录见 [验证记录](history.md)，原始启动问题见 [启动排查](wechat-startup.md)。

## 复现步骤

以下从项目根目录执行。首次准备独立字体环境；已有FontTools4.65.0环境时可直接复用：

```bash
python3 -m venv ../../work/font-venv
../../work/font-venv/bin/pip install fonttools==4.65.0
../../work/font-venv/bin/python scripts/build-font-subsets.py --cache ../../work/font-sources --mp-extra-count 200
npm --prefix apps/miniapp run typecheck
npm --prefix apps/miniapp test
npm --prefix apps/miniapp run format:check
npm --prefix apps/miniapp run build:h5
npm --prefix apps/miniapp run build:mp-weixin
```

脚本验证固定字体源与Unihan的SHA256，扫描全部当前源码，分别更新H5及微信清单。MP清单记录200个额外字和CFF优化方式；H5参数与处理保持原样。需要恢复较大动态覆盖时改用 `--mp-extra-count 600`，但仍保留CFF优化，必须重新量包和测试；它不自动重现表中“旧full、未展开CFF”的原始字节。

四方案实验没有新增生产环境开关。应先冻结源码并单独保存四种正式产物，以相同基础库/入口/缓存条件各测至少3轮，保留原始启动、首渲染、字体状态和错误日志。本机留有 `work/font-lab/variants/` 与同轮测量脚本；在相同开发工具/CDP准备完成后可重跑原顺序：

```bash
node ../../work/font-lab/benchmark.cjs api-full wxss-full api-full wxss-full api-full wxss-full api-compact wxss-compact api-compact wxss-compact api-compact wxss-compact
```

该临时脚本需要已准备的四个产物，不会从当前生产源码自动生成WXSS实验方案；运行会切换实验开发工具窗口。共享交付只读取仓库基准JSON也能核对本报告，不依赖这些临时文件才能理解结论。
