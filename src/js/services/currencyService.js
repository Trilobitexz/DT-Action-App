// 即時匯率服務模組 (串接 open.er-api.com 開放 API，支援快取與離線備援)
window.CurrencyService = {
  cacheKey: "travel_app_rates_cache",
  cacheDurationMs: 6 * 60 * 60 * 1000, // 快取 6 小時
  requestTimeoutMs: 10000,

  // 取得基準為 TWD 的最新匯率表
  getExchangeRates: async function() {
    try {
      const cached = localStorage.getItem(this.cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.rates && Number.isFinite(parsed.rates.JPY) && Date.now() - parsed.timestamp < this.cacheDurationMs) {
          return { data: parsed.rates, source: "cache", updateTime: parsed.time_last_update_utc };
        }
      }

      // 呼叫免金鑰開放 API；靜態網頁使用時須能連線至外部服務。
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.requestTimeoutMs);
      let res;
      try {
        res = await fetch("https://open.er-api.com/v6/latest/TWD", { signal: controller.signal });
      } finally {
        clearTimeout(timeoutId);
      }
      if (!res.ok) throw new Error(`匯率 API 回應異常 (${res.status})`);
      const json = await res.json();
      if (json.result !== "success" || !json.rates || !Number.isFinite(json.rates.JPY)) {
        throw new Error("匯率 API 回傳資料格式不正確");
      }

      const cacheData = {
        rates: json.rates,
        timestamp: Date.now(),
        time_last_update_utc: json.time_last_update_utc
      };
      try {
        localStorage.setItem(this.cacheKey, JSON.stringify(cacheData));
      } catch (storageError) {
        console.warn("無法儲存匯率快取：", storageError);
      }

      return { data: json.rates, source: "live", updateTime: json.time_last_update_utc };
    } catch (err) {
      console.warn("即時匯率拉取失敗，使用快取或備用匯率：", err);
      try {
        const cached = JSON.parse(localStorage.getItem(this.cacheKey) || "null");
        if (cached?.rates && Number.isFinite(cached.rates.JPY)) {
          return { data: cached.rates, source: "stale-cache", updateTime: cached.time_last_update_utc || "快取資料" };
        }
      } catch (storageError) {
        console.warn("讀取匯率快取失敗：", storageError);
      }
      return {
        data: { JPY: 4.82, THB: 1.13, KRW: 42.1, EUR: 0.029, GBP: 0.024, ISK: 4.31, USD: 0.031, AUD: 0.047, NZD: 0.051 },
        source: "fallback",
        updateTime: "離線預設值"
      };
    }
  },

  // 格式化換算：1 外幣 ≈ XX TWD 或 1 TWD ≈ XX 外幣
  formatRate: function(targetCurrencyCode, rates) {
    if (!rates || !Number.isFinite(rates[targetCurrencyCode]) || rates[targetCurrencyCode] <= 0) return null;
    const rateFromTwd = rates[targetCurrencyCode];
    const rateToTwd = (1 / rateFromTwd).toFixed(2);
    return `1 ${targetCurrencyCode} ≈ ${rateToTwd} TWD（1 TWD ≈ ${rateFromTwd.toFixed(2)} ${targetCurrencyCode}）`;
  },

  // 取得特定幣別對台幣的比率 (1 外幣 = 多少 TWD)
  getRateToTwd: function(targetCurrencyCode, rates) {
    if (!rates || !Number.isFinite(rates[targetCurrencyCode]) || rates[targetCurrencyCode] <= 0) return null;
    return 1 / rates[targetCurrencyCode];
  }
};
