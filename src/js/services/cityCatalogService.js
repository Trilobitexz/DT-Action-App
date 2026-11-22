(function () {
  window.CityCatalogService = {
    cache: new Map(),
    spotCache: new Map(),
    spotRequests: new Map(),
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
    fetchCity: async function (cityId) {
      const key = String(cityId || "");
      if (!key) return null;
      if (this.cache.has(key)) return this.cache.get(key);
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
        const spots = [];
        spotSnapshot.forEach(doc => {
          const data = doc.data();
          if (!data || !data.name) return;
          const coordinate = value => value !== null && value !== undefined && value !== ""
            && Number.isFinite(Number(value)) ? Number(value) : null;
          spots.push({
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
          });
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
    },
    normalizeSpotName: function (value) {
      return String(value || "").normalize("NFKC").trim().toLocaleLowerCase()
        .replace(/[\s\p{P}]+/gu, "");
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
    ensureSpots: function (city, { radius = 20000, limit = 50 } = {}) {
      if (!city?.id) return Promise.resolve([]);
      const key = String(city.id);
      if (this.spotCache.has(key)) {
        city.spots = this.spotCache.get(key);
        city._spotCatalogReady = true;
        return Promise.resolve(city.spots);
      }
      if (this.spotRequests.has(key)) return this.spotRequests.get(key);

      const request = (async () => {
        const curated = this.mergeSpots(city.spots || [], city.spotCandidates || []);
        const localKey = `journey-atlas-city-spots-v2-${key}`;
        let saved = null;
        try {
          saved = JSON.parse(localStorage.getItem(localKey) || "null");
          if (!Array.isArray(saved?.spots) || Date.now() - saved.fetchedAt > 14 * 24 * 60 * 60 * 1000) saved = null;
        } catch (error) {
          console.warn("城市景點快取無法讀取：", error);
        }

        let liveSpots = saved?.spots || [];
        let cloudCatalog = null;
        const cloudPromise = !saved ? this.fetchCity(key).catch(error => {
            console.warn(`讀取 ${city.name || key} 雲端城市目錄失敗：`, error);
            return null;
          }) : Promise.resolve(null);
        if (!saved && window.SpotService) {
          let coordinates = Number.isFinite(city.lat) && Number.isFinite(city.lng)
            ? { lat: city.lat, lng: city.lng }
            : null;
          if (!coordinates && city.englishName && city.countryCode) {
            coordinates = await window.SpotService.resolveCityLocation(city).catch(error => {
              console.warn(`無法取得 ${city.name || key} 座標：`, error);
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
          const livePromise = coordinates
            ? window.SpotService.fetchNearbyPlaces({ ...city, ...coordinates }, { radius, limit }).catch(error => {
              console.warn(`載入 ${city.name} 周邊景點失敗：`, error);
              return [];
            })
            : Promise.resolve([]);
          [cloudCatalog, liveSpots] = await Promise.all([cloudPromise, livePromise]);
        } else if (!saved) {
          cloudCatalog = await cloudPromise;
        }

        const cloudSpots = cloudCatalog?.spots || [];
        if (cloudCatalog?.city?.description && !city.descriptionSource?.text) {
          city.descriptionSource = {
            text: cloudCatalog.city.description,
            pageUrl: cloudCatalog.city.sourceUrl || null,
            sourceLabel: cloudCatalog.city.sourceLabel || "後台城市目錄"
          };
        }
        let spots = this.mergeSpots(city.spots || [], cloudSpots, liveSpots, city.spotCandidates || []);
        const sourcePriority = spot => {
          if (spot.isFeatured === true) return 0;
          const hasSource = /^https?:\/\//i.test(String(spot.sourceUrl || spot.pageUrl || ""));
          const hasCoordinates = Number.isFinite(spot.lat) && Number.isFinite(spot.lng);
          if (hasSource && hasCoordinates) return 1;
          if (hasSource) return 2;
          return 3;
        };
        spots = spots.map((spot, originalOrder) => ({ spot, originalOrder })).sort((a, b) => {
          const aRank = Number.isFinite(a.spot.featuredRank) ? a.spot.featuredRank : Number.POSITIVE_INFINITY;
          const bRank = Number.isFinite(b.spot.featuredRank) ? b.spot.featuredRank : Number.POSITIVE_INFINITY;
          if (Boolean(a.spot.isFeatured) !== Boolean(b.spot.isFeatured)) return a.spot.isFeatured ? -1 : 1;
          if (aRank !== bRank) return aRank - bRank;
          return sourcePriority(a.spot) - sourcePriority(b.spot) || a.originalOrder - b.originalOrder;
        }).map(item => item.spot);
        if (!spots.length) spots = this.createMapSearchSuggestions(city);
        city.spots = spots;
        city._spotCatalogReady = true;
        city.spotsSource = saved ? "cached" : liveSpots.length ? "live" : cloudSpots.length ? "firestore" : "local-or-map-search";
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
