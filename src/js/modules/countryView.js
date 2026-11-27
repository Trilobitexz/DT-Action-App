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

    const currencyCode = country.currency.match(/\(([A-Z]{3})\)/)?.[1];
    const rateTag = document.getElementById("live-rate-tag");
    if (!currencyCode) {
      if (rateTag) {
        rateTag.textContent = " · 幣別資料待確認";
        rateTag.title = "全球城市目錄尚未提供已核實的幣別代碼，請以當地官方資訊為準。";
      }
    } else if (window.CurrencyService) {
      const rateCountryId = globalCity ? globalCity.id : country.id;
      window.CurrencyService.getExchangeRates().then(rateRes => {
        const activeRateTarget = state.globalCityId || state.selectedCountryId;
        if (activeRateTarget !== rateCountryId) return;
        const activeRateTag = document.getElementById("live-rate-tag");
        if (!activeRateTag) return;
        const formatted = rateRes?.data && window.CurrencyService.formatRate(currencyCode, rateRes.data);
        if (formatted) {
          const sourceText = rateRes.source === "live" ? "最新" : rateRes.source === "cache" ? "快取" : "備援";
          activeRateTag.textContent = ` · ${sourceText}匯率：${formatted}（${rateRes.updateTime || "來源時間未提供"}）`;
        } else {
          activeRateTag.textContent = " · 匯率暫時無法取得";
        }
      }).catch(error => console.warn("顯示匯率失敗：", error));
    } else {
      const rateTag = document.getElementById("live-rate-tag");
      if (rateTag) rateTag.textContent = " · 匯率服務未載入";
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
        <span class="data-source-badge" title="實際航班與班表請以航空公司和即時查詢結果為準。">班表資訊 ⓘ</span>
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
        <span class="data-source-badge" title="以上為專案整理的概略範圍，不是經統計計算的城市評分或即時報價；實際費用依日期、區域、匯率與消費方式而異。">參考資料 ⓘ</span>
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
    const displayText = value => window.SpotTextService?.toTraditional(value) ?? String(value ?? "");
    const safeHttpUrl = value => {
      try {
        const url = new URL(value);
        return ["https:", "http:"].includes(url.protocol) ? url.href : "";
      } catch (error) { return ""; }
    };
    const hasSourcedRating = spot => spot?.rating !== null && spot?.rating !== undefined && spot?.rating !== ""
      && Number.isFinite(Number(spot.rating))
      && Number(spot.rating) >= 0 && Number(spot.rating) <= 5 && Boolean(String(spot.ratingSource || "").trim());
    const hasCoordinates = spot => {
      const lat = spot?.lat === null || spot?.lat === undefined || spot?.lat === "" ? NaN : Number(spot.lat);
      const lng = spot?.lng === null || spot?.lng === undefined || spot?.lng === "" ? NaN : Number(spot.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)
        || lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
      if (Number.isFinite(currentCity?.lat) && Number.isFinite(currentCity?.lng)) {
        const radians = Math.PI / 180;
        const dLat = (lat - currentCity.lat) * radians;
        const dLng = (lng - currentCity.lng) * radians;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(currentCity.lat * radians) * Math.cos(lat * radians) * Math.sin(dLng / 2) ** 2;
        if (6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) > 50) return false;
      }
      return true;
    };
    const spotQuality = spot => (spot.imageUrl || spot.thumbnail || spot.photoUrl ? 4 : 0)
      + (String(spot.description || spot.note || "").trim().length >= 24 ? 2 : 0)
      + (hasCoordinates(spot) ? 1 : 0);
    const imageFallback = category => {
      const text = String(category || "");
      if (/美食|餐|市場|咖啡|food|restaurant/i.test(text)) return { icon: "🍜", label: "在地風味", tone: "food" };
      if (/自然|公園|花園|海灘|山|瀑布|nature|park|beach/i.test(text)) return { icon: "🌿", label: "自然風景", tone: "nature" };
      if (/博物館|歷史|文化|寺|教堂|museum|historic|culture/i.test(text)) return { icon: "🏛️", label: "文化探索", tone: "culture" };
      return { icon: "📍", label: "城市地標", tone: "landmark" };
    };
    const sortSpotsByQuality = items => [...items].sort((a, b) => {
      if (Boolean(a.isSearchSuggestion) !== Boolean(b.isSearchSuggestion)) return a.isSearchSuggestion ? 1 : -1;
      const qualityDifference = spotQuality(b) - spotQuality(a);
      if (qualityDifference) return qualityDifference;
      if (Boolean(a.isFeatured) !== Boolean(b.isFeatured)) return a.isFeatured ? -1 : 1;
      const aRank = Number.isFinite(a.featuredRank) ? a.featuredRank : Number.POSITIVE_INFINITY;
      const bRank = Number.isFinite(b.featuredRank) ? b.featuredRank : Number.POSITIVE_INFINITY;
      return bRank !== aRank && (a.isFeatured || b.isFeatured) ? aRank - bRank : 0;
    });

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
    const normalizePlaceName = value => (window.SpotTextService?.toTraditional(value) || String(value || ""))
      .normalize("NFKD").replace(/[\u0300-\u036f]/g, "").normalize("NFKC")
      .toLocaleLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
    const cityNames = new Set([currentCity.name, currentCity.englishName, currentCity.nameEn]
      .map(normalizePlaceName).filter(Boolean));
    const isCityItself = spot => spot?.category === "city" || cityNames.has(normalizePlaceName(spot?.name));
    const filterPublishedSpots = items => {
      const vetted = window.CityCatalogService?.filterTravelSpots
        ? window.CityCatalogService.filterTravelSpots(items, currentCity)
        : (items || []).filter(spot => !isCityItself(spot) && (window.SpotTextService?.isTravelAttraction(spot) ?? true));
      return vetted.length ? vetted : (items || []).filter(spot => spot?.isSearchSuggestion === true);
    };
    spotsContainer.onmouseover = event => {
      const card = event.target.closest(".spot-item[data-spot-index]");
      if (card && !card.contains(event.relatedTarget)) window.mapManager?.setSpotCardHighlight?.(card.dataset.cityId, Number(card.dataset.spotIndex), true);
    };
    spotsContainer.onmouseout = event => {
      const card = event.target.closest(".spot-item[data-spot-index]");
      if (card && !card.contains(event.relatedTarget)) window.mapManager?.setSpotCardHighlight?.(card.dataset.cityId, Number(card.dataset.spotIndex), false);
    };
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
            localStorage.removeItem(`journey-atlas-city-spots-v3-${key}`);
            localStorage.removeItem(`journey-atlas-verified-places-v4-${key}`);
            localStorage.removeItem(`journey-atlas-verified-places-v5-${key}`);
            localStorage.removeItem(`journey-atlas-verified-places-v6-${key}`);
          });
        } catch (error) { /* 私密瀏覽模式不支援快取 */ }
        window.CountryView.render(state);
        return;
      }
      const expandButton = event.target.closest("[data-toggle-spots]");
      if (expandButton) {
        const expanded = expandButton.dataset.expanded === "true";
        if (expanded) {
          spotsContainer.querySelectorAll("[data-extra-spot]").forEach(item => { item.hidden = true; });
          expandButton.dataset.expanded = "false";
          expandButton.textContent = `展開其餘 ${Math.max(0, (currentCity.spots || spots).length - visibleSpotCount)} 個景點`;
        } else {
          const existingIndexes = new Set([...spotsContainer.querySelectorAll(".spot-item[data-spot-index]")].map(item => Number(item.dataset.spotIndex)));
          const missingSpots = spots.slice(visibleSpotCount).filter((_, index) => !existingIndexes.has(index + visibleSpotCount));
          expandButton.insertAdjacentHTML("beforebegin", missingSpots.map(spot => renderSpotCard(spot, spots.indexOf(spot), true)).join(""));
          spotsContainer.querySelectorAll("[data-extra-spot]").forEach(item => { item.hidden = false; });
          loadSpotDetails((currentCity.spots || spots).slice(visibleSpotCount), visibleSpotCount);
          expandButton.dataset.expanded = "true";
          expandButton.textContent = "收合景點清單";
        }
        return;
      }
      const button = event.target.closest("[data-map-focus-spot]");
      if (!button || button.disabled) return;
      const focused = window.mapManager?.focusSpot(button.dataset.cityId, Number(button.dataset.spotIndex));
      if (!focused) {
        const query = `${button.dataset.spotName || "景點"}, ${currentCity.name}, ${currentCity.countryName || country.name}`;
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, "_blank", "noopener,noreferrer");
      }
    };

    const cityDescription = document.getElementById("city-description-text");
    if (cityDescription) {
      const locationText = Number.isFinite(currentCity.lat) && Number.isFinite(currentCity.lng)
        ? `座標 ${currentCity.lat.toFixed(4)}, ${currentCity.lng.toFixed(4)}`
        : "尚無已確認的座標";
      cityDescription.textContent = currentCity.descriptionSource?.text || currentCity.description
        || (currentCity._citySummaryLookupFailed
          ? "城市百科暫時無法連線；請參考下方可追溯來源的景點與地圖資料。"
          : `${currentCity.name}（${currentCity.englishName}）位於${currentCity.countryName || country.name}，${locationText}。`);
      if (currentCity._citySummaryLookupFailed) {
        const retry = document.createElement("button");
        retry.type = "button";
        retry.className = "country-facts-retry";
        retry.textContent = "重新載入城市介紹";
        retry.addEventListener("click", () => {
          currentCity._citySummaryLookupStarted = false;
          currentCity._citySummaryLookupFailed = false;
          window.CountryView.render(state);
        });
        cityDescription.append(document.createElement("br"), retry);
      }
    }
    const cityHeading = document.querySelector("#view-country .city-tabs-card h3");
    if (cityHeading) cityHeading.textContent = `🏙️ ${currentCity.name}：${currentCity.destinationType === "island" ? "目的地資訊" : "城市資訊"}與景點資料`;
    const detail = document.getElementById("city-detail-facts");
    if (detail) {
      detail.innerHTML = `
        <div><strong>📍 位置</strong><p>${currentCity.countryName || country.name} · ${Number.isFinite(currentCity.lat) && Number.isFinite(currentCity.lng) ? `${currentCity.lat.toFixed(4)}, ${currentCity.lng.toFixed(4)}` : "尚無已確認的座標"}</p></div>
        <div><strong>🧭 目的地類型</strong><p>${currentCity.destinationType === "island" ? "島嶼目的地" : "城市目的地"} · 可從地圖查看周邊公開地點</p></div>
        <div><strong>📚 深度資料</strong><p>${currentCity.climateSource ? currentCity.climate : "城市介紹與氣候資料會在取得後顯示；目前景點與地圖仍可使用。"}</p></div>
      `;
    }
    if (detail && window.NationalInfoService && country.englishName) {
      const facts = document.createElement("div");
      facts.className = "country-live-facts";
      facts.innerHTML = "<strong>🧳 行前資訊</strong><p>正在載入國家官方語言、時區與駕駛方向…</p>";
      detail.appendChild(facts);
      const countryCodeFallback = country.id.startsWith("global-") ? country.name : country.id;
      const factsDeadline = window.setTimeout(() => {
        if (!facts.isConnected || state.selectedCityId !== currentCity.id || !facts.textContent.includes("正在載入")) return;
        facts.textContent = `行前資訊暫時無法連線。幣別參考：${country.currency || "請依目的地確認"}；簽證請以官方公告為準。`;
      }, 8000);
      const renderCountryFacts = info => {
        const languages = info.languages.length ? info.languages.join("、") : "未提供";
        const timezone = info.timezones.length ? info.timezones.slice(0, 3).join("、") + (info.timezones.length > 3 ? "…" : "") : "未提供";
        facts.replaceChildren();
        const heading = document.createElement("strong"); heading.textContent = "🧳 行前資訊";
        const text = document.createElement("p");
        text.textContent = `官方語言：${languages} · 時區：${timezone} · 靠${info.drivingSide === "left" ? "左" : info.drivingSide === "right" ? "右" : "未提供"}行駛 · 國際電話：${info.callingCode || "未提供"} · 幣別：${(info.currencies || []).join("、") || country.currency || "未提供"}${info.source === "offline" ? " · 離線參考" : ""}`;
        facts.append(heading, text);
      };
      window.NationalInfoService.getCountry(country.englishName, countryCodeFallback).then(info => {
        if (!facts.isConnected || state.selectedCityId !== currentCity.id) return;
        window.clearTimeout(factsDeadline);
        if (info) { renderCountryFacts(info); return; }
        facts.replaceChildren();
        const heading = document.createElement("strong"); heading.textContent = "🧳 行前資訊";
        const text = document.createElement("p");
        text.textContent = `暫時無法連線取得官方語言、時區及駕駛方向。幣別參考：${country.currency || "請依目的地確認"}。${country.visa ? ` 簽證參考：${country.visa}` : ""}`;
        const retry = document.createElement("button");
        retry.type = "button"; retry.className = "country-facts-retry"; retry.textContent = "重新載入行前資訊";
        retry.addEventListener("click", () => {
          retry.disabled = true; retry.textContent = "重新連線中…";
          window.NationalInfoService.retryCountry(country.englishName, countryCodeFallback).then(nextInfo => {
            if (!facts.isConnected || state.selectedCityId !== currentCity.id) return;
            if (nextInfo) renderCountryFacts(nextInfo);
            else { retry.disabled = false; retry.textContent = "再試一次"; }
          }).catch(error => {
            console.warn("重新載入行前資訊失敗：", error);
            if (facts.isConnected) { retry.disabled = false; retry.textContent = "再試一次"; }
          });
        });
        facts.append(heading, text, retry);
      }).catch(error => {
        console.warn("顯示國家行前資訊失敗：", error);
        if (facts.isConnected) facts.textContent = `行前資訊暫時無法載入。幣別參考：${country.currency || "請依目的地確認"}。`;
      });
    }
    const climatePanel = document.getElementById("city-climate-panel");
    if (climatePanel) {
      climatePanel.hidden = false;
      climatePanel.textContent = "正在載入歷史氣候平均…";
      const cityId = currentCity.id;
      window.ClimateService?.getMonthlyNormals(currentCity.lat, currentCity.lng).then(months => {
        if (state.selectedCityId !== cityId || !months) {
          if (state.selectedCityId === cityId && !months) climatePanel.hidden = true;
          return;
        }
        const heading = document.createElement("strong"); heading.textContent = "🌦️ 每月氣候參考（近十年歷史平均）";
        const summary = document.createElement("p");
        summary.textContent = months.map(item => `${item.month}月 ${item.temperatureC === null ? "—" : `${item.temperatureC}°C`}, 雨量 ${item.precipitationMm === null ? "—" : `${item.precipitationMm} mm/月`}`).join("　·　");
        const note = document.createElement("small"); note.textContent = "歷史氣候平均僅供季節規劃參考，不是出發日天氣預報。資料來源：Open-Meteo Historical Weather API。";
        climatePanel.replaceChildren(heading, summary, note);
      }).catch(() => { climatePanel.hidden = true; });
    }
    const chart = document.getElementById("city-insight-chart");
    if (chart) {
      const coverage = window.PlannerView?.getCityDataCoverage(currentCity, country);
      if (coverage) chart.innerHTML = `<p class="city-data-completeness-label">資料欄位覆蓋 ${coverage.score}/${coverage.maxScore}<small>此比例只表示欄位是否有來源資料，不代表景點品質或旅遊推薦分數。</small></p><div class="city-evidence-summary" aria-label="景點資料可用性統計">
        <span><strong>${coverage.sourcedSpotStats.total}</strong> 有來源座標</span>
        <span><strong>${coverage.sourcedSpotStats.withImage}</strong> 有圖片</span>
        <span><strong>${coverage.sourcedSpotStats.withDescription}</strong> 有介紹</span>
        <span><strong>${coverage.sourcedSpotStats.withRating}</strong> 有來源評分</span>
        <span><strong>${coverage.sourcedSpotStats.withHours}</strong> 有營業時間</span>
      </div>` + coverage.fields.map(field => `
        <div class="insight-metric" data-insight="${field.key === "spots" ? "spots" : ""}" title="${escapeHtml(field.note)}">
          <div><strong>${field.label} <small>${field.value}/${field.max}</small></strong><span>${escapeHtml(field.note)}</span></div>
          <div class="insight-track"><i style="width:${field.value / field.max * 100}%"></i></div>
        </div>
      `).join("");
    }
    const resolvedSpots = Array.isArray(currentCity.spots)
      ? currentCity.spots.map(spot => window.SpotTextService?.normalizeSpot(spot) || spot)
        .filter(spot => !isCityItself(spot) && (window.SpotTextService?.isTravelAttraction(spot) ?? true)) : [];
    const candidates = Array.isArray(currentCity.spotCandidates) ? currentCity.spotCandidates : [];
    const candidateNames = new Set(resolvedSpots.map(spot => String(spot.name || "").normalize("NFKC").trim().toLocaleLowerCase()));
    const availableSpots = [
      ...resolvedSpots,
      ...candidates.map(candidate => window.SpotTextService?.normalizeSpot(candidate) || candidate).filter(candidate => {
        const name = String(candidate.name || "").normalize("NFKC").trim().toLocaleLowerCase();
        if (!name || isCityItself(candidate) || !(window.SpotTextService?.isTravelAttraction(candidate) ?? true) || candidateNames.has(name)) return false;
        candidateNames.add(name);
        return true;
      }).map(candidate => ({ ...candidate, ratingSource: null, lat: null, lng: null }))
    ];
    const fallbackSuggestions = (currentCity._spotCatalogReady || !window.CityCatalogService?.ensureSpots)
      ? (window.CityCatalogService?.createMapSearchSuggestions(currentCity) || []) : [];
    const spots = sortSpotsByQuality(availableSpots.length ? availableSpots : fallbackSuggestions)
      .map(spot => window.SpotTextService?.normalizeSpot(spot) || spot);
    currentCity.spots = spots;
    currentCity.attractions = spots.map(spot => spot.name);
    window.PlannerView?.renderCityTools(currentCity, state, country);
    const visibleSpotCount = 5;
    const skeletonCount = currentCity._spotCatalogReady
      ? 0
      : Math.max(0, visibleSpotCount - Math.min(spots.length, visibleSpotCount));
    const renderSpotCard = (spot, idx, extra = false) => `
      <div class="spot-item" id="spot-item-${idx}" data-city-id="${currentCity.id}" data-spot-index="${idx}" ${extra ? "data-extra-spot hidden" : ""}>
        <div style="display:flex; gap:1rem; align-items:center; width:100%;">
          <div class="spot-media"><div id="spot-thumb-${idx}" class="spot-thumbnail" data-image-category="${imageFallback(spot.category).tone}"><span class="spot-image-fallback" role="img" aria-label="${imageFallback(spot.category).label}"><span aria-hidden="true">${imageFallback(spot.category).icon}</span><small>${imageFallback(spot.category).label}</small></span></div><a id="spot-image-source-${idx}" class="spot-image-source" target="_blank" rel="noopener noreferrer" hidden>圖片來源</a></div>
          <div class="spot-main" style="flex:1;">
            <h5>
              <span style="color:var(--primary); font-weight:800;">#${idx + 1}</span>
              ${escapeHtml(displayText(spot.name))}
              ${spot.tag && !/公開資料|地圖搜尋|即時地圖|資料編目/i.test(spot.tag) ? `<span class="spot-badge">${escapeHtml(displayText(spot.tag))}</span>` : ""}
              <span class="spot-badge" style="background:#f1f5f9; color:#475569;">${escapeHtml(displayText(spot.category || "景點"))}</span>
              ${spot.isSearchSuggestion ? '<span class="spot-badge" style="background:#fff7ed;color:#9a3412;">地圖搜尋入口</span>' : ""}
            </h5>
            <div class="spot-note" id="spot-note-${idx}">${escapeHtml(displayText(spot.note || ""))}</div>
          </div>
          <div style="display:flex; flex-direction:column; align-items:flex-end; gap:0.4rem;">
            <div class="spot-score">${hasSourcedRating(spot) ? `★ ${Number(spot.rating).toFixed(1)} · ${escapeHtml(spot.ratingSource)}` : `<a class="spot-rating-link" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${spot.name}, ${currentCity.name}, ${currentCity.countryName || country.name}`)}" target="_blank" rel="noopener noreferrer">前往 Google 地圖查看評價 ↗</a>`}</div>
            <button type="button" class="spot-map-focus" data-map-focus-spot data-city-id="${currentCity.id}" data-spot-index="${idx}" data-spot-name="${escapeHtml(spot.name)}" title="${idx >= (window.MapManager?.MAX_CITY_SPOT_MARKERS || 100) ? "地圖標記已達上限，將改用 Google 地圖搜尋" : (!hasCoordinates(spot) ? "座標尚未核實，點擊後改用 Google 地圖搜尋" : "在城市地圖查看位置")}">${idx < (window.MapManager?.MAX_CITY_SPOT_MARKERS || 100) && hasCoordinates(spot) ? "🗺️ 在地圖查看" : "↗ Google 地圖搜尋"}</button>
            <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${spot.name}, ${currentCity.name}, ${currentCity.countryName || country.name}`)}" target="_blank" rel="noopener noreferrer" class="spot-source-link spot-google-map">Google 地圖</a>
            ${(safeHttpUrl(spot.sourceUrl) || safeHttpUrl(spot.website) || safeHttpUrl(spot.wikipediaUrl) || spot.wikidataId) ? `<details class="spot-extra-links"><summary>更多資料</summary><div>${safeHttpUrl(spot.sourceUrl) ? `<a href="${safeHttpUrl(spot.sourceUrl)}" target="_blank" rel="noopener noreferrer">資料來源</a>` : ""}${safeHttpUrl(spot.website) ? `<a href="${safeHttpUrl(spot.website)}" target="_blank" rel="noopener noreferrer">官方網站</a>` : ""}${safeHttpUrl(spot.wikipediaUrl) ? `<a href="${safeHttpUrl(spot.wikipediaUrl)}" target="_blank" rel="noopener noreferrer">Wikipedia${spot.wikipedia ? ` · ${escapeHtml(spot.wikipedia)}` : ""}</a>` : ""}${spot.wikidataId ? `<a href="https://www.wikidata.org/wiki/${encodeURIComponent(spot.wikidataId)}" target="_blank" rel="noopener noreferrer">Wikidata</a>` : ""}</div></details>` : ""}
          </div>
        </div>
      </div>
    `;
    spotsContainer.innerHTML = `${spots.slice(0, visibleSpotCount).map((spot, idx) => renderSpotCard(spot, idx)).join("")}${Array.from({ length: skeletonCount }, (_, index) => `<article class="spot-item spot-skeleton" aria-hidden="true"><span class="skeleton-media"></span><span class="skeleton-copy"><i></i><i></i><i></i></span><span class="skeleton-actions"><i></i><i></i></span></article>`).join("")}${spots.length > visibleSpotCount ? `<button type="button" class="spot-list-toggle" data-toggle-spots data-expanded="false">顯示其餘 ${spots.length - visibleSpotCount} 個景點</button>` : ""}`
      || `<p class="spot-data-empty">${currentCity._spotCatalogReady ? `目前沒有可核實的景點資料，可改用地圖搜尋 ${escapeHtml(currentCity.name)}。` : `正在整理 ${escapeHtml(currentCity.name)} 的景點靈感…`}</p>`;
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
        if (thumbEl?.dataset.detailsRequested === "true") return;
        if (thumbEl) thumbEl.dataset.detailsRequested = "true";
        const imageUrl = spot.imageUrl || spot.thumbnail || spot.photoUrl;
        if (spot.imageFailed) return;
        const addImage = (url, alt, sourceUrl, allowCommonsRetry = true) => {
          if (!url || !thumbEl || !isCurrentCity()) return;
          let safeImageUrl;
          try {
            safeImageUrl = new URL(url, window.location.href);
            if (!/^https?:$/.test(safeImageUrl.protocol)) return;
          } catch (error) { return; }
          const image = document.createElement("img");
          image.alt = displayText(alt || spot.name);
          image.loading = "lazy";
          image.decoding = "async";
          image.referrerPolicy = "no-referrer";
          image.onload = () => {
            if (!thumbEl.isConnected || !isCurrentCity()) return;
            thumbEl.classList.add("has-image");
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
          image.onerror = () => {
            image.remove();
            thumbEl.classList.remove("has-image");
            const sourceLink = document.getElementById(`spot-image-source-${idx}`);
            if (sourceLink) sourceLink.hidden = true;
            if (allowCommonsRetry && window.SpotService?.fetchCommonsImage) {
              window.SpotService.fetchCommonsImage(spot.name, currentCity.name).then(alternate => {
                if (!isCurrentCity() || !alternate?.thumbnail || alternate.thumbnail === safeImageUrl.href) {
                  spot.imageFailed = true;
                  thumbEl.title = "景點照片暫不可用，已顯示分類插圖";
                  return;
                }
                addImage(alternate.thumbnail, alt, alternate.pageUrl, false);
              }).catch(() => {
                spot.imageFailed = true;
                thumbEl.title = "景點照片暫不可用，已顯示分類插圖";
              });
              return;
            }
            spot.imageFailed = true;
            thumbEl.title = "景點照片暫不可用，已顯示分類插圖";
          };
          thumbEl.appendChild(image);
          image.src = safeImageUrl.href;
        };
        if (imageUrl) {
          addImage(imageUrl, spot.name, spot.imageSourceUrl || spot.wikipediaUrl);
          return;
        }
        window.SpotService.fetchSpotImage(spot.name, currentCity.name).then(image => {
          if (image?.thumbnail && isCurrentCity()) addImage(image.thumbnail, image.title || spot.name, image.pageUrl);
          else if (!image) spot.imageFailed = true;
        }).catch(error => console.warn("景點圖片載入失敗：", error));
      });
    };
    const catalogCity = currentCity.catalogSourceCity || currentCity;
    if (window.CityCatalogService?.ensureSpots && !catalogCity._spotCatalogReady) {
      const catalogLoad = window.CityCatalogService.ensureSpots(catalogCity, {
        onCatalogReady: (publishedSpots, publishedCatalog) => {
          if (!isCurrentCity()) return;
          const catalogCityData = publishedCatalog?.city || {};
          currentCity.spotsCacheMeta = publishedCatalog.cacheMeta || catalogCity.spotsCacheMeta || currentCity.spotsCacheMeta;
          if ((!Number.isFinite(currentCity.lat) || !Number.isFinite(currentCity.lng))
            && Number.isFinite(catalogCityData.lat) && Number.isFinite(catalogCityData.lng)) {
            currentCity.lat = catalogCityData.lat;
            currentCity.lng = catalogCityData.lng;
            catalogCity.lat = catalogCityData.lat;
            catalogCity.lng = catalogCityData.lng;
            currentCity.coordinateSource = {
              provider: catalogCityData.coordinateSourceLabel || "Firestore 公開城市目錄",
              sourceUrl: catalogCityData.coordinateSourceUrl || ""
            };
          }
          publishedSpots = filterPublishedSpots(publishedSpots);
          currentCity.spots = publishedSpots;
          currentCity.attractions = publishedSpots.map(spot => spot.name);
          currentCity.spotsSource = publishedCatalog?.source === "prebuilt" ? "prebuilt" : "firestore";
          catalogCity.spotsSource = currentCity.spotsSource;
          currentCity._spotCatalogReady = true;
          catalogCity._spotCatalogReady = true;
          if (publishedCatalog?.city?.description && !currentCity.descriptionSource?.text) {
            currentCity.descriptionSource = {
              text: publishedCatalog.city.description,
              pageUrl: publishedCatalog.city.sourceUrl || null,
              sourceLabel: publishedCatalog.city.sourceLabel || "後台城市目錄"
            };
          }
          const storedCity = window.TRAVEL_DATA.globalCities.find(city => city.id === renderedCityId)
            || window.TRAVEL_DATA.countries.flatMap(item => item.cities || []).find(city => city.id === renderedCityId);
          if (storedCity) {
            storedCity.spots = publishedSpots;
            storedCity.attractions = currentCity.attractions;
            if (Number.isFinite(currentCity.lat) && Number.isFinite(currentCity.lng)) {
              storedCity.lat = currentCity.lat;
              storedCity.lng = currentCity.lng;
              storedCity.coordinateSource = currentCity.coordinateSource || storedCity.coordinateSource;
            }
          }
          window.CountryView.render(state);
          if (Number.isFinite(currentCity.lat) && Number.isFinite(currentCity.lng)) {
            window.mapManager?.showCityContext(currentCity, {
              animate: false,
              preserveView: window.mapManager?.currentCityContext?.id === currentCity.id
            });
            if (country.flightInfo?.hasDirect === true || country.flightInfo?.hasDirect === false) {
              window.mapManager?.showFlightRoute(currentCity, country.flightInfo.hasDirect);
            }
          }
        }
      });
      let catalogTimer;
      const catalogDeadline = new Promise((_, reject) => {
        catalogTimer = window.setTimeout(() => reject(new Error("城市景點載入逾時，已切換備援搜尋")), 18000);
      });
      Promise.race([catalogLoad, catalogDeadline]).then(spots => {
        const publishedSpots = filterPublishedSpots(spots);
        currentCity.spots = publishedSpots;
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
        if (!isCurrentCity()) return;
        currentCity.spots = window.CityCatalogService?.createMapSearchSuggestions(currentCity) || [];
        currentCity._spotCatalogReady = true;
        currentCity.spotsSource = "local-or-map-search";
        window.CountryView.render(state);
      }).finally(() => window.clearTimeout(catalogTimer));
    }
    if (!currentCity._citySummaryLookupStarted && !cityDescription?.textContent?.includes("正在向 OpenStreetMap") && cityDescription && window.SpotService?.fetchCitySummary
      && Number.isFinite(currentCity.lat) && Number.isFinite(currentCity.lng)) {
      currentCity._citySummaryLookupStarted = true;
      cityDescription.setAttribute("aria-busy", "true");
      window.SpotService.fetchCitySummary(currentCity.englishName || currentCity.name, currentCity.countryName || country.name, currentCity).then(summary => {
        if (!isCurrentCity()) return;
        const description = document.getElementById("city-description-text");
        if (!description) return;
        description.setAttribute("aria-busy", "false");
        if (!summary?.extract) {
          currentCity._citySummaryLookupFailed = true;
          const savedDescription = currentCity.descriptionSource?.text || currentCity.description || "";
          description.replaceChildren(document.createTextNode(savedDescription || "城市百科介紹目前無法取得；景點清單與地圖資料仍可使用。"));
          const retry = document.createElement("button");
          retry.type = "button";
          retry.className = "country-facts-retry";
          retry.textContent = "重新載入城市介紹";
          retry.addEventListener("click", () => {
            currentCity._citySummaryLookupStarted = false;
            currentCity._citySummaryLookupFailed = false;
            window.CountryView.render(state);
          });
          description.append(document.createElement("br"), retry);
          return;
        }
        currentCity.descriptionSource = { text: summary.extract, pageUrl: summary.pageUrl || null, sourceLabel: summary.sourceLabel || "百科資料" };
        description.textContent = summary.extract;
        if (summary.pageUrl) {
          const source = document.createElement("a");
          source.href = summary.pageUrl;
          source.target = "_blank";
          source.rel = "noopener noreferrer";
          source.textContent = `資料來源：${summary.sourceLabel || "百科資料"}`;
          source.style.cssText = "display:inline-block; margin-top:0.35rem; font-size:0.78rem;";
          description.append(document.createElement("br"), source);
        }
      }).catch(error => {
        console.warn("城市介紹查詢失敗：", error);
        if (isCurrentCity()) {
          currentCity._citySummaryLookupFailed = true;
          const description = document.getElementById("city-description-text");
          if (description) {
            description.setAttribute("aria-busy", "false");
            const savedDescription = currentCity.descriptionSource?.text || currentCity.description || "";
            description.textContent = savedDescription || "城市百科介紹暫時無法取得；景點清單與地圖資料仍可使用。";
          }
        }
      });
    }
    this.renderCityWeather(currentCity, renderedCountryId, renderedCityId, state);

    loadSpotDetails(spots.slice(0, visibleSpotCount));
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
          if (!name || isCityItself(publishedSpot) || !(window.SpotTextService?.isTravelAttraction(publishedSpot) ?? true)) return;
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
        const availableMapSlots = Math.max(0, (window.MapManager?.MAX_CITY_SPOT_MARKERS || 100) - spots.length);
        const verifiedPlaces = places.filter(place => {
          const name = normalizeName(place.name);
          if (!name || isCityItself(place) || !(window.SpotTextService?.isTravelAttraction(place) ?? true) || knownNames.has(name)) return false;
          knownNames.add(name);
          return true;
        }).slice(0, availableMapSlots);
        if (verifiedPlaces.length) {
          spotsContainer.querySelectorAll(".spot-skeleton").forEach(skeleton => skeleton.remove());
          const liveRecords = verifiedPlaces.map(place => ({
            name: place.name,
            category: place.category || "景點",
            tag: place.sourceLabel || "公開資料編目",
            note: [place.description || `${place.sourceLabel || "公開地圖／知識資料"} 收錄的景點；暫無補充介紹。`, place.address ? `地址：${place.address}` : "", place.openingHours ? `開放時間：${place.openingHours}` : "", place.fee ? `收費資訊：${place.fee}` : "", place.heritage ? `文化遺產：${place.heritage}` : ""].filter(Boolean).join(" · "),
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
          window.PlannerView?.renderCityTools(currentCity, state, country);
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
                  const cacheKey = `journey-atlas-verified-places-v5-${currentCity.id || `${currentCity.lat.toFixed(2)}-${currentCity.lng.toFixed(2)}`}`;
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
        sourceNote.textContent = "景點資料來源 ⓘ";
        sourceNote.title = `周邊地點來源：${sourceLabels.join("、") || "公開地圖資料"}；${places[0]?.sourceDatasetAt ? `圖資時間：${places[0].sourceDatasetAt}。` : ""}各筆來源連結可查看與校正。`;
        let moreButton = spotsContainer.querySelector("[data-toggle-spots]");
        spotsContainer.insertBefore(sourceNote, moreButton);
        verifiedPlaces.forEach((place, offset) => {
          const index = spots.length + offset;
          const card = document.createElement("article");
          card.className = "spot-item spot-item-open-map";
          card.dataset.extraSpot = "";
          card.hidden = moreButton?.dataset.expanded !== "true";
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
          note.textContent = [
            place.description || `${place.sourceLabel || "公開地圖／知識資料"} 收錄的景點；暫無補充介紹。`,
            place.address ? `地址：${place.address}` : "",
            place.openingHours ? `開放時間：${place.openingHours}` : "",
            place.fee ? `收費資訊：${place.fee}` : "",
            place.heritage ? `文化遺產：${place.heritage}` : ""
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
          source.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name}, ${currentCity.name}`)}`;
          source.target = "_blank";
          source.rel = "noopener noreferrer";
          source.className = "spot-source-link";
          source.textContent = "Google 地圖";
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
                websiteLink.textContent = "官方網站";
                const extraLinks = document.createElement("details");
                extraLinks.className = "spot-extra-links";
                extraLinks.innerHTML = "<summary>更多資料</summary>";
                const links = document.createElement("div");
                links.appendChild(websiteLink);
                extraLinks.appendChild(links);
                actions.appendChild(extraLinks);
              }
            } catch (error) {
              // 忽略無效的地圖來源網址。
            }
          }
          if (place.sourceUrl) {
            try {
              const sourceUrl = new URL(place.sourceUrl);
              if (["https:", "http:"].includes(sourceUrl.protocol)) {
                let extraLinks = actions.querySelector(".spot-extra-links");
                if (!extraLinks) {
                  extraLinks = document.createElement("details");
                  extraLinks.className = "spot-extra-links";
                  extraLinks.innerHTML = "<summary>更多資料</summary>";
                  extraLinks.appendChild(document.createElement("div"));
                  actions.appendChild(extraLinks);
                }
                const sourceLink = document.createElement("a");
                sourceLink.href = sourceUrl.href;
                sourceLink.target = "_blank";
                sourceLink.rel = "noopener noreferrer";
                sourceLink.textContent = `資料來源 · ${place.sourceLabel || "公開資料"}`;
                extraLinks.lastElementChild.appendChild(sourceLink);
              }
            } catch (error) { /* 忽略無效來源網址 */ }
          }
          if (place.wikipediaUrl) {
            const encyclopediaLink = document.createElement("a");
            encyclopediaLink.href = place.wikipediaUrl;
            encyclopediaLink.target = "_blank";
            encyclopediaLink.rel = "noopener noreferrer";
            encyclopediaLink.className = "spot-source-link";
            encyclopediaLink.textContent = `Wikipedia${place.wikipedia ? ` · ${place.wikipedia}` : ""}`;
            let extraLinks = actions.querySelector(".spot-extra-links");
            if (!extraLinks) {
              extraLinks = document.createElement("details");
              extraLinks.className = "spot-extra-links";
              extraLinks.innerHTML = "<summary>更多資料</summary>";
              extraLinks.appendChild(document.createElement("div"));
              actions.appendChild(extraLinks);
            }
            extraLinks.lastElementChild.appendChild(encyclopediaLink);
          }
          const media = document.createElement("div");
          media.className = "spot-media";
          const thumb = document.createElement("div");
          thumb.id = `spot-thumb-${index}`;
          thumb.className = "spot-thumbnail";
          const fallback = imageFallback(place.category);
          thumb.dataset.imageCategory = fallback.tone;
          thumb.innerHTML = `<span class="spot-image-fallback" role="img" aria-label="${fallback.label}"><span aria-hidden="true">${fallback.icon}</span><small>${fallback.label}</small></span>`;
          const imageSource = document.createElement("a");
          imageSource.id = `spot-image-source-${index}`;
          imageSource.className = "spot-image-source";
          imageSource.target = "_blank";
          imageSource.rel = "noopener noreferrer";
          imageSource.hidden = true;
          imageSource.textContent = "圖片來源";
          media.append(thumb, imageSource);
          card.append(media, copy, actions);
          spotsContainer.insertBefore(card, moreButton);
          if (window.mapManager?.citySpotMarkers?.get(`${currentCity.id}:${index}`)?.feature) focus.disabled = false;
        });
        if (!moreButton && currentCity.spots.length > visibleSpotCount) {
          moreButton = document.createElement("button");
          moreButton.type = "button";
          moreButton.className = "spot-list-toggle";
          moreButton.dataset.toggleSpots = "";
          moreButton.dataset.expanded = "false";
          moreButton.textContent = `展開其餘 ${currentCity.spots.length - visibleSpotCount} 個景點`;
          spotsContainer.appendChild(moreButton);
        } else if (moreButton && moreButton.dataset.expanded !== "true") {
          moreButton.textContent = `展開其餘 ${Math.max(0, currentCity.spots.length - visibleSpotCount)} 個景點`;
        }
        loadSpotDetails(verifiedPlaces.slice(0, Math.max(0, visibleSpotCount - spots.length)), spots.length);
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

    const validCoordinates = Number.isFinite(city.lat) && Number.isFinite(city.lng)
      && city.lat >= -90 && city.lat <= 90 && city.lng >= -180 && city.lng <= 180
      && !(city.lat === 0 && city.lng === 0);
    if (!validCoordinates || !window.WeatherService) {
      weatherWidget.style.display = "none";
      return;
    }

    weatherWidget.dataset.cityId = cityId;
    weatherWidget.dataset.countryId = countryId;
    weatherWidget.style.display = "inline-flex";
    weatherWidget.innerHTML = `🌤️ 載入即時天氣...`;
    let weatherReady = false;
    let airQuality = null;
    const isCurrentCity = () => {
      const activeCountryId = state.globalCityId ? `global-${state.globalCityId}` : state.selectedCountryId;
      return activeCountryId === countryId && state.selectedCityId === cityId
        && weatherWidget.dataset.cityId === cityId && weatherWidget.dataset.countryId === countryId;
    };
    const renderAirQuality = () => {
      if (!weatherReady || !airQuality || !isCurrentCity()) return;
      weatherWidget.querySelector("[data-air-quality]")?.remove();
      const line = document.createElement("span");
      line.dataset.airQuality = "true";
      line.className = "weather-air-quality";
      const particles = [
        Number.isFinite(airQuality.pm25) ? `PM2.5 ${airQuality.pm25.toFixed(1)} μg/m³` : "",
        Number.isFinite(airQuality.pm10) ? `PM10 ${airQuality.pm10.toFixed(1)} μg/m³` : ""
      ].filter(Boolean).join(" · ");
      line.textContent = `${airQuality.icon} 空氣品質 AQI ${airQuality.aqi} · ${airQuality.level}${particles ? ` · ${particles}` : ""}`;
      line.title = `${airQuality.source}；全球模式估值，不是城市測站即時讀值。${airQuality.time ? ` 資料時間：${airQuality.time} ${airQuality.timezone}` : ""}`;
      weatherWidget.appendChild(line);
    };

    if (typeof window.WeatherService.getCityAirQuality === "function") {
      window.WeatherService.getCityAirQuality(city.lat, city.lng).then(result => {
        airQuality = result;
        renderAirQuality();
      }).catch(error => console.warn("顯示空氣品質失敗：", error));
    }

    window.WeatherService.getCityWeather(city.lat, city.lng).then(weather => {
      if (!isCurrentCity()) return;
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
      weatherReady = true;
      renderAirQuality();
    }).catch(error => {
      if (isCurrentCity()) {
        weatherWidget.textContent = "目前無法取得天氣資料";
        weatherReady = true;
        renderAirQuality();
      }
      console.warn("顯示天氣失敗：", error);
    });
  }
};
