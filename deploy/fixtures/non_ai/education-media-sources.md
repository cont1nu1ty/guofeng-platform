# 教育与媒体增量的内容来源

课程《把约定写进日常》《公私有界，清廉有声》、题库、班组、承诺文本及沈守约人物故事均为本项目新编的虚构展示内容。导入脚本通过真实业务接口生成演示账号的阅读确认、服务端判分、人工身份审核及承诺记录；这些记录不是现实学习、干部身份或履职证明，也不是电子签章。

媒体复用仓库 `family-letter.mp4`、`everyday-values.mp4`、`integrity-talk.mp4` 三个原创十二秒静音文字动画，来源与重建方式见 `apps/miniapp/src/pkg-content/static/media/README.md` 和 `scripts/generate_demo_media.py`。没有导入第三方影视、照片或真人录音。朗读关联复用 `integrity-zh.mp3`，它是仓库原有 eSpeak NG 离线合成示例，来源见 `scripts/audio-sample-manifest.json`；本轮未生成新声音，不称为专业真人朗读。

`shouyue-study-panorama.png` 为 `generate_panorama.py` 用 Pillow 和几何射线映射绘制的原创 2048 × 1024 等距柱状球面纹理；场景、书架、书籍、窗景均为程序图形，不使用照片、外部模型或 AI 生成素材，不是真实场馆。文字使用系统 Noto Serif CJK（SIL Open Font License）栅格化，未分发字体文件。该纹理及程序图形允许随本项目复制、修改、分发和演示。

重建纹理需 Python、Pillow 和系统 Noto Serif CJK 字体：`python3 deploy/fixtures/non_ai/generate_panorama.py`。导入脚本只记录已审阅的本地 PNG 路径，不在导入时生成图像，也不把本地路径用作生产 URL。

公开人物馆的全景采用 [Autumn Hockey（Greg Zaal / Poly Haven）](https://polyhaven.com/a/autumn_hockey)，资产页标明作者和 CC0；[官方许可页](https://polyhaven.com/license)允许使用、修改和再分发该资产。使用官方 [8K Tonemapped JPG](https://dl.polyhaven.org/file/ph-assets/HDRIs/extra/Tonemapped%20JPG/autumn_hockey.jpg) 的 HTTPS 原始资产地址，不使用网页截图、用户渲染图或品牌标识。本条来源及许可于 2026-10-08 核对。

人物馆以短标题“沈守约”和“原创虚构人物”时代说明适配姓名展示；介绍开头标注“全景技术示例·秋日公园（非展馆实景）”，备注再次解释来源与边界。它是第三方 CC0 公园摄影，与虚构人物沈守约、书屋及家风展馆没有真实对应关系；本地原创书屋纹理仍仅是离线 fixture。外部图片可达性取决于服务与网络，实际交互由统一部署后验收；微信端平面图片不能充当微信球面验收证据。

课程学习状态按五个既有虚构账号分布：林晚晴保留第一版完成、第二版未学；陈景和第二版进行中；周砚秋第二版未通过；赵云舒第二版通过；许知远未学。干部身份另有通过、待审核、退回三支；三个班组分别保留未确认、旧版确认后待重新确认、当前版确认。新媒体分别保留字幕草稿、字幕与示例朗读已发布、换源后旧字幕失效，原数据包的媒体草稿及退回投稿不受修改。
