// 城市即時氣候服務模組 (串接 Open-Meteo 免金鑰全球氣象 API)
window.WeatherService = {
  cache: {},
  storageKey: "journey-atlas-weather-cache",
  cacheDurationMs: 30 * 60 * 1000, // 快取 30 分鐘
  cacheRetentionMs: 7 * 24 * 60 * 60 * 1000, // 失敗時最多保留 7 天的離線備援
  airQualityCache: {},
  airQualityStorageKey: "journey-atlas-air-quality-v1",
  airQualityCacheDurationMs: 60 * 60 * 1000,
  airQualityRetentionMs: 24 * 60 * 60 * 1000,
  airQualityRequests: {},
  maxCacheEntries: 100,
  requestTimeoutMs: 10000,

  // 天氣可重新取得；清除損壞、過期與超出上限的項目，保留近期離線備援。
  pruneCache: function() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      let stored;
      try { stored = JSON.parse(raw || "{}"); }
      catch (error) {
        localStorage.removeItem(this.storageKey);
        this.cache = {};
        return;
      }
      const now = Date.now();
      const entries = stored && typeof stored === "object" && !Array.isArray(stored)
        ? Object.entries(stored).filter(([key, entry]) => {
          const data = entry?.data;
          return /^-?\d+(?:\.\d{1,2})?,-?\d+(?:\.\d{1,2})?$/.test(key)
            && Number.isFinite(entry?.timestamp)
            && entry.timestamp <= now + 5 * 60 * 1000
            && now - entry.timestamp <= this.cacheRetentionMs
            && data && typeof data === "object"
            && Number.isFinite(data.temperature)
            && Number.isFinite(data.humidity)
            && Number.isFinite(data.windSpeed)
            && typeof data.description === "string"
            && typeof data.icon === "string";
        }).sort((a, b) => b[1].timestamp - a[1].timestamp).slice(0, this.maxCacheEntries)
        : [];
      const cleaned = Object.fromEntries(entries);
      const serialized = JSON.stringify(cleaned);
      if (localStorage.getItem(this.storageKey) !== serialized) {
        if (entries.length) localStorage.setItem(this.storageKey, serialized);
        else localStorage.removeItem(this.storageKey);
      }
      this.cache = cleaned;
    } catch (error) {
      console.warn("整理天氣快取失敗：", error);
    }
  },

  // 取得 Open-Meteo 當前天氣（預報模型的 current 值，非觀測站保證即時實測）
  getCityWeather: async function(lat, lng) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    const cacheKey = `${lat.toFixed(2)},${lng.toFixed(2)}`;
    
    if (this.cache[cacheKey] && (Date.now() - this.cache[cacheKey].timestamp < this.cacheDurationMs)) {
      return this.cache[cacheKey].data;
    }
    let storedCache = {};
    try {
      const parsed = JSON.parse(localStorage.getItem(this.storageKey) || "{}");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) storedCache = parsed;
    } catch (error) {
      console.warn("讀取天氣快取失敗：", error);
    }
    const storedEntry = storedCache[cacheKey];
    if (storedEntry?.data && Number.isFinite(storedEntry.timestamp) &&
      Date.now() - storedEntry.timestamp < this.cacheDurationMs) {
      this.cache[cacheKey] = storedEntry;
      return storedEntry.data;
    }

    try {
      const params = new URLSearchParams({
        latitude: String(lat),
        longitude: String(lng),
        current: "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m",
        timezone: "auto"
      });
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.requestTimeoutMs);
      let json;
      try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: controller.signal });
        if (!res.ok) throw new Error(`天氣 API 回應異常 (${res.status})`);
        json = await res.json();
      } finally {
        clearTimeout(timeoutId);
      }
      if (json.error || !json.current) throw new Error(json.reason || "天氣 API 缺少目前資料");
      const requiredValues = [json.current.temperature_2m, json.current.relative_humidity_2m, json.current.weather_code, json.current.wind_speed_10m];
      if (!requiredValues.every(Number.isFinite)) throw new Error("天氣 API 回傳的目前資料不完整");
      
      const current = json.current;
      const weatherInfo = this.interpretWeatherCode(current.weather_code);

      const result = {
        temperature: Math.round(current.temperature_2m),
        humidity: current.relative_humidity_2m,
        windSpeed: current.wind_speed_10m,
        description: weatherInfo.text,
        icon: weatherInfo.icon,
        time: current.time,
        timezone: json.timezone || "",
        source: "Open-Meteo"
      };

      this.cache[cacheKey] = {
        data: result,
        timestamp: Date.now()
      };
      try {
        storedCache[cacheKey] = this.cache[cacheKey];
        localStorage.setItem(this.storageKey, JSON.stringify(storedCache));
        this.pruneCache();
      } catch (error) {
        console.warn("儲存天氣快取失敗：", error);
      }

      return result;
    } catch (e) {
      console.warn("即時天氣拉取失敗：", e);
      if (storedEntry?.data) {
        const staleData = { ...storedEntry.data, source: "Open-Meteo（快取）" };
        this.cache[cacheKey] = { data: staleData, timestamp: storedEntry.timestamp };
        return staleData;
      }
      return null;
    }
  },

  // Open-Meteo Air Quality 全球模式估值，不是城市測站的即時讀值。
  getCityAirQuality: async function(lat, lng) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
    const now = Date.now();
    const inMemory = this.airQualityCache[key];
    if (inMemory && now - inMemory.timestamp < this.airQualityCacheDurationMs) return inMemory.data;

    let stored = {};
    try {
      const parsed = JSON.parse(localStorage.getItem(this.airQualityStorageKey) || "{}");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) stored = parsed;
    } catch (error) { console.warn("讀取空氣品質快取失敗：", error); }
    const cached = stored[key];
    if (cached?.data && Number.isFinite(cached.timestamp) && now - cached.timestamp < this.airQualityCacheDurationMs) {
      this.airQualityCache[key] = cached;
      return cached.data;
    }
    if (this.airQualityRequests[key]) return this.airQualityRequests[key];

    this.airQualityRequests[key] = (async () => {
      try {
        const params = new URLSearchParams({
          latitude: String(lat), longitude: String(lng),
          current: "us_aqi,pm2_5,pm10", timezone: "auto"
        });
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6500);
        let json;
        try {
          const response = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${params}`, { signal: controller.signal });
          if (!response.ok) throw new Error(`空氣品質 API 回應異常 (${response.status})`);
          json = await response.json();
        } finally { clearTimeout(timeoutId); }
        const current = json?.current;
        if (!current || !Number.isFinite(current.us_aqi)) throw new Error("空氣品質 API 沒有有效的 AQI 資料");
        const aqi = Math.max(0, Math.round(current.us_aqi));
        const level = aqi <= 50 ? { label: "良好", icon: "🟢" }
          : aqi <= 100 ? { label: "普通", icon: "🟡" }
            : aqi <= 150 ? { label: "敏感族群留意", icon: "🟠" }
              : aqi <= 200 ? { label: "不健康", icon: "🔴" }
                : aqi <= 300 ? { label: "非常不健康", icon: "🟣" }
                  : { label: "危害", icon: "🟤" };
        const result = {
          aqi,
          level: level.label,
          icon: level.icon,
          pm25: Number.isFinite(current.pm2_5) ? current.pm2_5 : null,
          pm10: Number.isFinite(current.pm10) ? current.pm10 : null,
          time: current.time || "",
          timezone: json.timezone || "",
          source: "Open-Meteo Air Quality（全球模式估值）"
        };
        const entry = { data: result, timestamp: Date.now() };
        this.airQualityCache[key] = entry;
        stored[key] = entry;
        const retained = Object.entries(stored)
          .filter(([cacheKey, item]) => /^-?\d+(?:\.\d{1,2})?,-?\d+(?:\.\d{1,2})?$/.test(cacheKey)
            && Number.isFinite(item?.timestamp) && Date.now() - item.timestamp <= this.airQualityRetentionMs && item.data)
          .sort((a, b) => b[1].timestamp - a[1].timestamp).slice(0, 100);
        try { localStorage.setItem(this.airQualityStorageKey, JSON.stringify(Object.fromEntries(retained))); }
        catch (error) { console.warn("儲存空氣品質快取失敗：", error); }
        return result;
      } catch (error) {
        console.warn("空氣品質資料暫時無法取得：", error);
        if (cached?.data && Number.isFinite(cached.timestamp) && now - cached.timestamp < this.airQualityRetentionMs) {
          const stale = { ...cached.data, source: "Open-Meteo Air Quality（舊快取估值）" };
          this.airQualityCache[key] = { data: stale, timestamp: cached.timestamp };
          return stale;
        }
        return null;
      } finally { delete this.airQualityRequests[key]; }
    })();
    return this.airQualityRequests[key];
  },

  // WMO 天氣代碼對應表
  interpretWeatherCode: function(code) {
    if (code === 0) return { text: "晴朗", icon: "☀️" };
    if (code === 1 || code === 2) return { text: "多雲時晴", icon: "🌤️" };
    if (code === 3) return { text: "陰天", icon: "☁️" };
    if (code >= 45 && code <= 48) return { text: "有霧", icon: "🌫️" };
    if (code >= 51 && code <= 55) return { text: "毛毛雨", icon: "🌦️" };
    if (code >= 61 && code <= 65) return { text: "降雨", icon: "🌧️" };
    if (code >= 71 && code <= 77) return { text: "降雪", icon: "❄️" };
    if (code >= 80 && code <= 82) return { text: "陣雨", icon: "🌧️" };
    if (code >= 95) return { text: "雷雨", icon: "⛈️" };
    return { text: "局部多雲", icon: "⛅" };
  }
};

window.WeatherService.pruneCache();
