# Firebase 維運與發布流程

本專案的靜態網站部署於 GitHub Pages。Firebase 負責 Google Authentication、Firestore 個人資料同步、公開城市目錄，以及 Firebase AI Logic/App Check。不要將服務帳戶金鑰或 reCAPTCHA secret key 放進網站或 Git。

## 目前架構

- 登入：Firebase Authentication，只使用 Google Popup。使用者資料以 Firebase UID 作為隔離邊界。
- 使用者資料：`users/{uid}/appData/{dataId}`。Firestore 規則限制使用者只能讀寫自己的文件；預算 ID 僅允許現行城市清單的 200 個固定 ID，預算文件上限 20 KB，其他應用資料上限 700 KB。
- 城市目錄：`cities/{cityId}` 與子集合 `spots` 公開讀取、客戶端禁止寫入；由可信任的 Admin SDK 匯入。
- AI 行程：Firebase AI Logic；App Check 使用 reCAPTCHA Enterprise 網站金鑰。網站金鑰屬公開設定，secret key 與 debug token 不可提交。
- 網站發布：GitHub Pages。Firebase CLI 部署命令只部署 Authentication/Firestore 設定，不會發布 Hosting 網站。

## Firebase Console 首次設定／核對

請以具有專案管理權限的 Google 帳戶登入 Firebase Console，選取 `dt-action-app`。

1. **Authentication → Sign-in method**：啟用 Google，設定支援電子郵件。若只提供 Google 登入，保持 Email/Password 關閉。
2. **Authentication → Settings → Authorized domains**：加入 `trilobitexz.github.io`（不含協定、路徑或結尾斜線）；本機測試加入 `localhost`。
3. **Firestore Database**：確認資料庫已建立、記下資料庫位置與版本；本專案預期使用 Standard。若尚未建立，先在 Console 建立，再部署下方規則。
4. **App Check → Apps**：選取網站 Web App，註冊 reCAPTCHA Enterprise provider，填入網站金鑰並核對允許網域含 `trilobitexz.github.io`。先監控有效流量及 token，再依 Firebase Console 的 App Check → APIs 頁面逐項啟用 enforcement；確認登入後的 AI 功能正常再強制執行。
5. **Billing**：Cloud Billing 頁顯示「沒有可顯示的項目」代表目前登入帳戶沒有可列出的帳單帳戶，不能據此確認專案是否已連結帳單或是否有權限。請在專案 Billing Overview 查看狀態；未連結時，使用量超過免費額度的付費 API 可能拒絕請求。Cloud Spend cap 不適用於 reCAPTCHA Enterprise，需在 Cloud Billing 的預算／警示中管理可計費服務；預算警示不是硬性消費上限。

## 在本機部署 Firebase 設定

需要 Node.js/npm 與 Firebase 專案部署權限。先執行 `npm install`，再使用 Firebase CLI 登入：

```sh
npx firebase-tools login
npm run check:firestore-budget-rules
npm run deploy:firebase-config
```

此命令會將 `firebase.json` 的 Google 登入設定與 `firestore.rules`、`firestore.indexes.json` 部署至 `.firebaserc` 指定的 `dt-action-app`。Firestore 預算資料文件只允許目前城市目錄中的 200 個固定 ID；若新增或移除城市，先執行 `npm run sync:firestore-budget-rules` 更新規則，再執行 `npm run check:firestore-budget-rules` 確認清單相符。部署後回到 Console 核對 Google provider、Authorized domains、Firestore Rules 與索引狀態。它不建立 Firestore 資料庫、不設定 App Check、不建立帳單連結，也不部署 GitHub Pages。

若只變更 Firestore 規則，可執行 `npm run deploy:firestore-rules`；此專用命令會先檢查城市 allowlist，只部署 Firestore Rules，不會變更 Authentication 設定或索引。

## 匯入城市目錄

管理者在可信任的本機環境安裝依賴，並以具備 Firestore 寫入權限的 Google Cloud 身分建立 ADC：

```sh
npm install
gcloud auth application-default login
npm run seed:city-catalog
```

匯入預設只使用專案內已整理的景點資料，不呼叫外部百科 API；匯入以 Firestore BulkWriter 批次處理，城市及景點文件保留資料來源、座標來源、圖片來源、營業資訊、精選排序與資料欄位完整度標記。若要在匯入時為資料較少且有座標的城市補查 Wikipedia，可執行 `node scripts/seed-city-catalog.mjs --refresh-wikipedia`；此模式會因外部 API 限流或網路狀況較慢。

匯入前請檢查 `scripts/seed-city-catalog.mjs` 的來源與目標專案，並在 Firebase Console 確認 Firestore 資料庫版本及位置。ADC 憑證只留在使用者環境，不要複製進專案或提交版本控制。執行完成後在 Firestore Console 確認 `cities` 與 `spots` 文件數量及來源欄位。

## 日常發布與回復

1. 本機檢視變更與瀏覽器功能，再提交到 Git。
2. 推送至 GitHub 預設分支，使用現有 GitHub Pages workflow 發布網站。
3. 網站發布後以 `https://trilobitexz.github.io/Journey-Atlas/` 驗證 Google Popup、個人資料同步、城市景點讀取及 AI 行程。若 GitHub repository 名稱變更，請同步更新此網址路徑。
4. 若 Firebase 規則或登入設定有問題，修正來源檔後重新執行 `npm run deploy:firebase-config`；網站程式則透過 GitHub Pages 回復／重新發布。

## 發布前核對表

- [ ] Firebase Console 的專案 ID 為 `dt-action-app`，Web App 設定與 `src/js/firebase.js` 一致。
- [ ] Google provider 已啟用，GitHub Pages 網域已授權。
- [ ] Firestore 資料庫存在，規則已部署且預期使用者路徑為 `users/{uid}/appData/{dataId}`。
- [ ] 城市目錄 seed 已成功完成，公開目錄可讀取。
- [ ] App Check 網站已註冊、網域允許清單正確，enforcement 是在確認有效流量後逐步啟用。
- [ ] Cloud Billing 狀態及費用警示由有權限的帳單管理者確認。
- [ ] GitHub Pages 已發布最新 commit，瀏覽器實際操作成功。
