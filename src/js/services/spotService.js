// 景點即時資訊服務 (整合 Wikivoyage 旅遊指南與 Wikipedia 百科 API)
window.SpotService = {
  cache: {},

  requestJson: async function (url) {
    const res = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!res.ok) throw new Error(`旅遊資料 API 回應異常 (${res.status})`);
    return res.json();
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
        id: "wikivoyage",
        label: "Wikivoyage 旅遊指南",
        baseUrl: "https://en.wikivoyage.org/api/rest_v1/page/summary/"
      },
      {
        id: "wikipedia",
        label: "Wikipedia 百科",
        baseUrl: "https://zh.wikipedia.org/api/rest_v1/page/summary/"
      }
    ];
    const results = await Promise.all(sources.map(async source => {
      try {
        const data = await this.fetchSource(source.baseUrl, spotName);
        return { ...data, sourceId: source.id, sourceLabel: source.label };
      } catch (error) {
        console.warn(`${source.label} 查詢失敗：`, error);
        return null;
      }
    }));
    const result = results.find(item => item?.sourceId === "wikivoyage")
      || results.find(item => item?.sourceId === "wikipedia");
    const [commons, mapData] = await Promise.all([
      this.fetchCommonsImage(spotName, cityName).catch(error => {
        console.warn("Wikimedia Commons 圖片查詢失敗：", error);
        return null;
      }),
      this.fetchOpenStreetMap(spotName, cityName).catch(error => {
        console.warn("OpenStreetMap 地點查詢失敗：", error);
        return null;
      })
    ]);
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
      location: mapData || directoryLocation,
      sources: [
        ...results.filter(Boolean).map(item => ({ label: item.sourceLabel, url: item.pageUrl })),
        ...(commons ? [{ label: "Wikimedia Commons 圖片", url: commons.pageUrl }] : []),
        ...(mapData ? [{ label: "OpenStreetMap 地點", url: mapData.pageUrl }] : []),
        ...(!mapData && directoryLocation ? [{ label: "城市目錄座標", url: directoryLocation.pageUrl }] : [])
      ]
    };
    this.cache[cacheKey] = enriched;
    return enriched;
  }
};
