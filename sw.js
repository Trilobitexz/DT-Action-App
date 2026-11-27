const CACHE_NAME = "journey-atlas-shell-v115";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json?v=115",
  "./src/assets/app-icon.svg?v=115",
  "./src/css/style.css?v=115",
  "./src/js/pwa.js?v=115",
  "./src/js/app.js?v=115",
  "./src/js/map/geoContinents.js?v=115",
  "./src/js/map/mapManager.js?v=115",
  "./src/js/store/appStore.js?v=115",
  "./src/js/modules/continentView.js?v=115",
  "./src/js/modules/countryView.js?v=115",
  "./src/js/modules/globalCitiesView.js?v=115",
  "./src/js/modules/plannerView.js?v=115",
  "./src/js/modules/worldHighlightsView.js?v=115",
  "./src/js/firebase.js?v=115",
  "./src/js/firebase-ai-config.js?v=115",
  "./src/js/services/currencyService.js?v=115",
  "./src/js/services/spotTextService.js?v=115",
  "./src/js/services/nationalInfoService.js?v=115",
  "./src/js/services/climateService.js?v=115",
  "./src/js/services/roadRouteService.js?v=115",
  "./src/js/services/flightService.js?v=115",
  "./src/js/services/spotService.js?v=115",
  "./src/js/services/cityCatalogService.js?v=115",
  "./src/js/services/weatherService.js?v=115",
  "./src/data/travelData.js?v=115",
  "./src/data/globalCities.js?v=115",
  "./src/data/cityCatalogExpansion.js?v=115",
  "./src/data/cityGeonames.js?v=115",
  "./src/data/cityCoordinates.js?v=115",
  "./src/data/cityEnrichment.js?v=115",
  "./src/data/city-spots/asia.json?v=115",
  "./src/data/city-spots/europe.json?v=115",
  "./src/data/city-spots/africa.json?v=115",
  "./src/data/city-spots/north-america.json?v=115",
  "./src/data/city-spots/south-america.json?v=115",
  "./src/data/city-spots/oceania.json?v=115",
  "./src/data/countries/asia.js?v=115",
  "./src/data/countries/europe.js?v=115",
  "./src/data/countries/others.js?v=115"
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      await cache.addAll(APP_SHELL);
    } catch (error) {
      await caches.delete(CACHE_NAME);
      throw error;
    }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(key => key.startsWith("journey-atlas-shell-") && key !== CACHE_NAME)
        .map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    if (event.request.mode === "navigate") {
      try {
        const response = await fetch(event.request, { cache: "no-cache" });
        if (response && response.status === 200 && response.type === "basic") {
          await cache.put(event.request, response.clone());
        }
        return response;
      } catch (error) {
        const offlinePage = await cache.match(event.request)
          || await cache.match("./index.html")
          || await cache.match("./");
        if (offlinePage) return offlinePage;
        throw error;
      }
    }
    const cachedResponse = await cache.match(event.request);
    if (cachedResponse) return cachedResponse;
    try {
      const response = await fetch(event.request);
      if (response && response.status === 200 && response.type === "basic") await cache.put(event.request, response.clone());
      return response;
    } catch (error) {
      if (event.request.mode === "navigate") {
        const offlinePage = await cache.match("./index.html");
        if (offlinePage) return offlinePage;
      }
      throw error;
    }
  })());
});
