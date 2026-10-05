// 城市即時氣候服務模組 (串接 Open-Meteo 免金鑰全球氣象 API)
window.WeatherService = {
  cache: {},
  cacheDurationMs: 30 * 60 * 1000, // 快取 30 分鐘

  // 取得城市即時天氣與氣溫
  getCityWeather: async function(lat, lng) {
    if (!lat || !lng) return null;
    const cacheKey = `${lat.toFixed(2)},${lng.toFixed(2)}`;
    
    if (this.cache[cacheKey] && (Date.now() - this.cache[cacheKey].timestamp < this.cacheDurationMs)) {
      return this.cache[cacheKey].data;
    }

    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("天氣 API 連線異常");
      const json = await res.json();
      
      const current = json.current;
      const weatherInfo = this.interpretWeatherCode(current.weather_code);

      const result = {
        temperature: Math.round(current.temperature_2m),
        humidity: current.relative_humidity_2m,
        windSpeed: current.wind_speed_10m,
        description: weatherInfo.text,
        icon: weatherInfo.icon,
        time: current.time
      };

      this.cache[cacheKey] = {
        data: result,
        timestamp: Date.now()
      };

      return result;
    } catch (e) {
      console.warn("即時天氣拉取失敗：", e);
      return null;
    }
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
