// 國家基本資訊與國定假日；公開 API 無金鑰，失敗時由呼叫端以既有資料顯示。
window.NationalInfoService = {
  countryCache: new Map(),
  holidayCache: new Map(),
  timeoutMs: 6500,
  offlineCountryFacts: {
    IS: { languages: ["冰島語"], timezones: ["UTC+00:00（雷克雅維克）"], drivingSide: "right", callingCode: "+354", currencies: ["冰島克朗 (ISK)"], capitals: ["雷克雅維克"] },
    KH: { languages: ["高棉語"], timezones: ["UTC+07:00"], drivingSide: "right", callingCode: "+855", currencies: ["柬埔寨瑞爾 (KHR)"], capitals: ["金邊"] },
    MA: { languages: ["阿拉伯語", "阿馬齊格語"], timezones: ["UTC+01:00（夏令時間可能調整）"], drivingSide: "right", callingCode: "+212", currencies: ["摩洛哥迪拉姆 (MAD)"], capitals: ["拉巴特"] },
    PE: { languages: ["西班牙語", "克丘亞語", "艾馬拉語"], timezones: ["UTC−05:00"], drivingSide: "right", callingCode: "+51", currencies: ["秘魯索爾 (PEN)"], capitals: ["利馬"] },
    NP: { languages: ["尼泊爾語"], timezones: ["UTC+05:45"], drivingSide: "left", callingCode: "+977", currencies: ["尼泊爾盧比 (NPR)"], capitals: ["加德滿都"] },
    JP: { languages: ["日語"], timezones: ["UTC+09:00"], drivingSide: "left", callingCode: "+81", currencies: ["日圓 (JPY)"], capitals: ["東京"] },
    KR: { languages: ["韓語"], timezones: ["UTC+09:00"], drivingSide: "right", callingCode: "+82", currencies: ["韓圓 (KRW)"], capitals: ["首爾"] },
    TH: { languages: ["泰語"], timezones: ["UTC+07:00"], drivingSide: "left", callingCode: "+66", currencies: ["泰銖 (THB)"], capitals: ["曼谷"] },
    VN: { languages: ["越南語"], timezones: ["UTC+07:00"], drivingSide: "right", callingCode: "+84", currencies: ["越南盾 (VND)"], capitals: ["河內"] },
    SG: { languages: ["英語", "華語", "馬來語", "坦米爾語"], timezones: ["UTC+08:00"], drivingSide: "left", callingCode: "+65", currencies: ["新加坡元 (SGD)"], capitals: ["新加坡"] },
    TW: { languages: ["華語"], timezones: ["UTC+08:00"], drivingSide: "right", callingCode: "+886", currencies: ["新臺幣 (TWD)"], capitals: ["臺北"] },
    GB: { languages: ["英語"], timezones: ["UTC+00:00／UTC+01:00（夏令時間）"], drivingSide: "left", callingCode: "+44", currencies: ["英鎊 (GBP)"], capitals: ["倫敦"] },
    US: { languages: ["英語（聯邦層級未訂官方語言）"], timezones: ["多個時區（UTC−10:00 至 UTC−05:00）"], drivingSide: "right", callingCode: "+1", currencies: ["美元 (USD)"], capitals: ["華盛頓特區"] },
    CA: { languages: ["英語", "法語"], timezones: ["多個時區（UTC−08:00 至 UTC−03:30）"], drivingSide: "right", callingCode: "+1", currencies: ["加拿大元 (CAD)"], capitals: ["渥太華"] },
    FR: { languages: ["法語"], timezones: ["UTC+01:00／UTC+02:00（夏令時間）"], drivingSide: "right", callingCode: "+33", currencies: ["歐元 (EUR)"], capitals: ["巴黎"] },
    IT: { languages: ["義大利語"], timezones: ["UTC+01:00／UTC+02:00（夏令時間）"], drivingSide: "right", callingCode: "+39", currencies: ["歐元 (EUR)"], capitals: ["羅馬"] },
    ES: { languages: ["西班牙語"], timezones: ["UTC+01:00／UTC+02:00（夏令時間）"], drivingSide: "right", callingCode: "+34", currencies: ["歐元 (EUR)"], capitals: ["馬德里"] },
    DE: { languages: ["德語"], timezones: ["UTC+01:00／UTC+02:00（夏令時間）"], drivingSide: "right", callingCode: "+49", currencies: ["歐元 (EUR)"], capitals: ["柏林"] },
    PT: { languages: ["葡萄牙語"], timezones: ["UTC+00:00／UTC+01:00（夏令時間）"], drivingSide: "right", callingCode: "+351", currencies: ["歐元 (EUR)"], capitals: ["里斯本"] },
    GR: { languages: ["希臘語"], timezones: ["UTC+02:00／UTC+03:00（夏令時間）"], drivingSide: "right", callingCode: "+30", currencies: ["歐元 (EUR)"], capitals: ["雅典"] },
    AU: { languages: ["英語（主要使用語言）"], timezones: ["多個時區（UTC+08:00 至 UTC+10:30）"], drivingSide: "left", callingCode: "+61", currencies: ["澳洲元 (AUD)"], capitals: ["坎培拉"] },
    NZ: { languages: ["英語", "毛利語", "紐西蘭手語"], timezones: ["UTC+12:00／UTC+13:00（夏令時間）"], drivingSide: "left", callingCode: "+64", currencies: ["紐西蘭元 (NZD)"], capitals: ["威靈頓"] },
    EG: { languages: ["阿拉伯語"], timezones: ["UTC+02:00"], drivingSide: "right", callingCode: "+20", currencies: ["埃及鎊 (EGP)"], capitals: ["開羅"] },
    ZA: { languages: ["祖魯語", "科薩語", "南非荷蘭語", "英語"], timezones: ["UTC+02:00"], drivingSide: "left", callingCode: "+27", currencies: ["南非蘭特 (ZAR)"], capitals: ["普利托利亞", "開普敦", "布隆方丹"] },
    BR: { languages: ["葡萄牙語"], timezones: ["多個時區（UTC−05:00 至 UTC−02:00）"], drivingSide: "right", callingCode: "+55", currencies: ["巴西雷亞爾 (BRL)"], capitals: ["巴西利亞"] },
    MX: { languages: ["西班牙語"], timezones: ["多個時區（UTC−08:00 至 UTC−05:00）"], drivingSide: "right", callingCode: "+52", currencies: ["墨西哥披索 (MXN)"], capitals: ["墨西哥城"] },
    IN: { languages: ["印地語", "英語"], timezones: ["UTC+05:30"], drivingSide: "left", callingCode: "+91", currencies: ["印度盧比 (INR)"], capitals: ["新德里"] },
    ID: { languages: ["印尼語"], timezones: ["多個時區（UTC+07:00 至 UTC+09:00）"], drivingSide: "left", callingCode: "+62", currencies: ["印尼盾 (IDR)"], capitals: ["雅加達"] },
    PH: { languages: ["菲律賓語", "英語"], timezones: ["UTC+08:00"], drivingSide: "right", callingCode: "+63", currencies: ["菲律賓披索 (PHP)"], capitals: ["馬尼拉"] },
    AE: { languages: ["阿拉伯語"], timezones: ["UTC+04:00"], drivingSide: "right", callingCode: "+971", currencies: ["阿聯迪拉姆 (AED)"], capitals: ["阿布達比"] },
    TR: { languages: ["土耳其語"], timezones: ["UTC+03:00"], drivingSide: "right", callingCode: "+90", currencies: ["土耳其里拉 (TRY)"], capitals: ["安卡拉"] }
  },
  countryCodes: {
    japan: "JP", thailand: "TH", "south-korea": "KR", korea: "KR", france: "FR", iceland: "IS",
    uk: "GB", "united kingdom": "GB", usa: "US", "united states": "US", canada: "CA", vietnam: "VN",
    singapore: "SG", italy: "IT", spain: "ES", china: "CN", india: "IN", indonesia: "ID",
    germany: "DE", portugal: "PT", greece: "GR", australia: "AU", "new zealand": "NZ",
    taiwan: "TW", brazil: "BR", egypt: "EG", morocco: "MA", "south africa": "ZA", peru: "PE",
    mexico: "MX", argentina: "AR", colombia: "CO", chile: "CL", netherlands: "NL", switzerland: "CH",
    austria: "AT", czechia: "CZ", "czech republic": "CZ", ireland: "IE", russia: "RU", turkey: "TR",
    "united arab emirates": "AE", uae: "AE", qatar: "QA", "saudi arabia": "SA", iran: "IR",
    pakistan: "PK", bangladesh: "BD", philippines: "PH", cambodia: "KH", maldives: "MV", nepal: "NP", israel: "IL",
    kenya: "KE", nigeria: "NG", angola: "AO", sudan: "SD", "democratic republic of the congo": "CD",
    "日本": "JP", "泰國": "TH", "韓國": "KR", "南韓": "KR", "法國": "FR", "冰島": "IS",
    "英國": "GB", "美國": "US", "加拿大": "CA", "越南": "VN", "新加坡": "SG", "義大利": "IT",
    "西班牙": "ES", "中國": "CN", "印度": "IN", "印尼": "ID", "德國": "DE", "葡萄牙": "PT",
    "希臘": "GR", "澳洲": "AU", "紐西蘭": "NZ", "台灣": "TW", "巴西": "BR", "埃及": "EG",
    "摩洛哥": "MA", "南非": "ZA", "秘魯": "PE", "墨西哥": "MX", "阿根廷": "AR", "哥倫比亞": "CO",
    "智利": "CL", "荷蘭": "NL", "瑞士": "CH", "奧地利": "AT", "捷克": "CZ", "愛爾蘭": "IE",
    "俄羅斯": "RU", "土耳其": "TR", "阿聯": "AE", "卡達": "QA", "沙烏地阿拉伯": "SA", "伊朗": "IR",
    "巴基斯坦": "PK", "孟加拉": "BD", "菲律賓": "PH", "柬埔寨": "KH", "馬爾地夫": "MV", "尼泊爾": "NP",
    "以色列": "IL", "肯亞": "KE", "奈及利亞": "NG", "安哥拉": "AO", "蘇丹": "SD", "剛果民主共和國": "CD"
  },
  resolveCountryCode: function(name, fallbackCode = "") {
    const supplied = String(fallbackCode || "").trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(supplied)) return supplied;
    const key = String(name || "").trim().toLocaleLowerCase();
    return this.countryCodes[key] || "";
  },
  requestJson: async function(url) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`資料服務回應 ${response.status}`);
      return response.json();
    } finally { window.clearTimeout(timeout); }
  },
  getCountry: function(name, fallbackCode = "") {
    const key = String(name || "").trim().toLocaleLowerCase();
    const code = this.resolveCountryCode(name, fallbackCode);
    if (!key && !code) return Promise.resolve(null);
    const cacheKey = `${key}:${code}`;
    if (this.countryCache.has(cacheKey)) return this.countryCache.get(cacheKey);
    const fields = "name,cca2,idd,currencies,timezones,languages,car,capital";
    const requestByName = key
      ? this.requestJson(`https://restcountries.com/v3.1/name/${encodeURIComponent(name)}?fullText=true&fields=${fields}`)
      : Promise.reject(new Error("未提供國家名稱"));
    const request = requestByName.catch(error => {
      if (!code) throw error;
      return this.requestJson(`https://restcountries.com/v3.1/alpha/${code}?fields=${fields}`);
    })
      .then(items => {
        const item = Array.isArray(items) ? items[0] : items;
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
        const offline = this.offlineCountryFacts[code];
        if (offline) return { code, ...offline, source: "offline" };
        this.countryCache.delete(cacheKey);
        return null;
      });
    this.countryCache.set(cacheKey, request);
    return request;
  },
  retryCountry: function(name, fallbackCode = "") {
    const key = String(name || "").trim().toLocaleLowerCase();
    this.countryCache.delete(`${key}:${this.resolveCountryCode(name, fallbackCode)}`);
    return this.getCountry(name, fallbackCode);
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
