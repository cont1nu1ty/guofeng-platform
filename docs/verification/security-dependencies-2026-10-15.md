# 安全检查：依赖告警与实际使用路径（2026-10-15）

本轮未升级框架、修改锁文件或替换编译器。先以本机镜像源执行 `npm audit --json`，镜像源安全接口返回404（NOT_IMPLEMENTED）；随后显式指定 `--registry=https://registry.npmjs.org` 成功。命令非零退出来自告警，不是扫描失败。去敏原始结果见 [dependency-audit.json](previews/security-2026-10-15/dependency-audit.json)。

后台审计为1个high依赖节点；用户端为52个依赖节点（2 critical / 28 high / 13 moderate / 9 low）。这是npm的直接/传递及元漏洞计数，**不是52个已证实可从独立部署入口利用的问题**。供应链、构建输入和开发服务器仍须管理，不能因静态部署就忽略告警。

| 告警组 | 本仓实际路径及本轮核查 | 状态与处理 |
| --- | --- | --- |
| Vite 5.2.8 开发服务器文件读取/代理、Vitest 2.1.9 UI、Express/ws/esbuild | 用户端固定Uni编译组合；`npm test`使用`vitest run`，独立部署最终镜像仅Nginx静态文件，没有Node/Vite/Vitest监听。未启动漏洞PoC攻击开发机文件。 | 告警存在；不对外开放dev/preview/UI。独立安排Uni全套匹配升级及H5/微信回归，不盲目audit fix。 |
| Vite DOM clobbering | 官方公告要求cjs/iife/umd构建与攻击者可控HTML元素；当前H5为module脚本，业务文本不直接作为任意HTML插入。 | 已核对使用条件；未证实当前业务可利用，不记为已修复漏洞。 |
| Vue / @vue/server-renderer、Intlify | 项目是Uni H5/微信客户端，未部署SSR服务；应用使用自有`useLocale`字典，未发现把用户数据传入Vue模板编译或Intlify动态消息配置。 | SSR/动态消息路径未见部署使用；依赖命中保留为升级项，不声称Vue全栈安全。 |
| source-map-js、PostCSS、Babel、glob/braces、adm-zip | 编译工具链及Uni工具传递依赖，最终Nginx镜像不执行npm包；构建读取仓库受控源码/素材。 | 不处理不可信仓库/ZIP作为构建输入；与框架一起升级。完整版本/告警链接见下表和JSON。 |
| tinypool | 来自Vitest worker池；官方说明需要原型污染/受控worker选项等前置条件。未发现业务HTTP输入流向测试worker。 | critical版本告警保留；当前部署无测试执行接口。单独升级测试工具，不能把告警直接写成业务RCE。 |
| Quill 1.3.7（vendor，不在npm audit计数内） | `WritingEditor.vue`仅H5导入；`cleanWritingDelta`只保留文本及小格式词汇，移除嵌入/链接/任意样式，`writingHtml`逐字符转义。已有writingTools反例本轮运行通过。 | 官方数据库列出有争议的CVE-2021-3163；当前未发现存储任意HTML的业务链路。编辑器粘贴/浏览器复杂输入未做全面模糊测试，列独立升级/复测项。 |
| PDFBox 3.0.7 | 依赖为core pdfbox；未引用`ExtractEmbeddedFiles`或examples模块，业务`JfDocuments`使用PDDocument/PDType0Font生成PDF，不读取用户PDF附件；上传文档解析在Python服务。 | 官方CVE-2026-33929仅examples路径穿越，当前不走该入口；资源耗尽仍靠进程/容器约束，不能据版本认定查毒或完整沙箱。 |
| Python AI/OCR | 受控本地桩、网络和解析路径测试见[AI文件附表](security-ai-files-2026-10-15.md)。 | 不代表完整Python/Java/OS依赖树已完成CVE扫描；本轮未运行全面SCA或容器漏洞扫描器。 |

官方核查来源：[Vite文件读取](https://github.com/vitejs/vite/security/advisories/GHSA-9cwx-2883-4wfx)、[Vite生成代码条件](https://github.com/vitejs/vite/security/advisories/GHSA-64vr-g452-qvp3)、[Vue SSR公告](https://github.com/vuejs/core/security/advisories/GHSA-g2v6-rqmx-r4w6)、[Tinypool公告](https://github.com/tinylibs/tinypool/security/advisories/GHSA-5gmw-xhrv-c9v3)、[Quill官方仓库关联公告](https://github.com/advisories/GHSA-4943-9vgg-gr5r)、[Apache PDFBox安全公告及examples限定](https://pdfbox.apache.org/security.html)。这些来源支持版本/触发条件；上表对本项目的适用性是结合源码与最终镜像的判断。

## 本轮npm告警逐包记录

下表链接保留原公告以供复查；并未逐条运行所有PoC。除上文核查的公告外，其余状态为“registry告警，完整适用性尚未验证”。

| 应用 | 依赖节点 | 严重性 | 直接依赖 | 告警或传递来源 |
| --- | --- | --- | --- | --- |
| admin | `source-map-js` | high | 否 | [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) |
| miniapp | `@babel/core` | low | 否 | [GHSA-4x5r-pxfx-6jf8](https://github.com/advisories/GHSA-4x5r-pxfx-6jf8) |
| miniapp | `@dcloudio/uni-app` | high | 是 | `@dcloudio/uni-cloud`、`@dcloudio/uni-components`、`@dcloudio/uni-console`、`@dcloudio/uni-push`、`@dcloudio/uni-stat` |
| miniapp | `@dcloudio/uni-cli-shared` | high | 是 | `@babel/core`、`@intlify/core-base`、`@intlify/vue-devtools`、`@vue/server-renderer`、`adm-zip`、`chokidar`、`esbuild`、`fast-glob`、`postcss-selector-parser`、`source-map-js`、`unimport` |
| miniapp | `@dcloudio/uni-cloud` | high | 否 | `@dcloudio/uni-cli-shared`、`fast-glob` |
| miniapp | `@dcloudio/uni-components` | high | 是 | `@dcloudio/uni-cloud`、`@dcloudio/uni-h5` |
| miniapp | `@dcloudio/uni-console` | low | 否 | `@dcloudio/uni-cli-shared` |
| miniapp | `@dcloudio/uni-h5` | high | 是 | `@dcloudio/uni-h5-vite`、`@dcloudio/uni-h5-vue`、`@vue/server-renderer`、`postcss-selector-parser` |
| miniapp | `@dcloudio/uni-h5-vite` | high | 否 | `@dcloudio/uni-cli-shared`、`@vue/server-renderer` |
| miniapp | `@dcloudio/uni-h5-vue` | high | 否 | `@vue/server-renderer` |
| miniapp | `@dcloudio/uni-mp-compiler` | low | 否 | `@dcloudio/uni-cli-shared` |
| miniapp | `@dcloudio/uni-mp-vite` | low | 否 | `@dcloudio/uni-cli-shared`、`@dcloudio/uni-mp-compiler` |
| miniapp | `@dcloudio/uni-mp-weixin` | moderate | 是 | `@dcloudio/uni-cli-shared`、`@dcloudio/uni-mp-vite`、`jimp`、`ws` |
| miniapp | `@dcloudio/uni-nvue-styler` | moderate | 否 | `postcss` |
| miniapp | `@dcloudio/uni-push` | low | 否 | `@dcloudio/uni-cli-shared` |
| miniapp | `@dcloudio/uni-stat` | low | 否 | `@dcloudio/uni-cli-shared` |
| miniapp | `@dcloudio/vite-plugin-uni` | high | 是 | `@babel/core`、`@dcloudio/uni-cli-shared`、`@dcloudio/uni-nvue-styler`、`express`、`fast-glob`、`vite` |
| miniapp | `@intlify/core-base` | high | 否 | `@intlify/message-compiler`、`@intlify/message-resolver`、`@intlify/runtime`、`@intlify/vue-devtools`、[GHSA-x8qp-wqqm-57ph](https://github.com/advisories/GHSA-x8qp-wqqm-57ph)、[GHSA-p2ph-7g93-hw3m](https://github.com/advisories/GHSA-p2ph-7g93-hw3m) |
| miniapp | `@intlify/message-compiler` | high | 否 | `@intlify/message-resolver` |
| miniapp | `@intlify/message-resolver` | high | 否 | [GHSA-p2ph-7g93-hw3m](https://github.com/advisories/GHSA-p2ph-7g93-hw3m) |
| miniapp | `@intlify/runtime` | high | 否 | `@intlify/message-compiler`、`@intlify/message-resolver` |
| miniapp | `@intlify/vue-devtools` | high | 否 | `@intlify/message-resolver`、`@intlify/runtime` |
| miniapp | `@jimp/core` | moderate | 否 | `phin` |
| miniapp | `@jimp/custom` | moderate | 否 | `@jimp/core` |
| miniapp | `@jimp/jpeg` | moderate | 否 | `jpeg-js` |
| miniapp | `@jimp/types` | moderate | 否 | `@jimp/jpeg` |
| miniapp | `@vitest/mocker` | moderate | 否 | [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) |
| miniapp | `@vue/server-renderer` | high | 否 | [GHSA-g2v6-rqmx-r4w6](https://github.com/advisories/GHSA-g2v6-rqmx-r4w6)、`vue` |
| miniapp | `adm-zip` | high | 否 | [GHSA-xcpc-8h2w-3j85](https://github.com/advisories/GHSA-xcpc-8h2w-3j85)、[GHSA-vwc7-r8mq-g2x9](https://github.com/advisories/GHSA-vwc7-r8mq-g2x9)、[GHSA-7q85-xj36-vmfc](https://github.com/advisories/GHSA-7q85-xj36-vmfc)、[GHSA-rcw4-f5rp-g42v](https://github.com/advisories/GHSA-rcw4-f5rp-g42v)、[GHSA-j5f4-cc29-5x44](https://github.com/advisories/GHSA-j5f4-cc29-5x44)、[GHSA-p634-w6r4-rjp2](https://github.com/advisories/GHSA-p634-w6r4-rjp2)、[GHSA-c6fg-446q-cg94](https://github.com/advisories/GHSA-c6fg-446q-cg94)、[GHSA-8238-w5pm-2374](https://github.com/advisories/GHSA-8238-w5pm-2374) |
| miniapp | `body-parser` | moderate | 否 | [GHSA-v422-hmwv-36x6](https://github.com/advisories/GHSA-v422-hmwv-36x6)、`qs` |
| miniapp | `braces` | high | 否 | [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) |
| miniapp | `chokidar` | high | 否 | `braces` |
| miniapp | `cookie` | low | 否 | [GHSA-pxg6-pf52-xh8x](https://github.com/advisories/GHSA-pxg6-pf52-xh8x) |
| miniapp | `esbuild` | moderate | 否 | [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99) |
| miniapp | `express` | high | 否 | `body-parser`、`cookie`、`path-to-regexp`、`qs`、`serve-static` |
| miniapp | `fast-glob` | high | 否 | `micromatch` |
| miniapp | `jimp` | moderate | 否 | `@jimp/custom`、`@jimp/types` |
| miniapp | `jpeg-js` | high | 否 | [GHSA-xvf7-4v9q-58w6](https://github.com/advisories/GHSA-xvf7-4v9q-58w6)、[GHSA-w7q9-p3jq-fmhm](https://github.com/advisories/GHSA-w7q9-p3jq-fmhm) |
| miniapp | `micromatch` | high | 否 | `braces` |
| miniapp | `path-to-regexp` | high | 否 | [GHSA-rhx6-c78j-4q9w](https://github.com/advisories/GHSA-rhx6-c78j-4q9w)、[GHSA-37ch-88jc-xwx2](https://github.com/advisories/GHSA-37ch-88jc-xwx2) |
| miniapp | `phin` | moderate | 否 | [GHSA-x565-32qp-m3vf](https://github.com/advisories/GHSA-x565-32qp-m3vf) |
| miniapp | `postcss` | high | 否 | [GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93)、[GHSA-6g55-p6wh-862q](https://github.com/advisories/GHSA-6g55-p6wh-862q)、[GHSA-fxqj-rqcc-2cmp](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp)、[GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849) |
| miniapp | `postcss-selector-parser` | moderate | 否 | [GHSA-w9m9-85wc-3x92](https://github.com/advisories/GHSA-w9m9-85wc-3x92)、[GHSA-rj75-hqrm-r3gf](https://github.com/advisories/GHSA-rj75-hqrm-r3gf) |
| miniapp | `qs` | moderate | 否 | [GHSA-w7fw-mjwx-w883](https://github.com/advisories/GHSA-w7fw-mjwx-w883)、[GHSA-6rw7-vpxm-498p](https://github.com/advisories/GHSA-6rw7-vpxm-498p)、[GHSA-q8mj-m7cp-5q26](https://github.com/advisories/GHSA-q8mj-m7cp-5q26)、[GHSA-4mjr-xmp4-gh2g](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g) |
| miniapp | `send` | low | 否 | [GHSA-m6fv-jmcg-4jfg](https://github.com/advisories/GHSA-m6fv-jmcg-4jfg) |
| miniapp | `serve-static` | low | 否 | `send` |
| miniapp | `source-map-js` | high | 否 | [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) |
| miniapp | `tinypool` | critical | 否 | [GHSA-5gmw-xhrv-c9v3](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3)、[GHSA-85c8-ppgw-ccpr](https://github.com/advisories/GHSA-85c8-ppgw-ccpr) |
| miniapp | `unimport` | high | 否 | `fast-glob` |
| miniapp | `vite` | high | 是 | [GHSA-9cwx-2883-4wfx](https://github.com/advisories/GHSA-9cwx-2883-4wfx)、[GHSA-64vr-g452-qvp3](https://github.com/advisories/GHSA-64vr-g452-qvp3)、[GHSA-vg6x-rcgg-rjx6](https://github.com/advisories/GHSA-vg6x-rcgg-rjx6)、[GHSA-x574-m823-4x7w](https://github.com/advisories/GHSA-x574-m823-4x7w)、[GHSA-356w-63v5-8wf4](https://github.com/advisories/GHSA-356w-63v5-8wf4)、[GHSA-859w-5945-r5v3](https://github.com/advisories/GHSA-859w-5945-r5v3)、[GHSA-xcj6-pq6g-qj4x](https://github.com/advisories/GHSA-xcj6-pq6g-qj4x)、[GHSA-g4jq-h2w9-997c](https://github.com/advisories/GHSA-g4jq-h2w9-997c)、[GHSA-jqfw-vq24-v9c3](https://github.com/advisories/GHSA-jqfw-vq24-v9c3)、[GHSA-93m4-6634-74q7](https://github.com/advisories/GHSA-93m4-6634-74q7)、[GHSA-4r4m-qw57-chr8](https://github.com/advisories/GHSA-4r4m-qw57-chr8)、[GHSA-4w7w-66w2-5vf9](https://github.com/advisories/GHSA-4w7w-66w2-5vf9)、[GHSA-c27g-q93r-2cwf](https://github.com/advisories/GHSA-c27g-q93r-2cwf)、[GHSA-v6wh-96g9-6wx3](https://github.com/advisories/GHSA-v6wh-96g9-6wx3)、[GHSA-fx2h-pf6j-xcff](https://github.com/advisories/GHSA-fx2h-pf6j-xcff)、`esbuild` |
| miniapp | `vitest` | critical | 是 | `@vitest/mocker`、[GHSA-5xrq-8626-4rwp](https://github.com/advisories/GHSA-5xrq-8626-4rwp)、[GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9)、`tinypool` |
| miniapp | `vue` | high | 是 | `@vue/server-renderer` |
| miniapp | `ws` | high | 否 | [GHSA-58qx-3vcg-4xpx](https://github.com/advisories/GHSA-58qx-3vcg-4xpx)、[GHSA-96hv-2xvq-fx4p](https://github.com/advisories/GHSA-96hv-2xvq-fx4p) |
