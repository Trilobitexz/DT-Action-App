// 景點即時資訊服務 (整合旅遊、結構化地理與圖片 API)
window.SpotService = {
  cache: {},
  openTripMapApiKey: "",
  requestTimeoutMs: 10000,
  requestQueue: [],
  activeRequests: 0,
  scheduledRequests: 0,
  maxConcurrentRequests: 3,
  requestIntervalMs: 250,
  nextRequestAt: 0,
  maxCacheEntries: 120,

  requestJson: function (url) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ url, resolve, reject });
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
        this.activeRequests += 1;
        this.runRequest(request.url)
          .then(request.resolve, request.reject)
          .finally(() => {
            this.activeRequests -= 1;
            this.processRequestQueue();
          });
      }, Math.max(0, startAt - now));
    }
  },

  runRequest: async function (url) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeoutMs);
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
      thumbnail: data.thumbnail?.source || null,
      pageUrl: data.content_urls?.desktop?.page || null
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
      `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(entityId)}&props=labels|descriptions|sitelinks&languages=zh|en&format=json&origin=*`
    );
    const entity = entityData.entities?.[entityId];
    const description = entity?.descriptions?.zh?.value || entity?.descriptions?.en?.value || "";
    const wikiTitle = entity?.sitelinks?.zhwiki?.title || entity?.sitelinks?.enwiki?.title;
    return {
      title: entity?.labels?.zh?.value || entity?.labels?.en?.value || spotName,
      extract: description,
      thumbnail: null,
      pageUrl: wikiTitle
        ? `https://www.wikidata.org/wiki/${encodeURIComponent(entityId)}`
        : `https://www.wikidata.org/wiki/${encodeURIComponent(entityId)}`,
      sourceId: "wikidata",
      sourceLabel: "Wikidata 結構化資料"
    };
  },

  fetchCitySummary: async function (cityName, countryName = "") {
    const cacheKey = `city-summary|${cityName}|${countryName}`;
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
    for (const source of sources) {
      try {
        const result = await source.fetch();
        if (result?.extract) {
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
        if (!/404|查無/.test(error.message || "")) {
          console.warn("城市介紹服務暫時無法使用：", error);
        }
      }
    }
    return null;
  },

  fetchOpenStreetMap: async function (spotName, cityName) {
    const cleanName = spotName.split("(")[0].trim();
    const query = encodeURIComponent(cityName ? `${cleanName}, ${cityName}` : cleanName);
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&q=${query}`;
    const data = await this.requestJson(url);
    const place = data[0];
    if (!place) throw new Error("OpenStreetMap 查無地點");
    return {
      latitude: Number(place.lat),
      longitude: Number(place.lon),
      address: place.display_name,
      category: place.type || place.class || "place",
      pageUrl: `https://www.openstreetmap.org/?mlat=${encodeURIComponent(place.lat)}&mlon=${encodeURIComponent(place.lon)}#map=18/${encodeURIComponent(place.lat)}/${encodeURIComponent(place.lon)}`
    };
  },

  fetchSpotDetail: async function(spotName, cityName = "", cityCoordinates = null) {
    const cacheKey = `${spotName}|${cityName}`;
    if (this.cache[cacheKey]) return this.cache[cacheKey];

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
    const [commons, rawMapData] = await Promise.all([
      this.fetchCommonsImage(spotName, cityName).catch(error => {
        console.warn("Wikimedia Commons 圖片查詢失敗：", error);
        return null;
      }),
      this.fetchOpenStreetMap(spotName, cityName).catch(error => {
        if (!/查無/.test(error.message || "")) {
          console.warn("OpenStreetMap 地點服務暫時無法使用：", error);
        }
        return null;
      })
    ]);
    const mapData = rawMapData && Number.isFinite(cityCoordinates?.lat) && Number.isFinite(cityCoordinates?.lng)
      && Number.isFinite(rawMapData.latitude) && Number.isFinite(rawMapData.longitude)
      && this.distanceKm(cityCoordinates.lat, cityCoordinates.lng, rawMapData.latitude, rawMapData.longitude) <= 150
      ? rawMapData
      : rawMapData && !cityCoordinates
        ? rawMapData
        : null;
    if (rawMapData && !mapData) {
      console.warn(`OpenStreetMap 回傳的「${spotName}」位置與${cityName}距離過遠，已忽略該座標。`);
    }
    const directoryLocation = Number.isFinite(cityCoordinates?.lat) && Number.isFinite(cityCoordinates?.lng)
      ? {
        latitude: cityCoordinates.lat,
        longitude: cityCoordinates.lng,
        address: `${cityName}（城市目錄座標）`,
        category: "city",
        pageUrl: `https://www.openstreetmap.org/?mlat=${encodeURIComponent(cityCoordinates.lat)}&mlon=${encodeURIComponent(cityCoordinates.lng)}#map=12/${encodeURIComponent(cityCoordinates.lat)}/${encodeURIComponent(cityCoordinates.lng)}`
      }
      : null;
    if (!result && !commons && !mapData && !directoryLocation) return null;

    if (result) {
      result.extract = result.extract.length > 140 ? `${result.extract.substring(0, 140)}...` : result.extract;
    }
    if (commons && !result?.thumbnail) {
      if (result) result.thumbnail = commons.thumbnail;
    }
    const enriched = {
      ...(result || { title: spotName, extract: "", thumbnail: commons?.thumbnail || null, pageUrl: null, sourceId: "commons", sourceLabel: "Wikimedia Commons" }),
      location: result?.location || mapData || directoryLocation,
      sources: [
        ...results.filter(Boolean).map(item => ({ label: item.sourceLabel, url: item.pageUrl })),
        ...(commons ? [{ label: "Wikimedia Commons 圖片", url: commons.pageUrl }] : []),
        ...(result?.location?.pageUrl && result.location !== mapData
          ? [{ label: `${result.sourceLabel} 座標`, url: result.location.pageUrl }]
          : []),
        ...(mapData ? [{ label: "OpenStreetMap 地點", url: mapData.pageUrl }] : []),
        ...(!mapData && directoryLocation ? [{ label: "城市目錄座標", url: directoryLocation.pageUrl }] : [])
      ]
    };
    this.cache[cacheKey] = enriched;
    this.trimCache();
    return enriched;
  }
};
