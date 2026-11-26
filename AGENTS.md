# DT-Action-App 專案規範

## 架構與相依性

- 本專案是部署於 GitHub Pages 的純前端網站，使用 Vanilla HTML、CSS 與 JavaScript。
- 不加入 React、Tailwind、打包器、建置流程或 npm 執行期相依套件；除非使用者明確要求並核准架構變更。
- `index.html` 的一般腳本以全域變數及 `defer` 載入。保留既有載入順序；調整前先確認 `map`、`data`、`services`、`store`、`modules`、Firebase、`app.js` 與 PWA 的相依關係。
- 先讀取任務涉及的檔案及其呼叫端，再做範圍明確的小幅修改。多檔案工作先說明影響範圍，但除非缺少必要資訊或操作不可逆，不要把例行實作停在等待確認。

## 地圖與資料

- MapLibre GeoJSON 座標一律使用 `[Number(lng), Number(lat)]`。外部資料若以 `lat`、`lng` 欄位提供，轉成 GeoJSON 時明確調整順序。
- 保留城市地圖、篩選、標記、彈出資訊、行程連動、底圖與 2D／3D 控制的既有互動；地圖路線跨越國際換日線時需處理經度環繞。
- 不編造景點座標、營業時間、評分、費用、航班或交通時間。資料來源失敗時保留可用資料並提供清楚的降級狀態。

## DOM、無障礙與安全

- 保留既有 DOM `id`、`data-*`、事件綁定及 `aria-*` 屬性；若需改動，搜尋所有讀取端並同步更新。
- 維持鍵盤操作、螢幕閱讀器提示與手機 RWD；避免新增遮擋地圖互動的圖層或控制項。
- 不將私密 API 金鑰、reCAPTCHA secret、Firebase Service Account、Debug Token 或其他憑證寫入前端、版本控制或日誌。Firebase Web 設定及 reCAPTCHA site key 僅能使用公開用戶端設定。
- 不放寬 Firestore 使用者資料的 UID 權限邊界；管理憑證只可在受控的本機管理腳本使用。

## 修改、驗證與 Git

- 修改 JavaScript 後，對每個變更檔執行 `node --check <檔案路徑>`；提交前執行 `git diff --check`。修改 HTML 綁定時，交叉檢查對應的 DOM selector 與事件。
- 不為執行檢查而引入測試框架或建置工具。資料處理邏輯若適合獨立驗證，優先用輕量 Node 驗證；依任務要求決定是否新增測試檔。
- 保持差異聚焦，不使用會丟棄使用者修改的 `git checkout .`、`git reset --hard` 或等效操作。
- 會發布到 GitHub Pages 的程式變更，統一遞增 `index.html`、`sw.js` 的本地資源查詢版號及 Service Worker 快取名稱，並同步 README／QA 記錄。文件專屬變更不必改動網站快取版號。
- 使用者已授權專案工作直接提交並推送至 `origin/main`；完成必要檢查後可直接執行。不可 force-push 或改寫遠端歷史。
