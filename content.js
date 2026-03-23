const FILTER_ID = "nightvision-svg-engine";
const OVERLAY_ID = "nightvision-overlay-layer";

const DEFAULT_SETTINGS = {
  brightness: 100,
  contrast: 100,
  invert: 0,
  gamma: 1.0,
  saturation: 100,
  grayscale: 0,
  sepia: 0,
  blueLight: 0,
  sharpness: 0,
  hue: 0,
  overlay: "transparent"
};

const VIEWER_SELECTORS = [
  "embed[type='application/pdf']",
  "object[type='application/pdf']",
  "iframe[type='application/pdf']",
  "embed",
  "object",
  "iframe",
  "pdf-viewer"
];

let currentState = {
  enabled: false,
  settings: { ...DEFAULT_SETTINGS }
};

let observer = null;
let applyTimer = null;
let appliedTargets = new Set();
let lastSettingsSignature = "";

/* =========================
   🔴 CHROME PDF DETECTOR
========================= */
function isChromePdfViewer() {
  const ua = navigator.userAgent.toLowerCase();
  const isChrome = ua.includes("chrome") && !ua.includes("edg");
  const hasPdfViewer = document.querySelector("pdf-viewer");
  return isChrome && hasPdfViewer;
}

/* ========================= */

function clamp(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function normalizeSettings(input = {}) {
  const s = { ...DEFAULT_SETTINGS, ...input };

  return {
    brightness: clamp(s.brightness, 0, 300, DEFAULT_SETTINGS.brightness),
    contrast: clamp(s.contrast, 0, 300, DEFAULT_SETTINGS.contrast),
    invert: clamp(s.invert, 0, 100, DEFAULT_SETTINGS.invert),
    gamma: clamp(s.gamma, 0.1, 3.0, DEFAULT_SETTINGS.gamma),
    saturation: clamp(s.saturation, 0, 400, DEFAULT_SETTINGS.saturation),
    grayscale: clamp(s.grayscale, 0, 100, DEFAULT_SETTINGS.grayscale),
    sepia: clamp(s.sepia, 0, 100, DEFAULT_SETTINGS.sepia),
    blueLight: clamp(s.blueLight, 0, 100, DEFAULT_SETTINGS.blueLight),
    sharpness: clamp(s.sharpness, 0, 10, DEFAULT_SETTINGS.sharpness),
    hue: clamp(s.hue, -180, 180, DEFAULT_SETTINGS.hue),
    overlay: typeof s.overlay === "string" ? s.overlay : DEFAULT_SETTINGS.overlay
  };
}

function uniqueElements(elements) {
  return [...new Set(elements.filter(Boolean))];
}

function getOverlay() {
  let overlay = document.getElementById(OVERLAY_ID);

  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 2147483647;
      mix-blend-mode: multiply;
      transition: background-color 0.2s ease, opacity 0.2s ease;
      background-color: transparent;
    `;

    const root = document.documentElement || document.body;
    if (root) root.appendChild(overlay);
  }

  return overlay;
}

function removeSvgFilter() {
  const old = document.getElementById(FILTER_ID);
  if (old) old.remove();
}

function ensureSvgFilter(settings) {
  const signature = JSON.stringify({
    gamma: settings.gamma,
    blueLight: settings.blueLight,
    sharpness: settings.sharpness
  });

  const existing = document.getElementById(FILTER_ID);
  if (existing && signature === lastSettingsSignature) {
    return;
  }

  removeSvgFilter();

  const g = clamp(settings.gamma, 0.1, 3.0, DEFAULT_SETTINGS.gamma);
  const blue = clamp(settings.blueLight, 0, 100, DEFAULT_SETTINGS.blueLight);
  const sharpness = clamp(settings.sharpness, 0, 10, DEFAULT_SETTINGS.sharpness);

  let colorMatrix = "";
  if (blue > 0) {
    const b = 1 - blue / 100;
    colorMatrix = `
      <feColorMatrix type="matrix" values="
        1 0 0 0 0
        0 1 0 0 0
        0 0 ${b} 0 0
        0 0 0 1 0
      "/>
    `;
  }

  let convolute = "";
  if (sharpness > 0) {
    const k = clamp(sharpness * 0.35, 0.2, 3);
    const c = 1 + (4 * k);
    convolute = `
      <feConvoluteMatrix
        order="3"
        kernelMatrix="
          0 -${k} 0
          -${k} ${c} -${k}
          0 -${k} 0"
        preserveAlpha="true"
      />
    `;
  }

  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.id = FILTER_ID;
  svg.setAttribute("aria-hidden", "true");
  svg.style.cssText = "height:0;width:0;position:fixed;left:-9999px;top:-9999px;";

  svg.innerHTML = `
    <defs>
      <filter id="nv-filter" x="-20%" y="-20%" width="140%" height="140%">
        <feComponentTransfer>
          <feFuncR type="gamma" amplitude="1" exponent="${g}" offset="0" />
          <feFuncG type="gamma" amplitude="1" exponent="${g}" offset="0" />
          <feFuncB type="gamma" amplitude="1" exponent="${g}" offset="0" />
        </feComponentTransfer>
        ${convolute}
        ${colorMatrix}
      </filter>
    </defs>
  `;

  (document.documentElement || document.body).appendChild(svg);
  lastSettingsSignature = signature;
}

/* =========================
   🔴 TARGET FIX
========================= */
function getViewerTargets() {
  if (isChromePdfViewer()) {
    return [document.documentElement];
  }

  const collected = [];

  for (const selector of VIEWER_SELECTORS) {
    document.querySelectorAll(selector).forEach((el) => collected.push(el));
  }

  const targets = uniqueElements(collected);

  if (targets.length > 0) return targets;
  if (document.body) return [document.body];

  return [];
}

/* ========================= */

function getFilterString(settings) {
  const filters = ["url(#nv-filter)"];

  if (clamp(settings.invert, 0, 100, 0) > 50) {
    filters.push("invert(1) hue-rotate(180deg)");
  }

  if (settings.brightness !== 100) filters.push(`brightness(${settings.brightness}%)`);
  if (settings.contrast !== 100) filters.push(`contrast(${settings.contrast}%)`);
  if (settings.grayscale > 0) filters.push(`grayscale(${settings.grayscale}%)`);
  if (settings.sepia > 0) filters.push(`sepia(${settings.sepia}%)`);
  if (settings.saturation !== 100) filters.push(`saturate(${settings.saturation}%)`);
  if (settings.hue !== 0) filters.push(`hue-rotate(${settings.hue}deg)`);

  return filters.join(" ");
}

function clearTargetStyles() {
  for (const el of appliedTargets) {
    try { el.style.filter = ""; } catch (_) {}
  }
  appliedTargets.clear();

  document.documentElement.style.filter = "";
}

function clearRootStyles() {
  if (document.documentElement) document.documentElement.style.backgroundColor = "";
  if (document.body) document.body.style.backgroundColor = "";
}

/* =========================
   🔴 OVERLAY FIX
========================= */
function applyRootStyles(settings) {
  const isDark = clamp(settings.invert, 0, 100, 0) > 50;
  const bg = isDark ? "#121212" : "#555555";

  if (document.documentElement) document.documentElement.style.backgroundColor = bg;
  if (document.body) document.body.style.backgroundColor = bg;

  if (isChromePdfViewer()) return; // 🔴 CRITICAL FIX

  const overlay = getOverlay();
  overlay.style.backgroundColor =
    settings.overlay && settings.overlay !== "transparent"
      ? settings.overlay
      : "transparent";

  overlay.style.mixBlendMode = isDark ? "normal" : "multiply";
}

/* =========================
   🔴 APPLY FIX
========================= */
function applySettings(enabled, settings) {
  currentState.enabled = !!enabled;
  currentState.settings = normalizeSettings(settings);

  if (!currentState.enabled) {
    clearTargetStyles();
    clearRootStyles();
    removeSvgFilter();
    return;
  }

  ensureSvgFilter(currentState.settings);
  clearTargetStyles();

  const filterString = getFilterString(currentState.settings);

  if (isChromePdfViewer()) {
    document.documentElement.style.filter = filterString;
  } else {
    const targets = getViewerTargets();
    for (const el of targets) {
      try {
        el.style.filter = filterString;
        appliedTargets.add(el);
      } catch (_) {}
    }
  }

  applyRootStyles(currentState.settings);
}

/* ========================= */

function init() {
  chrome.storage.local.get(["enabled", "settings"], (data) => {
    applySettings(data.enabled, data.settings);
  });

  chrome.runtime.onMessage.addListener((req) => {
    if (req.action === "applyFilter") {
      applySettings(req.enabled, req.settings);
    }
  });
}

init();