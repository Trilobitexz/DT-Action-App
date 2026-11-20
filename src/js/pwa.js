// PWA 設定：本機 file:// 預覽不註冊 Service Worker，正式 HTTP(S) 部署時才啟用離線殼層。
(function registerPwa() {
  if (!("serviceWorker" in navigator) || !/^https?:$/.test(window.location.protocol)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js", { scope: "./" })
      .then(registration => {
        registration.update().catch(error => {
          console.warn("PWA 更新檢查失敗：", error);
        });
      })
      .catch(error => {
        console.warn("PWA 離線功能無法啟用：", error);
      });
  });
})();
