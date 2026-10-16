// 個人化推薦、城市比較、預算與行程工具
window.PlannerView = {
  compareIds: JSON.parse(localStorage.getItem("journey-atlas-compare") || "[]"),

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
    const score = city => {
      let value = city.culture ? 45 : 30;
      const text = `${city.name} ${city.countryName || ""} ${city.description || ""}`.toLowerCase();
      if (style === "food" && /大阪|曼谷|東京|新加坡|香港|bangkok|osaka|tokyo|singapore/.test(text)) value += 30;
      if (style === "nature" && /峇里|雪梨|奧克蘭|開普敦|honolulu|bali|sydney/.test(text)) value += 30;
      if (style === "shopping" && /東京|大阪|首爾|杜拜|巴黎|tokyo|seoul|dubai|paris/.test(text)) value += 30;
      if (style === "relax" && /峇里|普吉|檀香山|santorini|bali|phuket|honolulu/.test(text)) value += 30;
      if (style === "culture" && city.history) value += 24;
      if (budget === "low" && /曼谷|清邁|河內|暹粒|bangkok|chiang|hanoi|siem/.test(text)) value += 20;
      if (budget === "high" && /巴黎|倫敦|東京|雪梨|paris|london|tokyo|sydney/.test(text)) value += 15;
      if (direct && city.countryName && /日本|韓國|泰國|新加坡|越南|香港/.test(city.countryName)) value += 8;
      return value + Math.min(days, 7);
    };
    const recommendations = this.allCities().map(city => ({ city, value: score(city) }))
      .sort((a, b) => b.value - a.value).slice(0, 3);
    const reason = city => {
      const reasons = [];
      const text = `${city.name} ${city.countryName || ""} ${city.description || ""}`.toLowerCase();
      if (style === "culture" && city.history) reasons.push("文化歷史符合");
      if (style === "food" && /大阪|曼谷|東京|新加坡|香港|bangkok|osaka|tokyo|singapore/.test(text)) reasons.push("美食探索熱門");
      if (style === "nature" && /峇里|雪梨|奧克蘭|開普敦|honolulu|bali|sydney/.test(text)) reasons.push("自然景觀豐富");
      if (style === "shopping" && /東京|大阪|首爾|杜拜|巴黎|tokyo|seoul|dubai|paris/.test(text)) reasons.push("購物機能完整");
      if (budget === "low" && /曼谷|清邁|河內|暹粒|bangkok|chiang|hanoi|siem/.test(text)) reasons.push("符合小資預算");
      if (direct && city.countryName && /日本|韓國|泰國|新加坡|越南|香港/.test(city.countryName)) reasons.push("台灣直飛便利");
      return reasons.slice(0, 2).join(" · ") || "適合依你的天數深入探索";
    };
    result.innerHTML = `
      <div class="recommendation-result-heading"><strong>為你挑出的 ${days} 日旅行候選</strong><span>依旅行偏好與預算估算</span></div>
      <div class="recommendation-result-list">${recommendations.map(({ city, value }) => `
        <button type="button" class="recommendation-result-card" data-city-id="${city.id || ""}">
          <span class="recommendation-score">${Math.min(value, 99)}<small>/100</small></span>
          <span><strong>${city.flag || "🌍"} ${city.name}</strong><small>${city.englishName || ""} · ${city.countryName || ""}</small><small class="recommendation-reason">✓ ${reason(city)}</small></span>
          <span class="global-city-arrow">查看 →</span>
        </button>
      `).join("")}</div>
      <small class="planner-disclaimer">推薦為規劃輔助，不代表唯一答案；航班、簽證與價格請以出發前官方資料為準。</small>
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
    localStorage.setItem("journey-atlas-compare", JSON.stringify(this.compareIds));
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
    const compareKey = city.id;
    const selected = this.compareIds.includes(compareKey);
    const budget = this.readBudget(city);
    const spots = city.spots || [];
    host.innerHTML = `
      <div class="city-tool-heading"><div><span class="section-kicker">PLAN WITH CONFIDENCE</span><h4>把靈感變成可執行計畫</h4></div><button type="button" class="tool-outline-btn" id="btn-compare-city" aria-pressed="${selected}">${selected ? "✓ 已加入比較" : "＋ 加入城市比較"}</button></div>
      <div class="planner-tool-grid">
        <section class="budget-tool"><h5>💰 旅行預算估算</h5><div class="budget-inputs">
          <label>住宿 <input type="number" min="0" step="500" data-budget="hotel" value="${budget.hotel}"></label>
          <label>交通 <input type="number" min="0" step="500" data-budget="transport" value="${budget.transport}"></label>
          <label>餐飲 <input type="number" min="0" step="500" data-budget="food" value="${budget.food}"></label>
          <label>景點／購物 <input type="number" min="0" step="500" data-budget="activity" value="${budget.activity}"></label>
        </div><div id="budget-chart" class="budget-chart"></div><p id="budget-total" class="tool-total"></p><small class="planner-disclaimer">金額為台幣估算，依 5 天旅程預設，可自行調整。</small></section>
        <section class="itinerary-tool"><h5>🗓️ 快速行程產生器</h5><div class="itinerary-days" role="group" aria-label="選擇旅行天數">${[3, 5, 7].map(days => `<button type="button" data-days="${days}" class="${days === 5 ? "active" : ""}">${days} 天</button>`).join("")}</div><div id="itinerary-result" class="itinerary-result"></div></section>
      </div>
    `;
    host.querySelector("#btn-compare-city").addEventListener("click", () => this.toggleCompare(city));
    host.querySelectorAll("[data-budget]").forEach(input => input.addEventListener("input", () => {
      this.saveBudget(city, input);
      this.renderBudgetChart(host);
    }));
    host.querySelectorAll("[data-days]").forEach(button => button.addEventListener("click", () => {
      host.querySelectorAll("[data-days]").forEach(item => item.classList.toggle("active", item === button));
      this.renderItinerary(city, Number(button.dataset.days));
    }));
    this.renderBudgetChart(host);
    this.renderItinerary(city, 5);
  },

  readBudget: function (city) {
    const saved = JSON.parse(localStorage.getItem(`journey-atlas-budget-${city.id}`) || "null");
    return saved || { hotel: 12000, transport: 3500, food: 7000, activity: 5000 };
  },
  saveBudget: function (city, input) {
    const host = input.closest("#city-planner-tools");
    const budget = {};
    host.querySelectorAll("[data-budget]").forEach(item => { budget[item.dataset.budget] = Math.max(0, Number(item.value) || 0); });
    localStorage.setItem(`journey-atlas-budget-${city.id}`, JSON.stringify(budget));
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
    const spots = city.spots || [];
    result.innerHTML = Array.from({ length: days }, (_, index) => {
      const spot = spots[index % Math.max(spots.length, 1)];
      return `<div class="itinerary-day"><strong>Day ${index + 1}</strong><span>${index === 0 ? "抵達、熟悉市區" : index === days - 1 ? "伴手禮與彈性探索" : "城市深度探索"}</span><small>${spot ? spot.name : "依即時資料挑選附近景點"}</small></div>`;
    }).join("");
  }
};
