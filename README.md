# Antigravity Custom Theme

A local, cosmetic-only UI customization mod for **Antigravity Desktop** on Windows. Customize your workspace with local wallpapers, per-surface glassmorphism controls, chat bubble themes, and prompt composer styles—with zero network requests and zero modifications to core agent/runtime logic.

---

## Features

- **Local Wallpaper Engine**: Serves local wallpapers offline via the internal `agy-theme://wallpaper/<filename>` custom protocol (`PNG`, `JPG`, `WebP`, `GIF`, `BMP` up to `25 MB`).
- **Independent Glassmorphism Controls**: Separate opacity and backdrop-blur sliders for the background wallpaper, left sidebar, prompt composer, and right side panel / Swarm board.
- **8 Chat Bubble Presets**: `Default`, `Charcoal Cat`, `Galaxy`, `Scroll`, `Jade Dragon`, `Moon Witch`, `Fox`, and `Frost Glass`.
- **4 Prompt Input Presets**: `Frosted Glass`, `Neon Glow`, `Floating Pill`, and `Minimal Flat`.
- **Live Settings Integration**: Native-styled **Custom Theme** tab under **Settings**, with instant hot-reload (`config.json`, `theme.css`, `custom-theme.js`) and no app restart required for appearance tweaks.
- **Reversible ASAR Patcher**: Automatically backs up `app.asar` with SHA-256 verification and supports clean byte-for-byte restoration.

---

## Requirements & Scope

- **Target Application**: Antigravity Desktop at `%LOCALAPPDATA%\Programs\antigravity` (`resources\app.asar`).
- **Runtime**: Windows PowerShell and Node.js (if Node.js is not installed globally, `install.ps1` and `uninstall.ps1` automatically fall back to `Antigravity.exe` with `ELECTRON_RUN_AS_NODE=1`). No `npm install` needed.
- **Theme Data Directory**: `%APPDATA%\Antigravity\custom-theme\`
  - `config.json` — Active theme preferences.
  - `theme.css` & `custom-theme.js` — Hot-reloaded UI assets.
  - `wallpapers\` — Uploaded wallpaper files.
- **Safety Scope**: Patches only `resources\app.asar` (`dist/customThemeMain.js`, `dist/customThemePreload.js`, and minimal hooks in `dist/main.js`, `dist/preload.js`, `dist/customScheme.js`). Leaves `language_server.exe`, authentication, API keys, telemetry, and auto-updater untouched.

---

## Installation

1. Close Antigravity completely (including the system tray icon), or pass `-ForceClose`.
2. Open PowerShell in the repository root and run:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

Optional flags:
- `-ForceClose` — Automatically terminates running `Antigravity` processes before patching.
- `-AsarPath "<path>"` — Specifies a custom `app.asar` location if installed outside the default path.

You can check the current patch status at any time:

```powershell
node .\scripts\patch-asar.js status
```

**How backups work:** On first install, `scripts\patch-asar.js` saves an untouched backup to `resources\app.asar.orig.bak` and records its hash in `resources\app.asar.orig.sha256` (never overwriting an original backup with a patched file). Existing `config.json` and `wallpapers\` in `%APPDATA%\Antigravity\custom-theme\` are preserved.

---

## Customization (`Settings -> Custom Theme`)

Open **Settings** in Antigravity and select **Custom Theme** from the left sidebar (below **Appearance**). All adjustments save automatically to `config.json` and update in real time:

### 1. Wallpaper
- Click **Upload Wallpaper** or drag & drop an image into the dropzone.
- Select from saved thumbnails, click **No Wallpaper** to clear, or delete individual wallpapers.

### 2. Opacity & Glassmorphism Sliders
| Setting | Range | Default | Description |
| :--- | :--- | :--- | :--- |
| **Background Dim** | `0% – 90%` | `35%` | Darkens the wallpaper layer to improve text contrast. |
| **Background Blur** | `0px – 30px` | `0px` | Applies Gaussian blur to the wallpaper layer. |
| **Left Sidebar Opacity** | `0% – 95%` | `55%` | Independent background opacity for the left sidebar. |
| **Left Sidebar Glass Blur** | `0px – 32px` | `14px` | Independent backdrop blur for the left sidebar. |
| **Prompt Input Opacity** | `0% – 95%` | `55%` | Independent background opacity for the prompt composer. |
| **Prompt Input Glass Blur** | `0px – 32px` | `16px` | Independent backdrop blur for the prompt composer. |
| **Side Panel & Swarm Opacity** | `0% – 95%` | `72%` | Background opacity for the right side panel, Swarm board, cards, and dialogs. |
| **Side Panel & Swarm Blur** | `0px – 32px` | `14px` | Backdrop blur for the right side panel, Swarm board, and dialogs. |

### 3. Presets & Utilities
- **Chat Bubble Presets**: `default`, `charcoal-cat`, `galaxy`, `scroll`, `jade-dragon`, `moon-witch`, `fox`, `frost-glass`.
- **Chat Input Presets**: `glass`, `neon-border`, `pill-float`, `minimal-flat`.
- **Open Folder**: Opens `%APPDATA%\Antigravity\custom-theme\` in File Explorer.
- **Reset to Defaults**: Restores default theme settings without deleting saved wallpapers.

---

## Re-applying After Antigravity Updates

When Antigravity auto-updates, `resources\app.asar` is replaced by the new release:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 -ForceClose
```

`scripts\patch-asar.js` detects the updated upstream `app.asar`, archives the previous backup to `app.asar.prev.orig.bak`, updates `app.asar.orig.bak` / `app.asar.orig.sha256`, and re-applies the patch while preserving your wallpapers and `config.json`.

---

## Uninstallation

Restore `app.asar` byte-for-byte from `resources\app.asar.orig.bak` (verified against `resources\app.asar.orig.sha256`):

```powershell
powershell -ExecutionPolicy Bypass -File .\uninstall.ps1
```

Optional flags:
- `-ForceClose` — Closes running Antigravity processes first.
- `-RemoveData` — Also removes `%APPDATA%\Antigravity\custom-theme\` (by default, wallpapers and `config.json` are kept).

---

## Architecture & Known Boundaries

```text
antigravity-custom-theme/
├── install.ps1                 # Windows installer (hot-reload copy + ASAR patch)
├── uninstall.ps1               # Windows uninstaller (restores original ASAR)
├── README.md                   # Documentation
├── scripts/
│   └── patch-asar.js           # ASAR extractor/packer + SHA-256 backup manager
├── src/
│   ├── customThemeMain.js      # Main-process IPC, agy-theme:// protocol, live watcher & sidecar styling
│   └── customThemePreload.js   # ContextBridge API (window.customTheme) + asset bootstrapper
└── theme/
    ├── custom-theme.js         # Runtime DOM controller & Settings -> Custom Theme tab UI
    └── theme.css               # Pure CSS glassmorphism, wallpaper layer & presets
```

**Isolated Boundaries:**
- **Shadow DOM**: Closed shadow roots (`<safevalues-with-css>`, element highlight overlays) and `<safe-content-frame>` (`shim-iframe`) are isolated from outer CSS.
- **Sandboxed / Cross-Origin `<iframe>`s**: Browser iframes, `sandbox="allow-scripts"` frames, and MCP App frames remain isolated. Sidecar `plugin://` frames (such as Swarm) receive dedicated styling via the main process (`buildSidecarThemeScript`).
- **Separate `WebContentsView` / `<webview>`**: `browserWcv` punches through via `[data-browser-hole]` (the wallpaper layer automatically clips around active browser holes), while `curtainView`, `loadingOverlay`, and guest `<webview>` partitions remain untouched.
- **Windows Titlebar Caption Overlay**: The top-right window control buttons (`_`, `□`, `×`) use Electron's Windows `titleBarOverlay` API, which requires an opaque `#RRGGBB` hex color from DWM and cannot be made translucent.

---

## License

MIT
