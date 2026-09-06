<p align="center">
  <img src="assets/icon-512.png" width="128" height="128" alt="ClipBridge 吉祥物">
</p>

<h1 align="center">ClipBridge</h1>

<p align="center"><a href="README.md">English</a> · 简体中文</p>

<p align="center"><strong>局域网设备传输，以及基于 GitHub 的 Agent 工作交接。</strong></p>

<p align="center"><strong>当前版本：0.7.12 · Agent Handoff Beta</strong></p>

ClipBridge 0.7 包含两项明确的核心工作流：

- **局域网中转：**在同一可信私人网络中的 Windows、Mac、iPhone、Android 及其他设备之间传输文字和文件。Windows 电脑或 Mac 可以作为中转节点，浏览器作为管理端和接收端。
- **Agent Handoff Beta：**通过用户已有的 GitHub 仓库，把尚未完成的 Git 工作以及继续工作所需的上下文转移到另一台电脑。创建和应用交接包需要 Git 与 Node.js，因此此功能仅支持电脑。

## 0.7 Agent Handoff

Agent Handoff 是 ClipBridge 当前的主要产品方向。它会传递已经提交的 Git 历史、尚未提交的受跟踪修改、结构化 Markdown 说明和机器可读状态，但不会尝试复制某一家 Agent 产品专有的聊天 Session。

1. 在发送电脑上选择已有 Git 项目，或者从已登录的 GitHub 账户拉取项目。
2. 确认 Git、Node.js、Git 项目和 GitHub 四项检查均为绿色，然后登记当前电脑。
3. 复制 ClipBridge 提供的官方 Prompt，发给当前正在处理项目的编程 Agent，再把 Agent 返回的完整交接说明粘贴回 ClipBridge。
4. 选择一台或多台已登记的接收电脑，然后发布交接。
5. 在接收电脑上打开同一个仓库，获取交接任务，预览交接包，并将它应用到干净的工作区。

界面把**发送交接**和**接收交接**明确分开。已有项目可以从 GitHub 安全快进更新；如果存在未提交修改、分叉历史、detached HEAD 或尚未推送的提交，ClipBridge 会停止操作，不会静默覆盖用户的工作。完整流程与安全模型请参阅 [Agent Handoff 指南](docs/agent-handoff.md)。

右上角的语言按钮可以在中文和英文之间切换整个界面。首次使用时会跟随浏览器语言，之后会在当前设备上记住用户的选择。

## 0.6 实验性在线 WebRTC 直传

[junfei-z.github.io/clipbridge](https://junfei-z.github.io/clipbridge/) 上的公开 HTTPS PWA 仍然可以使用，但经过可用性评估后已经暂停继续开发。0.7 的主要方向是稳定的局域网传输和 Agent Handoff。

1. 在两台设备上打开 `https://junfei-z.github.io/clipbridge/`。
2. 在其中一台设备上点击**创建连接**，获得临时六位房间码和二维码。
3. 在另一台设备上点击**加入连接**，输入房间码或扫描二维码。
4. 两边均显示**已直连**后，即可双向发送文字和文件。

公开 PWA 没有账户系统，也没有内容数据库。Cloudflare Durable Object 只负责临时传递 WebRTC offer 和 answer；六位房间码会在五分钟后过期，并且只允许两台设备加入。文字和文件仍通过 WebRTC DataChannel 在浏览器之间直接传输。部分限制严格的网络可能需要 TURN 中继；ClipBridge 会提示连接失败，不会把内容上传到不受信任的后备服务。详情请参阅[在线 PWA 指南](docs/online-pwa.md)。

## 0.7 局域网中转功能

- 使用一次性六位配对码或局域网二维码连接 iPhone、iPad、Mac、Android 或其他电脑。
- 为每台已配对设备生成独立的 256 位访问密钥。
- 中转节点只保存访问密钥的 SHA-256 哈希，不保存可以直接使用的密钥。
- 在 macOS 菜单栏或 Windows 通知区域中运行轻量原生中转客户端。
- 即使管理端和中转节点位于同一台电脑，也明确区分两种角色。
- 查看已配对设备的名称和最近连接时间。
- 单独撤销某台设备，不影响其他设备。
- 向 Windows 或 Mac 中转节点发送 Unicode 纯文本，并读取当前节点剪贴板。
- 在中转节点上使用专用剪贴板管理器，在远程设备上使用方向明确的**发送**和**接收**模式。
- 查看、复制、复用、删除或清空最近 50 条 ClipBridge 主动传输记录。
- 选择 Windows、iPhone、Mac 等命名目标，而不是固定单向发送。
- 一次选择多台设备并同时发送相同文字或文件。
- 为每台已配对设备维护互相隔离的收件箱，最多排队 50 条文字。
- 发送照片、视频、PDF、SVG、源代码、压缩包及其他文件。
- 文件直接流式写入中转电脑磁盘，支持进度显示和取消，不会把整个视频缓存在内存里。
- 安全预览常见图片、视频、PDF 和纯文本代码；SVG 与 HTML 只按文本展示，不会执行。
- 使用短时、一次性下载链接，设备访问密钥不会出现在 URL 中。
- 文件默认在 24 小时后、接收方删除时或相关设备被撤销时自动移除。
- 多目标文件只保存一份共享 Blob，每个接收方拥有独立的待接收或已下载状态。
- Windows 托盘、Mac 应用、浏览器和 iPhone 主屏幕使用同一套高分辨率 ClipBridge 图标。
- 迁移期间继续兼容 v0.1 共享令牌链接。

## 安全边界

0.7 的局域网配对和权限已经按设备隔离，但局域网传输仍使用普通 HTTP，**尚未加密**。请只在可信私人网络中运行 ClipBridge。不要把 `39393` 端口暴露到互联网，不要在公共 Wi-Fi 上使用，也不要传输密码、验证码、私钥或敏感工作资料。

配对码五分钟后过期、只能使用一次，并对连续错误尝试进行限速。二维码在本地生成；ClipBridge 不会把配对链接或剪贴板内容发送给二维码服务或其他云服务。

## 运行要求

- Windows 10 或更高版本，或者 macOS 12 或更高版本
- Node.js 20 或更高版本
- 中转节点和其他设备连接到同一可信 Wi-Fi 或私人局域网

## 在 Windows 上启动

下载并解压源码后，在项目目录中打开 PowerShell，首次使用时安装依赖：

```powershell
npm install
```

即使没有安装可选的二维码渲染依赖，ClipBridge 仍然可以通过六位配对码启动和配对，只是不会显示可扫描二维码。

双击：

```text
Start-ClipBridge-Tray.cmd
```

不需要管理员权限。临时命令窗口会自动关闭，默认浏览器会打开本机管理页面，ClipBridge 则继续在 Windows 通知区域中运行。再次启动只会打开现有管理页面，不会重复创建服务。

托盘菜单可以打开 Windows 管理页面、复制设备地址或停止 ClipBridge。开发和诊断时可以运行：

```powershell
npm start
```

Windows 防火墙可能询问是否允许 Node.js 接收连接。请只允许私人网络。

## 在 macOS 上启动

首次使用时在终端安装依赖，然后双击 `Start-ClipBridge-Mac.command`：

```bash
npm install
./Start-ClipBridge-Mac.command
```

启动器使用 Apple Command Line Tools 构建一个位于 `dist/ClipBridge.app` 的轻量 Objective-C/AppKit 菜单栏应用。使用 clang 而不是 Swift，可以避免 Apple 工具只更新了一部分时出现 Swift 编译器与 SDK 小版本不一致的问题。菜单可以打开管理页面、复制局域网设备地址或退出 Mac 中转。剪贴板读写使用系统自带的 `pbpaste` 和 `pbcopy`，Unicode 文本不会经过旧代码页转换。

角色定义、运行要求和 Mac 硬件验证边界请参阅 [macOS 中转指南](docs/macos-relay.md)。

### 配对 iPhone 或其他设备

1. 在 Windows 或 Mac 中转节点上打开 ClipBridge。
2. 在**已配对设备**中点击**配对新设备**。
3. 使用 iPhone 相机扫描局域网二维码，或者打开复制的设备地址并输入六位配对码。
4. 确认设备名称和类型，然后点击**安全配对**。
5. 设备会把自己的访问密钥保存在浏览器本地存储中，密钥不会写入 URL。

以后可以在中转节点上查看该设备并点击**撤销**。被撤销的设备会立即失去剪贴板访问权限，其他设备不受影响。

### 在 iPhone、Mac 和 Windows 之间发送文字

1. 将每台设备配对到同一个 Windows 或 Mac ClipBridge 中转节点。
2. 打开**发送**，选择一台或多台目标设备。
3. 发送到中转节点时，文字会立即写入 Windows 或 Mac 剪贴板。
4. 发送到其他设备时，文字会进入该设备在中转节点上的独立收件箱。
5. 接收方打开**接收**并点击**复制并收下**。该内容会离开收件箱，但仍保留在对应范围的历史记录中。

中转节点必须保持运行，而且所有设备必须处于同一可信私人网络。文字进入队列后，接收设备的浏览器不需要一直保持打开。

### 通过 Windows 从 Android 向 iPhone 发送文件

1. 将 Android 手机和 iPhone 都配对到同一个 Windows ClipBridge 服务。
2. 在 Android 上打开 ClipBridge，从**文字**切换到**文件**。
3. 选择已配对的 iPhone 和其他目标设备，选择一个或多个文件，然后点击**发送文件**。
4. 中转节点为每个文件保存一份不执行的临时 Blob，并为每个目标创建独立投递记录。
5. 在 iPhone 上打开**文件**，从该设备的独立文件收件箱中预览、下载或删除文件。

默认限制为单文件 256 MB、临时文件总空间 1 GB、保存时间 24 小时，可以在 `.clipbridge/config.json` 中修改。iOS 要求用户明确点击才能下载或保存文件；本地 HTTP 页面无法静默写入照片或文件 App。

### 添加到 iPhone 主屏幕

在 Safari 中完成配对后，点击**分享**，然后选择**添加到主屏幕**。保存的 Web App 会在 URL 中不携带令牌的情况下打开，并使用与桌面端相同的 ClipBridge 图标。由于非 HTTPS 局域网页面受到剪贴板权限限制，Safari 有时需要用户长按并手动选择复制。

### 启动失败

ClipBridge 会显示错误对话框，而不是留下一个空白命令窗口。诊断信息写入 `.clipbridge/server-error.log`。也可以在 PowerShell 中运行 `npm start`，直接查看服务输出。

## 本地保存的数据

ClipBridge 在中转程序旁的 `.clipbridge/` 目录保存本地状态：

- `config.json`：端口、稳定的中转节点身份与平台，以及用于兼容 v0.1 的旧令牌。
- `devices.json`：设备元数据和密钥哈希；可直接使用的设备密钥不会写入该文件。
- `history.json`：最多 50 条通过 ClipBridge 主动进行的文字传输，包括来源、目标和时间。
- `inbox.json`：每台目标设备最多 50 条待接收文字，直到设备接收、忽略或清空。
- `files.json`：共享 Blob 元数据以及每个目标的独立投递状态，包括来源、目标、大小、校验值和过期时间。
- `files/`：使用不透明名称保存的临时文件 Blob；原始文件名不会作为磁盘路径。

ClipBridge 不会监控或索引中转节点的每一次剪贴板变化。历史记录保存在 Windows 或 Mac 中转节点：本机管理页面可以看到所有记录，而已配对设备只能看到自己作为来源或目标的记录。双方都可以删除单条记录或清空当前可见范围。

## Apple 快捷指令迁移

0.7 推荐在 iPhone 上使用已配对的 Web App。迁移期间，v0.1 Apple 快捷指令仍可继续使用旧令牌，但命名目标和独立收件箱需要安全设备配对。兼容配置及其安全取舍请参阅 [iPhone 快捷指令指南](docs/iphone-shortcuts.md)。

## API

远程已配对设备使用 `POST /api/v1/pair` 返回的设备密钥：

```text
Authorization: Bearer <device-key>
```

### 配对设备

```http
POST /api/v1/pair
Content-Type: application/json

{"code":"123456","name":"Junfei's iPhone","type":"iphone"}
```

创建配对 Session、查看设备列表和撤销设备仅允许中转节点本机请求。

### 读取中转节点剪贴板

```http
GET /api/v1/clip
```

### 写入中转节点剪贴板

```http
POST /api/v1/clip
Content-Type: application/json

{"kind":"text","text":"Hello from iPhone"}
```

### 查看当前身份

```http
GET /api/v1/session
```

响应会区分浏览器 Session 与宿主进程：`session.role` 为 `management-device`，`relayNode.role` 为 `relay-node`。中转节点元数据也可以通过以下接口读取：

```http
GET /api/v1/node
```

本机管理 Session 拥有所有者权限，可以创建或撤销配对；远程已配对管理设备只能访问与自己有关的传输。

### 查看或清空剪贴板历史

```http
GET /api/v1/history?limit=50
DELETE /api/v1/history
DELETE /api/v1/history/<entry-id>
```

中转节点本机请求可以管理全部记录，已配对设备只能管理与自身身份有关的传输。

### 获取目标并发送文字

```http
GET /api/v1/peers
POST /api/v1/transfers
Content-Type: application/json

{"kind":"text","text":"Hello everyone","targetIds":["<relay-node-id>","<iphone-id>","<mac-id>"]}
```

为了兼容迁移，v0.4 的 `windows-host` 目标仍然可以作为当前中转节点的别名。

### 查看或清空当前设备收件箱

```http
GET /api/v1/inbox
DELETE /api/v1/inbox/<transfer-id>
DELETE /api/v1/inbox
```

收件箱接口按目标设备隔离，一台已配对设备无法查看或消费另一台设备的待接收内容。

### 发送和接收文件

上传原始文件 Body，在查询参数中重复提供一个或多个 `targetId`，并提供显示文件名。即使选择多个目标，文件 Body 也只保存一次：

```http
POST /api/v1/file-transfers?targetId=<iphone-id>&targetId=<mac-id>&name=photo.jpg
Content-Type: image/jpeg

<raw file bytes>
```

目标设备只能查看和清空自己的文件收件箱：

```http
GET /api/v1/file-inbox
DELETE /api/v1/file-inbox
DELETE /api/v1/file-transfers/<file-id>
```

发送方可以查看最近共享 Blob 的独立投递状态：

```http
GET /api/v1/file-outbox
```

`POST /api/v1/file-transfers/<file-id>/download` 会创建一个有效期 60 秒、只能使用一次的下载地址。URL 不包含设备密钥。支持安全预览的文件类型可以添加 `?inline=1`。

### 健康检查

```http
GET /health
```

## 版本状态与路线图

- **0.2.0：**设备身份、一次性配对、二维码配对、设备管理和撤销。
- **0.2.1：**带来源、目标和时间的本地剪贴板历史，最多 50 条，支持复用、复制和按权限清空。
- **0.3.0：**局域网多设备路由、命名目标、隔离收件箱，以及面向 Mac 和移动设备的浏览器/PWA 体验。
- **0.4.0：**流式局域网文件中转、按设备隔离的文件收件箱、安全预览、一次性下载、配额和自动过期。
- **0.4.1：**一对多文字/文件发送、共享 Blob 和按接收方独立记录投递状态。
- **0.5：**带明确管理端和中转节点角色的原生 Mac 客户端，已经发布并在 Mac 硬件上验证。
- **0.6：**实验性 HTTPS PWA 和 WebRTC 在线直传，已经发布；经过可用性评估后暂停继续开发。
- **0.7（当前版本）：**Agent Handoff Beta，包含 GitHub 账户和仓库发现、安全拉取/更新流程、发送与接收电脑登记、明确的角色 UI，以及可移植 Markdown/JSON/patch 交接包。详情请参阅 [Agent Handoff 指南](docs/agent-handoff.md)。
- **以后：**只有在出现明确工作流需求时，才重新考虑端到端加密离线中转。

## 开发

```powershell
npm install
npm test
```

ClipBridge 使用 MIT License。
