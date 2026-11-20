# DT-Action-App：旅遊地點分析 APP (Travel Spot Analyzer)

本專案為「設計思考與行動 APP 程式設計應用」課程之學生原型實作專案，依據使用者訪談回饋（直飛航班需求、物價查詢、避免資訊雜亂）進行規劃與迭代。

---

## 專案核心特色

1. **互動式世界地圖**：提供世界地圖視角，支援縮放、平移與直覺點選；進入城市後會沿用同一張地圖放大至城市尺度，只顯示已編目或已定位的景點與機場標記，點擊標記可查看資訊並返回世界或上一層地圖。
2. **大洲與多維度篩選**：支援直飛篩選、預算與物價指標過濾、關鍵字即時搜尋。
3. **國家與城市深度分析**：
   - ✈️ **直飛航班情報**：清楚呈現直飛/轉機、航空公司、預估航程。
   - 💰 **當地日常物價指數**：提供日均預算、餐飲、交通與住宿估算。
   - 🏙️ **城市熱門景點清單**：按城市細分並列出精選推薦景點排行榜。
   - 🗃️ **多來源旅遊資料**：整合可選的 OpenTripMap、Wikivoyage、Wikidata、中文 Wikipedia、Wikimedia Commons、OpenStreetMap/Nominatim 與 Open-Meteo；以多級 fallback 提供景點摘要、結構化描述、圖片、地址座標與即時天氣。
   - 🌐 **全球城市目錄**：整合 104 座去重城市，可依名稱或資料完整度瀏覽。資料不足時會明確標示，城市介紹可連結至百科來源補充。
   - 🔎 **免資料庫城市搜尋**：城市基本座標與摘要隨前端載入，點入後再以即時服務補充資料，適合原型部署與快速探索。
4. **友善容錯機制**：清晰麵包屑導航與隨時「返回／重新選擇」機制。
5. **智慧旅遊規劃工具**：
   - 🧭 個人化目的地推薦問答。
   - ⚖️ 最多四座城市比較。
   - 💰 可調整住宿、交通、餐飲與活動預算圖表。
   - 🗓️ 3／5／7 天快速行程產生器。
   - ✍️ 完整行程產生器會依每日早午晚時段安排景點、餐食、移動與備註，依城市交通特性提供地鐵／公車建議與 Google Maps 大眾運輸路線，也可指定景點加入某一天並複製或列印。
   - 🏷️ 資料來源、更新狀態與規劃參考提醒。
6. **分層式探索介面**：
   - 🌐 將全球城市目錄收進左側抽屜，透過名稱、資料完整度與搜尋瀏覽。
   - ⚖️ 將城市比較獨立為側邊抽屜，避免首頁資訊過度擁擠。
   - 📱 桌面版由左側滑入、手機版自動全寬，支援遮罩、Esc、鍵盤焦點與減少動畫偏好。
   - 🔍 側欄提供 80%／85%／90%／95%／100%／105%／110% 顯示比例調整，並會記住上次設定。
   - 🔗 導覽路徑會同步到網址 hash，可直接分享城市頁，並支援瀏覽器上一頁／下一頁返回探索。

---

## 2D／3D 整合地圖

互動地圖使用 MapLibre GL JS 單一 WebGL 畫布，以 globe 與 Mercator 投影切換 3D 地球和平面地圖；2D／3D 使用雙按鈕投影選擇器，城市、景點、航線和底圖風格在兩種投影中共用。城市資料版本為 `2026.11.20`，包含 14 個國家／地區的 49 筆在地城市與 104 筆全球目錄資料。這 153 筆目錄列已與 GeoNames 每日地名資料交叉核對：151 筆對應聚落，峇里島與聖托里尼則改標為島嶼目的地；地圖座標使用來源地名參考點，來源 ID 與連結記錄在 [`cityGeonames.js`](./src/data/cityGeonames.js)。兩份目錄重疊的城市在世界地圖只顯示一個標記，舊城市識別碼會映射到合併後的資料。景點僅在有名稱資料時列出，地圖只在有座標或外部地理服務找到位置後顯示景點標記；缺少機場資料時不會生成假機場或近似座標。城市介紹、景點與機場資料可能不完整，畫面會標示缺漏，不以通用文字或虛構排名補足。景點定位服務更新座標時會同步更新地圖標記；無直飛城市以橘色分段航線顯示桃園至轉機樞紐再到目的地。底圖提供 OpenFreeMap 向量地圖與 Esri World Imagery 衛星影像；圖資需要網路，瀏覽器需支援 WebGL。

Firebase 使用 compat SDK 初始化 Authentication 與 Analytics；Google 登入使用 Popup 彈出 Google 帳戶驗證視窗；若 Firebase SDK 或網域設定錯誤，帳戶選單會顯示錯誤提示。Analytics 不可用時會安全降級，不會阻止登入或地圖功能。

## 專案規格文件

- 詳細資訊架構 (IA)、UI/UX 畫面流程與 V1 ➔ V2 迭代規劃，請參閱：[`DESIGN_SPEC.md`](./DESIGN_SPEC.md)。

## 資料可靠性與目前限制

- 城市、航班與物價部分為專案整理或規劃參考資料，不代表即時航班、即時價格或官方簽證結果。
- 天氣、匯率與景點補充資料依賴外部服務；服務無法使用時，介面會保留內建資料並標示目前狀態。
- 景點圖片、百科摘要、地址與座標可能來自不同公開資料來源，更新時間與完整度可能不同。
- 開啟城市時，地圖會向 OpenStreetMap Overpass 查詢周邊 10 公里內有名稱的景點、博物館與古蹟，來源連結會顯示在地圖彈窗與景點清單；結果僅在目前瀏覽器快取 7 天，尚未同步到 Firestore 城市目錄。
- GeoNames 城市地名資料以 CC BY 4.0 授權；資料來源與地名 ID 保留於城市目錄，地圖頁會顯示來源連結。
- 百科與圖片補充請求透過前端佇列限制併發；公開服務可能限流或暫時無法使用，缺資料時不會用近似座標代替景點位置。
- 使用前端快取資料時，請以畫面上的來源標示及服務提供者最新資訊為準。
- 目前專案為無建置工具的原型，正式發布前仍應補上瀏覽器操作測試、JavaScript 語法檢查與部署驗證。
- 已加入 PWA manifest 與 Service Worker；需透過 HTTP(S) 部署後才會啟用安裝與離線殼層，直接以 `file://` 開啟時會維持一般預覽模式。
- 頁面會即時提示目前是否離線；離線時仍可使用已保存的比較清單、預算與行程，重新連線後可再次取得外部資料。
- 首頁會保留最近瀏覽的城市；城市與景點詳情頁也可加入收藏，資料會保存於目前裝置的瀏覽器中。

## Firebase Analytics 與帳戶登入

Firebase 初始化與 Web SDK 設定位於 [`src/js/firebase.js`](./src/js/firebase.js)，並以一般延遲載入的瀏覽器腳本載入 Firebase Compat SDK，避免 ES module 在本機檔案預覽時遭瀏覽器 CORS 阻擋。頁面開啟、主要導覽及登入相關事件會以 Firebase Analytics 記錄；帳戶登入使用 Firebase Authentication，登入狀態預設保存在瀏覽器本機。Firebase Web SDK 的 API key 與專案識別資料是前端公開設定，請勿在前端放置服務帳戶金鑰或私密憑證。

### 登入功能

頁面右上角的帳戶選單只提供 Google 登入。按下「使用 Google 帳戶登入」會直接開啟 Google 帳戶驗證視窗，不需要在網站輸入電子郵件或密碼。

### Firebase Console 必要設定

1. 確認 Web App 的 Firebase 設定與 `src/js/firebase.js` 中 `firebaseConfig` 相符。
2. 在 **Authentication → Sign-in method** 啟用 **Google**。如登入回報 `auth/operation-not-allowed`，請在此頁確認 Google 提供者已啟用。
3. 在 **Authentication → Settings → Authorized domains** 加入 `trilobitexz.github.io`（GitHub Pages 的自訂專案網址只需加入主機名稱，不要加 `https://` 或 `/DT-Action-App/`）。本機測試使用 `localhost`。
4. 確認 Google 登入提供者的支援電子郵件與 OAuth 設定已完成。
5. 你提供的應用程式資訊顯示「連結的 Firebase 託管網站：dt-action-app」，請在 Firebase Console → Hosting 查看該網站狀態與實際網址。只有已建立並完成部署的 Hosting 網站才可開啟；預設網址通常為 `https://dt-action-app.web.app` 或 `https://dt-action-app.firebaseapp.com`，請以 Hosting 頁面顯示為準。若尚未建立 Hosting 網站，請先在 Console 的 Hosting 流程建立並部署。

## 登入與 Firestore 雲端同步

Firebase Authentication 前端登入使用 Google（不含 LINE，也不顯示電子郵件／密碼登入表單）。Firestore Standard 預設資料庫建立於 `asia-east1`。登入後，城市收藏、比較清單、最近瀏覽、預算與行程會同步至 `users/{uid}/appData/{dataId}`；每位使用者只能讀寫自己的資料，未登入與跨帳戶存取會被 Firestore 規則拒絕。資料仍會保留在本機，網路／規則問題時會在帳戶選單顯示同步狀態。

Firestore 安全規則位於 [`firestore.rules`](./firestore.rules)，僅允許指定應用資料文件與受限 JSON 字串大小。規則已部署至 Firebase；正式公開使用前仍建議進行安全規則與資料同步測試。Hosting 使用專案根目錄作為靜態網站來源，但會排除課程文件、規格、設定與規則檔案，避免發布非網站內容。


## AI 旅程規劃

城市規劃工具新增 AI 行程規劃，可依旅行天數、交通方式與旅客偏好，從本站已知景點中安排每日順序；結果可拖曳調整，沿用既有行程保存與登入後的 Firestore 同步。模型使用 Firebase AI Logic（Gemini Developer API）與 Gemini 3.8 Flash，輸出以結構化 JSON 驗證，避免模型捏造本站以外的景點索引。

首次使用前，請在 Firebase Console 的 App Check → Apps 為 Web App 設定 reCAPTCHA Enterprise，並將網站金鑰填入 src/js/firebase-ai-config.js 的 appCheckSiteKey。金鑰是公開的網站識別碼，可放在前端；不要放入 reCAPTCHA secret key 或 App Check debug token。確認 App Check → APIs → Firebase AI Logic 已啟用 enforcement，並確認 GitHub Pages 網域已列入 reCAPTCHA Enterprise key 的允許網域。
