# 演示数据分支与主分支边界

`main` 本目录只保留这份说明，不包含可导入的模拟 JSON/PDF。数据与包含具体演示姓名、文案的三个种子脚本保留在 [codex/demo-data-bootstrap](https://github.com/cont1nu1ty/guofeng-platform/tree/codex/demo-data-bootstrap)；下列链接固定到该分支已验证的提交 `a94f494`，不是 main 本地文件。需在演示分支显式执行 `./deploy/dev seed-demo`，完整步骤与失败处理见[部署说明](../README.md#显式导入演示数据)。默认启动不会导入，也不会从远端取数据。

| 文件或位置 | 用途 |
| --- | --- |
| [showcase_content.json](https://github.com/cont1nu1ty/guofeng-platform/blob/a94f4949b47ca08cb006a032aaa6b77ba91d12ee/deploy/fixtures/showcase_content.json) | 稿件、评审分支、云草稿、资讯、典籍、活动、课程、公益、资料和通知 |
| [catalog_content.json](https://github.com/cont1nu1ty/guofeng-platform/blob/a94f4949b47ca08cb006a032aaa6b77ba91d12ee/deploy/fixtures/catalog_content.json) | 首页轮播、媒体、阵地、人物目录与发布分支 |
| [records_content.json](https://github.com/cont1nu1ty/guofeng-platform/blob/a94f4949b47ca08cb006a032aaa6b77ba91d12ee/deploy/fixtures/records_content.json) | 两账号私人诵读、家庭约定、人物下架历史、录音投稿分支和四条中英文音频故事 |
| [files/投稿附页.pdf](https://github.com/cont1nu1ty/guofeng-platform/blob/a94f4949b47ca08cb006a032aaa6b77ba91d12ee/deploy/fixtures/files/投稿附页.pdf) | 中文文件名的私人稿件附件 |
| [files/资料使用指南.pdf](https://github.com/cont1nu1ty/guofeng-platform/blob/a94f4949b47ca08cb006a032aaa6b77ba91d12ee/deploy/fixtures/files/资料使用指南.pdf) | AI资料管理中的未索引文档示例 |
| [files/匿名评审工作说明.pdf](https://github.com/cont1nu1ty/guofeng-platform/blob/a94f4949b47ca08cb006a032aaa6b77ba91d12ee/deploy/fixtures/files/匿名评审工作说明.pdf) | 资料管理示例，不把原附件直接作为匿名稿件 |
| [用户端原创媒体](../../apps/miniapp/src/pkg-content/static/media/README.md) | 三组已有原创静音动画MP4与JPEG封面，导入时上传到当前S3 |

演示分支的账号与流程由 [seed-showcase.py](https://github.com/cont1nu1ty/guofeng-platform/blob/a94f4949b47ca08cb006a032aaa6b77ba91d12ee/deploy/seed-showcase.py) 编排，目录与人工咨询由 [seed-catalog.py](https://github.com/cont1nu1ty/guofeng-platform/blob/a94f4949b47ca08cb006a032aaa6b77ba91d12ee/deploy/seed-catalog.py) 编排。账号密码使用部署时随机生成的值；数据包不包含密码、会话、私钥、过期签名URL或数据库备份。作品和文件在每个新环境中生成自己的ID，公开端与管理端引用同一批持久化记录。

个人记录由演示分支的 [seed-demo-records.py](https://github.com/cont1nu1ty/guofeng-platform/blob/a94f4949b47ca08cb006a032aaa6b77ba91d12ee/deploy/seed-demo-records.py) 独立编排，复用仓库原创故事音频。完整 `seed-demo` 会执行此阶段；已有环境可只执行 `./deploy/dev seed-demo-records`。它使用独立指纹和完成标记，不改旧阶段标记，不覆盖已有同人物约定；完成后重跑不会恢复用户已删除的打卡或重置编辑。

活动和评审的时间窗口按导入时刻生成，便于展示开放、结束及过期等状态；运行多日后仍会受真实时间规则约束。轮播包含长期展示、未来、过期及草稿分支。模拟标题、人物、机构和结果均不代表真实运营事实。

本数据包复现的是仓库定义的初始演示状态，不是某台电脑编辑后的逐条快照。完整导入后，重复执行会保留用户后续修改；需要重新生成初始状态时使用先备份的 `reset-demo`。

主分支保留应用原有的前端 Mock 和静态音视频，以兼容界面演示与单元测试；这些资源不会在 HTTP 模式下自动变成数据库记录。主分支的导入命令缺包时提前拒绝，普通启动、迁移、备份和恢复不依赖此数据包。历史提交中已有的演示数据不改写历史；当前 main 文件树按上述边界排除。
