// 旅遊地點分析 APP - 全域控制器
document.addEventListener("DOMContentLoaded", () => {
  const state = {
    currentView: "world", // 'world' | 'continent' | 'country'
    selectedContinentId: null,
    selectedCountryId: null,
    selectedCityId: null,
    filters: {
      search: "",
      directOnly: false,
      budgetAffordable: false
    }
  };

  const viewWorld = document.getElementById("view-world");
  const viewContinent = document.getElementById("view-continent");
  const viewCountry = document.getElementById("view-country");
  const breadcrumbNav = document.getElementById("breadcrumb-nav");
  const btnResetGlobal = document.getElementById("btn-reset-global");

  // 初始化 Leaflet 地圖管理器
  const mapManager = new window.MapManager("leaflet-map", {
    center: [25.0, 10.0],
    zoom: 2.3,
    onContinentSelect: (continentId) => {
      navigateTo("continent", { continentId });
    }
  });
  mapManager.init();

  // 綁定地圖工具列縮放按鈕
  document.getElementById("btn-zoom-in")?.addEventListener("click", () => mapManager.zoomIn());
  document.getElementById("btn-zoom-out")?.addEventListener("click", () => mapManager.zoomOut());
  document.getElementById("btn-zoom-reset")?.addEventListener("click", () => mapManager.flyToWorld());

  // 快捷選擇按鈕
  document.querySelectorAll(".continent-chip-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const continentId = btn.dataset.continentId;
      mapManager.flyToContinent(continentId);
      setTimeout(() => {
        navigateTo("continent", { continentId });
      }, 700);
    });
  });

  // 主導航邏輯 (整合 AppStore 狀態與 MapManager 視角記憶機制)
  function navigateTo(viewName, params = {}) {
    // 進入新視圖前，儲存舊視圖的視角 (視角記憶)
    if (state.currentView === "world") {
      mapManager.recordCurrentView("world");
    } else if (state.currentView === "continent" && state.selectedContinentId) {
      mapManager.recordCurrentView(state.selectedContinentId);
    }

    state.currentView = viewName;
    if (params.continentId !== undefined) state.selectedContinentId = params.continentId;
    if (params.countryId !== undefined) state.selectedCountryId = params.countryId;
    if (params.cityId !== undefined) state.selectedCityId = params.cityId;

    if (window.AppStore) {
      window.AppStore.navigateTo(viewName, params);
    }

    viewWorld.classList.toggle("active", viewName === "world");
    viewContinent.classList.toggle("active", viewName === "continent");
    viewCountry.classList.toggle("active", viewName === "country");

    updateBreadcrumb();

    if (viewName === "world") {
      // 若有保存過的視角，優先還原
      if (!mapManager.restoreSavedView("world")) {
        mapManager.flyToWorld();
      }
      mapManager.invalidateSize();
    } else if (viewName === "continent") {
      window.ContinentView.render(state);
    } else if (viewName === "country") {
      window.CountryView.render(state);
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
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
    }

    breadcrumbNav.innerHTML = html;

    breadcrumbNav.querySelectorAll(".breadcrumb-item").forEach(item => {
      item.addEventListener("click", () => {
        const target = item.dataset.target;
        if (target === "world") {
          state.selectedContinentId = null;
          state.selectedCountryId = null;
          mapManager.flyToWorld();
          navigateTo("world");
        } else if (target === "continent") {
          state.selectedCountryId = null;
          navigateTo("continent");
        }
      });
    });
  }

  // 全域重新選擇
  btnResetGlobal.addEventListener("click", () => {
    state.selectedContinentId = null;
    state.selectedCountryId = null;
    state.filters = { search: "", directOnly: false, budgetAffordable: false };
    mapManager.flyToWorld();
    navigateTo("world");
  });

  // 全域城市切換掛載
  window.switchCity = (cityId) => {
    state.selectedCityId = cityId;
    window.CountryView.render(state);
  };

  window.appNavigate = navigateTo;
  window.appState = state;
  window.mapManager = mapManager;
});
