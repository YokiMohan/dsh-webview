[简体中文](README.md) · [English](README.en.md)

# dsh-webview · Web panel

Open [chat.deepseek.com](https://chat.deepseek.com) right inside DSH Desktop — no browser switching, no re-login.

> 🤖 **Entirely AI-generated**: code, docs and icon were produced by an AI agent inside DSH, not written line by line by a human.

---

## Three entry points, one page

| Entry | Where | Good for |
| --- | --- | --- |
| **Session view tab** | A **网页端 (Web)** tab next to 对话 / 轨迹 / 上下文 above the conversation | Checking something mid-chat, follows the active session |
| **Top-left panel rail** | Globe icon beside 插件 / 自动化任务 | Full-screen use, in and out anytime |
| **Main-area panel** | The full-screen panel those two open | Immersive, sidebar still usable |

All three **share a single page instance**: scroll somewhere in the tab, switch to the panel and back, and the page is still where you left it. Sign-in state and half-typed messages survive.

---

## Why this one

Most comparable plugins give you one global panel. What makes dsh-webview different:

| | dsh-webview | Typical embedded browser plugin |
| --- | --- | --- |
| Session-view tab entry | ✅ yes (not seen elsewhere) | ❌ global button only |
| Entries sharing one page | ✅ three entries, one instance, never unmounted | ⚠️ rare |
| Host-side code | ✅ none (`lib/index.js` is an empty plugin, only there so the loader sees the entry) | ⚠️ usually needed, to move HttpOnly cookies |
| Page capabilities | ✅ minimal: no file access, no credentials, no replayed requests | ⚠️ varies |
| Navigation scope | ✅ whitelist `deepseek.com`, anything else goes to the system browser | ⚠️ often unrestricted |
| Size / deps | ✅ ~22KB single file, zero runtime dependencies, no build step | ⚠️ usually hundreds of KB |

**It never sends requests on your behalf**: no injected scripts, no API polling, no preloading, no proxying. It does exactly one thing — puts the web client into a sandboxed embedded browser.

---

## Install

DSH Desktop ships its own package manager, **no Node.js install required**:

```bash
dsh plugin --profile desktop add dsh-webview
```

Restart DSH: a globe icon appears in the top-left rail and a 网页端 tab appears in the session view bar.

Offline install (with `dsh-webview-0.3.0.tgz` on disk):

```bash
dsh plugin --profile desktop add "C:\path\to\dsh-webview-0.3.0.tgz"
```

---

## Usage

1. Open either entry: the **网页端** tab above the conversation, or the globe icon in the top-left rail
2. Sign in to your DeepSeek account once inside the page (after that a DSH restart usually needs no re-login)
3. The toolbar offers **reload** and **open in browser**

**About the "unusual environment" notice**: DSH Desktop is an Electron container, and DeepSeek's risk control can tell it is not an ordinary browser. This plugin only strips the `Electron/<version>` token from the user agent and keeps every other Chromium fingerprint intact — it does not impersonate another browser or fake a version number. In most cases the notice stops appearing; if it still shows up, just dismiss it. **It does not affect sign-in or chatting.**

---

## How sign-in survives a restart

The host gives embedded pages an **in-memory partition** (random name, no `persist:` prefix, wiped when the process exits), so the plugin stores a session snapshot itself:

- When the page finishes loading, when the panel is switched away, and when the window closes, it reads the page's `localStorage` and script-readable cookies and stores them in the DSH shell's `localStorage`
- On the next launch it writes the snapshot back **before the page's own scripts initialise**, reloads at most once, and covers the page meanwhile so you never see a login-page flash

The snapshot is exactly the same kind of data as "remember me" in a browser, **stays on your machine**, is never uploaded and never touches the network. `HttpOnly` cookies are not readable from the page, so in rare cases one extra sign-in is still needed.

---

## Known limitations

- **Desktop only**: the web build of DSH has no Electron host, so the panel shows "embedded browser is not available in this environment"
- **Restricted page capabilities**: camera, microphone, clipboard read and downloads are unavailable by default (host security policy)
- **The tab needs a session**: with no conversation open the session view bar is not rendered; use the top-left icon instead
- **Fixed position**: the button sits at the end of the left panel rail

---

## Compatibility

| DSH version | Status |
| --- | --- |
| 0.2.1-rc.1 and later (desktop) | verified working |
| Web build of DSH | unsupported (shows a fallback notice) |

The plugin only relies on public client slots (`sidebar.panellist` / `main` / `conversation.view`) and the host `dshDesktop.browser` bridge. Patch releases within 0.2.x generally need no changes; a major bump may need small adjustments.

---

## Implementation notes

- Registers three slots: `sidebar.panellist` (top-left button), `main` (main-area panel) and `conversation.view` (session tab); the latter two share the same `<webview>` instance as the first
- Acquires a lease and an in-memory partition via `window.dshDesktop.browser.acquire()`, then creates the `<webview>`
- Keep-alive: the `<webview>` lives in a singleton container on `document.body`; switching panels only toggles `display`, the DOM never leaves, so the page never reloads
- Navigation whitelist `deepseek.com`; external links go to the system browser (same URL deduplicated within 2 seconds to avoid duplicate prompts)
- UA: `webview.setUserAgent()` removes only `Electron/x.y.z`, keeping the rest of the Chromium markers

---

## Uninstall

```bash
dsh plugin --profile desktop remove dsh-webview
```

## Development

```
lib/index.js     host half (empty plugin, only so the loader entry is visible)
lib/client.js    browser half (slots + webview), loaded through window.__ModuleLoader__
cordis.patch.yml bundle patch that inserts the entry with id `webview`
```

## License

MIT © 2026 dsh-webview contributors
