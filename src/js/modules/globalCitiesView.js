// 全球城市榜單與搜尋入口
window.GlobalCitiesView = {
  pageSize: 24,
  state: { name: 24, completeness: 24 },
  render: function () {
    const lists = window.TRAVEL_DATA.globalCityLists;
    const search = document.getElementById("global-city-search");
    const renderList = (targetId, cities, key) => {
      const target = document.getElementById(targetId);
      if (!target) return;
      const filtered = cities.filter(city => this.matches(city, search?.value || ""));
      const visible = filtered.slice(0, this.state[key]);
      target.innerHTML = visible.map(city => `
        <button type="button" class="global-city-card" onclick="window.appNavigate('global-city', { cityId: '${city.id}' })">
          <span class="global-city-flag">${city.flag}</span>
          <span class="global-city-copy"><strong>${city.name}</strong><small>${city.englishName} · ${city.countryName}</small></span>
          <span class="global-city-arrow">↗</span>
        </button>
      `).join("") || `<p class="global-city-empty">找不到符合「${search?.value || ""}」的城市。</p>`;
      if (visible.length < filtered.length) {
        const more = document.createElement("button");
        more.type = "button";
        more.className = "global-city-more";
        more.textContent = `顯示更多（還有 ${filtered.length - visible.length} 個城市）`;
        more.addEventListener("click", () => {
          this.state[key] += this.pageSize;
          this.render();
        });
        target.appendChild(more);
      }
    };
    renderList("global-population-list", lists.nameSorted, "name");
    renderList("global-travel-list", lists.dataComplete, "completeness");
    const count = document.getElementById("global-city-count");
    if (count) count.textContent = `收錄 ${lists.nameSorted.length} 座去重城市`;
    if (search && !search.dataset.bound) {
      search.dataset.bound = "true";
      let timer;
      search.addEventListener("input", () => {
        window.clearTimeout(timer);
        this.state = { name: this.pageSize, completeness: this.pageSize };
        timer = window.setTimeout(() => this.render(), 180);
      });
    }
  },

  matches: function (city, value) {
    const query = value.trim().toLowerCase();
    return !query || [city.name, city.englishName, city.countryName, city.continentName].some(item => item.toLowerCase().includes(query));
  }
};
