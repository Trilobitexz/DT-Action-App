const CACHE_NAME = "journey-atlas-shell-v3";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./src/css/style.css",
  "./src/js/pwa.js",
  "./src/js/app.js",
  "./src/js/map/geoContinents.js",
  "./src/js/map/mapManager.js",
  "./src/js/store/appStore.js",
  "./src/js/modules/continentView.js",
  "./src/js/modules/countryView.js",
  "./src/js/modules/globalCitiesView.js",
  "./src/js/modules/plannerView.js",
  "./src/js/services/currencyService.js",
  "./src/js/services/flightService.js",
  "./src/js/services/spotService.js",
  "./src/js/services/weatherService.js",
  "./src/data/travelData.js",
  "./src/data/globalCities.js",
  "./src/data/countries/asia.js",
  "./src/data/countries/europe.js",
  "./src/data/countries/others.js"
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
