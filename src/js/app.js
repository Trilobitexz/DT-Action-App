// 旅遊地點分析 APP - 全域控制器
document.addEventListener("DOMContentLoaded", () => {

  const state = window.AppStore.getState();

  const viewWorld = document.getElementById("view-world");
  const viewContinent = document.getElementById("view-continent");
  const viewCountry = document.getElementById("view-country");
  const viewHighlightDetail = document.getElementById("view-highlight-detail");
  const mapHeroCard = document.getElementById("map-hero-card");
  const mapSlots = {
    world: document.getElementById("map-world-slot"),
    continent: document.getElementById("map-continent-slot"),
    country: document.getElementById("map-country-slot")
  };
  const mapContextInfo = document.getElementById("map-context-info");
  const breadcrumbNav = document.getElementById("breadcrumb-nav");
  const btnResetGlobal = document.getElementById("btn-reset-global");
  const connectivityStatus = document.getElementById("connectivity-status");
  let connectivityMessageTimer;

  const setMapContext = viewName => {
    const target = mapSlots[viewName] || mapSlots.world;
    if (!mapHeroCard || !target || mapHeroCard.parentElement === target) return;
    target.appendChild(mapHeroCard);
    window.requestAnimationFrame(() => {
      mapManager.invalidateSize();
      const mapElement = document.getElementById("leaflet-map");
      const mapTop = mapElement?.getBoundingClientRect().top ?? 0;
      const headerHeight = document.querySelector(".app-header")?.getBoundingClientRect().height ?? 0;
      window.scrollTo({ top: window.scrollY + mapTop - headerHeight - 12, behavior: "smooth" });
    });
  };
  const updateMapContextControls = viewName => {
    const backButton = document.getElementById("btn-map-back");
    const isWorld = viewName === "world";
    if (backButton) {
      backButton.hidden = isWorld;
      backButton.textContent = viewName === "country"
        ? (state.globalCityId ? "← 返回世界" : "← 返回大洲")
        : "← 返回世界";
      backButton.onclick = () => {
        if (viewName === "country") {
          navigateTo(state.globalCityId ? "world" : "continent", state.globalCityId ? {} : { continentId: state.selectedContinentId });
        } else {
          navigateTo("world");
        }
      };
    }
    if (mapContextInfo) {
      const city = state.globalCityId
        ? getGlobalCity(state.globalCityId)
        : window.TRAVEL_DATA.countries
          .find(country => country.id === state.selectedCountryId)?.cities
          .find(cityItem => cityItem.id === state.selectedCityId);
      mapContextInfo.hidden = !city || viewName !== "country";
      if (city && viewName === "country") {
        const airportCount = mapManager.getAirportData(city).length;
        const hasDirect = state.globalCityId
          ? window.CountryView?.getGlobalCityProfile(city)?.hasDirect === true
          : window.TRAVEL_DATA.countries.find(country => country.id === state.selectedCountryId)?.directFlight === true;
        const mapTitle = city.destinationType === "island" ? "目的地地圖" : "城市地圖";
        mapContextInfo.innerHTML = `
          <strong>📍 ${city.name} ${mapTitle}</strong>
          <span class="map-context-spot-count">🔴 景點位置載入中…</span>
          <label class="city-map-filter" for="map-spot-category-filter">
            <span>景點類型</span>
            <select id="map-spot-category-filter" aria-label="依類型篩選地圖景點">
              <option value="all">全部</option>
            </select>
          </label>
          <span>✈ 機場 ${airportCount} 個</span>
          <span>${hasDirect === true ? "🛫 台灣可直飛" : hasDirect === false ? "🔁 台灣出發需轉機" : "✈ 航線依出發日期即時查詢"}</span>
          <small>城市位置為探索參考；景點位置整理自公開地圖與旅遊資料，點開標記可查看相關資訊與來源。</small>
          <div class="city-map-key" aria-label="地圖圖例"><span><i>1</i>地圖編號與下方清單一致</span><span>🔵 地名參考點</span><span>✈ 機場</span><span>點擊標記看景點資訊</span></div>`;
      }
    }
  };

  const updateConnectivityStatus = (eventType = "") => {
    if (!connectivityStatus) return;
    window.clearTimeout(connectivityMessageTimer);
    if (!navigator.onLine) {
      connectivityStatus.hidden = false;
      connectivityStatus.className = "connectivity-status offline";
      connectivityStatus.textContent = "目前離線：地圖與即時資料可能無法更新，但已儲存的行程、比較清單與預算仍可使用。";
      return;
    }
    if (eventType === "online") {
      connectivityStatus.hidden = false;
      connectivityStatus.className = "connectivity-status online";
      connectivityStatus.textContent = "已恢復連線，重新開啟城市頁即可取得最新資料。";
      connectivityMessageTimer = window.setTimeout(() => {
        connectivityStatus.hidden = true;
      }, 5000);
      return;
    }
    connectivityStatus.hidden = true;
  };
  updateConnectivityStatus();
  window.addEventListener("offline", () => updateConnectivityStatus("offline"));
  window.addEventListener("online", () => updateConnectivityStatus("online"));

  function getGlobalCity(cityId) {
    const canonicalId = window.TRAVEL_DATA.globalCityAliases?.[cityId] || cityId;
    return window.TRAVEL_DATA.globalCities.find(city => city.id === canonicalId);
  }

  // 初始化 MapLibre 單一地圖管理器 (平面／globe 共用圖層及城市互動)
  const mapManager = new window.MapManager("leaflet-map", {
    center: [25.0, 10.0],
    zoom: 2.3,
    onContinentSelect: (continentId) => {
      navigateTo("continent", { continentId, skipMapRecord: true });
    },
    onCitySelect: (continentId, countryId, cityId) => {
      navigateTo("country", { continentId, countryId, cityId });
    },
    onGlobalCitySelect: (cityId) => {
      navigateTo("global-city", { cityId });
    },
    onCityContextExit: (city) => {
      if (state.globalCityId) {
        navigateTo("world", { animateMap: true });
        return;
      }
      const country = window.TRAVEL_DATA.countries.find(item => item.cities?.some(cityItem => cityItem.id === city.id));
      if (country) {
        navigateTo("continent", { continentId: country.continentId, animateMap: true });
      } else {
        navigateTo("world", { animateMap: true });
      }
    }
  });
  // 地圖程式以非同步方式載入；首輪樣式與資料就緒後再保險重繪城市點，避免首次載入時序讓城市圖層留空。
  const initializeMap = () => {
    mapManager.init();
    const refreshMapDirectory = () => {
      mapManager.renderCityMarkers();
      mapManager.renderGlobalCityDomMarkers(true);
      mapManager.renderOverviewDomMarkers(true);
      mapManager.updateMarkersVisibility();
    };
    if (mapManager.map?.loaded()) refreshMapDirectory();
    else mapManager.map?.once("load", refreshMapDirectory);
  };
  if (window.mapLibreReady) {
    window.mapLibreReady.then(initializeMap).catch(error => {
      console.error("互動地圖無法初始化：", error);
    });
  } else {
    initializeMap();
  }
  mapContextInfo?.addEventListener("change", event => {
    if (event.target?.id === "map-spot-category-filter") {
      mapManager.filterCitySpots(event.target.value);
    }
  });
  document.getElementById("btn-map-back")?.addEventListener("click", () => {
    if (state.currentView === "country") {
      if (state.selectedContinentId) navigateTo("continent", { continentId: state.selectedContinentId });
      else navigateTo("world");
    } else {
      navigateTo("world");
    }
  });
  window.PlannerView?.init();
  document.getElementById("btn-scroll-comparison")?.addEventListener("click", () => {
    window.PlannerView?.renderComparison();
  });

  const backdrop = document.getElementById("drawer-backdrop");
  const drawers = document.querySelectorAll(".side-drawer");
  const sidebar = document.querySelector(".app-sidebar");
  const sidebarCompactQuery = window.matchMedia?.("(max-width: 980px)");
  const mobileNavQuery = window.matchMedia?.("(max-width: 760px)");
  const mobileNavToggle = document.getElementById("mobile-nav-toggle");
  const sidebarHoverQuery = window.matchMedia?.("(hover: hover) and (pointer: fine) and (min-width: 981px)");
  const setMobileNavOpen = open => {
    if (!sidebar || (open && !mobileNavQuery?.matches)) return;
    sidebar.classList.toggle("mobile-nav-open", open);
    document.body.classList.toggle("mobile-nav-open", open);
    mobileNavToggle?.setAttribute("aria-expanded", String(open));
    mobileNavToggle?.setAttribute("aria-label", open ? "收合功能選單" : "展開功能選單");
  };
  const syncSidebarLayout = () => {
    const compact = sidebarCompactQuery?.matches === true;
    document.body.classList.toggle("sidebar-collapsed", compact || sidebarHoverQuery?.matches === true);
    if (sidebar) window.requestAnimationFrame(() => mapManager.invalidateSize());
  };
  syncSidebarLayout();
  sidebarCompactQuery?.addEventListener?.("change", syncSidebarLayout);
  sidebarHoverQuery?.addEventListener?.("change", syncSidebarLayout);
  mobileNavQuery?.addEventListener?.("change", () => setMobileNavOpen(false));
  mobileNavToggle?.addEventListener("click", () => {
    setMobileNavOpen(!sidebar?.classList.contains("mobile-nav-open"));
  });
  document.addEventListener("click", event => {
    if (sidebar?.classList.contains("mobile-nav-open") && !sidebar.contains(event.target)) setMobileNavOpen(false);
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && sidebar?.classList.contains("mobile-nav-open")) {
      setMobileNavOpen(false);
      mobileNavToggle?.focus();
    }
  });
  if (sidebar && sidebarHoverQuery) {
    sidebar.addEventListener("pointerenter", () => {
      if (sidebarHoverQuery.matches) document.body.classList.remove("sidebar-collapsed");
    });
    sidebar.addEventListener("pointerleave", () => {
      if (sidebarHoverQuery.matches && !sidebar.contains(document.activeElement)) document.body.classList.add("sidebar-collapsed");
    });
    sidebar.addEventListener("focusin", () => {
      if (sidebarHoverQuery.matches) document.body.classList.remove("sidebar-collapsed");
    });
    sidebar.addEventListener("focusout", () => {
      window.setTimeout(() => {
        if (sidebarHoverQuery.matches && !sidebar.matches(":hover") && !sidebar.contains(document.activeElement)) document.body.classList.add("sidebar-collapsed");
      }, 0);
    });
  }
  let drawerTrigger = null;
  const closeDrawers = () => {
    const restoreTarget = drawerTrigger;
    drawerTrigger = null;
    drawers.forEach(drawer => {
      drawer.classList.remove("open");
      drawer.setAttribute("aria-hidden", "true");
      drawer.setAttribute("inert", "");
    });
    document.querySelectorAll("[aria-controls]").forEach(button => button.setAttribute("aria-expanded", "false"));
    if (backdrop) backdrop.hidden = true;
    document.body.classList.remove("drawer-open");
    if (restoreTarget?.isConnected && !restoreTarget.closest("[aria-hidden='true']")) restoreTarget.focus();
  };
  window.closeTravelDrawers = closeDrawers;
  const openDrawer = (drawerId, triggerButton = null) => {
    const drawer = document.getElementById(drawerId);
    const trigger = triggerButton || document.querySelector(`[aria-controls="${drawerId}"]`);
    if (!drawer) return;
    if (drawer.getAttribute("aria-hidden") === "false") {
      closeDrawers();
      return;
    }
    closeDrawers();
    drawerTrigger = trigger;
    drawer.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    drawer.removeAttribute("inert");
    trigger?.setAttribute("aria-expanded", "true");
    if (backdrop) backdrop.hidden = false;
    document.body.classList.add("drawer-open");
    drawer.querySelector(".drawer-close")?.focus();
  };
  document.querySelectorAll("[aria-controls]:not([data-sidebar-action])").forEach(button => {
    button.addEventListener("click", () => {
      const drawerId = button.getAttribute("aria-controls");
      if (drawerId === "city-rankings-drawer") setSidebarActive("cities");
      if (drawerId === "comparison-drawer") setSidebarActive("compare");
      openDrawer(drawerId, button);
    });
  });
  const sidebarItems = [...document.querySelectorAll("[data-sidebar-action]")];
  const setSidebarActive = action => sidebarItems.forEach(item => {
    const active = item.dataset.sidebarAction === action;
    item.classList.toggle("active", active);
    if (active) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  });
  const sidebarHint = document.getElementById("sidebar-hint");
  const openPlannerForCity = triggerButton => {
    const planner = document.getElementById("city-planner-tools");
    if (!planner?.children.length) return false;
    setSidebarActive("planner");
    if (sidebarHint) sidebarHint.textContent = "正在規劃目前城市的預算與每日行程。";
    openDrawer("planner-drawer", triggerButton);
    return true;
  };
  sidebarItems.forEach(item => item.addEventListener("click", () => {
    setMobileNavOpen(false);
    const action = item.dataset.sidebarAction;
    if (action === "explore") {
      setSidebarActive(action);
      if (sidebarHint) sidebarHint.textContent = "世界地圖與目的地探索。";
      navigateTo("world");
    } else if (action === "cities") {
      setSidebarActive(action);
      if (sidebarHint) sidebarHint.textContent = "搜尋城市後即可開啟目的地資料。";
      window.GlobalCitiesView?.render();
      openDrawer("city-rankings-drawer", item);
    } else if (action === "compare") {
      setSidebarActive(action);
      window.PlannerView?.renderComparison();
      openDrawer("comparison-drawer", item);
    } else if (action === "highlights") {
      setSidebarActive(action);
      if (sidebarHint) sidebarHint.textContent = "瀏覽世界奇蹟、經典博物館與古文明名錄。";
      window.WorldHighlightsView?.render();
      openDrawer("world-highlights-drawer", item);
    } else if (action === "planner") {
      if (state.currentView === "country" && openPlannerForCity(item)) return;
      const recent = window.PlannerView?.getRecentDestinations?.()[0];
      if (recent) {
        if (recent.type === "global") navigateTo("global-city", { cityId: recent.id });
        else navigateTo("country", { countryId: recent.countryId, cityId: recent.id });
        openPlannerForCity(item);
        return;
      }
      if (sidebarHint) sidebarHint.textContent = "先從城市目錄選擇目的地，就能規劃預算與行程。";
      setSidebarActive("cities");
      window.GlobalCitiesView?.render();
      openDrawer("city-rankings-drawer", document.querySelector('[data-sidebar-action="cities"]'));
    }
  }));
  document.querySelectorAll("[data-close-drawer]").forEach(button => button.addEventListener("click", closeDrawers));
  document.getElementById("highlight-back-button")?.addEventListener("click", () => {
    navigateTo("world");
    setSidebarActive("highlights");
    window.WorldHighlightsView?.render();
    window.setTimeout(() => openDrawer("world-highlights-drawer", document.querySelector('[data-sidebar-action="highlights"]')), 40);
  });
  backdrop?.addEventListener("click", closeDrawers);
  document.addEventListener("keydown", event => {
    const activeDrawer = document.querySelector(".side-drawer.open");
    if (!activeDrawer) return;
    if (event.key === "Escape") {
      closeDrawers();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...activeDrawer.querySelectorAll("a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])")]
      .filter(element => !element.hidden && element.getAttribute("aria-hidden") !== "true");
    if (!focusable.length) {
      event.preventDefault();
      activeDrawer.querySelector(".drawer-close")?.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || !activeDrawer.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !activeDrawer.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  });
  document.querySelectorAll("[data-ranking-tab]").forEach(tab => {
    tab.addEventListener("click", () => {
      const key = tab.dataset.rankingTab;
      document.querySelectorAll("[data-ranking-tab]").forEach(item => {
        const active = item === tab;
        item.classList.toggle("active", active);
        item.setAttribute("aria-selected", String(active));
      });
      document.querySelectorAll(".ranking-tab-panel").forEach(panel => {
        panel.hidden = panel.id !== `ranking-panel-${key}`;
        panel.classList.toggle("active", !panel.hidden);
      });
    });
  });

  // 綁定圖層切換按鈕
  const layerButtons = [
    { id: "btn-layer-voyager", layerKey: "voyager" },
    { id: "btn-layer-light", layerKey: "light" },
    { id: "btn-layer-satellite", layerKey: "satellite" }
  ];

  layerButtons.forEach(cfg => {
    const btn = document.getElementById(cfg.id);
    if (btn) {
      btn.setAttribute("aria-pressed", String(cfg.layerKey === "voyager"));
      btn.addEventListener("click", () => {
        if (mapManager.setTileLayer(cfg.layerKey) === false) return;
        document.querySelectorAll(".map-layer-btn").forEach(b => {
          b.classList.remove("active");
          b.setAttribute("aria-pressed", "false");
        });
        btn.classList.add("active");
        btn.setAttribute("aria-pressed", "true");
      });
    }
  });

  // 平面地圖與 3D globe 使用同一 MapLibre 畫布，切換時保留目前圖層與城市上下文。
  const projectionButtons = {
    mercator: document.getElementById("btn-map-2d"),
    globe: document.getElementById("btn-map-3d")
  };
  const syncProjectionButtons = mode => {
    Object.entries(projectionButtons).forEach(([key, button]) => {
      if (!button) return;
      const active = key === mode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  };
  projectionButtons.mercator?.addEventListener("click", () => {
    if (mapManager.setProjection("mercator") === false) return;
    syncProjectionButtons("mercator");
    window.trackFirebaseEvent?.("map_projection_changed", { projection: "2d" });
  });
  projectionButtons.globe?.addEventListener("click", () => {
    if (mapManager.setProjection("globe") === false) return;
    syncProjectionButtons("globe");
    window.trackFirebaseEvent?.("map_projection_changed", { projection: "3d" });
  });
  document.getElementById("btn-zoom-in")?.addEventListener("click", () => mapManager.zoomIn());
  document.getElementById("btn-zoom-out")?.addEventListener("click", () => mapManager.zoomOut());
  document.getElementById("btn-zoom-reset")?.addEventListener("click", () => {
    mapManager.setNavigationAnimationEnabled(true);
    if (state.currentView === "country") {
      const city = state.globalCityId
        ? getGlobalCity(state.globalCityId)
        : window.TRAVEL_DATA.countries.find(country => country.id === state.selectedCountryId)?.cities.find(item => item.id === state.selectedCityId);
      if (city) showCityOnMap(city, state.selectedCountryId, true);
      return;
    }
    mapManager.flyToWorld();
  });

  // 快捷選擇按鈕
  document.querySelectorAll(".continent-chip-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const continentId = btn.dataset.continentId;
      navigateTo("continent", { continentId });
    });
  });

  // 主導航邏輯 (整合 AppStore 狀態與 MapManager 視角記憶機制)
  function showCityOnMap(city, countryId, animate = true) {
    const country = window.TRAVEL_DATA.countries.find(item => item.id === countryId);
    const profile = city?.countryName ? window.CountryView?.getGlobalCityProfile(city) : null;
    const hasDirect = profile ? profile.hasDirect : country?.directFlight;
    const showContext = () => {
      mapManager.renderCityMarkers();
      mapManager.renderGlobalCityDomMarkers();
      mapManager.showCityContext(city, { animate });
      mapManager.clearFlightRoute();
      if (hasDirect === true || hasDirect === false) mapManager.showFlightRoute(city, hasDirect);
    };
    if (Number.isFinite(city?.lat) && Number.isFinite(city?.lng)) {
      showContext();
      return;
    }

    mapManager.clearCitySpots();
    mapManager.clearFlightRoute();
    mapManager.restoreOverviewMarkers();
    const description = document.getElementById("city-description-text");
    if (description) description.textContent = "正在從 OpenStreetMap 載入城市位置與周邊詳細資料。";
    window.SpotService?.resolveCityLocation(city).then(location => {
      const activeCityId = state.globalCityId || state.selectedCityId;
      if (!location || state.currentView !== "country" || activeCityId !== city.id) {
        if (!location && activeCityId === city.id && description) description.textContent = "城市目錄已有基本資料；地圖位置服務暫時無回應，稍後可重新載入周邊詳細資料。";
        return;
      }
      city.lat = location.lat;
      city.lng = location.lng;
      city.coordinateSource = {
        provider: location.provider,
        sourceUrl: location.sourceUrl,
        checkedAt: new Date(location.fetchedAt).toISOString(),
        displayName: location.displayName
      };
      city.dataStatus = { ...(city.dataStatus || {}), coordinates: "source-linked" };
      window.CountryView.render(state);
      showContext();
    }).catch(error => {
      console.warn(`無法核實 ${city.name} 的城市位置：`, error);
      if ((state.globalCityId || state.selectedCityId) === city.id && description) {
        description.textContent = "城市基本資料仍可使用；位置服務暫時無回應，請稍後重試以載入周邊景點。";
      }
    });
  }

  function navigateTo(viewName, params = {}) {
    const highlightGroupId = params.groupId;
    const highlightItemIndex = Number(params.itemIndex);
    closeDrawers();
    const skipMapRecord = params.skipMapRecord === true;
    const fromHistory = params.fromHistory === true;
    const shouldAnimateMap = params.animateMap !== false && !fromHistory;
    mapManager.setNavigationAnimationEnabled(shouldAnimateMap);
    // 進入新視圖前，儲存舊視圖的視角 (視角記憶)
    if (!skipMapRecord && state.currentView === "world") {
      mapManager.recordCurrentView("world");
    } else if (!skipMapRecord && state.currentView === "continent" && state.selectedContinentId) {
      mapManager.recordCurrentView(state.selectedContinentId);
    }

    if (viewName === "global-city") {
      state.globalCityId = params.cityId;
      if (!getGlobalCity(params.cityId)) return;
      state.selectedCountryId = null;
      state.selectedContinentId = null;
      viewName = "country";
      params = { ...params, cityId: params.cityId };
    } else if (viewName === "continent") {
      state.selectedCountryId = null;
      state.selectedCityId = null;
    } else if (viewName === "country" && params.countryId !== undefined) {
      state.globalCityId = null;
      state.selectedCityId = params.cityId
        || window.TRAVEL_DATA.countries.find(country => country.id === params.countryId)?.cities[0]?.id
        || null;
    } else if (viewName !== "country") {
      state.globalCityId = null;
    }
    state.currentView = viewName;
    if (params.continentId !== undefined) state.selectedContinentId = params.continentId;
    if (params.countryId !== undefined) state.selectedCountryId = params.countryId;
    if (params.cityId !== undefined) state.selectedCityId = params.cityId;
    if (viewName === "continent" && params.filters) state.filters = { ...state.filters, ...params.filters };

    if (viewName === "world") {
      state.selectedContinentId = null;
      state.selectedCountryId = null;
      state.selectedCityId = null;
      state.globalCityId = null;
      mapManager.clearFlightRoute();
      mapManager.clearCitySpots();
      mapManager.restoreOverviewMarkers();
    } else if (viewName === "continent") {
      mapManager.clearFlightRoute();
      mapManager.clearCitySpots();
      mapManager.restoreOverviewMarkers();
    }

    if (window.AppStore) {
      window.AppStore.sync(state);
    }
    if (viewName === "country") {
      const recentCity = state.globalCityId
        ? getGlobalCity(state.globalCityId)
        : window.TRAVEL_DATA.countries.find(item => item.id === state.selectedCountryId)?.cities.find(item => item.id === state.selectedCityId);
      if (recentCity) window.PlannerView?.recordRecentDestination(recentCity, state.globalCityId ? "global" : "local", state.selectedCountryId);
    }

    if (!fromHistory) {
      const routeParams = new URLSearchParams();
      routeParams.set("view", viewName);
      if (state.selectedContinentId) routeParams.set("continent", state.selectedContinentId);
      if (state.selectedCountryId) routeParams.set("country", state.selectedCountryId);
      if (state.selectedCityId) routeParams.set("city", state.selectedCityId);
      if (state.globalCityId) routeParams.set("global", state.globalCityId);
      if (viewName === "continent") {
        if (state.filters.search) routeParams.set("q", state.filters.search);
        if (state.filters.directOnly) routeParams.set("direct", "1");
        if (state.filters.budgetAffordable) routeParams.set("budget", "1");
      }
      if (viewName === "highlight-detail") {
        routeParams.set("group", highlightGroupId || "");
        routeParams.set("item", String(highlightItemIndex));
      }
      const nextHash = `#${routeParams.toString()}`;
      if (window.location.hash !== nextHash) {
        window.history.pushState(null, "", nextHash);
      }
    }

    viewWorld.classList.toggle("active", viewName === "world");
    viewContinent.classList.toggle("active", viewName === "continent");
    viewCountry.classList.toggle("active", viewName === "country");
    viewHighlightDetail?.classList.toggle("active", viewName === "highlight-detail");
    viewWorld.setAttribute("aria-hidden", String(viewName !== "world"));
    viewContinent.setAttribute("aria-hidden", String(viewName !== "continent"));
    viewCountry.setAttribute("aria-hidden", String(viewName !== "country"));
    viewHighlightDetail?.setAttribute("aria-hidden", String(viewName !== "highlight-detail"));
    setMapContext(viewName);
    updateMapContextControls(viewName);

    updateBreadcrumb();
    if (typeof setSidebarActive === "function") setSidebarActive(viewName === "highlight-detail" ? "highlights" : "explore");
    const globalCity = state.globalCityId ? getGlobalCity(state.globalCityId) : null;
    document.title = viewName === "highlight-detail"
      ? `${window.WorldHighlightsView?.getItem(highlightGroupId, highlightItemIndex)?.item?.[0] || "世界之最詳情"}｜旅途指南 Journey Atlas`
      : viewName === "world"
      ? "旅途指南 Journey Atlas｜目的地探索與旅行規劃"
      : viewName === "continent"
        ? `${window.TRAVEL_DATA.continents.find(item => item.id === state.selectedContinentId)?.name || "探索目的地"}｜旅途指南 Journey Atlas`
        : `${globalCity?.name || window.TRAVEL_DATA.countries.find(item => item.id === state.selectedCountryId)?.name || "目的地詳情"}｜旅途指南 Journey Atlas`;

    if (viewName === "world") {
      // 若有保存過的視角，優先還原
      if (!mapManager.restoreSavedView("world", { animate: shouldAnimateMap })) {
        mapManager.flyToWorld({ animate: shouldAnimateMap });
      }
      mapManager.invalidateSize();
      window.GlobalCitiesView?.render();
    } else if (viewName === "continent") {
      if (state.selectedContinentId) {
        window.ContinentView.render(state);
        if (!mapManager.restoreSavedView(state.selectedContinentId, { animate: shouldAnimateMap })) {
          mapManager.flyToContinent(state.selectedContinentId, { animate: shouldAnimateMap });
        }
      }
    } else if (viewName === "country") {
      window.CountryView.render(state);
      const country = window.TRAVEL_DATA.countries.find(item => item.id === state.selectedCountryId);
      const city = globalCity || country?.cities.find(item => item.id === state.selectedCityId);
      if (city) {
        showCityOnMap(city, country?.id || null, shouldAnimateMap);
      }
    } else if (viewName === "highlight-detail") {
      window.WorldHighlightsView?.renderDetail(highlightGroupId, highlightItemIndex);
    }

    // 先立即回到新畫面頂端，避免 CSS smooth scroll 與淡入動畫同時執行造成跳動。
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    const activeView = viewName === "highlight-detail" ? viewHighlightDetail : viewName === "world" ? viewWorld : viewName === "continent" ? viewContinent : viewCountry;
    activeView.focus({ preventScroll: true });
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
    });
  }

  // 麵包屑導航
  function updateBreadcrumb() {
    if (state.currentView === "highlight-detail") {
      breadcrumbNav.innerHTML = '<button type="button" class="breadcrumb-item" data-target="world">🌍 世界地圖</button><span aria-hidden="true">/</span><span class="breadcrumb-item active" aria-current="page">🏛️ 世界之最</span>';
      breadcrumbNav.querySelector('[data-target="world"]')?.addEventListener("click", () => navigateTo("world"));
      return;
    }
    let html = `<button type="button" class="breadcrumb-item ${state.currentView === 'world' ? 'active' : ''}" data-target="world" ${state.currentView === 'world' ? 'aria-current="page"' : ''}>🌍 世界地圖</button>`;

    if (state.selectedContinentId) {
      const cont = window.TRAVEL_DATA.continents.find(c => c.id === state.selectedContinentId);
      html += ` <span>/</span> <button type="button" class="breadcrumb-item ${state.currentView === 'continent' ? 'active' : ''}" data-target="continent" ${state.currentView === 'continent' ? 'aria-current="page"' : ''}>${cont ? cont.name : '大洲'}</button>`;
    }

    if (state.selectedCountryId) {
      const country = window.TRAVEL_DATA.countries.find(c => c.id === state.selectedCountryId);
      html += ` <span>/</span> <button type="button" class="breadcrumb-item ${state.currentView === 'country' ? 'active' : ''}" data-target="country" aria-current="page">${country ? country.name : '國家'}</button>`;

      if (state.selectedCityId) {
        const city = country?.cities.find(ci => ci.id === state.selectedCityId);
        if (city) {
          html += ` <span aria-hidden="true">/</span> <span class="breadcrumb-item active" aria-current="page">🏙️ ${city.name}</span>`;
        }
      }
    }
    if (!state.selectedCountryId && state.globalCityId) {
      const city = getGlobalCity(state.globalCityId);
      if (city) html += ` <span aria-hidden="true">/</span> <span class="breadcrumb-item active" aria-current="page">🏙️ ${city.name}</span>`;
    }

    breadcrumbNav.innerHTML = html;

    breadcrumbNav.querySelectorAll("button[data-target]").forEach(item => {
      item.addEventListener("click", () => {
        const target = item.dataset.target;
        if (target === "world") {
          navigateTo("world");
        } else if (target === "continent") {
          navigateTo("continent", { continentId: state.selectedContinentId });
        } else if (target === "country" && state.selectedCountryId) {
          navigateTo("country", { continentId: state.selectedContinentId, countryId: state.selectedCountryId });
        }
      });
    });
  }

  // 全域重新選擇
  btnResetGlobal?.addEventListener("click", () => {
    state.selectedContinentId = null;
    state.selectedCountryId = null;
    state.filters = { search: "", directOnly: false, budgetAffordable: false };
    navigateTo("world");
  });

  // 全域城市切換掛載
  window.switchCity = (cityId) => {
    const globalCity = getGlobalCity(cityId);
    const localCountry = window.TRAVEL_DATA.countries.find(country => country.cities.some(city => city.id === cityId));
    const localCity = localCountry?.cities.find(city => city.id === cityId);
    if (!globalCity && !localCity) return;
    if (globalCity) {
      state.globalCityId = cityId;
      state.selectedCountryId = null;
      state.selectedContinentId = null;
    }
    state.selectedCityId = cityId;
    state.selectedCountryId = globalCity ? null : localCountry.id;
    state.selectedContinentId = globalCity ? null : localCountry.continentId;
    state.currentView = "country";
    window.PlannerView?.recordRecentDestination(
      globalCity || localCity,
      globalCity ? "global" : "local",
      state.selectedCountryId
    );
    if (window.AppStore) {
      window.AppStore.sync(state);
    }
    const routeParams = new URLSearchParams({ view: "country", city: cityId });
    if (state.globalCityId) routeParams.set("global", state.globalCityId);
    if (state.selectedCountryId) routeParams.set("country", state.selectedCountryId);
    if (state.selectedContinentId) routeParams.set("continent", state.selectedContinentId);
    const nextHash = `#${routeParams.toString()}`;
    if (window.location.hash !== nextHash) {
      window.history.pushState(null, "", nextHash);
    }
    mapManager.setNavigationAnimationEnabled(true);
    updateBreadcrumb();
    setMapContext("country");
    updateMapContextControls("country");
    window.CountryView.render(state);
    const country = localCountry;
    const city = globalCity || country?.cities.find(item => item.id === cityId);
    if (city) {
      showCityOnMap(city, country?.id || null, true);
    }
    viewWorld.classList.remove("active");
    viewContinent.classList.remove("active");
    viewCountry.classList.add("active");
    viewWorld.setAttribute("aria-hidden", "true");
    viewContinent.setAttribute("aria-hidden", "true");
    viewCountry.setAttribute("aria-hidden", "false");
    document.title = `${city.name}｜旅途指南 Journey Atlas`;
    mapManager.invalidateSize();
    window.scrollTo(0, 0);
    viewCountry.focus({ preventScroll: true });
  };

  window.appNavigate = navigateTo;
  window.appState = state;
  const globalSearch = document.getElementById("global-search");
  const globalSearchResults = document.getElementById("global-search-results");
  const normalizeSearchText = value => String(value || "").normalize("NFKC").trim().toLocaleLowerCase();
  const searchCities = [
    ...(window.TRAVEL_DATA.globalCities || []).map(city => ({ ...city, searchType: "global" })),
    ...(window.TRAVEL_DATA.countries || []).flatMap(country => country.cities.map(city => ({ ...city, countryId: country.id, countryName: country.name, continentId: country.continentId, flag: country.flag, searchType: "local" })))
  ].filter((city, index, cities) => cities.findIndex(candidate =>
    normalizeSearchText(candidate.name) === normalizeSearchText(city.name)
    && normalizeSearchText(candidate.countryName) === normalizeSearchText(city.countryName)) === index);
  const navigateToSearchCity = city => {
    if (!city) return;
    globalSearchResults.hidden = true;
    globalSearch.setAttribute("aria-expanded", "false");
    globalSearch.value = "";
    navigateTo(city.searchType === "global" ? "global-city" : "country", city.searchType === "global"
      ? { cityId: city.id }
      : { countryId: city.countryId, continentId: city.continentId, cityId: city.id });
  };
  const renderGlobalSearchResults = () => {
    const query = normalizeSearchText(globalSearch.value);
    globalSearchResults.replaceChildren();
    if (!query) {
      globalSearchResults.hidden = true;
      globalSearch.setAttribute("aria-expanded", "false");
      return [];
    }
    const matches = searchCities.filter(city => [city.name, city.englishName, city.countryName, city.continentName]
      .some(value => normalizeSearchText(value).includes(query))).slice(0, 8);
    matches.forEach((city, index) => {
      const option = document.createElement("button");
      option.type = "button";
      option.className = "global-search-option";
      option.id = `global-search-option-${index}`;
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", "false");
      const name = document.createElement("strong");
      name.textContent = `${city.flag || "🌍"} ${city.name}`;
      const meta = document.createElement("small");
      meta.textContent = [city.englishName, city.countryName].filter(Boolean).join(" · ");
      option.append(name, meta);
      option.addEventListener("click", () => navigateToSearchCity(city));
      globalSearchResults.appendChild(option);
    });
    if (!matches.length) {
      const empty = document.createElement("p");
      empty.className = "global-search-empty";
      empty.textContent = "找不到這個目的地，試試其他城市或國家名稱。";
      globalSearchResults.appendChild(empty);
    }
    globalSearchResults.hidden = false;
    globalSearch.setAttribute("aria-expanded", "true");
    return matches;
  };
  globalSearch?.addEventListener("input", renderGlobalSearchResults);
  globalSearch?.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      globalSearchResults.hidden = true;
      globalSearch.setAttribute("aria-expanded", "false");
    } else if (event.key === "ArrowDown") {
      const first = globalSearchResults.querySelector("[role='option']");
      if (first) { event.preventDefault(); first.focus(); }
    } else if (event.key === "Enter") {
      const city = renderGlobalSearchResults()[0];
      if (city) { event.preventDefault(); navigateToSearchCity(city); }
    }
  });
  globalSearchResults?.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      globalSearchResults.hidden = true;
      globalSearch.setAttribute("aria-expanded", "false");
      globalSearch.focus();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      const options = [...globalSearchResults.querySelectorAll("[role='option']")];
      const current = options.indexOf(document.activeElement);
      const next = options[current + (event.key === "ArrowDown" ? 1 : -1)];
      if (next) { event.preventDefault(); next.focus(); }
      else if (event.key === "ArrowUp") { event.preventDefault(); globalSearch.focus(); }
    }
  });
  document.addEventListener("click", event => {
    if (!event.target.closest("#global-search-wrap")) {
      globalSearchResults.hidden = true;
      globalSearch.setAttribute("aria-expanded", "false");
    }
  });
  window.syncFilterHash = function (filters) {
    const route = new URLSearchParams(window.location.hash.slice(1));
    if (route.get("view") !== "continent") return;
    ["q", "direct", "budget"].forEach(key => route.delete(key));
    if (filters.search) route.set("q", filters.search);
    if (filters.directOnly) route.set("direct", "1");
    if (filters.budgetAffordable) route.set("budget", "1");
    window.history.replaceState(null, "", `#${route.toString()}`);
  };

  const readRoute = () => {
    const route = new URLSearchParams(window.location.hash.slice(1));
    const view = route.get("view");
    if (view === "highlight-detail" && route.get("group") && route.has("item")) {
      return { viewName: "highlight-detail", params: { groupId: route.get("group"), itemIndex: route.get("item") } };
    }
    if (!["world", "continent", "country"].includes(view)) return null;
    if (view === "world") return { viewName: "world" };
    if (view === "continent" && route.get("continent")) {
      return { viewName: "continent", params: { continentId: route.get("continent"), filters: {
        search: route.get("q") || "",
        directOnly: route.get("direct") === "1",
        budgetAffordable: route.get("budget") === "1"
      } } };
    }
    if (view === "country") {
      if (route.get("global")) {
        return { viewName: "global-city", params: { cityId: route.get("global") } };
      }
      if (route.get("country")) {
        return {
          viewName: "country",
          params: {
            continentId: route.get("continent") || undefined,
            countryId: route.get("country"),
            cityId: route.get("city") || undefined
          }
        };
      }
    }
    return null;
  };
  const handleRouteChange = () => {
    const route = readRoute();
    if (route) navigateTo(route.viewName, { ...route.params, fromHistory: true, skipMapRecord: true });
    else navigateTo("world", { fromHistory: true, skipMapRecord: true });
  };
  window.addEventListener("popstate", handleRouteChange);
  const initialRoute = readRoute();
  if (initialRoute) {
    navigateTo(initialRoute.viewName, { ...initialRoute.params, fromHistory: true, skipMapRecord: true });
  }
  window.GlobalCitiesView?.render();
  window.mapManager = mapManager;
});
