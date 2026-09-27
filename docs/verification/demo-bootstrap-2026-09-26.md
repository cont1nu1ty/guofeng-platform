# 2026-09-26 显式演示数据导入验证

本页保留 `codex/demo-data-bootstrap` 在所记日期的历史运行事实，不是本次 main 拆分后的重新测试。数据、专用探针及本页新增截图/原始结果保留在[固定提交 a94f494](https://github.com/cont1nu1ty/guofeng-platform/tree/a94f4949b47ca08cb006a032aaa6b77ba91d12ee/)；main 只保留本说明与功能代码，以下证据链接指向该固定提交。

分支：`codex/demo-data-bootstrap`。本次增加宿主机显式命令 `./deploy/dev seed-demo`，默认 `up` 不导入；没有额外导入容器。导入仓库中的虚构数据源、原始PDF及媒体，通过当前后端创建业务关联并写入私有S3。操作见[部署说明](../../deploy/README.md#显式导入演示数据)。

## 自动化检查

[22项单元测试](https://github.com/cont1nu1ty/guofeng-platform/blob/a94f4949b47ca08cb006a032aaa6b77ba91d12ee/docs/verification/previews/demo-bootstrap-2026-09-26/unit-tests.txt)通过：15项导入生命周期测试、7项既有重置安全测试。覆盖默认启动不调用导入、数据指纹和项目不匹配拒绝、完整安装只读跳过、基础阶段中断不重放、不根据旧本地清单冒充已完成、目录检查点恢复、上传成功后检查点失败时复用原文件，以及改过初始账号后零写入拒绝。

执行命令：

```bash
python3 -m unittest discover -s deploy/tests -p 'test_*.py' -v
```

本次复核发现并修复了初始账号保护缺口：仅确认六个ID不足以判断空业务底座。现在同时核对版本、启用状态、身份、角色和地区；已被管理员调整的环境会在任何导入标记、账号或业务写入前停止。

## 全新容器环境实测

使用独立项目 `jiafeng-demo-bootstrap-check`、端口19080/19333及全新数据卷。复用已构建的server/web镜像，以当前Compose配置执行 `up --no-build --wait`；没有重建应用代码。通过[真实流程探针](https://github.com/cont1nu1ty/guofeng-platform/blob/a94f4949b47ca08cb006a032aaa6b77ba91d12ee/deploy/tests/demo_bootstrap_probe.py)完成[14项检查](https://github.com/cont1nu1ty/guofeng-platform/blob/a94f4949b47ca08cb006a032aaa6b77ba91d12ee/docs/verification/previews/demo-bootstrap-2026-09-26/runtime-checks.json)：

- 默认启动只有6个开发账号、基础配置和专家资料，没有稿件、活动、公开目录或文件。
- 无可信标记的非空数据拒绝导入，已有内容不变；移除测试专用阻挡记录后，首次显式导入成功。
- 数据库包含13个账号、16篇稿件、17份修订、51条评审任务，以及10条轮播、7条媒体、4处阵地、3份人物档案、2条咨询。
- 公开接口实际返回7条轮播（含独立英文版）、4条媒体、7条资讯；中文文件名私人PDF经授权下载后与原始文件校验和一致。
- 通过后台接口修改一条草稿，再执行导入，业务数据校验和不变，修改保留。
- 删除该项目的本地清单后重跑，仍依据数据库标记跳过；模拟目录已完成但整体完成标记未保存的重试，同样没有重复数据。
- 执行 `down` 再 `up --no-build --wait` 重建容器，保留数据卷；全部业务数据及编辑校验和不变，再次导入仍跳过。

随后在另一个全新项目 `jiafeng-demo-bootstrap-accounts`（19081/19334）执行[账号保护实测](https://github.com/cont1nu1ty/guofeng-platform/blob/a94f4949b47ca08cb006a032aaa6b77ba91d12ee/docs/verification/previews/demo-bootstrap-2026-09-26/account-guard-check.json)：模拟初始投稿账号被禁用并递增版本，导入拒绝且不写任何安装标记或业务；测试自行恢复原状态后，真实六账号底座通过新校验。这个边界在初次14项全流程之后单独验证，没有把它写成首次流程已执行的检查。

两个测试项目的容器与网络已停止移除，数据卷保留用于复核；没有删除任何原项目卷。原 `jiafeng-dev` 未执行导入或重置，[前后核对](https://github.com/cont1nu1ty/guofeng-platform/blob/a94f4949b47ca08cb006a032aaa6b77ba91d12ee/docs/verification/previews/demo-bootstrap-2026-09-26/original-environment-check.json)确认实体数量、账号/文件数量和用户编辑过的英文资讯标题不变。

## 边界与复现

基础阶段被中断后的拒绝、目录上传成功后检查点失败的恢复由单元测试模拟；实际容器检查覆盖目录收尾重试，没有声称进行过全部进程崩溃注入或多机并发导入。生命周期锁保护同一工作目录；应由一个操作入口管理同一Compose项目。

需要重跑真实探针时，先准备名称以 `jiafeng-demo-bootstrap-` 开头的独立空环境和不冲突端口，启动健康后指定其配置：

```bash
JIAFENG_ENV_FILE=deploy/.local/你的独立环境.env python3 deploy/tests/demo_bootstrap_probe.py
```

探针会修改测试草稿、删除自己的本地清单并重建该项目容器，不能直接用于已有演示数据。最新源码的探针已纳入初始账号检查，后续完整执行会包含15项检查；本页14项全流程及单独账号检查分别保留当次事实。

本次未修改用户端或后台页面源码，沿用[上一轮两端验证](catalog-2026-09-26.md)，未重跑前端四项检查、微信真机、全国容量或生产部署验收。
