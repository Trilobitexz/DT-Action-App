import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = relative => fs.readFile(path.join(root, relative), "utf8");
const window = {};
vm.runInNewContext(await read("src/js/services/spotTextService.js"), { window }, { filename: "src/js/services/spotTextService.js" });
const isTravelAttraction = spot => window.SpotTextService?.isTravelAttraction(spot) ?? true;
// Evaluate the browser data files in their dependency order inside a sandbox.
const loadTravelData = async () => {
  for (const relative of [
    "src/data/travelData.js", "src/data/countries/asia.js", "src/data/countries/europe.js",
    "src/data/countries/others.js", "src/data/globalCities.js", "src/data/cityCatalogExpansion.js",
    "src/data/cityGeonames.js", "src/data/cityEnrichment.js"
  ]) {
    vm.runInNewContext(await read(relative), { window }, { filename: relative });
  }
};

const outputPath = path.join(root, "scripts", "data", "prebuilt-spots.json");
const timeoutMs = 15000;
const wikiGapMs = 250;
const nominatimGapMs = 1100;
const wikidataGapMs = 1100;
let nextWikiRequestAt = 0;
let nextNominatimRequestAt = 0;
let nextWikidataRequestAt = 0;
const pauseUntil = async (timestamp) => {
  const waitMs = timestamp - Date.now();
  if (waitMs > 0) await new Promise(resolve => setTimeout(resolve, waitMs));
};
const throttleWiki = async () => {
  await pauseUntil(nextWikiRequestAt);
  nextWikiRequestAt = Date.now() + wikiGapMs;
};
const throttleNominatim = async () => {
  await pauseUntil(nextNominatimRequestAt);
  nextNominatimRequestAt = Date.now() + nominatimGapMs;
};
const throttleWikidata = async () => {
  await pauseUntil(nextWikidataRequestAt);
  nextWikidataRequestAt = Date.now() + wikidataGapMs;
};
const validCoordinate = (lat, lng) =>
  Number.isFinite(lat) && Number.isFinite(lng)
  && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
  && !(lat === 0 && lng === 0);
const distanceKm = (a, b) => {
  const radians = Math.PI / 180;
  const dLat = (b.lat - a.lat) * radians;
  const dLng = (b.lng - a.lng) * radians;
  const value = Math.sin(dLat / 2) ** 2
    + Math.cos(a.lat * radians) * Math.cos(b.lat * radians) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};
const displayName = value => window.SpotTextService?.toTraditional(value) || String(value || "");
const normalize = value => displayName(value).normalize("NFKC").trim().toLocaleLowerCase()
  .replace(/[\s\p{P}]+/gu, "");
const isCityItself = (city, spot) => {
  const name = normalize(spot?.name);
  return Boolean(name && [city?.id, city?.name, city?.englishName].some(alias => normalize(alias) === name));
};
const categoryFor = (text, language) => {
  if (/(museum|gallery|博物館|美術館|藝術館|紀念館)/i.test(text)) return "博物館與藝術";
  if (/(park|garden|botanical|waterfall|mountain|beach|island|nature reserve|公園|花園|植物園|瀑布|山岳|海灘|自然保護區)/i.test(text)) return "公園與自然";
  if (/(temple|church|mosque|cathedral|monastery|shrine|寺|廟|教堂|清真寺|修道院|神社)/i.test(text)) return "宗教建築";
  if (/(historic|heritage|archaeolog|castle|palace|fort|monument|memorial|歷史|古蹟|遺址|城堡|宮殿|紀念碑|文化遺產)/i.test(text)) return "歷史與文化遺產";
  if (/(district|square|plaza|market|街區|廣場|市集|市場)/i.test(text)) return "街區與市集";
  if (language === "zh") return "地標與建築";
  return "地標與建築";
};
const attractionSignal = /(tourist attraction|museum|gallery|monument|memorial|park|garden|temple|church|mosque|cathedral|castle|palace|historic|heritage|archaeolog|landmark|monastery|shrine|square|bridge|tower|theatre|theater|zoo|aquarium|fort|beach|waterfall|mountain|botanical|island|cave|stadium|opera|library|market|plaza|building|protected area|博物館|美術館|公園|花園|寺|廟|教堂|清真寺|紀念館|紀念碑|遺址|古蹟|遺產|城堡|宮殿|廣場|橋|塔|動物園|水族館|海灘|瀑布|山|植物園|洞穴|歌劇院|圖書館|市集|市場|街區|地標|建築|神社|修道院)/i;
const nonAttractionSignal = /(railway station|train station|metro station|subway station|bus station|railway line|railway company|airport|residential building|office building|shopping mall|department store|university department|electoral district|municipality|county|province|university|college|school|central bank|headquarters|administrative division|車站|地鐵站|鐵路線|公車站|住宅大樓|辦公大樓|購物中心|百貨公司|大學院系|行政區|行政区|區政府|区政府|中央銀行|中央银行)/i;
const requestJson = async (url, label) => {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "journey-atla-city-catalog/1.0 (+https://github.com/trilobitexz/journey-atla)"
    },
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) throw new Error(`${label} HTTP ${response.status}`);
  return response.json();
};

async function resolveCityCoordinates(city) {
  if (validCoordinate(city.lat, city.lng)) return { lat: city.lat, lng: city.lng, sourceUrl: city.coordinateSource?.sourceUrl || "" };
  const gazetteer = window.CITY_GEONAMES?.[city.id];
  if (validCoordinate(gazetteer?.lat, gazetteer?.lng)) {
    return { lat: Number(gazetteer.lat), lng: Number(gazetteer.lng), sourceUrl: gazetteer.sourceUrl || "https://www.geonames.org/" };
  }
  await throttleNominatim();
  const params = new URLSearchParams({
    q: [city.englishName || city.name, city.countryName].filter(Boolean).join(", "),
    format: "jsonv2", limit: "5", addressdetails: "1", "accept-language": "en"
  });
  const results = await requestJson(`https://nominatim.openstreetmap.org/search?${params}`, "Nominatim");
  const wantedName = normalize(city.englishName || city.name);
  const candidates = results.map(result => ({
    lat: Number(result.lat), lng: Number(result.lon),
    importance: Number(result.importance) || 0,
    type: String(result.type || ""),
    nameMatch: normalize(result.name) === wantedName
      || normalize(result.address?.city || result.address?.town || result.address?.municipality || "") === wantedName,
    countryCode: String(result.address?.country_code || "").toUpperCase(),
    sourceUrl: result.osm_id ? `https://www.openstreetmap.org/${result.osm_type}/${result.osm_id}` : "https://www.openstreetmap.org/"
  })).filter(result => validCoordinate(result.lat, result.lng));
  const inCountry = city.countryCode
    ? candidates.filter(result => result.countryCode === String(city.countryCode).toUpperCase())
    : candidates;
  const match = inCountry.sort((a, b) => Number(b.nameMatch) - Number(a.nameMatch)
    || b.importance - a.importance)[0];
  if (!match) return null;
  return { lat: match.lat, lng: match.lng, sourceUrl: match.sourceUrl };
}

async function fetchWikipediaSpots(city, language) {
  await throttleWiki();
  const params = new URLSearchParams({
    action: "query", generator: "geosearch",
    // Wikimedia geosearch currently caps ggsradius at 10 km; results are still
    // validated against the requested 50 km city-area boundary below.
    ggscoord: `${city.lat}|${city.lng}`, ggsradius: "10000", ggslimit: "100", ggsnamespace: "0",
    prop: "coordinates|extracts|pageimages|categories|info", exintro: "1", explaintext: "1",
    exsentences: "3", cllimit: "30", clshow: "!hidden", piprop: "thumbnail", pithumbsize: "600",
    inprop: "url", format: "json", formatversion: "2", origin: "*",
    ...(language === "zh" ? { variant: "zh-tw" } : {})
  });
  const data = await requestJson(`https://${language}.wikipedia.org/w/api.php?${params}`, `${language} Wikipedia`);
  if (data.error) throw new Error(`Wikipedia API ${data.error.code}: ${data.error.info}`);
  return (data.query?.pages || []).map(page => {
    const coordinates = page.coordinates?.[0];
    const lat = Number(coordinates?.lat);
    const lng = Number(coordinates?.lon);
    const name = String(page.title || "").trim();
    const summary = String(page.extract || "").replace(/\s+/g, " ").trim();
    const categories = (page.categories || []).map(item => item.title || "").join(" ");
    if (!name || !validCoordinate(lat, lng)
      || nonAttractionSignal.test(`${name} ${categories}`)
      || !attractionSignal.test(`${name} ${categories} ${summary}`)
      || !isTravelAttraction({ name, category: categories, summary })) return null;
    const distance = distanceKm(city, { lat, lng });
    if (distance > 50) return null;
    const articlePath = encodeURIComponent(name.replaceAll(" ", "_"));
    return {
      name,
      englishName: language === "en" ? name : "",
      lat, lng,
      category: categoryFor(`${name} ${categories}`, language),
      summary,
      note: summary,
      description: summary,
      imageUrl: page.thumbnail?.source || "",
      imageSourceUrl: page.fullurl || `https://${language}.wikipedia.org/wiki/${articlePath}`,
      sourceUrl: page.fullurl || `https://${language}.wikipedia.org/wiki/${articlePath}`,
      sourceLabel: `${language === "zh" ? "中文" : "English"} Wikipedia geosearch`,
      distanceKm: Math.round(distance * 100) / 100
    };
  }).filter(Boolean).sort((a, b) => a.distanceKm - b.distanceKm);
}

async function fetchWikidataSpots(city) {
  await throttleWikidata();
  const query = `SELECT DISTINCT ?item ?itemLabel ?itemDescription ?coordinate ?image ?article ?typeLabel ?distance WHERE {
    SERVICE wikibase:around {
      ?item wdt:P625 ?coordinate.
      bd:serviceParam wikibase:center "Point(${city.lng} ${city.lat})"^^geo:wktLiteral;
        wikibase:radius "50";
        wikibase:distance ?distance.
    }
    VALUES ?type { wd:Q570116 wd:Q33506 wd:Q839954 wd:Q4989906 wd:Q22698 wd:Q167346 wd:Q2977 wd:Q12280 wd:Q483110 wd:Q55488 wd:Q3331189 }
    ?item wdt:P31 ?type.
    OPTIONAL { ?item wdt:P18 ?image. }
    OPTIONAL { ?article schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>. }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "zh,en". }
  }
  ORDER BY ?distance
  LIMIT 50`;
  const params = new URLSearchParams({ query, format: "json" });
  const data = await requestJson(`https://query.wikidata.org/sparql?${params}`, "Wikidata");
  const seen = new Set();
  return (data.results?.bindings || []).map(binding => {
    const name = binding.itemLabel?.value || "";
    const match = /^Point\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)$/i.exec(binding.coordinate?.value || "");
    const lng = match ? Number(match[1]) : NaN;
    const lat = match ? Number(match[2]) : NaN;
    const distance = Number(binding.distance?.value);
    const itemUrl = binding.item?.value || "";
    if (!name || !validCoordinate(lat, lng) || !Number.isFinite(distance) || distance > 50
      || !itemUrl || seen.has(itemUrl)) return null;
    seen.add(itemUrl);
    const sourceUrl = binding.article?.value || itemUrl;
    const imageUrl = binding.image?.value
      ? `${binding.image.value.replace(/^http:/i, "https:")}${binding.image.value.includes("?") ? "&" : "?"}width=600`
      : "";
    const summary = binding.itemDescription?.value || "";
    return {
      name, englishName: "", lat, lng,
      category: categoryFor(binding.typeLabel?.value || "", "en"),
      summary, note: summary, description: summary,
      imageUrl, imageSourceUrl: binding.image?.value || sourceUrl,
      sourceUrl, sourceLabel: "Wikidata geospatial query",
      distanceKm: Math.round(distance * 100) / 100
    };
  }).filter(Boolean);
}

async function enrichCity(city, previous = null) {
  const coordinates = await resolveCityCoordinates(city).catch(error => {
    console.warn(`城市座標查詢失敗（${city.id}）：${error.message}`);
    return null;
  }) || (validCoordinate(Number(previous?.lat), Number(previous?.lng))
    ? { lat: Number(previous.lat), lng: Number(previous.lng), sourceUrl: previous.coordinateSource || "" }
    : null);
  if (!coordinates) return { id: city.id, name: city.name, englishName: city.englishName, countryName: city.countryName, lat: null, lng: null, spots: [] };
  const normalizedCity = { ...city, lat: coordinates.lat, lng: coordinates.lng };
  const collected = [];
  const seen = new Set();
  const appendUnique = spots => spots.forEach(rawSpot => {
    const spot = window.SpotTextService?.normalizeSpot(rawSpot) || rawSpot;
    const key = normalize(spot.name);
    if (!key || seen.has(key) || isCityItself(city, spot) || !validCoordinate(spot.lat, spot.lng)
      || !isTravelAttraction(spot) || distanceKm(normalizedCity, spot) > 50
      || !/^https?:\/\//i.test(spot.sourceUrl || "")) return;
    seen.add(key);
    collected.push(spot);
  });
  appendUnique(previous?.spots || []);
  try {
    appendUnique(await fetchWikipediaSpots(normalizedCity, "zh"));
  } catch (error) {
    console.warn(`中文 Wikipedia 查詢失敗（${city.id}）：${error.message}`);
  }
  if (collected.length < 3) {
    try {
      appendUnique(await fetchWikipediaSpots(normalizedCity, "en"));
    } catch (error) {
      console.warn(`English Wikipedia 查詢失敗（${city.id}）：${error.message}`);
    }
  }
  if (collected.length < 3) {
    try {
      appendUnique(await fetchWikidataSpots(normalizedCity));
    } catch (error) {
      console.warn(`Wikidata 查詢失敗（${city.id}）：${error.message}`);
    }
  }
  return {
    id: city.id,
    name: city.name || city.englishName || city.id,
    englishName: city.englishName || "",
    countryName: city.countryName || "",
    countryCode: city.countryCode || "",
    lat: normalizedCity.lat,
    lng: normalizedCity.lng,
    coordinateSource: coordinates.sourceUrl,
    spots: collected.slice(0, 5)
  };
}

await loadTravelData();
const cities = window.TRAVEL_DATA?.globalCities || [];
const outputCities = [];
const retryIncompleteOnly = process.argv.includes("--retry-incomplete");
let existingById = new Map();
if (retryIncompleteOnly) {
  try {
    const previous = JSON.parse(await fs.readFile(outputPath, "utf8"));
    existingById = new Map((previous.cities || []).map(city => [city.id, city]));
  } catch (error) {
    console.warn("找不到先前的預建資料，將重新查詢全部城市。");
  }
}
for (const city of cities) {
  if (!city?.id) continue;
  const previous = existingById.get(city.id);
  const previousSpots = (previous?.spots || []).map(spot => window.SpotTextService?.normalizeSpot(spot) || spot)
    .filter(spot => !isCityItself(city, spot) && validCoordinate(Number(spot.lat), Number(spot.lng))
      && distanceKm(previous, { lat: Number(spot.lat), lng: Number(spot.lng) }) <= 50 && isTravelAttraction(spot));
  const previousValidSpots = previousSpots;
  const previousIsComplete = previousValidSpots.length >= 3
    && validCoordinate(previous.lat, previous.lng);
  const filteredPrevious = previous ? { ...previous, spots: previousSpots } : null;
  outputCities.push(retryIncompleteOnly && previousIsComplete
    ? filteredPrevious
    : await enrichCity(city, filteredPrevious));
  console.log(`[${outputCities.length}/${cities.length}] ${city.name || city.id}: ${outputCities.at(-1).spots.length} 筆符合條件`);
}

const insufficientCities = outputCities.filter(city => city.spots.filter(spot => validCoordinate(spot.lat, spot.lng)
  && distanceKm(city, spot) <= 50 && isTravelAttraction(spot)).length < 3).map(city => ({
  id: city.id, name: city.name, spotCount: city.spots.filter(spot => validCoordinate(spot.lat, spot.lng)
    && distanceKm(city, spot) <= 50 && isTravelAttraction(spot)).length,
  reason: !validCoordinate(city.lat, city.lng) ? "缺少可驗證的城市座標" : "公開百科資料不足三筆符合條件的景點"
}));
const report = {
  generatedAt: new Date().toISOString(),
  source: "Chinese and English Wikipedia geosearch with Wikidata fallback; city coordinates from project gazetteer or Nominatim",
  validation: { minimumSpotsPerCity: 3, maximumSpotsPerCity: 5, maximumDistanceKm: 50, rejectsOnlyNullIslandCoordinates: true, excludesNonVisitPages: true },
  cityCount: outputCities.length,
  successfulCityCount: outputCities.length - insufficientCities.length,
  insufficientCities,
  cities: outputCities
};
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log("\n景點離線補齊統計");
console.log(`總城市數：${report.cityCount}`);
console.log(`符合至少 3 筆景點：${report.successfulCityCount}`);
console.log(`不足 3 筆：${insufficientCities.length}`);
if (insufficientCities.length) {
  insufficientCities.forEach(city => console.log(`- ${city.name} (${city.id})：${city.spotCount} 筆；${city.reason}`));
  console.log("未達三筆的城市會保留在 JSON 報告中，但預設匯入腳本將拒絕不完整資料。");
}
console.log(`輸出檔案：${path.relative(root, outputPath)}`);
