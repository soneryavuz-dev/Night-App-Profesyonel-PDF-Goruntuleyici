document.addEventListener("DOMContentLoaded", () => {
  const urlInput = document.getElementById("urlInput");
  const openCurrentBtn = document.getElementById("openCurrentBtn");
  const openUrlBtn = document.getElementById("openUrlBtn");
  const openFileBtn = document.getElementById("openFileBtn");
  const status = document.getElementById("status");

  // Eklentimizin pdf okuyucu adresi
  const VIEWER_PATH = chrome.runtime.getURL("pdfjs/web/viewer.html");

  function openViewer(url) {
    if (!url) {
      status.textContent = "Hata: PDF kaynağı boş.";
      status.style.color = "#ff6b6b";
      return;
    }

    if (url.startsWith("chrome-extension://")) {
      status.textContent = "Zaten eklenti sayfasındasınız.";
      return;
    }

    const targetUrl = `${VIEWER_PATH}?file=${encodeURIComponent(url)}`;
    chrome.tabs.create({ url: targetUrl });
    status.textContent = "Açılıyor...";
    status.style.color = "#6a5cff";
  }

  // Popup açıldığında aktif sekmeyi kontrol et
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (tab?.url && tab.url.toLowerCase().includes(".pdf")) {
      urlInput.value = tab.url;
    }
  });

  // "Aktif Sekmeyi Aç"
  openCurrentBtn.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      if (tab?.url) {
        openViewer(tab.url);
      } else {
        status.textContent = "Aktif sekme URL'si alınamadı.";
      }
    });
  });

  // "URL'yi Aç"
  openUrlBtn.addEventListener("click", () => {
    const url = urlInput.value.trim();
    openViewer(url);
  });

  // "Yerel Dosya Seç" 
  // DOĞRUDAN OKUYUCUYU AÇIYORUZ, SEÇİMİ ORADA YAPACAK
  openFileBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: VIEWER_PATH });
  });
});