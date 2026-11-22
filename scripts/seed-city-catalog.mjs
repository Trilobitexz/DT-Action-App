import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import admin from "firebase-admin";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");
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
].forEach(file => vm.runInNewContext(read(file), { window }, { filename: file }));

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || "dt-action-app";
const refreshWikipedia = process.argv.includes("--refresh-wikipedia");
admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId });
const db = admin.firestore();
const writer = db.bulkWriter();
try {
  await db.collection("cities").limit(1).get();
} catch (error) {
  throw new Error(`無法連線 Firebase 專案 ${projectId} 或缺少 Application Default Credentials。請先在管理者電腦執行 gcloud auth application-default login，並確認帳號有 Firestore 寫入權限。`, { cause: error });
}

const normalize = value => String(value || "").normalize("NFKC").trim().toLocaleLowerCase()
  .replace(/[\s\p{P}]+/gu, "");
const slug = value => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
  .normalize("NFKC").trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "").slice(0, 100) || "spot";
const distanceKm = (a, b) => {
  const radians = Math.PI / 180;
  const dLat = (b.lat - a.lat) * radians;
  const dLng = (b.lng - a.lng) * radians;
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * radians) * Math.cos(b.lat * radians)
    * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};
const attractionCategory = /tourist attraction|museum|gallery|monument|memorial|park|garden|temple|church|mosque|cathedral|castle|palace|historic|heritage|archaeolog|landmark|monastery|shrine|square|bridge|tower|theatre|theater|zoo|aquarium|fort|beach|waterfall|mountain|botanical|island|cave|stadium|opera|library|market|district|plaza|building|protected area/i;
const hasVerifiedSpotLocation = spot => spot?.lat !== null && spot?.lat !== undefined && spot?.lat !== ""
  && spot?.lng !== null && spot?.lng !== undefined && spot?.lng !== ""
  && Number.isFinite(Number(spot.lat))
  && Number(spot.lat) >= -90 && Number(spot.lat) <= 90
  && Number.isFinite(Number(spot?.lng)) && Number(spot.lng) >= -180 && Number(spot.lng) <= 180
  && /^https?:\/\//i.test(String(spot?.sourceUrl || spot?.pageUrl || spot?.url || ""));

async function fetchWikipediaSpots(city) {
  if (!Number.isFinite(city.lat) || !Number.isFinite(city.lng)) return [];
  const params = new URLSearchParams({
    action: "query", generator: "geosearch", ggscoord: `${city.lat}|${city.lng}`,
    ggsradius: "20000", ggslimit: "50", ggsnamespace: "0",
    prop: "coordinates|extracts|categories", exintro: "1", explaintext: "1",
    exsentences: "2", cllimit: "20", clshow: "!hidden", format: "json",
    formatversion: "2", origin: "*"
  });
  const response = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, {
    headers: { "User-Agent": "JourneyAtlasCityCatalog/3.0" },
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw new Error(`Wikipedia HTTP ${response.status}`);
  const data = await response.json();
  return (data.query?.pages || []).map(page => {
    const point = page.coordinates?.[0];
    const lat = Number(point?.lat);
    const lng = Number(point?.lon);
    if (!page.title || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const categories = (page.categories || []).map(item => String(item.title || "").replace(/^Category:/, ""));
    if (!categories.some(category => attractionCategory.test(category))) return null;
    const distance = distanceKm(city, { lat, lng });
    if (distance > 20) return null;
    const categoryText = categories.join(" ").toLowerCase();
    const category = /museum|gallery/i.test(categoryText) ? "博物館與藝術"
      : /park|garden|botanical|protected area|waterfall|mountain|beach|island|cave/i.test(categoryText) ? "公園與自然"
        : /temple|church|mosque|cathedral|monastery|shrine/i.test(categoryText) ? "宗教建築"
          : /historic|heritage|archaeolog|castle|palace|fort|monument|memorial/i.test(categoryText) ? "歷史與文化遺產"
            : /district|square|plaza|market/i.test(categoryText) ? "街區與市集" : "地標與建築";
    const sourceUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replaceAll(" ", "_"))}`;
    const description = String(page.extract || "").replace(/\s+/g, " ").trim();
    return {
      name: page.title, category, tag: "Wikipedia 地理景點", note: description,
      description, lat, lng, sourceUrl, sourceLabel: "English Wikipedia geosearch",
      distanceKm: Math.round(distance * 100) / 100
    };
  }).filter(Boolean).sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 20);
}

const cities = window.TRAVEL_DATA.globalCities || [];
let cityCount = 0;
let spotCount = 0;
let wikipediaCityCount = 0;
let failedWikipediaCount = 0;

for (const city of cities) {
  if (!city?.id) continue;
  // Unverified editorial names remain search/planning hints; publish only places with a source and coordinates.
  const localSpots = [...(city.spots || [])].filter(hasVerifiedSpotLocation);
  let wikipediaSpots = [];
  if (refreshWikipedia && localSpots.length < 8 && Number.isFinite(city.lat) && Number.isFinite(city.lng)) {
    try {
      wikipediaSpots = await fetchWikipediaSpots(city);
      if (wikipediaSpots.length) wikipediaCityCount += 1;
    } catch (error) {
      failedWikipediaCount += 1;
      console.warn(`Wikipedia 查詢失敗（${city.id}）：${error.message}`);
    }
  }
  const seen = new Set();
  const spots = [...localSpots, ...wikipediaSpots].filter(spot => {
    const name = typeof spot === "string" ? spot : spot?.name;
    const key = normalize(name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const cityDocument = {
    id: city.id,
    name: city.name || city.englishName || city.id,
    englishName: city.englishName || city.name || "",
    countryName: city.countryName || "",
    countryCode: city.countryCode || "",
    flag: city.flag || "",
    continentName: city.continentName || "",
    ...(Number.isFinite(city.lat) ? { lat: city.lat } : {}),
    ...(Number.isFinite(city.lng) ? { lng: city.lng } : {}),
    ...(city.descriptionSource?.text || city.description ? { description: city.descriptionSource?.text || city.description } : {}),
    ...(city.descriptionSource?.sourceLabel ? { sourceLabel: city.descriptionSource.sourceLabel } : {}),
    ...(city.descriptionSource?.pageUrl || city.coordinateSource?.sourceUrl ? { sourceUrl: city.descriptionSource?.pageUrl || city.coordinateSource?.sourceUrl } : {}),
    ...(city.coordinateSource?.sourceUrl ? { coordinateSourceUrl: city.coordinateSource.sourceUrl } : {}),
    ...(city.coordinateSource?.provider ? { coordinateSourceLabel: city.coordinateSource.provider } : {}),
    ...(spots.length ? {
      spotCount: spots.length,
      featuredSpotCount: spots.filter(spot => spot.isFeatured === true).length
    } : {}),
    catalogUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    publishedAt: admin.firestore.FieldValue.serverTimestamp(),
    dataVersion: "2026.11.23-city-catalog-v4"
  };
  writer.set(db.collection("cities").doc(city.id), cityDocument, { merge: true });
  cityCount += 1;

  spots.forEach((candidate, index) => {
    const spot = candidate;
    const name = String(spot.name || "").trim();
    if (!name) return;
    const id = `${String(index).padStart(3, "0")}-${slug(name)}`;
    writer.set(db.collection("cities").doc(city.id).collection("spots").doc(id), {
      index, name, englishName: spot.englishName || "",
      category: spot.category || "景點", tag: spot.tag || "",
      isFeatured: spot.isFeatured === true,
      featuredRank: Number.isInteger(spot.featuredRank) && spot.featuredRank >= 0 ? spot.featuredRank : null,
      note: spot.note || "", description: spot.description || spot.note || "",
      lat: Number.isFinite(spot.lat) ? spot.lat : null,
      lng: Number.isFinite(spot.lng) ? spot.lng : null,
      rating: Number.isFinite(spot.rating) && spot.rating >= 0 && spot.rating <= 5 && typeof spot.ratingSource === "string" && spot.ratingSource.trim() ? spot.rating : null,
      ratingSource: Number.isFinite(spot.rating) && spot.rating >= 0 && spot.rating <= 5 && typeof spot.ratingSource === "string" && spot.ratingSource.trim() ? spot.ratingSource.trim() : "",
      sourceUrl: spot.sourceUrl || spot.pageUrl || "",
      sourceLabel: spot.sourceLabel || "專案城市目錄",
      imageUrl: spot.imageUrl || spot.thumbnailUrl || "",
      imageSourceUrl: spot.imageSourceUrl || spot.imagePageUrl || "",
      website: spot.website || "", openingHours: spot.openingHours || "",
      closedDays: spot.closedDays || "",
      visitHours: Number.isFinite(spot.visitHours) && spot.visitHours > 0 ? spot.visitHours : null,
      address: spot.address || "",
      hasCoordinates: Number.isFinite(spot.lat) && Number.isFinite(spot.lng),
      hasDescription: Boolean(String(spot.description || spot.note || "").trim()),
      catalogUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      publishedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  });
  spotCount += spots.length;
}

await writer.close();
console.log(JSON.stringify({ projectId, cityCount, spotCount, wikipediaRefreshEnabled: refreshWikipedia, wikipediaCityCount, failedWikipediaCount }, null, 2));
