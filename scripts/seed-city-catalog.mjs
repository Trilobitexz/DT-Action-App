import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import admin from "firebase-admin";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inputPath = path.join(root, "scripts", "data", "prebuilt-spots.json");
const minimumCityCount = 200;
const minimumSpotsPerCity = 3;
const maximumBatchOperations = 400;
const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || "dt-action-app";
const validCityCoordinate = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng)
  && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
const validSpotCoordinate = (lat, lng) => validCityCoordinate(lat, lng) && lat !== 0 && lng !== 0;
const distanceKm = (a, b) => {
  const radians = Math.PI / 180;
  const dLat = (b.lat - a.lat) * radians;
  const dLng = (b.lng - a.lng) * radians;
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * radians) * Math.cos(b.lat * radians) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};
const slug = value => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
  .normalize("NFKC").trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "").slice(0, 80) || "spot";

let catalog;
try {
  catalog = JSON.parse(await fs.readFile(inputPath, "utf8"));
} catch (error) {
  throw new Error(`找不到或無法讀取 ${path.relative(root, inputPath)}。請先執行 npm run enrich:city-spots。`, { cause: error });
}
const cities = Array.isArray(catalog?.cities) ? catalog.cities : [];
const seenCityIds = new Set();
const validationErrors = [];
for (const city of cities) {
  if (!city?.id || seenCityIds.has(city.id)) {
    validationErrors.push(`城市 ID 缺漏或重複：${city?.id || "(空白)"}`);
    continue;
  }
  seenCityIds.add(city.id);
  if (!validCityCoordinate(city.lat, city.lng)) validationErrors.push(`${city.name || city.id}：城市座標無效`);
  const spots = Array.isArray(city.spots) ? city.spots : [];
  if (spots.length < minimumSpotsPerCity) validationErrors.push(`${city.name || city.id}：只有 ${spots.length} 筆景點`);
  const seenNames = new Set();
  spots.forEach((spot, index) => {
    const label = `${city.name || city.id} 景點 ${index + 1}`;
    const normalizedName = String(spot?.name || "").normalize("NFKC").trim().toLocaleLowerCase();
    if (!normalizedName) validationErrors.push(`${label}：名稱缺漏`);
    if (normalizedName && seenNames.has(normalizedName)) validationErrors.push(`${label}：景點名稱重複`);
    if (normalizedName) seenNames.add(normalizedName);
    if (typeof spot?.category !== "string" || typeof spot?.summary !== "string" || typeof spot?.imageUrl !== "string") {
      validationErrors.push(`${label}：category、summary 或 imageUrl 欄位格式錯誤`);
    }
    if (!validSpotCoordinate(spot?.lat, spot?.lng)) validationErrors.push(`${label}：座標非有效、非零 Number`);
    else if (distanceKm(city, spot) > 50) validationErrors.push(`${label}：距離城市中心超過 50 公里`);
    if (!/^https?:\/\//i.test(String(spot?.sourceUrl || ""))) validationErrors.push(`${label}：缺少有效來源網址`);
  });
}
if (cities.length < minimumCityCount) validationErrors.push(`城市清單只有 ${cities.length} 座，至少需要 ${minimumCityCount} 座`);
if (catalog.cityCount !== undefined && catalog.cityCount !== cities.length) validationErrors.push("JSON 總城市數與城市資料筆數不一致");
if (validationErrors.length) {
  console.error(`離線目錄驗證失敗（${validationErrors.length} 項）：`);
  validationErrors.slice(0, 100).forEach(error => console.error(`- ${error}`));
  if (validationErrors.length > 100) console.error(`…另有 ${validationErrors.length - 100} 項錯誤`);
  process.exitCode = 1;
  throw new Error("拒絕匯入不完整或不符合座標規則的城市景點資料。");
}

admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId });
const db = admin.firestore();
let batch = db.batch();
let batchOperations = 0;
let committedBatches = 0;
let writeCount = 0;
const flush = async () => {
  if (!batchOperations) return;
  await batch.commit();
  committedBatches += 1;
  batch = db.batch();
  batchOperations = 0;
};
const queueSet = async (reference, document, options) => {
  if (batchOperations >= maximumBatchOperations) await flush();
  batch.set(reference, document, options);
  batchOperations += 1;
  writeCount += 1;
};

try {
  for (const [cityIndex, city] of cities.entries()) {
    const cityRef = db.collection("cities").doc(city.id);
    await queueSet(cityRef, {
      id: city.id,
      name: city.name || city.englishName || city.id,
      englishName: city.englishName || city.name || "",
      countryName: city.countryName || "",
      countryCode: city.countryCode || "",
      continentName: city.continentName || "",
      lat: city.lat,
      lng: city.lng,
      coordinateSourceUrl: city.coordinateSource || "",
      spotCount: city.spots.length,
      featuredSpotCount: city.spots.length,
      catalogUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      publishedAt: admin.firestore.FieldValue.serverTimestamp(),
      dataVersion: "2026.11.23-prebuilt-spots-v1"
    }, { merge: true });

    for (const [index, spot] of city.spots.entries()) {
      const spotId = `${String(index).padStart(3, "0")}-${slug(spot.name)}`;
      await queueSet(cityRef.collection("spots").doc(spotId), {
        index,
        name: String(spot.name).trim(),
        englishName: spot.englishName || "",
        category: spot.category || "景點",
        tag: spot.tag || "精選景點",
        isFeatured: true,
        featuredRank: index,
        note: spot.summary || spot.note || "",
        description: spot.summary || spot.description || spot.note || "",
        lat: spot.lat,
        lng: spot.lng,
        sourceUrl: spot.sourceUrl,
        sourceLabel: spot.sourceLabel || "Wikipedia geosearch",
        imageUrl: spot.imageUrl || "",
        imageSourceUrl: spot.imageSourceUrl || spot.sourceUrl,
        hasCoordinates: true,
        hasDescription: Boolean(spot.summary || spot.description || spot.note),
        catalogUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        publishedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }
    if ((cityIndex + 1) % 25 === 0 || cityIndex + 1 === cities.length) {
      console.log(`已排入 ${cityIndex + 1}/${cities.length} 座城市`);
    }
  }
  await flush();
  console.log(JSON.stringify({
    projectId,
    cityCount: cities.length,
    spotCount: cities.reduce((sum, city) => sum + city.spots.length, 0),
    writeCount,
    committedBatches,
    maxOperationsPerBatch: maximumBatchOperations
  }, null, 2));
} catch (error) {
  console.error(`Firestore 匯入失敗（專案 ${projectId}）：${error.message}`);
  console.error("已成功提交的先前批次不會自動回復；修正問題後可安全重跑，寫入採固定文件 ID。 ");
  throw error;
}
