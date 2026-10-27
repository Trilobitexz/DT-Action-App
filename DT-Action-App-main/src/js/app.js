// 旅遊地點分析 APP - 全域控制器
document.addEventListener("DOMContentLoaded", async () => {
  try {
    if (window.leafletReady) await window.leafletReady;
  } catch (error) {
    // Leaflet 載入失敗時，地圖會顯示錯誤狀態，但其他頁面功能仍可使用。
    console.error("互動地圖無法初始化：", error);
  }

  const state = window.AppStore.getState();

  const viewWorld = document.getElementById("view-world");
  const viewContinent = document.getElementById("view-continent");
  const viewCountry = document.getElementById("view-country");
  const breadcrumbNav = document.getElementById("breadcrumb-nav");
  const btnResetGlobal = document.getElementById("btn-reset-global");
  const connectivityStatus = document.getElementById("connectivity-status");
  let connectivityMessageTimer;

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
    return window.TRAVEL_DATA.globalCities.find(city => city.id === cityId);
  }

  // 初始化 Leaflet 地圖管理器 (支援圖層切換與城市點擊互動)
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
    }
  });
  mapManager.init();
  window.PlannerView?.init();
  document.getElementById("btn-scroll-comparison")?.addEventListener("click", () => {
    document.getElementById("comparison-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  const backdrop = document.getElementById("drawer-backdrop");
  const drawers = document.querySelectorAll(".side-drawer");
  let drawerScale = Number(localStorage.getItem("journey-atlas-drawer-scale") || "1");
  const updateDrawerScale = () => {
    drawerScale = Math.min(1.1, Math.max(0.8, drawerScale));
    localStorage.setItem("journey-atlas-drawer-scale", String(drawerScale));
    drawers.forEach(drawer => {
      drawer.style.setProperty("--drawer-scale", String(drawerScale));
      drawer.querySelectorAll("[data-drawer-scale-value]").forEach(value => {
        value.textContent = `${Math.round(drawerScale * 100)}%`;
      });
    });
  };
  updateDrawerScale();
  document.querySelectorAll("[data-drawer-scale]").forEach(button => {
    button.addEventListener("click", () => {
      const action = button.dataset.drawerScale;
      if (action === "down") drawerScale -= 0.05;
      if (action === "up") drawerScale += 0.05;
      if (action === "reset") drawerScale = 1;
      updateDrawerScale();
    });
  });
  const closeDrawers = () => {
    drawers.forEach(drawer => {
      drawer.classList.remove("open");
      drawer.setAttribute("aria-hidden", "true");
    });
    document.querySelectorAll("[aria-controls]").forEach(button => button.setAttribute("aria-expanded", "false"));
    if (backdrop) backdrop.hidden = true;
    document.body.classList.remove("drawer-open");
  };
  window.closeTravelDrawers = closeDrawers;
  const openDrawer = drawerId => {
    closeDrawers();
    const drawer = document.getElementById(drawerId);
    const trigger = document.querySelector(`[aria-controls="${drawerId}"]`);
    if (!drawer) return;
    drawer.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    trigger?.setAttribute("aria-expanded", "true");
    if (backdrop) backdrop.hidden = false;
    document.body.classList.add("drawer-open");
    drawer.querySelector(".drawer-close")?.focus();
  };
  document.querySelectorAll("[aria-controls]").forEach(button => {
    button.addEventListener("click", () => openDrawer(button.getAttribute("aria-controls")));
  });
  document.querySelectorAll("[data-close-drawer]").forEach(button => button.addEventListener("click", closeDrawers));
  backdrop?.addEventListener("click", closeDrawers);
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeDrawers();
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
        mapManager.setTileLayer(cfg.layerKey);
        document.querySelectorAll(".map-layer-btn").forEach(b => {
          b.classList.remove("active");
          b.setAttribute("aria-pressed", "false");
        });
        btn.classList.add("active");
        btn.setAttribute("aria-pressed", "true");
      });
    }
  });

  // 綁定地圖工具列縮放按鈕
  document.getElementById("btn-zoom-in")?.addEventListener("click", () => mapManager.zoomIn());
  document.getElementById("btn-zoom-out")?.addEventListener("click", () => mapManager.zoomOut());
  document.getElementById("btn-zoom-reset")?.addEventListener("click", () => mapManager.flyToWorld());

  // 快捷選擇按鈕
  document.querySelectorAll(".continent-chip-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const continentId = btn.dataset.continentId;
      mapManager.recordCurrentView("world");
      mapManager.flyToContinent(continentId);
      navigateTo("continent", { continentId, skipMapRecord: true });
    });
  });

  // 主導航邏輯 (整合 AppStore 狀態與 MapManager 視角記憶機制)
  function navigateTo(viewName, params = {}) {
    closeDrawers();
    const skipMapRecord = params.skipMapRecord === true;
    const fromHistory = params.fromHistory === true;
    // 進入新視圖前，儲存舊視圖的視角 (視角記憶)
    if (!skipMapRecord && state.currentView === "world") {
      mapManager.recordCurrentView("world");
    } else if (!skipMapRecord && state.currentView === "continent" && state.selectedContinentId) {
      mapManager.recordCurrentView(state.selectedContinentId);
    }

    if (viewName === "global-city") {
      state.globalCityId = params.cityId;
      state.selectedCountryId = null;
      state.selectedContinentId = null;
      viewName = "country";
      params = { ...params, cityId: params.cityId };
    } else if (viewName === "continent") {
      state.selectedCountryId = null;
      state.selectedCityId = null;
    } else if (viewName === "country" && params.countryId !== undefined) {
      state.globalCityId = null;
      state.selectedCityId = params.cityId || null;
    } else if (viewName !== "country") {
      state.globalCityId = null;
    }
    state.currentView = viewName;
    if (params.continentId !== undefined) state.selectedContinentId = params.continentId;
    if (params.countryId !== undefined) state.selectedCountryId = params.countryId;
    if (params.cityId !== undefined) state.selectedCityId = params.cityId;

    if (viewName === "world") {
      state.selectedContinentId = null;
      state.selectedCountryId = null;
      state.selectedCityId = null;
      state.globalCityId = null;
      mapManager.clearFlightRoute();
    } else if (viewName === "continent") {
      mapManager.clearFlightRoute();
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
      const nextHash = `#${routeParams.toString()}`;
      if (window.location.hash !== nextHash) {
        window.history.pushState(null, "", nextHash);
      }
    }

    viewWorld.classList.toggle("active", viewName === "world");
    viewContinent.classList.toggle("active", viewName === "continent");
    viewCountry.classList.toggle("active", viewName === "country");
    viewWorld.setAttribute("aria-hidden", String(viewName !== "world"));
    viewContinent.setAttribute("aria-hidden", String(viewName !== "continent"));
    viewCountry.setAttribute("aria-hidden", String(viewName !== "country"));

    updateBreadcrumb();
    const globalCity = state.globalCityId ? getGlobalCity(state.globalCityId) : null;
    document.title = viewName === "world"
      ? "旅途指南 Journey Atlas｜目的地探索與旅行規劃"
      : viewName === "continent"
        ? `${window.TRAVEL_DATA.continents.find(item => item.id === state.selectedContinentId)?.name || "探索目的地"}｜旅途指南 Journey Atlas`
        : `${globalCity?.name || window.TRAVEL_DATA.countries.find(item => item.id === state.selectedCountryId)?.name || "目的地詳情"}｜旅途指南 Journey Atlas`;

    if (viewName === "world") {
      // 若有保存過的視角，優先還原
      if (!mapManager.restoreSavedView("world")) {
        mapManager.flyToWorld();
      }
      mapManager.invalidateSize();
      window.GlobalCitiesView?.render();
    } else if (viewName === "continent") {
      if (state.selectedContinentId) window.ContinentView.render(state);
    } else if (viewName === "country") {
      window.CountryView.render(state);
      const country = window.TRAVEL_DATA.countries.find(item => item.id === state.selectedCountryId);
      const city = globalCity || country?.cities.find(item => item.id === state.selectedCityId);
      if (city) {
        mapManager.flyToCity(city.lat, city.lng, 5);
        const hasDirect = globalCity
          ? window.CountryView?.getGlobalCityProfile(globalCity)?.hasDirect === true
          : country?.directFlight === true;
        mapManager.showFlightRoute(city, hasDirect);
      }
    }

    // 先立即回到新畫面頂端，避免 CSS smooth scroll 與淡入動畫同時執行造成跳動。
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    const activeView = viewName === "world" ? viewWorld : viewName === "continent" ? viewContinent : viewCountry;
    activeView.focus({ preventScroll: true });
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
    });
  }

  // 麵包屑導航
  function updateBreadcrumb() {
    let html = `<span class="breadcrumb-item ${state.currentView === 'world' ? 'active' : ''}" data-target="world">🌍 世界地圖</span>`;

    if (state.selectedContinentId) {
      const cont = window.TRAVEL_DATA.continents.find(c => c.id === state.selectedContinentId);
      html += ` <span>/</span> <span class="breadcrumb-item ${state.currentView === 'continent' ? 'active' : ''}" data-target="continent">${cont ? cont.name : '大洲'}</span>`;
    }

    if (state.selectedCountryId) {
      const country = window.TRAVEL_DATA.countries.find(c => c.id === state.selectedCountryId);
      html += ` <span>/</span> <span class="breadcrumb-item ${state.currentView === 'country' ? 'active' : ''}" data-target="country">${country ? country.name : '國家'}</span>`;

      if (state.selectedCityId) {
        const city = country?.cities.find(ci => ci.id === state.selectedCityId);
        if (city) {
          html += ` <span>/</span> <span class="breadcrumb-item active" style="cursor:default;">🏙️ ${city.name}</span>`;
        }
      }
    }
    if (!state.selectedCountryId && state.globalCityId) {
      const city = getGlobalCity(state.globalCityId);
      if (city) html += ` <span>/</span> <span class="breadcrumb-item active" style="cursor:default;">🏙️ ${city.name}</span>`;
    }

    breadcrumbNav.innerHTML = html;

    breadcrumbNav.querySelectorAll(".breadcrumb-item").forEach(item => {
      item.addEventListener("click", () => {
        const target = item.dataset.target;
        if (target === "world") {
          navigateTo("world");
        } else if (target === "continent") {
          state.selectedCountryId = null;
          state.selectedCityId = null;
          navigateTo("continent", { continentId: state.selectedContinentId });
        }
      });
    });
  }

  // 全域重新選擇
  btnResetGlobal.addEventListener("click", () => {
    state.selectedContinentId = null;
    state.selectedCountryId = null;
    state.filters = { search: "", directOnly: false, budgetAffordable: false };
    navigateTo("world");
  });

  // 全域城市切換掛載
  window.switchCity = (cityId) => {
    const globalCity = getGlobalCity(cityId);
    if (globalCity) {
      state.globalCityId = cityId;
      state.selectedCountryId = null;
      state.selectedContinentId = null;
    }
    state.selectedCityId = cityId;
    window.PlannerView?.recordRecentDestination(
      globalCity || country?.cities.find(item => item.id === cityId),
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
    window.history.pushState(null, "", `#${routeParams.toString()}`);
    updateBreadcrumb();
    window.CountryView.render(state);
    const country = window.TRAVEL_DATA.countries.find(item => item.id === state.selectedCountryId);
    const city = globalCity || country?.cities.find(item => item.id === cityId);
    if (city) {
      mapManager.flyToCity(city.lat, city.lng, 5);
      const hasDirect = globalCity
        ? window.CountryView?.getGlobalCityProfile(globalCity)?.hasDirect === true
        : country?.directFlight === true;
      mapManager.showFlightRoute(city, hasDirect);
    }
  };

  window.appNavigate = navigateTo;
  window.appState = state;
  const readRoute = () => {
    const route = new URLSearchParams(window.location.hash.slice(1));
    const view = route.get("view");
    if (!["world", "continent", "country"].includes(view)) return null;
    if (view === "world") return { viewName: "world" };
    if (view === "continent" && route.get("continent")) {
      return { viewName: "continent", params: { continentId: route.get("continent") } };
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
  window.addEventListener("popstate", () => {
    const route = readRoute();
    if (route) navigateTo(route.viewName, { ...route.params, fromHistory: true, skipMapRecord: true });
    else navigateTo("world", { fromHistory: true, skipMapRecord: true });
  });
  const initialRoute = readRoute();
  if (initialRoute) {
    navigateTo(initialRoute.viewName, { ...initialRoute.params, fromHistory: true, skipMapRecord: true });
  }
  window.GlobalCitiesView?.render();
  window.mapManager = mapManager;
});
