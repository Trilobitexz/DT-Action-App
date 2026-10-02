// 畫面 2：大洲層級視圖模組 (大洲篩選、方框、搜尋與國家卡片列表)
window.ContinentView = {
  render: function(state) {
    const continent = window.TRAVEL_DATA.continents.find(c => c.id === state.selectedContinentId);
    if (!continent) return;

    document.getElementById("continent-title").innerText = `${continent.name} (${continent.englishName})`;
    document.getElementById("continent-desc").innerText = continent.description;

    const searchInput = document.getElementById("country-search-input");
    const checkDirect = document.getElementById("filter-direct-flight");
    const checkBudget = document.getElementById("filter-budget");

    searchInput.value = state.filters.search;
    checkDirect.checked = state.filters.directOnly;
    checkBudget.checked = state.filters.budgetAffordable;

    searchInput.oninput = (e) => {
      state.filters.search = e.target.value.trim().toLowerCase();
      this.applyFilters(state);
    };

    checkDirect.onchange = (e) => {
      state.filters.directOnly = e.target.checked;
      this.applyFilters(state);
    };

    checkBudget.onchange = (e) => {
      state.filters.budgetAffordable = e.target.checked;
      this.applyFilters(state);
    };

    this.applyFilters(state);
  },

  applyFilters: function(state) {
    const listContainer = document.getElementById("countries-cards-grid");
    const emptyState = document.getElementById("continent-empty-state");

    const countries = window.TRAVEL_DATA.countries.filter(c => c.continentId === state.selectedContinentId);
    const filtered = countries.filter(c => {
      if (state.filters.search) {
        const query = state.filters.search;
        const matchName = c.name.toLowerCase().includes(query) || c.englishName.toLowerCase().includes(query);
        const matchCity = c.cities.some(ci => ci.name.toLowerCase().includes(query) || ci.englishName.toLowerCase().includes(query));
        if (!matchName && !matchCity) return false;
      }
      if (state.filters.directOnly && !c.directFlight) return false;
      if (state.filters.budgetAffordable && (c.priceLevel.tier === "偏高" || c.priceLevel.tier === "極高")) {
        return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      listContainer.innerHTML = "";
      emptyState.style.display = "block";
      return;
    }

    emptyState.style.display = "none";
    listContainer.innerHTML = filtered.map(c => `
      <div class="country-card" onclick="window.appNavigate('country', { countryId: '${c.id}' })">
        <div>
          <div class="country-header">
            <div class="country-title">
              <h3>${c.name}</h3>
              <p>${c.englishName}</p>
            </div>
            <span class="country-flag">${c.flag}</span>
          </div>
          <div style="margin: 0.5rem 0;">
            ${c.directFlight 
              ? '<span class="badge-tag badge-direct">✈️ 支援直飛</span>' 
              : '<span class="badge-tag badge-transit">🔄 需轉機</span>'}
            <span class="badge-tag" style="background:#e0f2fe; color:#0369a1; margin-left: 4px;">💰 物價：${c.priceLevel.tier}</span>
          </div>
          <div class="country-stats">
            <div class="stat-item">
              <span>預算參考</span>
              <strong>${c.priceLevel.rating} (${c.priceLevel.dailyBudgetTwd.split('/')[0]})</strong>
            </div>
            <div class="stat-item">
              <span>熱門城市</span>
              <strong>${c.cities.map(ci => ci.name).join("、")}</strong>
            </div>
          </div>
        </div>
        <button class="btn-card-action">進入國家與熱門景點分析 ➔</button>
      </div>
    `).join("");
  }
};
