// 全球城市榜單與搜尋入口
window.GlobalCitiesView = {
  pageSize: 24,
  state: { name: 24, completeness: 24 },
  render: function () {
    const data = window.TRAVEL_DATA || {};
    const source = data.globalCityLists || {};
    const allCities = Array.isArray(data.globalCities) ? data.globalCities : [];
    const nameSorted = Array.isArray(source.nameSorted)
      ? source.nameSorted
      : [...allCities].sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""), "zh-Hant"));
    const dataComplete = Array.isArray(source.dataComplete) ? source.dataComplete : nameSorted;
    const search = document.getElementById("global-city-search");
    const renderList = (targetId, cities, key) => {
      const target = document.getElementById(targetId);
      if (!target) return;
      const filtered = cities.filter(city => this.matches(city, search?.value || ""));
      const visible = filtered.slice(0, this.state[key]);
      target.innerHTML = visible.map(city => `
        <button type="button" class="global-city-card" data-global-city-id="${this.escapeHtml(city.id)}">
          <span class="global-city-flag">${this.escapeHtml(city.flag || "🌍")}</span>
          <span class="global-city-copy"><strong>${this.escapeHtml(city.name || city.englishName || "未命名城市")}</strong><small>${this.escapeHtml([city.englishName, city.countryName].filter(Boolean).join(" · ") || "探索目的地資訊")}</small></span>
          <span class="global-city-arrow" aria-hidden="true">↗</span>
        </button>
      `).join("");
      if (!visible.length) {
        const empty = document.createElement("p");
        empty.className = "global-city-empty";
        empty.textContent = search?.value.trim()
          ? `找不到符合「${search.value.trim()}」的城市。`
          : "城市資料目前無法載入，請稍後再試。";
        target.replaceChildren(empty);
      } else if (visible.length < filtered.length) {
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
      if (!target.dataset.bound) {
        target.dataset.bound = "true";
        target.addEventListener("click", event => {
          const card = event.target.closest("[data-global-city-id]");
          if (card) window.appNavigate("global-city", { cityId: card.dataset.globalCityId });
        });
      }
    };
    renderList("global-population-list", nameSorted, "name");
    renderList("global-travel-list", dataComplete, "completeness");
    const count = document.getElementById("global-city-count");
    if (count) count.textContent = nameSorted.length
      ? `收錄 ${nameSorted.length} 座全球城市`
      : "城市目錄暫時沒有可顯示的資料";
    if (search && !search.dataset.bound) {
      search.dataset.bound = "true";
      let timer;
      search.addEventListener("input", () => {
        window.clearTimeout(timer);
        this.state = { name: this.pageSize, completeness: this.pageSize };
        timer = window.setTimeout(() => this.render(), 120);
      });
    }
  },

  escapeHtml: function (value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  },

  matches: function (city, value) {
    const query = String(value || "").trim().toLocaleLowerCase();
    if (!query) return true;
    return [city?.name, city?.englishName, city?.countryName, city?.continentName]
      .filter(item => item !== null && item !== undefined)
      .some(item => String(item).toLocaleLowerCase().includes(query));
  }
};
