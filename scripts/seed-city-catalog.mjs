import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inputPath = path.join(root, "scripts", "data", "prebuilt-spots.json");
const qualitySandbox = { window: {} };
vm.runInNewContext(await fs.readFile(path.join(root, "src", "js", "services", "spotTextService.js"), "utf8"), qualitySandbox);
const isTravelAttraction = spot => qualitySandbox.window.SpotTextService?.isTravelAttraction(spot) ?? true;
const normalizeSpot = spot => qualitySandbox.window.SpotTextService?.normalizeSpot(spot) || spot;
const normalizeName = value => String(qualitySandbox.window.SpotTextService?.toTraditional(value) || value || "")
  .normalize("NFKC").trim().toLocaleLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
const isCityItself = (city, spot) => {
  const name = normalizeName(spot?.name);
  return Boolean(name && [city?.id, city?.name, city?.englishName].some(alias => normalizeName(alias) === name));
};
const minimumCityCount = 200;
const minimumSpotsPerCity = 3;
const maximumBatchOperations = 400;
const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || "dt-action-app";
const validCityCoordinate = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng)
  && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && !(lat === 0 && lng === 0);
const validSpotCoordinate = (lat, lng) => validCityCoordinate(lat, lng);
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
const isValidStoredSpot = (city, rawSpot) => {
  const spot = normalizeSpot(rawSpot) || {};
  return Boolean(String(spot.name || "").trim())
    && typeof spot.category === "string"
    && typeof spot.description === "string"
    && typeof spot.imageUrl === "string"
    && isTravelAttraction(spot)
    && !isCityItself(city, spot)
    && validSpotCoordinate(spot.lat, spot.lng)
    && /^https?:\/\//i.test(String(spot.sourceUrl || ""))
    && validCityCoordinate(city.lat, city.lng)
    && distanceKm(city, spot) <= 50;
};
const enrichmentScore = spot => [
  spot.imageUrl, spot.website, spot.openingHours, spot.address, spot.ratingSource,
  String(spot.description || spot.note || "").trim().length >= 80 ? "description" : ""
].filter(Boolean).length;
const mergeEnrichment = (spot, matches) => {
  const existing = [...matches].sort((a, b) => enrichmentScore(b.data) - enrichmentScore(a.data)).map(item => item.data);
  const candidates = [spot, ...existing];
  const firstString = key => candidates.map(item => item?.[key]).find(value => typeof value === "string" && value.trim()) || "";
  const firstUrl = key => candidates.map(item => item?.[key]).find(value => typeof value === "string" && /^https?:\/\//i.test(value.trim())) || "";
  const descriptions = candidates.flatMap(item => [item?.summary, item?.description, item?.note])
    .filter(value => typeof value === "string" && value.trim()).sort((a, b) => b.trim().length - a.trim().length);
  const ratingItem = candidates.find(item => item?.rating !== null && item?.rating !== undefined && item?.rating !== ""
    && Number.isFinite(Number(item.rating)) && Number(item.rating) >= 0 && Number(item.rating) <= 5);
  const visitHours = candidates.find(item => Number.isFinite(Number(item?.visitHours)) && Number(item.visitHours) > 0)?.visitHours;
  const description = descriptions[0]?.trim() || "";
  const merged = {
    ...spot,
    summary: description,
    description,
    note: description,
    imageUrl: firstUrl("imageUrl"),
    imageSourceUrl: firstUrl("imageSourceUrl") || firstUrl("sourceUrl"),
    website: firstUrl("website"),
    openingHours: firstString("openingHours"),
    address: firstString("address"),
    closedDays: firstString("closedDays")
  };
  if (ratingItem) {
    merged.rating = Number(ratingItem.rating);
    merged.ratingSource = firstString("ratingSource");
  }
  if (visitHours !== undefined) merged.visitHours = Number(visitHours);
  return merged;
};

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
  const spots = Array.isArray(city.spots) ? city.spots.map(normalizeSpot) : [];
  const qualitySpots = spots.filter(spot => validSpotCoordinate(spot?.lat, spot?.lng)
    && distanceKm(city, spot) <= 50 && !isCityItself(city, spot) && isTravelAttraction(spot)
    && /^https?:\/\//i.test(String(spot?.sourceUrl || "")));
  if (qualitySpots.length < minimumSpotsPerCity) validationErrors.push(`${city.name || city.id}：只有 ${qualitySpots.length} 筆符合品質與座標門檻的景點`);
  const seenNames = new Set();
  spots.forEach((spot, index) => {
    const label = `${city.name || city.id} 景點 ${index + 1}`;
    const normalizedName = normalizeName(spot?.name);
    if (!normalizedName) validationErrors.push(`${label}：名稱缺漏`);
    if (isCityItself(city, spot)) validationErrors.push(`${label}：條目是城市本身，不是可造訪景點`);
    if (normalizedName && seenNames.has(normalizedName)) validationErrors.push(`${label}：景點名稱重複`);
    if (normalizedName) seenNames.add(normalizedName);
    if (typeof spot?.category !== "string" || typeof spot?.summary !== "string" || typeof spot?.imageUrl !== "string") {
      validationErrors.push(`${label}：category、summary 或 imageUrl 欄位格式錯誤`);
    }
    if (!isTravelAttraction(spot)) validationErrors.push(`${label}：條目不是適合旅客造訪的景點`);
    if (!validSpotCoordinate(spot?.lat, spot?.lng)) validationErrors.push(`${label}：座標格式錯誤或缺漏（赤道／本初子午線座標可用，僅排除 [0, 0]）`);
    else if (distanceKm(city, spot) > 50) validationErrors.push(`${label}：距城市中心超過 50 公里`);
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

if (process.argv.includes("--validate-only")) {
  console.log(`本機匯入前驗證通過：${cities.length} 座城市，${cities.reduce((sum, city) => sum + city.spots.length, 0)} 筆景點。未連線 Firebase，未寫入 Firestore。`);
  process.exit(0);
}

const { default: admin } = await import("firebase-admin");
admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId });
const db = admin.firestore();
let batch = db.batch();
let batchOperations = 0;
let committedBatches = 0;
let writeCount = 0;
let deletedDocumentCount = 0;
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
const queueDelete = async reference => {
  if (batchOperations >= maximumBatchOperations) await flush();
  batch.delete(reference);
  batchOperations += 1;
  writeCount += 1;
  deletedDocumentCount += 1;
};

try {
  for (const [cityIndex, city] of cities.entries()) {
    const cityRef = db.collection("cities").doc(city.id);
    const spotsCollection = cityRef.collection("spots");
    const existingSnapshot = await spotsCollection.get();
    const existingEntries = existingSnapshot.docs.map(document => ({ document, data: normalizeSpot(document.data()) || {} }));
    const validExisting = existingEntries.filter(entry => isValidStoredSpot(city, entry.data));
    const invalidExisting = existingEntries.filter(entry => !isValidStoredSpot(city, entry.data));
    const existingByName = new Map();
    for (const entry of [...validExisting].sort((a, b) => enrichmentScore(b.data) - enrichmentScore(a.data))) {
      [entry.data.name, entry.data.englishName].map(normalizeName).filter(Boolean).forEach(key => {
        const matches = existingByName.get(key) || [];
        if (!matches.some(item => item.document.id === entry.document.id)) matches.push(entry);
        existingByName.set(key, matches);
      });
    }
    const matchedExistingIds = new Set();
    const duplicateEntries = new Map();
    const plannedSpots = city.spots.map((rawSpot, index) => {
      const spot = normalizeSpot(rawSpot);
      const keys = [spot.name, spot.englishName].map(normalizeName).filter(Boolean);
      const matches = [...new Map(keys.flatMap(key => existingByName.get(key) || [])
        .map(entry => [entry.document.id, entry])).values()]
        .sort((a, b) => enrichmentScore(b.data) - enrichmentScore(a.data));
      matches.forEach((entry, matchIndex) => {
        matchedExistingIds.add(entry.document.id);
        if (matchIndex > 0) duplicateEntries.set(entry.document.id, entry);
      });
      const canonicalId = `${String(index).padStart(3, "0")}-${slug(spot.name)}`;
      const reference = matches[0]?.document.ref || spotsCollection.doc(canonicalId);
      return { reference, data: mergeEnrichment(spot, matches) };
    });
    const targetIds = new Set(plannedSpots.map(item => item.reference.id));
    const unmatchedValidCount = validExisting.filter(entry => !matchedExistingIds.has(entry.document.id)).length;

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
      spotCount: plannedSpots.length + unmatchedValidCount,
      featuredSpotCount: city.spots.length,
      catalogUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      publishedAt: admin.firestore.FieldValue.serverTimestamp(),
      dataVersion: "2026.11.27-prebuilt-spots-v2"
    }, { merge: true });

    for (const [index, planned] of plannedSpots.entries()) {
      const spot = planned.data;
      const document = {
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
        dataVersion: "2026.11.27-prebuilt-spots-v2",
        catalogUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        publishedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      ["website", "openingHours", "address", "closedDays"].forEach(key => {
        if (spot[key]) document[key] = spot[key];
      });
      if (Number.isFinite(Number(spot.visitHours)) && Number(spot.visitHours) > 0) document.visitHours = Number(spot.visitHours);
      if (Number.isFinite(Number(spot.rating)) && Number(spot.rating) >= 0 && Number(spot.rating) <= 5) {
        document.rating = Number(spot.rating);
        if (spot.ratingSource) document.ratingSource = spot.ratingSource;
      }
      await queueSet(planned.reference, document, { merge: true });
    }
    const deletes = new Map();
    [...invalidExisting, ...duplicateEntries.values()].forEach(entry => {
      if (!targetIds.has(entry.document.id)) deletes.set(entry.document.id, entry.document.ref);
    });
    for (const reference of deletes.values()) await queueDelete(reference);
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
    deletedDocumentCount,
    committedBatches,
    maxOperationsPerBatch: maximumBatchOperations
  }, null, 2));
} catch (error) {
  console.error(`Firestore 匯入失敗（專案 ${projectId}）：${error.message}`);
  console.error("已成功提交的先前批次不會自動回復；修正問題後可安全重跑，寫入採固定文件 ID。 ");
  throw error;
}
