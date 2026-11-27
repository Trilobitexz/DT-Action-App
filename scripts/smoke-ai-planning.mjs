import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sandbox = {
  window: {
    TRAVEL_DATA: { globalCities: [], countries: [], globalCityAliases: {} },
    setTimeout,
    clearTimeout
  },
  document: { scripts: [], baseURI: "https://journey-atlas.invalid/" },
  location: { href: "https://journey-atlas.invalid/" },
  localStorage: { getItem: () => null, setItem: () => {} },
  URL,
  console,
  setTimeout,
  clearTimeout
};

for (const relative of [
  "src/data/cityGeonames.js",
  "src/data/cityCoordinates.js",
  "src/js/services/spotTextService.js",
  "src/js/modules/plannerView.js",
  "src/js/services/cityCatalogService.js"
]) {
  vm.runInNewContext(fs.readFileSync(path.join(root, relative), "utf8"), sandbox, { filename: relative });
}

const prebuiltPath = path.join(root, "scripts", "data", "prebuilt-spots.json");
const prebuilt = JSON.parse(fs.readFileSync(prebuiltPath, "utf8"));
const cityCandidates = [];
for (const city of prebuilt.cities || []) {
  const candidates = sandbox.window.PlannerView.rankAIPlanningSpots(city, 3).map(item => item.spot);
  const invalid = candidates.find(spot => {
    let validSource = false;
    try { validSource = /^https?:$/.test(new URL(String(spot.sourceUrl || "")).protocol); }
    catch (error) { validSource = false; }
    const hasCoordinates = Number.isFinite(Number(spot.lat)) && Number(spot.lat) >= -90 && Number(spot.lat) <= 90
      && Number.isFinite(Number(spot.lng)) && Number(spot.lng) >= -180 && Number(spot.lng) <= 180
      && !(Number(spot.lat) === 0 && Number(spot.lng) === 0);
    return !validSource || !hasCoordinates || !String(spot.name || "").trim()
      || !String(spot.category || "").trim()
      || String(spot.description || spot.summary || spot.note || "").trim().length < 40
      || !sandbox.window.SpotTextService.isTravelAttraction(spot);
  });
  if (invalid) throw new Error(`AI candidate is incomplete or not a visitor site: ${city.id}/${invalid.name}`);
  cityCandidates.push({ cityId: city.id, count: candidates.length });
}

const underMinimum = cityCandidates.filter(city => city.count < 3);
if (underMinimum.length) {
  throw new Error(`Cities with fewer than three complete AI candidates: ${underMinimum.map(city => `${city.cityId} (${city.count})`).join(", ")}`);
}
const genericStation = {
  name: "Central Station",
  category: "地標與建築",
  summary: "A railway station used by many travellers in the central business district."
};
if (sandbox.window.SpotTextService.isTravelAttraction(genericStation)) {
  throw new Error("A generic station passed the visitor-site filter.");
}

const service = sandbox.window.CityCatalogService;
const knownYangon = service.getKnownCityCoordinates("yangon");
if (knownYangon?.lat !== 16.80528 || knownYangon?.lng !== 96.15611) {
  throw new Error("The GeoNames Yangon coordinate was not selected.");
}

const cloudSpotEntries = [
  {
    id: "shwedagon",
    data: () => ({
      name: "瑞光大金塔",
      category: "宗教建築與文化遺產",
      description: "瑞光大金塔位於仰光辛古塔拉山，是緬甸重要的佛教聖塔與朝聖地。金塔所在的山丘長期作為宗教場所，現存建築群包含主塔、佛堂與供奉空間，延續當地佛教信仰。",
      lat: 16.798356,
      lng: 96.149705,
      sourceUrl: "https://whc.unesco.org/en/tentativelists/6367/"
    })
  },
  {
    id: "invalid-null-island",
    data: () => ({
      name: "錯置景點",
      category: "博物館",
      description: "這筆測試資料使用無效的零經緯度，城市目錄載入時應予排除。",
      lat: 0,
      lng: 0,
      sourceUrl: "https://example.invalid/spot"
    })
  }
];
const spotsQuery = {
  orderBy() { return this; },
  limit() { return this; },
  get: async () => ({ forEach: callback => cloudSpotEntries.forEach(callback) })
};
const cityDocument = {
  get: async () => ({
    exists: true,
    data: () => ({ id: "yangon", name: "仰光", lat: 16.647565, lng: 96.1129218 })
  }),
  collection: () => spotsQuery
};
service.waitForFirestore = async () => ({ collection: () => ({ doc: () => cityDocument }) });
const cloudResult = await service.fetchCity("yangon");
if (cloudResult?.city?.lat !== 16.80528 || cloudResult?.city?.lng !== 96.15611
  || cloudResult.spots.length !== 1 || cloudResult.spots[0].name !== "瑞光大金塔") {
  throw new Error("Firestore stale-center correction or invalid-coordinate filtering failed.");
}

const minimumCandidates = Math.min(...cityCandidates.map(city => city.count));
console.log(`AI candidate smoke check passed: ${cityCandidates.length} cities; minimum ${minimumCandidates} complete sourced candidates per city; generic station rejected.`);
console.log("Cloud catalog smoke check passed: stale Yangon center corrected; invalid-coordinate spot excluded.");
