(function () {
  window.CityCatalogService = {
    cache: new Map(),
    spotCache: new Map(),
    spotRequests: new Map(),
    waitForFirestore: function () {
      if (window.firebaseFirestore) return Promise.resolve(window.firebaseFirestore);
      return new Promise(resolve => {
        let attempts = 0;
        const timer = window.setInterval(() => {
          attempts += 1;
          if (window.firebaseFirestore) {
            window.clearInterval(timer);
            resolve(window.firebaseFirestore);
          } else if (attempts >= 100) {
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
      const db = await this.waitForFirestore();
      if (!db) return null;
      try {
        const [citySnapshot, spotSnapshot] = await Promise.all([
          db.collection("cities").doc(key).get(),
          db.collection("cities").doc(key).collection("spots").orderBy("index").get()
        ]);
        const city = citySnapshot.exists ? citySnapshot.data() : null;
        const spots = [];
        spotSnapshot.forEach(doc => {
          const data = doc.data();
          if (!data || !data.name) return;
          const coordinate = value => value !== null && value !== undefined && value !== ""
            && Number.isFinite(Number(value)) ? Number(value) : null;
          spots.push({
            id: doc.id,
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
            rating: data.rating || null,
            ratingSource: data.ratingSource || null,
            publishedAt: data.publishedAt?.toMillis ? data.publishedAt.toMillis() : null
          });
        });
        const result = { city: city || null, spots };
        this.cache.set(key, result);
        return result;
      } catch (error) {
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
    ensureSpots: function (city, { radius = 25000, limit = 80 } = {}) {
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

        let cloudSpots = [];
        if (!saved) {
          const catalog = await this.fetchCity(key);
          cloudSpots = catalog?.spots || [];
        }
        let liveSpots = saved?.spots || [];
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
          if (coordinates) {
            liveSpots = await window.SpotService.fetchNearbyPlaces({ ...city, ...coordinates }, { radius, limit })
              .catch(error => {
                console.warn(`載入 ${city.name} 周邊景點失敗：`, error);
                return [];
              });
          }
        }

        let spots = this.mergeSpots(city.spots || [], cloudSpots, liveSpots, city.spotCandidates || []);
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
