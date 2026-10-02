// 即時匯率服務模組 (串接 open.er-api.com 開放 API，支援快取與離線備援)
window.CurrencyService = {
  cacheKey: "travel_app_rates_cache",
  cacheDurationMs: 6 * 60 * 60 * 1000, // 快取 6 小時

  // 取得基準為 TWD 的即時匯率表
  getExchangeRates: async function() {
    try {
      const cached = localStorage.getItem(this.cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < this.cacheDurationMs) {
          return { data: parsed.rates, source: "cache", updateTime: parsed.time_last_update_utc };
        }
      }

      // 呼叫免金鑰開放 API
      const res = await fetch("https://open.er-api.com/v6/latest/TWD");
      if (!res.ok) throw new Error("匯率 API 響應異常");
      const json = await res.json();

      localStorage.setItem(this.cacheKey, JSON.stringify({
        rates: json.rates,
        timestamp: Date.now(),
        time_last_update_utc: json.time_last_update_utc
      }));

      return { data: json.rates, source: "live", updateTime: json.time_last_update_utc };
    } catch (err) {
      console.warn("即時匯率拉取失敗，使用內建備用匯率：", err);
      return {
        data: { JPY: 4.82, THB: 1.13, EUR: 0.029, ISK: 4.31, USD: 0.031, AUD: 0.047 },
        source: "fallback",
        updateTime: "離線預設值"
      };
    }
  },

  // 格式化換算：1 外幣 ≈ XX TWD 或 1 TWD ≈ XX 外幣
  formatRate: function(targetCurrencyCode, rates) {
    if (!rates || !rates[targetCurrencyCode]) return null;
    const rateFromTwd = rates[targetCurrencyCode];
    const rateToTwd = (1 / rateFromTwd).toFixed(2);
    return `1 ${targetCurrencyCode} ≈ ${rateToTwd} TWD（1 TWD ≈ ${rateFromTwd.toFixed(2)} ${targetCurrencyCode}）`;
  }
};
