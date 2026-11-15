(function () {
  "use strict";

  const PREV_CLEANUP_KEY = "__agyCustomThemeCleanup";
  if (typeof window[PREV_CLEANUP_KEY] === "function") {
    try {
      window[PREV_CLEANUP_KEY]();
    } catch {
      // Ignore cleanup errors from prior live-reload instance.
    }
  }

  const WALLPAPER_LAYER_ID = "agy-custom-wallpaper-layer";
  const UI_STYLE_ID = "agy-ct-ui-style";
  const NAV_TESTID = "settings-nav-item-CustomTheme";
  const MAX_WALLPAPER_BYTES = 25 * 1024 * 1024;
  const SLIDER_DEBOUNCE_MS = 140;

  const DEFAULT_CONFIG = Object.freeze({
    version: 1,
    enabled: true,
    wallpaper: "",
    wallpaperUrl: "",
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

  const BUBBLE_PRESETS = [
    {
      id: "default",
      name: "Default",
      hint: "Clean glass",
      previewBg: "linear-gradient(145deg, rgba(120,130,150,0.28), rgba(80,90,110,0.22))",
      previewBorder: "rgba(255,255,255,0.22)",
      previewColor: "#f1f5f9",
      iconBg: "rgba(255,255,255,0.14)",
    },
    {
      id: "charcoal-cat",
      name: "Charcoal Cat",
      hint: "Warm slate",
      previewBg: "linear-gradient(145deg, rgba(44,39,51,0.95), rgba(28,25,35,0.96))",
      previewBorder: "rgba(244,172,196,0.45)",
      previewColor: "#f6eff8",
      iconBg: "rgba(244,172,196,0.14)",
    },
    {
      id: "galaxy",
      name: "Galaxy",
      hint: "Cosmic violet",
      previewBg: "linear-gradient(135deg, rgba(24,22,60,0.95), rgba(52,24,84,0.94) 55%, rgba(18,46,82,0.95))",
      previewBorder: "rgba(167,139,250,0.5)",
      previewColor: "#eef2ff",
      iconBg: "rgba(167,139,250,0.18)",
    },
    {
      id: "scroll",
      name: "Scroll",
      hint: "Warm parchment",
      previewBg: "linear-gradient(160deg, rgba(247,236,210,0.96), rgba(232,213,175,0.95))",
      previewBorder: "rgba(154,102,48,0.75)",
      previewColor: "#2c1e12",
      iconBg: "rgba(154,102,48,0.14)",
    },
    {
      id: "jade-dragon",
      name: "Jade Dragon",
      hint: "Emerald & gold",
      previewBg: "linear-gradient(140deg, rgba(12,52,44,0.95), rgba(16,76,62,0.93))",
      previewBorder: "rgba(94,234,212,0.48)",
      previewColor: "#ecfdf5",
      iconBg: "rgba(234,198,112,0.18)",
    },
    {
      id: "moon-witch",
      name: "Moon Witch",
      hint: "Midnight plum",
      previewBg: "linear-gradient(145deg, rgba(28,20,46,0.96), rgba(48,28,74,0.94))",
      previewBorder: "rgba(216,180,254,0.5)",
      previewColor: "#f6f0ff",
      iconBg: "rgba(216,180,254,0.16)",
    },
    {
      id: "fox",
      name: "Fox",
      hint: "Amber ember",
      previewBg: "linear-gradient(145deg, rgba(82,34,18,0.95), rgba(118,48,22,0.94))",
      previewBorder: "rgba(251,146,60,0.54)",
      previewColor: "#fff7ed",
      iconBg: "rgba(251,146,60,0.18)",
    },
    {
      id: "frost-glass",
      name: "Frost Glass",
      hint: "Cool ice",
      previewBg: "linear-gradient(145deg, rgba(165,212,250,0.28), rgba(116,182,245,0.18))",
      previewBorder: "rgba(186,230,253,0.46)",
      previewColor: "#e0f2fe",
      iconBg: "rgba(186,230,253,0.16)",
    },
  ];

  const INPUT_PRESETS = [
    {
      id: "glass",
      name: "Frosted Glass",
      desc: "Soft translucent glass with a subtle border",
      mockBg: "rgba(130, 140, 160, 0.18)",
      mockBorder: "rgba(255, 255, 255, 0.22)",
      mockRadius: "10px",
      mockShadow: "0 4px 12px rgba(0,0,0,0.22)",
    },
    {
      id: "neon-border",
      name: "Neon Glow",
      desc: "Luminous cyan-violet accent border",
      mockBg: "rgba(24, 34, 54, 0.45)",
      mockBorder: "rgba(56, 189, 248, 0.85)",
      mockRadius: "10px",
      mockShadow: "0 0 12px rgba(56,189,248,0.38)",
    },
    {
      id: "pill-float",
      name: "Floating Pill",
      desc: "Elevated capsule frame with soft depth",
      mockBg: "rgba(130, 140, 160, 0.24)",
      mockBorder: "rgba(255, 255, 255, 0.3)",
      mockRadius: "999px",
      mockShadow: "0 8px 18px rgba(0,0,0,0.34)",
    },
    {
      id: "minimal-flat",
      name: "Minimal Flat",
      desc: "Clean, compact frame with zero shadow",
      mockBg: "rgba(130, 140, 160, 0.1)",
      mockBorder: "rgba(255, 255, 255, 0.16)",
      mockRadius: "8px",
      mockShadow: "none",
    },
  ];

  const SLIDERS = [
    {
      key: "bgDim",
      label: "Background Dim",
      desc: "Darken the wallpaper layer to improve text contrast.",
      min: 0,
      max: 90,
      unit: "%",
    },
    {
      key: "bgBlur",
      label: "Background Blur",
      desc: "Apply Gaussian blur behind the interface.",
      min: 0,
      max: 30,
      unit: "px",
    },
    {
      key: "sidebarOpacity",
      label: "Left Sidebar Opacity",
      desc: "Adjust background opacity independently for the left sidebar.",
      min: 0,
      max: 95,
      unit: "%",
    },
    {
      key: "sidebarBlur",
      label: "Left Sidebar Glass Blur",
      desc: "Adjust backdrop blur intensity independently for the left sidebar.",
      min: 0,
      max: 32,
      unit: "px",
    },
    {
      key: "composerOpacity",
      label: "Prompt Input Opacity",
      desc: "Adjust background opacity independently for the prompt composer.",
      min: 0,
      max: 95,
      unit: "%",
    },
    {
      key: "composerBlur",
      label: "Prompt Input Glass Blur",
      desc: "Adjust backdrop blur intensity independently for the prompt composer.",
      min: 0,
      max: 32,
      unit: "px",
    },
    {
      key: "panelOpacity",
      label: "Side Panel & Swarm Opacity",
      desc: "Adjust background opacity for the right side panel, Swarm board, cards, and dialogs.",
      min: 0,
      max: 95,
      unit: "%",
    },
    {
      key: "panelBlur",
      label: "Side Panel & Swarm Blur",
      desc: "Adjust backdrop blur intensity for the right side panel, Swarm board, and dialogs.",
      min: 0,
      max: 32,
      unit: "px",
    },
  ];

  const BUBBLE_ID_SET = new Set(BUBBLE_PRESETS.map((p) => p.id));
  const INPUT_ID_SET = new Set(INPUT_PRESETS.map((p) => p.id));
  const ALLOWED_EXT_SET = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"]);
  const MIME_TO_EXT = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/bmp": ".bmp",
  };

  const state = {
    destroyed: false,
    config: { ...DEFAULT_CONFIG },
    wallpapers: [],
    customTabActive: false,
    activeDragKey: null,
    statusMessage: "",
    statusIsError: false,
    isBusy: false,
    pendingTimers: new Map(),
    pendingPatches: {},
    statusTimer: null,
    domObserver: null,
    holeResizeObserver: null,
    observedHoleNodes: new Set(),
    rafSettingsScheduled: false,
    rafHoleScheduled: false,
    boundSidebars: new WeakSet(),
    sidebarCleanups: [],
    unsubConfig: null,
    uiRefs: null,
    currentModal: null,
    lastNativeActiveScreen: null,
  };

  function clampInt(val, min, max, fallback) {
    const num = typeof val === "number" ? val : Number(val);
    if (!Number.isFinite(num)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, Math.round(num)));
  }

  function normalizeConfig(raw) {
    const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    const wallpaper = typeof src.wallpaper === "string" ? src.wallpaper.trim() : "";
    let wallpaperUrl = typeof src.wallpaperUrl === "string" ? src.wallpaperUrl.trim() : "";
    if (!wallpaper) {
      wallpaperUrl = "";
    } else if (!wallpaperUrl && !wallpaper.includes("/") && !wallpaper.includes("\\") && !wallpaper.includes("..")) {
      wallpaperUrl = `agy-theme://wallpaper/${encodeURIComponent(wallpaper)}`;
    }
    if (wallpaperUrl && !wallpaperUrl.startsWith("agy-theme://wallpaper/")) {
      wallpaperUrl = "";
    }
    const panelOpacity = clampInt(src.panelOpacity, 0, 95, DEFAULT_CONFIG.panelOpacity);
    const panelBlur = clampInt(src.panelBlur, 0, 32, DEFAULT_CONFIG.panelBlur);
    const fallbackSidebarOpacity = Number.isFinite(Number(src.panelOpacity)) ? panelOpacity : DEFAULT_CONFIG.sidebarOpacity;
    const fallbackSidebarBlur = Number.isFinite(Number(src.panelBlur)) ? panelBlur : DEFAULT_CONFIG.sidebarBlur;
    const fallbackComposerOpacity = Number.isFinite(Number(src.panelOpacity)) ? panelOpacity : DEFAULT_CONFIG.composerOpacity;
    const fallbackComposerBlur = Number.isFinite(Number(src.panelBlur)) ? panelBlur : DEFAULT_CONFIG.composerBlur;
    return {
      version: 1,
      enabled: typeof src.enabled === "boolean" ? src.enabled : DEFAULT_CONFIG.enabled,
      wallpaper,
      wallpaperUrl,
      bgDim: clampInt(src.bgDim, 0, 90, DEFAULT_CONFIG.bgDim),
      bgBlur: clampInt(src.bgBlur, 0, 30, DEFAULT_CONFIG.bgBlur),
      sidebarOpacity: clampInt(src.sidebarOpacity, 0, 95, fallbackSidebarOpacity),
      sidebarBlur: clampInt(src.sidebarBlur, 0, 32, fallbackSidebarBlur),
      composerOpacity: clampInt(src.composerOpacity, 0, 95, fallbackComposerOpacity),
      composerBlur: clampInt(src.composerBlur, 0, 32, fallbackComposerBlur),
      panelOpacity,
      panelBlur,
      bubblePreset: BUBBLE_ID_SET.has(src.bubblePreset) ? src.bubblePreset : DEFAULT_CONFIG.bubblePreset,
      inputPreset: INPUT_ID_SET.has(src.inputPreset) ? src.inputPreset : DEFAULT_CONFIG.inputPreset,
    };
  }

  function setAttrIfChanged(el, name, value) {
    if (el && el.getAttribute(name) !== value) {
      el.setAttribute(name, value);
    }
  }

  function removeAttrIfPresent(el, name) {
    if (el && el.hasAttribute(name)) {
      el.removeAttribute(name);
    }
  }

  function setCssVarIfChanged(styleObj, name, value) {
    if (styleObj && styleObj.getPropertyValue(name) !== value) {
      styleObj.setProperty(name, value);
    }
  }

  function ensureWallpaperLayer() {
    const body = document.body;
    if (!body) {
      return null;
    }
    let layer = document.getElementById(WALLPAPER_LAYER_ID);
    if (!layer) {
      layer = document.createElement("div");
      layer.id = WALLPAPER_LAYER_ID;
      layer.setAttribute("aria-hidden", "true");
      body.prepend(layer);
    } else if (layer.parentNode !== body || body.firstElementChild !== layer) {
      body.prepend(layer);
    }
    let img = layer.querySelector(".agy-custom-wallpaper-img");
    if (!img) {
      img = document.createElement("img");
      img.className = "agy-custom-wallpaper-img";
      img.alt = "";
      img.decoding = "async";
      layer.prepend(img);
    }
    return layer;
  }

  function applyConfigToDom(cfg) {
    const root = document.documentElement;
    if (!root) {
      return;
    }
    const layer = ensureWallpaperLayer();

    const safeUrl = cfg.wallpaperUrl && cfg.wallpaperUrl.startsWith("agy-theme://wallpaper/")
      ? cfg.wallpaperUrl.replace(/["\\\r\n]/g, "")
      : "";
    const bgImageVal = safeUrl ? `url("${safeUrl}")` : "none";

    if (layer) {
      const img = layer.querySelector(".agy-custom-wallpaper-img");
      if (img) {
        if (safeUrl && cfg.enabled) {
          if (img.getAttribute("src") !== safeUrl) {
            img.setAttribute("src", safeUrl);
          }
          img.style.display = "block";
        } else {
          img.removeAttribute("src");
          img.style.display = "none";
        }
      }
    }

    setAttrIfChanged(root, "data-agy-theme-enabled", cfg.enabled ? "true" : "false");
    setAttrIfChanged(root, "data-agy-has-wallpaper", safeUrl ? "true" : "false");
    setAttrIfChanged(root, "data-agy-bubble", cfg.bubblePreset);
    setAttrIfChanged(root, "data-agy-input", cfg.inputPreset);

    setCssVarIfChanged(root.style, "--agy-theme-enabled", cfg.enabled ? "1" : "0");
    setCssVarIfChanged(root.style, "--agy-bg-image", bgImageVal);
    setCssVarIfChanged(root.style, "--agy-bg-dim", (cfg.bgDim / 100).toFixed(2));
    setCssVarIfChanged(root.style, "--agy-bg-blur", `${cfg.bgBlur}px`);
    setCssVarIfChanged(root.style, "--agy-sidebar-opacity", (cfg.sidebarOpacity / 100).toFixed(2));
    setCssVarIfChanged(root.style, "--agy-sidebar-blur", `${cfg.sidebarBlur}px`);
    setCssVarIfChanged(root.style, "--agy-composer-opacity", (cfg.composerOpacity / 100).toFixed(2));
    setCssVarIfChanged(root.style, "--agy-composer-blur", `${cfg.composerBlur}px`);
    setCssVarIfChanged(root.style, "--agy-panel-opacity", (cfg.panelOpacity / 100).toFixed(2));
    setCssVarIfChanged(root.style, "--agy-panel-blur", `${cfg.panelBlur}px`);
  }

  function updateBrowserHoleClip() {
    if (state.destroyed) {
      return;
    }
    const root = document.documentElement;
    const body = document.body;
    if (!root || !body) {
      return;
    }

    const hasHole = body.getAttribute("data-has-browser-hole") === "true";
    if (!hasHole) {
      removeAttrIfPresent(root, "data-agy-hole-clipped");
      setCssVarIfChanged(root.style, "--agy-browser-hole-clip", "none");
      if (state.holeResizeObserver && state.observedHoleNodes.size > 0) {
        state.holeResizeObserver.disconnect();
        state.observedHoleNodes.clear();
      }
      return;
    }

    const holeNodes = Array.from(
      document.querySelectorAll('[data-browser-hole]:not([data-browser-hole="false"])')
    );

    if (state.holeResizeObserver) {
      const nextSet = new Set(holeNodes);
      for (const prev of state.observedHoleNodes) {
        if (!nextSet.has(prev)) {
          state.holeResizeObserver.unobserve(prev);
        }
      }
      for (const node of nextSet) {
        if (!state.observedHoleNodes.has(node)) {
          state.holeResizeObserver.observe(node);
        }
      }
      state.observedHoleNodes = nextSet;
    }

    const vw = window.innerWidth || root.clientWidth || 0;
    const vh = window.innerHeight || root.clientHeight || 0;
    const rects = [];
    for (const el of holeNodes) {
      const r = el.getBoundingClientRect();
      if (!r || r.width <= 0 || r.height <= 0) {
        continue;
      }
      const left = Math.max(0, Math.floor(r.left));
      const top = Math.max(0, Math.floor(r.top));
      const right = Math.min(vw, Math.ceil(r.right));
      const bottom = Math.min(vh, Math.ceil(r.bottom));
      if (right > left && bottom > top) {
        rects.push({ left, top, right, bottom });
      }
    }

    if (rects.length === 0) {
      removeAttrIfPresent(root, "data-agy-hole-clipped");
      setCssVarIfChanged(root.style, "--agy-browser-hole-clip", "none");
      return;
    }

    const points = ["0 0", "100% 0", "100% 100%", "0 100%", "0 0"];
    for (const r of rects) {
      points.push(
        "0 0",
        `${r.left}px ${r.top}px`,
        `${r.right}px ${r.top}px`,
        `${r.right}px ${r.bottom}px`,
        `${r.left}px ${r.bottom}px`,
        `${r.left}px ${r.top}px`,
        "0 0"
      );
    }

    setCssVarIfChanged(root.style, "--agy-browser-hole-clip", `polygon(evenodd, ${points.join(", ")})`);
    setAttrIfChanged(root, "data-agy-hole-clipped", "true");
  }

  function scheduleHoleClipUpdate() {
    if (state.destroyed || state.rafHoleScheduled) {
      return;
    }
    state.rafHoleScheduled = true;
    window.requestAnimationFrame(() => {
      state.rafHoleScheduled = false;
      try {
        updateBrowserHoleClip();
      } catch {
        // Non-fatal clip measurement guard.
      }
    });
  }

  function getApi() {
    return window.customTheme && typeof window.customTheme === "object"
      ? window.customTheme
      : null;
  }

  async function savePatchNow(patch) {
    const api = getApi();
    if (!api || typeof api.saveConfig !== "function") {
      return;
    }
    try {
      const res = await api.saveConfig(patch);
      if (res && res.config) {
        const next = normalizeConfig(res.config);
        if (state.activeDragKey && Object.prototype.hasOwnProperty.call(next, state.activeDragKey)) {
          next[state.activeDragKey] = state.config[state.activeDragKey];
        }
        state.config = next;
        applyConfigToDom(state.config);
        syncUiControls();
      }
      if (res && res.ok === false && res.error) {
        showStatus(res.error, true);
      }
    } catch (err) {
      showStatus(err && err.message ? err.message : "Failed to save configuration.", true);
    }
  }

  function scheduleSliderSave(key, value) {
    state.pendingPatches[key] = value;
    const prevTimer = state.pendingTimers.get(key);
    if (prevTimer) {
      clearTimeout(prevTimer);
    }
    const timer = setTimeout(() => {
      state.pendingTimers.delete(key);
      const val = state.pendingPatches[key];
      delete state.pendingPatches[key];
      if (val !== undefined) {
        void savePatchNow({ [key]: val });
      }
    }, SLIDER_DEBOUNCE_MS);
    state.pendingTimers.set(key, timer);
  }

  function flushSliderSave(key) {
    const prevTimer = state.pendingTimers.get(key);
    if (prevTimer) {
      clearTimeout(prevTimer);
      state.pendingTimers.delete(key);
    }
    if (Object.prototype.hasOwnProperty.call(state.pendingPatches, key)) {
      const val = state.pendingPatches[key];
      delete state.pendingPatches[key];
      void savePatchNow({ [key]: val });
    }
  }

  function showStatus(msg, isError) {
    state.statusMessage = msg || "";
    state.statusIsError = Boolean(isError);
    if (state.statusTimer) {
      clearTimeout(state.statusTimer);
      state.statusTimer = null;
    }
    if (state.uiRefs && state.uiRefs.statusEl) {
      const el = state.uiRefs.statusEl;
      el.textContent = state.statusMessage;
      el.className = `agy-ct-status${state.statusMessage ? " is-visible" : ""}${state.statusIsError ? " is-error" : ""}`;
    }
    if (state.statusMessage) {
      state.statusTimer = setTimeout(() => {
        state.statusTimer = null;
        state.statusMessage = "";
        state.statusIsError = false;
        if (state.uiRefs && state.uiRefs.statusEl) {
          state.uiRefs.statusEl.textContent = "";
          state.uiRefs.statusEl.className = "agy-ct-status";
        }
      }, 3600);
    }
  }

  // ---- Inline Offline SVG Builder Helpers (DOM-only, zero external assets) ----

  const SVG_NS = "http://www.w3.org/2000/svg";

  function svgEl(tag, attrs, children) {
    const el = document.createElementNS(SVG_NS, tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        el.setAttribute(k, String(v));
      }
    }
    if (Array.isArray(children)) {
      for (const c of children) {
        if (c) {
          el.appendChild(c);
        }
      }
    }
    return el;
  }

  function buildBubbleIcon(presetId) {
    switch (presetId) {
      case "charcoal-cat":
        return svgEl("svg", { viewBox: "0 0 24 24", width: "20", height: "20", "aria-hidden": "true" }, [
          svgEl("path", { d: "M4 10 L5 4 L9.5 7.5 Q12 6.8 14.5 7.5 L19 4 L20 10 Q21 15 18 18.2 Q12 20.5 6 18.2 Q3 15 4 10 Z", fill: "#2a2433", stroke: "#f4acc4", "stroke-width": "1.3" }),
          svgEl("path", { d: "M5.8 9.2 L6.2 6 L8.6 8 Z", fill: "#f4acc4" }),
          svgEl("path", { d: "M18.2 9.2 L17.8 6 L15.4 8 Z", fill: "#f4acc4" }),
          svgEl("circle", { cx: "9.2", cy: "12.5", r: "1.3", fill: "#fde047" }),
          svgEl("circle", { cx: "14.8", cy: "12.5", r: "1.3", fill: "#fde047" }),
          svgEl("path", { d: "M11.2 14.6 L12.8 14.6 L12 15.6 Z", fill: "#f4acc4" }),
        ]);

      case "galaxy":
        return svgEl("svg", { viewBox: "0 0 24 24", width: "20", height: "20", "aria-hidden": "true" }, [
          svgEl("circle", { cx: "12", cy: "12", r: "5.2", fill: "#7c3aed", stroke: "#c4b5fd", "stroke-width": "1.2" }),
          svgEl("ellipse", { cx: "12", cy: "12", rx: "10", ry: "3.2", transform: "rotate(-24 12 12)", fill: "none", stroke: "#a5f3fc", "stroke-width": "1.4" }),
          svgEl("circle", { cx: "5", cy: "6", r: "1", fill: "#fef08a" }),
          svgEl("circle", { cx: "19", cy: "17.5", r: "1.1", fill: "#e9d5ff" }),
          svgEl("circle", { cx: "18.5", cy: "6.5", r: "0.8", fill: "#93c5fd" }),
        ]);

      case "scroll":
        return svgEl("svg", { viewBox: "0 0 24 24", width: "20", height: "20", "aria-hidden": "true" }, [
          svgEl("rect", { x: "6", y: "5", width: "12", height: "14", rx: "1.5", fill: "#f5e6c4", stroke: "#9a6630", "stroke-width": "1.4" }),
          svgEl("rect", { x: "4", y: "4", width: "16", height: "3", rx: "1.5", fill: "#c69254", stroke: "#7c4c1e", "stroke-width": "1.1" }),
          svgEl("rect", { x: "4", y: "17", width: "16", height: "3", rx: "1.5", fill: "#c69254", stroke: "#7c4c1e", "stroke-width": "1.1" }),
          svgEl("line", { x1: "8.5", y1: "10", x2: "15.5", y2: "10", stroke: "#8a5a2b", "stroke-width": "1.4", "stroke-linecap": "round" }),
          svgEl("line", { x1: "8.5", y1: "13.5", x2: "14", y2: "13.5", stroke: "#8a5a2b", "stroke-width": "1.4", "stroke-linecap": "round" }),
        ]);

      case "jade-dragon":
        return svgEl("svg", { viewBox: "0 0 24 24", width: "20", height: "20", "aria-hidden": "true" }, [
          svgEl("path", { d: "M6 15 C6 9 10 5.5 14.5 6 C17.5 6.4 19 8.8 17.5 11.2 C16.3 13 13 12.2 12 14 C11 15.8 14 17.5 17 16.2", fill: "none", stroke: "#5eead4", "stroke-width": "2.2", "stroke-linecap": "round" }),
          svgEl("circle", { cx: "15.5", cy: "8.5", r: "1.2", fill: "#facc15" }),
          svgEl("path", { d: "M12 4 L13.5 6 M16.5 4.8 L16 6.8", stroke: "#fde047", "stroke-width": "1.3", "stroke-linecap": "round" }),
          svgEl("circle", { cx: "7.5", cy: "17.5", r: "2", fill: "#10b981", stroke: "#a7f3d0", "stroke-width": "1" }),
        ]);

      case "moon-witch":
        return svgEl("svg", { viewBox: "0 0 24 24", width: "20", height: "20", "aria-hidden": "true" }, [
          svgEl("path", { d: "M14.5 4.5 A7.5 7.5 0 1 0 19.5 16.5 A6 6 0 1 1 14.5 4.5 Z", fill: "#fde68a", stroke: "#d8b4fe", "stroke-width": "1.1" }),
          svgEl("path", { d: "M16 5 L16.7 6.8 L18.5 7.5 L16.7 8.2 L16 10 L15.3 8.2 L13.5 7.5 L15.3 6.8 Z", fill: "#e9d5ff" }),
          svgEl("circle", { cx: "18.5", cy: "12", r: "1", fill: "#c084fc" }),
        ]);

      case "fox":
        return svgEl("svg", { viewBox: "0 0 24 24", width: "20", height: "20", "aria-hidden": "true" }, [
          svgEl("path", { d: "M4.5 5.5 L9.5 8.5 L14.5 8.5 L19.5 5.5 L19 14 L12 19.5 L5 14 Z", fill: "#ea580c", stroke: "#fdba74", "stroke-width": "1.2", "stroke-linejoin": "round" }),
          svgEl("path", { d: "M5 14 L9.5 13 L12 19.5 L14.5 13 L19 14 L12 19.5 Z", fill: "#fff7ed" }),
          svgEl("circle", { cx: "9.2", cy: "11.5", r: "1.1", fill: "#1c1917" }),
          svgEl("circle", { cx: "14.8", cy: "11.5", r: "1.1", fill: "#1c1917" }),
          svgEl("circle", { cx: "12", cy: "17.4", r: "1.2", fill: "#1c1917" }),
        ]);

      case "frost-glass":
        return svgEl("svg", { viewBox: "0 0 24 24", width: "20", height: "20", "aria-hidden": "true" }, [
          svgEl("path", { d: "M12 3 V21 M4.2 7.5 L19.8 16.5 M19.8 7.5 L4.2 16.5", stroke: "#bae6fd", "stroke-width": "1.8", "stroke-linecap": "round" }),
          svgEl("path", { d: "M10 5 L12 7 L14 5 M10 19 L12 17 L14 19 M6 9.5 L8 8.5 M16 15.5 L18 14.5", stroke: "#e0f2fe", "stroke-width": "1.3", "stroke-linecap": "round" }),
          svgEl("circle", { cx: "12", cy: "12", r: "2", fill: "#38bdf8" }),
        ]);

      default:
        return svgEl("svg", { viewBox: "0 0 24 24", width: "20", height: "20", "aria-hidden": "true" }, [
          svgEl("path", { d: "M12 3.5 L13.9 9.1 L19.5 11 L13.9 12.9 L12 18.5 L10.1 12.9 L4.5 11 L10.1 9.1 Z", fill: "#e2e8f0", stroke: "#94a3b8", "stroke-width": "1.1", "stroke-linejoin": "round" }),
          svgEl("circle", { cx: "18", cy: "6", r: "1.2", fill: "#cbd5e1" }),
        ]);
    }
  }

  function buildSmallIcon(kind) {
    switch (kind) {
      case "upload":
        return svgEl("svg", { viewBox: "0 0 24 24", width: "15", height: "15", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" }, [
          svgEl("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }),
          svgEl("polyline", { points: "17 8 12 3 7 8" }),
          svgEl("line", { x1: "12", y1: "3", x2: "12", y2: "15" }),
        ]);
      case "image":
        return svgEl("svg", { viewBox: "0 0 24 24", width: "20", height: "20", fill: "none", stroke: "currentColor", "stroke-width": "1.8", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" }, [
          svgEl("rect", { x: "3", y: "3", width: "18", height: "18", rx: "2", ry: "2" }),
          svgEl("circle", { cx: "8.5", cy: "8.5", r: "1.5" }),
          svgEl("polyline", { points: "21 15 16 10 5 21" }),
        ]);
      case "none":
        return svgEl("svg", { viewBox: "0 0 24 24", width: "20", height: "20", fill: "none", stroke: "currentColor", "stroke-width": "1.8", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" }, [
          svgEl("circle", { cx: "12", cy: "12", r: "8" }),
          svgEl("line", { x1: "6.5", y1: "6.5", x2: "17.5", y2: "17.5" }),
        ]);
      case "check":
        return svgEl("svg", { viewBox: "0 0 24 24", width: "12", height: "12", fill: "none", stroke: "currentColor", "stroke-width": "3", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" }, [
          svgEl("polyline", { points: "20 6 9 17 4 12" }),
        ]);
      case "trash":
        return svgEl("svg", { viewBox: "0 0 24 24", width: "13", height: "13", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" }, [
          svgEl("polyline", { points: "3 6 5 6 21 6" }),
          svgEl("path", { d: "M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" }),
          svgEl("path", { d: "M10 11v6M14 11v6" }),
        ]);
      case "folder":
        return svgEl("svg", { viewBox: "0 0 24 24", width: "14", height: "14", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" }, [
          svgEl("path", { d: "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" }),
        ]);
      case "reset":
        return svgEl("svg", { viewBox: "0 0 24 24", width: "14", height: "14", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" }, [
          svgEl("polyline", { points: "1 4 1 10 7 10" }),
          svgEl("path", { d: "M3.51 15a9 9 0 1 0 2.13-9.36L1 10" }),
        ]);
      default:
        return null;
    }
  }

  // ---- Scoped CSS for Settings Panel & Tab Coexistence ----

  function ensureUiStyle() {
    const parent = document.head || document.documentElement;
    if (!parent) {
      return;
    }
    let styleEl = document.getElementById(UI_STYLE_ID);
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = UI_STYLE_ID;
      parent.appendChild(styleEl);
    }
    styleEl.textContent = `
#${WALLPAPER_LAYER_ID} {
  pointer-events: none;
}
/* Native tab coexistence when Custom Theme tab is open */
.settings-modal-container[data-agy-ct-tab-open="true"] [data-agy-ct-native-viewport="true"] {
  display: none !important;
}
.settings-modal-container[data-agy-ct-tab-open="true"] [data-testid="settings-sidebar"] button:not([data-testid="${NAV_TESTID}"]).bg-sidebar-secondary {
  background-color: transparent !important;
}
.settings-modal-container[data-agy-ct-tab-open="true"] [data-testid="settings-sidebar"] button:not([data-testid="${NAV_TESTID}"]).bg-sidebar-secondary:hover {
  background-color: var(--color-sidebar-muted, var(--sidebar-muted, rgba(128,128,128,0.14))) !important;
}
.settings-modal-container[data-agy-ct-tab-open="true"] [data-testid="settings-sidebar"] button:not([data-testid="${NAV_TESTID}"]).bg-sidebar-secondary > span.text-foreground {
  color: var(--color-secondary-foreground, var(--secondary-foreground, #9d9d9d)) !important;
}
.settings-modal-container[data-agy-ct-tab-open="true"] [data-testid="settings-sidebar"] button:not([data-testid="${NAV_TESTID}"]):hover > span.text-foreground {
  color: var(--color-foreground, var(--foreground, #cccccc)) !important;
}

/* Custom Theme Panel Layout & Controls */
[data-agy-ct-panel="true"] {
  color: var(--color-foreground, var(--foreground, #e5e7eb));
  font-size: 13px;
  line-height: 1.45;
}
.agy-ct-sections {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
}
.agy-ct-section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-muted-foreground, var(--muted-foreground, #9ca3af));
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 0 0 8px 2px;
}
.agy-ct-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.agy-ct-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 30px;
  padding: 0 11px;
  border-radius: 8px;
  border: 1px solid var(--color-border, var(--border, rgba(128,128,128,0.28)));
  background: var(--color-secondary, var(--secondary, rgba(128,128,128,0.16)));
  color: var(--color-foreground, var(--foreground, #e5e7eb));
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 140ms ease, border-color 140ms ease, opacity 140ms ease;
  outline: none;
}
.agy-ct-btn:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--color-foreground, var(--foreground, #fff)) 26%, transparent);
  background: color-mix(in srgb, var(--color-secondary, var(--secondary, #444)) 85%, var(--color-foreground, var(--foreground, #fff)) 15%);
}
.agy-ct-btn:disabled {
  opacity: 0.55;
  cursor: wait;
}
.agy-ct-btn-primary {
  background: var(--color-primary, var(--primary, #007acc));
  color: var(--color-primary-foreground, var(--primary-foreground, #ffffff));
  border-color: transparent;
}
.agy-ct-btn-primary:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-primary, var(--primary, #007acc)) 88%, #ffffff 12%);
  border-color: transparent;
}
.agy-ct-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 14px;
}
.agy-ct-row-col {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 14px;
}
.agy-ct-row-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}
.agy-ct-row-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-foreground, var(--foreground, #e5e7eb));
}
.agy-ct-row-desc {
  font-size: 12px;
  color: var(--color-muted-foreground, var(--muted-foreground, #9ca3af));
}

/* Toggle Switch */
.agy-ct-switch {
  position: relative;
  width: 40px;
  height: 22px;
  border-radius: 999px;
  border: 1px solid var(--color-border, var(--border, rgba(128,128,128,0.35)));
  background: color-mix(in srgb, var(--color-muted, var(--muted, #333)) 85%, var(--color-foreground, #fff) 15%);
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  transition: background-color 160ms ease, border-color 160ms ease;
  outline: none;
}
.agy-ct-switch[aria-checked="true"] {
  background: var(--color-primary, var(--primary, #007acc));
  border-color: transparent;
}
.agy-ct-switch-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(0,0,0,0.35);
  transition: transform 160ms ease;
}
.agy-ct-switch[aria-checked="true"] .agy-ct-switch-thumb {
  transform: translateX(18px);
}

/* Dropzone & Wallpaper Grid */
.agy-ct-dropzone {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 14px;
  border-radius: 10px;
  border: 1.5px dashed color-mix(in srgb, var(--color-foreground, var(--foreground, #ccc)) 24%, transparent);
  background: color-mix(in srgb, var(--color-foreground, var(--foreground, #ccc)) 3%, transparent);
  color: var(--color-muted-foreground, var(--muted-foreground, #9ca3af));
  font-size: 12px;
  cursor: pointer;
  transition: border-color 150ms ease, background-color 150ms ease, color 150ms ease;
  text-align: center;
}
.agy-ct-dropzone:hover,
.agy-ct-dropzone.is-dragover {
  border-color: var(--color-primary, var(--primary, #007acc));
  background: color-mix(in srgb, var(--color-primary, var(--primary, #007acc)) 10%, transparent);
  color: var(--color-foreground, var(--foreground, #e5e7eb));
}
.agy-ct-wp-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(124px, 1fr));
  gap: 10px;
}
.agy-ct-wp-card {
  position: relative;
  border-radius: 10px;
  border: 1.5px solid var(--color-border, var(--border, rgba(128,128,128,0.28)));
  background: color-mix(in srgb, var(--color-card, var(--card, #1e1e1e)) 85%, transparent);
  overflow: hidden;
  cursor: pointer;
  padding: 0;
  text-align: left;
  transition: border-color 140ms ease, transform 120ms ease, box-shadow 140ms ease;
}
.agy-ct-wp-card:hover {
  border-color: color-mix(in srgb, var(--color-foreground, var(--foreground, #ccc)) 36%, transparent);
}
.agy-ct-wp-card.is-active {
  border-color: var(--color-primary, var(--primary, #007acc));
  box-shadow: 0 0 0 1px var(--color-primary, var(--primary, #007acc));
}
.agy-ct-wp-thumb {
  width: 100%;
  aspect-ratio: 16 / 10;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--color-foreground, var(--foreground, #ccc)) 6%, transparent);
  color: var(--color-muted-foreground, var(--muted-foreground, #9ca3af));
  overflow: hidden;
}
.agy-ct-wp-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.agy-ct-wp-name {
  padding: 6px 8px;
  font-size: 11px;
  color: var(--color-foreground, var(--foreground, #e5e7eb));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.agy-ct-wp-check {
  position: absolute;
  top: 6px;
  left: 6px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--color-primary, var(--primary, #007acc));
  color: #ffffff;
  display: none;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(0,0,0,0.4);
}
.agy-ct-wp-card.is-active .agy-ct-wp-check {
  display: flex;
}
.agy-ct-wp-del {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  border: 1px solid rgba(255,255,255,0.2);
  background: rgba(18, 18, 22, 0.78);
  color: #f87171;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transition: opacity 120ms ease, background-color 120ms ease;
}
.agy-ct-wp-card:hover .agy-ct-wp-del,
.agy-ct-wp-card:focus-within .agy-ct-wp-del {
  opacity: 1;
}
.agy-ct-wp-del:hover {
  background: rgba(185, 28, 28, 0.92);
  color: #ffffff;
}

/* Sliders */
.agy-ct-slider-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
}
.agy-ct-slider-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.agy-ct-slider-val {
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  padding: 2px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-foreground, var(--foreground, #ccc)) 10%, transparent);
  color: var(--color-foreground, var(--foreground, #e5e7eb));
  flex-shrink: 0;
}
.agy-ct-range {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 6px;
  border-radius: 999px;
  outline: none;
  cursor: pointer;
  background: linear-gradient(
    to right,
    var(--color-primary, var(--primary, #007acc)) 0%,
    var(--color-primary, var(--primary, #007acc)) var(--pct, 50%),
    color-mix(in srgb, var(--color-foreground, var(--foreground, #ccc)) 18%, transparent) var(--pct, 50%),
    color-mix(in srgb, var(--color-foreground, var(--foreground, #ccc)) 18%, transparent) 100%
  );
}
.agy-ct-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #ffffff;
  border: 2px solid var(--color-primary, var(--primary, #007acc));
  box-shadow: 0 1px 4px rgba(0,0,0,0.4);
  cursor: pointer;
}

/* Bubble & Input Preset Grids */
.agy-ct-bubble-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(195px, 1fr));
  gap: 10px;
}
.agy-ct-input-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px;
}
.agy-ct-preset-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding: 10px;
  border-radius: 10px;
  border: 1.5px solid var(--color-border, var(--border, rgba(128,128,128,0.28)));
  background: color-mix(in srgb, var(--color-foreground, var(--foreground, #ccc)) 3%, transparent);
  cursor: pointer;
  text-align: left;
  transition: border-color 140ms ease, background-color 140ms ease, box-shadow 140ms ease;
}
.agy-ct-preset-card:hover {
  border-color: color-mix(in srgb, var(--color-foreground, var(--foreground, #ccc)) 36%, transparent);
}
.agy-ct-preset-card.is-active {
  border-color: var(--color-primary, var(--primary, #007acc));
  background: color-mix(in srgb, var(--color-primary, var(--primary, #007acc)) 9%, transparent);
  box-shadow: 0 0 0 1px var(--color-primary, var(--primary, #007acc));
}
.agy-ct-bubble-preview {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 12px;
  border: 1px solid transparent;
  font-size: 12px;
  font-weight: 500;
  min-height: 38px;
}
.agy-ct-bubble-icon-wrap {
  width: 24px;
  height: 24px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.agy-ct-input-mock {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  font-size: 11px;
  color: var(--color-muted-foreground, var(--muted-foreground, #9ca3af));
  border: 1px solid transparent;
}
.agy-ct-preset-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.agy-ct-preset-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-foreground, var(--foreground, #e5e7eb));
}
.agy-ct-preset-sub {
  font-size: 11px;
  color: var(--color-muted-foreground, var(--muted-foreground, #9ca3af));
}
.agy-ct-badge-active {
  display: none;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 999px;
  background: var(--color-primary, var(--primary, #007acc));
  color: var(--color-primary-foreground, var(--primary-foreground, #ffffff));
  flex-shrink: 0;
}
.agy-ct-preset-card.is-active .agy-ct-badge-active {
  display: inline-flex;
}

/* Status Toast & Footer */
.agy-ct-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding-top: 4px;
}
.agy-ct-status {
  font-size: 12px;
  color: var(--color-muted-foreground, var(--muted-foreground, #9ca3af));
  opacity: 0;
  transition: opacity 150ms ease;
}
.agy-ct-status.is-visible {
  opacity: 1;
}
.agy-ct-status.is-error {
  color: #f87171;
}
`;
  }

  // ---- File Upload Helpers ----

  function resolveImageFilenameForDataImport(file) {
    const rawName = typeof file?.name === "string" ? file.name.trim() : "";
    const dotIdx = rawName.lastIndexOf(".");
    const ext = dotIdx >= 0 ? rawName.slice(dotIdx).toLowerCase() : "";
    if (ALLOWED_EXT_SET.has(ext)) {
      return rawName;
    }
    const mimeExt = MIME_TO_EXT[(file?.type || "").toLowerCase()];
    if (mimeExt) {
      const stem = rawName ? rawName.replace(/\.[^.]*$/, "") : "wallpaper";
      return `${stem}${mimeExt}`;
    }
    return null;
  }

  async function importWallpaperFile(file) {
    const api = getApi();
    if (!api || typeof api.importWallpaperFromData !== "function") {
      showStatus("window.customTheme bridge is unavailable.", true);
      return;
    }
    if (!file) {
      return;
    }
    const safeName = resolveImageFilenameForDataImport(file);
    if (!safeName) {
      showStatus("Only .png, .jpg, .jpeg, .webp, .gif, and .bmp images are supported.", true);
      return;
    }
    if (file.size <= 0 || file.size > MAX_WALLPAPER_BYTES) {
      showStatus("Image size must be between 1 byte and 25 MB.", true);
      return;
    }

    state.isBusy = true;
    syncUiBusyState();
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
        reader.onerror = () => reject(new Error("Failed to read image file."));
        reader.readAsDataURL(file);
      });
      const res = await api.importWallpaperFromData({ name: safeName, base64 });
      if (!res || !res.ok || !res.filename) {
        showStatus((res && res.error) || "Failed to upload wallpaper.", true);
        return;
      }
      await savePatchNow({ wallpaper: res.filename });
      await refreshWallpapers();
      showStatus("Wallpaper uploaded and applied.", false);
    } catch (err) {
      showStatus(err && err.message ? err.message : "Failed to upload image.", true);
    } finally {
      state.isBusy = false;
      syncUiBusyState();
    }
  }

  async function handleNativeUploadClick() {
    const api = getApi();
    if (!api || typeof api.uploadWallpaper !== "function") {
      if (state.uiRefs && state.uiRefs.fileInput) {
        state.uiRefs.fileInput.click();
      }
      return;
    }
    state.isBusy = true;
    syncUiBusyState();
    try {
      const res = await api.uploadWallpaper();
      if (!res || res.canceled) {
        return;
      }
      if (!res.ok || !res.filename) {
        showStatus((res && res.error) || "Failed to upload wallpaper.", true);
        return;
      }
      await savePatchNow({ wallpaper: res.filename });
      await refreshWallpapers();
      showStatus("Wallpaper uploaded and applied.", false);
    } catch (err) {
      showStatus(err && err.message ? err.message : "Failed to open file picker.", true);
    } finally {
      state.isBusy = false;
      syncUiBusyState();
    }
  }

  async function refreshWallpapers() {
    const api = getApi();
    if (!api || typeof api.listWallpapers !== "function") {
      return;
    }
    try {
      const items = await api.listWallpapers();
      state.wallpapers = Array.isArray(items) ? items : [];
      renderWallpaperGrid();
    } catch {
      // Keep previous list on transient error.
    }
  }

  async function handleDeleteWallpaper(filename) {
    const api = getApi();
    if (!api || typeof api.deleteWallpaper !== "function") {
      return;
    }
    try {
      const res = await api.deleteWallpaper(filename);
      if (res && res.ok === false) {
        showStatus(res.error || "Failed to delete wallpaper.", true);
        return;
      }
      if (state.config.wallpaper === filename) {
        state.config = normalizeConfig({ ...state.config, wallpaper: "", wallpaperUrl: "" });
        applyConfigToDom(state.config);
      }
      await refreshWallpapers();
      syncUiControls();
      showStatus("Wallpaper deleted.", false);
    } catch (err) {
      showStatus(err && err.message ? err.message : "Failed to delete wallpaper.", true);
    }
  }

  async function handleResetDefaults() {
    const api = getApi();
    if (!api || typeof api.resetConfig !== "function") {
      return;
    }
    state.pendingTimers.forEach((t) => clearTimeout(t));
    state.pendingTimers.clear();
    state.pendingPatches = {};
    try {
      const res = await api.resetConfig();
      if (res && res.config) {
        state.config = normalizeConfig(res.config);
      } else {
        state.config = { ...DEFAULT_CONFIG };
      }
      applyConfigToDom(state.config);
      syncUiControls();
      showStatus("Restored default settings.", false);
    } catch (err) {
      showStatus(err && err.message ? err.message : "Failed to restore defaults.", true);
    }
  }

  // ---- Build Custom Theme Settings Panel DOM ----

  function createSectionTitle(text) {
    const h3 = document.createElement("h3");
    h3.className = "agy-ct-section-title";
    h3.textContent = text;
    return h3;
  }

  function createAgyCard() {
    const card = document.createElement("div");
    card.className = "agy-card bg-transparent rounded-xl border border-border overflow-hidden divide-y divide-border";
    return card;
  }

  function buildPanelDom() {
    const viewport = document.createElement("div");
    viewport.setAttribute("data-agy-ct-panel", "true");
    viewport.className = "flex w-full h-full overflow-auto min-h-0";
    viewport.style.display = "none";

    const growWrap = document.createElement("div");
    growWrap.className = "grow w-full";
    viewport.appendChild(growWrap);

    const scrollInner = document.createElement("div");
    scrollInner.className = "w-full bg-transparent h-full overflow-y-auto";
    growWrap.appendChild(scrollInner);

    const page = document.createElement("div");
    page.className = "p-6 flex flex-col gap-4 w-full max-w-2xl mx-auto";
    scrollInner.appendChild(page);

    // Header matching native HQ component
    const headerWrap = document.createElement("div");
    headerWrap.className = "flex flex-col gap-2 w-full mb-2 bg-transparent";
    const headerRow = document.createElement("div");
    headerRow.className = "flex justify-between items-start gap-4 w-full bg-transparent pr-8 lg:pr-0";

    const headerTitleBox = document.createElement("div");
    headerTitleBox.className = "flex-1 flex flex-col gap-1 min-w-0 bg-transparent";
    const titleEl = document.createElement("h2");
    titleEl.className = "text-2xl m-0 font-medium truncate flex-1 text-foreground";
    titleEl.textContent = "Custom Theme";
    const descEl = document.createElement("div");
    descEl.className = "text-muted-foreground bg-transparent";
    descEl.textContent = "Customize wallpapers, glassmorphism effects, chat bubbles, and input styles live without restarting.";
    headerTitleBox.append(titleEl, descEl);

    const headerActions = document.createElement("div");
    headerActions.className = "agy-ct-header-actions";
    const openFolderBtn = document.createElement("button");
    openFolderBtn.type = "button";
    openFolderBtn.className = "agy-ct-btn";
    openFolderBtn.append(buildSmallIcon("folder"), document.createTextNode("Open Folder"));
    openFolderBtn.addEventListener("click", () => {
      const api = getApi();
      if (api && typeof api.openThemeFolder === "function") {
        void api.openThemeFolder();
      }
    });
    headerActions.appendChild(openFolderBtn);

    headerRow.append(headerTitleBox, headerActions);
    headerWrap.appendChild(headerRow);
    page.appendChild(headerWrap);

    const sections = document.createElement("div");
    sections.className = "agy-ct-sections";
    page.appendChild(sections);

    // 1. Enable / Disable Toggle Section
    const toggleSec = document.createElement("div");
    const toggleCard = createAgyCard();
    const toggleRow = document.createElement("div");
    toggleRow.className = "agy-ct-row";
    const toggleMeta = document.createElement("div");
    toggleMeta.className = "agy-ct-row-meta";
    const toggleLabel = document.createElement("span");
    toggleLabel.className = "agy-ct-row-label";
    toggleLabel.textContent = "Enable Custom Theme";
    const toggleDesc = document.createElement("span");
    toggleDesc.className = "agy-ct-row-desc";
    toggleDesc.textContent = "Apply custom wallpapers, glassmorphism translucency, and UI presets.";
    toggleMeta.append(toggleLabel, toggleDesc);

    const switchBtn = document.createElement("button");
    switchBtn.type = "button";
    switchBtn.className = "agy-ct-switch";
    switchBtn.setAttribute("role", "switch");
    switchBtn.setAttribute("aria-label", "Enable Custom Theme");
    switchBtn.setAttribute("aria-checked", String(state.config.enabled));
    const switchThumb = document.createElement("span");
    switchThumb.className = "agy-ct-switch-thumb";
    switchBtn.appendChild(switchThumb);
    switchBtn.addEventListener("click", () => {
      const nextEnabled = !state.config.enabled;
      state.config = normalizeConfig({ ...state.config, enabled: nextEnabled });
      applyConfigToDom(state.config);
      syncUiControls();
      void savePatchNow({ enabled: nextEnabled });
    });

    toggleRow.append(toggleMeta, switchBtn);
    toggleCard.appendChild(toggleRow);
    toggleSec.appendChild(toggleCard);
    sections.appendChild(toggleSec);

    // 2. Wallpaper Upload & Picker Section
    const wpSec = document.createElement("div");
    wpSec.appendChild(createSectionTitle("Wallpaper"));
    const wpCard = createAgyCard();

    const wpTopRow = document.createElement("div");
    wpTopRow.className = "agy-ct-row";
    const wpMeta = document.createElement("div");
    wpMeta.className = "agy-ct-row-meta";
    const wpLabel = document.createElement("span");
    wpLabel.className = "agy-ct-row-label";
    wpLabel.textContent = "Wallpaper Library";
    const wpDesc = document.createElement("span");
    wpDesc.className = "agy-ct-row-desc";
    wpDesc.textContent = "PNG, JPG, WebP, GIF, BMP (max 25 MB). Stored locally in wallpapers\\.";
    wpMeta.append(wpLabel, wpDesc);

    const wpBtnGroup = document.createElement("div");
    wpBtnGroup.className = "agy-ct-header-actions";
    const uploadBtn = document.createElement("button");
    uploadBtn.type = "button";
    uploadBtn.className = "agy-ct-btn agy-ct-btn-primary";
    uploadBtn.append(buildSmallIcon("upload"), document.createTextNode("Upload Wallpaper"));
    uploadBtn.addEventListener("click", () => {
      void handleNativeUploadClick();
    });

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".png,.jpg,.jpeg,.webp,.gif,.bmp,image/*";
    fileInput.hidden = true;
    fileInput.addEventListener("change", () => {
      const f = fileInput.files && fileInput.files[0];
      fileInput.value = "";
      if (f) {
        void importWallpaperFile(f);
      }
    });

    wpBtnGroup.append(uploadBtn, fileInput);
    wpTopRow.append(wpMeta, wpBtnGroup);
    wpCard.appendChild(wpTopRow);

    const wpBodyRow = document.createElement("div");
    wpBodyRow.className = "agy-ct-row-col";

    const dropzone = document.createElement("div");
    dropzone.className = "agy-ct-dropzone";
    dropzone.setAttribute("role", "button");
    dropzone.setAttribute("tabindex", "0");
    dropzone.append(
      buildSmallIcon("image"),
      document.createTextNode("Drag & drop an image here, or click to browse files")
    );
    dropzone.addEventListener("click", () => fileInput.click());
    dropzone.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        fileInput.click();
      }
    });
    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.classList.add("is-dragover");
    });
    dropzone.addEventListener("dragleave", () => {
      dropzone.classList.remove("is-dragover");
    });
    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.classList.remove("is-dragover");
      const files = e.dataTransfer && e.dataTransfer.files;
      if (files && files[0]) {
        void importWallpaperFile(files[0]);
      }
    });

    const wpGrid = document.createElement("div");
    wpGrid.className = "agy-ct-wp-grid";

    wpBodyRow.append(dropzone, wpGrid);
    wpCard.appendChild(wpBodyRow);
    wpSec.appendChild(wpCard);
    sections.appendChild(wpSec);

    // 3. Sliders Section
    const sliderSec = document.createElement("div");
    sliderSec.appendChild(createSectionTitle("Opacity & Glassmorphism"));
    const sliderCard = createAgyCard();
    const sliderRefs = {};

    for (const def of SLIDERS) {
      const row = document.createElement("div");
      row.className = "agy-ct-slider-row";

      const top = document.createElement("div");
      top.className = "agy-ct-slider-top";
      const meta = document.createElement("div");
      meta.className = "agy-ct-row-meta";
      const lbl = document.createElement("label");
      lbl.className = "agy-ct-row-label";
      const inputId = `agy-ct-slider-${def.key}`;
      lbl.setAttribute("for", inputId);
      lbl.textContent = def.label;
      const dsc = document.createElement("span");
      dsc.className = "agy-ct-row-desc";
      dsc.textContent = def.desc;
      meta.append(lbl, dsc);

      const valBadge = document.createElement("span");
      valBadge.className = "agy-ct-slider-val";
      top.append(meta, valBadge);

      const range = document.createElement("input");
      range.type = "range";
      range.id = inputId;
      range.className = "agy-ct-range";
      range.min = String(def.min);
      range.max = String(def.max);
      range.step = "1";

      range.addEventListener("pointerdown", () => {
        state.activeDragKey = def.key;
      });
      range.addEventListener("pointerup", () => {
        if (state.activeDragKey === def.key) {
          state.activeDragKey = null;
        }
      });
      range.addEventListener("blur", () => {
        if (state.activeDragKey === def.key) {
          state.activeDragKey = null;
        }
      });
      range.addEventListener("input", () => {
        const val = clampInt(range.value, def.min, def.max, DEFAULT_CONFIG[def.key]);
        state.config = normalizeConfig({ ...state.config, [def.key]: val });
        updateSingleSliderVisual(def, range, valBadge, val);
        applyConfigToDom(state.config);
        scheduleSliderSave(def.key, val);
      });
      range.addEventListener("change", () => {
        if (state.activeDragKey === def.key) {
          state.activeDragKey = null;
        }
        const val = clampInt(range.value, def.min, def.max, DEFAULT_CONFIG[def.key]);
        state.config = normalizeConfig({ ...state.config, [def.key]: val });
        state.pendingPatches[def.key] = val;
        flushSliderSave(def.key);
      });

      row.append(top, range);
      sliderCard.appendChild(row);
      sliderRefs[def.key] = { def, range, valBadge };
    }
    sliderSec.appendChild(sliderCard);
    sections.appendChild(sliderSec);

    // 4. Chat Bubble Presets Grid (8 Presets)
    const bubbleSec = document.createElement("div");
    bubbleSec.appendChild(createSectionTitle("Chat Bubble Presets"));
    const bubbleCard = createAgyCard();
    const bubbleWrap = document.createElement("div");
    bubbleWrap.className = "agy-ct-row-col";
    const bubbleGrid = document.createElement("div");
    bubbleGrid.className = "agy-ct-bubble-grid";
    const bubbleCards = {};

    for (const preset of BUBBLE_PRESETS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "agy-ct-preset-card";
      btn.setAttribute("data-bubble-preset", preset.id);

      const preview = document.createElement("div");
      preview.className = "agy-ct-bubble-preview";
      preview.style.background = preset.previewBg;
      preview.style.borderColor = preset.previewBorder;
      preview.style.color = preset.previewColor;

      const iconWrap = document.createElement("span");
      iconWrap.className = "agy-ct-bubble-icon-wrap";
      iconWrap.style.background = preset.iconBg;
      iconWrap.appendChild(buildBubbleIcon(preset.id));

      const msgSpan = document.createElement("span");
      msgSpan.textContent = "Hello ✨";
      preview.append(iconWrap, msgSpan);

      const foot = document.createElement("div");
      foot.className = "agy-ct-preset-foot";
      const footText = document.createElement("div");
      const title = document.createElement("div");
      title.className = "agy-ct-preset-title";
      title.textContent = preset.name;
      const sub = document.createElement("div");
      sub.className = "agy-ct-preset-sub";
      sub.textContent = preset.hint;
      footText.append(title, sub);

      const badge = document.createElement("span");
      badge.className = "agy-ct-badge-active";
      badge.append(buildSmallIcon("check"), document.createTextNode("Active"));
      foot.append(footText, badge);

      btn.append(preview, foot);
      btn.addEventListener("click", () => {
        state.config = normalizeConfig({ ...state.config, bubblePreset: preset.id });
        applyConfigToDom(state.config);
        syncUiControls();
        void savePatchNow({ bubblePreset: preset.id });
      });

      bubbleGrid.appendChild(btn);
      bubbleCards[preset.id] = btn;
    }

    bubbleWrap.appendChild(bubbleGrid);
    bubbleCard.appendChild(bubbleWrap);
    bubbleSec.appendChild(bubbleCard);
    sections.appendChild(bubbleSec);

    // 5. Chat Input Presets Grid (4 Presets)
    const inputSec = document.createElement("div");
    inputSec.appendChild(createSectionTitle("Chat Input Presets"));
    const inputCard = createAgyCard();
    const inputWrap = document.createElement("div");
    inputWrap.className = "agy-ct-row-col";
    const inputGrid = document.createElement("div");
    inputGrid.className = "agy-ct-input-grid";
    const inputCards = {};

    for (const preset of INPUT_PRESETS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "agy-ct-preset-card";
      btn.setAttribute("data-input-preset", preset.id);

      const mock = document.createElement("div");
      mock.className = "agy-ct-input-mock";
      mock.style.background = preset.mockBg;
      mock.style.borderColor = preset.mockBorder;
      mock.style.borderRadius = preset.mockRadius;
      mock.style.boxShadow = preset.mockShadow;
      const placeholder = document.createElement("span");
      placeholder.textContent = "Ask anything...";
      const sendDot = document.createElement("span");
      sendDot.style.width = "16px";
      sendDot.style.height = "16px";
      sendDot.style.borderRadius = "999px";
      sendDot.style.background = "var(--color-primary, var(--primary, #007acc))";
      sendDot.style.opacity = "0.85";
      mock.append(placeholder, sendDot);

      const foot = document.createElement("div");
      foot.className = "agy-ct-preset-foot";
      const footText = document.createElement("div");
      const title = document.createElement("div");
      title.className = "agy-ct-preset-title";
      title.textContent = preset.name;
      const sub = document.createElement("div");
      sub.className = "agy-ct-preset-sub";
      sub.textContent = preset.desc;
      footText.append(title, sub);

      const badge = document.createElement("span");
      badge.className = "agy-ct-badge-active";
      badge.append(buildSmallIcon("check"), document.createTextNode("Active"));
      foot.append(footText, badge);

      btn.append(mock, foot);
      btn.addEventListener("click", () => {
        state.config = normalizeConfig({ ...state.config, inputPreset: preset.id });
        applyConfigToDom(state.config);
        syncUiControls();
        void savePatchNow({ inputPreset: preset.id });
      });

      inputGrid.appendChild(btn);
      inputCards[preset.id] = btn;
    }

    inputWrap.appendChild(inputGrid);
    inputCard.appendChild(inputWrap);
    inputSec.appendChild(inputCard);
    sections.appendChild(inputSec);

    // 6. Footer (Status + Reset Defaults)
    const footer = document.createElement("div");
    footer.className = "agy-ct-footer";
    const statusEl = document.createElement("div");
    statusEl.className = "agy-ct-status";
    statusEl.setAttribute("role", "status");
    statusEl.setAttribute("aria-live", "polite");

    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "agy-ct-btn";
    resetBtn.append(buildSmallIcon("reset"), document.createTextNode("Reset to Defaults"));
    resetBtn.addEventListener("click", () => {
      void handleResetDefaults();
    });

    footer.append(statusEl, resetBtn);
    sections.appendChild(footer);

    state.uiRefs = {
      viewport,
      switchBtn,
      uploadBtn,
      fileInput,
      wpGrid,
      sliderRefs,
      bubbleCards,
      inputCards,
      statusEl,
      resetBtn,
    };

    renderWallpaperGrid();
    syncUiControls();
    return viewport;
  }

  function updateSingleSliderVisual(def, range, valBadge, val) {
    if (String(range.value) !== String(val)) {
      range.value = String(val);
    }
    valBadge.textContent = `${val}${def.unit}`;
    const pct = ((val - def.min) / (def.max - def.min)) * 100;
    range.style.setProperty("--pct", `${Math.max(0, Math.min(100, pct))}%`);
  }

  function syncUiBusyState() {
    if (!state.uiRefs) {
      return;
    }
    state.uiRefs.uploadBtn.disabled = state.isBusy;
  }

  function renderWallpaperGrid() {
    if (!state.uiRefs || !state.uiRefs.wpGrid) {
      return;
    }
    const grid = state.uiRefs.wpGrid;
    grid.textContent = "";

    // Option 0: No wallpaper
    const noneCard = document.createElement("div");
    noneCard.className = `agy-ct-wp-card${state.config.wallpaper === "" ? " is-active" : ""}`;
    noneCard.setAttribute("role", "button");
    noneCard.setAttribute("tabindex", "0");
    noneCard.setAttribute("data-wallpaper-name", "");

    const noneThumb = document.createElement("div");
    noneThumb.className = "agy-ct-wp-thumb";
    noneThumb.appendChild(buildSmallIcon("none"));

    const noneName = document.createElement("div");
    noneName.className = "agy-ct-wp-name";
    noneName.textContent = "No Wallpaper";

    const noneCheck = document.createElement("span");
    noneCheck.className = "agy-ct-wp-check";
    noneCheck.appendChild(buildSmallIcon("check"));

    const selectNone = () => {
      state.config = normalizeConfig({ ...state.config, wallpaper: "", wallpaperUrl: "" });
      applyConfigToDom(state.config);
      syncUiControls();
      void savePatchNow({ wallpaper: "" });
    };
    noneCard.addEventListener("click", selectNone);
    noneCard.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selectNone();
      }
    });
    noneCard.append(noneThumb, noneName, noneCheck);
    grid.appendChild(noneCard);

    for (const item of state.wallpapers) {
      if (!item || typeof item.filename !== "string" || !item.url) {
        continue;
      }
      const isActive = state.config.wallpaper === item.filename;
      const card = document.createElement("div");
      card.className = `agy-ct-wp-card${isActive ? " is-active" : ""}`;
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      card.setAttribute("data-wallpaper-name", item.filename);

      const thumb = document.createElement("div");
      thumb.className = "agy-ct-wp-thumb";
      const img = document.createElement("img");
      img.src = item.url;
      img.alt = item.filename;
      img.loading = "lazy";
      thumb.appendChild(img);

      const nameEl = document.createElement("div");
      nameEl.className = "agy-ct-wp-name";
      nameEl.textContent = item.filename;
      nameEl.title = item.filename;

      const check = document.createElement("span");
      check.className = "agy-ct-wp-check";
      check.appendChild(buildSmallIcon("check"));

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "agy-ct-wp-del";
      delBtn.title = "Delete wallpaper";
      delBtn.setAttribute("aria-label", `Delete ${item.filename}`);
      delBtn.appendChild(buildSmallIcon("trash"));
      delBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        void handleDeleteWallpaper(item.filename);
      });

      const selectWp = () => {
        state.config = normalizeConfig({
          ...state.config,
          wallpaper: item.filename,
          wallpaperUrl: item.url,
        });
        applyConfigToDom(state.config);
        syncUiControls();
        void savePatchNow({ wallpaper: item.filename });
      };
      card.addEventListener("click", selectWp);
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selectWp();
        }
      });

      card.append(thumb, nameEl, check, delBtn);
      grid.appendChild(card);
    }
  }

  function syncUiControls() {
    if (!state.uiRefs) {
      return;
    }
    const cfg = state.config;
    state.uiRefs.switchBtn.setAttribute("aria-checked", String(cfg.enabled));

    for (const [key, ref] of Object.entries(state.uiRefs.sliderRefs)) {
      if (state.activeDragKey === key) {
        continue;
      }
      updateSingleSliderVisual(ref.def, ref.range, ref.valBadge, cfg[key]);
    }

    for (const [id, card] of Object.entries(state.uiRefs.bubbleCards)) {
      card.classList.toggle("is-active", cfg.bubblePreset === id);
    }
    for (const [id, card] of Object.entries(state.uiRefs.inputCards)) {
      card.classList.toggle("is-active", cfg.inputPreset === id);
    }

    const wpCards = state.uiRefs.wpGrid.querySelectorAll(".agy-ct-wp-card");
    for (const card of wpCards) {
      const name = card.getAttribute("data-wallpaper-name") || "";
      card.classList.toggle("is-active", cfg.wallpaper === name);
    }
  }

  // ---- Settings Sidebar & Tab Integration ----

  function updateNavButtonAppearance(btn, active) {
    if (!btn) {
      return;
    }
    const span = btn.querySelector("span");
    if (active) {
      btn.classList.remove("hover:bg-sidebar-muted");
      btn.classList.add("bg-sidebar-secondary");
      btn.setAttribute("aria-pressed", "true");
      if (span) {
        span.classList.remove("text-secondary-foreground", "group-hover/nav-item:text-foreground");
        span.classList.add("text-foreground");
      }
    } else {
      btn.classList.remove("bg-sidebar-secondary");
      btn.classList.add("hover:bg-sidebar-muted");
      btn.setAttribute("aria-pressed", "false");
      if (span) {
        span.classList.remove("text-foreground");
        span.classList.add("text-secondary-foreground", "group-hover/nav-item:text-foreground");
      }
    }
  }

  function setCustomTabActive(active) {
    const next = Boolean(active);
    state.customTabActive = next;
    const modal = state.currentModal || document.querySelector(".settings-modal-container");
    if (modal) {
      if (next) {
        const screensHost = modal.querySelector('[data-agy-ct-native-viewport="true"] .grow.w-full');
        let activeScreen = null;
        if (screensHost) {
          for (const child of screensHost.children) {
            if (child instanceof HTMLElement && child.style.display === "block") {
              activeScreen = child;
              break;
            }
          }
        }
        state.lastNativeActiveScreen = activeScreen;
        setAttrIfChanged(modal, "data-agy-ct-tab-open", "true");
      } else {
        state.lastNativeActiveScreen = null;
        removeAttrIfPresent(modal, "data-agy-ct-tab-open");
      }
      const navBtn = modal.querySelector(`[data-testid="${NAV_TESTID}"]`);
      updateNavButtonAppearance(navBtn, next);
    }
    if (state.uiRefs && state.uiRefs.viewport) {
      state.uiRefs.viewport.style.display = next ? "flex" : "none";
      if (next) {
        state.uiRefs.viewport.scrollTop = 0;
        const innerScroll = state.uiRefs.viewport.querySelector(".overflow-y-auto");
        if (innerScroll) {
          innerScroll.scrollTop = 0;
        }
        void refreshWallpapers();
        syncUiControls();
      }
    }
  }

  function findSettingsParts() {
    const modal =
      document.querySelector('.settings-modal-container[aria-label="Settings"]') ||
      document.querySelector(".settings-modal-container");
    if (!modal) {
      return null;
    }
    const backdrop = modal.closest(".settings-modal-backdrop") || document.querySelector(".settings-modal-backdrop");
    const isOpen = backdrop ? backdrop.getAttribute("aria-hidden") !== "true" : true;
    const sidebar = modal.querySelector('[data-testid="settings-sidebar"]');
    const appearanceBtn = sidebar
      ? sidebar.querySelector('[data-testid="settings-nav-item-Appearance"]')
      : null;

    let nativeViewport = null;
    let contentContainer = null;
    const growCandidates = modal.querySelectorAll(".grow.w-full");
    for (const candidate of growCandidates) {
      if (sidebar && sidebar.contains(candidate)) {
        continue;
      }
      if (candidate.closest("[data-agy-ct-panel]")) {
        continue;
      }
      const vp = candidate.parentElement;
      const host = vp ? vp.parentElement : null;
      if (vp && host) {
        nativeViewport = vp;
        contentContainer = host;
        break;
      }
    }
    return { modal, backdrop, isOpen, sidebar, appearanceBtn, nativeViewport, contentContainer };
  }

  function ensureSettingsUi() {
    if (state.destroyed) {
      return;
    }
    ensureUiStyle();

    const parts = findSettingsParts();
    if (!parts) {
      if (state.customTabActive) {
        setCustomTabActive(false);
      }
      state.currentModal = null;
      return;
    }

    state.currentModal = parts.modal;

    if (!parts.isOpen) {
      if (state.customTabActive) {
        setCustomTabActive(false);
      }
      return;
    }

    // Inject sidebar nav item right below "Appearance"
    if (parts.sidebar && parts.appearanceBtn) {
      const appearanceWrapper =
        parts.appearanceBtn.closest(".group\\/nav-item") || parts.appearanceBtn.parentElement;

      let navWrapper = parts.sidebar.querySelector('[data-agy-ct-nav-wrapper="true"]');
      if (!navWrapper) {
        navWrapper = document.createElement("div");
        navWrapper.className = "relative group/nav-item mx-2";
        navWrapper.setAttribute("data-agy-ct-nav-wrapper", "true");

        const btn = document.createElement("button");
        btn.type = "button";
        btn.setAttribute("data-testid", NAV_TESTID);
        btn.className =
          "flex items-center gap-1.5 w-full px-2 py-1 rounded-lg cursor-pointer border-none text-left transition-all outline-none hover:bg-sidebar-muted";
        const span = document.createElement("span");
        span.className =
          "transition-colors select-none truncate flex-1 text-secondary-foreground group-hover/nav-item:text-foreground";
        span.textContent = "Custom Theme";
        btn.appendChild(span);
        navWrapper.appendChild(btn);
      }

      if (appearanceWrapper && appearanceWrapper.nextElementSibling !== navWrapper) {
        appearanceWrapper.insertAdjacentElement("afterend", navWrapper);
      }

      if (!state.boundSidebars.has(parts.sidebar)) {
        state.boundSidebars.add(parts.sidebar);
        const sidebarEl = parts.sidebar;
        const onSidebarClick = (e) => {
          if (state.destroyed) {
            return;
          }
          const target = e.target instanceof Element ? e.target : null;
          const clickedBtn = target ? target.closest("button") : null;
          if (!clickedBtn || !sidebarEl.contains(clickedBtn)) {
            return;
          }
          if (clickedBtn.getAttribute("data-testid") === NAV_TESTID) {
            e.preventDefault();
            e.stopPropagation();
            ensureSettingsUi();
            setCustomTabActive(true);
          } else if (state.customTabActive) {
            setCustomTabActive(false);
          }
        };
        sidebarEl.addEventListener("click", onSidebarClick, true);
        state.sidebarCleanups.push(() => {
          sidebarEl.removeEventListener("click", onSidebarClick, true);
        });
      }

      updateNavButtonAppearance(
        navWrapper.querySelector(`[data-testid="${NAV_TESTID}"]`),
        state.customTabActive
      );
    } else if (state.customTabActive && !parts.sidebar) {
      // Sidebar disappeared (e.g. fullscreen project view) -> restore native view
      setCustomTabActive(false);
    }

    // Mount right-hand Custom Theme panel sibling inside contentContainer
    if (parts.nativeViewport && parts.contentContainer) {
      setAttrIfChanged(parts.nativeViewport, "data-agy-ct-native-viewport", "true");
      let panel = parts.contentContainer.querySelector('[data-agy-ct-panel="true"]');
      if (!panel) {
        panel = state.uiRefs && state.uiRefs.viewport ? state.uiRefs.viewport : buildPanelDom();
        parts.contentContainer.appendChild(panel);
      }
      panel.style.display = state.customTabActive ? "flex" : "none";
    }
  }

  function scheduleSettingsSync() {
    if (state.destroyed || state.rafSettingsScheduled) {
      return;
    }
    state.rafSettingsScheduled = true;
    window.requestAnimationFrame(() => {
      state.rafSettingsScheduled = false;
      try {
        ensureSettingsUi();
      } catch {
        // Never allow Settings observer errors to break Hub UI.
      }
    });
  }

  function isInternalMutationNode(node) {
    if (!(node instanceof Element)) {
      return false;
    }
    return Boolean(
      node.id === WALLPAPER_LAYER_ID ||
        node.id === UI_STYLE_ID ||
        node.closest("[data-agy-ct-panel]") ||
        node.closest("[data-agy-ct-nav-wrapper]")
    );
  }

  function setupObservers() {
    const onResize = () => scheduleHoleClipUpdate();
    window.addEventListener("resize", onResize);

    if (typeof ResizeObserver === "function") {
      state.holeResizeObserver = new ResizeObserver(() => {
        scheduleHoleClipUpdate();
      });
    }

    const observer = new MutationObserver((mutations) => {
      let needSettings = false;
      let needHole = false;
      let needLayer = false;

      for (const m of mutations) {
        if (m.type === "attributes") {
          const target = m.target;
          if (m.attributeName === "data-has-browser-hole" || m.attributeName === "data-browser-hole") {
            needHole = true;
          }
          if (
            m.attributeName === "aria-hidden" &&
            target instanceof Element &&
            target.classList.contains("settings-modal-backdrop")
          ) {
            needSettings = true;
          }
          if (
            state.customTabActive &&
            m.attributeName === "style" &&
            target instanceof HTMLElement &&
            target !== state.lastNativeActiveScreen &&
            target.style.display === "block" &&
            target.parentElement &&
            target.parentElement.classList.contains("grow") &&
            target.closest(".settings-modal-container")
          ) {
            setCustomTabActive(false);
          }
        } else if (m.type === "childList") {
          if (m.target === document.body && !document.getElementById(WALLPAPER_LAYER_ID)) {
            needLayer = true;
          }
          for (const added of m.addedNodes) {
            if (isInternalMutationNode(added)) {
              continue;
            }
            if (added instanceof Element) {
              if (
                added.classList.contains("settings-modal-backdrop") ||
                added.classList.contains("settings-modal-container") ||
                added.querySelector?.('[data-testid="settings-sidebar"], .settings-modal-container')
              ) {
                needSettings = true;
              }
              if (
                added.hasAttribute("data-browser-hole") ||
                added.querySelector?.("[data-browser-hole]")
              ) {
                needHole = true;
              }
            }
          }
          for (const removed of m.removedNodes) {
            if (removed instanceof Element) {
              if (
                removed.id === WALLPAPER_LAYER_ID ||
                removed.id === UI_STYLE_ID
              ) {
                needLayer = true;
                needSettings = true;
              }
              if (
                removed.hasAttribute("data-agy-ct-nav-wrapper") ||
                removed.hasAttribute("data-agy-ct-panel") ||
                removed.classList.contains("settings-modal-container") ||
                removed.classList.contains("settings-modal-backdrop")
              ) {
                needSettings = true;
              }
              if (
                removed.hasAttribute("data-browser-hole") ||
                removed.querySelector?.("[data-browser-hole]")
              ) {
                needHole = true;
              }
            }
          }
        }
      }

      if (needLayer) {
        ensureWallpaperLayer();
      }
      if (needHole) {
        scheduleHoleClipUpdate();
      }
      if (needSettings) {
        scheduleSettingsSync();
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-hidden", "data-has-browser-hole", "data-browser-hole", "style"],
    });
    state.domObserver = observer;

    return () => {
      window.removeEventListener("resize", onResize);
    };
  }

  function cleanupAll(removeWindowListeners) {
    state.destroyed = true;
    state.pendingTimers.forEach((t) => clearTimeout(t));
    state.pendingTimers.clear();
    if (state.statusTimer) {
      clearTimeout(state.statusTimer);
      state.statusTimer = null;
    }
    if (state.domObserver) {
      state.domObserver.disconnect();
      state.domObserver = null;
    }
    if (state.holeResizeObserver) {
      state.holeResizeObserver.disconnect();
      state.holeResizeObserver = null;
    }
    state.observedHoleNodes.clear();
    for (const unbindSidebar of state.sidebarCleanups) {
      try {
        unbindSidebar();
      } catch {
        // Ignore cleanup error on detached sidebar.
      }
    }
    state.sidebarCleanups = [];
    if (typeof removeWindowListeners === "function") {
      removeWindowListeners();
    }
    if (typeof state.unsubConfig === "function") {
      try {
        state.unsubConfig();
      } catch {
        // Ignore unsubscribe error.
      }
      state.unsubConfig = null;
    }

    setCustomTabActive(false);
    document.querySelectorAll('[data-agy-ct-nav-wrapper="true"]').forEach((el) => el.remove());
    document.querySelectorAll('[data-agy-ct-panel="true"]').forEach((el) => el.remove());
    const styleEl = document.getElementById(UI_STYLE_ID);
    if (styleEl) {
      styleEl.remove();
    }
  }

  async function init() {
    ensureUiStyle();
    const removeWindowListeners = setupObservers();

    window[PREV_CLEANUP_KEY] = () => cleanupAll(removeWindowListeners);

    const api = getApi();
    if (api && typeof api.onConfigChanged === "function") {
      state.unsubConfig = api.onConfigChanged((nextCfg) => {
        if (state.destroyed) {
          return;
        }
        const normalized = normalizeConfig(nextCfg);
        if (state.activeDragKey && Object.prototype.hasOwnProperty.call(normalized, state.activeDragKey)) {
          normalized[state.activeDragKey] = state.config[state.activeDragKey];
        }
        const wpChanged = normalized.wallpaper !== state.config.wallpaper;
        state.config = normalized;
        applyConfigToDom(state.config);
        if (wpChanged && state.customTabActive) {
          void refreshWallpapers();
        }
        syncUiControls();
      });
    }

    if (api && typeof api.getConfig === "function") {
      try {
        const cfg = await api.getConfig();
        if (state.destroyed) {
          return;
        }
        state.config = normalizeConfig(cfg);
      } catch {
        state.config = { ...DEFAULT_CONFIG };
      }
    }

    applyConfigToDom(state.config);
    updateBrowserHoleClip();
    ensureSettingsUi();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void init(), { once: true });
  } else {
    void init();
  }
})();
