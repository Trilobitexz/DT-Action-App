// 景點即時資訊服務 (整合旅遊、結構化地理與圖片 API)
window.SpotService = {
  cache: {},
  openTripMapApiKey: "",
  requestTimeoutMs: 4000,
  requestQueue: [],
  nearbyPlaceRequests: {},
  cityLocationRequests: {},
  spotDetailRequests: {},
  spotImageRequests: {},
  activeRequests: 0,
  scheduledRequests: 0,
  maxConcurrentRequests: 3,
  requestIntervalMs: 250,
  nextRequestAt: 0,
  maxCacheEntries: 120,
  nominatimTail: Promise.resolve(),
  nextNominatimAt: 0,

  requestJson: function (url, timeoutMs = this.requestTimeoutMs) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ url, expiresAt: Date.now() + timeoutMs, resolve, reject });
      this.processRequestQueue();
    });
  },

  processRequestQueue: function () {
    while (this.activeRequests + this.scheduledRequests < this.maxConcurrentRequests && this.requestQueue.length) {
      const request = this.requestQueue.shift();
      const now = Date.now();
      const startAt = Math.max(now, this.nextRequestAt);
      this.nextRequestAt = startAt + this.requestIntervalMs;
      this.scheduledRequests += 1;
      window.setTimeout(() => {
        this.scheduledRequests -= 1;
        const remainingMs = request.expiresAt - Date.now();
        if (remainingMs <= 0) {
          const timeoutError = new Error("Request timed out");
          timeoutError.name = "AbortError";
          request.reject(timeoutError);
          this.processRequestQueue();
          return;
        }
        this.activeRequests += 1;
        this.runRequest(request.url, remainingMs)
          .then(request.resolve, request.reject)
          .finally(() => {
            this.activeRequests -= 1;
            this.processRequestQueue();
          });
      }, Math.max(0, startAt - now));
    }
  },

  runRequest: async function (url, timeoutMs = this.requestTimeoutMs) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    let res;
    try {
      res = await fetch(url, { headers: { "Accept": "application/json" }, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
    if (!res.ok) throw new Error(`旅遊資料 API 回應異常 (${res.status})`);
    return res.json();
  },

  trimCache: function () {
    const keys = Object.keys(this.cache);
    if (keys.length <= this.maxCacheEntries) return;
    keys.slice(0, keys.length - this.maxCacheEntries).forEach(key => delete this.cache[key]);
  },

  distanceKm: function (firstLat, firstLng, secondLat, secondLng) {
    const toRadians = value => value * Math.PI / 180;
    const earthRadiusKm = 6371;
    const latDelta = toRadians(secondLat - firstLat);
    const lngDelta = toRadians(secondLng - firstLng);
    const firstLatitude = toRadians(firstLat);
    const secondLatitude = toRadians(secondLat);
    const value = Math.sin(latDelta / 2) ** 2
      + Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(lngDelta / 2) ** 2;
    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
  },

  fetchSource: async function (baseUrl, spotName) {
    const cleanName = spotName.split("(")[0].trim();
    let data;
    try {
      data = await this.requestJson(`${baseUrl}${encodeURIComponent(cleanName)}`);
    } catch (error) {
      const apiRoot = baseUrl.replace("/api/rest_v1/page/summary/", "/w/api.php");
      const searchUrl = `${apiRoot}?action=query&list=search&srsearch=${encodeURIComponent(cleanName)}&srlimit=1&format=json&origin=*`;
      const searchData = await this.requestJson(searchUrl);
      const match = searchData.query?.search?.[0];
      if (!match?.title) throw error;
      data = await this.requestJson(`${baseUrl}${encodeURIComponent(match.title)}`);
    }
    return {
      title: data.title,
      extract: data.extract || "",
      type: data.type || "",
      thumbnail: data.thumbnail?.source || null,
      pageUrl: data.content_urls?.desktop?.page || null,
      location: Number.isFinite(Number(data.coordinates?.lat)) && Number.isFinite(Number(data.coordinates?.lon))
        ? {
          latitude: Number(data.coordinates.lat),
          longitude: Number(data.coordinates.lon),
          category: "attraction",
          pageUrl: data.content_urls?.desktop?.page || null
        }
        : null
    };
  },

  fetchCommonsImage: async function (spotName, cityName) {
    const cleanName = spotName.split("(")[0].trim();
    const query = encodeURIComponent(cityName ? `${cleanName} ${cityName}` : cleanName);
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${query}&gsrnamespace=6&gsrlimit=1&prop=imageinfo&iiprop=url&iiurlwidth=500&format=json&origin=*`;
    const data = await this.requestJson(url);
    const page = Object.values(data.query?.pages || {})[0];
    const image = page?.imageinfo?.[0];
    if (!image?.thumburl && !image?.url) throw new Error("Wikimedia Commons 查無圖片");
    return {
      thumbnail: image.thumburl || image.url,
      pageUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title).replace(/%20/g, "_")}`
    };
  },

  fetchSpotImage: function (spotName, cityName = "") {
    const cacheKey = `image:${spotName}|${cityName}`;
    if (this.cache[cacheKey]) return Promise.resolve(this.cache[cacheKey]);
    if (this.spotImageRequests[cacheKey]) return this.spotImageRequests[cacheKey];
    const cleanName = String(spotName || "").split("(")[0].trim();
    const request = (async () => {
      try {
        const data = await this.requestJson(`https://zh.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanName)}`);
        const thumbnail = data.thumbnail?.source || null;
        if (thumbnail) {
          const image = {
            thumbnail,
            pageUrl: data.content_urls?.desktop?.page || null,
            title: data.title || spotName
          };
          this.cache[cacheKey] = image;
          this.trimCache();
          return image;
        }
      } catch (error) {
        // 沒有百科縮圖時，改查 Commons；失敗則讓景點卡片維持文字版。
        if (error.name === "AbortError") {
          this.cache[cacheKey] = { thumbnail: null };
          this.trimCache();
          return null;
        }
      }
      try {
        const commons = await this.fetchCommonsImage(cleanName, cityName);
        const image = { ...commons, title: spotName };
        this.cache[cacheKey] = image;
        this.trimCache();
        return image;
      } catch (error) {
        this.cache[cacheKey] = { thumbnail: null };
        this.trimCache();
        return null;
      }
    })();
    this.spotImageRequests[cacheKey] = request;
    request.then(() => { delete this.spotImageRequests[cacheKey]; }, () => { delete this.spotImageRequests[cacheKey]; });
    return request;
  },

  fetchOpenTripMap: async function (spotName, cityName) {
    if (!this.openTripMapApiKey) return null;
    const query = cityName ? `${spotName}, ${cityName}` : spotName;
    const searchUrl = `https://api.opentripmap.com/0.1/en/places/geoname?name=${encodeURIComponent(query)}&apikey=${encodeURIComponent(this.openTripMapApiKey)}`;
    const place = await this.requestJson(searchUrl);
    if (!place || !place.xid) throw new Error("OpenTripMap 查無景點");

    const detail = await this.requestJson(
      `https://api.opentripmap.com/0.1/en/places/xid/${encodeURIComponent(place.xid)}?apikey=${encodeURIComponent(this.openTripMapApiKey)}`
    );
    return {
      title: detail.name || spotName,
      extract: detail.wikipedia_extracts?.text || detail.info?.descr || "",
      thumbnail: detail.preview?.source || null,
      pageUrl: detail.otm || `https://opentripmap.com/en/card/${encodeURIComponent(place.xid)}`,
      sourceId: "opentripmap",
      sourceLabel: "OpenTripMap 旅遊景點",
      location: Number.isFinite(Number(detail.point?.lat)) && Number.isFinite(Number(detail.point?.lon))
        ? {
          latitude: Number(detail.point.lat),
          longitude: Number(detail.point.lon),
          address: detail.address
            ? [detail.address.road, detail.address.house_number, detail.address.city].filter(Boolean).join(" ")
            : "",
          category: detail.kinds || "attraction",
          pageUrl: `https://www.openstreetmap.org/?mlat=${detail.point.lat}&mlon=${detail.point.lon}#map=18/${detail.point.lat}/${detail.point.lon}`
        }
        : null
    };
  },

  fetchWikidata: async function (spotName, cityName) {
    const search = cityName ? `${spotName} ${cityName}` : spotName;
    const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(search)}&language=zh&uselang=zh&limit=1&format=json&origin=*`;
    const searchData = await this.requestJson(searchUrl);
    const entityId = searchData.search?.[0]?.id;
    if (!entityId) throw new Error("Wikidata 查無景點");

    const entityData = await this.requestJson(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(entityId)}&props=labels|descriptions|sitelinks|claims&languages=zh|en&format=json&origin=*`
    );
    const entity = entityData.entities?.[entityId];
    const description = entity?.descriptions?.zh?.value || entity?.descriptions?.en?.value || "";
    const wikiTitle = entity?.sitelinks?.zhwiki?.title || entity?.sitelinks?.enwiki?.title;
    const coordinate = entity?.claims?.P625?.find(claim => claim.mainsnak?.datavalue?.value)?.mainsnak?.datavalue?.value;
    const hasCoordinates = Number.isFinite(Number(coordinate?.latitude)) && Number.isFinite(Number(coordinate?.longitude));
    return {
      title: entity?.labels?.zh?.value || entity?.labels?.en?.value || spotName,
      extract: description,
      thumbnail: null,
      pageUrl: wikiTitle
        ? `https://www.wikidata.org/wiki/${encodeURIComponent(entityId)}`
        : `https://www.wikidata.org/wiki/${encodeURIComponent(entityId)}`,
      sourceId: "wikidata",
      sourceLabel: "Wikidata 結構化資料",
      location: hasCoordinates ? {
        latitude: Number(coordinate.latitude),
        longitude: Number(coordinate.longitude),
        category: "attraction",
        pageUrl: `https://www.wikidata.org/wiki/${encodeURIComponent(entityId)}`
      } : null
    };
  },

  fetchCitySummary: async function (cityName, countryName = "", cityCoordinates = null) {
    const coordinateKey = Number.isFinite(cityCoordinates?.lat) && Number.isFinite(cityCoordinates?.lng)
      ? `${cityCoordinates.lat.toFixed(3)},${cityCoordinates.lng.toFixed(3)}` : "unlocated";
    const cacheKey = `city-summary|${cityName}|${countryName}|${coordinateKey}`;
    if (this.cache[cacheKey]) return this.cache[cacheKey];
    const sources = [
      {
        fetch: () => this.fetchSource("https://zh.wikivoyage.org/api/rest_v1/page/summary/", cityName),
        label: "中文 Wikivoyage 旅遊指南"
      },
      {
        fetch: () => this.fetchSource("https://zh.wikipedia.org/api/rest_v1/page/summary/", cityName),
        label: "中文 Wikipedia 百科"
      },
      {
        fetch: () => this.fetchWikidata(cityName, countryName),
        label: "Wikidata 中文結構化資料"
      }
    ];
    const normalizeTitle = value => String(value || "").replace(/_/g, " ").normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "").normalize("NFKC").trim().toLocaleLowerCase()
      .replace(/[\s\p{P}]+/gu, "");
    const requestedCity = normalizeTitle(cityName);
    for (const source of sources) {
      try {
        const result = await source.fetch();
        const isDisambiguation = result?.type === "disambiguation"
          || /(?:可以指|可能指的是|消歧義|may refer to)/i.test(result?.extract || "");
        if (isDisambiguation) continue;
        const location = result?.location;
        const verifiedLocation = Number.isFinite(cityCoordinates?.lat) && Number.isFinite(cityCoordinates?.lng)
          && Number.isFinite(location?.latitude) && Number.isFinite(location?.longitude)
          && this.distanceKm(cityCoordinates.lat, cityCoordinates.lng, location.latitude, location.longitude) <= 35;
        const matchingArticle = requestedCity && normalizeTitle(result?.title) === requestedCity;
        if (result?.extract && (verifiedLocation || matchingArticle)) {
          const summary = {
            extract: result.extract,
            sourceLabel: source.label,
            pageUrl: result.pageUrl || null
          };
          this.cache[cacheKey] = summary;
          this.trimCache();
          return summary;
        }
      } catch (error) {
        if (error.name !== "AbortError" && !/404|查無/.test(error.message || "")) {
          console.warn("城市介紹服務暫時無法使用：", error);
        }
      }
    }
    return null;
  },

  resolveCityLocation: function (city) {
    if (Number.isFinite(city?.lat) && Number.isFinite(city?.lng)) {
      return Promise.resolve({ lat: city.lat, lng: city.lng, sourceUrl: city.coordinateSource?.sourceUrl || null, provider: city.coordinateSource?.provider || null });
    }
    if (!city?.englishName || !city?.countryName || !city?.countryCode) return Promise.resolve(null);
    const cacheKey = `journey-atlas-city-location-v2-${city.id}`;
    if (this.cityLocationRequests[cacheKey]) return this.cityLocationRequests[cacheKey];
    const cacheTtl = 180 * 24 * 60 * 60 * 1000;
    try {
      localStorage.removeItem(cacheKey.replace("-v2-", "-v1-"));
      const saved = JSON.parse(localStorage.getItem(cacheKey) || "null");
      if (saved?.fetchedAt && Date.now() - saved.fetchedAt < cacheTtl
        && Number.isFinite(saved.lat) && saved.lat >= -90 && saved.lat <= 90
        && Number.isFinite(saved.lng) && saved.lng >= -180 && saved.lng <= 180
        && saved.provider === "OpenStreetMap Nominatim"
        && /^https:\/\/www\.openstreetmap\.org\/(node|way|relation)\/\d+$/.test(saved.sourceUrl || "")) return Promise.resolve(saved);
    } catch (error) {
      console.warn("城市座標快取無法讀取：", error);
    }
    const url = "https://nominatim.openstreetmap.org/search?" + new URLSearchParams({
      q: `${city.englishName}, ${city.countryName}`,
      countrycodes: city.countryCode.toLowerCase(),
      format: "jsonv2", limit: "5", addressdetails: "1", extratags: "1"
    }).toString();
    const request = async () => {
      const waitMs = Math.max(0, this.nextNominatimAt - Date.now());
      if (waitMs) await new Promise(resolve => window.setTimeout(resolve, waitMs));
      this.nextNominatimAt = Date.now() + 1100;
      const results = await this.requestJson(url);
      const normalize = value => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
        .normalize("NFKC").trim().toLocaleLowerCase().replace(/[\s\p{P}]+/gu, "");
      const wanted = normalize(city.englishName);
      const match = (results || []).find(item => {
        if (item.address?.country_code && item.address.country_code.toUpperCase() !== city.countryCode) return false;
        const names = [item.name, item.address?.city, item.address?.town, item.address?.municipality,
          item.address?.county, ...(String(item.display_name || "").split(","))].map(normalize);
        return names.includes(wanted);
      });
      const lat = Number(match?.lat);
      const lng = Number(match?.lon);
      if (!match || !Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
      const osmType = ({ node: "node", way: "way", relation: "relation" })[String(match.osm_type || "").toLowerCase()];
      if (!osmType || !/^\d+$/.test(String(match.osm_id || ""))) return null;
      const sourceUrl = `https://www.openstreetmap.org/${osmType}/${match.osm_id}`;
      return { lat, lng, sourceUrl, provider: "OpenStreetMap Nominatim", displayName: match.display_name || city.englishName, fetchedAt: Date.now() };
    };
    const pending = this.nominatimTail.then(request, request);
    this.nominatimTail = pending.catch(() => null);
    this.cityLocationRequests[cacheKey] = pending.then(location => {
      if (location) {
        try { localStorage.setItem(cacheKey, JSON.stringify(location)); }
        catch (error) { console.warn("城市座標快取無法寫入：", error); }
      }
      return location;
    }).finally(() => {
      delete this.cityLocationRequests[cacheKey];
    });
    return this.cityLocationRequests[cacheKey];
  },

  fetchNearbyPlaces: async function (city, { radius = 20000, limit = 250 } = {}) {
    if (!Number.isFinite(city?.lat) || !Number.isFinite(city?.lng)) return [];
    const cacheKey = `journey-atlas-verified-places-v4-${city.id || `${city.lat.toFixed(2)}-${city.lng.toFixed(2)}`}`;
    const cacheTtl = 7 * 24 * 60 * 60 * 1000;
    try {
      const legacyCacheKey = `journey-atlas-osm-places-v3-${city.id || `${city.lat.toFixed(2)}-${city.lng.toFixed(2)}`}`;
      localStorage.removeItem(legacyCacheKey);
      localStorage.removeItem(legacyCacheKey.replace("-v3-", "-v2-"));
      const saved = JSON.parse(localStorage.getItem(cacheKey) || "null");
      const savedTtl = saved?.places?.length
        && (saved.places.length >= Math.min(12, limit) || saved.wikidataChecked === true)
        ? cacheTtl : 60 * 60 * 1000;
      if (saved?.fetchedAt && Date.now() - saved.fetchedAt < savedTtl && Array.isArray(saved.places)) return saved.places;
    } catch (error) {
      console.warn("OpenStreetMap 快取無法讀取：", error);
    }
    if (this.nearbyPlaceRequests[cacheKey]) return this.nearbyPlaceRequests[cacheKey];

    const query = `[out:json][timeout:15];(node["name"]["tourism"~"attraction|museum|gallery|viewpoint|zoo|theme_park|aquarium|artwork|water_park|camp_site|picnic_site"](around:${radius},${city.lat},${city.lng});way["name"]["tourism"~"attraction|museum|gallery|viewpoint|zoo|theme_park|aquarium|artwork|water_park|camp_site|picnic_site"](around:${radius},${city.lat},${city.lng});relation["name"]["tourism"~"attraction|museum|gallery|viewpoint|zoo|theme_park|aquarium|artwork|water_park|camp_site|picnic_site"](around:${radius},${city.lat},${city.lng});node["name"]["historic"~"monument|memorial|castle|archaeological_site|fort"](around:${radius},${city.lat},${city.lng});way["name"]["historic"~"monument|memorial|castle|archaeological_site|fort"](around:${radius},${city.lat},${city.lng});relation["name"]["historic"~"monument|memorial|castle|archaeological_site|fort"](around:${radius},${city.lat},${city.lng});node["name"]["amenity"~"museum|arts_centre|place_of_worship"](around:${radius},${city.lat},${city.lng});way["name"]["amenity"~"museum|arts_centre|place_of_worship"](around:${radius},${city.lat},${city.lng});relation["name"]["amenity"~"museum|arts_centre|place_of_worship"](around:${radius},${city.lat},${city.lng});node["name"]["leisure"~"park|garden|nature_reserve"](around:${radius},${city.lat},${city.lng});way["name"]["leisure"~"park|garden|nature_reserve"](around:${radius},${city.lat},${city.lng});relation["name"]["leisure"~"park|garden|nature_reserve"](around:${radius},${city.lat},${city.lng});node["name"]["natural"~"beach|waterfall|cave|spring|peak"](around:${radius},${city.lat},${city.lng});way["name"]["natural"~"beach|waterfall|cave|spring|peak"](around:${radius},${city.lat},${city.lng});relation["name"]["natural"~"beach|waterfall|cave|spring|peak"](around:${radius},${city.lat},${city.lng}););out center tags;`;
    this.nearbyPlaceRequests[cacheKey] = (async () => {
      try {
        const queryDeadline = Date.now() + this.requestTimeoutMs;
        let data = null;
        let requestError = null;
        let queryTimedOut = false;
        for (const endpoint of [
          "https://overpass-api.de/api/interpreter",
          "https://overpass.nchc.org.tw/api/interpreter"
        ]) {
          const remainingMs = queryDeadline - Date.now();
          if (remainingMs <= 0) { queryTimedOut = true; break; }
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), remainingMs);
          try {
            const response = await fetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8", "Accept": "application/json" },
              body: `data=${encodeURIComponent(query)}`,
              signal: controller.signal
            });
            if (!response.ok) throw new Error(`OpenStreetMap 地點服務回應異常 (${response.status})`);
            data = await response.json();
            break;
          } catch (error) {
            requestError = error;
            if (error.name === "AbortError" || Date.now() >= queryDeadline) {
              queryTimedOut = true;
              break;
            }
          } finally {
            clearTimeout(timeoutId);
          }
        }
        if (!data) {
          if (!queryTimedOut && requestError) console.warn(`OpenStreetMap 查詢 ${city.name || "此城市"} 暫時無法使用，改以其他來源補充。`, requestError);
          data = { elements: [] };
        }
        const fetchedAt = Date.now();
        const osmPlaces = (data.elements || []).map(element => {
          const tags = element.tags || {};
          const lat = Number(element.lat ?? element.center?.lat);
          const lng = Number(element.lon ?? element.center?.lon);
          const name = tags["name:zh"] || tags.name || tags["name:en"];
          if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
          const kind = tags.tourism || tags.historic || tags.amenity || tags.leisure || tags.natural || "place";
          const categories = {
            attraction: "景點", museum: "博物館", gallery: "美術館／畫廊", viewpoint: "觀景點",
            zoo: "動物園", theme_park: "主題樂園", aquarium: "水族館", artwork: "公共藝術",
            water_park: "水上樂園", monument: "紀念碑", memorial: "紀念地", castle: "城堡",
            archaeological_site: "考古遺址", fort: "堡壘／城牆", arts_centre: "藝術中心", place_of_worship: "宗教建築",
            park: "公園", garden: "花園", nature_reserve: "自然保護區", beach: "海灘", waterfall: "瀑布",
            cave: "洞穴", spring: "泉水", peak: "山峰", camp_site: "露營地", picnic_site: "野餐區"
          };
          const description = tags["description:zh"] || tags["description:en"] || tags.description
            || tags["short_description:zh"] || tags["short_description:en"] || tags.short_description || "";
          const wikipedia = tags.wikipedia || "";
          const wikipediaParts = wikipedia.split(":");
          const wikipediaUrl = wikipediaParts.length > 1
            ? `https://${encodeURIComponent(wikipediaParts[0])}.wikipedia.org/wiki/${encodeURIComponent(wikipediaParts.slice(1).join(" ")).replace(/%20/g, "_")}`
            : "";
          return {
            name, category: categories[kind] || "景點", lat, lng,
            note: description || "OpenStreetMap 收錄的地點；暫無補充介紹。",
            description,
            address: [tags["addr:full"], [tags["addr:street"], tags["addr:housenumber"], tags["addr:city"]].filter(Boolean).join(" ")].find(Boolean) || "",
            openingHours: tags.opening_hours || "",
            website: tags.website || tags["contact:website"] || "",
            phone: tags.phone || tags["contact:phone"] || "",
            fee: tags.fee || "",
            wheelchair: tags.wheelchair || "",
            heritage: tags.heritage || "",
            startDate: tags.start_date || tags["start_date:estimated"] || "",
            wikipedia, wikipediaUrl,
            wikidataId: tags.wikidata || "",
            sourceId: "openstreetmap", sourceLabel: "OpenStreetMap contributors",
            sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
            osmId: `${element.type}/${element.id}`,
            fetchedAt,
            sourceDatasetAt: data.osm3s?.timestamp_osm_base || null,
            distanceKm: this.distanceKm(city.lat, city.lng, lat, lng)
          };
        }).filter(Boolean)
          .filter(place => place.distanceKm <= radius / 1000)
          .sort((a, b) => a.distanceKm - b.distanceKm)
          .filter((place, index, list) => {
            const normalizeName = value => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").normalize("NFKC").trim().toLocaleLowerCase().replace(/[\s\p{P}]+/gu, "");
            return list.findIndex(candidate => normalizeName(candidate.name) === normalizeName(place.name)
              && this.distanceKm(candidate.lat, candidate.lng, place.lat, place.lng) <= 0.35) === index;
          })
          .slice(0, limit);
        let places = osmPlaces;
        let wikidataChecked = false;
        if (!queryTimedOut && Date.now() < queryDeadline && places.length < Math.min(12, limit)) {
          let wikidataPlaces = [];
          try {
            wikidataPlaces = await this.fetchWikidataNearbyPlaces(city, { radius, limit, timeoutMs: Math.max(1, queryDeadline - Date.now()) });
            wikidataChecked = true;
          } catch (error) {
            if (error.name === "AbortError") queryTimedOut = true;
            else console.warn(`Wikidata 附近地點查詢失敗（${city.name || "此城市"}）：`, error);
          }
          const normalizeName = value => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
            .normalize("NFKC").trim().toLocaleLowerCase().replace(/[\s\p{P}]+/gu, "");
          places = [...osmPlaces];
          wikidataPlaces.forEach(place => {
            const normalizedName = normalizeName(place.name);
            const duplicate = places.some(candidate => normalizeName(candidate.name) === normalizedName
              && this.distanceKm(candidate.lat, candidate.lng, place.lat, place.lng) <= 0.35);
            if (normalizedName && !duplicate && places.length < limit) places.push(place);
          });
        }
        if (!queryTimedOut && Date.now() < queryDeadline && places.length < Math.min(8, limit)) {
          try {
            const wikipediaPlaces = await this.fetchWikipediaNearbyPlaces(city, { radius, limit, timeoutMs: Math.max(1, queryDeadline - Date.now()) });
            const normalizeName = value => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
              .normalize("NFKC").trim().toLocaleLowerCase().replace(/[\s\p{P}]+/gu, "");
            wikipediaPlaces.forEach(place => {
              const normalizedName = normalizeName(place.name);
              const duplicate = places.some(candidate => normalizeName(candidate.name) === normalizedName
                && this.distanceKm(candidate.lat, candidate.lng, place.lat, place.lng) <= 0.35);
              if (normalizedName && !duplicate && places.length < limit) places.push(place);
            });
            wikidataChecked = true;
          } catch (error) {
            if (error.name !== "AbortError") console.warn(`Wikipedia 附近地點查詢失敗（${city.name || "此城市"}）：`, error);
          }
        }
        try { localStorage.setItem(cacheKey, JSON.stringify({ fetchedAt, places, wikidataChecked })); }
        catch (error) { console.warn("OpenStreetMap 地點快取無法寫入：", error); }
        return places;
      } catch (error) {
        console.warn(`無法載入 ${city.name || "此城市"} 的 OpenStreetMap 地點：`, error);
        return [];
      } finally {
        delete this.nearbyPlaceRequests[cacheKey];
      }
    })();
    return this.nearbyPlaceRequests[cacheKey];
  },

  fetchWikipediaNearbyPlaces: async function (city, { radius = 20000, limit = 250, timeoutMs = this.requestTimeoutMs } = {}) {
    if (!Number.isFinite(city?.lat) || !Number.isFinite(city?.lng)) return [];
    const radiusMeters = Math.max(1000, Math.min(50000, radius));
    const params = new URLSearchParams({
      action: "query",
      generator: "geosearch",
      ggscoord: `${city.lat}|${city.lng}`,
      ggsradius: String(radiusMeters),
      ggslimit: String(Math.max(20, Math.min(250, limit))),
      ggsnamespace: "0",
      prop: "coordinates|extracts|categories",
      exintro: "1",
      explaintext: "1",
      exsentences: "2",
      cllimit: "20",
      clshow: "!hidden",
      format: "json",
      formatversion: "2",
      origin: "*"
    });
    const fetchedAt = Date.now();
    const data = await this.requestJson(`https://en.wikipedia.org/w/api.php?${params.toString()}`, timeoutMs);
    const attractionCategory = /tourist attraction|museum|gallery|monument|memorial|park|garden|temple|church|mosque|cathedral|castle|palace|historic|heritage|archaeolog|landmark|monastery|shrine|square|bridge|tower|theatre|theater|zoo|aquarium|fort|beach|waterfall|mountain|botanical|island|cave|stadium|opera|library|market|district|plaza|building|protected area/i;
    return (data.query?.pages || []).map(page => {
      const point = page.coordinates?.[0];
      const lat = Number(point?.lat);
      const lng = Number(point?.lon);
      if (!page.title || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      const categories = (page.categories || []).map(item => String(item.title || "").replace(/^Category:/, ""));
      if (!categories.some(category => attractionCategory.test(category))) return null;
      const distanceKm = this.distanceKm(city.lat, city.lng, lat, lng);
      if (distanceKm > radiusMeters / 1000) return null;
      const categoryText = categories.join(" ").toLocaleLowerCase();
      const category = /museum|gallery/i.test(categoryText) ? "博物館與藝術"
        : /park|garden|botanical|protected area|waterfall|mountain|beach|island|cave/i.test(categoryText) ? "公園與自然"
          : /temple|church|mosque|cathedral|monastery|shrine/i.test(categoryText) ? "宗教建築"
            : /historic|heritage|archaeolog|castle|palace|fort|monument|memorial/i.test(categoryText) ? "歷史與文化遺產"
              : /district|square|plaza|market/i.test(categoryText) ? "街區與市集" : "地標與建築";
      const pageUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replaceAll(" ", "_"))}`;
      return {
        name: page.title,
        category,
        lat,
        lng,
        note: String(page.extract || "").replace(/\s+/g, " ").trim() || "Wikipedia 收錄的地點；暫無補充介紹。",
        description: String(page.extract || "").replace(/\s+/g, " ").trim(),
        wikipedia: page.title,
        wikipediaUrl: pageUrl,
        sourceId: "en-wikipedia",
        sourceLabel: "English Wikipedia geosearch",
        sourceUrl: pageUrl,
        fetchedAt,
        distanceKm
      };
    }).filter(Boolean)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, limit);
  },

  fetchWikidataNearbyPlaces: async function (city, { radius = 20000, limit = 250, timeoutMs = this.requestTimeoutMs } = {}) {
    if (!Number.isFinite(city?.lat) || !Number.isFinite(city?.lng)) return [];
    const radiusKm = Math.max(1, Math.min(50, radius / 1000));
    const query = `SELECT DISTINCT ?place ?placeLabel ?placeDescription ?coordinate ?distance ?article WHERE {
      SERVICE wikibase:around {
        ?place wdt:P625 ?coordinate.
        bd:serviceParam wikibase:center "Point(${city.lng} ${city.lat})"^^geo:wktLiteral.
        bd:serviceParam wikibase:radius "${radiusKm}".
        bd:serviceParam wikibase:distance ?distance.
      }
      VALUES ?type { wd:Q570116 wd:Q33506 wd:Q22698 wd:Q839954 wd:Q43501 wd:Q167346 wd:Q179049 wd:Q23413 wd:Q189366 wd:Q40080 }
      ?place wdt:P31/wdt:P279* ?type.
      OPTIONAL { ?article schema:about ?place; schema:isPartOf <https://en.wikipedia.org/>. }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "zh,en". }
    }
    ORDER BY ?distance
    LIMIT ${Math.max(1, Math.min(250, limit))}`;
    const url = `https://query.wikidata.org/sparql?${new URLSearchParams({ query, format: "json" }).toString()}`;
    const result = await this.requestJson(url, timeoutMs);
    const fetchedAt = Date.now();
    return (result.results?.bindings || []).map(binding => {
      const point = /^Point\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)$/i.exec(binding.coordinate?.value || "");
      const lat = point ? Number(point[2]) : NaN;
      const lng = point ? Number(point[1]) : NaN;
      const wikidataId = String(binding.place?.value || "").split("/").pop();
      const name = binding.placeLabel?.value || "";
      if (!/^Q\d+$/.test(wikidataId) || !name || !Number.isFinite(lat) || !Number.isFinite(lng)
        || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
      const distanceKm = this.distanceKm(city.lat, city.lng, lat, lng);
      if (distanceKm > radiusKm) return null;
      const articleUrl = /^https:\/\/[a-z-]+\.wikipedia\.org\/wiki\//i.test(binding.article?.value || "")
        ? binding.article.value : "";
      const description = binding.placeDescription?.value || "";
      return {
        name,
        category: "有座標的文化與觀光地點",
        lat,
        lng,
        note: description || "Wikidata 有座標條目；尚無描述資料。",
        description,
        wikipediaUrl: articleUrl,
        wikidataId,
        sourceId: "wikidata",
        sourceLabel: "Wikidata 有座標條目",
        sourceUrl: `https://www.wikidata.org/wiki/${wikidataId}`,
        fetchedAt,
        distanceKm
      };
    }).filter(Boolean)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, limit);
  },

  fetchSpotDetail: function(spotName, cityName = "", cityCoordinates = null) {
    const cacheKey = `${spotName}|${cityName}`;
    if (this.cache[cacheKey]) return Promise.resolve(this.cache[cacheKey]);
    if (this.spotDetailRequests[cacheKey]) return this.spotDetailRequests[cacheKey];
    const request = this.loadSpotDetail(spotName, cityName, cityCoordinates, cacheKey);
    this.spotDetailRequests[cacheKey] = request;
    request.then(
      () => { delete this.spotDetailRequests[cacheKey]; },
      () => { delete this.spotDetailRequests[cacheKey]; }
    );
    return request;
  },

  loadSpotDetail: async function(spotName, cityName, cityCoordinates, cacheKey) {

    const sources = [
      {
        id: "opentripmap",
        label: "OpenTripMap 旅遊景點",
        fetch: () => this.fetchOpenTripMap(spotName, cityName)
      },
      {
        id: "wikivoyage",
        label: "Wikivoyage 旅遊指南",
        fetch: () => this.fetchSource("https://en.wikivoyage.org/api/rest_v1/page/summary/", spotName)
      },
      {
        id: "wikipedia",
        label: "Wikipedia 百科",
        fetch: () => this.fetchSource("https://zh.wikipedia.org/api/rest_v1/page/summary/", spotName)
      },
      {
        id: "wikidata",
        label: "Wikidata 結構化資料",
        fetch: () => this.fetchWikidata(spotName, cityName)
      }
    ];
    const results = await Promise.all(sources.map(async source => {
      try {
        const data = await source.fetch();
        return data ? { ...data, sourceId: source.id, sourceLabel: source.label } : null;
      } catch (error) {
        if (!/404|查無/.test(error.message || "")) {
          console.warn(`${source.label} 暫時無法取得資料：`, error);
        }
        return null;
      }
    }));
    const result = results.find(item => item?.sourceId === "opentripmap")
      || results.find(item => item?.sourceId === "wikivoyage")
      || results.find(item => item?.sourceId === "wikipedia")
      || results.find(item => item?.sourceId === "wikidata");
    const [commons, nearbyPlaces] = await Promise.all([
      this.fetchCommonsImage(spotName, cityName).catch(error => {
        console.warn("Wikimedia Commons 圖片查詢失敗：", error);
        return null;
      }),
      cityCoordinates ? this.fetchNearbyPlaces(cityCoordinates).catch(() => []) : Promise.resolve([])
    ]);
    const normalizeName = value => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").normalize("NFKC").trim().toLocaleLowerCase().replace(/[\s\p{P}]+/gu, "");
    const mapData = nearbyPlaces.find(place => normalizeName(place.name) === normalizeName(spotName)) || null;
      const locationPriority = ["opentripmap", "wikipedia", "wikivoyage", "wikidata"];
    const resultLocation = locationPriority
      .flatMap(sourceId => results
        .filter(item => item?.sourceId === sourceId && item.location)
        .map(item => ({ ...item.location, sourceId: item.sourceId, sourceLabel: item.sourceLabel })))
      .find(location => Number.isFinite(cityCoordinates?.lat) && Number.isFinite(cityCoordinates?.lng)
        && Number.isFinite(location.latitude) && Number.isFinite(location.longitude)
        && location.latitude >= -90 && location.latitude <= 90
        && location.longitude >= -180 && location.longitude <= 180
        && location.category !== "city"
        && this.distanceKm(cityCoordinates.lat, cityCoordinates.lng, location.latitude, location.longitude) <= 25)
      || null;
    if (!result && !commons && !mapData) return null;

    if (result) {
      result.extract = result.extract.length > 140 ? `${result.extract.substring(0, 140)}...` : result.extract;
    }
    if (commons && !result?.thumbnail) {
      if (result) result.thumbnail = commons.thumbnail;
    }
    const enriched = {
      ...(result || { title: spotName, extract: "", thumbnail: commons?.thumbnail || null, pageUrl: null, sourceId: "commons", sourceLabel: "Wikimedia Commons" }),
      location: resultLocation || (mapData ? {
        latitude: mapData.lat, longitude: mapData.lng, category: mapData.category,
        pageUrl: mapData.sourceUrl, sourceLabel: mapData.sourceLabel
      } : null),
      nearbyPlace: mapData,
      sources: [
        ...results.filter(Boolean).map(item => ({ label: item.sourceLabel, url: item.pageUrl })),
        ...(commons ? [{ label: "Wikimedia Commons 圖片", url: commons.pageUrl }] : []),
        ...(resultLocation?.pageUrl
          ? [{ label: `${result.sourceLabel} 座標`, url: resultLocation.pageUrl }]
          : []),
        ...(mapData ? [{ label: "OpenStreetMap 地點", url: mapData.sourceUrl }] : [])
      ]
    };
    this.cache[cacheKey] = enriched;
    this.trimCache();
    return enriched;
  }
};
