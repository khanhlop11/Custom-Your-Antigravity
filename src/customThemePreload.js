"use strict";
(() => {
    const { contextBridge, ipcRenderer, webFrame } = require("electron");

    const BACKEND_SWITCH = "--agy-backend=";
    const argv = typeof process !== "undefined" && Array.isArray(process.argv) ? process.argv : [];
    const isRemoteWindow = argv
        .find((a) => typeof a === "string" && a.startsWith(BACKEND_SWITCH))
        ?.slice(BACKEND_SWITCH.length) === "ssh";

    const g = globalThis;
    const loc = g.location;
    const isTopFrame = !g.top || !g.self || g.top === g.self;
    const isLocalHubOrigin = Boolean(
        loc &&
        /^https?:$/.test(loc.protocol || "") &&
        (loc.hostname === "127.0.0.1" || loc.hostname === "localhost")
    );

    const logToMain = (message) => {
        try {
            ipcRenderer.send("custom-theme:preload-log", String(message || "").slice(0, 300));
        }
        catch {
            // Ignore logging errors.
        }
    };

    if (!isRemoteWindow && isTopFrame && isLocalHubOrigin) {
        logToMain(`Preload active on ${loc?.origin || "local-hub"}`);
        const STYLE_ID = "agy-custom-theme-style";
        let lastExecutedJs = null;
        let lastAppliedCss = null;
        let applyChain = Promise.resolve();
        let domReadyPromise = null;

        const waitForDomInteractive = () => {
            if (!g.document) {
                return Promise.resolve();
            }
            if (g.document.readyState !== "loading") {
                return Promise.resolve();
            }
            if (!domReadyPromise) {
                domReadyPromise = new Promise((resolve) => {
                    g.document.addEventListener("DOMContentLoaded", () => resolve(), { once: true });
                });
            }
            return domReadyPromise;
        };

        const ensureStyleElement = (cssText) => {
            const doc = g.document;
            if (!doc) {
                return;
            }
            const parent = doc.head || doc.documentElement;
            if (!parent) {
                return;
            }
            let styleEl = doc.getElementById(STYLE_ID);
            if (!styleEl) {
                styleEl = doc.createElement("style");
                styleEl.id = STYLE_ID;
                styleEl.setAttribute("data-agy-custom-theme", "true");
                parent.appendChild(styleEl);
            }
            else if (doc.head && styleEl.parentNode !== doc.head) {
                doc.head.appendChild(styleEl);
            }
            const normalized = typeof cssText === "string" ? cssText : "";
            if (lastAppliedCss !== normalized || styleEl.textContent !== normalized) {
                styleEl.textContent = normalized;
                lastAppliedCss = normalized;
            }
        };

        const applyAssets = (assets, isLiveReload) => {
            if (!assets || typeof assets !== "object") {
                return Promise.resolve();
            }
            const css = typeof assets.css === "string" ? assets.css : "";
            const js = typeof assets.js === "string" ? assets.js : "";
            ensureStyleElement(css);

            applyChain = applyChain
                .then(async () => {
                    await waitForDomInteractive();
                    ensureStyleElement(css);
                    if (!js) {
                        return;
                    }
                    const shouldRun = isLiveReload ? js !== lastExecutedJs : lastExecutedJs === null;
                    if (!shouldRun) {
                        return;
                    }
                    lastExecutedJs = js;
                    await webFrame.executeJavaScript(js, false);
                })
                .catch((err) => {
                    console.error("[custom-theme] Failed to apply assets:", err);
                    logToMain(`applyAssets error: ${err && err.message ? err.message : String(err)}`);
                });
            return applyChain;
        };

        const fetchAndApplyAssets = async (isLiveReload) => {
            try {
                const assets = await ipcRenderer.invoke("custom-theme:get-assets");
                await applyAssets(assets, Boolean(isLiveReload));
                return assets;
            }
            catch (err) {
                console.error("[custom-theme] Failed to fetch assets:", err);
                logToMain(`fetchAssets error: ${err && err.message ? err.message : String(err)}`);
                return { css: "", js: "", version: 0 };
            }
        };

        const subscribe = (channel, callback) => {
            if (typeof callback !== "function") {
                return () => { };
            }
            const handler = (_event, payload) => {
                try {
                    callback(payload);
                }
                catch (err) {
                    console.error(`[custom-theme] Listener error on ${channel}:`, err);
                }
            };
            ipcRenderer.on(channel, handler);
            return () => {
                ipcRenderer.removeListener(channel, handler);
            };
        };

        const customThemeAPI = {
            getConfig: () => ipcRenderer.invoke("custom-theme:get-config"),
            saveConfig: (cfg) => ipcRenderer.invoke("custom-theme:save-config", cfg),
            resetConfig: () => ipcRenderer.invoke("custom-theme:reset-config"),
            onConfigChanged: (cb) => subscribe("custom-theme:config-changed", cb),
            uploadWallpaper: () => ipcRenderer.invoke("custom-theme:upload-wallpaper"),
            importWallpaperFromData: (payload) =>
                ipcRenderer.invoke("custom-theme:import-wallpaper-data", payload),
            listWallpapers: () => ipcRenderer.invoke("custom-theme:list-wallpapers"),
            deleteWallpaper: (filename) =>
                ipcRenderer.invoke("custom-theme:delete-wallpaper", filename),
            openThemeFolder: () => ipcRenderer.invoke("custom-theme:open-theme-folder"),
            getAssets: () => ipcRenderer.invoke("custom-theme:get-assets"),
            onAssetsReloaded: (cb) => subscribe("custom-theme:assets-reloaded", cb),
            reloadAssets: () => fetchAndApplyAssets(true),
        };

        contextBridge.exposeInMainWorld("customTheme", customThemeAPI);

        ipcRenderer.on("custom-theme:ensure-loaded", () => {
            void fetchAndApplyAssets(false);
        });

        ipcRenderer.on("custom-theme:assets-reloaded", (_event, assets) => {
            void applyAssets(assets, true);
        });

        void fetchAndApplyAssets(false);
        g.document?.addEventListener?.("DOMContentLoaded", () => {
            void fetchAndApplyAssets(false);
        });
        g.addEventListener?.("load", () => {
            void fetchAndApplyAssets(false);
        });
    }
})();
