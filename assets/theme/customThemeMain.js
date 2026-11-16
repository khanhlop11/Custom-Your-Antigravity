"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.THEME_SCHEME = void 0;
exports.getThemeRootDir = getThemeRootDir;
exports.handleThemeProtocolRequest = handleThemeProtocolRequest;
exports.initCustomThemeMain = initCustomThemeMain;

const electron_1 = require("electron");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const utils_1 = require("./utils");
const remoteWindowSecurity_1 = require("./remote/remoteWindowSecurity");

exports.THEME_SCHEME = "agy-theme";

const MAX_WALLPAPER_BYTES = 25 * 1024 * 1024;
const WATCH_DEBOUNCE_MS = 150;

const ALLOWED_EXT_MIME = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".bmp": "image/bmp",
};

const BUBBLE_PRESETS = new Set([
    "default",
    "charcoal-cat",
    "galaxy",
    "scroll",
    "jade-dragon",
    "moon-witch",
    "fox",
    "frost-glass",
]);

const INPUT_PRESETS = new Set([
    "glass",
    "neon-border",
    "pill-float",
    "minimal-flat",
]);

const DEFAULT_CONFIG = Object.freeze({
    version: 1,
    enabled: true,
    wallpaper: "",
    bgDim: 35,
    bgBlur: 0,
    sidebarOpacity: 55,
    sidebarBlur: 14,
    composerOpacity: 55,
    composerBlur: 16,
    panelOpacity: 72,
    panelBlur: 14,
    bubblePreset: "default",
    inputPreset: "glass",
});

let initialized = false;
let dirWatcher = null;
let watchDebounceTimer = null;
let assetsVersion = 1;
let lastAssetsSnapshot = { css: "", js: "" };
let lastConfigSerialized = "";

function getThemeRootDir() {
    let appDataBase = "";
    try {
        appDataBase = electron_1.app.getPath("appData");
    }
    catch {
        appDataBase = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    }
    return path.join(appDataBase, "Antigravity", "custom-theme");
}

function getWallpapersDir() {
    return path.join(getThemeRootDir(), "wallpapers");
}

function getConfigPath() {
    return path.join(getThemeRootDir(), "config.json");
}

function getCssPath() {
    return path.join(getThemeRootDir(), "theme.css");
}

function getJsPath() {
    return path.join(getThemeRootDir(), "custom-theme.js");
}

function isSubpath(parentDir, targetPath) {
    const normParent = process.platform === "win32" ? parentDir.toLowerCase() : parentDir;
    const normTarget = process.platform === "win32" ? targetPath.toLowerCase() : targetPath;
    const prefix = normParent.endsWith(path.sep) ? normParent : normParent + path.sep;
    return normTarget.startsWith(prefix);
}

function isSafeSingleFilename(name) {
    if (typeof name !== "string" || name.length === 0 || name.length > 200) {
        return false;
    }
    if (name.includes("/") || name.includes("\\") || name.includes("\0") || name.includes("..")) {
        return false;
    }
    if (name === "." || path.basename(name) !== name) {
        return false;
    }
    const ext = path.extname(name).toLowerCase();
    return Object.prototype.hasOwnProperty.call(ALLOWED_EXT_MIME, ext);
}

function resolveWallpaperFile(filename) {
    if (!isSafeSingleFilename(filename)) {
        return null;
    }
    const wallpapersDir = getWallpapersDir();
    let realWallpapersDir;
    try {
        realWallpapersDir = fs.realpathSync(wallpapersDir);
    }
    catch {
        return null;
    }
    const candidate = path.join(realWallpapersDir, filename);
    let lst;
    try {
        lst = fs.lstatSync(candidate);
    }
    catch {
        return null;
    }
    if (!lst.isFile() || lst.isSymbolicLink()) {
        return null;
    }
    let realFile;
    try {
        realFile = fs.realpathSync(candidate);
    }
    catch {
        return null;
    }
    if (!isSubpath(realWallpapersDir, realFile)) {
        return null;
    }
    return {
        path: realFile,
        size: lst.size,
        mtimeMs: lst.mtimeMs,
        ext: path.extname(filename).toLowerCase(),
    };
}

function detectImageMime(buf) {
    if (!Buffer.isBuffer(buf) || buf.length < 4) {
        return null;
    }
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
        buf.length >= 8 &&
        buf[0] === 0x89 &&
        buf[1] === 0x50 &&
        buf[2] === 0x4e &&
        buf[3] === 0x47 &&
        buf[4] === 0x0d &&
        buf[5] === 0x0a &&
        buf[6] === 0x1a &&
        buf[7] === 0x0a
    ) {
        return "image/png";
    }
    // JPEG: FF D8 FF
    if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
        return "image/jpeg";
    }
    // GIF: GIF87a / GIF89a
    if (buf.length >= 6) {
        const hdr6 = buf.subarray(0, 6).toString("ascii");
        if (hdr6 === "GIF87a" || hdr6 === "GIF89a") {
            return "image/gif";
        }
    }
    // WEBP: RIFF....WEBP
    if (
        buf.length >= 12 &&
        buf.subarray(0, 4).toString("ascii") === "RIFF" &&
        buf.subarray(8, 12).toString("ascii") === "WEBP"
    ) {
        return "image/webp";
    }
    // BMP: BM
    if (buf[0] === 0x42 && buf[1] === 0x4d) {
        return "image/bmp";
    }
    return null;
}

function buildWallpaperUrl(filename) {
    if (!filename) {
        return "";
    }
    return `${exports.THEME_SCHEME}://wallpaper/${encodeURIComponent(filename)}`;
}

function clampInt(val, min, max, fallback) {
    const n = typeof val === "number" ? val : Number(val);
    if (!Number.isFinite(n)) {
        return fallback;
    }
    return Math.min(max, Math.max(min, Math.round(n)));
}

function sanitizeStoredConfig(raw, base = DEFAULT_CONFIG) {
    const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    const wallpaperCandidate = typeof src.wallpaper === "string"
        ? src.wallpaper.trim()
        : base.wallpaper;
    const safeWallpaper = wallpaperCandidate && isSafeSingleFilename(wallpaperCandidate)
        ? wallpaperCandidate
        : "";
    const panelOpacity = clampInt(src.panelOpacity, 0, 95, base.panelOpacity);
    const panelBlur = clampInt(src.panelBlur, 0, 32, base.panelBlur);
    const fallbackSidebarOpacity = Number.isFinite(Number(src.panelOpacity)) ? panelOpacity : base.sidebarOpacity;
    const fallbackSidebarBlur = Number.isFinite(Number(src.panelBlur)) ? panelBlur : base.sidebarBlur;
    const fallbackComposerOpacity = Number.isFinite(Number(src.panelOpacity)) ? panelOpacity : base.composerOpacity;
    const fallbackComposerBlur = Number.isFinite(Number(src.panelBlur)) ? panelBlur : base.composerBlur;
    return {
        version: 1,
        enabled: typeof src.enabled === "boolean" ? src.enabled : base.enabled,
        wallpaper: safeWallpaper,
        bgDim: clampInt(src.bgDim, 0, 90, base.bgDim),
        bgBlur: clampInt(src.bgBlur, 0, 30, base.bgBlur),
        sidebarOpacity: clampInt(src.sidebarOpacity, 0, 95, fallbackSidebarOpacity),
        sidebarBlur: clampInt(src.sidebarBlur, 0, 32, fallbackSidebarBlur),
        composerOpacity: clampInt(src.composerOpacity, 0, 95, fallbackComposerOpacity),
        composerBlur: clampInt(src.composerBlur, 0, 32, fallbackComposerBlur),
        panelOpacity,
        panelBlur,
        bubblePreset: BUBBLE_PRESETS.has(src.bubblePreset) ? src.bubblePreset : base.bubblePreset,
        inputPreset: INPUT_PRESETS.has(src.inputPreset) ? src.inputPreset : base.inputPreset,
    };
}

function attachComputedFields(cfg) {
    const resolved = cfg.wallpaper ? resolveWallpaperFile(cfg.wallpaper) : null;
    const activeWallpaper = resolved ? cfg.wallpaper : "";
    return {
        ...cfg,
        wallpaper: activeWallpaper,
        wallpaperUrl: activeWallpaper ? buildWallpaperUrl(activeWallpaper) : "",
    };
}

function ensureThemeDirStructure() {
    const root = getThemeRootDir();
    const wallpapers = getWallpapersDir();
    fs.mkdirSync(root, { recursive: true });
    fs.mkdirSync(wallpapers, { recursive: true });
    const cfgPath = getConfigPath();
    if (!fs.existsSync(cfgPath)) {
        const text = JSON.stringify(DEFAULT_CONFIG, null, 2) + "\n";
        fs.writeFileSync(cfgPath, text, "utf8");
        lastConfigSerialized = text;
    }
}

function readStoredConfig() {
    ensureThemeDirStructure();
    try {
        const rawText = fs.readFileSync(getConfigPath(), "utf8");
        const parsed = JSON.parse(rawText);
        return sanitizeStoredConfig(parsed, DEFAULT_CONFIG);
    }
    catch {
        return { ...DEFAULT_CONFIG };
    }
}

function writeStoredConfig(cfg) {
    ensureThemeDirStructure();
    const clean = sanitizeStoredConfig(cfg, DEFAULT_CONFIG);
    const text = JSON.stringify(clean, null, 2) + "\n";
    const cfgPath = getConfigPath();
    const tmpPath = `${cfgPath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmpPath, text, "utf8");
    fs.renameSync(tmpPath, cfgPath);
    lastConfigSerialized = text;
    return clean;
}

function readAssetsFromDisk() {
    ensureThemeDirStructure();
    let css = "";
    let js = "";
    try {
        if (fs.existsSync(getCssPath())) {
            css = fs.readFileSync(getCssPath(), "utf8");
        }
    }
    catch {
        css = "";
    }
    try {
        if (fs.existsSync(getJsPath())) {
            js = fs.readFileSync(getJsPath(), "utf8");
        }
    }
    catch {
        js = "";
    }
    return { css, js };
}

function sanitizeWallpaperFilename(originalName, fallbackExt) {
    const rawExt = path.extname(typeof originalName === "string" ? originalName : "").toLowerCase();
    const ext = Object.prototype.hasOwnProperty.call(ALLOWED_EXT_MIME, rawExt)
        ? rawExt
        : fallbackExt;
    const base = path.basename(typeof originalName === "string" ? originalName : "wallpaper", path.extname(originalName || ""));
    const ascii = base
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9_-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48) || "wallpaper";
    const uniq = `${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;
    return `${ascii}-${uniq}${ext}`;
}

function isLoopbackUrl(rawUrl) {
    if (typeof rawUrl !== "string" || !rawUrl) {
        return false;
    }
    try {
        const u = new URL(rawUrl);
        return (
            (u.protocol === "https:" || u.protocol === "http:") &&
            (u.hostname === "127.0.0.1" || u.hostname === "localhost")
        );
    }
    catch {
        return false;
    }
}

function isLocalHubWebContents(wc) {
    if (!wc || typeof wc !== "object" || wc.isDestroyed?.()) {
        return false;
    }
    if (wc.getType?.() === "webview") {
        return false;
    }
    if ((0, remoteWindowSecurity_1.isRemoteContents)(wc)) {
        return false;
    }
    const localWins = (0, utils_1.getLocalHubWindows)();
    const isHub = localWins.some((w) => (0, utils_1.getHubWebContents)(w) === wc);
    if (!isHub) {
        return false;
    }
    const url = wc.getURL?.() || "";
    return isLoopbackUrl(url);
}

function isAuthorizedCustomThemeSender(event) {
    if (!(0, utils_1.isLocalHubTopFrame)(event)) {
        return false;
    }
    if ((0, remoteWindowSecurity_1.isRemoteContents)(event.sender)) {
        return false;
    }
    const frameUrl = event.senderFrame?.url || event.sender?.getURL?.() || "";
    return isLoopbackUrl(frameUrl);
}

function buildSidecarThemeScript(cfg) {
    const enabled = Boolean(cfg && cfg.enabled);
    const panelOpacity = Number.isFinite(cfg?.panelOpacity)
        ? Math.max(0, Math.min(0.95, cfg.panelOpacity / 100))
        : 0.72;
    const headerAlpha = (panelOpacity * 0.45).toFixed(2);
    const cardAlpha = (panelOpacity * 0.36).toFixed(2);
    const panelBlur = Number.isFinite(cfg?.panelBlur)
        ? Math.max(0, Math.min(32, Math.round(cfg.panelBlur)))
        : 14;
    const css = enabled
        ? [
            "html[data-agy-sidecar-theme=\"true\"] {",
            "  --sw-bg: transparent !important;",
            `  --sw-card: rgb(20 22 28 / ${cardAlpha}) !important;`,
            "  --sw-fill: rgb(255 255 255 / 0.05) !important;",
            "  background: transparent !important;",
            "  background-color: transparent !important;",
            "}",
            "html[data-agy-sidecar-theme=\"true\"][data-theme=\"light\"] {",
            `  --sw-card: rgb(255 255 255 / ${cardAlpha}) !important;`,
            "  --sw-fill: rgb(0 0 0 / 0.04) !important;",
            "}",
            "html[data-agy-sidecar-theme=\"true\"] body,",
            "html[data-agy-sidecar-theme=\"true\"] #board,",
            "html[data-agy-sidecar-theme=\"true\"] .board,",
            "html[data-agy-sidecar-theme=\"true\"] #tab-feed,",
            "html[data-agy-sidecar-theme=\"true\"] #tab-members,",
            "html[data-agy-sidecar-theme=\"true\"] #tab-graph,",
            "html[data-agy-sidecar-theme=\"true\"] #tab-overview,",
            "html[data-agy-sidecar-theme=\"true\"] [role=\"tabpanel\"],",
            "html[data-agy-sidecar-theme=\"true\"] main,",
            "html[data-agy-sidecar-theme=\"true\"] section,",
            "html[data-agy-sidecar-theme=\"true\"] .feed,",
            "html[data-agy-sidecar-theme=\"true\"] .list,",
            "html[data-agy-sidecar-theme=\"true\"] .pane,",
            "html[data-agy-sidecar-theme=\"true\"] .pane .o2,",
            "html[data-agy-sidecar-theme=\"true\"] #loading,",
            "html[data-agy-sidecar-theme=\"true\"] .loading,",
            "html[data-agy-sidecar-theme=\"true\"] #root,",
            "html[data-agy-sidecar-theme=\"true\"] #app,",
            "html[data-agy-sidecar-theme=\"true\"] #root > *,",
            "html[data-agy-sidecar-theme=\"true\"] #root > * > * {",
            "  background: transparent !important;",
            "  background-color: transparent !important;",
            "  background-image: none !important;",
            "}",
            "html[data-agy-sidecar-theme=\"true\"] .header,",
            "html[data-agy-sidecar-theme=\"true\"] .toolbar {",
            `  background: rgb(16 18 24 / ${headerAlpha}) !important;`,
            `  background-color: rgb(16 18 24 / ${headerAlpha}) !important;`,
            `  -webkit-backdrop-filter: blur(${panelBlur}px) !important;`,
            `  backdrop-filter: blur(${panelBlur}px) !important;`,
            "  box-shadow: none !important;",
            "}",
            "html[data-agy-sidecar-theme=\"true\"][data-theme=\"light\"] .header,",
            "html[data-agy-sidecar-theme=\"true\"][data-theme=\"light\"] .toolbar {",
            `  background: rgb(248 250 252 / ${headerAlpha}) !important;`,
            `  background-color: rgb(248 250 252 / ${headerAlpha}) !important;`,
            "}",
            "html[data-agy-sidecar-theme=\"true\"] .toolbar.stuck {",
            "  box-shadow: 0 1px 0 rgb(255 255 255 / 0.1) !important;",
            "}",
            "html[data-agy-sidecar-theme=\"true\"] body :is(.bg-background, .bg-shell, .bg-sidebar, [data-theme]) {",
            "  background-color: transparent !important;",
            "}",
            "html[data-agy-sidecar-theme=\"true\"] body :is(.card, .surface-card, .bg-card) {",
            `  background-color: rgb(20 22 28 / ${cardAlpha}) !important;`,
            "}",
        ].join("\n")
        : "";
    return `(() => {
  const ID = "agy-custom-theme-sidecar";
  const doc = document;
  const root = doc.documentElement;
  if (!root) return;
  const enabled = ${enabled};
  let el = doc.getElementById(ID);
  if (!enabled) {
    root.removeAttribute("data-agy-sidecar-theme");
    if (el) el.remove();
    return;
  }
  root.setAttribute("data-agy-sidecar-theme", "true");
  if (!el) {
    el = doc.createElement("style");
    el.id = ID;
    (doc.head || root).appendChild(el);
  }
  if (el.textContent !== ${JSON.stringify(css)}) {
    el.textContent = ${JSON.stringify(css)};
  }
})();`;
}

function isSidecarSubframe(frame, mainFrame) {
    if (!frame || frame === mainFrame) {
        return false;
    }
    try {
        const u = typeof frame.url === "string" ? frame.url : "";
        return u.startsWith("plugin://") || isLoopbackUrl(u);
    }
    catch {
        return false;
    }
}

const styledSubframeUrls = new Set();

function applySidecarThemeToFrame(frame, cfg) {
    if (!frame || frame.isDestroyed?.()) {
        return;
    }
    const url = typeof frame.url === "string" ? frame.url : "";
    const script = buildSidecarThemeScript(cfg);
    try {
        Promise.resolve(frame.executeJavaScript(script, false))
            .then(() => {
                if (url && !styledSubframeUrls.has(url)) {
                    styledSubframeUrls.add(url);
                    console.info(`[custom-theme] Sidecar subframe styled: ${url}`);
                }
            })
            .catch((err) => {
                console.warn(
                    `[custom-theme] Sidecar executeJavaScript failed (${url}):`,
                    err && err.message ? err.message : String(err)
                );
            });
    }
    catch {
        // Ignore frame navigation races.
    }
}

function applySidecarThemeToWebContents(wc, cfg) {
    if (!wc || wc.isDestroyed?.() || !isLocalHubWebContents(wc)) {
        return;
    }
    const mainFrame = wc.mainFrame;
    const frames = mainFrame?.framesInSubtree;
    if (!Array.isArray(frames) || frames.length <= 1) {
        return;
    }
    for (const frame of frames) {
        if (isSidecarSubframe(frame, mainFrame)) {
            applySidecarThemeToFrame(frame, cfg);
        }
    }
}

function broadcastToLocalHubs(channel, payload) {
    const syncSidecar = channel === "custom-theme:config-changed";
    for (const win of (0, utils_1.getLocalHubWindows)()) {
        const wc = (0, utils_1.getHubWebContents)(win);
        if (wc && !wc.isDestroyed?.() && isLocalHubWebContents(wc)) {
            try {
                wc.send(channel, payload);
                if (syncSidecar) {
                    applySidecarThemeToWebContents(wc, payload);
                }
            }
            catch {
                // Ignore destroyed window race.
            }
        }
    }
}

async function handleThemeProtocolRequest(request) {
    if (request.method !== "GET") {
        return new Response(null, { status: 405 });
    }
    let url;
    try {
        url = new URL(request.url);
    }
    catch {
        return new Response(null, { status: 404 });
    }
    if (url.protocol !== `${exports.THEME_SCHEME}:` || url.hostname !== "wallpaper") {
        return new Response(null, { status: 404 });
    }
    const rawSegment = url.pathname.startsWith("/") ? url.pathname.slice(1) : url.pathname;
    if (!rawSegment || rawSegment.includes("/") || /%2f|%5c/i.test(rawSegment)) {
        return new Response(null, { status: 404 });
    }
    let filename;
    try {
        filename = decodeURIComponent(rawSegment);
    }
    catch {
        return new Response(null, { status: 404 });
    }
    const resolved = resolveWallpaperFile(filename);
    if (!resolved || resolved.size <= 0 || resolved.size > MAX_WALLPAPER_BYTES) {
        return new Response(null, { status: 404 });
    }
    try {
        const bytes = await fsp.readFile(resolved.path);
        const detectedMime = detectImageMime(bytes);
        if (!detectedMime) {
            return new Response(null, { status: 404 });
        }
        return new Response(new Uint8Array(bytes), {
            status: 200,
            headers: {
                "Content-Type": detectedMime || ALLOWED_EXT_MIME[resolved.ext],
                "X-Content-Type-Options": "nosniff",
                "Content-Security-Policy": "default-src 'none'; sandbox",
                "Cache-Control": "no-store",
            },
        });
    }
    catch {
        return new Response(null, { status: 404 });
    }
}

function appendCspToken(cspHeader, directive, token) {
    const regex = new RegExp(`(^|;)\\s*${directive}\\s+([^;]+)`, "i");
    const m = regex.exec(cspHeader);
    if (!m) {
        const defMatch = /(^|;)\s*default-src\s+([^;]+)/i.exec(cspHeader);
        if (!defMatch) {
            return cspHeader;
        }
        const sep = cspHeader.trim().endsWith(";") ? " " : "; ";
        return `${cspHeader}${sep}${directive} ${defMatch[2].trim()} ${token}`;
    }
    const currentTokens = m[2].trim().split(/\s+/);
    if (currentTokens.includes(token) || currentTokens.includes("*")) {
        return cspHeader;
    }
    return cspHeader.replace(regex, (_full, sep, rest) => `${sep} ${directive} ${rest} ${token}`);
}

function installDefaultSessionCspRelaxation() {
    const ses = electron_1.session?.defaultSession;
    if (!ses?.webRequest?.onHeadersReceived) {
        return;
    }
    ses.webRequest.onHeadersReceived(
        {
            urls: [
                "https://127.0.0.1/*",
                "https://localhost/*",
                "http://127.0.0.1/*",
                "http://localhost/*",
            ],
        },
        (details, callback) => {
            const headers = details.responseHeaders;
            if (!headers) {
                callback({ cancel: false });
                return;
            }
            const cspKey = Object.keys(headers).find(
                (k) => k.toLowerCase() === "content-security-policy"
            );
            if (!cspKey || !Array.isArray(headers[cspKey])) {
                callback({ cancel: false });
                return;
            }
            const nextHeaders = {
                ...headers,
                [cspKey]: headers[cspKey].map((val) =>
                    typeof val === "string"
                        ? appendCspToken(val, "img-src", `${exports.THEME_SCHEME}:`)
                        : val
                ),
            };
            callback({ responseHeaders: nextHeaders });
        }
    );
}

function startThemeFolderWatcher() {
    ensureThemeDirStructure();
    lastAssetsSnapshot = readAssetsFromDisk();
    try {
        lastConfigSerialized = fs.readFileSync(getConfigPath(), "utf8");
    }
    catch {
        lastConfigSerialized = "";
    }
    if (dirWatcher) {
        return;
    }
    try {
        dirWatcher = fs.watch(getThemeRootDir(), { persistent: false }, (_eventType, filename) => {
            const name = typeof filename === "string" ? filename.toLowerCase() : "";
            if (name && name !== "theme.css" && name !== "custom-theme.js" && name !== "config.json") {
                return;
            }
            if (watchDebounceTimer) {
                clearTimeout(watchDebounceTimer);
            }
            watchDebounceTimer = setTimeout(() => {
                watchDebounceTimer = null;
                const nextAssets = readAssetsFromDisk();
                if (
                    nextAssets.css !== lastAssetsSnapshot.css ||
                    nextAssets.js !== lastAssetsSnapshot.js
                ) {
                    lastAssetsSnapshot = nextAssets;
                    assetsVersion += 1;
                    broadcastToLocalHubs("custom-theme:assets-reloaded", {
                        css: nextAssets.css,
                        js: nextAssets.js,
                        version: assetsVersion,
                    });
                }
                try {
                    const diskCfgText = fs.readFileSync(getConfigPath(), "utf8");
                    if (diskCfgText !== lastConfigSerialized) {
                        const parsed = JSON.parse(diskCfgText);
                        const normalized = sanitizeStoredConfig(parsed, DEFAULT_CONFIG);
                        lastConfigSerialized = diskCfgText;
                        broadcastToLocalHubs(
                            "custom-theme:config-changed",
                            attachComputedFields(normalized)
                        );
                    }
                }
                catch {
                    // Ignore partial writes while editing config.json.
                }
            }, WATCH_DEBOUNCE_MS);
        });
        dirWatcher.on("error", () => {
            // Keep app stable if watcher encounters transient FS errors.
        });
        dirWatcher.unref?.();
    }
    catch {
        // Non-fatal if fs.watch is unavailable.
    }
}

function stopThemeFolderWatcher() {
    if (watchDebounceTimer) {
        clearTimeout(watchDebounceTimer);
        watchDebounceTimer = null;
    }
    if (dirWatcher) {
        try {
            dirWatcher.close();
        }
        catch {
            // Ignore close errors.
        }
        dirWatcher = null;
    }
}

function registerCustomThemeIpc() {
    const assertCaller = (event, channel) => {
        if (!isAuthorizedCustomThemeSender(event)) {
            throw new Error(`Unauthorized ${channel} sender`);
        }
    };

    electron_1.ipcMain.on("custom-theme:preload-log", (event, message) => {
        if (!isAuthorizedCustomThemeSender(event)) {
            return;
        }
        const clean = typeof message === "string" ? message.slice(0, 300) : "";
        if (clean) {
            console.info(`[custom-theme] ${clean}`);
        }
    });

    electron_1.ipcMain.handle("custom-theme:get-config", (event) => {
        assertCaller(event, "custom-theme:get-config");
        return attachComputedFields(readStoredConfig());
    });

    electron_1.ipcMain.handle("custom-theme:save-config", (event, patch) => {
        assertCaller(event, "custom-theme:save-config");
        try {
            const current = readStoredConfig();
            const merged = sanitizeStoredConfig(
                patch && typeof patch === "object" && !Array.isArray(patch)
                    ? { ...current, ...patch }
                    : current,
                current
            );
            const saved = writeStoredConfig(merged);
            const full = attachComputedFields(saved);
            broadcastToLocalHubs("custom-theme:config-changed", full);
            return { ok: true, config: full };
        }
        catch (err) {
            const current = attachComputedFields(readStoredConfig());
            return {
                ok: false,
                config: current,
                error: err && err.message ? err.message : String(err),
            };
        }
    });

    electron_1.ipcMain.handle("custom-theme:reset-config", (event) => {
        assertCaller(event, "custom-theme:reset-config");
        try {
            const saved = writeStoredConfig({ ...DEFAULT_CONFIG });
            const full = attachComputedFields(saved);
            broadcastToLocalHubs("custom-theme:config-changed", full);
            return { ok: true, config: full };
        }
        catch (err) {
            const current = attachComputedFields(readStoredConfig());
            return {
                ok: false,
                config: current,
                error: err && err.message ? err.message : String(err),
            };
        }
    });

    electron_1.ipcMain.handle("custom-theme:upload-wallpaper", async (event) => {
        assertCaller(event, "custom-theme:upload-wallpaper");
        ensureThemeDirStructure();
        const ownerWin = (0, utils_1.resolveHubWindowFromWebContents)(event.sender);
        const dialogOpts = {
            title: "Select Wallpaper",
            properties: ["openFile"],
            filters: [
                {
                    name: "Images",
                    extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp"],
                },
            ],
        };
        let result;
        try {
            result = ownerWin
                ? await electron_1.dialog.showOpenDialog(ownerWin, dialogOpts)
                : await electron_1.dialog.showOpenDialog(dialogOpts);
        }
        catch {
            result = await electron_1.dialog.showOpenDialog(dialogOpts);
        }
        if (!result || result.canceled || !Array.isArray(result.filePaths) || result.filePaths.length === 0) {
            return { ok: true, canceled: true, url: "", filename: "" };
        }
        const srcPath = result.filePaths[0];
        try {
            const st = await fsp.stat(srcPath);
            if (!st.isFile()) {
                return { ok: false, canceled: false, url: "", filename: "", error: "Invalid file selected." };
            }
            if (st.size <= 0 || st.size > MAX_WALLPAPER_BYTES) {
                return {
                    ok: false,
                    canceled: false,
                    url: "",
                    filename: "",
                    error: "Image size must be between 1 byte and 25 MB.",
                };
            }
            const ext = path.extname(srcPath).toLowerCase();
            if (!Object.prototype.hasOwnProperty.call(ALLOWED_EXT_MIME, ext)) {
                return {
                    ok: false,
                    canceled: false,
                    url: "",
                    filename: "",
                    error: "Unsupported image format.",
                };
            }
            const buf = await fsp.readFile(srcPath);
            if (!detectImageMime(buf)) {
                return {
                    ok: false,
                    canceled: false,
                    url: "",
                    filename: "",
                    error: "File content is not a valid image.",
                };
            }
            const filename = sanitizeWallpaperFilename(path.basename(srcPath), ext);
            const destPath = path.join(getWallpapersDir(), filename);
            await fsp.writeFile(destPath, buf);
            return {
                ok: true,
                canceled: false,
                url: buildWallpaperUrl(filename),
                filename,
            };
        }
        catch (err) {
            return {
                ok: false,
                canceled: false,
                url: "",
                filename: "",
                error: err && err.message ? err.message : String(err),
            };
        }
    });

    electron_1.ipcMain.handle("custom-theme:import-wallpaper-data", async (event, payload) => {
        assertCaller(event, "custom-theme:import-wallpaper-data");
        ensureThemeDirStructure();
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
            return { ok: false, url: "", filename: "", error: "Invalid upload payload." };
        }
        const rawName = typeof payload.name === "string" ? payload.name.trim() : "";
        const rawBase64 = typeof payload.base64 === "string" ? payload.base64.trim() : "";
        if (!rawName || !rawBase64) {
            return { ok: false, url: "", filename: "", error: "Missing filename or image data." };
        }
        const ext = path.extname(rawName).toLowerCase();
        if (!Object.prototype.hasOwnProperty.call(ALLOWED_EXT_MIME, ext)) {
            return {
                ok: false,
                url: "",
                filename: "",
                error: "Only .png, .jpg, .jpeg, .webp, .gif, and .bmp formats are supported.",
            };
        }
        const cleanBase64 = rawBase64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/i, "").replace(/\s+/g, "");
        const maxBase64Len = Math.ceil((MAX_WALLPAPER_BYTES * 4) / 3) + 16;
        if (cleanBase64.length === 0 || cleanBase64.length > maxBase64Len) {
            return {
                ok: false,
                url: "",
                filename: "",
                error: "Image exceeds the 25 MB limit.",
            };
        }
        let buf;
        try {
            buf = Buffer.from(cleanBase64, "base64");
        }
        catch {
            return { ok: false, url: "", filename: "", error: "Failed to decode base64 image data." };
        }
        if (buf.length <= 0 || buf.length > MAX_WALLPAPER_BYTES) {
            return { ok: false, url: "", filename: "", error: "Image size must be <= 25 MB." };
        }
        if (!detectImageMime(buf)) {
            return { ok: false, url: "", filename: "", error: "File content is not a valid image." };
        }
        try {
            const filename = sanitizeWallpaperFilename(path.basename(rawName), ext);
            const destPath = path.join(getWallpapersDir(), filename);
            await fsp.writeFile(destPath, buf);
            return {
                ok: true,
                url: buildWallpaperUrl(filename),
                filename,
            };
        }
        catch (err) {
            return {
                ok: false,
                url: "",
                filename: "",
                error: err && err.message ? err.message : String(err),
            };
        }
    });

    electron_1.ipcMain.handle("custom-theme:list-wallpapers", async (event) => {
        assertCaller(event, "custom-theme:list-wallpapers");
        ensureThemeDirStructure();
        const wallpapersDir = getWallpapersDir();
        let realWallpapersDir;
        try {
            realWallpapersDir = await fsp.realpath(wallpapersDir);
        }
        catch {
            return [];
        }
        try {
            const entries = await fsp.readdir(realWallpapersDir, { withFileTypes: true });
            const items = [];
            for (const entry of entries) {
                if (!entry.isFile() || !isSafeSingleFilename(entry.name)) {
                    continue;
                }
                const resolved = resolveWallpaperFile(entry.name);
                if (!resolved) {
                    continue;
                }
                items.push({
                    filename: entry.name,
                    url: buildWallpaperUrl(entry.name),
                    size: resolved.size,
                    mtimeMs: resolved.mtimeMs,
                });
            }
            items.sort((a, b) => b.mtimeMs - a.mtimeMs);
            return items;
        }
        catch {
            return [];
        }
    });

    electron_1.ipcMain.handle("custom-theme:delete-wallpaper", async (event, filename) => {
        assertCaller(event, "custom-theme:delete-wallpaper");
        const resolved = resolveWallpaperFile(filename);
        if (!resolved) {
            return { ok: false, error: "Wallpaper does not exist or filename is invalid." };
        }
        try {
            await fsp.unlink(resolved.path);
            const cfg = readStoredConfig();
            if (cfg.wallpaper === filename) {
                const updated = writeStoredConfig({ ...cfg, wallpaper: "" });
                broadcastToLocalHubs("custom-theme:config-changed", attachComputedFields(updated));
            }
            return { ok: true };
        }
        catch (err) {
            return {
                ok: false,
                error: err && err.message ? err.message : String(err),
            };
        }
    });

    electron_1.ipcMain.handle("custom-theme:open-theme-folder", async (event) => {
        assertCaller(event, "custom-theme:open-theme-folder");
        ensureThemeDirStructure();
        const root = getThemeRootDir();
        try {
            const errMsg = await electron_1.shell.openPath(root);
            return errMsg ? { ok: false, path: root, error: errMsg } : { ok: true, path: root };
        }
        catch (err) {
            return {
                ok: false,
                path: root,
                error: err && err.message ? err.message : String(err),
            };
        }
    });

    electron_1.ipcMain.handle("custom-theme:get-assets", (event) => {
        assertCaller(event, "custom-theme:get-assets");
        const assets = readAssetsFromDisk();
        lastAssetsSnapshot = assets;
        const sender = event.sender;
        setTimeout(() => {
            applySidecarThemeToWebContents(sender, readStoredConfig());
        }, 350).unref?.();
        return {
            css: assets.css,
            js: assets.js,
            version: assetsVersion,
        };
    });
}

function attachHubWebContentsHooks() {
    electron_1.app.on("web-contents-created", (_event, contents) => {
        if (!contents || contents.isDestroyed?.()) {
            return;
        }
        if (
            (0, remoteWindowSecurity_1.isRemoteSession)(contents.session) ||
            contents.getType?.() === "webview"
        ) {
            return;
        }
        const notifyEnsureLoaded = () => {
            if (!isLocalHubWebContents(contents)) {
                return;
            }
            try {
                contents.send("custom-theme:ensure-loaded");
            }
            catch {
                // Ignore destroyed window race.
            }
        };
        const syncSubframes = () => {
            if (!isLocalHubWebContents(contents)) {
                return;
            }
            applySidecarThemeToWebContents(contents, readStoredConfig());
        };
        contents.on("dom-ready", notifyEnsureLoaded);
        contents.on("did-finish-load", () => {
            notifyEnsureLoaded();
            syncSubframes();
        });
        contents.on("did-frame-navigate", (event) => {
            if (!isLocalHubWebContents(contents)) {
                return;
            }
            const frame = event?.frame;
            if (isSidecarSubframe(frame, contents.mainFrame)) {
                applySidecarThemeToFrame(frame, readStoredConfig());
            }
        });
        contents.on("did-frame-finish-load", (event, _isMainFrame, frameProcessId, frameRoutingId) => {
            if (!isLocalHubWebContents(contents)) {
                return;
            }
            const frame =
                event?.senderFrame ||
                electron_1.webFrameMain?.fromId?.(frameProcessId, frameRoutingId);
            if (isSidecarSubframe(frame, contents.mainFrame)) {
                applySidecarThemeToFrame(frame, readStoredConfig());
            }
        });
    });
}

function initCustomThemeMain() {
    if (initialized) {
        return;
    }
    initialized = true;
    ensureThemeDirStructure();
    installDefaultSessionCspRelaxation();
    registerCustomThemeIpc();
    attachHubWebContentsHooks();
    startThemeFolderWatcher();
    electron_1.app.on("will-quit", stopThemeFolderWatcher);
    console.info("[custom-theme] Main initialized");
}
