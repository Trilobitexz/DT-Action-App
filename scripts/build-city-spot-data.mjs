import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = relative => fs.readFile(path.join(root, relative), "utf8");
const window = {};
for (const relative of [
  "src/data/travelData.js", "src/data/countries/asia.js", "src/data/countries/europe.js",
  "src/data/countries/others.js", "src/data/globalCities.js", "src/data/cityCatalogExpansion.js",
  "src/data/cityGeonames.js", "src/data/cityEnrichment.js", "src/js/services/spotTextService.js"
]) {
  vm.runInNewContext(await read(relative), { window, URL }, { filename: relative });
}

const inputPath = path.join(root, "scripts", "data", "prebuilt-spots.json");
const catalog = JSON.parse(await fs.readFile(inputPath, "utf8"));
const sourceCities = new Map((window.TRAVEL_DATA?.globalCities || []).map(city => [city.id, city]));
const continents = window.TRAVEL_DATA?.continents || [];
const radians = Math.PI / 180;
const validCoordinate = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng)
  && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && !(lat === 0 && lng === 0);
const distanceKm = (a, b) => {
  const dLat = (b.lat - a.lat) * radians;
  const dLng = (b.lng - a.lng) * radians;
  const value = Math.sin(dLat / 2) ** 2
    + Math.cos(a.lat * radians) * Math.cos(b.lat * radians) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};
const normalizeName = value => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
  .normalize("NFKC").trim().toLocaleLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
const displayName = value => window.SpotTextService?.toTraditional(value) || String(value || "");
const isCityItself = (city, spot) => {
  const name = normalizeName(displayName(spot.name));
  return Boolean(name && [city.id, city.name, city.englishName].some(alias => normalizeName(displayName(alias)) === name));
};
const isValidHttpUrl = value => window.SpotTextService?.isValidHttpUrl(value) ?? false;
const coordinate = value => value === null || value === undefined || value === "" ? NaN : Number(value);
const grouped = new Map();
const cleanedCatalogCities = [];
const incomplete = [];
const originalSpotCount = (catalog.cities || []).reduce((sum, city) => sum + (city.spots || []).length, 0);

for (const city of catalog.cities || []) {
  const localCity = sourceCities.get(city.id);
  const continentId = localCity?.continentId
    || continents.find(item => item.name === (localCity?.continentName || city.continentName))?.id;
  const center = { lat: coordinate(city.lat), lng: coordinate(city.lng) };
  if (!localCity || !continentId || !validCoordinate(center.lat, center.lng)) {
    incomplete.push(`${city.id}: 缺少城市座標或洲別`);
    continue;
  }
  const seen = new Set();
  const spots = (city.spots || []).map(rawSpot => {
    const spot = window.SpotTextService?.normalizeSpot(rawSpot) || rawSpot;
    return { ...spot, lat: coordinate(spot.lat), lng: coordinate(spot.lng) };
  }).filter(spot => {
    const nameKey = normalizeName(displayName(spot.name));
    if (!nameKey || seen.has(nameKey) || nameKey === normalizeName(localCity.name)
      || nameKey === normalizeName(localCity.englishName)
      || isCityItself(city, spot)
      || !validCoordinate(spot.lat, spot.lng)
      || distanceKm(center, spot) > 50
      || !isValidHttpUrl(spot.sourceUrl)
      || !(window.SpotTextService?.isTravelAttraction(spot) ?? true)) return false;
    if (spot.imageUrl && (!String(spot.imageAttribution || "").trim()
      || !String(spot.imageLicense || "").trim()
      || !/^https:\/\//i.test(String(spot.imageSourceUrl || "")))) {
      incomplete.push(`${city.id}/${spot.name}: 圖片缺少可核實的作者、授權或檔案來源頁`);
      return false;
    }
    seen.add(nameKey);
    return true;
  }).map(spot => ({
    ...spot,
    summary: String(spot.summary || spot.description || spot.note || ""),
    note: String(spot.note || spot.summary || spot.description || ""),
    description: String(spot.description || spot.summary || spot.note || "")
  }));
  if (spots.length < 3) incomplete.push(`${city.id}: 只有 ${spots.length} 筆合格景點`);
  cleanedCatalogCities.push({ ...city, spots });
  if (!grouped.has(continentId)) grouped.set(continentId, {});
  grouped.get(continentId)[city.id] = spots;
}

const expectedCityCount = (catalog.cities || []).length;
const emittedCityCount = [...grouped.values()].reduce((sum, cities) => sum + Object.keys(cities).length, 0);
if (expectedCityCount < 200 || emittedCityCount !== expectedCityCount || incomplete.length) {
  console.error(`拒絕產生靜態景點檔：城市 ${emittedCityCount}/${expectedCityCount}，問題 ${incomplete.length} 項`);
  incomplete.slice(0, 80).forEach(problem => console.error(`- ${problem}`));
  process.exitCode = 1;
} else {
  catalog.cities = cleanedCatalogCities;
  catalog.cityCount = cleanedCatalogCities.length;
  catalog.successfulCityCount = cleanedCatalogCities.filter(city => city.spots.length >= 3).length;
  await fs.writeFile(inputPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  const outputDir = path.join(root, "src", "data", "city-spots");
  for (const [continentId, cities] of grouped) {
    await fs.writeFile(path.join(outputDir, `${continentId}.json`), `${JSON.stringify(cities)}\n`, "utf8");
  }
  const cleanedSpotCount = cleanedCatalogCities.reduce((sum, city) => sum + city.spots.length, 0);
  console.log(`已清理預建目錄中的 ${originalSpotCount - cleanedSpotCount} 筆非旅遊景點或不合格記錄。`);
  console.log(`已從可稽核的預建目錄更新 ${emittedCityCount} 座城市的離線景點檔（${cleanedSpotCount} 筆景點）。`);
  console.log(`大洲檔案：${[...grouped.keys()].join(", " )}`);
}
