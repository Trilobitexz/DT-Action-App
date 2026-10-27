// 個人化推薦、城市比較、預算與行程工具
function readStoredJson(key, fallback) {
  try {
    const rawValue = localStorage.getItem(key);
    if (!rawValue) return fallback;
    return JSON.parse(rawValue);
  } catch (error) {
    console.warn(`旅遊規劃資料 ${key} 格式無法讀取，已使用預設值。`, error);
    return fallback;
  }
}

function readStoredArray(key) {
  const value = readStoredJson(key, []);
  return Array.isArray(value) ? value : [];
}

window.PlannerView = {
  compareIds: readStoredArray("journey-atlas-compare"),
  favoriteIds: readStoredArray("journey-atlas-favorites"),
  recentStorageKey: "journey-atlas-recent",
  itineraryStorageKey: "journey-atlas-itineraries",
  itineraryDays: 5,

  init: function () {
    const form = document.getElementById("recommendation-form");
    if (form && !form.dataset.bound) {
      form.dataset.bound = "true";
      form.addEventListener("submit", event => {
        event.preventDefault();
        this.renderRecommendations(new FormData(form));
      });
    }
    this.renderRecommendations();
    this.renderComparison();
    this.renderRecentDestinations();
  },

  getRecentDestinations: function () {
    const recent = readStoredArray(this.recentStorageKey);
    return recent.filter(item => item && typeof item.id === "string" && ["global", "local"].includes(item.type));
  },

  recordRecentDestination: function (city, type = "global", countryId = null) {
    if (!city?.id) return;
    const recent = this.getRecentDestinations().filter(item => !(item.id === city.id && item.type === type));
    recent.unshift({ id: city.id, type, countryId, viewedAt: Date.now() });
    try {
      localStorage.setItem(this.recentStorageKey, JSON.stringify(recent.slice(0, 5)));
    } catch (error) {
      console.warn("無法儲存最近瀏覽城市。", error);
    }
    this.renderRecentDestinations();
  },

  renderRecentDestinations: function () {
    const panel = document.getElementById("recent-destinations-panel");
    if (!panel) return;
    const recent = this.getRecentDestinations().map(item => {
      const city = item.type === "global"
        ? (window.TRAVEL_DATA.globalCities || []).find(candidate => candidate.id === item.id)
        : (window.TRAVEL_DATA.countries || []).flatMap(country => country.cities.map(city => ({ ...city, countryId: country.id, countryName: country.name, flag: country.flag }))).find(candidate => candidate.id === item.id && candidate.countryId === item.countryId);
      return city ? { ...item, city } : null;
    }).filter(Boolean);
    if (!recent.length) {
      panel.innerHTML = "";
      panel.hidden = true;
      return;
    }
    panel.hidden = false;
    panel.innerHTML = `
      <div class="recent-heading"><div><span class="section-kicker">CONTINUE EXPLORING</span><h2 id="recent-destinations-heading">繼續上次探索</h2><p>快速回到最近看過的城市。</p></div><button type="button" class="text-action" id="btn-clear-recent">清除紀錄</button></div>
      <div class="recent-destination-list">${recent.map(({ city, type, countryId }) => `
        <button type="button" class="recent-destination-card" data-recent-id="${city.id}" data-recent-type="${type}" data-country-id="${countryId || ""}">
          <span>${city.flag || "🌍"}</span><strong>${city.name}</strong><small>${city.countryName || ""}</small><b>繼續 →</b>
        </button>
      `).join("")}</div>
    `;
    panel.querySelector("#btn-clear-recent").addEventListener("click", () => {
      try { localStorage.removeItem(this.recentStorageKey); } catch (error) { console.warn("無法清除最近瀏覽紀錄。", error); }
      this.renderRecentDestinations();
    });
    panel.querySelectorAll("[data-recent-id]").forEach(button => button.addEventListener("click", () => {
      if (button.dataset.recentType === "global") {
        window.appNavigate("global-city", { cityId: button.dataset.recentId });
      } else {
        window.appNavigate("country", { countryId: button.dataset.countryId, cityId: button.dataset.recentId });
      }
    }));
  },

  toggleFavorite: function (key) {
    const index = this.favoriteIds.indexOf(key);
    if (index >= 0) this.favoriteIds.splice(index, 1);
    else this.favoriteIds.push(key);
    try {
      localStorage.setItem("journey-atlas-favorites", JSON.stringify(this.favoriteIds));
    } catch (error) {
      console.warn("無法儲存收藏項目，將在本次頁面工作階段保留。", error);
    }
    return this.favoriteIds.includes(key);
  },

  isFavorite: function (key) {
    return this.favoriteIds.includes(key);
  },

  allCities: function () {
    const globalCities = window.TRAVEL_DATA.globalCities || [];
    const localCities = (window.TRAVEL_DATA.countries || []).flatMap(country =>
      country.cities.map(city => ({ ...city, countryName: country.name, flag: country.flag, countryId: country.id }))
    );
    return [...globalCities, ...localCities].filter((city, index, list) =>
      list.findIndex(item => item.name === city.name && item.countryName === city.countryName) === index
    );
  },

  renderRecommendations: function (formData) {
    const result = document.getElementById("recommendation-results");
    if (!result) return;
    const style = formData?.get("style") || "culture";
    const budget = formData?.get("budget") || "medium";
    const days = Number(formData?.get("days") || 5);
    const direct = formData?.get("direct") === "yes";
    const styleLabel = {
      culture: "文化與歷史",
      food: "美食與在地味",
      nature: "自然與風景",
      shopping: "購物與都會",
      relax: "休閒與度假"
    }[style] || "城市探索";
    const budgetLabel = {
      low: "親民",
      medium: "均衡",
      high: "高享受"
    }[budget] || "均衡";

    const score = city => {
      let value = city.culture ? 44 : 30;
      const text = `${city.name} ${city.countryName || ""} ${city.description || ""}`.toLowerCase();
      if (style === "food" && /大阪|曼谷|東京|新加坡|香港|bangkok|osaka|tokyo|singapore/.test(text)) value += 30;
      if (style === "nature" && /峇里|雪梨|奧克蘭|開普敦|honolulu|bali|sydney/.test(text)) value += 30;
      if (style === "shopping" && /東京|大阪|首爾|杜拜|巴黎|tokyo|seoul|dubai|paris/.test(text)) value += 30;
      if (style === "relax" && /峇里|普吉|檀香山|santorini|bali|phuket|honolulu/.test(text)) value += 30;
      if (style === "culture" && city.history) value += 24;
      if (budget === "low" && /曼谷|清邁|河內|暹粒|bangkok|chiang|hanoi|siem/.test(text)) value += 20;
      if (budget === "high" && /巴黎|倫敦|東京|雪梨|paris|london|tokyo|sydney/.test(text)) value += 15;
      if (direct && city.countryName && /日本|韓國|泰國|新加坡|越南|香港/.test(city.countryName)) value += 8;
      if (days >= 7) value += 8;
      if (days <= 3) value += 4;
      return value;
    };

    const getFitTag = (value) => {
      if (value >= 83) return "高適配";
      if (value >= 72) return "適配良好";
      return "可考慮";
    };

    const recommendations = this.allCities().map(city => {
      const value = score(city);
      const reasons = [];
      const text = `${city.name} ${city.countryName || ""} ${city.description || ""}`.toLowerCase();
      if (style === "culture" && city.history) reasons.push("文化行程佳");
      if (style === "food" && /大阪|曼谷|東京|新加坡|香港|bangkok|osaka|tokyo|singapore/.test(text)) reasons.push("美食熱點");
      if (style === "nature" && /峇里|雪梨|奧克蘭|開普敦|honolulu|bali|sydney/.test(text)) reasons.push("自然景觀強");
      if (style === "shopping" && /東京|大阪|首爾|杜拜|巴黎|tokyo|seoul|dubai|paris/.test(text)) reasons.push("購物機能強");
      if (style === "relax" && /峇里|普吉|檀香山|santorini|bali|phuket|honolulu/.test(text)) reasons.push("度假氛圍強");
      if (budget === "low" && /曼谷|清邁|河內|暹粒|bangkok|chiang|hanoi|siem/.test(text)) reasons.push("小資友善");
      if (budget === "high" && /巴黎|倫敦|東京|雪梨|paris|london|tokyo|sydney/.test(text)) reasons.push("高質旅遊");
      if (direct && city.countryName && /日本|韓國|泰國|新加坡|越南|香港/.test(city.countryName)) reasons.push("直飛便利");
      if (days >= 7) reasons.push("深度旅行適合");
      return { city, value: Math.min(Math.max(value, 45), 99), fit: getFitTag(value), reasons: reasons.slice(0, 2) };
    }).sort((a, b) => b.value - a.value).slice(0, 3);

    if (!recommendations.length) {
      result.innerHTML = `
        <div class="recommendation-empty-state">
          <strong>目前沒有符合條件的推薦</strong>
          <span>請放寬預算或改變旅行風格，讓系統重新計算更適合你的旅程。</span>
        </div>
      `;
      return;
    }

    result.innerHTML = `
      <div class="recommendation-result-heading">
        <strong>為你挑出的 ${days} 日旅行候選</strong>
        <span>${direct ? "依直飛便利度與旅行風格" : "依旅遊適配度與旅程節奏"}</span>
      </div>
      <div class="recommendation-result-list">${recommendations.map(({ city, value, fit, reasons }) => `
        <button type="button" class="recommendation-result-card" data-city-id="${city.id || ""}">
          <span class="recommendation-score">${Math.min(value, 99)}<small>/100</small></span>
          <span>
            <strong>${city.flag || "🌍"} ${city.name}</strong>
            <small>${city.englishName || ""} · ${city.countryName || ""}</small>
            <small class="recommendation-reason">${fit} · ${reasons.join(" · ") || "適合依你的天數深入探索"}</small>
          </span>
          <span class="recommendation-meta">
            <em>${budgetLabel}</em>
            <b>查看 →</b>
          </span>
        </button>
      `).join("")}</div>
      <small class="planner-disclaimer">推薦以「${styleLabel}」與「${budgetLabel}預算」為主軸，並附帶直飛/轉機與旅遊節奏的判斷；實際航班、簽證與價格請以官方最新資料為準。</small>
    `;
    result.querySelectorAll("[data-city-id]").forEach(button => {
      button.addEventListener("click", () => {
        const city = this.allCities().find(item => item.id === button.dataset.cityId);
        if (!city) return;
        if (window.TRAVEL_DATA.globalCities.some(item => item.id === city.id)) {
          window.appNavigate("global-city", { cityId: city.id });
        } else {
          window.appNavigate("country", { countryId: city.countryId, cityId: city.id });
        }
      });
    });
  },

  toggleCompare: function (city) {
    const key = city.id || `${city.countryName}-${city.name}`;
    const exists = this.compareIds.indexOf(key);
    if (exists >= 0) this.compareIds.splice(exists, 1);
    else if (this.compareIds.length < 4) this.compareIds.push(key);
    else return;
    try {
      localStorage.setItem("journey-atlas-compare", JSON.stringify(this.compareIds));
    } catch (error) {
      console.warn("無法儲存城市比較清單，將在本次頁面工作階段保留。", error);
    }
    this.renderComparison();
    const compareButton = document.getElementById("btn-compare-city");
    if (compareButton) {
      const isSelected = this.compareIds.includes(key);
      compareButton.textContent = isSelected ? "✓ 已加入比較" : "＋ 加入城市比較";
      compareButton.setAttribute("aria-pressed", String(isSelected));
    }
  },

  renderComparison: function () {
    const panel = document.getElementById("comparison-panel");
    if (!panel) return;
    const cities = this.allCities().filter(city => this.compareIds.includes(city.id));
    const quickStatus = document.getElementById("comparison-quick-status");
    if (quickStatus) {
      quickStatus.textContent = cities.length ? `已選 ${cities.length}/4 座城市，點擊查看` : "回到頁面查看已選城市";
    }
    panel.innerHTML = `
      <div class="comparison-heading"><div><span class="section-kicker">COMPARE YOUR SHORTLIST</span><h2>城市比較</h2><p>最多選 4 座城市，快速找到最適合你的下一站。</p></div><span class="destination-count">${cities.length}/4 已選</span></div>
      <div class="comparison-actions">${cities.map(city => `<button type="button" class="compare-chip" data-remove="${city.id}">${city.flag || "🌍"} ${city.name} ×</button>`).join("")}</div>
      ${cities.length < 2 ? `<p class="comparison-empty">先在城市詳情頁按「加入比較」，至少選兩座城市就會出現比較表。</p>` : `
        <div class="comparison-table-wrap"><table class="comparison-table"><thead><tr><th>比較面向</th>${cities.map(city => `<th>${city.flag || "🌍"} ${city.name}</th>`).join("")}</tr></thead><tbody>
          <tr><th>國家／地區</th>${cities.map(city => `<td>${city.countryName || "—"}</td>`).join("")}</tr>
          <tr><th>氣候</th>${cities.map(city => `<td>${city.climate || "四季各有特色"}</td>`).join("")}</tr>
          <tr><th>文化與歷史</th>${cities.map(city => `<td>${city.history ? "高" : "中"}</td>`).join("")}</tr>
          <tr><th>資料完整度</th>${cities.map(city => `<td><span class="comparison-status">● 已整理</span></td>`).join("")}</tr>
          <tr><th>規劃建議</th>${cities.map(city => `<td>${city.description || "適合探索城市特色"}</td>`).join("")}</tr>
        </tbody></table></div>
      `}
    `;
    panel.querySelectorAll("[data-remove]").forEach(button => button.addEventListener("click", () => {
      this.toggleCompare(cities.find(city => city.id === button.dataset.remove));
    }));
  },

  renderCityTools: function (city, state) {
    const host = document.getElementById("city-planner-tools");
    if (!host || !city) return;
    this.itineraryDays = 5;
    const compareKey = city.id;
    const selected = this.compareIds.includes(compareKey);
    const budget = this.readBudget(city);
    const spots = city.spots || [];
    host.innerHTML = `
      <div class="city-tool-heading"><div><span class="section-kicker">PLAN WITH CONFIDENCE</span><h4>把靈感變成可執行計畫</h4></div><div class="city-tool-actions"><button type="button" class="tool-outline-btn" id="btn-favorite-city" aria-pressed="${this.isFavorite(`city:${city.id}`)}">${this.isFavorite(`city:${city.id}`) ? "★ 已收藏城市" : "☆ 收藏城市"}</button><button type="button" class="tool-outline-btn" id="btn-compare-city" aria-pressed="${selected}">${selected ? "✓ 已加入比較" : "＋ 加入城市比較"}</button></div></div>
      <div class="planner-tool-grid">
        <section class="budget-tool"><h5>💰 旅行預算估算</h5><div class="budget-inputs">
          <label>住宿 <input type="number" min="0" step="500" data-budget="hotel" value="${budget.hotel}"></label>
          <label>交通 <input type="number" min="0" step="500" data-budget="transport" value="${budget.transport}"></label>
          <label>餐飲 <input type="number" min="0" step="500" data-budget="food" value="${budget.food}"></label>
          <label>景點／購物 <input type="number" min="0" step="500" data-budget="activity" value="${budget.activity}"></label>
        </div><div id="budget-chart" class="budget-chart"></div><p id="budget-total" class="tool-total"></p><small class="planner-disclaimer">金額為台幣估算，依 5 天旅程預設，可自行調整。</small></section>
        <section class="itinerary-tool"><h5>🗓️ 快速行程產生器</h5><p class="itinerary-help">將景點依天數平均安排，並提供每日交通建議。</p><div class="itinerary-days" role="group" aria-label="選擇旅行天數">${[3, 5, 7].map(days => `<button type="button" data-days="${days}" class="${days === 5 ? "active" : ""}">${days} 天</button>`).join("")}</div><div class="itinerary-customizer"><label>景點 <select id="itinerary-spot-select" aria-label="選擇景點">${spots.map((spot, index) => `<option value="${index}">${spot.name}</option>`).join("")}</select></label><label>加入第 <select id="itinerary-day-select" aria-label="選擇加入天數">${Array.from({ length: 7 }, (_, index) => `<option value="${index}">Day ${index + 1}</option>`).join("")}</select></label><button type="button" class="tool-outline-btn" id="btn-add-itinerary-spot">加入</button></div><div class="itinerary-actions"><button type="button" class="tool-outline-btn" id="btn-copy-itinerary">複製行程</button><button type="button" class="tool-outline-btn" id="btn-print-itinerary">列印行程</button></div><div id="itinerary-result" class="itinerary-result"></div></section>
      </div>
    `;
    host.querySelector("#btn-favorite-city").addEventListener("click", event => {
      const selectedFavorite = this.toggleFavorite(`city:${city.id}`);
      event.currentTarget.textContent = selectedFavorite ? "★ 已收藏城市" : "☆ 收藏城市";
      event.currentTarget.setAttribute("aria-pressed", String(selectedFavorite));
    });
    host.querySelector("#btn-compare-city").addEventListener("click", () => this.toggleCompare(city));
    host.querySelectorAll("[data-budget]").forEach(input => input.addEventListener("input", () => {
      this.saveBudget(city, input);
      this.renderBudgetChart(host);
    }));
    host.querySelectorAll("[data-days]").forEach(button => button.addEventListener("click", () => {
      host.querySelectorAll("[data-days]").forEach(item => item.classList.toggle("active", item === button));
      this.itineraryDays = Number(button.dataset.days);
      this.renderItinerary(city, this.itineraryDays);
    }));
    host.querySelector("#btn-add-itinerary-spot")?.addEventListener("click", () => {
      const spotIndex = Number(host.querySelector("#itinerary-spot-select").value);
      const dayIndex = Number(host.querySelector("#itinerary-day-select").value);
      if (spotIndex >= 0 && dayIndex < this.itineraryDays) this.addItinerarySpot(city, this.itineraryDays, spotIndex, dayIndex);
    });
    host.querySelector("#btn-copy-itinerary")?.addEventListener("click", () => this.copyItinerary(city, this.itineraryDays));
    host.querySelector("#btn-print-itinerary")?.addEventListener("click", () => this.printItinerary(city, this.itineraryDays));
    this.renderBudgetChart(host);
    this.renderItinerary(city, this.itineraryDays);
  },

  readBudget: function (city) {
    const saved = readStoredJson(`journey-atlas-budget-${city.id}`, null);
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) {
      return { hotel: 12000, transport: 3500, food: 7000, activity: 5000 };
    }
    const defaults = { hotel: 12000, transport: 3500, food: 7000, activity: 5000 };
    return Object.fromEntries(Object.keys(defaults).map(key => {
      const value = Number(saved[key]);
      return [key, Number.isFinite(value) ? Math.max(0, value) : defaults[key]];
    }));
  },
  saveBudget: function (city, input) {
    const host = input.closest("#city-planner-tools");
    const budget = {};
    host.querySelectorAll("[data-budget]").forEach(item => { budget[item.dataset.budget] = Math.max(0, Number(item.value) || 0); });
    try {
      localStorage.setItem(`journey-atlas-budget-${city.id}`, JSON.stringify(budget));
    } catch (error) {
      console.warn("無法儲存旅行預算，將在本次頁面工作階段保留。", error);
    }
  },
  renderBudgetChart: function (host) {
    const items = [...host.querySelectorAll("[data-budget]")].map(input => ({ name: input.previousSibling.textContent.trim(), value: Math.max(0, Number(input.value) || 0) }));
    const total = items.reduce((sum, item) => sum + item.value, 0);
    host.querySelector("#budget-total").textContent = `預估總額：NT$ ${total.toLocaleString()}（每日約 NT$ ${Math.round(total / 5).toLocaleString()}）`;
    host.querySelector("#budget-chart").innerHTML = items.map(item => `<div class="budget-bar"><span>${item.name}</span><i><b style="width:${total ? (item.value / total) * 100 : 0}%"></b></i><strong>NT$ ${item.value.toLocaleString()}</strong></div>`).join("");
  },
  renderItinerary: function (city, days) {
    const result = document.getElementById("itinerary-result");
    if (!result) return;
    const plan = this.buildItineraryPlan(city, days);
    result.innerHTML = plan.map((day, dayIndex) => `
      <article class="itinerary-day-card">
        <div class="itinerary-day-heading"><strong>Day ${dayIndex + 1}</strong><span>${day.theme}</span><small>${day.note}</small></div>
        <div class="itinerary-schedule">${day.items.map(item => `
          <div class="itinerary-slot">
            <div><strong>${item.title}</strong>${item.transport ? `<small class="itinerary-transport">🚇 ${item.transport}${item.routeUrl ? ` <a href="${item.routeUrl}" target="_blank" rel="noopener noreferrer">路線</a>` : ""}</small>` : ""}</div>
          </div>
        `).join("")}</div>
        ${day.custom.length ? `<div class="itinerary-custom-items">${day.custom.map(spotIndex => `<button type="button" class="itinerary-remove" data-remove-day="${dayIndex}" data-remove-spot="${spotIndex}">移除 ${city.spots[spotIndex]?.name || "景點"}</button>`).join("")}</div>` : ""}
      </article>
    `).join("");
    result.querySelectorAll("[data-remove-day]").forEach(button => button.addEventListener("click", () => {
      const itinerary = this.getItinerary(city, days);
      const day = Number(button.dataset.removeDay);
      itinerary[day] = itinerary[day].filter(index => index !== Number(button.dataset.removeSpot));
      this.saveItinerary(city, days, itinerary);
      this.renderItinerary(city, days);
    }));
  },

  buildItineraryPlan: function (city, days) {
    const spots = city.spots || [];
    const saved = this.getItinerary(city, days);
    const customizedSpotIndexes = new Set(saved.flat());
    const themes = ["抵達與城市暖身", "核心景點與在地生活", "城市深度探索", "近郊／特色體驗", "自由安排與購物", "慢遊與查漏補缺", "返程前整理"];
    const transit = this.getTransitGuide(city);
    const routeTo = (destination, origin = city.name) => `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(`${destination} ${city.name}`)}&travelmode=transit`;
    return Array.from({ length: days }, (_, dayIndex) => {
      const custom = saved[dayIndex] || [];
      const first = dayIndex === 0;
      const last = dayIndex === days - 1;
      const dailySpots = spots.filter((_, spotIndex) =>
        !customizedSpotIndexes.has(spotIndex) && spotIndex % days === dayIndex
      );
      const primarySpot = dailySpots[0];
      const secondarySpot = dailySpots[1];
      const items = [
        primarySpot
          ? { title: primarySpot.name, transport: `住宿出發・${transit}`, routeUrl: routeTo(primarySpot.name) }
          : { title: first ? "抵達與住宿周邊" : "自由活動", transport: "住宿周邊步行" },
        secondarySpot
          ? { title: secondarySpot.name, transport: `上一景點前往・${transit}`, routeUrl: routeTo(secondarySpot.name, primarySpot?.name || city.name) }
          : { title: last ? "伴手禮與返程準備" : "街區散策與休息", transport: "步行或短程大眾運輸" }
      ];
      custom.forEach((spotIndex, customIndex) => {
        const spot = spots[spotIndex];
        if (spot) items.splice(Math.min(1 + customIndex, items.length), 0, {
          title: `自訂景點｜${spot.name}`,
          transport: `從前一站前往，${transit}`,
          routeUrl: routeTo(spot.name, primarySpot?.name || city.name)
        });
      });
      return {
        theme: themes[Math.min(dayIndex, themes.length - 1)],
        note: first ? "以抵達時間為準，可將晚餐改為附近簡單用餐。" : last ? "最後一天請依航班時間縮短活動範圍。" : "景點依每日分組安排，優先集中同區活動，減少往返時間。",
        items,
        custom
      };
    });
  },

  getTransitGuide: function (city) {
    const text = `${city.name} ${city.englishName || ""} ${city.countryName || ""}`.toLowerCase();
    if (/東京|tokyo/.test(text)) return "優先使用地鐵／JR，尖峰時段預留 30–45 分鐘";
    if (/大阪|osaka/.test(text)) return "優先使用地鐵／JR，景點間預留 20–40 分鐘";
    if (/首爾|seoul/.test(text)) return "優先使用地鐵，轉乘預留 30–45 分鐘";
    if (/巴黎|paris|倫敦|london/.test(text)) return "優先使用地鐵／火車，避開尖峰時段";
    if (/釜山|busan/.test(text)) return "優先使用地鐵與公車，海岸區預留 40–60 分鐘";
    return "優先使用地鐵／公車，景點間預留 30–45 分鐘";
  },

  getItinerary: function (city, days) {
    const stored = readStoredJson(this.itineraryStorageKey, {});
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) return Array.from({ length: days }, () => []);
    const saved = stored[city.id]?.[days];
    return Array.from({ length: days }, (_, index) => Array.isArray(saved?.[index]) ? saved[index] : []);
  },

  saveItinerary: function (city, days, itinerary) {
    const parsed = readStoredJson(this.itineraryStorageKey, {});
    const stored = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    stored[city.id] = { ...(stored[city.id] || {}), [days]: itinerary };
    try {
      localStorage.setItem(this.itineraryStorageKey, JSON.stringify(stored));
    } catch (error) {
      console.warn("儲存自訂行程失敗：", error);
    }
  },

  addItinerarySpot: function (city, days, spotIndex, dayIndex) {
    const itinerary = this.getItinerary(city, days);
    itinerary.forEach(day => {
      const existingIndex = day.indexOf(spotIndex);
      if (existingIndex >= 0) day.splice(existingIndex, 1);
    });
    if (!itinerary[dayIndex].includes(spotIndex)) itinerary[dayIndex].push(spotIndex);
    this.saveItinerary(city, days, itinerary);
    this.renderItinerary(city, days);
  },

  getItineraryText: function (city, days) {
    return this.buildItineraryPlan(city, days).map((day, index) =>
      `Day ${index + 1}｜${day.theme}\n${day.note}\n${day.items.map(item => `【${item.title}】${item.transport ? `\n交通：${item.transport}` : ""}`).join("\n")}`
    ).join("\n\n");
  },

  copyItinerary: async function (city, days) {
    try {
      await navigator.clipboard.writeText(`${city.name} ${days} 日行程\n\n${this.getItineraryText(city, days)}`);
      const button = document.getElementById("btn-copy-itinerary");
      if (button) { button.textContent = "已複製"; setTimeout(() => { button.textContent = "複製完整行程"; }, 1400); }
    } catch (error) { console.warn("複製行程失敗：", error); }
  },

  printItinerary: function (city, days) {
    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) { console.warn("列印視窗被瀏覽器封鎖。"); return; }
    printWindow.document.write(`<title>${city.name} ${days} 日行程</title><pre style="font:16px/1.8 sans-serif;white-space:pre-wrap;">${this.getItineraryText(city, days)}</pre>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }
};
