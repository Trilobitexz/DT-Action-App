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
    const continentCount = window.TRAVEL_DATA.countries.filter(c => c.continentId === state.selectedContinentId).length;
    const destinationCount = document.getElementById("destination-count");
    if (destinationCount) destinationCount.textContent = `${continentCount} 個目的地`;

    // 搜尋與篩選 (加入 250ms 防抖 Debounce，大幅降低 DOM 頻繁重繪)
    let searchDebounce = null;
    searchInput.oninput = (e) => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        state.filters.search = e.target.value.trim().toLowerCase();
        this.applyFilters(state);
      }, 250);
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
    const summaryEl = document.getElementById("results-summary");
    const clearFiltersButton = document.getElementById("btn-clear-filters");

    if (clearFiltersButton && !clearFiltersButton.dataset.bound) {
      clearFiltersButton.dataset.bound = "true";
      clearFiltersButton.addEventListener("click", () => {
        state.filters = { search: "", directOnly: false, budgetAffordable: false };
        this.render(state);
        document.getElementById("country-search-input")?.focus();
      });
    }

    const countries = window.TRAVEL_DATA.countries.filter(c => c.continentId === state.selectedContinentId);
    const filtered = countries.filter(c => {
      if (state.filters.search) {
        const query = state.filters.search;
        const matchName = c.name.toLowerCase().includes(query) || c.englishName.toLowerCase().includes(query);
        const matchCity = c.cities.some(ci => ci.name.toLowerCase().includes(query) || ci.englishName.toLowerCase().includes(query));
        if (!matchName && !matchCity) return false;
      }
      if (state.filters.directOnly && !c.directFlight) return false;
      if (state.filters.budgetAffordable && (c.priceLevel.tier.includes("高") || c.priceLevel.tier.toLowerCase().includes("high"))) {
        return false;
      }
      return true;
    });

    if (summaryEl) summaryEl.textContent = `顯示 ${filtered.length} / ${countries.length} 個目的地`;

    if (filtered.length === 0) {
      listContainer.innerHTML = "";
      emptyState.style.display = "block";
      return;
    }

    emptyState.style.display = "none";
    listContainer.innerHTML = filtered.map(c => `
      <article class="country-card" role="button" tabindex="0" aria-label="探索 ${c.name}，${c.englishName}；${c.cities.length} 個熱門城市" onclick="window.appNavigate('country', { countryId: '${c.id}' })" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();window.appNavigate('country', { countryId: '${c.id}' });}">
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
        <span class="btn-card-action">探索目的地 <span aria-hidden="true">↗</span></span>
      </article>
    `).join("");
  }
};
