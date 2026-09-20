# 第三方来源与许可

本项目为内部需求沟通原型，原创业务代码尚未替用户选择对外开源许可。第三方软件保留其原许可；`private: true` 不替代许可证义务。

| 内容 | 本次使用方式 | 来源与许可证 |
|---|---|---|
| Wot Starter | 基于已锁定提交裁剪依赖组合、Vite 配置、应用入口；并非完整分叉或完整继承全部功能 | [上游](https://github.com/wot-ui/wot-starter/tree/c9813573b73f45fc08b0eb249f0f28c5ca0fe401)，原始 MIT 文本保留于 `licenses/wot-starter.MIT.txt` |
| Wot UI 2.3.1 | 实际引入按钮、图标、复选框、弹层、开关；没有复制手写同等基础控件 | [上游](https://github.com/wot-ui/wot-ui)，MIT 文本保留于 `licenses/wot-ui.MIT.txt` |
| Wot UI 图标字体 | npm 包内 51KB 字体转换为本地 CSS data URI，避免演示依赖外部字体请求，原字体不修改 | 同上 |
| Uni-app 4.85 对应编译包、Vue、Vite、TypeScript、Vitest 等 | npm 依赖；准确版本、下载来源、完整性哈希由 package-lock.json 锁定 | 以安装版本自带 LICENSE/NOTICE 为准；Uni-app 仓库含 Apache-2.0 及额外许可文件，应在正式发布时核对运行时与 SDK 适用范围 |
| 书卷、山形、拱门等插画 | 项目原创 CSS 图形，无外部图片下载 | 本项目原创 |
| 篇章、资讯、活动样例 | 为沟通编写的原创演示文本；不是官方资讯、出版物或真实活动 | 在界面和数据内标示；历史人物馆使用注明公开来源的简短介绍与公版古文短句 |
| 思源黑体 / 思源宋体 | 随项目附带 WOFF 子集，已重命名 JiafengSans / JiafengSerif，保留竖排特性 | [Adobe 黑体](https://github.com/adobe-fonts/source-han-sans) / [Adobe 宋体](https://github.com/adobe-fonts/source-han-serif)，SIL OFL 1.1；原始许可位于 `licenses/`，固定来源、哈希与构建方法见 `docs/09-fonts.md` |
| Unihan 常用字数据 | 构建时选取字形子集，不运行时联网 | Unicode 17.0.0；原始许可 `licenses/Unicode-LICENSE.txt` |
| 三条视频及封面 | 原创 12 秒静音文字动画，H.264，不含外部影像/录音 | 素材说明与人物馆公开资料出处见 `apps/miniapp/src/static/media/README.md`；渲染用系统 Noto CJK，字体文件未嵌入视频 |

准确来源见 `source-lock.json`。若依、芋道、流程引擎、OCR、全景、AI 平台仅为选型研究，当前源码没有导入这些后端项目。未来每次引入都应记录对应提交与许可证，不能把一个项目的许可套用于其素材、模型或所有依赖。
