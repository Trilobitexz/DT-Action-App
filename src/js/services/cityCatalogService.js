(function () {
  window.CityCatalogService = {
    cache: new Map(),
    spotCache: new Map(),
    spotRequests: new Map(),
    cityRequests: new Map(),
    prebuiltCityRequests: new Map(),
    failedCityReads: new Map(),
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
          db.collection("cities").doc(key).collection("spots").orderBy("index").limit(40).get()
        ]);
        let timeoutId;
        const [citySnapshot, spotSnapshot] = await Promise.race([
          read,
          new Promise((_, reject) => { timeoutId = window.setTimeout(() => reject(new Error("Firestore 城市目錄查詢逾時")), 3000); })
        ]).finally(() => window.clearTimeout(timeoutId));
        const city = citySnapshot.exists ? citySnapshot.data() : null;
        const coordinate = value => value !== null && value !== undefined && value !== ""
          && Number.isFinite(Number(value)) ? Number(value) : null;
        const cityCoordinates = { lat: coordinate(city?.lat), lng: coordinate(city?.lng) };
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
            closedDays: data.closedDays || "",
            visitHours: Number.isFinite(Number(data.visitHours)) && Number(data.visitHours) > 0 ? Number(data.visitHours) : null,
            hasCoordinates: data.hasCoordinates === true || (Number.isFinite(Number(data.lat)) && Number.isFinite(Number(data.lng))),
            hasDescription: data.hasDescription === true || Boolean(String(data.description || data.note || "").trim()),
            rating: data.rating !== null && data.rating !== undefined && data.rating !== "" && Number.isFinite(Number(data.rating)) && Number(data.rating) >= 0 && Number(data.rating) <= 5 ? Number(data.rating) : null,
            ratingSource: typeof data.ratingSource === "string" && data.ratingSource.trim() ? data.ratingSource.trim() : null,
            publishedAt: data.publishedAt?.toMillis ? data.publishedAt.toMillis() : null
          };
          if (this.hasValidSpotCoordinates(spot, cityCoordinates)) spots.push(spot);
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
      return String(value || "").normalize("NFKC").trim().toLocaleLowerCase()
        .replace(/[\s\p{P}]+/gu, "");
    },
    hasValidSpotCoordinates: function (spot, city = null) {
      const lat = spot?.lat;
      const lng = spot?.lng;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)
        || lat === 0 || lng === 0 || lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
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
        const request = fetch(`src/data/city-spots/${encodeURIComponent(continentId)}.json?v=87`)
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
      const names = new Set();
      groups.flat().forEach(spot => {
        const item = typeof spot === "string" ? { name: spot } : spot;
        const name = String(item?.name || "").trim();
        const normalized = this.normalizeSpotName(name);
        if (!normalized || names.has(normalized)) return;
        names.add(normalized);
        merged.push({ ...item, name });
      });
      return merged;
    },
    sortSpotsByQuality: function (spots) {
      const hasCoords = spot => Number.isFinite(spot?.lat) && spot.lat >= -90 && spot.lat <= 90
        && Number.isFinite(spot?.lng) && spot.lng >= -180 && spot.lng <= 180;
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
    ensureSpots: function (city, { radius = 20000, limit = 50, onCatalogReady = null } = {}) {
      if (!city?.id) return Promise.resolve([]);
      const key = String(city.id);
      if (this.spotCache.has(key)) {
        city.spots = this.spotCache.get(key);
        city._spotCatalogReady = true;
        return Promise.resolve(city.spots);
      }
      if (this.spotRequests.has(key)) return this.spotRequests.get(key);

      const request = (async () => {
        const localKey = `journey-atlas-city-spots-v2-${key}`;
        let saved = null;
        try {
          const rawCache = localStorage.getItem(localKey);
          saved = JSON.parse(rawCache || "null");
          if (!Array.isArray(saved?.spots) || !Number.isFinite(saved?.fetchedAt)
            || Date.now() - saved.fetchedAt > 14 * 24 * 60 * 60 * 1000) {
            saved = null;
            if (rawCache) localStorage.removeItem(localKey);
          }
        } catch (error) {
          console.warn("城市景點快取無法讀取：", error);
        }

        const cachedSpots = Array.isArray(saved?.spots) ? saved.spots : [];
        const prebuiltSpots = await this.fetchPrebuiltSpots(city);
        if (prebuiltSpots.length) {
          const instantSpots = this.sortSpotsByQuality(this.mergeSpots(prebuiltSpots, city.spots || [], cachedSpots, city.spotCandidates || []));
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
            const earlySpots = this.sortSpotsByQuality(this.mergeSpots(catalog.spots, city.spots || [], cachedSpots, city.spotCandidates || []));
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
        const preferredSpots = this.sortSpotsByQuality(this.mergeSpots(cloudSpots, city.spots || [], cachedSpots, city.spotCandidates || []));
        // Three database landmarks are enough for a fast first paint, but a city
        // guide should keep enriching toward a fuller selection in the background.
        const locatedSpotCount = preferredSpots.filter(spot => this.hasValidSpotCoordinates(spot, city)).length;
        const shouldEnrichWithLivePlaces = locatedSpotCount < Math.min(24, limit);
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
            ? await window.SpotService.fetchNearbyPlaces({ ...city, ...coordinates }, { radius, limit }).catch(error => {
              console.warn(`載入 ${city.name} 周邊景點失敗：`, error);
              return [];
            })
            : [];
        }
        let spots = this.mergeSpots(cloudSpots, city.spots || [], cachedSpots, liveSpots, city.spotCandidates || []);
        spots = this.sortSpotsByQuality(spots);
        if (!spots.length) spots = this.createMapSearchSuggestions(city);
        city.spots = spots;
        city._spotCatalogReady = true;
        city.spotsSource = cloudSpots.length ? "firestore" : liveSpots.length ? "live" : saved ? "cached" : prebuiltSpots.length ? "prebuilt" : "local-or-map-search";
        city.dataStatus = { ...(city.dataStatus || {}), spots: spots.some(spot => !spot.isSearchSuggestion) ? "available" : "map-search-fallback" };
        this.spotCache.set(key, spots);
        if (liveSpots.length) {
          try { localStorage.setItem(localKey, JSON.stringify({ fetchedAt: Date.now(), spots: liveSpots })); }
          catch (error) { console.warn("城市景點快取無法寫入：", error); }
        }
        return spots;
      })().finally(() => this.spotRequests.delete(key));
      this.spotRequests.set(key, request);
      return request;
    }
  };
})();
