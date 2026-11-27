import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "src", "data", "city-spots");
const files = fs.readdirSync(dataDir).filter(file => file.endsWith(".json")).sort();
const sandbox = { window: {} };
const dataFiles = [
  "src/data/travelData.js", "src/data/countries/asia.js", "src/data/countries/europe.js",
  "src/data/countries/others.js", "src/data/globalCities.js", "src/data/cityCatalogExpansion.js",
  "src/data/cityGeonames.js", "src/data/cityEnrichment.js", "src/js/services/spotTextService.js"
];
for (const relative of dataFiles) {
  vm.runInNewContext(fs.readFileSync(path.join(root, relative), "utf8"), sandbox, { filename: relative });
}

const travelData = sandbox.window.TRAVEL_DATA || {};
const toCoordinate = value => value === null || value === undefined || value === "" ? NaN : Number(value);
const cityCoordinates = new Map();
const cityRecords = new Map();
for (const city of [
  ...(travelData.globalCities || []),
  ...(travelData.countries || []).flatMap(country => country.cities || [])
]) {
  if (city?.id) {
    cityCoordinates.set(city.id, { lat: coordinate(city.lat), lng: coordinate(city.lng) });
    cityRecords.set(city.id, city);
  }
}
const prebuiltCatalogPath = path.join(root, "scripts", "data", "prebuilt-spots.json");
if (fs.existsSync(prebuiltCatalogPath)) {
  const prebuiltCatalog = JSON.parse(fs.readFileSync(prebuiltCatalogPath, "utf8"));
  for (const city of prebuiltCatalog.cities || []) {
    const existing = cityCoordinates.get(city.id);
    if (!validCoordinate(existing?.lat, existing?.lng)) {
      cityCoordinates.set(city.id, { lat: coordinate(city.lat), lng: coordinate(city.lng) });
    }
    if (!cityRecords.has(city.id)) cityRecords.set(city.id, city);
  }
}
for (const [cityId, location] of Object.entries(sandbox.window.CITY_GEONAMES || {})) {
  if (!cityCoordinates.has(cityId) || !validCoordinate(cityCoordinates.get(cityId).lat, cityCoordinates.get(cityId).lng)) {
    cityCoordinates.set(cityId, { lat: coordinate(location.lat), lng: coordinate(location.lng) });
  }
}

const flags = [];
const totals = {
  cities: 0,
  spots: 0,
  qualifiedSpots: 0,
  missingImage: 0,
  missingDescription: 0,
  missingCoordinates: 0,
  missingSource: 0,
  overFiftyKm: 0,
  nonVisitPages: 0,
  duplicateNames: 0
};
const cityCountsBelowMinimum = [];
const minimumSpotsPerCity = 3;
function coordinate(value) { return toCoordinate(value); }
function validCoordinate(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
    && !(lat === 0 && lng === 0);
}
function distanceKm(a, b) {
  const radians = Math.PI / 180;
  const dLat = (b.lat - a.lat) * radians;
  const dLng = (b.lng - a.lng) * radians;
  const value = Math.sin(dLat / 2) ** 2
    + Math.cos(a.lat * radians) * Math.cos(b.lat * radians) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}
function normalizedName(value) {
  return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .normalize("NFKC").trim().toLocaleLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
}

for (const file of files) {
  const cities = JSON.parse(fs.readFileSync(path.join(dataDir, file), "utf8"));
  for (const [cityId, rawSpots] of Object.entries(cities)) {
    totals.cities += 1;
    const spots = Array.isArray(rawSpots) ? rawSpots : [];
    const city = cityCoordinates.get(cityId);
    const hasCityCenter = validCoordinate(city?.lat, city?.lng);
    const cityRecord = cityRecords.get(cityId);
    const cityNames = new Set([cityRecord?.name, cityRecord?.englishName].map(normalizedName).filter(Boolean));
    const seenNames = new Set();
    let qualifiedCount = 0;
    totals.spots += spots.length;

    for (const rawSpot of spots) {
      const spot = sandbox.window.SpotTextService?.normalizeSpot(rawSpot) || rawSpot;
      const name = String(spot.name || "").trim();
      const description = String(spot.description || spot.summary || spot.note || "").trim();
      const lat = coordinate(spot.lat);
      const lng = coordinate(spot.lng);
      const hasCoords = validCoordinate(lat, lng);
      const hasSource = /^https?:\/\//i.test(String(spot.sourceUrl || ""));
      const hasImage = Boolean(String(spot.imageUrl || spot.image || spot.thumbnail || "").trim());
      const isVisitPage = sandbox.window.SpotTextService?.isTravelAttraction(spot) ?? true;
      const duplicateKey = normalizedName(name);
      const isDuplicate = Boolean(duplicateKey && seenNames.has(duplicateKey));
      const isCityItself = cityNames.has(duplicateKey);
      const distance = hasCoords && hasCityCenter ? distanceKm(city, { lat, lng }) : null;
      const withinCity = distance === null || distance <= 50;

      if (!hasImage) totals.missingImage += 1;
      if (description.length < 40) totals.missingDescription += 1;
      if (!hasCoords) totals.missingCoordinates += 1;
      if (!hasSource) totals.missingSource += 1;
      if (distance !== null && distance > 50) totals.overFiftyKm += 1;
      if (!isVisitPage) totals.nonVisitPages += 1;
      if (isDuplicate) totals.duplicateNames += 1;
      if (duplicateKey) seenNames.add(duplicateKey);

      const eligible = Boolean(name && hasCoords && hasSource && isVisitPage && !isCityItself && withinCity && hasCityCenter);
      if (eligible) qualifiedCount += 1;
      const reasons = [];
      if (!name) reasons.push("缺少景點名稱");
      if (!hasCoords) reasons.push("座標格式錯誤或缺漏");
      if (!hasSource) reasons.push("缺少來源網址");
      if (!isVisitPage) reasons.push("行政區、機構或事件條目，不列為可造訪景點");
      if (isCityItself) reasons.push("此條目是城市本身，不是景點");
      if (!withinCity) reasons.push(`距城市中心 ${distance.toFixed(1)} 公里（超過 50 公里）`);
      if (isDuplicate) reasons.push("城市內名稱重複");
      if (reasons.length) flags.push({ file, cityId, name: name || "(無名稱)", reason: reasons.join("；") });
    }

    totals.qualifiedSpots += qualifiedCount;
    if (qualifiedCount < minimumSpotsPerCity) {
      cityCountsBelowMinimum.push({ cityId, eligible: qualifiedCount, total: spots.length });
      flags.push({ file, cityId, name: "城市景點數不足", reason: `只有 ${qualifiedCount} 筆符合座標、來源與景點品質條件的資料（至少需要 ${minimumSpotsPerCity} 筆）` });
    }
    if (!hasCityCenter) flags.push({ file, cityId, name: "城市中心座標", reason: "無法從本地城市目錄或 GeoNames 找到可用座標，無法驗證景點距離" });
  }
}

console.log(`城市景點資料稽核：${files.length} 個檔案，${totals.cities} 座城市，${totals.spots} 筆原始景點`);
console.log(`符合來源／座標／內容條件 ${totals.qualifiedSpots} 筆；每城至少 ${minimumSpotsPerCity} 筆：${totals.cities - cityCountsBelowMinimum.length}/${totals.cities}`);
console.log(`缺圖片 ${totals.missingImage}；短介紹（少於 40 字）${totals.missingDescription}；缺座標 ${totals.missingCoordinates}；缺來源 ${totals.missingSource}；超過 50 公里 ${totals.overFiftyKm}；非景點條目 ${totals.nonVisitPages}；重複名稱 ${totals.duplicateNames}`);
if (cityCountsBelowMinimum.length) {
  console.log("不足 3 筆的城市：" + cityCountsBelowMinimum.map(city => `${city.cityId} (${city.eligible}/${city.total})`).join(", "));
}
console.log(`需檢視的問題：${flags.length} 筆`);
for (const item of flags.slice(0, 120)) console.log(`[REVIEW] ${item.file} / ${item.cityId} / ${item.name} — ${item.reason}`);
if (flags.length > 120) console.log(`…另有 ${flags.length - 120} 筆，請檢查資料檔或依城市分批稽核。`);
if (cityCountsBelowMinimum.length || totals.missingCoordinates || totals.missingSource || totals.overFiftyKm || totals.nonVisitPages || totals.duplicateNames) {
  process.exitCode = 1;
}
