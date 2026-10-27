const CACHE_NAME = "journey-atlas-shell-v2";
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
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(key => key !== CACHE_NAME)
        .map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => cachedResponse || fetch(event.request)
        .then(response => {
          if (!response || response.status !== 200 || response.type !== "basic") return response;
          const responseCopy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseCopy));
          return response;
        }))
  );
});
