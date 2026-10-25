window.__ModuleLoader__.load({
	id: "dsh-webview",
	factory: (require) => {
		"use strict";

		var module = { exports: {} };
		var exports = module.exports;

		const React = require("react");
		const h = React.createElement;

		const PANEL_ID = "webview";
		const HOME = "https://chat.deepseek.com/";
		/** Only the official DeepSeek properties may claim this panel. */
		const ALLOWED_DOMAINS = ["deepseek.com"];
		const LABEL = "网页端";
		const BAR_HEIGHT = 34;
		/** Shell storage key holding the last observed chat session. */
		const SESSION_KEY = "dsh-webview:session:v1";

		function allowedUrl(raw) {
			let url;
			try {
				url = new URL(String(raw));
			} catch {
				return false;
			}
			if (url.protocol !== "https:" && url.protocol !== "http:") return false;
			const host = url.hostname.toLowerCase();
			return ALLOWED_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
		}

		function openExternal(url) {
			try {
				window.open(url, "_blank", "noopener,noreferrer");
			} catch {
				/* the shell refuses or the popup was blocked — nothing else to do */
			}
		}

		/** Open a blocked navigation externally at most once per target every 2s. */
		const blockedRecently = new Map();

		function blockOnce(url) {
			const now = Date.now();
			const last = blockedRecently.get(url);
			if (last !== undefined && now - last < 2000) return;
			blockedRecently.set(url, now);
			if (blockedRecently.size > 32) blockedRecently.clear();
			openExternal(url);
		}

		/** Desktop-only bridge; undefined outside the packaged shell. */
		function browserBridge() {
			const desktop = globalThis.dshDesktop;
			if (!desktop || desktop.protocolVersion !== 1 || !desktop.browser) return undefined;
			return desktop.browser;
		}

		/**
		 * Guest user agent built from the shell's own, minus the Electron marker
		 * only. DeepSeek treats an Electron container as an "unusual environment",
		 * but stripping more than that token would leave a fingerprint that no real
		 * browser produces (a field report from a sibling plugin says mismatched
		 * version fingerprints make the challenge loop worse).
		 */
		function guestUserAgent() {
			const raw = typeof navigator === "object" ? String(navigator.userAgent ?? "") : "";
			if (raw === "") return undefined;
			const kept = raw.split(/\s+/).filter((token) => token !== "" && !/^electron\//i.test(token));
			const cleaned = kept.join(" ").trim();
			return cleaned === "" ? undefined : cleaned;
		}

		function applyUserAgent(guest) {
			const userAgent = guestUserAgent();
			if (userAgent === undefined) return;
			try {
				if (typeof guest.setUserAgent === "function") guest.setUserAgent(userAgent);
				else guest.setAttribute("useragent", userAgent);
			} catch (error) {
				console.error("[dsh-webview] cannot set the guest user agent", error);
			}
		}

		/** Runs inside the guest page: read its own cookies and localStorage. */
		const SNAPSHOT_SCRIPT = `(() => {
	try {
		const storage = {};
		for (let index = 0; index < localStorage.length; index += 1) {
			const key = localStorage.key(index);
			if (key === null) continue;
			storage[key] = localStorage.getItem(key);
		}
		return JSON.stringify({ version: 1, cookies: document.cookie || "", storage });
	} catch (error) {
		return "";
	}
})()`;

		/** Runs inside the guest page: write a stored snapshot back into this origin. */
		function restoreScript(snapshot) {
			const literal = JSON.stringify(snapshot ?? { storage: {}, cookies: "" });
			return `(() => {
	try {
		const saved = ${literal};
		const storage = saved && typeof saved.storage === "object" && saved.storage !== null ? saved.storage : {};
		let changed = false;
		for (const key of Object.keys(storage)) {
			const value = storage[key];
			if (typeof value !== "string") continue;
			if (localStorage.getItem(key) === value) continue;
			localStorage.setItem(key, value);
			changed = true;
		}
		const cookies = saved && typeof saved.cookies === "string" ? saved.cookies : "";
		for (const pair of cookies.split(";")) {
			const trimmed = pair.trim();
			if (trimmed === "" || !trimmed.includes("=")) continue;
			document.cookie = trimmed + "; path=/; domain=.deepseek.com; secure";
		}
		return changed ? "restored" : "unchanged";
	} catch (error) {
		return "restore-failed";
	}
})()`;
		}

		function readStoredSession() {
			try {
				const raw = window.localStorage.getItem(SESSION_KEY);
				if (raw === null || raw === "") return undefined;
				const parsed = JSON.parse(raw);
				return parsed && typeof parsed === "object" ? parsed : undefined;
			} catch (error) {
				console.error("[dsh-webview] cannot read the stored session", error);
				return undefined;
			}
		}

		function writeStoredSession(snapshot) {
			try {
				window.localStorage.setItem(SESSION_KEY, JSON.stringify(snapshot));
				return true;
			} catch (error) {
				console.error("[dsh-webview] cannot store the session", error);
				return false;
			}
		}

		const session = {
			restoreAttempted: false,
			/** Never capture the page before the stored session has been replayed. */
			restoreSettled: false,
			saving: false,
			lastSave: 0,
			timer: undefined,
			covering: false,
			reloadAt: 0,
			watchdog: undefined,
		};

		/** Opaque layer over the guest while a stored session is being replayed. */
		function showCover(text) {
			const cover = shell.cover;
			if (cover === undefined) return;
			cover.textContent = text;
			cover.style.display = "flex";
		}

		function hideCover() {
			const cover = shell.cover;
			if (cover === undefined) return;
			cover.style.display = "none";
		}

		/** One-line, human-readable state shown in the toolbar (no DevTools needed). */
		function setStatus(text) {
			const element = shell.status;
			if (element === undefined) return;
			element.textContent = text;
			element.title = text;
			element.style.display = text === "" ? "none" : "inline-block";
		}

		/** Copy the guest's live session into shell storage, at most every 2s. */
		function snapshotGuest() {
			const guest = shell.guest;
			// Writing before the stored session has been replayed would overwrite a
			// good snapshot with the signed-out page that the guest first rendered.
			if (!session.restoreSettled) return;
			if (guest === undefined || session.saving) return;
			const now = Date.now();
			if (now - session.lastSave < 2000) return;
			session.lastSave = now;
			session.saving = true;
			Promise.resolve()
				.then(() => guest.executeJavaScript(SNAPSHOT_SCRIPT))
				.then((raw) => {
					if (typeof raw !== "string" || raw === "") {
						setStatus("读取页面存储失败（executeJavaScript 无返回）");
						return;
					}
					const snapshot = JSON.parse(raw);
					if (!snapshot || typeof snapshot !== "object") return;
					if (typeof snapshot.cookies !== "string") snapshot.cookies = "";
					if (!snapshot.storage || typeof snapshot.storage !== "object") return;
					const keys = Object.keys(snapshot.storage).length;
					const cookieCount = snapshot.cookies === "" ? 0 : snapshot.cookies.split(";").length;
					if (keys === 0 && cookieCount === 0) return;
					snapshot.savedAt = Date.now();
					const stored = writeStoredSession(snapshot);
					setStatus(stored ? `已保存 ${keys} 项 + ${cookieCount} 个 cookie` : "写入本地存储失败");
				})
				.catch((error) => {
					console.error("[dsh-webview] snapshot failed", error);
					setStatus(`读取页面存储失败：${error instanceof Error ? error.message : String(error)}`);
				})
				.finally(() => {
					session.saving = false;
				});
		}

		/** Replay the stored session into the fresh partition, once per process. */
		function restoreGuest() {
			if (session.restoreAttempted) return;
			session.restoreAttempted = true;
			const guest = shell.guest;
			const snapshot = readStoredSession();
			if (guest === undefined || snapshot === undefined) {
				session.restoreSettled = true;
				setStatus("没有可恢复的登录快照");
				hideCover();
				return;
			}
			showCover("正在恢复上次登录…");
			Promise.resolve()
				.then(() => guest.executeJavaScript(restoreScript(snapshot)))
				.then((result) => {
					console.info("[dsh-webview] session restore:", result);
					if (result === "restored") {
						setStatus("已恢复上次登录，正在刷新…");
						session.covering = true;
						session.reloadAt = Date.now();
						// Never leave the cover behind if the reload never resolves.
						session.watchdog = setTimeout(() => {
							session.covering = false;
							hideCover();
						}, 12000);
						guest.reload();
						return;
					}
					setStatus(`登录快照已应用：${String(result)}`);
					hideCover();
				})
				.catch((error) => {
					console.error("[dsh-webview] cannot restore the session", error);
					setStatus(`恢复登录失败：${error instanceof Error ? error.message : String(error)}`);
					hideCover();
				})
				.finally(() => {
					session.restoreSettled = true;
				});
		}

		/** Called after a load finishes: drop the cover once the reload settled. */
		function settleCover() {
			if (!session.covering) return;
			// The document that is being replaced also emits did-stop-loading; only
			// the load started after the reload counts.
			const elapsed = Date.now() - session.reloadAt;
			if (elapsed < 800) {
				setTimeout(settleCover, 800 - elapsed + 50);
				return;
			}
			session.covering = false;
			clearTimeout(session.watchdog);
			hideCover();
		}

		function startSessionTimer() {
			if (session.timer !== undefined) return;
			session.timer = setInterval(snapshotGuest, 60000);
		}

		/**
		 * Singleton overlay. The guest webview must never leave the document, so
		 * the panel body reserves layout space and this overlay is positioned onto
		 * it; switching panels only hides the overlay.
		 */
		const shell = {
			overlay: undefined,
			toolbar: undefined,
			address: undefined,
			host: undefined,
			guest: undefined,
			lease: undefined,
			releaseOpen: undefined,
			url: HOME,
			booting: false,
						status: undefined,
			cover: undefined,
		};

		function makeButton(text, onClick) {
			const button = document.createElement("button");
			button.type = "button";
			button.textContent = text;
			button.style.cssText = [
				"all: unset",
				"cursor: pointer",
				"padding: 2px 8px",
				"border-radius: 6px",
				"font-size: 12px",
				"line-height: 18px",
				"color: var(--dsw-alias-label-secondary, #666)",
				"white-space: nowrap",
			].join(";");
			button.addEventListener("click", (event) => {
				event.preventDefault();
				onClick();
			});
			button.addEventListener("mouseenter", () => {
				button.style.background = "var(--dsw-alias-bg-l2, rgba(0,0,0,.06))";
			});
			button.addEventListener("mouseleave", () => {
				button.style.background = "transparent";
			});
			return button;
		}

		function ensureShell() {
			if (shell.overlay !== undefined) return shell.overlay;

			const overlay = document.createElement("div");
			overlay.setAttribute("data-dsh-webview", "root");
			overlay.style.cssText = [
				"position: fixed",
				"display: none",
				"flex-direction: column",
				"overflow: hidden",
				"box-sizing: border-box",
				"background: var(--dsw-alias-bg-base, #ffffff)",
				"z-index: 30",
			].join(";");

			const toolbar = document.createElement("div");
			toolbar.style.cssText = [
				"flex: 0 0 auto",
				`height: ${BAR_HEIGHT}px`,
				"display: flex",
				"align-items: center",
				"gap: 6px",
				"padding: 0 8px",
				"box-sizing: border-box",
				"border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(0,0,0,.08))",
			].join(";");

			const address = document.createElement("span");
			address.textContent = HOME;
			address.style.cssText = [
				"flex: 1 1 auto",
				"min-width: 0",
				"overflow: hidden",
				"text-overflow: ellipsis",
				"white-space: nowrap",
				"font-size: 12px",
				"color: var(--dsw-alias-label-tertiary, #888)",
			].join(";");

			const status = document.createElement("span");
			status.textContent = "";
			status.style.cssText = [
				"flex: 0 0 auto",
				"font-size: 11px",
				"line-height: 18px",
				"padding: 0 6px",
				"border-radius: 6px",
				"background: var(--dsw-alias-bg-l2, rgba(0,0,0,.06))",
				"color: var(--dsw-alias-label-tertiary, #888)",
				"white-space: nowrap",
				"max-width: 40%",
				"overflow: hidden",
				"text-overflow: ellipsis",
				"display: none",
			].join(";");

			toolbar.append(
				address,
				status,
				makeButton("首页", () => navigate(HOME)),
				makeButton("刷新", () => {
					const guest = shell.guest;
					if (guest === undefined) return;
					try {
						guest.reload();
					} catch (error) {
						console.error("[dsh-webview] reload failed", error);
					}
				}),
				makeButton("浏览器打开", () => openExternal(shell.url)),
			);

			const host = document.createElement("div");
			host.style.cssText = "flex: 1 1 auto; min-height: 0; position: relative;";

			const cover = document.createElement("div");
			cover.style.cssText = [
				"position: absolute",
				"inset: 0",
				"display: none",
				"align-items: center",
				"justify-content: center",
				"font-size: 13px",
				"color: var(--dsw-alias-label-tertiary, #888)",
				"background: var(--dsw-alias-bg-base, #ffffff)",
				"z-index: 9999",
			].join(";");

			host.append(cover);
			overlay.append(toolbar, host);
			document.body.appendChild(overlay);

			shell.overlay = overlay;
			shell.toolbar = toolbar;
			shell.address = address;
			shell.status = status;
			shell.host = host;
			shell.cover = cover;
			return overlay;
		}

		function navigate(url) {
			const guest = shell.guest;
			if (guest === undefined) {
				shell.url = url;
				if (shell.address !== undefined) shell.address.textContent = url;
				return;
			}
			try {
				guest.loadURL(url);
			} catch (error) {
				console.error("[dsh-webview] loadURL failed", error);
			}
		}

		function attachGuest() {
			if (shell.guest !== undefined || shell.booting) return;
			const bridge = browserBridge();
			if (bridge === undefined) return;
			shell.booting = true;
			Promise.resolve()
				.then(() => bridge.acquire(PANEL_ID))
				.then((reservation) => {
					if (!reservation || typeof reservation.lease !== "string") throw new Error("no reservation");
					shell.lease = reservation.lease;

					const guest = document.createElement("webview");
					guest.setAttribute("partition", reservation.partition);
					guest.setAttribute("name", reservation.lease);
					guest.setAttribute("allowpopups", "");
					guest.setAttribute("src", `about:blank#${reservation.lease}`);
					guest.style.cssText = "display: flex; width: 100%; height: 100%;";
					guest.dataset.dshWebviewFrame = "webview";

					// Boot exactly once per document. `dom-ready` fires again after
					// every navigation, so re-navigating here would reload forever.
					guest.addEventListener("dom-ready", () => {
						const current = typeof guest.getURL === "function" ? String(guest.getURL() ?? "") : "";
						if (current.startsWith("about:blank")) {
							if (guest.dataset.booted === "1") return;
							guest.dataset.booted = "1";
							applyUserAgent(guest);
							navigate(HOME);
						}
					});
					// Replay the stored session as early as the first real document
					// allows, so the app most likely reads the restored keys on its
					// own first render instead of showing the signed-out page.
					guest.addEventListener("dom-ready", () => {
						const current = typeof guest.getURL === "function" ? String(guest.getURL() ?? "") : "";
						if (current.startsWith("about:blank")) return;
						restoreGuest();
					});
					guest.addEventListener("did-stop-loading", () => {
						const current = typeof guest.getURL === "function" ? String(guest.getURL() ?? "") : "";
						if (current.startsWith("about:blank")) return;
						// A reload issued by the restore lands here: drop the cover.
						settleCover();
						restoreGuest();
						startSessionTimer();
						snapshotGuest();
					});
					guest.addEventListener("did-navigate", (event) => {
						if (typeof event.url === "string" && event.url.startsWith("about:blank")) return;
						shell.url = event.url;
						if (shell.address !== undefined) shell.address.textContent = event.url;
					});
					guest.addEventListener("did-navigate-in-page", (event) => {
						if (!event.isMainFrame) return;
						shell.url = event.url;
						if (shell.address !== undefined) shell.address.textContent = event.url;
					});
					guest.addEventListener("did-start-navigation", (event) => {
						if (!event.isMainFrame) return;
						if (typeof event.url !== "string" || event.url.startsWith("about:blank")) return;
						if (allowedUrl(event.url)) return;
						try {
							guest.stop();
						} catch {
							/* ignore */
						}
						blockOnce(event.url);
					});
					guest.addEventListener("will-navigate", (event) => {
						if (typeof event.url !== "string" || event.url.startsWith("about:blank")) return;
						if (allowedUrl(event.url)) return;
						event.preventDefault();
						blockOnce(event.url);
					});
					guest.addEventListener("render-process-gone", () => {
						console.error("[dsh-webview] guest process gone");
					});

					if (typeof bridge.onOpenRequested === "function") {
						shell.releaseOpen = bridge.onOpenRequested(reservation.lease, (url) => {
							if (allowedUrl(url)) return;
							openExternal(url);
						});
					}

					shell.host.appendChild(guest);
					shell.guest = guest;
				})
				.catch((error) => {
					console.error("[dsh-webview] cannot create guest", error);
					const message = error instanceof Error ? error.message : String(error);
					setStatus(`内嵌浏览器初始化失败：${message}`);
					showCover(`内嵌浏览器初始化失败：${message}\n\n可点「浏览器打开」改用系统浏览器。`);
				})
				.finally(() => {
					shell.booting = false;
				});
		}

		/**
		 * One guest, several mount points: the left panel and the per-conversation
		 * tab can both host this surface, but never at the same time.
		 */
		const anchors = [];

		function visibleAnchor() {
			for (const frame of anchors) {
				if (!frame.isConnected) continue;
				const rect = frame.getBoundingClientRect();
				if (rect.width > 0 && rect.height > 0) return rect;
			}
			return undefined;
		}

		function syncRect() {
			const overlay = shell.overlay;
			if (overlay === undefined) return;
			const rect = visibleAnchor();
			if (rect === undefined) return;
			overlay.style.left = `${rect.left}px`;
			overlay.style.top = `${rect.top}px`;
			overlay.style.width = `${rect.width}px`;
			overlay.style.height = `${rect.height}px`;
		}

		/** Hosts the shared guest on whichever surface is currently mounted. */
		function WebViewSurface() {
			const ref = React.useRef(null);

			React.useEffect(() => {
				const frame = ref.current;
				if (frame === null) return undefined;
				// Outside the desktop shell the surface renders its own fallback;
				// never paint an empty guest overlay on top of it.
				if (browserBridge() === undefined) return undefined;
				const overlay = ensureShell();
				anchors.push(frame);
				syncRect();
				overlay.style.display = "flex";
				attachGuest();

				const observer = typeof ResizeObserver === "function" ? new ResizeObserver(syncRect) : undefined;
				observer?.observe(frame);
				window.addEventListener("resize", syncRect);
				const timer = setInterval(syncRect, 500);

				return () => {
					clearInterval(timer);
					observer?.disconnect();
					window.removeEventListener("resize", syncRect);
					const index = anchors.indexOf(frame);
					if (index >= 0) anchors.splice(index, 1);
					if (anchors.length === 0) {
						overlay.style.display = "none";
						snapshotGuest();
					} else {
						syncRect();
					}
				};
			}, []);

			if (browserBridge() === undefined) {
				return h(
					"div",
					{
						ref,
						style: {
							display: "flex",
							flex: "1 1 auto",
							alignItems: "center",
							justifyContent: "center",
							height: "100%",
							fontSize: 13,
							color: "var(--dsw-alias-label-tertiary, #888)",
						},
					},
					h("div", { style: { textAlign: "center", lineHeight: 1.8 } },
						h("div", null, "当前环境不支持内嵌浏览器面板（仅 DSH 桌面端可用）。"),
						h("button", {
							type: "button",
							style: { marginTop: 8, cursor: "pointer", padding: "4px 10px" },
							onClick: () => openExternal(HOME),
						}, "在浏览器中打开 chat.deepseek.com"),
					),
				);
			}

			return h("div", { ref, style: { width: "100%", height: "100%", minHeight: 0 } });
		}

		const Panel = WebViewSurface;

		function PanelIcon(props) {
			const size = typeof props?.size === "number" ? props.size : 18;
			const active = props?.active === true;
			return h(
				"svg",
				{
					width: size,
					height: size,
					viewBox: "0 0 24 24",
					fill: "none",
					stroke: "currentColor",
					strokeWidth: active ? 1.9 : 1.6,
					strokeLinecap: "round",
					strokeLinejoin: "round",
					"aria-hidden": "true",
				},
				h("circle", { cx: 12, cy: 12, r: 9 }),
				h("path", { d: "M3 12h18" }),
				h("path", { d: "M12 3c2.6 2.5 4 5.6 4 9s-1.4 6.5-4 9c-2.6-2.5-4-5.6-4-9s1.4-6.5 4-9Z" }),
			);
		}

		function apply(ctx) {
			console.info("[dsh-webview] 0.3.0 loaded");
			try {
				window.addEventListener("beforeunload", () => snapshotGuest());
			} catch {
				/* nothing to persist outside the shell */
			}
			ctx.slots.inject("sidebar.panellist", () =>
				ctx.slots.register(
					{
						name: "sidebar.panellist",
						id: PANEL_ID,
						order: 100,
						label: () => LABEL,
					},
					PanelIcon,
				),
			);
			ctx.slots.inject("main", () =>
				ctx.slots.register(
					{
						name: "main",
						key: PANEL_ID,
					},
					Panel,
				),
			);
			// Per-conversation view, next to 对话 / 轨迹 / 上下文. Same guest, so a
			// signed-in session is shared with the left panel entry.
			ctx.slots.inject("conversation.view", () =>
				ctx.slots.register(
					{
						name: "conversation.view",
						id: PANEL_ID,
						order: 40,
						label: () => LABEL,
					},
					Panel,
				),
			);
		}

		module.exports = { apply, inject: ["slots"] };
		return module.exports;
	},
});
