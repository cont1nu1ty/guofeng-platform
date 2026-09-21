# 微信启动性能排查 · 2026-09-21

**当前选择为API＋compact字体。** 两份微信WOFF合计569,396字节，保留全部当前源码文字，源码外额外常用字从600调整为200；三个compact/API冷启动样本中未再出现原1126KB大消息提醒。四方案比较没有证明启动明显提速，完整数据及取舍见 [字体对比报告](12-font-comparison.md) 和仓库内 [基准JSON](benchmarks/font-comparison-2026-09-21.json)。

下列11,347ms日志与最初1126KB提醒属于优化前的2008码点字库。它们保留为问题来源，不代表最终compact产物仍有相同提醒。所有时间来自Linux开发者工具模拟器，不能当作手机正式版启动耗时。

## 原1126KB传输的来源

旧版两份微信离线WOFF合计808,944字节，Base64内容合计1,078,592字符。本机基础库3.17.2实现显示：`loadFontFace({ global: true })` 将完整字体参数经JSON及URI编码保存为全局字体记录；新页面初始化时，这些记录随 `ext.fontFaceRecords` 通过 `invokeWebviewMethod('appDataChange', …)` 传给视图层。两份字体URI约1123KiB，再加初始化参数，与实际1126KB日志吻合。

开发者工具在桥接消息超过1MiB时打印提醒。它不表示字体加载失败，也不能据此认定业务列表的`setData`过大。只将两次字体调用改成串行，或只缩小scopes，不会消除新页面的全局字体汇总传输。

当前compact将Base64数据部分降至759,200字节，两种接入方式的compact实验均没有该提醒。API继续提供真实加载回调和失败说明；WXSS虽也能显示字体，但没有足够启动收益支持替换现有状态流程。离线演示仍不依赖字体服务器。

## 优化前日志能说明什么

用户提供的会话包含 `App.onLaunch took 66ms`、1126KB提醒和 `Launch Time: 11347 ms`。读取该会话的性能条目得到：

| 指标                             | 优化前实际值 | 含义                                                         |
| -------------------------------- | -----------: | ------------------------------------------------------------ |
| appLaunch                        |     11,347ms | 基础库定义的完整启动指标                                     |
| App.onLaunch同步段               |         66ms | 未等待字体Promise完成                                        |
| 首次evaluateScript开始距启动起点 |      8,622ms | 此时进入该条目记录的代码执行阶段；不能将此前全部时间归入字体 |
| firstRender                      |        723ms | 首次页面渲染阶段                                             |
| 初始化发送至接收                 |        294ms | 整条初始化消息间隔，包含字体之外的数据                       |
| 视图渲染区间                     |        215ms | 此次viewLayer渲染时间                                        |

字体确实增加包体、桥接传输和解析工作，但应用没有等待8秒字体超时后才显示首页。另一较早正式产物会话启动7,574ms，也有相同提醒；后续仅启用按需注入的单次样本为11,184ms、同步段63ms、首渲染1,052ms。这些历史单次样本有明显环境波动，不能用于宣称某个配置显著提速。

## 最新受控范围内比较

固定Linux开发者工具2.01.2510290、基础库3.17.2、WebView与正式构建，每方案3次冷启动；清理编译缓存、保留本机存储，性能条目中无需下载代码包。完整采样顺序、原始数组、字体状态和异常保存在 [基准JSON](benchmarks/font-comparison-2026-09-21.json)。

| 方案                              | appLaunch中位数 | 1126KB提醒 |
| --------------------------------- | --------------: | ---------- |
| API＋原2008码点字库               |        15,144ms | 有         |
| WXSS＋原2008码点字库              |        17,169ms | 无         |
| API＋compact 1608码点字库（选用） |        15,092ms | 无         |
| WXSS＋compact 1608码点字库        |        16,148ms | 无         |

API原字库与compact中位数仅差52ms，远小于本次样本波动，不能解释为可靠的速度提升。WXSS的初始化桥接间隔较小，但总启动没有明显优势；不可把一个阶段的缩短直接当作总耗时收益。

选定字体方案后、最后一个模块迁移前的正式产物另复测一次：冷启动12,023ms、首渲染1,416ms。该次首页、个人中心、典籍阅读、传习分包的字体状态与竖排检查通过，未重现下述`too early`异常。这是该次正式产物复核样本，**不加入四方案的中位数排序，也不作为真机通过证据**。

## 配置、包体与质量提示

`mp-weixin.lazyCodeLoading` 保持 `requiredComponents`，产物及模拟器确认 `LazyCodeLoading: true`。它延后未使用组件的注入，不会自动移动主包文件。早期静态依赖分析得到约226,006字节位于首页依赖闭包之外，只是潜在延后范围，不是测得的时间或内存节省。

本轮字体对比前将5个专属模块移到内容分包，主包JS减少6,931字节；四方案以相同迁移结果比较。随后资源地址工具 `useAssetUrl` 也迁入分包，6模块共减少6,984字节。当前API＋compact本地逐文件主包为1,547,176字节，较迁移前1,873,552字节少326,376字节。

13:02在开发工具关闭→仅清编译缓存→重新打开→Code Quality Rescan后，[实际扫描记录](benchmarks/wechat-quality-scan-2026-09-21.json) 显示JS Files项目通过，但Main Package和媒体仍未通过。质量检查使用 `compiler.compile` 的 `resultType: 'dev'` 内存文件集逐包统计，并对所有分包检查1.5×1024×1024阈值。同次13:02:25.964扫描的持久化明细为：主包 `__APP__` 1,783,675字节（约1.701MiB），较1,572,864字节阈值超出210,811字节；`pkg-content/` 725,555字节。详见 [质量扫描口径与来源](benchmarks/wechat-quality-scan-notes.md)。本地逐文件加总不是同一口径，不能凭本地低于1.5MiB覆盖实际未通过结果。

14个媒体文件共491,445字节未更改，仍作为离线演示资源保留，因此200K资源总量建议仍未通过。没有把媒体改成外部链接来换取扫描通过。代码检查、构建与媒体回归见 [验证记录](07-validation.md)。

## 一次`SystemError: too early`的边界

API＋compact第3轮出现一次 `SystemError (appServiceSDKScriptError): too early`。基础库源码显示早期桥接拦截会返回 `API:fail too early`，错误包装随后剥离API名称；捕获的堆栈只保留通用包装帧。现有证据无法确定是哪一个API触发，不能断言来自字体加载或性能采样。

本机分析文件为 `work/font-lab/sdk-too-early-analysis.json`，基准JSON保留原异常文本；正式构建复测未重现。后续若重现，应在首页渲染就绪后读取性能，并保留完整原生/SDK日志以定位来源，不能把当前状态描述为已找到并修复根因。

SharedArrayBuffer弃用、getSystemInfo/HarmonyOS通知及开发工具预加载提示也不等同于字体失败。真正的字体成功、失败或待确认状态由对应API和个人中心明细报告。

## 依据与复测

- [四方案记录与复现步骤](12-font-comparison.md)，[仓库基准JSON](benchmarks/font-comparison-2026-09-21.json)。
- [微信按需注入与用时注入](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/lazyload.html)、[启动流程](https://developers.weixin.qq.com/miniprogram/dev/framework/performance/tips/start_process.html)。
- [wx.getPerformance](https://developers.weixin.qq.com/miniprogram/dev/api/base/performance/wx.getPerformance.html) 与 [PerformanceEntry字段](https://developers.weixin.qq.com/miniprogram/dev/api/base/performance/PerformanceEntry.html)。
- [wx.loadFontFace](https://developers.weixin.qq.com/miniprogram/dev/api/ui/font/wx.loadFontFace.html)：3.7.9起支持Data URL；WOFF为建议格式，WOFF2有低版本iOS兼容边界。

真机复测需固定设备、微信/基础库版本、入口与缓存条件，多次冷启动比较中位数，并另查字体、录音、相册、Canvas及竖排显示。临时 `work` 文件不作为应用运行依赖，仓库内基准数据足以回查本报告的四方案结果。
