/* =======================================================
   NIGHT APP - BACKGROUND SERVICE WORKER
   İnternetteki tüm .pdf linklerini yakalayıp eklentiye yönlendirir.
======================================================== */

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Sadece URL değişikliği olduğunda tetikle
  if (!changeInfo.url) return;

  try {
    const urlObj = new URL(changeInfo.url);

    // KORUMA 1: Eğer link zaten eklentimizin içindeyse döngüyü durdur
    if (urlObj.protocol === "chrome-extension:") {
      return;
    }

    // KORUMA 2: Linkin dosya yolu (pathname) gerçekten .pdf ile bitiyorsa
    if (urlObj.pathname.toLowerCase().endsWith('.pdf')) {
      const viewerUrl = chrome.runtime.getURL("pdfjs/web/viewer.html");
      const finalUrl = `${viewerUrl}?file=${encodeURIComponent(changeInfo.url)}`;
      
      // Kullanıcıyı hemen karanlık mod okuyucumuza yönlendir
      chrome.tabs.update(tabId, { url: finalUrl });
    }
  } catch (error) {
    // Geçersiz URL'lerde hatayı yoksay
  }
});

// Popup tetikleyicisi
chrome.action.onClicked.addListener((tab) => {
  // Tıklama işlemleri popup tarafında yönetiliyor
});