# 微信启动性能排查 · 2026-09-21

本记录对应用户提供的基础库3.17.2日志：`App.onLaunch took 66ms`、`invokeWebviewMethod 数据传输长度为 1126 KB`、`Launch Time: 11347 ms`。这是Linux开发者工具模拟器数据，不能当作手机正式版启动耗时。

## 1126 KB 的来源

两份微信离线WOFF合计808,944字节，Base64内容合计1,078,592字符。查阅本机基础库3.17.2实现确认：`loadFontFace({ global: true })` 将完整字体参数经JSON及URI编码保存在全局 `fontFaceRecords`；新页面初始化时，这些记录随 `ext.fontFaceRecords` 通过 `invokeWebviewMethod('appDataChange', …)` 再次传递给视图层。两份记录计算约1123 KiB，再加页面初始化配置，与实际1126 KB日志吻合。

开发者工具在桥接消息序列化长度超过1 MiB时打印这条提醒。它是大消息的性能提醒，不表示字体加载失败，也不能据此认定业务列表的`setData`过大。全局字体在新页面初始化时仍需恢复，因此只将两次字体调用改为串行、或只缩小scopes，都不会消除汇总传输。

当前遵循用户选择，保留无需HTTPS资源服务的离线演示及现有字形覆盖，不为隐藏提醒继续删字。未来如采用自有HTTPS字体，初始化记录只需携带短URL，可减少此处传输，但需要另行设计字体下载与缓存。

另做了交付目录外的压缩实验：CFF展开并用Zopfli重压，保留两份字体的全部码位、绘制指令、字宽与竖排表，可将WOFF合计减至736,516字节（约省8.95%）。但字体URI本身距1MiB仅剩约3300字节，尚未计入字体参数与页面包装，不能稳妥保证消除提醒；还会引入新的构建依赖。本轮未替换正式字体，实验保存在`work/font-compression-review/`。

## 实际启动指标

通过该日志所在会话的`wx.getPerformance().getEntries()`读取：

| 指标 | 本次实际值 | 含义 |
| --- | ---: | --- |
| appLaunch | 11,347 ms | 基础库定义的完整启动指标 |
| App.onLaunch同步段 | 66 ms | 不等待字体加载Promise完成 |
| 首次evaluateScript开始距启动起点 | 8,622 ms | 到此才进入该性能条目记录的代码执行阶段；不单独推断前面全部为哪一类耗时 |
| firstRender | 723 ms | 首次页面渲染阶段 |
| initDataRecvTime − initDataSendTime | 294 ms | 整条初始化消息的发送至接收间隔，不能单独归为字体耗时 |
| viewLayerRenderEndTime − viewLayerRenderStartTime | 215 ms | 此次视图层渲染区间 |

1126 KB提醒时间与初始化发送时间相邻。字体确实增加包体、桥接传输和解析工作，但没有证据把11.347秒全部归因于字体。应用没有等待8秒字体超时后才显示首页。另一较早正式产物模拟器会话总启动为7574ms，也出现相同1126 KB提醒，说明总启动存在明显环境波动；这不是受控A/B测试。

## 本次优化与验证

在`apps/miniapp/src/manifest.json`的`mp-weixin`对象加入`lazyCodeLoading: "requiredComponents"`，正式构建生成的`app.json`已包含此值，实际日志显示`LazyCodeLoading: true`。依据微信官方机制，未访问页面及当前页未声明的组件不再立即注入。首页的App依赖仍包含字体，因而此项不缩小字体数据。

仅静态分析时，主包67个JS中约40个、226,006字节位于首页依赖闭包之外。这是潜在延后范围，不是实测节省的时间或内存。Explore页面当前声明的各视图仍属于该页面依赖，不能把`v-if`当作用时注入。

验证结果：

- TypeScript检查、80条单元测试、格式检查、H5正式构建与微信正式构建通过。
- 微信包检查通过：主包1,873,552字节，距离内部2MiB上限剩223,600字节；两份字体各内联一次，无重复WOFF资源。
- 清理编译缓存后重新打开正式构建，基础库3.17.2确认按需加载启用。首页、个人中心、典籍阅读、传习分包两字体均实际`loaded`，个人中心成功状态与竖排切换正常；上述回归未捕获应用或视图脚本错误。
- 投稿页面完整显示，助手输入演示问题后产生本地回复。此检查不上传或提交投稿，不接入真实AI。
- 这一轮冷启动样本为11,184ms，onLaunch同步段63ms，firstRender1052ms，其中初始化发送至接收284ms，视图渲染233ms。1126 KB提醒仍存在。不能凭一次样本宣称明显提速，也不能把不同配置下代码注入与首屏渲染阶段的变化单独当作总耗时收益。
- 手机新预览包仍需复测。正式比较应固定构建、基础库、设备、入口与缓存条件，多次冷启动比较`appLaunch`中位数，并分别查看代码注入和首屏阶段。

SharedArrayBuffer弃用、基础库getSystemInfo/HarmonyOS通知及开发工具WAServiceMainContext预加载提示，均不是当前字体加载失败的证据。本轮优先处理可确认的应用配置问题，不为清空控制台而修改基础库或开发工具。

## 依据

- [微信按需注入与用时注入](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/lazyload.html)
- [小程序启动流程](https://developers.weixin.qq.com/miniprogram/dev/framework/performance/tips/start_process.html)
- [wx.getPerformance](https://developers.weixin.qq.com/miniprogram/dev/api/base/performance/wx.getPerformance.html) 与 [PerformanceEntry时间字段](https://developers.weixin.qq.com/miniprogram/dev/api/base/performance/PerformanceEntry.html)
- [wx.loadFontFace](https://developers.weixin.qq.com/miniprogram/dev/api/ui/font/wx.loadFontFace.html)：基础库3.7.9起支持Data URL；WOFF为建议格式，WOFF2有低版本iOS兼容边界。
- [DCloud manifest的mp-weixin配置](https://uniapp.dcloud.net.cn/collocation/manifest.html#mp-weixin)

本机只读证据位于交付目录外的`work/startup-baseline.json`、`work/startup-lazy-first-run.json`、`work/startup-font-warning-source-evidence.json`及`work/wechat-lazy-font-results.json`；它们记录特定开发会话，不作为应用运行依赖。
