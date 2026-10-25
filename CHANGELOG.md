# Changelog

全部版本均由 AI 生成 / All releases are AI-generated.

## 0.3.0

**新功能 / Added**

- 新增**会话视图标签**入口：「对话｜轨迹｜上下文」旁边多一个「网页端」，随当前会话走。它和左上角面板列的地球图标共用同一个 `<webview>` 与同一份登录态，所以在两个入口之间切换不会重新加载页面。
  A **conversation view tab** now hosts the panel: a 网页端 tab next to 对话 / 轨迹 / 上下文, scoped to the open conversation. It shares one `<webview>` and one signed-in session with the left-rail globe, so switching between the two never reloads the page.

**变更 / Changed**

- UA 只剥离 `Electron/<版本>`，不再一并剥掉应用自身 token：同类插件实测表明，剥得越多指纹越不像真浏览器，反而更容易触发风控循环，因此改为最小必要的剥离。
  The user agent now drops only `Electron/<version>`. Stripping the application token as well made the fingerprint less browser-like; a sibling plugin measured that this worsens the challenge loop, so the stripping is now minimal.

## 0.2.3

**修复 / Fixed**

- 快照可能被"未登录页面"覆盖：重启后首个 `did-stop-loading` 可能在恢复动作完成前就触发，把尚未恢复的登出态写回快照，导致下次启动彻底丢失登录。现在恢复完成前一律禁止写快照。
  A restart could overwrite the saved session with the signed-out page: the first `did-stop-loading` may fire before the restore finished. Snapshots are now blocked until the restore settles.
- 遮罩可能残留：恢复触发的刷新若未正常结束，遮罩会一直盖住页面。现在有 12 秒兜底，并且只在刷新真正开始 800ms 后才撤掉遮罩。
  The "restoring…" cover could get stuck if the reload never completed. It now has a 12s watchdog and only lifts 800ms after the reload actually started.
- 非桌面端（网页版 DSH）打开该面板时会盖出一块空白遮罩，挡住原本的"当前环境不支持"提示；现在不会再叠加遮罩。
  In the web profile the panel painted an empty overlay on top of its own "not supported here" message; the overlay is no longer created there.
- 内嵌浏览器初始化失败时面板会一直空白；现在直接把失败原因显示在面板上。
  A failed webview bootstrap left the panel blank; the reason is now shown in the panel.

## 0.2.2

**改进 / Improved**

- 消除"先闪一下登录页再自动登录"：恢复动作提前到首个真实文档的 `dom-ready`（页面自身脚本初始化之前），并在恢复与新页面加载期间盖一层"正在恢复上次登录…"的遮罩，加载完成自动撤掉。
  Removes the "login page flashes, then signs in by itself" moment: the restore now runs at the first real document's `dom-ready` (before the page's own scripts initialise), and an opaque "restoring your session…" layer covers the guest until the post-restore load finishes.

## 0.2.1

**修复 / Fixed**

- 修复"重启后仍要重新登录"：恢复不再以"页面 `localStorage` 为空"为前提（DeepSeek 首页一加载就会写入若干脚手架键，旧判断因此永远跳过恢复），现在只要有快照就写回，有变化时刷新一次。
  Fixed "still asks me to log in after a restart": restore no longer requires an empty `localStorage` (DeepSeek writes scaffolding keys on load, so the old check always skipped it). A stored snapshot is now always replayed, reloading once when anything changed.
- 恢复时机从 `dom-ready` 推迟到 `did-stop-loading`，避免页面还在初始化时写入被覆盖。
  Restore runs on `did-stop-loading` instead of `dom-ready`, so the page has finished initialising before the snapshot is written.
- 工具条新增一行状态文字（保存项数、cookie 数、恢复结果），排查问题不必开 DevTools。
  The toolbar now shows a one-line status (saved entry count, cookie count, restore result) so issues can be diagnosed without DevTools.

## 0.2.0

**新增 / Added**

- 跨重启保持登录：面板会在页面加载完成、切换面板和关闭窗口时，把 guest 页面的 `localStorage` 与脚本可读 cookie 存入 DSH 外壳的本地存储；下次启动在全新的分区里重放这些数据，无需重新登录。HttpOnly cookie 无法从页面读取，因此偶尔仍会要求重新登录。
  Stay signed in across restarts: the page's `localStorage` and script-readable cookies are snapshotted into the shell's local storage on load, on panel switch and on exit, then replayed into the fresh partition on the next launch. HttpOnly cookies are not readable from the page, so a re-login may occasionally still be required.
- 剥离 guest 的 Electron UA 标记：只移除 `Electron/<version>` 与应用自身 token，其余 Chromium 指纹保持不变，从而避开「使用环境异常」提示而不伪装成别的浏览器。
  The Electron user-agent token is dropped: only `Electron/<version>` and the application token are removed while the rest of the Chromium fingerprint is preserved, so the "unusual environment" notice is avoided without impersonating a different browser.

## 0.1.1

**修复 / Fixed**

- 修复打开面板后页面反复重载、DeepSeek 弹出"使用环境异常"并闪烁的问题：`dom-ready` 现在只执行一次启动，不再在每次文档加载后重新导航。
  Fixed the reload loop that made the page flash and repeatedly trigger DeepSeek's "unusual environment" notice: `dom-ready` now boots once instead of re-navigating on every document load.
- 修复首次打开停在空白页、需要手动点"首页"的问题：`about:blank#<lease>` 引导页不再被记作当前 URL。
  Fixed the blank first page that required clicking the home button: the `about:blank#<lease>` bootstrap page is no longer recorded as the current URL.
- 外链现在 2 秒内只唤起一次系统浏览器，避免同一链接重复弹窗。
  External links now open in the system browser at most once per 2 seconds.

## 0.1.0

首个版本 / Initial release.

- DSH 桌面端左侧面板列新增「网页端」地球图标，点击打开 chat.deepseek.com。
  Adds a "Web" globe button to the DSH Desktop left panel rail; opens chat.deepseek.com.
- 保活：切换面板只隐藏不卸载，登录态与输入内容保留。
  Kept-alive: switching panels only hides the page, preserving login state and drafts.
- 导航白名单仅 `deepseek.com` 及其子域，其余链接交给系统浏览器。
  Navigation allowlist: `deepseek.com` and subdomains only; other links go to the system browser.
