import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import admin from "firebase-admin";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inputPath = path.join(root, "scripts", "data", "prebuilt-spots.json");
const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || "dt-action-app";
const minimumCityCount = 200;
const minimumSpotsPerCity = 3;
const validCoordinate = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng)
  && lat !== 0 && lng !== 0 && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
const distanceKm = (a, b) => {
  const radians = Math.PI / 180;
  const dLat = (b.lat - a.lat) * radians;
  const dLng = (b.lng - a.lng) * radians;
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * radians) * Math.cos(b.lat * radians) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};

const catalog = JSON.parse(await fs.readFile(inputPath, "utf8"));
const cities = Array.isArray(catalog?.cities) ? catalog.cities : [];
if (cities.length < minimumCityCount) throw new Error(`預建目錄只有 ${cities.length} 座城市，無法完整驗證。`);

admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId });
const db = admin.firestore();
const failures = [];
let verifiedCityCount = 0;
let validSpotDocumentCount = 0;
let invalidSpotDocumentCount = 0;
const invalidSpotExamples = [];
const concurrency = 10;

for (let offset = 0; offset < cities.length; offset += concurrency) {
  const group = cities.slice(offset, offset + concurrency);
  const results = await Promise.all(group.map(async city => {
    const cityRef = db.collection("cities").doc(city.id);
    const [citySnapshot, spotSnapshot] = await Promise.all([
      cityRef.get(),
      cityRef.collection("spots").get()
    ]);
    const problems = [];
    if (!citySnapshot.exists) return { city, problems: ["Firestore 城市文件不存在"], validCount: 0, invalidCount: 0 };
    const storedCity = citySnapshot.data();
    const center = { lat: storedCity.lat, lng: storedCity.lng };
    if (!validCoordinate(center.lat, center.lng)) problems.push("城市中心座標無效");
    let validCount = 0;
    let invalidCount = 0;
    spotSnapshot.forEach(document => {
      const spot = document.data();
      const valid = Boolean(String(spot.name || "").trim())
        && typeof spot.category === "string"
        && typeof spot.description === "string"
        && typeof spot.imageUrl === "string"
        && validCoordinate(spot.lat, spot.lng)
        && /^https?:\/\//i.test(String(spot.sourceUrl || ""))
        && validCoordinate(center.lat, center.lng)
        && distanceKm(center, spot) <= 50;
      if (valid) validCount += 1;
      else {
        invalidCount += 1;
        if (invalidSpotExamples.length < 20) invalidSpotExamples.push({
          cityId: city.id,
          spotId: document.id,
          name: spot.name || "",
          reason: !validCoordinate(spot.lat, spot.lng) ? "座標格式錯誤"
            : !/^https?:\/\//i.test(String(spot.sourceUrl || "")) ? "來源網址缺漏"
              : distanceKm(center, spot) > 50 ? "超過 50 公里"
                : "category、description 或 imageUrl 欄位缺漏"
        });
      }
    });
    if (validCount < minimumSpotsPerCity) problems.push(`只有 ${validCount} 筆有效景點（至少需要 ${minimumSpotsPerCity} 筆）`);
    return { city, problems, validCount, invalidCount };
  }));
  results.forEach(result => {
    validSpotDocumentCount += result.validCount;
    invalidSpotDocumentCount += result.invalidCount;
    if (result.problems.length) failures.push({ city: result.city.name || result.city.id, problems: result.problems });
    else verifiedCityCount += 1;
  });
  console.log(`已回讀驗證 ${Math.min(offset + group.length, cities.length)}/${cities.length} 座城市`);
}

const report = {
  projectId,
  expectedCityCount: cities.length,
  verifiedCityCount,
  validSpotDocumentCount,
  invalidSpotDocumentCount,
  invalidSpotExamples,
  failedCityCount: failures.length,
  failures
};
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
