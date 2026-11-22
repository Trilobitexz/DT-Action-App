// 個人化推薦、城市比較、預算與行程工具
function escapePlannerText(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[character];
  });
}

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
  if (!Array.isArray(value)) return [];
  const aliases = window.TRAVEL_DATA?.globalCityAliases || {};
  const normalized = value.map(item => {
    if (typeof item === "string") {
      if (item.startsWith("city:")) return `city:${aliases[item.slice(5)] || item.slice(5)}`;
      return aliases[item] || item;
    }
    if (item && typeof item === "object" && aliases[item.id]) return { ...item, id: aliases[item.id] };
    return item;
  });
  const identity = item => item && typeof item === "object" && item.id ? String(item.id) : String(item);
  return normalized.filter((item, index, list) => list.findIndex(candidate => identity(candidate) === identity(item)) === index);
}

function migrateCityAliasesInLocalStorage(cloudReady = false) {
  const aliases = window.TRAVEL_DATA?.globalCityAliases || {};
  if (!Object.keys(aliases).length) return;
  try {
    const saveMigratedValue = (key, value) => {
      const serialized = JSON.stringify(value);
      if (localStorage.getItem(key) === serialized) return;
      localStorage.setItem(key, serialized);
      window.FirebaseCloudData?.saveLocal(key, serialized);
    };
    ["journey-atlas-compare", "journey-atlas-favorites", "journey-atlas-recent"].forEach(key => {
      const current = readStoredJson(key, []);
      if (Array.isArray(current)) saveMigratedValue(key, readStoredArray(key));
    });
    const itineraryKey = "journey-atlas-itineraries";
    const itineraries = readStoredJson(itineraryKey, {});
    if (itineraries && typeof itineraries === "object" && !Array.isArray(itineraries)) {
      let changed = false;
      Object.entries(aliases).forEach(([oldId, newId]) => {
        if (!Object.prototype.hasOwnProperty.call(itineraries, oldId)) return;
        if (!Object.prototype.hasOwnProperty.call(itineraries, newId)) {
          itineraries[newId] = itineraries[oldId];
          delete itineraries[oldId];
          changed = true;
        } else if (JSON.stringify(itineraries[newId]) === JSON.stringify(itineraries[oldId])) {
          delete itineraries[oldId];
          changed = true;
        }
      });
      if (changed) saveMigratedValue(itineraryKey, itineraries);
    }
    Object.entries(aliases).forEach(([oldId, newId]) => {
      const oldKey = `journey-atlas-budget-${oldId}`;
      const newKey = `journey-atlas-budget-${newId}`;
      const oldValue = localStorage.getItem(oldKey);
      if (oldValue === null) return;
      if (localStorage.getItem(newKey) === null) {
        localStorage.setItem(newKey, oldValue);
        window.FirebaseCloudData?.saveLocal(newKey, oldValue);
        if (cloudReady) {
          localStorage.removeItem(oldKey);
          window.FirebaseCloudData?.removeLocal(oldKey);
        }
      } else if (localStorage.getItem(newKey) === oldValue && cloudReady) {
        localStorage.removeItem(oldKey);
        window.FirebaseCloudData?.removeLocal(oldKey);
      }
    });
  } catch (error) {
    console.warn("城市資料合併後的本機資料整理失敗：", error);
  }
}

window.PlannerView = {
  getPlanningSpots: function (city) {
    const spots = [...(city?.spots || []), ...(city?.spotCandidates || [])];
    const seen = new Set();
    return spots.filter(spot => {
      const key = String(spot?.name || spot || "").normalize("NFKC").trim().toLocaleLowerCase()
        .replace(/[\s\p{P}]+/gu, "");
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map(spot => typeof spot === "string" ? { name: spot, category: "景點" } : spot);
  },
  compareIds: readStoredArray("journey-atlas-compare"),
  favoriteIds: readStoredArray("journey-atlas-favorites"),
  recentStorageKey: "journey-atlas-recent",
  itineraryStorageKey: "journey-atlas-itineraries",
  itineraryDays: 5,
  travelModes: { transit: "大眾運輸", walking: "步行", driving: "開車" },

  init: function () {
    migrateCityAliasesInLocalStorage();
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

  refreshCloudData: function () {
    migrateCityAliasesInLocalStorage(true);
    this.compareIds = readStoredArray("journey-atlas-compare");
    this.favoriteIds = readStoredArray("journey-atlas-favorites");
    this.renderComparison();
    this.renderRecentDestinations();
    const favoriteButton = document.getElementById("btn-favorite-city");
    const favoriteKey = favoriteButton?.dataset.favoriteKey;
    if (favoriteButton && favoriteKey) {
      const selected = this.isFavorite(favoriteKey);
      favoriteButton.textContent = selected ? "★ 已收藏城市" : "☆ 收藏城市";
      favoriteButton.setAttribute("aria-pressed", String(selected));
    }
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
      const value = JSON.stringify(recent.slice(0, 5));
      localStorage.setItem(this.recentStorageKey, value);
      window.FirebaseCloudData?.saveLocal(this.recentStorageKey, value);
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
      try { localStorage.removeItem(this.recentStorageKey); window.FirebaseCloudData?.removeLocal(this.recentStorageKey); } catch (error) { console.warn("無法清除最近瀏覽紀錄。", error); }
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
      const value = JSON.stringify(this.favoriteIds);
      localStorage.setItem("journey-atlas-favorites", value);
      window.FirebaseCloudData?.saveLocal("journey-atlas-favorites", value);
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
    const seen = new Set();
    return [...globalCities, ...localCities].filter(city => {
      const normalize = value => String(value || "").normalize("NFKC").trim().toLocaleLowerCase().replace(/[\s\p{P}]+/gu, "");
      const key = `${normalize(city.countryName)}|${normalize(city.englishName || city.name)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  },

  renderRecommendations: function (formData) {
    const result = document.getElementById("recommendation-results");
    if (!result) return;
    const style = formData?.get("style") || "culture";
    const styleLabel = {
      culture: "文化與歷史",
      nature: "自然與風景"
    }[style] || "城市探索";
    const categoryPattern = style === "culture"
      ? /博物館|美術館|藝術|古蹟|紀念|城堡|宗教|遺址|歷史|文化|藝術中心/
      : style === "nature" ? /公園|花園|自然|海灘|瀑布|洞穴|泉|山峰|保護區/ : null;
    const recommendations = categoryPattern ? this.allCities().map(city => ({
      city,
      spots: (city.spots || []).filter(spot => Number.isFinite(spot.lat) && Number.isFinite(spot.lng)
        && /^https?:\/\//i.test(String(spot.sourceUrl || "")) && categoryPattern.test(String(spot.category || "")))
    })).filter(item => item.spots.length).sort((a, b) => b.spots.length - a.spots.length).slice(0, 3) : [];

    if (!recommendations.length) {
      result.innerHTML = `
        <div class="recommendation-empty-state">
          <strong>目前沒有足夠來源資料可作這類推薦</strong>
          <span>開啟城市載入有座標的圖資後，才會依實際編目分類列出探索方向。</span>
        </div>
      `;
      return;
    }

    result.innerHTML = `
      <div class="recommendation-result-heading">
        <strong>有 ${styleLabel} 來源地點的城市</strong>
        <span>依已編目地點數列出，不代表旅遊評分</span>
      </div>
      <div class="recommendation-result-list">${recommendations.map(({ city, spots }) => `
        <button type="button" class="recommendation-result-card" data-city-id="${city.id || ""}">
          <span class="recommendation-score">${spots.length}<small>筆</small></span>
          <span>
            <strong>${city.flag || "🌍"} ${city.name}</strong>
            <small>${city.englishName || ""} · ${city.countryName || ""}</small>
            <small class="recommendation-reason">${spots.map(spot => escapePlannerText(spot.category)).join(" · ")}</small>
          </span>
          <span class="recommendation-meta">
            <em>有來源座標</em>
            <b>查看 →</b>
          </span>
        </button>
      `).join("")}</div>
      <small class="planner-disclaimer">此清單依來源連結、座標及地點分類整理；航班與價格會依城市、日期及供應商即時變動。</small>
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
      const value = JSON.stringify(this.compareIds);
      localStorage.setItem("journey-atlas-compare", value);
      window.FirebaseCloudData?.saveLocal("journey-atlas-compare", value);
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
      <div class="comparison-heading"><div><span class="section-kicker">COMPARE SOURCE DATA</span><h2>城市資料比較</h2><p>最多比較 4 座城市；各欄位會顯示目前可用資料與來源狀態。</p></div><span class="destination-count">${cities.length}/4 已選</span></div>
      <div class="comparison-actions">${cities.map(city => `<button type="button" class="compare-chip" data-remove="${city.id}">${city.flag || "🌍"} ${city.name} ×</button>`).join("")}</div>
      ${cities.length < 2 ? `<p class="comparison-empty">先在城市詳情頁按「加入比較」，至少選兩座城市就會出現比較表。</p>` : `
        <div class="comparison-table-wrap"><table class="comparison-table"><thead><tr><th>比較面向</th>${cities.map(city => `<th>${city.flag || "🌍"} ${city.name}</th>`).join("")}</tr></thead><tbody>
          <tr><th>國家／地區</th>${cities.map(city => `<td>${city.countryName || "—"}</td>`).join("")}</tr>
          <tr><th>氣候</th>${cities.map(city => `<td>${city.climateSource ? escapePlannerText(city.climate) : "尚無核實資料"}</td>`).join("")}</tr>
          <tr><th>文化與歷史</th>${cities.map(city => `<td>${city.historySource ? escapePlannerText(city.history) : "尚無核實資料"}</td>`).join("")}</tr>
          <tr><th>來源資料</th>${cities.map(city => `<td>${city.coordinateSource ? "座標有來源" : "位置待核實"} · ${(city.spots || []).filter(spot => spot.sourceUrl && Number.isFinite(spot.lat) && Number.isFinite(spot.lng)).length} 筆景點</td>`).join("")}</tr>
          <tr><th>規劃建議</th>${cities.map(city => `<td>${city.descriptionSource?.text ? escapePlannerText(city.descriptionSource.text) : "尚無來源資料"}</td>`).join("")}</tr>
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
    const spots = this.getPlanningSpots(city);
    host.innerHTML = `
      <div class="city-tool-heading"><div><span class="section-kicker">PLAN WITH CONFIDENCE</span><h4>把靈感變成可執行計畫</h4></div><div class="city-tool-actions"><button type="button" class="tool-outline-btn" id="btn-favorite-city" data-favorite-key="city:${city.id}" aria-pressed="${this.isFavorite(`city:${city.id}`)}">${this.isFavorite(`city:${city.id}`) ? "★ 已收藏城市" : "☆ 收藏城市"}</button><button type="button" class="tool-outline-btn" id="btn-compare-city" aria-pressed="${selected}">${selected ? "✓ 已加入比較" : "＋ 加入城市比較"}</button></div></div>
      <div class="planner-tool-grid">
        <section class="budget-tool"><h5>💰 旅行預算估算</h5><div class="budget-inputs">
          <label>住宿 <input type="number" min="0" step="500" data-budget="hotel" value="${budget.hotel}"></label>
          <label>交通 <input type="number" min="0" step="500" data-budget="transport" value="${budget.transport}"></label>
          <label>餐飲 <input type="number" min="0" step="500" data-budget="food" value="${budget.food}"></label>
          <label>景點／購物 <input type="number" min="0" step="500" data-budget="activity" value="${budget.activity}"></label>
        </div><div id="budget-chart" class="budget-chart"></div><p id="budget-total" class="tool-total"></p><small class="planner-disclaimer">金額為台幣估算，依 5 天旅程預設，可自行調整。</small></section>
        <section class="itinerary-tool"><h5>🗓️ 行程規劃</h5><p class="itinerary-help">可自行安排景點，或使用 AI 依旅遊偏好規劃每日路線。</p><div class="ai-itinerary-controls"><label for="itinerary-ai-preferences">旅行偏好 <span>選填</span></label><input id="itinerary-ai-preferences" type="text" maxlength="160" placeholder="例如：在地美食、博物館、親子、慢遊"><button type="button" class="tool-outline-btn ai-itinerary-button" id="btn-ai-itinerary">✨ AI 產生行程</button><p class="ai-itinerary-status" id="ai-itinerary-status" role="status" aria-live="polite"></p><small class="planner-disclaimer">景點先使用城市目錄與公開地圖資料；資料服務無回應時會提供地圖搜尋入口。地圖入口不是已核實景點，營業時間、交通與費用請以官方資訊為準。</small></div><div class="itinerary-days" role="group" aria-label="選擇旅行天數">${[3, 5, 7].map(days => `<button type="button" data-days="${days}" class="${days === 5 ? "active" : ""}">${days} 天</button>`).join("")}</div><div class="itinerary-customizer"><label>景點 <select id="itinerary-spot-select" aria-label="選擇景點">${spots.map((spot, index) => `<option value="${index}">${escapePlannerText(spot.name)}</option>`).join("")}</select></label><label>加入第 <select id="itinerary-day-select" aria-label="選擇加入天數">${Array.from({ length: 7 }, (_, index) => `<option value="${index}">Day ${index + 1}</option>`).join("")}</select></label><button type="button" class="tool-outline-btn" id="btn-add-itinerary-spot">加入</button></div><label class="itinerary-mode-control">交通方式<select id="itinerary-travel-mode" aria-label="選擇交通方式"><option value="transit">大眾運輸</option><option value="walking">步行</option><option value="driving">開車</option></select><small id="itinerary-mode-recommendation"></small></label><div class="itinerary-actions"><button type="button" class="tool-outline-btn" id="btn-copy-itinerary">複製行程</button><button type="button" class="tool-outline-btn" id="btn-print-itinerary">列印行程</button></div><div id="itinerary-result" class="itinerary-result"></div></section>
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
    host.querySelector("#btn-ai-itinerary")?.addEventListener("click", async event => {
      const button = event.currentTarget;
      const status = host.querySelector("#ai-itinerary-status");
      if (!window.firebaseAuth?.currentUser) {
        status.textContent = "請先使用 Google 帳戶登入。";
        const panel = document.getElementById("auth-menu-panel");
        const trigger = document.getElementById("auth-menu-trigger");
        if (panel && trigger) { panel.hidden = false; trigger.setAttribute("aria-expanded", "true"); }
        return;
      }
      button.disabled = true;
      status.dataset.state = "pending";
      status.textContent = "正在連線 AI 規劃服務…";
      try {
        await window.FirebaseAIReady;
        if (!window.FirebaseAIPlanner?.available) throw window.FirebaseAIPlanner?.error || new Error("AI 服務尚未完成設定。");
        status.textContent = "正在整理城市景點資料…";
        if (window.CityCatalogService?.ensureSpots) {
          await window.CityCatalogService.ensureSpots(city);
        }
        const planningSpots = this.getPlanningSpots(city);
        if (!planningSpots.length) throw new Error("尚未取得可安排的景點，請確認網路後再試。");
        const spotSelect = host.querySelector("#itinerary-spot-select");
        if (spotSelect) spotSelect.innerHTML = planningSpots.map((spot, index) => `<option value="${index}">${escapePlannerText(spot.name)}</option>`).join("");
        status.textContent = "AI 正在依照景點與偏好安排行程…";
        const response = await window.FirebaseAIPlanner.generateItinerary({
          cityName: city.name,
          days: this.itineraryDays,
          travelMode: this.travelModes[modeSelect?.value || this.getRecommendedTravelMode(city)],
          preferences: host.querySelector("#itinerary-ai-preferences")?.value || "",
          spots: planningSpots
        });
        this.saveItinerary(city, this.itineraryDays, response.days.map(day => day.spotIndexes), response.days);
        this.renderItinerary(city, this.itineraryDays);
        status.dataset.state = "success";
        status.textContent = planningSpots.some(spot => spot.isSearchSuggestion)
          ? `已完成 ${this.itineraryDays} 天 AI 行程；含地圖搜尋建議，請開啟連結挑選實際地點。`
          : "已完成 " + this.itineraryDays + " 天 AI 行程，可拖曳景點調整順序。";
      } catch (error) {
        console.error("AI 行程規劃失敗：", error);
        status.dataset.state = "error";
        if (error?.code === "ai/missing-app-check-site-key") status.textContent = "尚缺 App Check reCAPTCHA Enterprise 網站金鑰，請依設定說明完成啟用。";
        else if (error?.code === "ai/auth-required") status.textContent = "請先使用 Google 帳戶登入。";
        else if (error?.code === "permission-denied" || error?.code === "appCheck/throttled") status.textContent = "App Check 驗證未通過，請確認 Firebase Console 已註冊本網站網域與金鑰。";
        else status.textContent = error?.message || "AI 暫時無法規劃，請稍後再試。";
      } finally {
        button.disabled = false;
      }
    });
    host.querySelector("#btn-add-itinerary-spot")?.addEventListener("click", () => {
      const spotIndex = Number(host.querySelector("#itinerary-spot-select").value);
      const dayIndex = Number(host.querySelector("#itinerary-day-select").value);
      if (spotIndex >= 0 && dayIndex < this.itineraryDays) this.addItinerarySpot(city, this.itineraryDays, spotIndex, dayIndex);
    });
    const modeSelect = host.querySelector("#itinerary-travel-mode");
    if (modeSelect) {
      modeSelect.value = this.getRecommendedTravelMode(city);
      modeSelect.addEventListener("change", () => this.renderItinerary(city, this.itineraryDays));
    }
    host.querySelector("#btn-copy-itinerary")?.addEventListener("click", () => this.copyItinerary(city, this.itineraryDays));
    host.querySelector("#btn-print-itinerary")?.addEventListener("click", () => this.printItinerary(city, this.itineraryDays));
    this.renderBudgetChart(host);
    this.renderItinerary(city, this.itineraryDays);
  },

  readBudget: function (city) {
    const aliases = Object.entries(window.TRAVEL_DATA.globalCityAliases || {});
    const legacyId = aliases.find(([, canonicalId]) => canonicalId === city.id)?.[0];
    const saved = readStoredJson(`journey-atlas-budget-${city.id}`, null)
      || (legacyId ? readStoredJson(`journey-atlas-budget-${legacyId}`, null) : null);
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
      const key = `journey-atlas-budget-${city.id}`;
      const value = JSON.stringify(budget);
      localStorage.setItem(key, value);
      window.FirebaseCloudData?.saveLocal(key, value);
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
    const mode = document.querySelector("#itinerary-travel-mode")?.value || this.getRecommendedTravelMode(city);
    const plan = this.buildItineraryPlan(city, days, mode);
    const spots = this.getPlanningSpots(city);
    const custom = this.getItinerary(city, days);
    const aiDayPlans = this.getItineraryMeta(city, days);
    const customSet = new Set(custom.flat());
    const recommendation = document.getElementById("itinerary-mode-recommendation");
    if (recommendation) recommendation.textContent = `依城市建議：${this.travelModes[this.getRecommendedTravelMode(city)]}`;
    result.innerHTML = plan.map((day, dayIndex) => {
      const orderedSpots = custom[dayIndex].length
        ? custom[dayIndex].map(index => ({ index, spot: spots[index] })).filter(item => item.spot)
        : spots.map((spot, index) => ({ index, spot })).filter(item => !customSet.has(item.index) && item.index % days === dayIndex);
      const load = orderedSpots.length <= 2 ? "輕鬆" : orderedSpots.length <= 4 ? "適中" : "偏滿";
      return `<article class="itinerary-day-card" data-itinerary-day="${dayIndex}">
        <div class="itinerary-day-heading"><strong>Day ${dayIndex + 1}</strong><span>${escapePlannerText(aiDayPlans[dayIndex]?.theme || day.theme)}</span><small>${escapePlannerText(aiDayPlans[dayIndex]?.note || day.note)}</small></div>
        <div class="itinerary-load ${load === "偏滿" ? "is-busy" : ""}">今日安排：${load}・${orderedSpots.length} 個景點 ${load === "偏滿" ? "— 建議移除或分配至其他天" : ""}</div>
        <div class="itinerary-schedule">
          ${orderedSpots.length ? orderedSpots.map(({ index, spot }, order) => {
            const opening = spot.openingHours || "營業時間未提供";
            const closed = spot.closedDays || "休館日未提供";
            const duration = Number(spot.visitHours) || 2;
            const travel = order === 0 ? "住宿／市區出發" : this.estimateTravelTime(orderedSpots[order - 1].spot, spot, mode);
            const routeUrl = this.routeUrl(orderedSpots[order - 1]?.spot?.name || city.name, spot.name, mode, city.name);
            return `<div class="itinerary-slot itinerary-spot-card" draggable="true" data-spot-index="${index}" data-day-index="${dayIndex}" tabindex="0" aria-label="${escapePlannerText(spot.name)}，可拖曳調整順序">
              <span class="itinerary-drag-handle" aria-hidden="true">⠿</span><div class="itinerary-stop-details"><strong>${order + 1}. ${escapePlannerText(spot.name)} <span class="itinerary-drag-hint">拖曳排序</span></strong>
              <small class="itinerary-transport">🚉 ${spot.isSearchSuggestion ? "搜尋附近實際景點" : `${escapePlannerText(travel)} · ${this.travelModes[mode]}`}${spot.isSearchSuggestion && spot.sourceUrl ? ` <a href="${escapePlannerText(spot.sourceUrl)}" target="_blank" rel="noopener noreferrer">開啟地圖搜尋</a>` : order ? ` <a href="${routeUrl}" target="_blank" rel="noopener noreferrer">查看路線</a>` : ""}</small>
              <small>⏱ 建議停留 ${duration} 小時</small><small class="itinerary-opening">🕒 ${escapePlannerText(opening)}　📅 ${escapePlannerText(closed)}</small>
              ${!spot.openingHours || !spot.closedDays ? `<small class="itinerary-data-warning">營業／休館資訊未驗證，出發前請查官方公告。</small>` : ""}</div>
            </div>`;
          }).join("") : `<p class="itinerary-empty-day">尚未安排景點，可從上方加入。</p>`}
        </div>

      </article>`;
    }).join("");

    let dragged = null;
    result.querySelectorAll(".itinerary-spot-card").forEach(card => {
      card.addEventListener("dragstart", event => { dragged = card; card.classList.add("is-dragging"); event.dataTransfer.effectAllowed = "move"; });
      card.addEventListener("dragend", () => { card.classList.remove("is-dragging"); dragged = null; result.querySelectorAll(".itinerary-spot-card").forEach(item => item.classList.remove("drop-target")); });
      card.addEventListener("dragover", event => { event.preventDefault(); if (dragged && dragged !== card && dragged.dataset.dayIndex === card.dataset.dayIndex) card.classList.add("drop-target"); });
      card.addEventListener("dragleave", () => card.classList.remove("drop-target"));
      card.addEventListener("drop", event => {
        event.preventDefault(); card.classList.remove("drop-target");
        if (!dragged || dragged === card || dragged.dataset.dayIndex !== card.dataset.dayIndex) return;
        const dayIndex = Number(card.dataset.dayIndex);
        const order = this.getOrderedDaySpotIndexes(city, days, dayIndex);
        const from = order.indexOf(Number(dragged.dataset.spotIndex));
        const to = order.indexOf(Number(card.dataset.spotIndex));
        if (from < 0 || to < 0) return;
        order.splice(to, 0, order.splice(from, 1)[0]);
        const itinerary = this.getItinerary(city, days);
        itinerary[dayIndex] = order;
        this.saveItinerary(city, days, itinerary);
        this.renderItinerary(city, days);
      });
    });
    result.querySelectorAll("[data-clear-day]").forEach(button => button.addEventListener("click", () => {
      const itinerary = this.getItinerary(city, days);
      itinerary[Number(button.dataset.clearDay)] = [];
      this.saveItinerary(city, days, itinerary);
      this.renderItinerary(city, days);
    }));
  },

  getOrderedDaySpotIndexes: function (city, days, dayIndex) {
    const saved = this.getItinerary(city, days);
    if (saved[dayIndex]?.length) return [...saved[dayIndex]];
    const custom = new Set(saved.flat());
    return this.getPlanningSpots(city).map((_, index) => index).filter(index => !custom.has(index) && index % days === dayIndex);
  },

  getRecommendedTravelMode: function (city) {
    const text = `${city.name} ${city.englishName || ""} ${city.countryName || ""}`.toLowerCase();
    if (/峇里|普吉|檀香山|洛杉磯|las vegas|los angeles|bali|phuket|honolulu|cape town/.test(text)) return "driving";
    if (/京都|奈良|威尼斯|amsterdam|venice|florence/.test(text)) return "walking";
    return "transit";
  },

  estimateTravelTime: function (from, to, mode) {
    const category = `${from.category || ""} ${to.category || ""}`;
    const base = mode === "walking" ? 25 : mode === "driving" ? 20 : 30;
    const adjustment = /近郊|海岸|島|機場/.test(category) ? 20 : /市中心|街區|商圈/.test(category) ? -8 : 0;
    const range = Math.max(mode === "walking" ? 10 : 15, base + adjustment);
    return `估計 ${range}-${range + 15} 分鐘`;
  },

  routeUrl: function (origin, destination, mode, cityName) {
    const travelmode = mode === "walking" ? "walking" : mode === "driving" ? "driving" : "transit";
    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(`${origin} ${cityName}`)}&destination=${encodeURIComponent(`${destination} ${cityName}`)}&travelmode=${travelmode}`;
  },
  buildItineraryPlan: function (city, days, mode = "transit") {
    const spots = this.getPlanningSpots(city);
    const saved = this.getItinerary(city, days);
    const customizedSpotIndexes = new Set(saved.flat());
    const themes = ["抵達與城市暖身", "核心景點與在地生活", "城市深度探索", "近郊／特色體驗", "自由安排與購物", "慢遊與查漏補缺", "返程前整理"];
    const transit = this.getTransitGuide(city);
    const routeTo = (destination, origin = city.name) => this.routeUrl(origin, destination, mode, city.name);
    return Array.from({ length: days }, (_, dayIndex) => {
      const custom = saved[dayIndex] || [];
      const first = dayIndex === 0;
      const last = dayIndex === days - 1;
      const dailySpots = spots.filter((_, spotIndex) => !customizedSpotIndexes.has(spotIndex) && spotIndex % days === dayIndex);
      const primarySpot = dailySpots[0];
      const secondarySpot = dailySpots[1];
      const items = [
        primarySpot ? { title: primarySpot.name, transport: `住宿出發・${transit}`, routeUrl: routeTo(primarySpot.name) } : { title: first ? "抵達與住宿周邊" : "自由活動", transport: "住宿周邊步行" },
        secondarySpot ? { title: secondarySpot.name, transport: `上一景點前往・${transit}`, routeUrl: routeTo(secondarySpot.name, primarySpot?.name || city.name) } : { title: last ? "伴手禮與返程準備" : "街區散策與休息", transport: "步行或短程大眾運輸" }
      ];
      custom.forEach((spotIndex, customIndex) => {
        const spot = spots[spotIndex];
        if (spot) items.splice(Math.min(1 + customIndex, items.length), 0, { title: `自訂景點｜${spot.name}`, transport: `從前一站前往，${this.travelModes[mode]}`, routeUrl: routeTo(spot.name, primarySpot?.name || city.name) });
      });
      return { theme: themes[Math.min(dayIndex, themes.length - 1)], note: first ? "以抵達時間為準，可將晚餐改為附近簡單用餐。" : last ? "最後一天請依航班時間縮短活動範圍。" : "景點依每日分組安排，請預留交通與休息時間。", items, custom };
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
    const aliases = Object.entries(window.TRAVEL_DATA.globalCityAliases || {});
    const legacyId = aliases.find(([, canonicalId]) => canonicalId === city.id)?.[0];
    const saved = (stored[city.id] || stored[legacyId])?.[days];
    return Array.from({ length: days }, (_, index) => Array.isArray(saved?.[index]) ? saved[index] : []);
  },

  getItineraryMeta: function (city, days) {
    const stored = readStoredJson(this.itineraryStorageKey, {});
    const metaKey = String(days) + "Meta";
    const aliases = Object.entries(window.TRAVEL_DATA.globalCityAliases || {});
    const legacyId = aliases.find(([, canonicalId]) => canonicalId === city.id)?.[0];
    const meta = stored && typeof stored === "object" && !Array.isArray(stored) ? (stored[city.id] || stored[legacyId])?.[metaKey] : null;
    return Array.isArray(meta) ? meta : [];
  },

  saveItinerary: function (city, days, itinerary, aiDayPlans) {
    const parsed = readStoredJson(this.itineraryStorageKey, {});
    const stored = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    stored[city.id] = { ...(stored[city.id] || {}), [days]: itinerary };
    const metaKey = String(days) + "Meta";
    if (Array.isArray(aiDayPlans)) stored[city.id][metaKey] = aiDayPlans.map(day => ({ theme: String(day.theme || ""), note: String(day.note || "") }));
    else delete stored[city.id][metaKey];
    try {
      const value = JSON.stringify(stored);
      localStorage.setItem(this.itineraryStorageKey, value);
      window.FirebaseCloudData?.saveLocal(this.itineraryStorageKey, value);
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
    const mode = typeof document !== "undefined" ? (document.querySelector("#itinerary-travel-mode")?.value || this.getRecommendedTravelMode(city)) : this.getRecommendedTravelMode(city);
    const aiDayPlans = this.getItineraryMeta(city, days);
    return this.buildItineraryPlan(city, days, mode).map((day, index) => {
      const aiDay = aiDayPlans[index];
      return `Day ${index + 1}｜${aiDay?.theme || day.theme}\n${aiDay?.note || day.note}\n${day.items.map(item => `【${item.title}】${item.transport ? `\n交通：${item.transport}` : ""}`).join("\n")}`;
    }).join("\n\n");
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
    printWindow.document.write(`<title>${escapePlannerText(city.name)} ${days} 日行程</title><pre style="font:16px/1.8 sans-serif;white-space:pre-wrap;">${escapePlannerText(this.getItineraryText(city, days))}</pre>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }
};

