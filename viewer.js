/* =======================================================
   🔥 CHROME "willReadFrequently" UYARILARINI DÜZELTME 🔥
   PDF.js'in kendi içindeki tuval hatalarını otomatik onarır.
======================================================== */
const originalGetContext = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function(contextType, contextAttributes) {
  if (contextType === '2d') {
    contextAttributes = contextAttributes || {};
    contextAttributes.willReadFrequently = true;
  }
  return originalGetContext.call(this, contextType, contextAttributes);
};
/* ======================================================= */

// Worker dosyasının yerini Chrome'a kesin olarak bildiriyoruz (Tek satır yeterli)
pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("pdfjs/build/pdf.worker.js");

const DEFAULT_SETTINGS = {
  brightness: 100, contrast: 100, invert: 0, gamma: 1.0,
  saturation: 100, grayscale: 0, sepia: 0, blueLight: 0,
  sharpness: 0, hue: 0, overlay: "transparent"
};

const PRESETS = {
  default:       { ...DEFAULT_SETTINGS },
  pureDark:      { brightness: 95,  contrast: 112, invert: 100, hue: 180, saturation: 90,  sepia: 0,  grayscale: 0,   gamma: 1.0, blueLight: 0, sharpness: 0, overlay: "rgba(0,0,0,0.20)" },
  warmNight:     { brightness: 90,  contrast: 105, invert: 0,   hue: 10,  saturation: 85,  sepia: 25, grayscale: 0,   gamma: 1.1, blueLight: 50, sharpness: 0, overlay: "rgba(30,20,10,0.25)" },
  amoled:        { brightness: 105, contrast: 130, invert: 100, hue: 180, saturation: 75,  sepia: 0,  grayscale: 100, gamma: 1.0, blueLight: 0, sharpness: 0, overlay: "rgba(0,0,0,0.40)" },
  terminal:      { brightness: 100, contrast: 130, invert: 100, hue: 90,  saturation: 250, sepia: 0,  grayscale: 0,   gamma: 0.9, blueLight: 0, sharpness: 2, overlay: "rgba(0,20,0,0.1)" },
  scannedPdf:    { brightness: 115, contrast: 125, invert: 0,   hue: 0,   saturation: 0,   sepia: 0,  grayscale: 100, gamma: 0.8, blueLight: 0, sharpness: 4, overlay: "transparent" }
};

const els = {
  sidebar: document.getElementById("sidebar"),
  toggleSidebarBtn: document.getElementById("toggleSidebarBtn"),
  closeSidebarBtn: document.getElementById("closeSidebarBtn"),
  enabled: document.getElementById("enabled"),
  presets: document.querySelectorAll(".preset-btn"),
  brightness: document.getElementById("brightness"),
  contrast: document.getElementById("contrast"),
  invert: document.getElementById("invert"),
  gamma: document.getElementById("gamma"),
  saturation: document.getElementById("saturation"),
  grayscale: document.getElementById("grayscale"),
  sepia: document.getElementById("sepia"),
  blueLight: document.getElementById("blueLight"),
  sharpness: document.getElementById("sharpness"),
  hue: document.getElementById("hue"),
  valBrightness: document.getElementById("val-brightness"),
  valContrast: document.getElementById("val-contrast"),
  valInvert: document.getElementById("val-invert"),
  valGamma: document.getElementById("val-gamma"),
  valSaturation: document.getElementById("val-saturation"),
  valGrayscale: document.getElementById("val-grayscale"),
  valSepia: document.getElementById("val-sepia"),
  valBlueLight: document.getElementById("val-blueLight"),
  valSharpness: document.getElementById("val-sharpness"),
  valHue: document.getElementById("val-hue"),
  openFileBtn: document.getElementById("openFileBtn"),
  fileInput: document.getElementById("fileInput"),
  info: document.getElementById("info"),
  fitWidthBtn: document.getElementById("fitWidthBtn"),
  fitPageBtn: document.getElementById("fitPageBtn"),
  zoomOutBtn: document.getElementById("zoomOutBtn"),
  zoomInBtn: document.getElementById("zoomInBtn"),
  pageMeta: document.getElementById("pageMeta"),
  stage: document.getElementById("stage"),
  pdfPages: document.getElementById("pdfPages"),
  svg: document.getElementById("nightvision-svg-engine")
};

// Başlangıçta Karanlık Mod "Kapalı" (false) olarak ayarlandı
let state = {
  enabled: false,
  settings: { ...DEFAULT_SETTINGS },
  pdf: null,
  src: "",
  scale: 1.0,
  fitMode: "width",
  renderToken: 0
};

/* --- YARDIMCI FONKSİYONLAR --- */
function clamp(v, min, max, def) {
  const n = parseFloat(v);
  return isNaN(n) ? def : Math.min(max, Math.max(min, n));
}

function normalizeSettings(s = {}) {
  return {
    brightness: clamp(s.brightness, 0, 300, 100),
    contrast: clamp(s.contrast, 0, 300, 100),
    invert: clamp(s.invert, 0, 100, 0),
    gamma: clamp(s.gamma, 0.1, 3.0, 1.0),
    saturation: clamp(s.saturation, 0, 400, 100),
    grayscale: clamp(s.grayscale, 0, 100, 0),
    sepia: clamp(s.sepia, 0, 100, 0),
    blueLight: clamp(s.blueLight, 0, 100, 0),
    sharpness: clamp(s.sharpness, 0, 10, 0),
    hue: clamp(s.hue, -180, 180, 0),
    overlay: s.overlay || "transparent"
  };
}

function updateLabels() {
  els.valBrightness.textContent = `${els.brightness.value}%`;
  els.valContrast.textContent = `${els.contrast.value}%`;
  els.valInvert.textContent = Number(els.invert.value) > 50 ? "Açık" : "Kapalı";
  els.valGamma.textContent = `${els.gamma.value}`;
  els.valSaturation.textContent = `${els.saturation.value}%`;
  els.valGrayscale.textContent = `${els.grayscale.value}%`;
  els.valSepia.textContent = `${els.sepia.value}%`;
  els.valBlueLight.textContent = `${els.blueLight.value}%`;
  els.valSharpness.textContent = `${els.sharpness.value}`;
  els.valHue.textContent = `${els.hue.value}°`;
}

function applySettingsToUI(settings) {
  els.brightness.value = settings.brightness;
  els.contrast.value = settings.contrast;
  els.invert.value = settings.invert;
  els.gamma.value = settings.gamma;
  els.saturation.value = settings.saturation;
  els.grayscale.value = settings.grayscale;
  els.sepia.value = settings.sepia;
  els.blueLight.value = settings.blueLight;
  els.sharpness.value = settings.sharpness;
  els.hue.value = settings.hue;
  els.enabled.checked = state.enabled;
  updateLabels();
  applyVisuals();
}

function getOverlay() {
  let overlay = document.getElementById("nv-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "nv-overlay";
    overlay.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:9999;mix-blend-mode:multiply;";
    document.body.appendChild(overlay);
  }
  return overlay;
}

function buildSvgFilter(s) {
  if (!els.svg) return;
  const blue = 1 - (s.blueLight / 100);
  const k = s.sharpness * 0.35;
  const c = 1 + (4 * k);

  els.svg.innerHTML = `
    <defs>
      <filter id="nv-filter">
        <feComponentTransfer>
          <feFuncR type="gamma" exponent="${s.gamma}" /><feFuncG type="gamma" exponent="${s.gamma}" /><feFuncB type="gamma" exponent="${s.gamma}" />
        </feComponentTransfer>
        ${s.blueLight > 0 ? `<feColorMatrix type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 ${blue} 0 0 0 0 0 1 0"/>` : ""}
        ${s.sharpness > 0 ? `<feConvoluteMatrix order="3" kernelMatrix="0 -${k} 0 -${k} ${c} -${k} 0 -${k} 0" preserveAlpha="true"/>` : ""}
      </filter>
    </defs>`;
}

function applyVisuals() {
  const s = state.settings;
  buildSvgFilter(s);
  const filterStr = state.enabled ? `url(#nv-filter) ${s.invert > 50 ? "invert(1) hue-rotate(180deg)" : ""} brightness(${s.brightness}%) contrast(${s.contrast}%) saturate(${s.saturation}%) sepia(${s.sepia}%) grayscale(${s.grayscale}%) hue-rotate(${s.hue}deg)` : "none";
  els.pdfPages.style.filter = filterStr;
  const overlay = getOverlay();
  overlay.style.backgroundColor = state.enabled ? s.overlay : "transparent";
  overlay.style.mixBlendMode = s.invert > 50 ? "normal" : "multiply";
}

function applyZoom() {
  if (!state.pdf) return;
  const pageWraps = document.querySelectorAll(".page-wrap");
  if (pageWraps.length === 0) return;
  
  const MARGIN = 120;
  let availableWidth = els.stage.clientWidth - MARGIN;
  if (availableWidth <= 0) availableWidth = window.innerWidth - MARGIN;
  let availableHeight = els.stage.clientHeight - MARGIN;

  const baseW = parseFloat(pageWraps[0].dataset.baseWidth);
  const baseH = parseFloat(pageWraps[0].dataset.baseHeight);

  if (state.fitMode === "width") {
    state.scale = availableWidth / baseW;
  } else if (state.fitMode === "page") {
    state.scale = Math.min(availableWidth / baseW, availableHeight / baseH);
  }

  pageWraps.forEach(wrap => {
    const w = parseFloat(wrap.dataset.baseWidth);
    const h = parseFloat(wrap.dataset.baseHeight);
    wrap.style.width = Math.floor(w * state.scale) + "px";
    wrap.style.height = Math.floor(h * state.scale) + "px";
    
    const inner = wrap.querySelector(".page-inner");
    if (inner) {
      inner.style.transform = `scale(${state.scale})`;
    }
  });
}

async function renderAllPages() {
  if (!state.pdf) return;
  const token = ++state.renderToken;
  els.pdfPages.innerHTML = "";
  els.pageMeta.textContent = `1 / ${state.pdf.numPages}`;
  
  for (let i = 1; i <= state.pdf.numPages; i++) {
    if (token !== state.renderToken) break;
    
    const page = await state.pdf.getPage(i);
    const baseViewport = page.getViewport({ scale: 1.0 });
    const renderViewport = page.getViewport({ scale: 2.0 }); 
    
    const MARGIN = 120;
    let availableWidth = els.stage.clientWidth - MARGIN;
    if (availableWidth <= 0) availableWidth = window.innerWidth - MARGIN;
    let initialScale = state.scale;
    if (state.fitMode === "width") initialScale = availableWidth / baseViewport.width;
    
    const wrap = document.createElement("div");
    wrap.className = "page-wrap";
    wrap.style.position = "relative";
    wrap.dataset.baseWidth = baseViewport.width;
    wrap.dataset.baseHeight = baseViewport.height;
    wrap.style.width = Math.floor(baseViewport.width * initialScale) + "px";
    wrap.style.height = Math.floor(baseViewport.height * initialScale) + "px";
    
    const inner = document.createElement("div");
    inner.className = "page-inner";
    inner.style.position = "absolute";
    inner.style.top = "0";
    inner.style.left = "0";
    inner.style.transformOrigin = "top left";
    inner.style.width = baseViewport.width + "px";
    inner.style.height = baseViewport.height + "px";
    inner.style.transform = `scale(${initialScale})`;
    
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(renderViewport.width * dpr);
    canvas.height = Math.floor(renderViewport.height * dpr);
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.position = "absolute";
    canvas.style.zIndex = "1";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    inner.appendChild(canvas);
    
    const textLayerDiv = document.createElement("div");
    textLayerDiv.className = "textLayer";
    textLayerDiv.style.width = baseViewport.width + "px";
    textLayerDiv.style.height = baseViewport.height + "px";
    textLayerDiv.style.position = "absolute";
    textLayerDiv.style.zIndex = "2";
    textLayerDiv.style.setProperty('--scale-factor', "1");
    inner.appendChild(textLayerDiv);
    
    wrap.appendChild(inner);
    els.pdfPages.appendChild(wrap);
    
    const renderTask = page.render({ canvasContext: ctx, viewport: renderViewport });
    
   page.getTextContent().then(textContent => {
      const renderTask = pdfjsLib.renderTextLayer({
        textContent: textContent,
        textContentSource: textContent,
        container: textLayerDiv,
        viewport: baseViewport,
        textDivs: [],
        enhanceTextSelection: true // 🔥 Orijinal PDF.js Kopyalama ve Boşluk İyileştirmesi 🔥
      });

      // EKSTRA GÜVENLİK: Kopyalamada kelime birleşmesini önlemek için 
      // render bittikten sonra her kelimenin arasına gerçek bir DOM boşluğu ekliyoruz.
      if (renderTask.promise) {
        renderTask.promise.then(() => {
          const spans = textLayerDiv.querySelectorAll('span');
          spans.forEach(span => {
            span.insertAdjacentHTML('afterend', ' ');
          });
        });
      }
    }).catch(console.error);

    await renderTask.promise;
  }
  
  applyVisuals();
  applyZoom(); 
}

/* --- PDF YÜKLEME --- */
async function loadPdf(src) {
  if (!src) return;
  state.src = src;
  els.info.textContent = "Yükleniyor...";
  try {
    const loadingTask = pdfjsLib.getDocument(src);
    state.pdf = await loadingTask.promise;
    els.info.textContent = `PDF Hazır: ${state.pdf.numPages} sayfa`;
    
    const page1 = await state.pdf.getPage(1);
    const baseViewport = page1.getViewport({ scale: 1.0 });
    
    const MARGIN = 120; 
    let availableWidth = els.stage.clientWidth - MARGIN;
    if (availableWidth <= 0) availableWidth = window.innerWidth - MARGIN;
    let availableHeight = els.stage.clientHeight - MARGIN;
    
    const fitPageScale = Math.min(availableWidth / baseViewport.width, availableHeight / baseViewport.height);
    
    state.scale = fitPageScale * Math.pow(1.25, 3);
    state.fitMode = "custom"; 
    
    renderAllPages();
  } catch (err) {
    console.error(err);
    els.info.textContent = "Hata: PDF yüklenemedi.";
  }
}

function bindEvents() {
  els.toggleSidebarBtn.onclick = () => {
    els.sidebar.classList.add("open");
  };
  els.closeSidebarBtn.onclick = () => {
    els.sidebar.classList.remove("open");
  };

  els.enabled.onchange = () => { state.enabled = els.enabled.checked; applyVisuals(); saveState(); };
  
  const controls = ["brightness", "contrast", "invert", "gamma", "saturation", "grayscale", "sepia", "blueLight", "sharpness", "hue"];
  controls.forEach(c => {
    els[c].oninput = () => {
      state.settings[c] = parseFloat(els[c].value);
      updateLabels();
      applyVisuals();
      saveState();
    };
  });

  els.presets.forEach(btn => btn.onclick = () => {
    els.presets.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    state.settings = normalizeSettings(PRESETS[btn.dataset.preset]);
    applySettingsToUI(state.settings);
    saveState();
  });

  els.fitWidthBtn.onclick = () => { state.fitMode = "width"; applyZoom(); };
  els.fitPageBtn.onclick = () => { state.fitMode = "page"; applyZoom(); };
  els.zoomInBtn.onclick = () => { state.fitMode = "custom"; state.scale *= 1.25; applyZoom(); };
  els.zoomOutBtn.onclick = () => { state.fitMode = "custom"; state.scale /= 1.25; applyZoom(); };
  
  els.openFileBtn.onclick = () => els.fileInput.click();
  els.fileInput.onchange = () => {
    const file = els.fileInput.files[0];
    if (file) {
      loadPdf(URL.createObjectURL(file));
      // Artık dosya açıldığında yan paneli kapatmıyoruz ki kullanıcı ayarları görebilsin
    }
  };

  els.stage.addEventListener("scroll", () => {
    if (!state.pdf) return;
    const pageWraps = document.querySelectorAll(".page-wrap");
    if (pageWraps.length === 0) return;
    let currentPage = 1;
    let minDistance = Infinity;
    const stageRect = els.stage.getBoundingClientRect();
    const stageCenter = stageRect.top + (stageRect.height / 2);
    pageWraps.forEach((wrap, index) => {
      const rect = wrap.getBoundingClientRect();
      const wrapCenter = rect.top + (rect.height / 2);
      const distance = Math.abs(wrapCenter - stageCenter);
      if (distance < minDistance) {
        minDistance = distance;
        currentPage = index + 1;
      }
    });
    els.pageMeta.textContent = `${currentPage} / ${state.pdf.numPages}`;
  });

  window.addEventListener("resize", () => {
    if (state.pdf && (state.fitMode === "width" || state.fitMode === "page")) {
      applyZoom();
    }
  });
}

function saveState() { chrome.storage.local.set({ enabled: state.enabled, settings: state.settings }); }

async function init() {
  const data = await chrome.storage.local.get(["enabled", "settings"]);
  
  // 🔥 Eklenti ilk yüklendiğinde Karanlık Mod her zaman KAPALI gelsin
  // (Eğer daha önceden eklentide manuel olarak "Açık" bıraktıysa bunu hatırlar)
  state.enabled = data.enabled === undefined ? false : data.enabled;
  
  state.settings = normalizeSettings(data.settings);
  applySettingsToUI(state.settings);
  bindEvents();
  
  // 🔥 Yan panel her açılışta açık olarak gelsin
  els.sidebar.classList.add("open");
  
  const params = new URLSearchParams(window.location.search);
  const file = params.get("file") || params.get("src");
  
  if (file) {
    loadPdf(file);
  } else {
    els.info.textContent = "Lütfen yukarıdan bir dosya seçin.";
    els.pdfPages.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height: 50vh; color: var(--muted); font-family: sans-serif; text-align: center;">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 20px; opacity: 0.5;">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="12" y1="18" x2="12" y2="12"></line>
          <line x1="9" y1="15" x2="15" y2="15"></line>
        </svg>
        <h2 style="margin:0;">Görüntülenecek PDF Yok</h2>
        <p style="margin-top: 10px; font-size:14px; max-width: 300px;">
          Lütfen sol üstteki <b style="color:var(--text)">Ayarlar</b> menüsünden bilgisayarınızdan bir PDF seçin.
        </p>
      </div>
    `;
  }
}

init();