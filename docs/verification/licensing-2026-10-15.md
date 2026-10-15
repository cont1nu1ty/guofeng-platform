# 原创软件许可声明与检查

日期：2026-10-15。以下为 `codex/demo-data-bootstrap` 提交前工作区检查，范围为许可文本、来源声明和两端包元数据；没有改业务代码、第三方版本或运行配置。检查阶段尚未提交、推送或重部署，后续源码推送不代表运行环境已更新。

## 本次选择

用户明确选择：学习和非商业使用免费，任何商业用途均须其授权；学校、政府、慈善等机构不因身份自动豁免。用户确认有权授权项目原创部分，要求使用 GitHub 用户名与邮箱。

- 授权方：`cont1nu1ty`，GitHub 用户名经 API 核对。
- 联系邮箱：`808535fm@gmail.com`，来自当前仓库 Git 配置与最近三次提交；GitHub 公开资料未显示邮箱，接口权限不足以读取账户主邮箱，未扩大访问权限。因此这里不声称已核实它是 GitHub 账户主邮箱。
- 原创软件条款：[根 LICENSE](../../LICENSE)，自定义标识 `LicenseRef-Guofeng-Noncommercial-1.0`；它是包含商业限制的源码可用许可，不是 OSI 开源许可。
- 商业授权申请和组合分发待办：[说明](../../COMMERCIAL-LICENSE.txt)。本文件不是已签发的商业授权。
- README、第三方声明、`source-lock.json.projectLicense`、两前端包及 lockfile 的根包许可字段、家风 Java 模块 README 已同步。既有第三方许可和来源记录继续保留。

## 实际执行结果

| 检查 | 结果 | 边界 |
| --- | --- | --- |
| `git diff --check` | 通过 | 文本差异检查 |
| JSON、许可字段与相对路径 | 通过 | 两端 package 与 lockfile 的根包字段一致；指向实际存在的根 LICENSE；Java 模块链接可解析 |
| 依赖及来源记录保全 | 通过 | 两个 lockfile 的全部第三方包条目未变；原 `source-lock.json` 对象除新增 `projectLicense` 外未变 |
| 受保护文件 SHA-256 比对 | 65 个文件一致 | `licenses/`、`apps/server/LICENSE`、需求来源目录及既有两份未跟踪部署记录；不是重新审计全部运行依赖 |
| `apps/miniapp: npm run typecheck` | 通过 | 当前工作区 TypeScript 检查 |
| `apps/miniapp: npm test` | 25 个测试文件、146 项测试通过 | 既有自动化测试，无新增许可证业务测试 |
| `apps/miniapp: npm run build:h5` | 通过 | 编译仍提示两处字体 URL 留至运行时解析；本轮未做浏览器字体重验 |
| `apps/miniapp: npm run build:mp-weixin` | 通过 | 主包检查为 1,699,555 bytes，余量 397,597 bytes；两份唯一内联字体，无重复 WOFF。构建不是微信真机验收 |
| 独立文本复核 | 未发现明显范围冲突或内部矛盾 | 检查了第三方排除、商业用途定义、机构用途、相对路径和驱动待办；不代表律师审查或法律效力结论 |

没有界面、业务或适配行为变更，因此未重复桌面/手机交互检查，也未调整用户端功能完成状态、待办或演示步骤。没有运行后台测试、Java 测试、真实数据库探针或生产部署验收。

## 对外分发仍待处理

当前 Java 应用打包使用 MySQL Connector/J 9.7.0。其 Universal FOSS Exception 将适用的 Other FOSS 限定为完整对应源码且采用 OSI/FSF 自由软件许可；本次禁止商用的条款不满足这一许可条件。针对实际组合与分发方式，须处理驱动授权或完成替代驱动及验证，本轮未处理驱动，也未取得 Oracle 商业许可。不能用新增根 LICENSE 代替这个步骤。[Oracle 例外原文](https://oss.oracle.com/licenses/universal-foss-exception/)、[Oracle 商业许可说明](https://www.mysql.com/about/legal/licensing/oem/)。

Redis、Elasticsearch、FFmpeg、MySQL、JDK、OS 包等仍有各自的义务，不能据独立容器并列运行就宣称整套软件具有单一许可。单独发布前端包、源码归档、二进制或镜像时，应实际随附适用的根许可和第三方声明；当前源码仓库中的相对路径不代表独立发行包已包含这些文件。

本次没有改变此前已合法授予的许可。第三方声明中的历史库存、版本和检查日期继续表示原有证据，不冒充本轮重新构建或全量法律审计。
