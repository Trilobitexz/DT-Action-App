// 畫面 3：國家與城市層級視圖模組 (直飛情報、生活物價、城市景點清單)
window.CountryView = {
  render: function(state) {
    const country = window.TRAVEL_DATA.countries.find(c => c.id === state.selectedCountryId);
    if (!country) return;

    if (!state.selectedCityId || !country.cities.some(ci => ci.id === state.selectedCityId)) {
      state.selectedCityId = country.cities[0]?.id || null;
    }

    // 基本資訊標題
    document.getElementById("detail-country-flag").innerText = country.flag;
    document.getElementById("detail-country-name").innerText = `${country.name} (${country.englishName})`;
    document.getElementById("detail-currency-visa").innerText = `幣別：${country.currency}（${country.exchangeRate}） ｜ 簽證：${country.visa}`;

    // 飛機直飛資訊卡
    const flightEl = document.getElementById("detail-flight-content");
    flightEl.innerHTML = `
      <div style="margin-bottom: 0.75rem;">
        ${country.flightInfo.hasDirect 
          ? '<span class="badge-tag badge-direct" style="font-size:0.85rem;">✅ 台灣出發支援直飛</span>' 
          : '<span class="badge-tag badge-transit" style="font-size:0.85rem;">⚠️ 台灣無直飛（需轉機 1-2 次）</span>'}
      </div>
      <p style="margin-bottom: 0.4rem; font-size: 0.9rem;"><strong>出發與航程：</strong>${country.flightInfo.departureFrom} ｜ ${country.flightInfo.flightTime}</p>
      <p style="margin-bottom: 0.4rem; font-size: 0.9rem;"><strong>執飛航空公司：</strong>${country.flightInfo.airlines.join("、")}</p>
      <p style="font-size: 0.85rem; color: var(--text-muted); background: #f8fafc; padding: 0.5rem; border-radius: 6px; margin-top:0.5rem;">💡 貼心提醒：${country.flightInfo.tips}</p>
    `;

    // 當地物價水準卡
    const priceEl = document.getElementById("detail-price-content");
    priceEl.innerHTML = `
      <div style="margin-bottom: 0.75rem;">
        <span class="badge-tag" style="background:#e0f2fe; color:#0369a1; font-size:0.85rem;">物價指數：${country.priceLevel.tier} (${country.priceLevel.rating})</span>
      </div>
      <p style="margin-bottom: 0.4rem; font-size: 0.9rem;"><strong>日均預算：</strong>${country.priceLevel.dailyBudgetTwd}</p>
      <p style="margin-bottom: 0.4rem; font-size: 0.9rem;"><strong>餐飲物價：</strong>${country.priceLevel.dining}</p>
      <p style="margin-bottom: 0.4rem; font-size: 0.9rem;"><strong>市區交通：</strong>${country.priceLevel.transit}</p>
      <p style="margin-bottom: 0.4rem; font-size: 0.9rem;"><strong>住宿參考：</strong>${country.priceLevel.hotel}</p>
    `;

    // 城市分頁切換與熱門景點清單
    this.renderCityAndSpots(country, state);
  },

  renderCityAndSpots: function(country, state) {
    const tabList = document.getElementById("city-tab-list");
    const spotsContainer = document.getElementById("city-spots-list");

    tabList.innerHTML = country.cities.map(city => `
      <button class="city-tab-btn ${city.id === state.selectedCityId ? 'active' : ''}" 
              onclick="window.switchCity('${city.id}')">
        🏙️ ${city.name} (${city.englishName})
      </button>
    `).join("");

    const currentCity = country.cities.find(ci => ci.id === state.selectedCityId) || country.cities[0];
    if (!currentCity) return;

    document.getElementById("city-description-text").innerText = currentCity.description;

    spotsContainer.innerHTML = currentCity.spots.map((spot, idx) => `
      <div class="spot-item">
        <div class="spot-main">
          <h5>
            <span style="color:var(--primary); font-weight:800;">#${idx + 1}</span>
            ${spot.name}
            <span class="spot-badge">${spot.tag}</span>
            <span class="spot-badge" style="background:#f1f5f9; color:#475569;">${spot.category}</span>
          </h5>
          <div class="spot-note">${spot.note}</div>
        </div>
        <div class="spot-score">★ ${spot.rating}</div>
      </div>
    `).join("");
  }
};
