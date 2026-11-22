// 畫面 3：國家與城市層級視圖模組 (第 1 部分：基本資料與即時匯率)
window.CountryView = {
  getGlobalCityProfile: function(city) {
    return {
      hasDirect: null,
      flightTime: `${city.name} 航線與班次依出發日期即時查詢`,
      airlines: [],
      budget: `${city.name} 的餐飲、交通與住宿會依日期及區域變動`,
      rating: "依行程查詢"
    };
  },

  render: function(state) {
    const aliases = window.TRAVEL_DATA.globalCityAliases || {};
    if (state.globalCityId && aliases[state.globalCityId]) state.globalCityId = aliases[state.globalCityId];
    const globalCity = state.globalCityId && window.TRAVEL_DATA.globalCities.find(city => city.id === state.globalCityId);
    const globalProfile = globalCity ? this.getGlobalCityProfile(globalCity) : null;
    const country = globalCity ? {
      id: `global-${globalCity.id}`, name: globalCity.countryName, englishName: globalCity.countryName,
      flag: globalCity.flag, currency: "請查詢當地官方資訊", visa: "請依護照與最新官方規定確認",
      flightInfo: { hasDirect: globalProfile.hasDirect, departureFrom: "", flightTime: globalProfile.flightTime, airlines: globalProfile.airlines, tips: "航線、班表及航空公司會依出發日期變動，請使用航空公司與航班查詢入口。" },
      priceLevel: { tier: globalProfile.budget, rating: globalProfile.rating, dailyBudgetTwd: "", dining: "", transit: "", hotel: "", verified: false },
      cities: [{
        ...globalCity,
        catalogSourceCity: globalCity,
        spots: (Array.isArray(globalCity.spots) ? globalCity.spots : []).map(spot => typeof spot === "string"
          ? { name: spot, category: "景點", rating: "—", tag: "公開目錄", note: "" }
          : spot)
      }]
    } : window.TRAVEL_DATA.countries.find(c => c.id === state.selectedCountryId);
    if (!country) return;

    if (!state.selectedCityId || !country.cities.some(ci => ci.id === state.selectedCityId)) {
      state.selectedCityId = country.cities[0]?.id || null;
    }

    // 基本資訊標題
    document.getElementById("detail-country-flag").innerText = country.flag;
    document.getElementById("detail-country-name").innerText = `${country.name} (${country.englishName})`;
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
        ${country.flightInfo.hasDirect === true
          ? '<span class="badge-tag badge-direct" style="font-size:0.85rem;">✅ 台灣出發支援直飛</span>'
          : country.flightInfo.hasDirect === false
            ? '<span class="badge-tag badge-transit" style="font-size:0.85rem;">⚠️ 台灣出發需轉機</span>'
            : '<span class="data-source-badge">依城市與出發日期即時查詢</span>'}
        <span class="data-source-badge">依官方即時班表確認</span>
      </div>
      <p style="margin-bottom: 0.4rem; font-size: 0.9rem;"><strong>出發與航程：</strong>${country.flightInfo.hasDirect === null ? `${currentCity?.name || country.name}：${country.flightInfo.flightTime}` : `${country.flightInfo.departureFrom} ｜ ${country.flightInfo.flightTime}`}</p>
      <p style="margin-bottom: 0.4rem; font-size: 0.9rem;"><strong>執飛航空公司：</strong>${country.flightInfo.airlines.length ? country.flightInfo.airlines.join("、") : "請以即時航班查詢結果為準"}</p>
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
    if (country.priceLevel.verified === false) {
      priceEl.innerHTML = `<div class="data-status-row" style="margin-bottom:0.75rem;"><span class="data-source-badge">城市消費依日期與區域變動</span></div><p><strong>${country.cities[0]?.name || country.name}</strong>：${country.priceLevel.budget || "餐飲、交通與住宿價格會隨日期、區域及供應商變動，請使用下方城市行程與即時服務查詢。"} </p><p style="font-size:0.85rem; color:var(--text-muted);">航班、匯率、天氣與景點資料會分別連結至其來源；頁面不以國家平均值冒充城市即時價格。</p>`;
      return;
    }
    priceEl.innerHTML = `
      <div class="data-status-row" style="margin-bottom: 0.75rem;">
        <span class="badge-tag" style="background:#e0f2fe; color:#0369a1; font-size:0.85rem;">相對物價參考級距：${country.priceLevel.tier} (${country.priceLevel.rating})</span>
        <span class="data-source-badge">規劃參考 · 非即時報價</span>
      </div>
      <p style="margin-bottom: 0.4rem; font-size: 0.9rem;"><strong>日均預算：</strong>${country.priceLevel.dailyBudgetTwd}</p>
      <p style="margin-bottom: 0.4rem; font-size: 0.9rem;"><strong>餐飲物價：</strong>${country.priceLevel.dining}</p>
      <p style="margin-bottom: 0.4rem; font-size: 0.9rem;"><strong>市區交通：</strong>${country.priceLevel.transit}</p>
      <p style="margin-bottom: 0.4rem; font-size: 0.9rem;"><strong>住宿參考：</strong>${country.priceLevel.hotel}</p>
      <p style="font-size:0.82rem; color:var(--text-muted);">以上是專案整理的概略範圍，不是經統計計算的城市評分或即時報價。實際費用會因城市區域、旅行日期、匯率與消費方式而異，請依出發日期向服務提供者確認。</p>
    `;
  },

  // 畫面 3：城市分頁切換與熱門景點清單
  renderCityAndSpots: function(country, state) {
    const tabList = document.getElementById("city-tab-list");
    const spotsContainer = document.getElementById("city-spots-list");
    const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
    const safeHttpUrl = value => {
      try {
        const url = new URL(value);
        return ["https:", "http:"].includes(url.protocol) ? url.href : "";
      } catch (error) { return ""; }
    };
    const hasSourcedRating = spot => spot?.rating !== null && spot?.rating !== undefined && spot?.rating !== ""
      && Number.isFinite(Number(spot.rating))
      && Number(spot.rating) >= 0 && Number(spot.rating) <= 5 && Boolean(String(spot.ratingSource || "").trim());

    tabList.setAttribute("role", "tablist");
    tabList.setAttribute("aria-label", "選擇城市");
    spotsContainer?.setAttribute("role", "tabpanel");
    spotsContainer?.setAttribute("aria-labelledby", `city-tab-${state.selectedCityId}`);
    tabList.innerHTML = country.cities.map(city => `
      <button class="city-tab-btn ${city.id === state.selectedCityId ? 'active' : ''}"
              id="city-tab-${city.id}" role="tab" aria-selected="${city.id === state.selectedCityId}"
              aria-controls="city-spots-list" tabindex="${city.id === state.selectedCityId ? 0 : -1}"
              onclick="window.switchCity('${city.id}')">
        🏙️ ${city.name} (${city.englishName})
      </button>
    `).join("");

    const currentCity = country.cities.find(ci => ci.id === state.selectedCityId) || country.cities[0];
    if (!currentCity) return;
    spotsContainer.onclick = event => {
      const retryButton = event.target.closest("[data-retry-city-spots]");
      if (retryButton) {
        const cityKey = String(catalogCity.id || currentCity.id || "");
        const displayCityKey = String(currentCity.id || cityKey);
        window.CityCatalogService?.spotCache.delete(cityKey);
        window.CityCatalogService?.cache.delete(cityKey);
        window.CityCatalogService?.failedCityReads.delete(cityKey);
        currentCity._spotCatalogReady = false;
        if (currentCity.catalogSourceCity) currentCity.catalogSourceCity._spotCatalogReady = false;
        try {
          [cityKey, displayCityKey].forEach(key => {
            localStorage.removeItem(`journey-atlas-city-spots-v2-${key}`);
            localStorage.removeItem(`journey-atlas-verified-places-v4-${key}`);
          });
        } catch (error) { /* 私密瀏覽模式不支援快取 */ }
        window.CountryView.render(state);
        return;
      }
      const expandButton = event.target.closest("[data-toggle-spots]");
      if (expandButton) {
        const expanded = expandButton.dataset.expanded === "true";
        if (expanded) {
          spotsContainer.querySelectorAll("[data-extra-spot]").forEach(item => item.remove());
          expandButton.dataset.expanded = "false";
          expandButton.textContent = `顯示其餘 ${spots.length - 4} 個景點`;
        } else {
          expandButton.insertAdjacentHTML("beforebegin", spots.slice(4).map((spot, index) => renderSpotCard(spot, index + 4, true)).join(""));
          loadSpotDetails(spots.slice(4), 4);
          expandButton.dataset.expanded = "true";
          expandButton.textContent = "收合景點清單";
        }
        return;
      }
      const button = event.target.closest("[data-map-focus-spot]");
      if (!button || button.disabled) return;
      window.mapManager?.focusSpot(button.dataset.cityId, Number(button.dataset.spotIndex));
    };

    const cityDescription = document.getElementById("city-description-text");
    if (cityDescription) {
      const locationText = Number.isFinite(currentCity.lat) && Number.isFinite(currentCity.lng)
        ? `座標 ${currentCity.lat.toFixed(4)}, ${currentCity.lng.toFixed(4)}`
        : "座標資料載入中";
      cityDescription.innerText = currentCity.descriptionSource?.text
        || `${currentCity.name}（${currentCity.englishName}）位於${currentCity.countryName || country.name}，${locationText}。正在整理旅遊指南與百科資料。`;
    }
    const cityHeading = document.querySelector("#view-country .city-tabs-card h3");
    if (cityHeading) cityHeading.textContent = `🏙️ ${currentCity.name}：${currentCity.destinationType === "island" ? "目的地資訊" : "城市資訊"}與景點資料`;
    const detail = document.getElementById("city-detail-facts");
    if (detail) {
      detail.innerHTML = `
        <div><strong>📍 位置</strong><p>${currentCity.countryName || country.name} · ${Number.isFinite(currentCity.lat) && Number.isFinite(currentCity.lng) ? `${currentCity.lat.toFixed(4)}, ${currentCity.lng.toFixed(4)}` : "資料載入中"}</p></div>
        <div><strong>🧭 目的地類型</strong><p>${currentCity.destinationType === "island" ? "島嶼目的地" : "城市目的地"} · 可從地圖查看周邊公開地點</p></div>
        <div><strong>📚 深度資料</strong><p>${currentCity.climateSource ? currentCity.climate : "旅遊指南、百科摘要與公開地圖資料正在載入，取得後會附上原始來源。"}</p></div>
      `;
    }
    const chart = document.getElementById("city-insight-chart");
    if (chart) {
      const facts = Array.isArray(currentCity.spots) ? currentCity.spots : [];
      const verifiedSpotCount = facts.filter(spot => !spot.isSearchSuggestion
        && Number.isFinite(spot.lat) && Number.isFinite(spot.lng) && spot.sourceUrl).length;
      const searchSpotCount = facts.filter(spot => spot.isSearchSuggestion).length;
      const airports = Array.isArray(currentCity.airports) ? currentCity.airports : [];
      const metrics = [
        ["城市介紹", currentCity.descriptionSource?.text ? 1 : 0, currentCity.descriptionSource?.text ? "附來源" : "百科摘要載入中"],
        ["景點", Math.min(verifiedSpotCount, 5) / 5, `${verifiedSpotCount} 筆有座標來源${searchSpotCount ? `，另有 ${searchSpotCount} 個地圖搜尋入口` : ""}`],
        ["機場", airports.length ? 1 : 0, airports.length ? `${airports.length} 筆已編目資料` : "依城市資料與即時地圖查詢"],
        ["座標", Number.isFinite(currentCity.lat) && Number.isFinite(currentCity.lng) ? 1 : 0, currentCity.coordinateSource?.provider || "城市目錄座標"]
      ];
      chart.innerHTML = `<p class="city-data-completeness-label">資料完整度（不代表旅遊評分）</p>` + metrics.map(([name, completeness, hint]) => `
        <div class="insight-metric" data-insight="${name === "景點" ? "spots" : ""}" title="${hint}">
          <div><strong>${name}</strong><span>${hint}</span>${name === "座標" && currentCity.coordinateSource?.sourceUrl ? `<a href="${currentCity.coordinateSource.sourceUrl}" target="_blank" rel="noopener noreferrer">查看來源</a>` : ""}</div>
          <div class="insight-track"><i style="width:${completeness * 100}%"></i></div>
        </div>
      `).join("");
    }
    window.PlannerView?.renderCityTools(currentCity, state);

    const resolvedSpots = Array.isArray(currentCity.spots) ? currentCity.spots : [];
    const candidates = Array.isArray(currentCity.spotCandidates) ? currentCity.spotCandidates : [];
    const candidateNames = new Set(resolvedSpots.map(spot => String(spot.name || "").normalize("NFKC").trim().toLocaleLowerCase()));
    const availableSpots = [
      ...resolvedSpots,
      ...candidates.filter(candidate => {
        const name = String(candidate.name || "").normalize("NFKC").trim().toLocaleLowerCase();
        if (!name || candidateNames.has(name)) return false;
        candidateNames.add(name);
        return true;
      }).map(candidate => ({ ...candidate, ratingSource: null, lat: null, lng: null }))
    ];
    const spots = availableSpots.length ? availableSpots : (window.CityCatalogService?.createMapSearchSuggestions(currentCity) || []);
    const renderSpotCard = (spot, idx, extra = false) => `
      <div class="spot-item" id="spot-item-${idx}" data-city-id="${currentCity.id}" data-spot-index="${idx}" ${extra ? "data-extra-spot" : ""}>
        <div style="display:flex; gap:1rem; align-items:center; width:100%;">
          <div class="spot-media"><div id="spot-thumb-${idx}" class="spot-thumbnail" hidden></div><a id="spot-image-source-${idx}" class="spot-image-source" target="_blank" rel="noopener noreferrer" hidden>圖片來源</a></div>
          <div class="spot-main" style="flex:1;">
            <h5>
              <span style="color:var(--primary); font-weight:800;">#${idx + 1}</span>
              ${escapeHtml(spot.name)}
              ${spot.tag ? `<span class="spot-badge">${escapeHtml(spot.tag)}</span>` : ""}
              <span class="spot-badge" style="background:#f1f5f9; color:#475569;">${escapeHtml(spot.category || "景點")}</span>
              ${spot.isSearchSuggestion ? '<span class="spot-badge" style="background:#fff7ed;color:#9a3412;">地圖搜尋入口</span>' : ""}
            </h5>
            <div class="spot-note" id="spot-note-${idx}">${escapeHtml(spot.note || "")}</div>
          </div>
          <div style="display:flex; flex-direction:column; align-items:flex-end; gap:0.4rem;">
            <div class="spot-score">${hasSourcedRating(spot) ? `★ ${Number(spot.rating).toFixed(1)} · ${escapeHtml(spot.ratingSource)}` : "評分資料未提供"}</div>
            <button type="button" class="spot-map-focus" data-map-focus-spot data-city-id="${currentCity.id}" data-spot-index="${idx}" ${idx >= (window.MapManager?.MAX_CITY_SPOT_MARKERS || 12) || (!Number.isFinite(spot.lat) || !Number.isFinite(spot.lng)) ? "disabled" : ""} title="${idx >= (window.MapManager?.MAX_CITY_SPOT_MARKERS || 12) ? "為保持地圖清晰，目前只載入前 12 個來源優先景點" : "在城市地圖查看位置"}">🗺️ 在地圖查看</button>
            <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${spot.name}, ${currentCity.name}, ${currentCity.countryName || country.name}`)}" target="_blank" rel="noopener noreferrer" class="spot-source-link spot-google-map">在 Google 地圖開啟</a>
            ${safeHttpUrl(spot.sourceUrl) ? `<a href="${safeHttpUrl(spot.sourceUrl)}" target="_blank" rel="noopener noreferrer" class="spot-source-link">查看來源資料</a>` : ""}
            ${safeHttpUrl(spot.website) ? `<a href="${safeHttpUrl(spot.website)}" target="_blank" rel="noopener noreferrer" class="spot-source-link">官方網站／資訊</a>` : ""}
            ${safeHttpUrl(spot.wikipediaUrl) ? `<a href="${safeHttpUrl(spot.wikipediaUrl)}" target="_blank" rel="noopener noreferrer" class="spot-source-link">Wikipedia${spot.wikipedia ? `（${escapeHtml(spot.wikipedia)}）` : ""}</a>` : ""}
            ${spot.wikidataId ? `<a href="https://www.wikidata.org/wiki/${encodeURIComponent(spot.wikidataId)}" target="_blank" rel="noopener noreferrer" class="spot-source-link">Wikidata</a>` : ""}
          </div>
        </div>
      </div>
    `;
    spotsContainer.innerHTML = spots.length
      ? `${spots.slice(0, 4).map((spot, idx) => renderSpotCard(spot, idx)).join("")}${spots.length > 4 ? `<button type="button" class="spot-list-toggle" data-toggle-spots data-expanded="false">顯示其餘 ${spots.length - 4} 個景點</button>` : ""}`
      : `<p class="spot-data-empty">正在查詢 ${escapeHtml(currentCity.name)} 周邊的公開景點資料；結果會附上地圖座標與來源連結。</p>`;
    if (currentCity._spotCatalogReady && currentCity.spotsSource === "local-or-map-search") {
      const retry = document.createElement("button");
      retry.type = "button";
      retry.dataset.retryCitySpots = "";
      retry.className = "spot-list-toggle";
      retry.textContent = "重新載入城市景點";
      spotsContainer.appendChild(retry);
    }

    // 非同步結果只有在使用者仍停留於同一城市時才更新頁面。
    const renderedCountryId = country.id;
    const renderedCityId = currentCity.id;
    const isCurrentCity = () => {
      const activeCountryId = state.globalCityId ? `global-${state.globalCityId}` : state.selectedCountryId;
      return activeCountryId === renderedCountryId && state.selectedCityId === renderedCityId;
    };
    const loadSpotDetails = (items, offset = 0) => {
      if (!window.SpotService) return;
      items.forEach((spot, relativeIndex) => {
        if (spot.isSearchSuggestion) return;
        const idx = offset + relativeIndex;
        const thumbEl = document.getElementById(`spot-thumb-${idx}`);
        const imageUrl = spot.imageUrl || spot.thumbnail || spot.photoUrl;
        const addImage = (url, alt, sourceUrl) => {
          if (!url || !thumbEl || !isCurrentCity()) return;
          let safeImageUrl;
          try {
            safeImageUrl = new URL(url, window.location.href);
            if (!/^https?:$/.test(safeImageUrl.protocol)) return;
          } catch (error) { return; }
          const image = document.createElement("img");
          image.src = safeImageUrl.href;
          image.alt = alt || spot.name;
          image.loading = "lazy";
          image.decoding = "async";
          image.referrerPolicy = "no-referrer";
          image.onerror = () => {
            thumbEl.hidden = true;
            const sourceLink = document.getElementById(`spot-image-source-${idx}`);
            if (sourceLink) sourceLink.hidden = true;
          };
          thumbEl.replaceChildren(image);
          thumbEl.hidden = false;
          const attribution = document.getElementById(`spot-image-source-${idx}`);
          if (attribution && sourceUrl) {
            try {
              const safeSourceUrl = new URL(sourceUrl, window.location.href);
              if (/^https?:$/.test(safeSourceUrl.protocol)) {
                attribution.href = safeSourceUrl.href;
                attribution.hidden = false;
              }
            } catch (error) { /* 無效來源連結不顯示 */ }
          }
        };
        if (imageUrl) {
          addImage(imageUrl, spot.name, spot.imageSourceUrl || spot.wikipediaUrl);
          return;
        }
        window.SpotService.fetchSpotImage(spot.name, currentCity.name).then(image => {
          if (image && isCurrentCity()) addImage(image.thumbnail, image.title || spot.name, image.pageUrl);
        }).catch(error => console.warn("景點圖片載入失敗：", error));
      });
    };
    const catalogCity = currentCity.catalogSourceCity || currentCity;
    if (window.CityCatalogService?.ensureSpots && !catalogCity._spotCatalogReady) {
      window.CityCatalogService.ensureSpots(catalogCity).then(spots => {
        currentCity.spots = spots;
        currentCity._spotCatalogReady = true;
        currentCity.spotsSource = catalogCity.spotsSource;
        if (isCurrentCity()) {
          window.CountryView.render(state);
          if (window.mapManager?.currentCityContext?.id === currentCity.id) {
            window.mapManager.showCityContext(currentCity, { animate: false, preserveView: true });
          }
        }
      }).catch(error => {
        console.warn(`無法整理 ${currentCity.name} 的景點資料：`, error);
      });
    }
    if (!cityDescription?.textContent?.includes("正在向 OpenStreetMap") && cityDescription && window.SpotService?.fetchCitySummary
      && Number.isFinite(currentCity.lat) && Number.isFinite(currentCity.lng)) {
      cityDescription.textContent = "正在查詢與城市座標相符的百科介紹…";
      window.SpotService.fetchCitySummary(currentCity.englishName || currentCity.name, currentCity.countryName || country.name, currentCity).then(summary => {
        if (!summary?.extract || !isCurrentCity()) return;
        cityDescription.textContent = summary.extract;
        if (summary.pageUrl) {
          const source = document.createElement("a");
          source.href = summary.pageUrl;
          source.target = "_blank";
          source.rel = "noopener noreferrer";
          source.textContent = `資料來源：${summary.sourceLabel || "百科資料"}`;
          source.style.cssText = "display:inline-block; margin-top:0.35rem; font-size:0.78rem;";
          cityDescription.append(document.createElement("br"), source);
        }
      }).catch(error => console.warn("城市介紹查詢失敗：", error));
    }
    this.renderCityWeather(currentCity, renderedCountryId, renderedCityId, state);

    loadSpotDetails(spots.slice(0, 4));
    if (window.SpotService && !catalogCity._spotCatalogReady
      && !window.CityCatalogService?.spotRequests?.has(catalogCity.id)) {
      window.CityCatalogService?.fetchCity(currentCity.id).then(published => {
        if (!isCurrentCity() || !published?.spots?.length) return;
        const normalizeName = value => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
          .normalize("NFKC").trim().toLocaleLowerCase().replace(/[\s\p{P}]+/gu, "");
        const existing = new Map(spots.map((spot, index) => [normalizeName(spot.name), index]));
        const merged = [...spots];
        published.spots.forEach(publishedSpot => {
          const name = normalizeName(publishedSpot.name);
          if (!name) return;
          if (existing.has(name)) {
            const index = existing.get(name);
            merged[index] = { ...merged[index], ...publishedSpot };
            return;
          }
          existing.set(name, merged.length);
          merged.push(publishedSpot);
        });
        if (published.city?.description && !currentCity.descriptionSource?.text) {
          currentCity.descriptionSource = {
            text: published.city.description,
            pageUrl: published.city.sourceUrl || null,
            sourceLabel: published.city.sourceLabel || "後台城市目錄"
          };
        }
        currentCity.spots = merged;
        currentCity.attractions = merged.map(spot => spot.name);
        currentCity.dataStatus = { ...(currentCity.dataStatus || {}), spots: "published-database" };
        const storedCity = window.TRAVEL_DATA.globalCities.find(city => city.id === renderedCityId)
          || window.TRAVEL_DATA.countries.flatMap(item => item.cities || []).find(city => city.id === renderedCityId);
        if (storedCity) {
          storedCity.spots = merged;
          storedCity.attractions = currentCity.attractions;
          storedCity.dataStatus = currentCity.dataStatus;
        }
        window.CountryView.render(state);
      }).catch(error => console.warn("後台城市目錄載入失敗：", error));

      window.SpotService.fetchNearbyPlaces(currentCity).then(places => {
        if (!isCurrentCity() || !Array.isArray(places)) return;
        const normalizeName = value => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").normalize("NFKC").trim().toLocaleLowerCase().replace(/[\s\p{P}]+/gu, "");
        const knownNames = new Set(spots.map(spot => normalizeName(spot.name)));
        const verifiedPlaces = places.filter(place => {
          const name = normalizeName(place.name);
          if (!name || knownNames.has(name)) return false;
          knownNames.add(name);
          return true;
        });
        if (verifiedPlaces.length) {
          const liveRecords = verifiedPlaces.map(place => ({
            name: place.name,
            category: place.category || "景點",
            tag: place.sourceLabel || "公開資料編目",
            note: [place.description || `${place.sourceLabel || "公開地圖／知識資料"} 已編目地點；尚無描述資料。`, place.address ? `地址：${place.address}` : "", place.openingHours ? `開放時間：${place.openingHours}` : "", place.fee ? `收費標記：${place.fee}` : "", place.wheelchair ? `無障礙標記：${place.wheelchair}` : "", place.heritage ? `文化遺產標記：${place.heritage}` : "", place.startDate ? `建檔年代標記：${place.startDate}` : "", place.phone ? `電話：${place.phone}` : ""].filter(Boolean).join(" · "),
            lat: place.lat,
            lng: place.lng,
            sourceId: place.sourceId,
            sourceLabel: place.sourceLabel,
            sourceUrl: place.sourceUrl,
            osmId: place.osmId,
            openingHours: place.openingHours,
            address: place.address,
            website: place.website,
            description: place.description,
            fee: place.fee,
            wheelchair: place.wheelchair,
            heritage: place.heritage,
            startDate: place.startDate,
            phone: place.phone,
            wikipedia: place.wikipedia,
            wikipediaUrl: place.wikipediaUrl,
            wikidataId: place.wikidataId
          }));
          currentCity.spots = [...spots, ...liveRecords];
          currentCity.attractions = currentCity.spots.map(spot => spot.name);
          currentCity.dataStatus = { ...(currentCity.dataStatus || {}), spots: "source-linked" };
          const storedCity = window.TRAVEL_DATA.globalCities.find(city => city.id === renderedCityId)
            || window.TRAVEL_DATA.countries.flatMap(item => item.cities || []).find(city => city.id === renderedCityId);
          if (storedCity) {
            storedCity.spots = currentCity.spots;
            storedCity.attractions = currentCity.attractions;
            storedCity.dataStatus = currentCity.dataStatus;
          }
          window.PlannerView?.renderCityTools(currentCity, state);
        }
        if (!verifiedPlaces.length) {
          if (!spots.length) {
            const empty = spotsContainer.querySelector(".spot-data-empty");
            if (empty) {
              empty.textContent = "正在嘗試 OpenStreetMap、Wikidata 與 Wikipedia 多重來源，請稍候；若仍無結果，可重新整理城市周邊資料。";
              if (!empty.querySelector("[data-retry-nearby]")) {
                const retry = document.createElement("button");
                retry.type = "button";
                retry.dataset.retryNearby = "";
                retry.className = "spot-map-focus";
                retry.textContent = "重新載入景點";
                retry.addEventListener("click", () => {
                  const cacheKey = `journey-atlas-verified-places-v4-${currentCity.id || `${currentCity.lat.toFixed(2)}-${currentCity.lng.toFixed(2)}`}`;
                  try { localStorage.removeItem(cacheKey); } catch (error) { console.warn("無法清除景點快取：", error); }
                  window.CountryView.render(state);
                });
                empty.appendChild(document.createElement("br"));
                empty.appendChild(retry);
              }
            }
          }
          return;
        }
        spotsContainer.querySelector(".spot-data-empty")?.remove();
        const sourceNote = document.createElement("p");
        sourceNote.className = "spot-source-attribution";
        const sourceLabels = [...new Set(verifiedPlaces.map(place => place.sourceLabel).filter(Boolean))];
        sourceNote.textContent = `周邊地點來源：${sourceLabels.join("、") || "公開地圖資料"}；${places[0]?.sourceDatasetAt ? `圖資時間：${places[0].sourceDatasetAt}。` : ""}各筆來源連結可查看與校正。`;
        spotsContainer.appendChild(sourceNote);
        verifiedPlaces.forEach((place, offset) => {
          const index = spots.length + offset;
          const card = document.createElement("article");
          card.className = "spot-item spot-item-open-map";
          card.dataset.cityId = currentCity.id;
          card.dataset.spotIndex = String(index);
          const copy = document.createElement("div");
          copy.className = "spot-main";
          const title = document.createElement("h5");
          title.textContent = `#${index + 1} ${place.name}`;
          const category = document.createElement("span");
          category.className = "spot-badge";
          category.textContent = place.category || "景點";
          title.append(" ", category);
          const note = document.createElement("div");
          note.className = "spot-note";
          const fetchedDate = place.fetchedAt ? new Date(place.fetchedAt).toLocaleDateString("zh-TW") : "";
          note.textContent = [
            place.description || `${place.sourceLabel || "公開地圖／知識資料"} 已編目地點；尚無描述資料。`,
            place.address ? `地址：${place.address}` : "",
            place.openingHours ? `開放時間：${place.openingHours}` : "",
            place.fee ? `收費標記：${place.fee}` : "",
            place.wheelchair ? `無障礙標記：${place.wheelchair}` : "",
            place.heritage ? `文化遺產標記：${place.heritage}` : "",
            place.startDate ? `建檔年代標記：${place.startDate}` : "",
            place.phone ? `電話：${place.phone}` : "",
            `距城市中心約 ${place.distanceKm.toFixed(1)} 公里`,
            fetchedDate ? `資料查詢於 ${fetchedDate}` : ""
          ].filter(Boolean).join(" · ");
          copy.append(title, note);
          const focus = document.createElement("button");
          focus.type = "button";
          focus.className = "spot-map-focus";
          focus.dataset.mapFocusSpot = "";
          focus.dataset.cityId = currentCity.id;
          focus.dataset.spotIndex = String(index);
          focus.textContent = "🗺️ 在地圖查看";
          focus.disabled = true;
          const actions = document.createElement("div");
          actions.className = "spot-item-actions";
          actions.appendChild(focus);
          const source = document.createElement("a");
          source.href = place.sourceUrl;
          source.target = "_blank";
          source.rel = "noopener noreferrer";
          source.className = "spot-source-link";
          source.textContent = `查看${place.sourceLabel || "來源"}資料`;
          actions.appendChild(source);
          if (place.website) {
            try {
              const website = new URL(place.website);
              if (["https:", "http:"].includes(website.protocol)) {
                const websiteLink = document.createElement("a");
                websiteLink.href = website.href;
                websiteLink.target = "_blank";
                websiteLink.rel = "noopener noreferrer";
                websiteLink.className = "spot-source-link";
                websiteLink.textContent = "官方網站／資訊";
                actions.appendChild(websiteLink);
              }
            } catch (error) {
              // 忽略無效的地圖來源網址。
            }
          }
          if (place.wikipediaUrl) {
            const encyclopediaLink = document.createElement("a");
            encyclopediaLink.href = place.wikipediaUrl;
            encyclopediaLink.target = "_blank";
            encyclopediaLink.rel = "noopener noreferrer";
            encyclopediaLink.className = "spot-source-link";
            encyclopediaLink.textContent = `Wikipedia${place.wikipedia ? `（${place.wikipedia}）` : ""}`;
            actions.appendChild(encyclopediaLink);
          }
          if (place.wikidataId) {
            const wikidataLink = document.createElement("a");
            wikidataLink.href = `https://www.wikidata.org/wiki/${encodeURIComponent(place.wikidataId)}`;
            wikidataLink.target = "_blank";
            wikidataLink.rel = "noopener noreferrer";
            wikidataLink.className = "spot-source-link";
            wikidataLink.textContent = `Wikidata ${place.wikidataId}`;
            actions.appendChild(wikidataLink);
          }
          card.append(copy, actions);
          spotsContainer.appendChild(card);
          if (window.mapManager?.citySpotMarkers?.get(`${currentCity.id}:${index}`)?.feature) focus.disabled = false;
        });
        const insight = chart?.querySelector('[data-insight="spots"]');
        if (insight) {
          const label = insight.querySelector("div > span");
          const progress = insight.querySelector(".insight-track > i");
          if (label) label.textContent = `${spots.length + verifiedPlaces.length} 筆有座標與來源的資料`;
          if (progress) progress.style.width = `${Math.min(spots.length + verifiedPlaces.length, 5) * 20}%`;
        }
      }).catch(error => console.warn("OpenStreetMap 周邊景點載入失敗：", error));
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
