// 國家基本資訊與國定假日；公開 API 無金鑰，失敗時由呼叫端以既有資料顯示。
window.NationalInfoService = {
  countryCache: new Map(),
  holidayCache: new Map(),
  timeoutMs: 6500,
  requestJson: async function(url) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`資料服務回應 ${response.status}`);
      return response.json();
    } finally { window.clearTimeout(timeout); }
  },
  getCountry: function(name) {
    const key = String(name || "").trim().toLocaleLowerCase();
    if (!key) return Promise.resolve(null);
    if (this.countryCache.has(key)) return this.countryCache.get(key);
    const request = this.requestJson(`https://restcountries.com/v3.1/name/${encodeURIComponent(name)}?fullText=true&fields=name,cca2,idd,currencies,timezones,languages,car,capital`)
      .then(items => {
        const item = Array.isArray(items) ? items[0] : null;
        if (!item?.cca2) throw new Error("找不到國家行前資料");
        return {
          code: item.cca2,
          callingCode: item.idd?.root || "",
          languages: Object.values(item.languages || {}),
          timezones: item.timezones || [],
          drivingSide: item.car?.side || "",
          currencies: Object.values(item.currencies || {}).map(currency => `${currency.name || ""}${currency.symbol ? ` (${currency.symbol})` : ""}`).filter(Boolean),
          capitals: item.capital || []
        };
      })
      .catch(error => {
        console.warn("國家基本資訊暫時無法取得：", error);
        this.countryCache.delete(key);
        return null;
      });
    this.countryCache.set(key, request);
    return request;
  },
  retryCountry: function(name) {
    this.countryCache.delete(String(name || "").trim().toLocaleLowerCase());
    return this.getCountry(name);
  },
  getPublicHolidays: function(countryCode, year) {
    const code = String(countryCode || "").toUpperCase();
    const safeYear = Number(year);
    if (!/^[A-Z]{2}$/.test(code) || !Number.isInteger(safeYear) || safeYear < 2000 || safeYear > 2100) return Promise.resolve([]);
    const key = `${code}:${safeYear}`;
    if (this.holidayCache.has(key)) return this.holidayCache.get(key);
    const request = this.requestJson(`https://date.nager.at/api/v3/PublicHolidays/${safeYear}/${code}`)
      .then(items => Array.isArray(items) ? items.map(item => ({
        date: String(item.date || ""),
        name: String(item.localName || item.name || "國定假日"),
        englishName: String(item.name || ""),
        types: Array.isArray(item.types) ? item.types : []
      })).filter(item => /^\d{4}-\d{2}-\d{2}$/.test(item.date)) : [])
      .catch(error => { console.warn(`國定假日資料暫時無法取得（${code} ${safeYear}）：`, error); return null; });
    this.holidayCache.set(key, request);
    return request;
  }
};
