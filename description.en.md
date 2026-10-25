# Repository blurb (GitHub About description)

## Copy this line into the About box on GitHub

```
chat.deepseek.com right inside DSH Desktop: a session-view tab, a top-left rail button and a main-area panel all share one signed-in page that survives panel switches and restarts; deepseek.com only, external links go to the system browser; zero host-side code, zero injection, zero replayed requests. Desktop only. 中文说明: README.md
```

## About the "link at the start of the description"

GitHub's About box accepts **plain text only and does not render Markdown** — a `[English](...)` written there shows up literally as characters you cannot click.

The place that is actually clickable and sits at the very top of the repository home page is **the README body**. So the language links live on the first line of each README:

- `README.md` line 1: `[简体中文](README.md) · [English](README.en.md)`
- `README.en.md` line 1: `[简体中文](README.md) · [English](README.en.md)`

The About box keeps a plain-text pointer (`中文说明: README.md`) so both sides can be found.

## Why the file is `README.en.md`, not `README.md.en`

GitHub **only renders files whose extension is `.md` as Markdown**. `README.md.en` has the extension `.en`, so it is served as raw text (you land on a screen of source code). The English README must therefore be named `README.en.md` (or `README-en.md`); same for `description.en.md`.

## Alternative: shorter About text

English (about 200 chars):

```
chat.deepseek.com inside DSH Desktop: three entry points share one signed-in page. No injected scripts, no replayed requests, no host-side code.
```

中文（约 60 字）：

```
在 DSH 桌面端里直接打开 chat.deepseek.com，三处入口共享同一个已登录页面。零注入、零代发请求。
```

## Repository settings worth setting

| Field | Value |
| --- | --- |
| Topics | `dsh-plugin` (required for marketplace listing), `dsh`, `electron`, `deepseek`, `webview` |
| Description | the "copy this line" text above |
| Website | empty, or the official DSH site |
