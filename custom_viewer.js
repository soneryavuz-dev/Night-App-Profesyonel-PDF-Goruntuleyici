// Worker dosyasının yerini Chrome'a kesin olarak bildiriyoruz
pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("pdfjs/build/pdf.worker.js");

const urlParams = new URLSearchParams(window.location.search);
const file = urlParams.get("file");

if (!file) {
  document.body.innerHTML = "<h2 style='color: white;'>PDF bulunamadı.</h2>";
} else {
  const loadingTask = pdfjsLib.getDocument(file);

  loadingTask.promise.then(pdf => {
    const viewer = document.getElementById("viewer");

    for (let i = 1; i <= pdf.numPages; i++) {
      pdf.getPage(i).then(page => {
        const viewport = page.getViewport({ scale: 1.5 });

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        viewer.appendChild(canvas);

        page.render({
          canvasContext: ctx,
          viewport: viewport
        });
      });
    }
  }).catch(err => {
    console.error("PDF.js Detaylı Hata:", err);
    // Hatayı ekrana da yazdırıyoruz ki konsola bakmadan ne olduğunu görebilelim
    document.body.innerHTML = `<h2 style='color: red;'>PDF yüklenemedi</h2><p style='color: white;'>Sebep: ${err.message || "Bilinmeyen Hata"}</p>`;
  });
}