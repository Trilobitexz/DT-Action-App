// 畫面 3：國家與城市層級視圖模組 (第 1 部分：基本資料與即時匯率)
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
    
    // 即時匯率動態拉取
    const visaEl = document.getElementById("detail-currency-visa");
    visaEl.innerHTML = `幣別：${country.currency} ｜ 簽證：${country.visa} <span id="live-rate-tag" style="color:var(--primary); font-size:0.8rem; margin-left:6px;">(匯率計算中...)</span>`;

    if (window.CurrencyService) {
      window.CurrencyService.getExchangeRates().then(rateRes => {
        const currencyCode = country.currency.match(/\(([A-Z]{3})\)/)?.[1];
        if (currencyCode && rateRes.data) {
          const formatted = window.CurrencyService.formatRate(currencyCode, rateRes.data);
          const rateTag = document.getElementById("live-rate-tag");
          if (rateTag && formatted) {
            rateTag.innerHTML = ` · ⚡ 即時匯率：<strong>${formatted}</strong>`;
          }
        }
      });
    }

    // 飛機直飛資訊卡
    this.renderFlightInfo(country, state);

    // 當地物價水準卡
    this.renderPriceInfo(country);

    // 城市分頁切換與熱門景點清單
    this.renderCityAndSpots(country, state);
  },

  renderFlightInfo: function(country, state) {
    const currentCity = country.cities.find(ci => ci.id === state.selectedCityId) || country.cities[0];
    const flightSearch = window.FlightService?.generateSearchUrls(currentCity?.name || country.name);

    const flightEl = document.getElementById("detail-flight-content");
    flightEl.innerHTML = `
      <div style="margin-bottom: 0.75rem;">
        ${country.flightInfo.hasDirect 
          ? '<span class="badge-tag badge-direct" style="font-size:0.85rem;">✅ 台灣出發支援直飛</span>' 
          : '<span class="badge-tag badge-transit" style="font-size:0.85rem;">⚠️ 台灣無直飛（需轉機 1-2 次）</span>'}
      </div>
      <p style="margin-bottom: 0.4rem; font-size: 0.9rem;"><strong>出發與航程：</strong>${country.flightInfo.departureFrom} ｜ ${country.flightInfo.flightTime}</p>
      <p style="margin-bottom: 0.4rem; font-size: 0.9rem;"><strong>執飛航空公司：</strong>${country.flightInfo.airlines.join("、")}</p>
      <p style="font-size: 0.85rem; color: var(--text-muted); background: #f8fafc; padding: 0.5rem; border-radius: 6px; margin: 0.5rem 0;">💡 貼心提醒：${country.flightInfo.tips}</p>
      <div style="display:flex; gap:0.5rem; margin-top:0.75rem; flex-wrap:wrap;">
        <a href="${flightSearch?.googleFlightsUrl}" target="_blank" rel="noopener noreferrer" class="btn-card-action" style="text-decoration:none; display:inline-block; text-align:center; padding:6px 12px; font-size:0.8rem; width:auto;">
          🔍 Google 航班即時比價
        </a>
        <a href="${flightSearch?.skyscannerUrl}" target="_blank" rel="noopener noreferrer" class="btn-card-action" style="text-decoration:none; display:inline-block; text-align:center; padding:6px 12px; font-size:0.8rem; background:#e0f2fe; color:#0369a1; width:auto;">
          ✈️ Skyscanner 查價
        </a>
      </div>
    `;
  },

  // 畫面 3：物價資訊卡片
  renderPriceInfo: function(country) {
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
  },

  // 畫面 3：城市分頁切換與熱門景點清單
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
      <div class="spot-item" id="spot-item-${idx}">
        <div style="display:flex; gap:1rem; align-items:center; width:100%;">
          <div id="spot-thumb-${idx}" style="display:none; width:64px; height:64px; border-radius:8px; overflow:hidden; flex-shrink:0; background:#e2e8f0;"></div>
          <div class="spot-main" style="flex:1;">
            <h5>
              <span style="color:var(--primary); font-weight:800;">#${idx + 1}</span>
              ${spot.name}
              <span class="spot-badge">${spot.tag}</span>
              <span class="spot-badge" style="background:#f1f5f9; color:#475569;">${spot.category}</span>
            </h5>
            <div class="spot-note" id="spot-note-${idx}">${spot.note}</div>
          </div>
          <div style="display:flex; flex-direction:column; align-items:flex-end; gap:0.4rem;">
            <div class="spot-score">★ ${spot.rating}</div>
            <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(spot.name + ' ' + currentCity.name)}" target="_blank" rel="noopener noreferrer" style="font-size:0.75rem; color:var(--primary); text-decoration:none; display:inline-flex; align-items:center; gap:2px; background:#eff6ff; padding:2px 6px; border-radius:4px; font-weight:500;">
              📍 地圖導航
            </a>
          </div>
        </div>
      </div>
    `).join("");

    // 拉取城市即時氣象
    this.renderCityWeather(currentCity);

    if (window.SpotService) {
      currentCity.spots.forEach((spot, idx) => {
        window.SpotService.fetchSpotDetail(spot.name).then(wiki => {
          if (wiki) {
            if (wiki.thumbnail) {
              const thumbEl = document.getElementById(`spot-thumb-${idx}`);
              if (thumbEl) {
                thumbEl.innerHTML = `<img src="${wiki.thumbnail}" alt="${wiki.title}" style="width:100%; height:100%; object-fit:cover;" />`;
                thumbEl.style.display = "block";
              }
            }
            if (wiki.extract) {
              const noteEl = document.getElementById(`spot-note-${idx}`);
              if (noteEl) {
                noteEl.innerHTML = `${spot.note} <span style="display:block; margin-top:4px; font-size:0.8rem; color:#64748b; line-height:1.4;">📖 <em>${wiki.extract}</em> ${wiki.pageUrl ? `<a href="${wiki.pageUrl}" target="_blank" rel="noopener noreferrer" style="color:var(--primary); text-decoration:underline;">維基百科</a>` : ''}</span>`;
              }
            }
          }
        });
      });
    }
  },

  // 渲染城市即時天氣組件
  renderCityWeather: function(city) {
    const weatherWidget = document.getElementById("city-weather-widget");
    if (!weatherWidget) return;

    if (!city.lat || !city.lng || !window.WeatherService) {
      weatherWidget.style.display = "none";
      return;
    }

    weatherWidget.style.display = "inline-flex";
    weatherWidget.innerHTML = `🌤️ 載入即時天氣...`;

    window.WeatherService.getCityWeather(city.lat, city.lng).then(weather => {
      if (weather) {
        weatherWidget.innerHTML = `
          <span style="font-size:1.1rem; line-height:1;">${weather.icon}</span>
          <div>
            <strong>${city.name} 即時氣候：</strong>
            <span>${weather.temperature}°C · ${weather.description}</span>
            <span style="font-size:0.75rem; color:#64748b; margin-left:4px;">(濕度 ${weather.humidity}% / 風速 ${weather.windSpeed} km/h)</span>
          </div>
        `;
      } else {
        weatherWidget.style.display = "none";
      }
    });
  }
  }
};
