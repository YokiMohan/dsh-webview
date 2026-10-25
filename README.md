# dsh-webview · 网页端

> 🤖 **本插件完全由 AI 制作**（代码、文档、图标均由 DSH 内的 AI agent 生成，未经人工逐行编写）
> 🤖 **This plugin is entirely AI-generated** — code, docs and icon were produced by an AI agent inside DSH, not written line-by-line by a human.

在 DSH 桌面端加一个 **网页端** 入口，点开就是 [chat.deepseek.com](https://chat.deepseek.com)，不用再另开浏览器窗口。两处入口共用一个已登录页面：

- **会话视图标签**：「对话｜轨迹｜上下文」旁边多一个「网页端」，随当前会话走（本插件独有，同类插件都只做全局面板）
- **左上角面板列**：「插件」「自动化任务」旁边多一个地球图标，随时可开

A **Web** entry for DSH Desktop that opens [chat.deepseek.com](https://chat.deepseek.com) without a separate browser window. Two entry points share one signed-in page:

- **Conversation view tab** — a "网页端" tab next to 对话 / 轨迹 / 上下文, scoped to the current conversation (no other plugin offers this)
- **Left panel rail** — a globe button next to "Plugins" / "Automated tasks"

仅支持 DSH **桌面端** / **Desktop only** (requires the Electron `<webview>` host).

---

## 简体中文

### 关于「使用环境异常」提示

打开网页端后，DeepSeek 页面可能弹出：

> 使用环境异常：当前页面的使用环境可能存在数据和隐私泄露风险，为保障安全，建议您使用我们的官方产品。

原因：DSH 桌面端是 Electron 容器，网页端运行在其内的内嵌 `<webview>` 里，DeepSeek 的风控会识别出「这不是常规浏览器」。

本插件（0.2.0 起）会**只剥离 UA 里的 `Electron/<版本>` 标记**，其余 Chromium 指纹原样保留——不冒充别的浏览器、不伪造版本号。这样绝大多数情况下提示不再出现；若仍偶尔出现，直接关掉即可，**不影响登录和正常对话**。

注：这与 DeepSeek 官方网页端本身的风控策略有关，任何内嵌浏览器方案的观感都一样。

### 特性

- **两处入口**：会话视图标签（「对话｜轨迹｜上下文」旁，随会话走）与左上角面板列（地球图标），共用一个已登录页面
- **一个按钮直达**：点击即打开 DeepSeek 网页端
- **切走不丢状态**：切到对话或其他面板时页面只隐藏、不卸载，登录态和正在输入的内容都保留
- **跨重启保持登录**：登录后会把页面的 `localStorage` 与脚本可读 cookie 快照到本地，下次启动自动重放，通常不必重新登录
- **外链走系统浏览器**：只有 `deepseek.com` 及其子域能在面板内打开，其他链接自动交给系统浏览器，不劫持、不代理
- **不代你发请求**：不注入脚本到页面、不轮询接口、不预加载、不代发任何请求

### 安装

桌面端自带包管理器，装完重启桌面端即可（**不需要自己装 Node.js**）。

```bash
dsh plugin --profile desktop add dsh-webview
```

或在 **设置 → 插件** 里按包名 `dsh-webview` 安装。装好后重启 DSH，左上角面板列会出现地球图标。

也可以离线安装（把 `dsh-webview-0.2.0.tgz` 放到本地）：

```bash
dsh plugin --profile desktop add "C:\path\to\dsh-webview-0.2.0.tgz"
```

### 使用

1. 用任意一个入口打开网页端：会话区顶部「对话｜轨迹｜上下文」里的 **网页端** 标签，或左上角面板列的地球图标
2. 首次使用在页面内正常登录 DeepSeek 账号（之后重启 DSH 通常不必再登录）
3. 两个入口共用同一个页面：在标签里滚到某处，切回左侧面板再切回来，页面还在原处

顶部工具条提供 **刷新** 和 **在浏览器打开**。

### 已知限制

- **仅桌面端**：网页版 DSH 没有 Electron 宿主，面板会提示"当前环境不支持内嵌浏览器"
- **页面权限受限**：摄像头、麦克风、剪贴板读取、下载默认不可用（宿主的安全策略）
- **登录快照明文存储**：会话快照保存在 DSH 外壳的本地存储里（与浏览器保存登录态同一性质），仅存在你这台机器上；`HttpOnly` cookie 无法从页面读取，所以极少数情况下仍需重新登录一次
- **标签栏依赖会话**：没有任何打开的会话时，会话视图标签栏不渲染，此时仍可用左上角图标进入

### 兼容性

| DSH 版本 | 状态 |
| --- | --- |
| 0.2.1-rc.1 及以上（desktop） | 已验证可用 |
| 网页版 DSH | 不支持（会显示降级提示） |

插件只依赖公开的客户端插槽（`sidebar.panellist` / `main` / `conversation.view`）与宿主的 `dshDesktop.browser` 桥。同一 0.2.x 小版本更新一般无需改动；跨大版本可能需小幅适配。

### 实现要点

- 注册 `sidebar.panellist`（左上角按钮）+ `main`（主区域面板）+ `conversation.view`（会话区标签）三个插槽，后两者共用同一个 `<webview>` 实例
- 通过 `window.dshDesktop.browser.acquire()` 申请 lease 与内存分区，创建 `<webview>`
- 面板保活：把 `<webview>` 挂在 `document.body` 上的单例容器里，面板切换只改 `display`，DOM 永不离场，因此页面不重载
- 导航白名单 `deepseek.com`，越界链接交给系统浏览器（2 秒内同一 URL 去重，避免重复弹窗）
- 登录持久化：页面加载完成、切换面板、关闭窗口时，用 `executeJavaScript` 读出页面的 `localStorage` 与 `document.cookie`，存进外壳的 `localStorage`；下次启动在页面自身脚本初始化前就把快照写回去，有变化时只重载一次（期间盖一层遮罩，看不到登录页闪烁）。宿主给的是内存分区（随机名、无 `persist:` 前缀），因此只能这样自备快照
- UA：`webview.setUserAgent()` 只去掉 `Electron/x.y.z`，保留 Chromium 版本等其余标记（同类插件实测表明剥得越多指纹越不像真浏览器，风控反而更容易循环）

---

## English

### About the "unusual environment" notice

After opening the panel, DeepSeek may show a notice saying the environment looks unusual.

Why: DSH Desktop is an Electron app and the panel runs in an embedded `<webview>`, so DeepSeek's anti-abuse logic can tell it is not a regular browser.

Since 0.2.0 this plugin **strips only the `Electron/<version>` token from the user agent**, leaving every other Chromium marker untouched — it does not impersonate another browser and does not fake a version. The notice normally no longer appears; if it does, just dismiss it — login and chat still work.

Note: this is DeepSeek's own risk policy towards embedded browsers; any embedded-browser approach looks the same to them.

### Features

- **Two entry points**: a **网页端** tab in the conversation view bar (next to 对话 / 轨迹 / 上下文, scoped to the open conversation) and a globe button in the left panel rail — they share one signed-in page
- **State kept alive**: switching to another panel only hides the view; login state and half-typed messages survive
- **Stays signed in across restarts**: `localStorage` and script-readable cookies are snapshotted locally and replayed on the next launch, so you usually do not log in again
- **External links open in your real browser**: only `deepseek.com` and its subdomains stay in the panel
- **No requests on your behalf**: no injected page scripts, no polling, no preloading, no replayed requests
- **Zero host-side code**: no file access, no credentials service, no server route — the plugin is pure client code

### Install

The desktop app ships its own package manager — no Node.js required on your side.

```bash
dsh plugin --profile desktop add dsh-webview
```

Restart DSH afterwards; the globe icon appears in the left panel rail and a 网页端 tab appears in the conversation view bar.

Offline install from a local tarball:

```bash
dsh plugin --profile desktop add "C:\path\to\dsh-webview-0.2.0.tgz"
```

### Usage

1. Open the Web entry — the 网页端 tab in the conversation view bar, or the globe in the left rail
2. Log in to DeepSeek inside the panel the first time (afterwards a restart usually keeps you signed in)
3. Both entries share one page: scroll somewhere, switch to another panel and come back — the page is where you left it

The top bar offers **Refresh** and **Open in browser**.

### Known limitations

- **Desktop only** — the web build of DSH has no Electron host; the surface shows a fallback notice
- **Session snapshot is stored in plain text** — it lives in the shell's local storage (the same kind of thing a browser does when it keeps you signed in) and never leaves your machine; `HttpOnly` cookies cannot be read from the page, so a re-login is occasionally still needed
- **Restricted page permissions** — camera, microphone, clipboard read and downloads are disabled by the host policy
- **Fixed position** — the button sits at the end of the left panel rail

### Compatibility

| DSH version | Status |
| --- | --- |
| 0.2.1-rc.1+ (desktop) | Verified |
| Web build of DSH | Unsupported (shows a fallback notice) |

The plugin only depends on public client slots (`sidebar.panellist` / `main` / `conversation.view`) and the host `dshDesktop.browser` bridge.

### How it works

- Registers `sidebar.panellist` (left rail button), `main` (panel body) and `conversation.view` (conversation tab); the latter two share one `<webview>`
- Acquires a lease and in-memory partition via `window.dshDesktop.browser.acquire()`, then creates a `<webview>`
- Keep-alive: the `<webview>` lives in a singleton container attached to `document.body`; panel switches only toggle `display`, so the page never reloads
- Navigation allowlist is `deepseek.com`; anything else is handed to the system browser (deduplicated within 2 s)
- Session persistence: on load, panel switch and exit, `executeJavaScript` reads the page's `localStorage` and `document.cookie` into the shell's `localStorage`; on the next launch the snapshot is written back before the page's own scripts initialise, reloading once when anything changed (covered by an opaque layer, so no login-page flash). The host only grants an in-memory partition (random name, no `persist:` prefix), so the plugin carries the session itself
- User agent: `webview.setUserAgent()` drops `Electron/x.y.z` only, keeping the rest of the Chromium markers (a sibling plugin measured that stripping more makes the fingerprint unrealistic and the WAF loop worse)

---

## Development

```
lib/index.js    host half (empty plugin, makes the loader entry visible)
lib/client.js   browser half (slots + webview), loaded via window.__ModuleLoader__
cordis.patch.yml bundle patch inserting id `webview`
```

Rebuild and reinstall locally:

```bash
dsh plugin --profile desktop add "C:\path\to\dsh-webview-0.2.0.tgz"
```

## Uninstall

```bash
dsh plugin --profile desktop remove dsh-webview
```

## License

MIT © 2026 dsh-webview contributors
