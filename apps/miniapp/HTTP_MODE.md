# 数据模式

默认 `VITE_DATA_MODE=demo` 保留本机演示。`VITE_DATA_MODE=http` 启用服务端数据与真实试点账号，`VITE_API_BASE_URL` 指向 `/api/v1`。这两个值在构建时注入，不包含用户密码或 S3 密钥。

```bash
VITE_DATA_MODE=http VITE_API_BASE_URL=/api/v1 npm run build:h5
VITE_DATA_MODE=http VITE_API_BASE_URL=https://your-domain.example/api/v1 npm run build:mp-weixin
```

H5 与网关同源时使用相对地址；微信使用手机可访问的完整地址，并按实际环境配置请求／上传／下载合法域名。编译通过不代表微信真机或平台审核通过。

- 登录入口位于个人中心和投稿页，使用平台提供的试点账号，不把登录当成实名认证。
- HTTP 模式读写当前账户的云草稿、附件、投稿、消息与其他记录，不迁移任何 `jiafeng:demo:*` 本机样例。退出或会话失效会清空账户数据视图。
- 云草稿带 `ETag/If-Match`；版本冲突保留当前编辑内容，提示用户复制需要保留的文字后重新加载。提交确认失败不清表，网络重试复用幂等键。
- 附件通过 `uni.uploadFile` 上传，只有返回服务端文件 ID 后才加入草稿。预览 URL 由服务端签发，不用于客户端声明文件归属。
- 专家工作台只显示服务端分配的匿名任务，采用服务端下发的四维量表；个人稿件的状态查询使用独立进度接口。
- 所有 HTTP 错误显示失败，不回落 Mock。原有 AI 对话、媒体样片、证书样张等尚未接通的展示仍保留其明确标识，不冒充真实推理、媒体处理或正式签发。

客户端边界在 `src/services/api.ts`，仓库查询适配在 `src/domain/remoteRepository.ts`；跨端网络使用 `uni.request` 与 `uni.uploadFile`。业务接口见根目录契约，HTTP 返回结构不散布到页面模板。

本轮首页与内容目录增量：六类Banner、可配置首页栏目/数据库统计、媒体上传审核与私有S3播放、阵地/人物目录、账号资讯订阅与即时站内消息、人工咨询已接通。实际边界和操作见 [目录管理](../../docs/frontend/catalog-management.md)。媒体样片仍为原创模拟内容；真实转码、AI与直播未由此完成。
