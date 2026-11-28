# v100 實際驗收紀錄

日期：2026-11-26  
測試版本：v100  
本紀錄涵蓋本機瀏覽器驗收與 Firestore 只讀資料驗證。

## 瀏覽器驗收

測試網址：本機 HTTP 預覽（與正式站相同的靜態檔案）  
測試檢視尺寸：1440 × 900、375 × 812、320 × 740 CSS px

| 流程 | 結果 | 實際觀察 |
| --- | --- | --- |
| 首頁與 MapLibre | 通過 | 地圖畫布初始化，城市視角可載入標記。 |
| 全域搜尋 | 通過 | 搜尋「東京」並選取建議後進入 `#view=country&city=tokyo`。 |
| 地圖控制 | 通過 | 探索／簡約／衛星底圖與 2D／3D 投影均可切換。 |
| 城市分類篩選 | 通過 | 卡薩布蘭卡選「宗教建築」後顯示 2 / 3 個景點，地圖僅保留該分類標記。 |
| 標記資訊窗 | 通過 | 景點標記可開啟詳情；鍵盤 Enter 可再次切換關閉。 |
| 冷門城市與載入降級 | 通過 | 卡薩布蘭卡在服務無法連線時仍顯示 3 個資料完整的景點及離線行前資訊，沒有殘留載入中狀態。 |
| 景點與行程資料一致 | 通過 | 城市本身不再被當成景點；行程下拉選單與 3 張景點卡一致。 |
| 手機導覽與抽屜 | 通過 | 375px 下城市目錄、行程、世界之最抽屜可開啟；抽屜打開時左下選單浮鈕隱藏。 |
| 手機版面 | 通過 | 320px 與 375px 檢視未出現文件水平溢出；窄螢幕分類篩選改為單欄排列。 |
| 世界之最 | 通過 | 名錄顯示 55 個地點；「三大博物館」篩選正確顯示 3 筆。 |
| GitHub Pages 線上版 | 通過 | 確認載入 `?v=100`；東京搜尋、1 / 5 地圖分類計數與 375px 城市目錄抽屜均正常，瀏覽器未記錄 JS 錯誤。 |

## Firestore 公開目錄驗證

執行唯讀命令 `node scripts/verify-city-catalog.mjs`，使用 ADC 回讀 `dt-action-app`：

- 200 / 200 座城市符合至少 3 筆有效景點的條件。
- 共 944 筆有效景點文件，0 筆無效文件。
- 失敗城市：0。

## 已知測試限制

- 本次瀏覽器環境無法連線至 REST Countries 與 OpenStreetMap，控制台有對應的 `Failed to fetch` 警告；畫面已使用本地資料並正常降級。天氣與歷史氣候資料在可用時有載入。
- 未登入帳戶，因此沒有送出 Google 登入、Firestore 個人資料寫入或付費 AI 生成請求；這些流程仍需登入後驗收。
- 尚未登入帳戶，因此 Google 登入、個人 Firestore 寫入與 AI 行程生成未在本次實測；這些流程需使用已授權帳戶另行驗收。
- GitHub Pages 已確認提供 v100 資產；Service Worker 的離線重新開啟流程仍需在實際安裝 PWA 的裝置上抽測。


## v101 城市資料可用性呈現

- 檢查 `PlannerView.getCityDataCoverage`：原有 10 項資料欄位覆蓋算法維持不變，新增獨立的圖片、介紹、來源評分及營業時間計數。
- 檢查城市詳情渲染順序：統計在景點資料整理後由 `renderCityTools` 產生，會跟目前城市的景點目錄同步更新。
- `node --check`（`plannerView.js`、`countryView.js`）及 `git diff --check` 通過。
- 尚未登入個人帳戶；此變更為前端呈現與統計，不涉及 Firestore 寫入或外部 API。

## v102 景點內容品質守門

- 新增離線目錄稽核器，檢視 6 份 JSON、596 筆景點：缺座標 0、缺來源 0、無圖片 44、短介紹 4。
- 從本地精選目錄移除空難、恐攻、軍事行動與火山爆發事件頁；前端另加共同排除條件，涵蓋 Firestore 與即時來源，避免事件百科誤當可造訪景點。
- 開羅塔摘要改用開羅市政府旅遊頁核對高度、位置、觀景台與餐廳資訊；未補寫非官方票價或營業時間。
- `node scripts/audit-city-spots.mjs`、JavaScript 語法檢查、資料 JSON 解析與 `git diff --check` 通過。
- Firebase 官方支援模型清單確認 `gemini-3.8-flash` 仍為可用穩定模型；未登入 Google 帳戶，因此沒有觸發真實 AI 付費請求或 OAuth 登入流程。

## v103 AI 規劃與離線資料載入

- AI 候選改為品質排序後最多 24 筆；每日輸出 1–3 個有效、不可重複的候選索引，允許其他候選保留未安排狀態。
- 同條件規劃結果可在本機快取 7 天；快取鍵包含城市、天數、交通方式、偏好與景點來源資料摘要，並驗證快取索引範圍後才使用。
- 城市目錄加入 IndexedDB 快取、40 城容量上限、14 天新鮮期限與 180 天離線保留；不支援 IndexedDB 或失敗時回退 localStorage。
- 已把精選景點 JSON 查詢版號改為讀取正在執行的模組 URL 版本，與 Service Worker 預快取同步。
- 本機未登入 Google 帳戶，AI 網路生成與 OAuth 仍需使用者帳戶做端到端驗收；程式語法及差異檢查已通過。

## v104 行程道路估算

- 開車模式下，僅在使用者展開某一日行程時查詢該日多站 OSRM 道路路線，並於每日行程卡顯示距離與約略駕車時間；明確註明非即時路況。
- 景點座標不完整、OSRM 超時或服務無路線時，顯示可理解的降級提示，地圖仍保留原行程示意線。
- 地圖折線與行程摘要共用同座標請求及 24 小時記憶體快取，避免重複呼叫；步行及大眾運輸不顯示駕車估算。
- 語法、差異格式與版號一致性檢查通過。此項未呼叫需要登入的 Firebase／AI 功能；OSRM 線上服務結果會依當下網路及服務可用性而異。

## v105 城市地圖景點密度提示

- 城市地圖依目前縮放、畫面範圍與精選優先順序控制景點標記密度；街區層級（zoom 12）才顯示全部重疊標記，畫面外標記暫時隱藏，移動地圖後會重新計算。
- 地圖景點計數改為反映當下實際顯示的標記，並提示使用者移動或放大即可查看更多；分類篩選同步顯示該分類的可見數量與總數。
- JavaScript 語法、`git diff --check` 與 v105 資源版號一致性檢查通過。本次以靜態檢查驗證，未執行互動式瀏覽器地圖驗收。

## v106 跨換日線航線繪製

- 直飛／轉機弧線改以最短經度方向插值，跨越國際換日線時拆成兩段，避免地圖上出現橫跨整個世界的錯誤連線。
- 直飛時間標籤只掛在弧線第一段，避免分段後重複顯示。
- JavaScript 語法、差異格式與資源版號一致性檢查通過；尚未做即時航線瀏覽器視覺驗收。

## v107 每日路線動畫與順路排序

- 行程日切換後先聚焦當日有效座標；路線以約 820ms 緩動逐段繪製，序號地圖標記依序彈出。切換日期、清除路線或離開城市時會取消舊動畫；OSRM 駕車路線抵達後以道路幾何更新示意線。
- 座標檢查保留合法的單一 0 經緯度，將 `[0, 0]` 當作缺值哨兵；0 站清除路線，1 站只置中並顯示標記。
- 每日行程新增「檢視當日路線」與「一鍵順路排序」。排序固定第一站，採最近鄰加 2-opt；無座標項目保留相對順序並置於末尾。成功時顯示直線距離估算與 9 秒復原入口，儲存時保留 AI 每日主題及備註。
- 支援 `prefers-reduced-motion`，並為行動版操作列與 Toast 加入安全區間距。
- 驗證：`node --check src/js/map/mapManager.js`、`node --check src/js/modules/plannerView.js` 與 `git diff --check` 通過；尚未做登入／瀏覽器互動式端到端驗收。

## v108 每日路線地圖點擊連動修正

- 線上驗收 v107 時確認東京地圖、每日切換及路線序號標記可呈現；點擊序號曾被 MapLibre 底圖點擊處理攔截，導致彈出一般景點資訊而未穩定聚焦行程卡。
- 序號標記的 pointer／mouse／touch／click 事件不再傳至底圖；MapLibre 點擊處理增加標記目標守門。點擊時會展開行程規劃抽屜及對應 Day，再捲動、高亮並聚焦景點卡。
- 驗證：v108 正式頁載入後仍可重現問題。原因是座標重疊的景點圖釘 z-index 高於行程序號，實際點擊被景點圖釘接收；v109 將行程序號標記提升至互動上層。待 v109 發布後重測標記點擊、行程抽屜與地圖同步。

## v109 行程標記點擊層級修正

- 正式版驗收確認 v108 仍有點擊衝突：行程序號和同座標景點圖釘重疊時，景點圖釘位於上層（z-index 8），攔截行程標記點擊並開啟一般景點彈窗。
- 將行程標記設為較高堆疊層級並明確啟用 pointer events，確保點擊能觸發每日行程卡片定位。
- 驗證：GitHub Pages 部署工作流程 #70 成功；正式頁載入 `mapManager.js?v=109`、`app.js?v=109` 與 `style.css?v=109`。東京 Day 1 序號標記點擊後行程抽屜開啟、對應卡片取得焦點並高亮，未出現一般景點彈窗；切換 Day 2 後地圖顯示「新國立劇場」的 Day 2 標記，只有 Day 2 展開。瀏覽器 Console 沒有 JavaScript error。
- 測試限制：目前保存的東京行程每天最多一個景點，故無法在不新增／改動使用者行程資料的情況下實測多站折線動畫及三站以上的順路排序按鈕。

## v113 城市景點資料品質與快取一致性

- 城市景點資料服務統一正規化繁體文字、座標、來源網址與簡介；排除城市本身、行政區、非旅遊百科條目及無來源／無座標資料。保留赤道或本初子午線上的合法單軸 0 座標，只排除 `[0, 0]`。
- 景點快取改用版本化鍵與資料版號；舊 IndexedDB/localStorage 記錄不再混入新目錄。離線靜態目錄清理後為 200 城、884 筆，所有城市至少 3 筆，缺座標／來源、超過 50 公里、非景點與重複名稱均為 0。另有 81 筆缺圖片與 24 筆短簡介，使用既有圖片降級卡片呈現；沒有補造資料。
- 本機瀏覽器驗收：上海不再顯示「靜安區」；馬尼拉不再顯示「艾米塔區」，保留 3 個景點；卡薩布蘭卡與阿雷基帕各顯示 3 個有座標景點，均未停在載入中。阿雷基帕景點卡仍觀察到「秘鲁／总教区／创建」等簡體字，轉換表修正尚未在當時瀏覽器腳本中生效，列入 v114 修正。
- Firestore 唯讀稽核（修正前）：882 筆有效、62 筆無效景點文件，50 座城市受影響。匯入器已加入無效／重複文件清理，並在同名匹配時保留有效舊資料的圖片、評分、網站、營業資訊與較完整簡介；每批最多 400 筆。
- `node scripts/audit-city-spots.mjs`、`node scripts/seed-city-catalog.mjs --validate-only` 及修改檔案的 Node 語法檢查通過。實際 Firestore 匯入未執行：本機 ADC token 不可用，匯入器在首筆讀取前停止，沒有任何雲端寫入。待授權完成後需再執行匯入及 Firestore 唯讀驗證。

## v114 阿雷基帕繁體文字與城市目錄修復

- 景點卡片在最後輸出前再次正規化名稱、分類、標籤與簡介；新增「秘鲁／总教区／创建」詞組對應，避免雲端舊資料或瀏覽器舊快取把簡體字帶進繁體介面。
- `index.html`、`sw.js` 的全站資源參數與 Service Worker 快取升至 v114；README 版號同步更新。
- 本機瀏覽器 v114 驗收阿雷基帕：3 張景點卡均顯示繁體簡介，地圖載入 3 筆景點資料並顯示標記；天氣與歷史氣候資料可載入，無卡片載入中狀態。
- 離線資料稽核：200 城、884 筆；每城至少 3 筆，缺座標／來源、超距、非景點與重複名稱均為 0；缺圖片 81 筆、短簡介 24 筆，以降級樣式呈現，未補造資料。匯入前驗證通過。
- Firestore 唯讀回讀：882 筆有效、62 筆無效文件，影響 50 城。匯入重試時因本機 ADC 憑證檔不存在，在任何批次提交前失敗，確認無雲端寫入；正等待使用者於 Google 授權頁完成 ADC 授權，再匯入及回讀驗證。
- `node --check`（`spotTextService.js`、`countryView.js`）、`git diff --check` 及 v114 資源版號檢查通過。

## 2026-11-27 工作目錄品質複核

- 靜態景點稽核重跑：6 個洲別檔案、200 座城市、884 筆景點全部符合名稱、來源網址、座標範圍、距城市中心 50 公里及景點類型條件；每城至少 3 筆，重複名稱 0。
- 資料完整度：81 筆缺圖片、24 筆簡介少於 40 字。前端以分類圖像降級卡片處理缺圖；簡介偏短仍可作為已知資料品質缺口，後續應補充可追溯來源，不以生成文字或推測營業資訊填補。
- `node scripts/seed-city-catalog.mjs --validate-only` 通過（200 城、884 筆），未連線或寫入 Firestore。雲端目錄回讀／匯入仍待本機 ADC 授權完成。
- 所有本次已修改 JavaScript 檔案 `node --check` 通過；`git diff --check` 通過。這是靜態檢查，尚未取代桌面／手機瀏覽器人工驗收。

## v115 現場複核：全球城市標題與繁體字

- 正式頁面上海城市流程可載入地圖、3 個景點標記、景點卡、天氣與歷史氣候資料，初始檢查未見 JavaScript error。國家基本資訊 API 在本次瀏覽器環境回報 `Failed to fetch`，頁面保留了使用者可理解的離線參考狀態。
- 發現全球城市使用合成國家資料時，英文國名欄位錯放了中文國名，標題顯示為「中國 (中國)」。標題現改為只在中英文名稱不同時顯示括號英文名稱。
- 上海景點介紹仍有「北侧／装潢／更换」簡體字，補上對應繁體字轉換。全站資源及 Service Worker 快取版號升至 v115。
- 驗證：本機靜態頁載入上海後，標題顯示「中國」且簡介中的「北側／裝潢／更換」均為繁體，瀏覽器沒有 JavaScript error。`node --check`、景點稽核（200 城／884 筆）、匯入前驗證、v115 資源版號一致性與 `git diff --check` 全數通過；另比對 33 個 HTML 本機資源參照均存在且已列入 Service Worker 預快取。本次未登入帳戶或修改收藏、行程。
- 桌面瀏覽器流程（776 CSS px）：全球搜尋能列出東京建議；城市目錄與比較抽屜能開關，Escape 後焦點回到觸發按鈕；2D／3D 控制可往返切換；全程無 JavaScript error。手機寬度尚未覆蓋。
- 文件一致性檢查發現 `DESIGN_SPEC.md` 誤寫 Email/Password 註冊登入，與前端 Google-only 登入及 Firebase 設定不符；規格已修正為目前支援範圍。此為文件專屬變更，不需改網站快取版號。
- 以 `origin` repository 名稱與正式頁面 URL 交叉核對，先發現 `/journey-atla/` 過時路徑。推送時 GitHub 回報 repository 已搬遷至 `Journey-Atlas`，正式頁於新路徑載入 v116 後，再將 `README.md`、`FIREBASE_OPERATIONS.md` 修正為 `/Journey-Atlas/`。

## v116 地圖署名連結安全與文件一致性

- DOM 複核發現 MapLibre 動態建立的 3 個署名連結使用 `target="_blank"`，但沒有 `rel="noopener noreferrer"`。地圖容器上的 MutationObserver 現在會為新增及更新的署名連結補上安全屬性。
- 修正文檔中過時的登入方式與 GitHub Pages 路徑：專案目前只提供 Google Popup；正式頁面路徑為 `/Journey-Atlas/`。
- 本機瀏覽器載入 v116 後，探索底圖 3 個外連均有安全 rel；切換到衛星底圖（顯示 Esri 歸屬）再切回探索底圖後仍正確。2D／3D、搜尋與抽屜流程正常，未見 JavaScript error。
- DOM 結構掃描：重複 ID、失效 `aria-controls`、空名稱按鈕、缺少 alt 的圖片均為 0；世界之最詳情的動態標題關聯在打開後有效。掃描在 1280 CSS px 執行；手機寬度、Firebase 登入與跨帳戶驗收尚未完成。
- `node --check`（`mapManager.js`、`sw.js`）、景點資料與匯入前驗證、HTML／Service Worker／快取名稱版號一致性與 `git diff --check` 通過。
- GitHub Pages workflow #76 執行成功；正式頁 `https://trilobitexz.github.io/Journey-Atlas/` 載入 v116 資源、SVG 圖示及含安全 rel 的地圖署名連結，瀏覽器沒有 JavaScript error。

## v117 AI 輸入隔離與手機寬度複核

- AI 將旅客偏好及城市／景點文字包在 JSON 資料區，並明確指示模型不執行資料欄位中的命令；仍只接受候選索引，並保留既有結構化輸出驗證。非物件候選會略過，天數轉為 1–7 的整數，摘要可讀取 `description`、`summary` 或 `note`，座標只在值存在且有效時傳送。
- AI 快取指紋加入景點來源標籤與網址，來源資訊更新後不再沿用舊生成結果。`README.md`、`QA_CHECKLIST.md` 同步說明 AI 輸入隔離與待登入實測項目；所有本機資源與 Service Worker 快取版號升至 v117。
- 本機 Chrome（headless，載入工作目錄靜態頁）在 320、375、430 CSS px 下文件／頁面寬度與視窗一致，無水平溢位；`PlannerView` 與城市資料物件已初始化，未出現未捕捉 JavaScript 錯誤。
- `node --check`（`firebase.js`、`plannerView.js`、`sw.js`）、資源版號一致性與 `git diff --check` 通過。
- 推送後 GitHub Pages workflow #78 成功（提交 `d13f28e`）；正式頁回應 HTTP 200，頁面標題正確且本機資源查詢版號為 v117。
- 尚未以已登入帳戶呼叫 Firebase AI Logic，因此未驗證真實模型回應或偏好注入攻擊的行為；手機觸控、橫向旋轉與 PWA 離線仍需實機流程驗收。

## v118 AI 出發日期整合

- AI 請求現在接收有效的出發日期，依 Day 1 起算標記每日日期，並可把星期作柔性安排參考；不推測國定假日或營業狀態。日期納入規劃快取鍵並保存在行程中，重開規劃工具、手動調整、複製與列印時沿用；生成期間鎖定日期、偏好與交通方式，避免請求內容與畫面設定不同步。
- 本機 Chrome 以模擬 AI 回應走完行程工具流程：東京測試行程從 2026-12-30 跨年至 2027-01-01，日期正確送入規劃器、逐日顯示並出現在複製文字；重繪工具後仍回填出發日，手動儲存保留日期，清除日期可移除舊值。不同日期產生不同快取鍵。
- 同一流程在 320、375、430 CSS px 下無水平溢位，未出現未捕捉 JavaScript 錯誤；`node --check`（`firebase.js`、`plannerView.js`、`sw.js`）、資源版號一致性與 `git diff --check` 通過。
- 推送後 GitHub Pages workflow #80 成功（提交 `3d1d208`）；正式頁回應 HTTP 200，頁面標題正確且本機資源查詢版號為 v118。
- 本次使用模擬 AI 驗證前端整合，尚未以登入帳戶呼叫 Firebase AI Logic；模型是否能依日期產生更合適的日程安排仍待真實服務驗收。

## v119 AI 錯誤訊息安全處理

- 未知 Firebase AI provider 錯誤不再把原始 `error.message` 顯示於行程狀態；改用通用提示並保留既有行程。前端只記錄錯誤代碼；已知的景點不足、格式、天數與索引問題使用內部錯誤代碼對應可理解提示。
- 本機 Chrome 模擬 provider 回傳含假 token 的內部錯誤：畫面顯示通用提示、舊行程與出發日保留，錯誤字串未出現在 Console；再模擬 `ai/invalid-response`，正確顯示格式提示。日期、偏好、交通設定在失敗後恢復可用，無未捕捉 JavaScript 錯誤。
- `node --check`（`firebase.js`、`plannerView.js`）、`git diff --check` 通過。此次沒有登入帳戶或呼叫 Firebase AI Logic；尚待真實服務錯誤分流驗收。

## v120 AI 景點來源追溯與橫向行程驗收

- AI 規劃候選只保留有效 HTTP(S) 來源網址；雲端目錄同名但缺來源時不會覆蓋本機有來源資料。完全沒有可追溯候選時停止呼叫模型並顯示原因。
- 每個行程景點顯示可安全開啟的來源連結；無來源的手動項目在選單、行程卡及複製／列印文字中標示待核驗。輸出文字包含來源標籤與網址。
- 本機 Chrome 模擬 AI 驗收 667×375、740×360、844×390 CSS px：來源候選 10 筆均帶 HTTP(S) 網址，不安全 scheme 與無來源景點均未送進模型；每站來源連結可用、標籤 HTML 逸出、複製文字含來源網址，沒有來源的手動項目顯示核驗提示。各尺寸底部排序按鈕可觸控且排序生效，抽屜可捲到底，文件無水平溢位，沒有未捕捉 JavaScript 錯誤。
- 無來源城市 mock 流程顯示明確的來源不足訊息，模型呼叫 0 次；雲端同名無來源記錄的降級測試保留有來源離線景點並同時採納有效雲端景點。
- 靜態目錄重稽核：200 城、884 筆，缺來源／座標、超距、非景點與重複名稱均為 0；缺圖片 81 筆、短介紹 24 筆，維持既有降級呈現並保留後續可追溯補資料需求。匯入前驗證通過，未連線或寫入 Firestore。
- `node --check`（`plannerView.js`、`sw.js`）、HTML／Service Worker v120 資源一致性與 `git diff --check` 通過。測試使用本機假資料及模擬 AI，未登入 Firebase；正式 AI 服務與真機旋轉／離線流程仍待後續驗收。

## v123 AI 景點資料完整度與分類回歸

- 重建六大洲 200 城離線景點資料，依可稽核預建來源目錄移除教育機構、行政區、事件及未完成計畫等非行程景點，並補充七座城市的來源景點資料。AI 候選保留有效來源、座標、分類及完整介紹的門檻。
- 修正清萊藍廟縮圖網址的 UTF-8 百分比編碼；缺少可核實圖片的 54 筆資料沿用分類替代圖，沒有以未驗證照片填補。
- `node scripts/audit-city-spots.mjs`：839 筆合格候選、200/200 城每城至少 3 筆；缺來源、缺座標、缺介紹、短介紹、超距、非景點及重複名稱均為 0。
- `node scripts/smoke-ai-planning.mjs`：通過 200 城完整來源候選檢查、歷史地點與非景點分類回歸、仰光雲端中心修正及無效座標排除。
- `node --check`（spotTextService.js、smoke-ai-planning.mjs、sw.js）、資源版號一致性、資料 URL 格式檢查及 `git diff --check` 通過；未以登入帳戶呼叫真實 Firebase AI Logic。

## v124 長天數 AI 行程候選補充

- 發現離線目錄每城只有 3–5 筆合格 AI 景點，但行程介面提供 3、5、7 天；95 城離線資料少於預設 5 天，200 城均無法單靠離線候選完成 7 天規劃。
- AI 候選不足所選天數時，現在會要求 CityCatalogService 強制更新城市景點資料，再重新套用來源、座標、分類、40 字介紹及真實景點條件。更新仍不足時保留原行程並顯示資料不足，不以搜尋建議或無來源資料代替景點。
- `node scripts/smoke-ai-planning.mjs` 模擬只載入 3 筆、需 7 筆的流程，確認觸發強制更新；只納入 4 筆有來源完整資料，排除無效 scheme，最終得到 7 筆合格候選。另以 40 筆已快取一般景點確認強制刷新仍呼叫即時來源；即時資料為 mock，未登入 Firebase 或呼叫外部地圖服務。
- `node --check`（plannerView.js、cityCatalogService.js、smoke-ai-planning.mjs）、AI 資料稽核（200 城、839 筆候選、來源／介紹／座標缺漏 0）、資源版號一致性及 `git diff --check` 通過。
- GitHub Pages workflow #46015498910 對應提交 `77eaeb1` 並成功；正式頁回應 HTTP 200，HTML 載入 v124 資源。

## v125 Wikimedia 圖片授權與歸屬

- 批次查詢 35 篇繁中與 12 篇英文 Wikipedia 缺圖頁面，4 頁有可用的 Wikimedia Commons 主圖；其餘頁面未取得符合條件的 Commons 縮圖，未以搜尋建議或無關照片填補。
- 補入聖地牙哥堡、黎剎公園、普吉大佛、拉斯維加斯大道的 Commons 圖片，並記錄檔案頁、作者與 CC BY／CC BY-SA 授權。4 個縮圖網址與 4 個檔案頁皆以 HTTP HEAD 驗證回應 200。
- 景點卡圖片來源連結顯示作者及授權；雲端與離線同名資料合併時，保留帶歸屬資訊的離線圖片來源。
- 將 5 個既有 Commons 圖片來源特殊檔案頁由 HTTP 升為 HTTPS；839 筆資料的景點來源、圖片及圖片來源 URL 全量檢查皆為 HTTPS，格式問題 0。五個舊檔案頁皆在限流冷卻後 HEAD 驗證回應 200。
- `seed-city-catalog.mjs` 與 `cityCatalogService.js` 保留圖片歸屬欄位，以便未來受控匯入／雲端讀取。此輪沒有寫入 Firestore。
- `node --check`（countryView.js、cityCatalogService.js、seed-city-catalog.mjs、smoke-ai-planning.mjs）、`node scripts/build-city-spot-data.mjs`、`node scripts/smoke-ai-planning.mjs`、`node scripts/audit-city-spots.mjs` 及 `git diff --check` 通過。稽核缺圖數 50；缺來源、座標及介紹仍為 0。
- GitHub Pages workflow #46018062853 對應提交 `e4808fc` 並成功；正式頁回應 HTTP 200，HTML 載入 v125 資源。推送後 `main` 與 `origin/main` 一致，工作樹乾淨。

## v126 AI 候選完整性共用守門

- 將名稱、分類、HTTP(S) 來源、有效座標、40 字介紹、搜尋建議與真實景點判定集中於 `SpotTextService.isCompleteAIPlanningSpot`；規劃頁排序與 Firebase AI 服務入口共用同一資格檢查。
- Firebase AI 服務不再靜默過濾輸入陣列；任何候選不完整就於模型呼叫前拒絕，避免索引重排造成來源／景點錯配。候選數少於行程天數也會在呼叫模型前拒絕。
- `node scripts/smoke-ai-planning.mjs` 通過完整候選與缺來源、無效座標、短介紹、搜尋建議、一般車站拒絕案例；完整資料集 200 城每城至少 3 筆。
- `node scripts/audit-city-spots.mjs` 通過：839 筆 AI 候選，缺來源、座標、介紹、短介紹、超距、非景點、重複名稱及城市中心錯置均為 0；缺可核實圖片 50 筆，使用分類替代圖。
- `node --check`（spotTextService.js、plannerView.js、firebase.js、smoke-ai-planning.mjs）及 `git diff --check` 通過。未以登入帳戶呼叫真實 Firebase AI Logic。
- GitHub Pages workflow #46030966449 對應提交 `baf0b4d` 並成功；正式頁回應 HTTP 200，HTML 載入 v126 資源。AI 真實登入流程仍待以使用者帳戶實測。

## v127 已保存行程景點對應

- 發現 AI／手動行程保存清單索引，城市目錄更新或排序變更後可能顯示不同景點；舊 AI 行程也沒有可用資訊判斷歷史索引是否仍正確。
- 新行程保存每個已選景點的穩定名稱鍵，載入時依目前清單重新對應索引。舊 AI 計畫缺少穩定鍵時不使用不確定的索引；景點已從目錄消失時清除該項並顯示更新提示。
- 複製與列印遇到過期或無法對應的景點時會回報需重新產生，不會匯出其他清單項目冒充原行程。
- `node scripts/smoke-ai-planning.mjs` 覆蓋清單重排重新對應、缺少穩定鍵的舊 AI 行程，以及景點已移除的失效鍵案例；語法檢查與 `git diff --check` 通過。
- GitHub Pages workflow #46032000211 對應提交 `de14348` 並成功；正式頁回應 HTTP 200，HTML 載入 v127 資源。工作樹與 `origin/main` 同步。

## v128 舊版手動行程索引保護

- 舊版手動行程和舊 AI 行程一樣只保存數字索引；若城市景點清單已排序或內容更新，索引可能顯示另一筆景點。
- 缺少 `SpotKeys` 的舊手動行程現在不使用不確定的索引，顯示重新安排行程提示；已保存身份鍵但景點已移除時，提示重新載入或建立新行程。
- `node scripts/smoke-ai-planning.mjs` 驗證舊手動行程在畫面狀態與複製／列印文字中都有安全提示，新行程索引仍只接受有效整數。
- `node --check`（plannerView.js、smoke-ai-planning.mjs）、`node scripts/audit-city-spots.mjs`、資源版號一致性及 `git diff --check` 通過。
- GitHub Pages workflow #46032762396 對應提交 `13311dd` 並成功；正式頁回應 HTTP 200，HTML 載入 v128 資源。

## v129 Firestore 預算文件資源限制

- 規則審查發現任一登入使用者可在自己的 `appData` 集合建立任意數量的 `budget-{任意字串}` 文件，造成專案儲存與寫入成本風險。
- `budget-*` 文件 ID 現在限定為 `scripts/data/prebuilt-spots.json` 中 200 個城市；預算資料最大 20 KB，其他個人應用文件維持 700 KB 上限。create/update 僅接受白名單，owner 可刪除舊規則下建立的自有預算文件以清理歷史資料。
- 新增 `scripts/sync-firestore-budget-rules.mjs` 與 npm sync/check 命令；部署 Firebase 規則前會先確認清單與城市目錄相符。
- `node scripts/sync-firestore-budget-rules.mjs --check`、規則來源靜態檢查、`node --check`（firebase.js、規則同步腳本）、`node scripts/smoke-ai-planning.mjs`、AI 資料稽核及 `git diff --check` 通過。此環境未安裝 npm 或 Firebase CLI，因此未執行 Rules Emulator 編譯；`package.json` JSON 格式檢查通過。
- 本輪僅更新專案規則來源；Firebase Console 的實際已部署規則需另行確認，不在本輪遠端部署。
- v129 程式變更以 `5acc58c` 推送至 `origin/main`；本次部署狀態記錄同步補入 QA 日誌。
- GitHub Pages workflow #96（run `46035171464`）對應 `5acc58c` 並成功；正式頁重新載入成功，頁面標題、世界地圖與 200+ 城市探索介面正常顯示。
- 此環境未安裝 Firebase CLI，也未部署 Firebase Rules；Firebase Console 的實際規則版本仍需確認。

## v130 景點來源品質與圖片授權稽核

- 匯入前驗證首次發現預建資料含 30 筆行政區、教育機構、航空公司或事件等非旅遊景點，雖然離線網站資料已排除這些項目，Firestore 匯入路徑仍會拒絕整份目錄。預建資料清理現在與離線目錄建置共用同一套景點、座標、來源及圖片授權條件，確認每城至少保留 3 筆後才寫回資料檔。
- 清理後保留 200 座城市、839 筆合格景點；AI 可用來源、座標與 40 字介紹缺漏 0，超出 50 公里、非景點、重複名稱及城市中心錯置均為 0。774 張圖片有可核實作者、CC 授權及 Commons 檔案頁；其餘 65 筆使用分類替代圖。
- `node scripts/build-city-spot-data.mjs`、`node scripts/seed-city-catalog.mjs --validate-only`、`node scripts/audit-city-spots.mjs`、`node scripts/enrich-image-attributions.mjs --check` 及 `node scripts/smoke-ai-planning.mjs` 通過；匯入前驗證只讀本機資料，沒有連線或寫入 Firestore。
- 變更 JavaScript／MJS 語法檢查、7 份 JSON 解析、v130 頁面與 Service Worker 快取版號、`git diff --check` 通過。PowerShell/Git 對 LF 檔案顯示 CRLF 轉換提示，檢查未回報空白錯誤。
- GitHub Pages workflow #98（run `46038499248`）對應提交 `00f8e75` 並成功；正式頁回應 HTTP 200，HTML 載入 v130 資源，標題與版本均正確。`origin/main` 已確認指向 `00f8e75`，本機工作樹乾淨。
- Firebase Rules 未部署；此輪只做本機匯入前驗證，沒有連線或寫入 Firestore。

## v131 AI 強制刷新競態修正

- 發現 AI 候選不足時發出的強制刷新會與正在進行的一般目錄載入共用同一個 Promise，導致 AI 等到舊請求結束後就停止，沒有實際再查即時資料源。
- 目錄服務現在記錄進行中的請求是否已是強制刷新；強制刷新遇到一般請求時會先等待，再重試資料載入。已在進行中的強制刷新仍由併發呼叫共用，完成清理也只移除目前請求本身。
- AI smoke 新增受控的並行情境：一般請求停在即時來源時觸發強制刷新，確認完成後第二次查詢確實發出，並把新增的有效景點納入候選。原有 40 筆快取資料仍會觸發即時來源檢查。
- `node scripts/smoke-ai-planning.mjs`、`node --check src/js/services/cityCatalogService.js`、`node --check scripts/smoke-ai-planning.mjs` 及 `git diff --check` 通過。資源與 Service Worker 快取版號升至 v131。
- GitHub Pages workflow #100（run `46039764190`）對應提交 `60c747e` 並成功；正式頁回應 HTTP 200，HTML 載入 v131 資源。遠端 `main` 已核對為 `60c747e`。

## v132 來源網址驗證一致化

- 發現多個資料驗證器只用 `http://`／`https://` 字串前綴判斷來源，會把 `https://` 這類沒有主機名稱的值當成有效來源。AI 呼叫門檻原本另用 URL parser，因此 AI、資料稽核、離線建置與匯入前驗證可能對同一筆來源得出不同結果。
- `SpotTextService.isValidHttpUrl` 現在是共同判定：只接受有 hostname 的 HTTP(S) URL，並拒絕嵌入帳號或密碼的網址。AI 候選、城市目錄過濾、資料補齊／建置／稽核／匯入驗證與雲端目錄檢查皆使用該方法；Node VM 驗證環境明確注入 `URL`。
- smoke 驗證缺 hostname、空 host query、帳密來源及一般錯誤 scheme 均遭拒絕。AI smoke、城市景點稽核（200 城、839 筆、來源缺漏 0）、匯入前驗證、建置腳本、8 個變更 JS／MJS 語法檢查及 `git diff --check` 通過；建置清理 0 筆資料，原有 839 筆未變。
- 網站資源查詢及 Service Worker 快取名稱升至 v132。
- GitHub Pages workflow #102（run `46124546216`）對應提交 `b87b312` 並成功；部署紀錄 SHA 與遠端 `main` 相同。首次回應仍快取 v131，清除代理快取後正式頁回應 HTTP 200、載入 v132，`Last-Modified` 為部署時間。

## v133 AI 景點強制刷新快取穿透

- 發現 AI 候選不足時 CityCatalog 雖傳入強制刷新意圖，但沒有將旗標傳給 SpotService；SpotService 也會直接回傳七天有效的景點快取，造成實際上沒有重新查詢公開來源。
- CityCatalog 現在把 `forceRefresh` 傳給 SpotService。SpotService 的強制刷新略過本機結果快取；遇到一般來源查詢時先等待它完成，再發起新查詢；併發強制刷新仍共用同一個進行中請求。
- AI smoke 新增真實 SpotService 的模擬公開來源案例，驗證一般讀取使用快取、強制讀取略過快取、一般請求進行中時強制讀取會查第二次；亦確認 CityCatalog 傳下強制旗標。
- `node scripts/smoke-ai-planning.mjs`、`node scripts/build-city-spot-data.mjs`、`node scripts/audit-city-spots.mjs`、`node scripts/seed-city-catalog.mjs --validate-only`、`node scripts/enrich-image-attributions.mjs --check`、4 個 JavaScript／MJS 語法檢查、v133 資源版號核對與 `git diff --check` 通過。
- 資料建置清理 0 筆；稽核 200 城、839 筆合格 AI 景點，來源、座標、分類、介紹及圖片署名欄位缺漏均為 0。缺可核實圖片 65 筆，使用分類替代圖。匯入前驗證只讀本機資料，未連線或寫入 Firestore。
