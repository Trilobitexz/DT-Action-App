// 畫面 3：國家與城市層級視圖模組 (第 1 部分：基本資料與即時匯率)
window.CountryView = {
  getGlobalCityProfile: function(city) {
    const profiles = {
      "日本": { hasDirect: true, flightTime: "約 3 ~ 4 小時", airlines: ["中華航空", "長榮航空", "星宇航空"], budget: "中等", rating: "$$-$$$" },
      "韓國": { hasDirect: true, flightTime: "約 2.5 ~ 3 小時", airlines: ["中華航空", "長榮航空", "台灣虎航"], budget: "親民", rating: "$$" },
      "泰國": { hasDirect: true, flightTime: "約 3.5 ~ 4 小時", airlines: ["中華航空", "長榮航空", "泰國航空"], budget: "親民", rating: "$$" },
      "新加坡": { hasDirect: true, flightTime: "約 4.5 小時", airlines: ["中華航空", "長榮航空", "酷航"], budget: "中等", rating: "$$-$$$" },
      "越南": { hasDirect: true, flightTime: "約 3 ~ 3.5 小時", airlines: ["中華航空", "越捷航空", "星宇航空"], budget: "親民", rating: "$$" },
      "中國": { hasDirect: true, flightTime: "依城市約 2 ~ 4 小時", airlines: ["中華航空", "長榮航空"], budget: "中等", rating: "$$-$$$" },
      "香港": { hasDirect: true, flightTime: "約 2 小時", airlines: ["中華航空", "長榮航空", "國泰航空"], budget: "中等", rating: "$$-$$$" }
    };
    return profiles[city.countryName] || { hasDirect: false, flightTime: "依季節與航線而異", airlines: [], budget: "依旅行風格而異", rating: "$$-$$$" };
  },

  render: function(state) {
    const globalCity = state.globalCityId && window.TRAVEL_DATA.globalCities.find(city => city.id === state.globalCityId);
    const globalProfile = globalCity ? this.getGlobalCityProfile(globalCity) : null;
    const country = globalCity ? {
      id: `global-${globalCity.id}`, name: globalCity.countryName, englishName: globalCity.countryName,
      flag: globalCity.flag, currency: "請查詢當地官方資訊", visa: "請依護照與最新官方規定確認",
      flightInfo: { hasDirect: globalProfile.hasDirect, departureFrom: "桃園 TPE", flightTime: globalProfile.flightTime, airlines: globalProfile.airlines, tips: globalProfile.hasDirect ? "航班會依季節與航空公司調整，出發前請確認最新班表。" : "目前常見需要轉機，航班與簽證請於出發前向官方確認。" },
      priceLevel: { tier: globalProfile.budget, rating: globalProfile.rating, dailyBudgetTwd: globalProfile.budget === "親民" ? "約 NT$1,800–3,200／日" : "約 NT$2,800–5,500／日", dining: globalProfile.budget === "親民" ? "約 NT$500–1,000／日" : "約 NT$800–1,800／日", transit: "約 NT$150–450／日", hotel: globalProfile.budget === "親民" ? "約 NT$1,200–3,000／晚" : "約 NT$2,000–6,000／晚" },
      cities: [{
        ...globalCity,
        description: `${globalCity.name}是${globalCity.countryName}的重要城市，適合從城市地標、在地生活與歷史脈絡開始探索。`,
        spots: globalCity.attractions.map((name, index) => ({ name, category: index === 0 ? "歷史文化" : "城市體驗", rating: (4.7 - index * 0.1).toFixed(1), tag: "推薦探索", note: "可查詢百科摘要、圖片與地圖位置，建議預留 1–2 小時探索。" }))
      }]
    } : window.TRAVEL_DATA.countries.find(c => c.id === state.selectedCountryId);
    if (!country) return;

    if (!state.selectedCityId || !country.cities.some(ci => ci.id === state.selectedCityId)) {
      state.selectedCityId = country.cities[0]?.id || null;
    }

    // 基本資訊標題
    document.getElementById("detail-country-flag").innerText = country.flag;
    document.getElementById("detail-country-name").innerText = `${country.name} (${country.englishName})`;
    const backButton = document.getElementById("btn-detail-back");
    if (backButton) {
      backButton.textContent = globalCity ? "← 返回全球城市榜單" : "← 返回大洲選單";
      backButton.onclick = () => window.appNavigate(globalCity ? "world" : "continent", globalCity ? {} : { continentId: state.selectedContinentId });
    }
    
    // 即時匯率動態拉取
    const visaEl = document.getElementById("detail-currency-visa");
    visaEl.innerHTML = `幣別：${country.currency} ｜ 簽證：${country.visa} <span id="live-rate-tag" style="color:var(--primary); font-size:0.8rem; margin-left:6px;">(匯率載入中...)</span>`;

    if (window.CurrencyService) {
      const rateCountryId = globalCity ? globalCity.id : country.id;
      window.CurrencyService.getExchangeRates().then(rateRes => {
        const activeRateTarget = state.globalCityId || state.selectedCountryId;
        if (activeRateTarget !== rateCountryId) return;
        const currencyCode = country.currency.match(/\(([A-Z]{3})\)/)?.[1];
        if (currencyCode && rateRes.data) {
          const formatted = window.CurrencyService.formatRate(currencyCode, rateRes.data);
          const rateTag = document.getElementById("live-rate-tag");
          if (rateTag && formatted) {
            const sourceText = rateRes.source === "live" ? "最新" : rateRes.source === "cache" ? "快取" : "備援";
            rateTag.textContent = ` · ${sourceText}匯率：${formatted}（${rateRes.updateTime || "來源時間未提供"}）`;
          }
        }
      }).catch(error => console.warn("顯示匯率失敗：", error));
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
      <div class="data-status-row" style="margin-bottom: 0.75rem;">
        ${country.flightInfo.hasDirect 
          ? '<span class="badge-tag badge-direct" style="font-size:0.85rem;">✅ 台灣出發支援直飛</span>' 
          : '<span class="badge-tag badge-transit" style="font-size:0.85rem;">⚠️ 台灣無直飛（需轉機 1-2 次）</span>'}
        <span class="data-source-badge">資料狀態：規劃參考</span>
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
      <div class="data-status-row" style="margin-bottom: 0.75rem;">
        <span class="badge-tag" style="background:#e0f2fe; color:#0369a1; font-size:0.85rem;">物價指數：${country.priceLevel.tier} (${country.priceLevel.rating})</span>
        <span class="data-source-badge">台幣估算 · 2026 參考</span>
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
    const detail = document.getElementById("city-detail-facts");
    if (detail) {
      detail.innerHTML = `
        <div><strong>🌤️ 氣候</strong><p>${currentCity.climate || "四季風貌各異，建議依月份查詢即時預報。"}</p></div>
        <div><strong>🎭 人文</strong><p>${currentCity.culture || "融合在地生活、飲食、節慶與當代城市文化。"}</p></div>
        <div><strong>📜 歷史</strong><p>${currentCity.history || "可從歷史街區、博物館與城市地標認識發展脈絡。"}</p></div>
      `;
    }
    const chart = document.getElementById("city-insight-chart");
    if (chart) {
      const metrics = [
        ["文化深度", currentCity.culture ? 88 : 62, "節慶、飲食與生活脈絡"],
        ["歷史探索", currentCity.history ? 84 : 60, "古蹟、街區與博物館"],
        ["城市便利", 76, "交通、資訊與移動彈性"],
        ["初訪友善", 81, "適合作為第一次造訪的目的地"]
      ];
      chart.innerHTML = metrics.map(([name, value, hint]) => `
        <div class="insight-metric" title="${hint}">
          <div><strong>${name}</strong><span>${value}</span></div>
          <div class="insight-track"><i style="width:${value}%"></i></div>
          <small>${hint}</small>
        </div>
      `).join("");
    }
    window.PlannerView?.renderCityTools(currentCity, state);

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
            <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(spot.name + ' ' + currentCity.name)}" target="_self" style="font-size:0.75rem; color:var(--primary); text-decoration:none; display:inline-flex; align-items:center; gap:2px; background:#eff6ff; padding:2px 6px; border-radius:4px; font-weight:500;">
              📍 地圖導航
            </a>
          </div>
        </div>
      </div>
    `).join("");

    // 非同步結果只有在使用者仍停留於同一城市時才更新頁面。
    const renderedCountryId = country.id;
    const renderedCityId = currentCity.id;
    const isCurrentCity = () => {
      const activeCountryId = state.globalCityId ? `global-${state.globalCityId}` : state.selectedCountryId;
      return activeCountryId === renderedCountryId && state.selectedCityId === renderedCityId;
    };
    this.renderCityWeather(currentCity, renderedCountryId, renderedCityId, state);

    if (window.SpotService) {
      currentCity.spots.forEach((spot, idx) => {
        window.SpotService.fetchSpotDetail(spot.name, currentCity.name, currentCity).then(wiki => {
          if (!wiki || !isCurrentCity()) return;
          const thumbEl = document.getElementById(`spot-thumb-${idx}`);
          if (wiki.thumbnail && thumbEl) {
            const image = document.createElement("img");
            image.src = wiki.thumbnail;
            image.alt = wiki.title || spot.name;
            image.loading = "lazy";
            image.referrerPolicy = "no-referrer";
            image.style.cssText = "width:100%; height:100%; object-fit:cover;";
            thumbEl.replaceChildren(image);
            thumbEl.style.display = "block";
          }
          if (wiki.extract || wiki.location?.address || wiki.sources?.length) {
            const noteEl = document.getElementById(`spot-note-${idx}`);
            if (noteEl) {
              const detail = document.createElement("span");
              detail.style.cssText = "display:block; margin-top:4px; font-size:0.8rem; color:#64748b; line-height:1.4;";
              if (wiki.extract) {
                const extract = document.createElement("em");
                extract.textContent = wiki.extract;
                detail.append("📖 ", extract, " ");
              }
              if (wiki.pageUrl) {
                const link = document.createElement("a");
                link.href = wiki.pageUrl;
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                link.textContent = wiki.sourceLabel || "資料來源";
                detail.appendChild(link);
              }
              if (wiki.location?.address) {
                const location = document.createElement("span");
                location.style.cssText = "display:block; margin-top:3px;";
                location.textContent = `📍 ${wiki.location.address}`;
                detail.appendChild(location);
              }
              if (wiki.sources?.length > 1) {
                const sources = document.createElement("small");
                sources.style.cssText = "display:block; margin-top:3px;";
                sources.append("資料維度：");
                wiki.sources.forEach((source, sourceIndex) => {
                  if (sourceIndex > 0) sources.append(" · ");
                  if (source.url) {
                    const sourceLink = document.createElement("a");
                    sourceLink.href = source.url;
                    sourceLink.target = "_blank";
                    sourceLink.rel = "noopener noreferrer";
                    sourceLink.textContent = source.label;
                    sources.appendChild(sourceLink);
                  } else {
                    sources.append(source.label);
                  }
                });
                detail.appendChild(sources);
              }
              noteEl.appendChild(detail);
            }
          }
        }).catch(error => console.warn("景點百科載入失敗：", error));
      });
    }
  },

  // 渲染城市即時天氣組件
  renderCityWeather: function(city, countryId, cityId, state) {
    const weatherWidget = document.getElementById("city-weather-widget");
    if (!weatherWidget) return;

    if (!city.lat || !city.lng || !window.WeatherService) {
      weatherWidget.style.display = "none";
      return;
    }

    weatherWidget.style.display = "inline-flex";
    weatherWidget.innerHTML = `🌤️ 載入即時天氣...`;

    window.WeatherService.getCityWeather(city.lat, city.lng).then(weather => {
      const activeCountryId = state.globalCityId ? `global-${state.globalCityId}` : state.selectedCountryId;
      if (activeCountryId !== countryId || state.selectedCityId !== cityId) return;
      if (weather) {
        weatherWidget.innerHTML = `
          <span style="font-size:1.1rem; line-height:1;">${weather.icon}</span>
          <div>
            <strong>${city.name} 天氣：</strong>
            <span>${weather.temperature}°C · ${weather.description}</span>
            <span style="display:block;font-size:0.75rem;color:#64748b;">濕度 ${weather.humidity}% / 風速 ${weather.windSpeed} km/h · ${weather.timezone} ${weather.time} · 來源：${weather.source}</span>
          </div>
        `;
      } else {
        weatherWidget.textContent = "目前無法取得天氣資料";
      }
    }).catch(error => {
      const activeCountryId = state.globalCityId ? `global-${state.globalCityId}` : state.selectedCountryId;
      if (activeCountryId === countryId && state.selectedCityId === cityId) {
        weatherWidget.textContent = "目前無法取得天氣資料";
      }
      console.warn("顯示天氣失敗：", error);
    });
  }
};
