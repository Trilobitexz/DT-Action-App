(function () {
  const appVersion = (() => {
    const script = [...document.scripts].find(item => item.src.includes("cityCatalogService.js"));
    try { return new URL(script?.src || location.href, document.baseURI).searchParams.get("v") || "1"; }
    catch (error) { return "1"; }
  })();

  window.CityCatalogService = {
    cache: new Map(),
    spotCache: new Map(),
    spotRequests: new Map(),
    spotRequestForceRefresh: new Map(),
    cityRequests: new Map(),
    prebuiltCityRequests: new Map(),
    failedCityReads: new Map(),
    spotCacheDbPromise: null,
    spotCacheDataVersion: appVersion,
    spotCacheTtlMs: 14 * 24 * 60 * 60 * 1000,
    spotCacheMaxStaleMs: 180 * 24 * 60 * 60 * 1000,
    getSpotCacheDb: function () {
      if (!window.indexedDB) return Promise.resolve(null);
      if (this.spotCacheDbPromise) return this.spotCacheDbPromise;
      this.spotCacheDbPromise = new Promise(resolve => {
        let request;
        try { request = window.indexedDB.open("journey-atlas-city-cache", 1); }
        catch (error) { resolve(null); return; }
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains("citySpots")) request.result.createObjectStore("citySpots", { keyPath: "cityId" });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
        request.onblocked = () => resolve(null);
      });
      return this.spotCacheDbPromise;
    },
    readSpotCache: async function (cityId, legacyKey) {
      const readLegacy = () => {
        try { return JSON.parse(localStorage.getItem(legacyKey) || "null"); }
        catch (error) { console.warn("城市景點舊快取無法讀取：", error); return null; }
      };
      let record = null;
      try {
        const db = await this.getSpotCacheDb();
        if (db) record = await new Promise((resolve, reject) => {
          const transaction = db.transaction("citySpots", "readwrite");
          const request = transaction.objectStore("citySpots").get(String(cityId));
          let value = null;
          request.onsuccess = () => {
            value = request.result || null;
            if (value) transaction.objectStore("citySpots").put({ ...value, accessedAt: Date.now() });
          };
          request.onerror = () => reject(request.error);
          transaction.oncomplete = () => resolve(value);
          transaction.onerror = () => reject(transaction.error);
        });
      } catch (error) { console.warn("IndexedDB 城市景點快取讀取失敗，改用舊快取。", error); }
      if (!record) record = readLegacy();
      if (!Array.isArray(record?.spots) || !Number.isFinite(record.fetchedAt)
        || record.schemaVersion !== 2 || String(record.dataVersion || "") !== this.spotCacheDataVersion) {
        if (record?.cityId) {
          try {
            const db = await this.getSpotCacheDb();
            if (db) db.transaction("citySpots", "readwrite").objectStore("citySpots").delete(String(cityId));
          } catch (error) { /* 舊快取已忽略；清理失敗不影響新資料載入。 */ }
        }
        try { localStorage.removeItem(legacyKey); } catch (error) { /* 私密瀏覽模式可能停用儲存。 */ }
        return null;
      }
      const age = Date.now() - record.fetchedAt;
      if (age > this.spotCacheMaxStaleMs) return null;
      return { ...record, isStale: age > this.spotCacheTtlMs };
    },
    writeSpotCache: async function (cityId, legacyKey, record) {
      const normalized = {
        ...record,
        cityId: String(cityId),
        schemaVersion: 2,
        dataVersion: this.spotCacheDataVersion,
        accessedAt: Date.now()
      };
      try {
        const db = await this.getSpotCacheDb();
        if (!db) throw new Error("瀏覽器不支援 IndexedDB");
        await new Promise((resolve, reject) => {
          const transaction = db.transaction("citySpots", "readwrite");
          const store = transaction.objectStore("citySpots");
          store.put(normalized);
          const all = store.getAll();
          all.onsuccess = () => {
            const records = (all.result || []).sort((a, b) => Number(b.accessedAt || b.fetchedAt) - Number(a.accessedAt || a.fetchedAt));
            records.slice(40).forEach(item => store.delete(item.cityId));
          };
          transaction.oncomplete = resolve;
          transaction.onerror = () => reject(transaction.error);
          transaction.onabort = () => reject(transaction.error || new Error("IndexedDB 快取交易中止"));
        });
        try { localStorage.removeItem(legacyKey); } catch (error) { /* IndexedDB remains authoritative. */ }
      } catch (error) {
        try { localStorage.setItem(legacyKey, JSON.stringify(normalized)); }
        catch (storageError) { console.warn("城市景點快取寫入失敗；資料仍可由來源重新載入。", storageError); }
      }
    },
    waitForFirestore: function () {
      if (window.firebaseFirestore) return Promise.resolve(window.firebaseFirestore);
      return new Promise(resolve => {
        let attempts = 0;
        const timer = window.setInterval(() => {
          attempts += 1;
          if (window.firebaseFirestore) {
            window.clearInterval(timer);
            resolve(window.firebaseFirestore);
          } else if (attempts >= 20) {
            window.clearInterval(timer);
            resolve(null);
          }
        }, 100);
      });
    },
    getKnownCityCoordinates: function (cityId) {
      const valid = location => location
        && location.lat !== null && location.lat !== undefined && location.lat !== ""
        && location.lng !== null && location.lng !== undefined && location.lng !== ""
        && Number.isFinite(Number(location.lat)) && Number(location.lat) >= -90 && Number(location.lat) <= 90
        && Number.isFinite(Number(location.lng)) && Number(location.lng) >= -180 && Number(location.lng) <= 180
        && !(Number(location.lat) === 0 && Number(location.lng) === 0);
      const candidates = [
        window.CITY_GEONAMES?.[cityId],
        window.CITY_COORDINATES?.[cityId],
        ...(window.TRAVEL_DATA?.globalCities || []).filter(city => city.id === cityId),
        ...(window.TRAVEL_DATA?.countries || []).flatMap(country => country.cities || []).filter(city => city.id === cityId)
      ];
      const location = candidates.find(valid);
      return location ? {
        lat: Number(location.lat),
        lng: Number(location.lng),
        sourceUrl: location.sourceUrl || location.coordinateSource?.sourceUrl || null
      } : null;
    },
    fetchCity: function (cityId) {
      const key = String(cityId || "");
      if (!key) return Promise.resolve(null);
      if (this.cache.has(key)) return Promise.resolve(this.cache.get(key));
      if (this.cityRequests.has(key)) return this.cityRequests.get(key);
      const request = (async () => {
        const previousFailure = this.failedCityReads.get(key);
        if (previousFailure && Date.now() - previousFailure < 30000) return null;
        const db = await this.waitForFirestore();
        if (!db) {
          this.failedCityReads.set(key, Date.now());
          return null;
        }
        try {
        const read = Promise.all([
          db.collection("cities").doc(key).get(),
          db.collection("cities").doc(key).collection("spots").orderBy("index").limit(100).get()
        ]);
        let timeoutId;
        const [citySnapshot, spotSnapshot] = await Promise.race([
          read,
          new Promise((_, reject) => { timeoutId = window.setTimeout(() => reject(new Error("Firestore 城市目錄查詢逾時")), 3000); })
        ]).finally(() => window.clearTimeout(timeoutId));
        const storedCity = citySnapshot.exists ? citySnapshot.data() : null;
        const coordinate = value => value !== null && value !== undefined && value !== ""
          && Number.isFinite(Number(value)) ? Number(value) : null;
        const knownCoordinates = this.getKnownCityCoordinates(key);
        const city = storedCity && knownCoordinates
          ? { ...storedCity, lat: knownCoordinates.lat, lng: knownCoordinates.lng }
          : storedCity;
        const cityCoordinates = knownCoordinates || { lat: coordinate(city?.lat), lng: coordinate(city?.lng) };
        const spots = [];
        spotSnapshot.forEach(doc => {
          const data = doc.data();
          if (!data || !data.name) return;
          const spot = {
            id: doc.id,
            index: data.index !== null && data.index !== undefined && data.index !== "" && Number.isFinite(Number(data.index)) ? Number(data.index) : null,
            isFeatured: data.isFeatured === true,
            featuredRank: data.featuredRank !== null && data.featuredRank !== undefined && data.featuredRank !== "" && Number.isFinite(Number(data.featuredRank)) ? Number(data.featuredRank) : null,
            name: data.name,
            englishName: data.englishName || "",
            category: data.category || "景點",
            tag: data.tag || "資料庫景點",
            note: data.note || "",
            description: data.description || "",
            lat: coordinate(data.lat),
            lng: coordinate(data.lng),
            sourceUrl: data.sourceUrl || "",
            sourceLabel: data.sourceLabel || "後台公開目錄",
            website: data.website || "",
            openingHours: data.openingHours || "",
            address: data.address || "",
            imageUrl: data.imageUrl || "",
            imageSourceUrl: data.imageSourceUrl || "",
            imageAttribution: data.imageAttribution || "",
            imageArtist: data.imageArtist || "",
            imageLicense: data.imageLicense || "",
            imageLicenseUrl: data.imageLicenseUrl || "",
            closedDays: data.closedDays || "",
            visitHours: Number.isFinite(Number(data.visitHours)) && Number(data.visitHours) > 0 ? Number(data.visitHours) : null,
            hasCoordinates: data.lat !== null && data.lat !== undefined && data.lat !== ""
              && data.lng !== null && data.lng !== undefined && data.lng !== ""
              && Number.isFinite(Number(data.lat)) && Number.isFinite(Number(data.lng))
              && !(Number(data.lat) === 0 && Number(data.lng) === 0),
            hasDescription: data.hasDescription === true || Boolean(String(data.description || data.note || "").trim()),
            rating: data.rating !== null && data.rating !== undefined && data.rating !== "" && Number.isFinite(Number(data.rating)) && Number(data.rating) >= 0 && Number(data.rating) <= 5 ? Number(data.rating) : null,
            ratingSource: typeof data.ratingSource === "string" && data.ratingSource.trim() ? data.ratingSource.trim() : null,
            publishedAt: data.publishedAt?.toMillis ? data.publishedAt.toMillis() : null
          };
          if (this.hasValidSpotCoordinates(spot, cityCoordinates)
            && (window.SpotTextService?.isTravelAttraction(spot) ?? true)) {
            spots.push(window.SpotTextService?.normalizeSpot(spot) || spot);
          }
        });
        const result = { city: city || null, spots };
        this.cache.set(key, result);
        this.failedCityReads.delete(key);
          return result;
        } catch (error) {
          this.failedCityReads.set(key, Date.now());
          console.warn(`讀取後台城市目錄失敗（${key}）：`, error);
          return null;
        }
      })().finally(() => this.cityRequests.delete(key));
      this.cityRequests.set(key, request);
      return request;
    },
    normalizeSpotName: function (value) {
      const traditional = window.SpotTextService?.toTraditional(value) || String(value || "");
      return traditional.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").normalize("NFKC").trim().toLocaleLowerCase()
        .replace(/[\s\p{P}]+/gu, "");
    },
    normalizeSpot: function (spot) {
      const normalized = window.SpotTextService?.normalizeSpot(spot) || { ...spot };
      const coordinate = value => value === null || value === undefined || value === "" ? null : Number(value);
      return {
        ...normalized,
        name: String(normalized.name || "").trim(),
        lat: coordinate(normalized.lat),
        lng: coordinate(normalized.lng)
      };
    },
    hasValidSpotCoordinates: function (spot, city = null) {
      const lat = spot?.lat === null || spot?.lat === undefined || spot?.lat === "" ? NaN : Number(spot.lat);
      const lng = spot?.lng === null || spot?.lng === undefined || spot?.lng === "" ? NaN : Number(spot.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)
        || (lat === 0 && lng === 0) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
      if (Number.isFinite(city?.lat) && Number.isFinite(city?.lng)) {
        const radians = Math.PI / 180;
        const dLat = (lat - city.lat) * radians;
        const dLng = (lng - city.lng) * radians;
        const value = Math.sin(dLat / 2) ** 2 + Math.cos(city.lat * radians) * Math.cos(lat * radians) * Math.sin(dLng / 2) ** 2;
        const distanceKm = 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
        if (distanceKm > 50) return false;
      }
      return true;
    },
    getCityContinentId: function (city) {
      if (city?.continentId) return city.continentId;
      const country = window.TRAVEL_DATA?.countries?.find(item => item.cities?.some(candidate => candidate.id === city?.id));
      if (country?.continentId) return country.continentId;
      const globalCity = window.TRAVEL_DATA?.globalCities?.find(item => item.id === city?.id);
      const continent = window.TRAVEL_DATA?.continents?.find(item => item.name === globalCity?.continentName);
      return continent?.id || "";
    },
    fetchPrebuiltSpots: function (city) {
      const continentId = this.getCityContinentId(city);
      if (!city?.id || !continentId) return Promise.resolve([]);
      if (!this.prebuiltCityRequests.has(continentId)) {
        const request = fetch(`src/data/city-spots/${encodeURIComponent(continentId)}.json?v=${appVersion}`)
          .then(response => response.ok ? response.json() : {})
          .catch(error => {
            console.warn(`無法載入${continentId}精選景點資料：`, error);
            return {};
          });
        this.prebuiltCityRequests.set(continentId, request);
      }
      return this.prebuiltCityRequests.get(continentId).then(cities => {
        const coordinates = { lat: Number(city.lat), lng: Number(city.lng) };
        return (cities?.[city.id] || []).map(spot => ({
          ...spot,
          lat: Number(spot.lat), lng: Number(spot.lng),
          tag: "城市精選", ratingSource: null,
          isFeatured: true
        })).filter(spot => this.hasValidSpotCoordinates(spot, coordinates));
      });
    },
    mergeSpots: function (...groups) {
      const merged = [];
      const names = new Map();
      groups.flat().forEach(spot => {
        const item = this.normalizeSpot(typeof spot === "string" ? { name: spot } : spot || {});
        const name = String(item?.name || "").trim();
        const normalized = this.normalizeSpotName(name);
        if (!normalized) return;
        if (names.has(normalized)) {
          const existing = merged[names.get(normalized)];
          if ((!existing.imageAttribution || !existing.imageLicense || !existing.imageUrl)
            && item.imageAttribution && item.imageLicense && item.imageUrl) {
            existing.imageAttribution = String(item.imageAttribution).trim();
            existing.imageUrl = item.imageUrl || existing.imageUrl || "";
            existing.imageSourceUrl = item.imageSourceUrl || existing.imageSourceUrl || "";
            existing.imageArtist = item.imageArtist || existing.imageArtist || "";
            existing.imageLicense = item.imageLicense || existing.imageLicense || "";
            existing.imageLicenseUrl = item.imageLicenseUrl || existing.imageLicenseUrl || "";
          }
          return;
        }
        names.set(normalized, merged.length);
        merged.push({ ...item, name });
      });
      return merged;
    },
    filterTravelSpots: function (spots, city) {
      const normalizeName = value => this.normalizeSpotName(value);
      const cityNames = new Set([city?.name, city?.englishName, city?.nameEn].map(normalizeName).filter(Boolean));
      return (Array.isArray(spots) ? spots : []).filter(spot => {
        const item = this.normalizeSpot(spot);
        const hasDescription = String(item.description || item.summary || item.note || "").trim().length > 0;
        const hasSource = window.SpotTextService?.isValidHttpUrl(item.sourceUrl) ?? false;
        if (!item.name || !String(item.category || "").trim() || !hasDescription || !hasSource
          || item.isSearchSuggestion || !this.hasValidSpotCoordinates(item, city)) return false;
        if (cityNames.has(normalizeName(item.name))) return false;
        return window.SpotTextService?.isTravelAttraction(item) ?? true;
      });
    },
    sortSpotsByQuality: function (spots) {
      const hasCoords = spot => Number.isFinite(spot?.lat) && spot.lat >= -90 && spot.lat <= 90
        && Number.isFinite(spot?.lng) && spot.lng >= -180 && spot.lng <= 180
        && !(spot.lat === 0 && spot.lng === 0);
      const quality = spot => (spot.imageUrl || spot.thumbnail || spot.photoUrl ? 4 : 0)
        + (String(spot.description || spot.note || "").trim().length >= 24 ? 2 : 0)
        + (hasCoords(spot) ? 1 : 0);
      return [...spots].sort((a, b) => {
        if (Boolean(a.isSearchSuggestion) !== Boolean(b.isSearchSuggestion)) return a.isSearchSuggestion ? 1 : -1;
        const qualityDifference = quality(b) - quality(a);
        if (qualityDifference) return qualityDifference;
        if (Boolean(a.isFeatured) !== Boolean(b.isFeatured)) return a.isFeatured ? -1 : 1;
        const aRank = Number.isFinite(a.featuredRank) ? a.featuredRank : Number.POSITIVE_INFINITY;
        const bRank = Number.isFinite(b.featuredRank) ? b.featuredRank : Number.POSITIVE_INFINITY;
        return a.isFeatured && b.isFeatured && aRank !== bRank ? aRank - bRank : 0;
      });
    },
    createMapSearchSuggestions: function (city) {
      const searches = [
        ["景點與地標", "景點"],
        ["博物館與藝廊", "博物館 美術館"],
        ["歷史古蹟與文化景點", "歷史古蹟 文化景點"],
        ["公園與自然景點", "公園 自然景點"],
        ["市集與在地街區", "市集 在地街區"],
        ["親子與室內景點", "親子 室內景點"]
      ];
      return searches.map(([label, query]) => {
        const searchText = `${city.name || city.englishName || ""} ${city.countryName || ""} ${query}`.trim();
        return {
          name: `地圖搜尋：${label}`,
          category: "地圖搜尋建議",
          tag: "即時地圖搜尋",
          note: "這是搜尋入口，並非已核實的景點名稱。開啟地圖查看實際地點、營業資訊與旅客評價。",
          description: "地圖搜尋建議，並非已核實的單一景點；請開啟連結挑選實際地點。",
          sourceLabel: "Google Maps 搜尋",
          sourceUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchText)}`,
          isSearchSuggestion: true
        };
      });
    },
    ensureSpots: function (city, { radius = 20000, limit = 100, onCatalogReady = null, forceRefresh = false } = {}) {
      if (!city?.id) return Promise.resolve([]);
      const key = String(city.id);
      if (!forceRefresh && this.spotCache.has(key)) {
        city.spots = this.spotCache.get(key);
        city._spotCatalogReady = true;
        return Promise.resolve(city.spots);
      }
      const activeRequest = this.spotRequests.get(key);
      if (activeRequest) {
        if (!forceRefresh || this.spotRequestForceRefresh.get(key) === true) return activeRequest;
        return activeRequest.catch(() => []).then(() => this.ensureSpots(city, {
          radius, limit, onCatalogReady, forceRefresh: true
        }));
      }

      const request = (async () => {
        const localKey = `journey-atlas-city-spots-v3-${key}`;
        try { localStorage.removeItem(`journey-atlas-city-spots-v2-${key}`); }
        catch (error) { /* 舊版 localStorage 清理不應阻斷離線目錄載入。 */ }
        let cacheReadTimer;
        const [saved, prebuiltSpots] = await Promise.all([
          Promise.race([
            this.readSpotCache(key, localKey),
            new Promise(resolve => { cacheReadTimer = window.setTimeout(() => resolve(null), 300); })
          ]).finally(() => window.clearTimeout(cacheReadTimer)),
          this.fetchPrebuiltSpots(city)
        ]);
        if (saved) city.spotsCacheMeta = { fetchedAt: saved.fetchedAt, source: saved.source || "離線快取", stale: saved.isStale === true };
        const cachedSpots = Array.isArray(saved?.spots) ? saved.spots : [];
        if (prebuiltSpots.length) {
          const instantSpots = this.sortSpotsByQuality(this.filterTravelSpots(
            this.mergeSpots(prebuiltSpots, city.spots || [], cachedSpots, city.spotCandidates || []), city
          ));
          city.spots = instantSpots;
          city._spotCatalogReady = true;
          city.spotsSource = "prebuilt";
          if (typeof onCatalogReady === "function") onCatalogReady(instantSpots, { city: null, source: "prebuilt" });
        }
        const cloudPromise = this.fetchCity(key).catch(error => {
          console.warn(`讀取 ${city.name || key} 雲端城市目錄失敗：`, error);
          return null;
        });
        if (typeof onCatalogReady === "function") {
          cloudPromise.then(catalog => {
            if (!catalog) return;
            const catalogCity = catalog.city || {};
            if ((!Number.isFinite(city.lat) || !Number.isFinite(city.lng))
              && Number.isFinite(catalogCity.lat) && Number.isFinite(catalogCity.lng)) {
              city.lat = catalogCity.lat;
              city.lng = catalogCity.lng;
            }
            const earlySpots = this.sortSpotsByQuality(this.filterTravelSpots(
              this.mergeSpots(catalog.spots, city.spots || [], cachedSpots, city.spotCandidates || []), city
            ));
            if (!earlySpots.some(spot => this.hasValidSpotCoordinates(spot, city))
              && (!Number.isFinite(city.lat) || !Number.isFinite(city.lng))) return;
            onCatalogReady(earlySpots, catalog);
          }).catch(error => console.warn("無法提早顯示雲端景點目錄：", error));
        }
        const cloudCatalog = await cloudPromise;
        if (cloudCatalog?.city) {
          const catalogCity = cloudCatalog.city;
          if ((!Number.isFinite(city.lat) || !Number.isFinite(city.lng))
            && Number.isFinite(catalogCity.lat) && Number.isFinite(catalogCity.lng)) {
            city.lat = catalogCity.lat;
            city.lng = catalogCity.lng;
          }
          if (catalogCity.description && !city.descriptionSource?.text) {
            city.descriptionSource = {
              text: catalogCity.description,
              pageUrl: catalogCity.sourceUrl || null,
              sourceLabel: catalogCity.sourceLabel || "後台城市目錄"
            };
          }
        }
        const cloudSpots = cloudCatalog?.spots || [];
        const preferredSpots = this.sortSpotsByQuality(this.filterTravelSpots(
          this.mergeSpots(cloudSpots, city.spots || [], cachedSpots, city.spotCandidates || []), city
        ));
        // Three database landmarks are enough for a fast first paint, but a city
        // guide should keep enriching toward a fuller selection in the background.
        const locatedSpotCount = preferredSpots.filter(spot => this.hasValidSpotCoordinates(spot, city)).length;
        const shouldEnrichWithLivePlaces = forceRefresh || locatedSpotCount < Math.min(40, limit);
        let liveSpots = [];
        if (shouldEnrichWithLivePlaces && window.SpotService) {
          let coordinates = Number.isFinite(city.lat) && Number.isFinite(city.lng)
            ? { lat: city.lat, lng: city.lng }
            : null;
          if (!coordinates && city.englishName && city.countryCode) {
            coordinates = await window.SpotService.resolveCityLocation(city).catch(error => {
              if (error.name !== "AbortError") console.warn(`無法取得 ${city.name || key} 座標：`, error);
              return null;
            });
            if (coordinates) {
              city.lat = coordinates.lat;
              city.lng = coordinates.lng;
              city.coordinateSource = {
                provider: coordinates.provider,
                sourceUrl: coordinates.sourceUrl,
                checkedAt: coordinates.fetchedAt ? new Date(coordinates.fetchedAt).toISOString() : ""
              };
            }
          }
          liveSpots = coordinates
            ? await window.SpotService.fetchNearbyPlaces({ ...city, ...coordinates }, { radius, limit, forceRefresh }).catch(error => {
              console.warn(`載入 ${city.name} 周邊景點失敗：`, error);
              return [];
            })
            : [];
        }
        let spots = this.filterTravelSpots(
          this.mergeSpots(cloudSpots, city.spots || [], cachedSpots, liveSpots, city.spotCandidates || []), city
        );
        spots = this.sortSpotsByQuality(spots);
        if (!spots.length) spots = this.createMapSearchSuggestions(city);
        city.spots = spots;
        city._spotCatalogReady = true;
        city.spotsSource = cloudSpots.length ? "firestore" : liveSpots.length ? "live" : saved ? "cached" : prebuiltSpots.length ? "prebuilt" : "local-or-map-search";
        city.dataStatus = { ...(city.dataStatus || {}), spots: spots.some(spot => !spot.isSearchSuggestion) ? "available" : "map-search-fallback" };
        this.spotCache.set(key, spots);
        const refreshSucceeded = Boolean(cloudCatalog) || liveSpots.length > 0;
        if (refreshSucceeded) {
          const source = cloudSpots.length ? "Firestore" : liveSpots.length ? "公開地圖資料" : prebuiltSpots.length ? "離線精選目錄" : "公開目錄";
          const fetchedAt = Date.now();
          city.spotsCacheMeta = { fetchedAt, source, stale: false };
          await this.writeSpotCache(key, localKey, { fetchedAt, source, spots: spots.slice(0, 100) });
        }
        if (typeof onCatalogReady === "function") {
          onCatalogReady(spots, { city: cloudCatalog?.city || null, source: "final", cacheMeta: city.spotsCacheMeta || null });
        }
        return spots;
      })().finally(() => {
        if (this.spotRequests.get(key) === request) {
          this.spotRequests.delete(key);
          this.spotRequestForceRefresh.delete(key);
        }
      });
      this.spotRequests.set(key, request);
      this.spotRequestForceRefresh.set(key, forceRefresh);
      return request;
    }
  };
})();
