import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const geonamesFile = process.argv[2];
if (!geonamesFile || !fs.existsSync(geonamesFile)) {
  console.error("Usage: node scripts/refresh-city-research.mjs <path-to-cities500.txt>");
  process.exit(2);
}

const input = relative => fs.readFileSync(path.join(root, relative), "utf8");
const window = {};
[
  "src/data/travelData.js",
  "src/data/countries/asia.js",
  "src/data/countries/europe.js",
  "src/data/countries/others.js",
  "src/data/globalCities.js",
  "src/data/cityCatalogExpansion.js",
  "src/data/cityGeonames.js",
  "src/data/cityEnrichment.js"
].forEach(file => vm.runInNewContext(input(file), { window }, { filename: file }));

const snapshotDate = new Date().toISOString().slice(0, 10);
const normalize = value => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
  .normalize("NFKC").toLocaleLowerCase().replace(/[\s\p{P}]+/gu, "");
const rows = fs.readFileSync(geonamesFile, "utf8").split(/\r?\n/).filter(Boolean).map(line => line.split("\t"));
const cityAliases = { panaji: "Panjim", ayutthaya: "Phra Nakhon Si Ayutthaya" };
const featureRank = { PPLC: 0, PPLA: 1, PPLA2: 2, PPLA3: 3, PPLA4: 4, PPL: 5, PPLX: 6 };
const newCoordinates = {};

for (const city of window.TRAVEL_DATA.globalCities) {
  if (window.CITY_GEONAMES?.[city.id]?.geonameId) continue;
  const key = normalize(cityAliases[city.id] || city.englishName || city.name);
  const matches = rows.filter(row => row[8] === city.countryCode && [row[1], row[2]].some(name => normalize(name) === key));
  matches.sort((a, b) => (featureRank[a[7]] ?? 20) - (featureRank[b[7]] ?? 20) || Number(b[14] || 0) - Number(a[14] || 0));
  const match = matches[0];
  if (!match || match[6] !== "P" || !Number.isFinite(Number(match[4])) || !Number.isFinite(Number(match[5]))) continue;
  newCoordinates[city.id] = {
    geonameId: match[0], name: match[1], countryCode: match[8], featureClass: match[6], featureCode: match[7],
    lat: Number(match[4]), lng: Number(match[5]), matchDistanceKm: 0,
    sourceUrl: `https://www.geonames.org/${match[0]}`
  };
}

const unresolved = window.TRAVEL_DATA.globalCities.filter(city => !window.CITY_GEONAMES?.[city.id]?.geonameId && !newCoordinates[city.id]);
if (unresolved.length) {
  console.error(`GeoNames exact-name match missing for ${unresolved.map(city => city.id).join(", ")}`);
  process.exit(1);
}

const allCoordinates = { ...window.CITY_GEONAMES, ...newCoordinates };
const cityMeta = new Map(window.TRAVEL_DATA.globalCities.map(city => [city.id, city]));
const cityRecords = {};
const attractionCategory = /tourist attraction|museum|gallery|monument|memorial|park|garden|temple|church|mosque|cathedral|castle|palace|historic|heritage|archaeolog|landmark|monastery|shrine|square|bridge|tower|theatre|theater|zoo|aquarium|fort|beach|waterfall|mountain|botanical|island|cave|stadium|opera|library|market|district|plaza|building|protected area/i;
const localDelay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function getWikipediaPages(city, coordinate) {
  const params = new URLSearchParams({
    action: "query", generator: "geosearch", ggscoord: `${coordinate.lat}|${coordinate.lng}`,
    ggsradius: "10000", ggslimit: "100", ggsnamespace: "0",
    prop: "coordinates|extracts|categories", exintro: "1", explaintext: "1", exsentences: "2",
    cllimit: "10", clshow: "!hidden", format: "json", formatversion: "2", origin: "*"
  });
  const url = `https://en.wikipedia.org/w/api.php?${params}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "JourneyAtlasCityCatalog/1.0 (open city atlas; contact through project repository)"
        }
      });
      if (!response.ok) throw new Error(`Wikipedia API HTTP ${response.status}`);
      const data = await response.json();
      return Array.isArray(data.query?.pages) ? data.query.pages : Object.values(data.query?.pages || {});
    } catch (error) {
      if (attempt === 2) throw error;
      await localDelay((attempt + 1) * 2500);
    }
  }
  return [];
}

const cities = window.TRAVEL_DATA.globalCities;
for (let index = 0; index < cities.length; index++) {
  const city = cities[index];
  const coordinate = allCoordinates[city.id];
  const record = { geonameId: coordinate.geonameId, places: [], citySummary: null, queryStatus: "ok" };
  try {
    const pages = await getWikipediaPages(city, coordinate);
    const pageCandidates = [];
    for (const page of pages) {
      const point = page.coordinates?.[0];
      const lat = Number(point?.lat), lng = Number(point?.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !page.title) continue;
      const normalizedTitle = normalize(page.title.replaceAll("_", " "));
      const cityKey = normalize(city.englishName || city.name);
      const distKm = distanceKm(coordinate.lat, coordinate.lng, lat, lng);
      const pageUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replaceAll(" ", "_"))}`;
      const categories = (page.categories || []).map(item => String(item.title || "").replace(/^Category:/, ""));
      const categoryMatch = categories.find(value => attractionCategory.test(value));
      const extract = String(page.extract || "").replace(/\s+/g, " ").trim();

      if (!record.citySummary && normalizedTitle === cityKey && distKm <= 35 && extract) {
        record.citySummary = { text: extract.slice(0, 480), pageUrl, sourceLabel: "Wikipedia contributors · CC BY-SA 4.0" };
      }
      if (!categoryMatch || distKm > 10 || !extract) continue;
      const categoryText = categoryMatch.toLocaleLowerCase();
      const category = /museum|gallery/i.test(categoryText) ? "博物館與藝術"
        : /park|garden|botanical|protected area|waterfall|mountain|beach|island|cave/i.test(categoryText) ? "公園與自然"
          : /temple|church|mosque|cathedral|monastery|shrine/i.test(categoryText) ? "宗教建築"
            : /historic|heritage|archaeolog|castle|palace|fort|monument|memorial/i.test(categoryText) ? "歷史與文化遺產"
              : /district|square|plaza|market/i.test(categoryText) ? "街區與市集" : "地標與建築";
      pageCandidates.push({
        name: page.title.replaceAll("_", " "), category, tag: categoryMatch,
        note: extract.slice(0, 480), lat, lng, distanceKm: Math.round(distKm * 100) / 100,
        sourceUrl: pageUrl, sourceLabel: "Wikipedia contributors · CC BY-SA 4.0",
        sourceId: `enwiki:${page.pageid}`, pageId: page.pageid,
        license: "CC BY-SA 4.0"
      });
    }
    const deduped = [];
    for (const place of pageCandidates) {
      const duplicate = deduped.some(existing => normalize(existing.name) === normalize(place.name)
        && distanceKm(existing.lat, existing.lng, place.lat, place.lng) <= 0.35);
      if (!duplicate) deduped.push(place);
    }
    deduped.sort((a, b) => a.distanceKm - b.distanceKm || a.name.localeCompare(b.name));
    record.places = deduped.slice(0, 30);
  } catch (error) {
    record.queryStatus = `error: ${String(error.message || error).slice(0, 120)}`;
  }
  cityRecords[city.id] = record;
  if ((index + 1) % 10 === 0 || index + 1 === cities.length) {
    console.log(`Wikipedia geosearch ${index + 1}/${cities.length} cities`);
  }
  if (index + 1 < cities.length) await localDelay(1250);
}

function distanceKm(lat1, lng1, lat2, lng2) {
  const radians = value => value * Math.PI / 180;
  const dLat = radians(lat2 - lat1), dLng = radians(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const newGeoNamesSource = {
  provider: "GeoNames", dataset: "cities500.zip", snapshotDate, license: "CC BY 4.0",
  sourceUrl: "https://www.geonames.org/export/"
};
const geoNamesPath = path.join(root, "src/data/cityGeonamesExpansion.js");
fs.writeFileSync(geoNamesPath,
  `// Additional exact-name GeoNames matches for cities absent from the original snapshot.\n` +
  `// Dataset: cities500.zip, downloaded ${snapshotDate}; CC BY 4.0.\n` +
  `window.CITY_GEONAMES_SOURCE = window.CITY_GEONAMES_SOURCE || ${JSON.stringify(newGeoNamesSource)};\n` +
  `window.CITY_GEONAMES = { ...window.CITY_GEONAMES, ...${JSON.stringify(newCoordinates, null, 2)} };\n`, "utf8");

const catalogPath = path.join(root, "src/data/cityPlacesCatalog.js");
fs.writeFileSync(catalogPath,
  `// Wikipedia geosearch snapshot (${snapshotDate}); excerpts licensed CC BY-SA 4.0.\n` +
  `// Each place carries its article URL, page ID, coordinates, distance and source label.\n` +
  `window.CITY_PLACES_CATALOG = ${JSON.stringify({ snapshotDate, provider: "English Wikipedia geosearch", radiusKm: 10, license: "CC BY-SA 4.0", cities: cityRecords }, null, 2)};\n`, "utf8");

const auditPath = path.join(root, "docs/city-research-2026-11-20.md");
fs.mkdirSync(path.dirname(auditPath), { recursive: true });
const auditRows = cities.map(city => {
  const record = cityRecords[city.id];
  const coordinate = allCoordinates[city.id];
  return `| ${city.id} | ${coordinate.provider || "GeoNames"} | ${coordinate.geonameId} | ${record.places.length} | ${record.queryStatus} |`;
});
const placeTotal = Object.values(cityRecords).reduce((sum, record) => sum + record.places.length, 0);
const citiesWithPlaces = Object.values(cityRecords).filter(record => record.places.length).length;
const noStaticPlaces = cities.filter(city => cityRecords[city.id].places.length === 0).map(city => city.id);
const failedCities = cities.filter(city => cityRecords[city.id].queryStatus !== "ok").map(city => city.id);
const audit = `# 200 城資料查核紀錄（${snapshotDate}）\n\n` +
  `城市總數：${cities.length}；GeoNames 座標：${Object.keys(allCoordinates).length}；` +
  `Wikipedia 有座標景點：${placeTotal} 筆、涵蓋 ${citiesWithPlaces} 城。\n\n` +
  `採用 GeoNames exact-name/explicit-alias 配對並核對國碼。景點收錄條件：英文 Wikipedia 地理搜尋 10 公里內、文章本身有座標與摘要，且分類符合博物館、歷史文化、宗教建築、地標、街區或自然地點；相同名稱且相距 350 公尺內會去重。這是可追溯的百科／地理目錄快照，不代表營業狀態或官方推薦。\n\n` +
  `沒有靜態景點條目的城市（${noStaticPlaces.length}）：${noStaticPlaces.join(", ") || "無"}。` +
  `查詢失敗城市（${failedCities.length}）：${failedCities.join(", ") || "無"}。` +
  `前端仍可從 OpenStreetMap 與 Wikidata 取得即時補充資料；不以空白硬補或推測景點。\n\n` +
  `GeoNames CC BY 4.0：[資料下載與授權](https://www.geonames.org/export/)。` +
  ` Wikipedia 摘要 CC BY-SA 4.0；每筆資料連回來源文章，作者與頁面歷史可由來源頁查閱。` +
  ` 查詢方式：[MediaWiki Geosearch API](https://www.mediawiki.org/wiki/API:Geosearch)。\n\n` +
  `| 城市 ID | 座標來源 | GeoNames ID | 景點筆數 | 查詢狀態 |\n|---|---|---:|---:|---|\n${auditRows.join("\n")}\n`;
fs.writeFileSync(auditPath, audit, "utf8");
console.log(JSON.stringify({
  cityCount: cities.length, coordinateCount: Object.keys(allCoordinates).length,
  newlyMatchedCoordinates: Object.keys(newCoordinates).length,
  citiesWithPlaces, placeCount: placeTotal, noStaticPlaces, failedCities,
  outputs: [geoNamesPath, catalogPath, auditPath]
}, null, 2));
