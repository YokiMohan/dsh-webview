# 仓库简介（GitHub About 描述）

## 复制这一行，粘到 GitHub 的 About 描述框

```
在 DSH 桌面端里直接打开 chat.deepseek.com：会话视图标签、左上角面板、主区域面板三个入口共享同一个已登录页面，切走不卸载、重启保持登录；只放行 deepseek.com，外链交系统浏览器；零宿主侧代码、零注入、不代发请求。桌面端专用。English README: README.md.en
```

## 关于「描述开头的跳转链接」

GitHub 的 About 描述框**只接受纯文本，不渲染 Markdown 链接**——写进去的 `[English](...)` 会原样显示成一串字符，点不了。

真正能点、而且就出现在仓库首页最上方的，是 **README 的正文**。所以语言跳转链接放在了 README 的第一行：

- `README.md` 第一行：`**简体中文** · [English](README.md.en)`
- `README.md.en` 第一行：`[简体中文](README.md) · **English**`

About 描述里则保留纯文本的提示（`English README: README.md.en`），中英两边互相指路。

## 备选：更短的 About 描述

中文（约 60 字）：

```
在 DSH 桌面端里直接打开 chat.deepseek.com，三处入口共享同一个已登录页面。零注入、零代发请求。
```

English（about 200 chars）：

```
chat.deepseek.com inside DSH Desktop: three entry points share one signed-in page. No injected scripts, no replayed requests, no host-side code.
```

## 建议同时设置的仓库设置

| 项目 | 值 |
| --- | --- |
| Topics | `dsh-plugin`（市场收录的硬性要求）、`dsh`、`electron`、`deepseek`、`webview` |
| Description | 上面「复制这一行」的内容 |
| Website | 留空或填 DSH 官方地址 |
