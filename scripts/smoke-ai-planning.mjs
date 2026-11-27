import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let storedItineraryJson = null;
const sandbox = {
  window: {
    TRAVEL_DATA: { globalCities: [], countries: [], globalCityAliases: {} },
    setTimeout,
    clearTimeout
  },
  document: { scripts: [], baseURI: "https://journey-atlas.invalid/" },
  location: { href: "https://journey-atlas.invalid/" },
  localStorage: {
    getItem: key => key === "journey-atlas-itineraries" ? storedItineraryJson : null,
    setItem: (key, value) => { if (key === "journey-atlas-itineraries") storedItineraryJson = value; }
  },
  URL,
  URLSearchParams,
  console,
  setTimeout,
  clearTimeout
};

for (const relative of [
  "src/data/cityGeonames.js",
  "src/data/cityCoordinates.js",
  "src/js/services/spotTextService.js",
  "src/js/modules/plannerView.js",
  "src/js/modules/countryView.js",
  "src/js/services/spotService.js",
  "src/js/services/cityCatalogService.js"
]) {
  vm.runInNewContext(fs.readFileSync(path.join(root, relative), "utf8"), sandbox, { filename: relative });
}

const itinerarySpots = [
  { name: "Riverside Garden", category: "自然與景觀", description: "A botanical garden preserves rare plants and offers shaded walking paths for visitors.", sourceUrl: "https://example.org/riverside-garden" },
  { name: "Central Museum", category: "博物館", description: "This museum preserves regional history through permanent galleries and public exhibitions.", sourceUrl: "https://example.org/central-museum" }
];
const itineraryCity = { id: "itinerary-key-test", name: "測試城市", spots: itinerarySpots };
const reorderedItineraryCity = { ...itineraryCity, spots: [...itinerarySpots].reverse() };
const emptyDays = Array.from({ length: 5 }, () => []);
const aiMeta = Array.from({ length: 5 }, () => ({ theme: "城市探索", note: "預留交通時間。" }));
storedItineraryJson = JSON.stringify({
  "itinerary-key-test": {
    5: [[0], ...emptyDays.slice(1)],
    "5SpotKeys": [["riversidegarden"], ...emptyDays.slice(1)],
    "5Meta": aiMeta
  }
});
const remappedItinerary = sandbox.window.PlannerView.getItinerary(reorderedItineraryCity, 5);
if (remappedItinerary[0][0] !== 1 || sandbox.window.PlannerView.getItineraryIdentityWarning(reorderedItineraryCity, 5)) {
  throw new Error("A saved itinerary did not follow its attraction after the catalog order changed.");
}
storedItineraryJson = JSON.stringify({
  "itinerary-key-test": { 5: [[0], ...emptyDays.slice(1)], "5Meta": aiMeta }
});
if (sandbox.window.PlannerView.getItinerary(itineraryCity, 5).some(day => day.length)
  || !sandbox.window.PlannerView.getItineraryIdentityWarning(itineraryCity, 5).includes("舊版 AI 行程")
  || !sandbox.window.PlannerView.getItineraryText(itineraryCity, 5).includes("舊版 AI 行程")) {
  throw new Error("A legacy AI itinerary without attraction identities was not safely withheld.");
}
storedItineraryJson = JSON.stringify({ "itinerary-key-test": { 3: [[1], [], []] } });
if (sandbox.window.PlannerView.getItinerary(itineraryCity, 3).some(day => day.length)
  || !sandbox.window.PlannerView.getItineraryIdentityWarning(itineraryCity, 3).includes("舊版手動行程")
  || !sandbox.window.PlannerView.getItineraryText(itineraryCity, 3).includes("舊版手動行程")) {
  throw new Error("A legacy manual itinerary without attraction identities was not safely withheld.");
}
storedItineraryJson = JSON.stringify({ "itinerary-key-test": { 3: [[1], [], []], "3SpotKeys": [] } });
if (sandbox.window.PlannerView.getItinerary(itineraryCity, 3).some(day => day.length)
  || !sandbox.window.PlannerView.getItineraryIdentityWarning(itineraryCity, 3).includes("舊版手動行程")) {
  throw new Error("A malformed itinerary identity map was trusted as a valid mapping.");
}
storedItineraryJson = JSON.stringify({
  "itinerary-key-test": {
    5: [[0], ...emptyDays.slice(1)],
    "5SpotKeys": [["removedattraction"], ...emptyDays.slice(1)],
    "5Meta": aiMeta
  }
});
if (sandbox.window.PlannerView.getItinerary(itineraryCity, 5).some(day => day.length)
  || !sandbox.window.PlannerView.getItineraryIdentityWarning(itineraryCity, 5).includes("目前不在資料清單中")
  || !sandbox.window.PlannerView.getItineraryText(itineraryCity, 5).includes("目前不在資料清單中")) {
  throw new Error("A removed attraction was silently replaced by a different catalog index.");
}
storedItineraryJson = null;
sandbox.window.PlannerView.saveItinerary(reorderedItineraryCity, 5, [[null, "1", 1.5, 1], ...emptyDays.slice(1)]);
const savedIdentity = JSON.parse(storedItineraryJson)?.["itinerary-key-test"]?.["5SpotKeys"]?.[0]?.[0];
const savedIndexes = JSON.parse(storedItineraryJson)?.["itinerary-key-test"]?.[5]?.[0];
if (savedIdentity !== "riversidegarden" || savedIndexes?.length !== 1 || savedIndexes[0] !== 1) {
  throw new Error("Saving an itinerary did not persist a stable identity or reject corrupt indexes.");
}

const prebuiltPath = path.join(root, "scripts", "data", "prebuilt-spots.json");
const prebuilt = JSON.parse(fs.readFileSync(prebuiltPath, "utf8"));
const unattributedPhotos = (prebuilt.cities || []).flatMap(city => (city.spots || [])
  .filter(spot => {
    const hasImage = Boolean(String(spot.imageUrl || "").trim());
    const hasAttribution = Boolean(String(spot.imageAttribution || "").trim());
    const hasLicense = Boolean(String(spot.imageLicense || "").trim());
    const hasFilePage = /^https:\/\//i.test(String(spot.imageSourceUrl || ""));
    return hasImage && (!hasAttribution || !hasLicense || !hasFilePage);
  })
  .map(spot => `${city.id}/${spot.name}`));
if (unattributedPhotos.length) {
  throw new Error(`Wikimedia photos are missing author, license or file-page attribution: ${unattributedPhotos.slice(0, 20).join(", ")}`);
}
const imageAttributionExamples = [
  ["manila", "聖地牙哥堡"],
  ["manila", "黎剎公園"],
  ["phuket", "普吉大佛"],
  ["las-vegas", "拉斯維加斯大道"]
];
for (const [cityId, name] of imageAttributionExamples) {
  const spot = prebuilt.cities.find(city => city.id === cityId)?.spots.find(item => item.name === name);
  let imageUrl;
  let imageSourceUrl;
  try {
    imageUrl = new URL(String(spot?.imageUrl || ""));
    imageSourceUrl = new URL(String(spot?.imageSourceUrl || ""));
  } catch (error) {
    throw new Error(`A Wikimedia photo is missing a usable image or source URL: ${cityId}/${name}`);
  }
  if (imageUrl.protocol !== "https:" || !/^(?:thumb|upload)\.wikimedia\.org$/i.test(imageUrl.hostname)
    || imageSourceUrl.protocol !== "https:" || imageSourceUrl.hostname !== "commons.wikimedia.org"
    || !String(spot.imageAttribution || "").includes("CC BY")) {
    throw new Error(`A Wikimedia photo is missing Commons attribution or licensing: ${cityId}/${name}`);
  }
}
const attributionLabel = sandbox.getSpotImageAttributionText({ imageAttribution: "Photographer · CC BY 4.0" });
if (attributionLabel !== "圖片來源：Photographer · CC BY 4.0") {
  throw new Error("Spot image source labels did not show photographer and licence attribution.");
}
const spotService = sandbox.window.SpotService;
const originalRequestJson = spotService.requestJson;
spotService.requestJson = async () => ({ query: { pages: [{
  title: "File:Verified Garden.jpg",
  imageinfo: [{ extmetadata: {
    Artist: { value: "<a href=\"https://commons.wikimedia.org/wiki/User:Example\">Example Photographer</a>" },
    LicenseShortName: { value: "CC BY-SA 4.0" },
    LicenseUrl: { value: "https://creativecommons.org/licenses/by-sa/4.0/" },
    AttributionRequired: { value: "true" }
  } }]
}] } });
const liveImageAttribution = await spotService.fetchWikimediaImageMetadata(
  "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Verified_Garden.jpg/500px-Verified_Garden.jpg"
);
spotService.requestJson = originalRequestJson;
if (liveImageAttribution?.imageArtist !== "Example Photographer"
  || liveImageAttribution?.imageLicense !== "CC BY-SA 4.0"
  || liveImageAttribution?.imageSourceUrl !== "https://commons.wikimedia.org/wiki/File:Verified_Garden.jpg") {
  throw new Error("Live Wikimedia image lookup did not preserve author, license and file-page source.");
}
if (spotService.formatWikimediaImageAttribution({
  Artist: { value: "Unverified Photographer" }, AttributionRequired: { value: "true" }
}, "File:Unlicensed.jpg", "https://commons.wikimedia.org") !== null) {
  throw new Error("An image without a verified license was treated as displayable.");
}
const attributedFort = prebuilt.cities.find(city => city.id === "manila")?.spots.find(spot => spot.name === "聖地牙哥堡");
const cloudFort = {
  name: "聖地牙哥堡",
  imageUrl: "https://example.org/older-preview.jpg",
  imageSourceUrl: "https://en.wikipedia.org/wiki/Fort_Santiago"
};
const mergedFort = sandbox.window.CityCatalogService.mergeSpots([cloudFort], [attributedFort])[0];
if (mergedFort?.imageAttribution !== attributedFort?.imageAttribution
  || mergedFort?.imageUrl !== attributedFort?.imageUrl
  || mergedFort?.imageSourceUrl !== attributedFort?.imageSourceUrl) {
  throw new Error("Cloud/local spot merging discarded Commons photo attribution or its linked image.");
}

const cityCandidates = [];
if (typeof sandbox.window.SpotTextService.isCompleteAIPlanningSpot !== "function") {
  throw new Error("The shared AI candidate completeness validator is missing.");
}
for (const city of prebuilt.cities || []) {
  const candidates = sandbox.window.PlannerView.rankAIPlanningSpots(city, 3).map(item => item.spot);
  const invalid = candidates.find(spot => !sandbox.window.SpotTextService.isCompleteAIPlanningSpot(spot));
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
const completeAIExample = {
  name: "Central Museum",
  category: "博物館",
  lat: 35.6,
  lng: 139.7,
  description: "This museum preserves regional history through permanent galleries and public exhibitions.",
  sourceUrl: "https://example.org/central-museum"
};
if (!sandbox.window.SpotTextService.isCompleteAIPlanningSpot(completeAIExample)) {
  throw new Error("A complete sourced attraction was rejected by the shared AI validator.");
}
if (!sandbox.window.SpotTextService.validateAIPlanningSpots([completeAIExample], 1).valid
  || sandbox.window.SpotTextService.validateAIPlanningSpots([completeAIExample], 2).code !== "ai/insufficient-sourced-spots"
  || sandbox.window.SpotTextService.validateAIPlanningSpots([], 1).code !== "ai/no-spots") {
  throw new Error("AI request validation did not enforce candidate presence and per-day availability.");
}
const incompleteAIExamples = [
  { ...completeAIExample, sourceUrl: "javascript:alert(1)" },
  { ...completeAIExample, lat: 0, lng: 0 },
  { ...completeAIExample, description: "A short museum summary." },
  { ...completeAIExample, isSearchSuggestion: true },
  { ...genericStation, lat: 35.6, lng: 139.7, sourceUrl: "https://example.org/station" }
];
if (incompleteAIExamples.some(spot => sandbox.window.SpotTextService.isCompleteAIPlanningSpot(spot))) {
  throw new Error("The shared AI validator accepted an incomplete, unsafe, suggested or non-attraction candidate.");
}
if (incompleteAIExamples.some(spot => sandbox.window.SpotTextService.validateAIPlanningSpots([spot], 1).code !== "ai/incomplete-spots")) {
  throw new Error("AI request validation allowed an incomplete candidate to reach the model boundary.");
}
const visitorSiteRegressions = [
  {
    name: "五稜郭",
    category: "歷史與文化遺產",
    summary: "這座星形要塞在規劃興建時便已使用五稜郭作為名稱；現存城跡是函館的重要歷史景點。"
  },
  {
    name: "藝術宮 (墨西哥城)",
    category: "地標與建築",
    summary: "藝術宮是墨西哥城的文化中心，建築工程曾中止，後續復工並於 1934 年落成。"
  },
  {
    name: "聖保羅主教座堂",
    category: "地標與建築",
    summary: "聖保羅主教座堂是巴西聖保羅市中心的重要宗教建築與觀光地標。"
  },
  {
    name: "市政廳鐘樓 (克拉科夫)",
    category: "地標與建築",
    summary: "這座鐘樓是克拉科夫舊市政廳僅存的部分，位於中央集市廣場。"
  }
];
for (const spot of visitorSiteRegressions) {
  if (!sandbox.window.SpotTextService.isTravelAttraction(spot)) {
    throw new Error(`A surviving historic visitor site was rejected: ${spot.name}`);
  }
}
const nonVisitorRegressions = [
  { name: "Tohoku University", summary: "Tohoku University is a national research university in Sendai." },
  { name: "Blackwater Baghdad shooting", category: "shooting event", summary: "A shooting incident." },
  { name: "Pa Ko Dam", summary: "Pa Ko Dam is a village and tambon (subdistrict) in Thailand." },
  { name: "Chembur", summary: "Chembur is an upmarket large suburb in central Mumbai." },
  { name: "Iceland Express", summary: "Iceland Express was a low-fare airline headquartered in Reykjavík." },
  { name: "Dubailand", summary: "Dubailand was an entertainment complex planned to be built in Dubai." },
  { name: "The Rumble in the Jungle", summary: "George Foreman vs. Muhammad Ali, billed as The Rumble in the Jungle, was a heavyweight championship boxing match on October 30, 1974." },
  { name: "Dubai Science Park", summary: "Dubai Science Park is a science-focused business community." },
  { name: "Barumbu", summary: "Barumbu is a commune in the Lukunga District of Kinshasa." },
  { name: "People's Palace", summary: "People's Palace is a building and headquarters of the parliament of the Democratic Republic of the Congo." }
];
for (const spot of nonVisitorRegressions) {
  if (sandbox.window.SpotTextService.isTravelAttraction(spot)) {
    throw new Error(`A non-visitor page passed the visitor-site filter: ${spot.name}`);
  }
}

const service = sandbox.window.CityCatalogService;
const originalEnsureSpots = service.ensureSpots;
const makeCandidate = (name, sourceUrl, lat, lng, description = "A verified cultural attraction with a detailed description suitable for itinerary planning.") => ({
  name,
  category: "歷史與文化遺產",
  description,
  lat,
  lng,
  sourceUrl
});
const liveExpansionCity = {
  id: "candidate-expansion",
  name: "候選補充測試城市",
  spots: [1, 2, 3].map(index => makeCandidate(
    `Curated Plaza ${index}`,
    `https://example.org/curated/${index}`,
    35 + index / 100,
    139 + index / 100
  ))
};
let enrichmentStartedWith = 0;
service.ensureSpots = async (city, options) => {
  if (options?.forceRefresh !== true || options?.limit !== 100) {
    throw new Error("AI long-itinerary enrichment must explicitly refresh sourced city data.");
  }
  city.spots.push(...[1, 2, 3, 4].map(index => makeCandidate(
    `Live Museum ${index}`,
    `https://example.org/live/${index}`,
    35.1 + index / 100,
    139.1 + index / 100
  )));
  city.spots.push(makeCandidate("Unsourced live record", "javascript:alert(1)", 35.2, 139.2));
};
const expandedCandidates = await sandbox.window.PlannerView.loadAIPlanningCandidates(liveExpansionCity, 7, count => {
  enrichmentStartedWith = count;
});
service.ensureSpots = originalEnsureSpots;
if (enrichmentStartedWith !== 3 || expandedCandidates.length !== 7
  || expandedCandidates.some(item => !/^https?:$/.test(new URL(item.spot.sourceUrl).protocol)
    || String(item.spot.description || "").length < 40)) {
  throw new Error("Long itineraries did not enrich missing candidates while preserving AI source and description requirements.");
}
const incompleteExpansionCity = {
  id: "incomplete-expansion",
  name: "不完整補充資料測試城市",
  spots: liveExpansionCity.spots.slice(0, 3)
};
service.ensureSpots = async city => {
  city.spots.push(
    makeCandidate("No source record", "", 35.4, 139.4),
    makeCandidate("Short description record", "https://example.org/short", 35.5, 139.5, "Short."),
    makeCandidate("Invalid scheme record", "javascript:alert(1)", 35.6, 139.6)
  );
};
const stillIncompleteCandidates = await sandbox.window.PlannerView.loadAIPlanningCandidates(incompleteExpansionCity, 7);
service.ensureSpots = originalEnsureSpots;
if (stillIncompleteCandidates.length !== 3) {
  throw new Error("Incomplete live records were accepted when seven sourced candidates were still unavailable.");
}

const serviceMethods = {
  readSpotCache: service.readSpotCache,
  fetchPrebuiltSpots: service.fetchPrebuiltSpots,
  fetchCity: service.fetchCity,
  writeSpotCache: service.writeSpotCache
};
const previousSpotService = sandbox.window.SpotService;
const refreshCity = {
  id: "force-refresh-test",
  name: "強制補載測試城市",
  lat: 35,
  lng: 139,
  spots: Array.from({ length: 40 }, (_, index) => makeCandidate(
    `Existing landmark ${index + 1}`,
    `https://example.org/existing/${index + 1}`,
    35 + index / 1000,
    139 + index / 1000
  ))
};
let liveRefreshCalled = false;
service.spotCache.delete(refreshCity.id);
service.readSpotCache = async () => null;
service.fetchPrebuiltSpots = async () => [];
service.fetchCity = async () => ({ city: { lat: 35, lng: 139 }, spots: [] });
service.writeSpotCache = async () => {};
sandbox.window.SpotService = {
  fetchNearbyPlaces: async () => {
    liveRefreshCalled = true;
    return [];
  }
};
await service.ensureSpots(refreshCity, { limit: 100, forceRefresh: true });
service.readSpotCache = serviceMethods.readSpotCache;
service.fetchPrebuiltSpots = serviceMethods.fetchPrebuiltSpots;
service.fetchCity = serviceMethods.fetchCity;
service.writeSpotCache = serviceMethods.writeSpotCache;
service.spotCache.delete(refreshCity.id);
if (previousSpotService === undefined) delete sandbox.window.SpotService;
else sandbox.window.SpotService = previousSpotService;
if (!liveRefreshCalled) {
  throw new Error("Forced candidate refresh skipped live sources when 40 already-loaded spots were still insufficient for AI.");
}

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
      imageUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/test.jpg",
      imageSourceUrl: "https://commons.wikimedia.org/wiki/File%3ATest.jpg",
      imageAttribution: "Test photographer · CC BY 4.0",
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
  || cloudResult.spots.length !== 1 || cloudResult.spots[0].name !== "瑞光大金塔"
  || cloudResult.spots[0].imageAttribution !== "Test photographer · CC BY 4.0") {
  throw new Error("Firestore stale-center correction or invalid-coordinate filtering failed.");
}

const minimumCandidates = Math.min(...cityCandidates.map(city => city.count));
console.log(`AI candidate smoke check passed: ${cityCandidates.length} cities; minimum ${minimumCandidates} complete sourced candidates per city; generic station rejected.`);
console.log("Long-itinerary smoke check passed: valid live candidates fill shortages; missing sources and short descriptions remain excluded.");
console.log("Forced-refresh smoke check passed: live sources are retried even when 40 non-AI spots are cached.");
console.log("Image attribution smoke check passed: Commons source, author and licence display and survive cloud/local merges.");
console.log("Cloud catalog smoke check passed: stale Yangon center corrected; invalid-coordinate spot excluded.");
