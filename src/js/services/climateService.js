// Open-Meteo ERA5 historical archive; calculates a ten-year monthly climate baseline.
window.ClimateService = {
  cache: new Map(),
  storageKey: "journey-atlas-climate-monthly-v1",
  timeoutMs: 12000,
  retentionMs: 60 * 24 * 60 * 60 * 1000,
  getMonthlyNormals: async function(latitude, longitude) {
    const lat = Number(latitude), lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
    const memory = this.cache.get(key);
    if (memory && Date.now() - memory.timestamp < this.retentionMs) return memory.data;
    let stored = {};
    try {
      stored = JSON.parse(localStorage.getItem(this.storageKey) || "{}");
      if (!stored || typeof stored !== "object" || Array.isArray(stored)) stored = {};
    } catch { stored = {}; }
    const saved = stored[key];
    if (saved?.data && Date.now() - saved.timestamp < this.retentionMs) {
      this.cache.set(key, saved);
      return saved.data;
    }
    const endYear = new Date().getUTCFullYear() - 1;
    const params = new URLSearchParams({
      latitude: String(lat), longitude: String(lng), start_date: `${endYear - 9}-01-01`, end_date: `${endYear}-12-31`,
      daily: "temperature_2m_mean,precipitation_sum", timezone: "auto"
    });
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`https://archive-api.open-meteo.com/v1/archive?${params}`, { signal: controller.signal });
      if (!response.ok) throw new Error(`Open-Meteo archive ${response.status}`);
      const payload = await response.json();
      const dates = payload.daily?.time || [];
      const temperatures = payload.daily?.temperature_2m_mean || [];
      const precipitation = payload.daily?.precipitation_sum || [];
      const months = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, years: new Map() }));
      dates.forEach((date, index) => {
        const year = Number(String(date).slice(0, 4));
        const monthIndex = Number(String(date).slice(5, 7)) - 1;
        const bucket = months[monthIndex];
        if (!bucket || !Number.isInteger(year)) return;
        if (!bucket.years.has(year)) bucket.years.set(year, { tempTotal: 0, tempCount: 0, rainTotal: 0 });
        const annualMonth = bucket.years.get(year);
        const temp = Number(temperatures[index]), rain = Number(precipitation[index]);
        if (Number.isFinite(temp)) { annualMonth.tempTotal += temp; annualMonth.tempCount += 1; }
        if (Number.isFinite(rain)) annualMonth.rainTotal += rain;
      });
      const data = months.map(item => {
        const yearly = [...item.years.values()];
        const temperatureYears = yearly.filter(year => year.tempCount);
        return {
          month: item.month,
          temperatureC: temperatureYears.length ? Math.round(temperatureYears.reduce((sum, year) => sum + year.tempTotal / year.tempCount, 0) / temperatureYears.length * 10) / 10 : null,
          precipitationMm: yearly.length ? Math.round(yearly.reduce((sum, year) => sum + year.rainTotal, 0) / yearly.length) : null,
          sampleYears: yearly.length
        };
      });
      if (data.every(item => item.temperatureC === null && item.precipitationMm === null)) return null;
      const entry = { timestamp: Date.now(), data };
      this.cache.set(key, entry);
      stored[key] = entry;
      const recent = Object.entries(stored).filter(([, value]) => Number.isFinite(value?.timestamp) && Date.now() - value.timestamp < this.retentionMs)
        .sort((a, b) => b[1].timestamp - a[1].timestamp).slice(0, 60);
      try { localStorage.setItem(this.storageKey, JSON.stringify(Object.fromEntries(recent))); } catch { /* 私密瀏覽可能停用本機儲存 */ }
      return data;
    } catch (error) {
      console.warn("歷史氣候資料暫時無法取得：", error);
      return saved?.data || null;
    } finally { window.clearTimeout(timeout); }
  }
};
