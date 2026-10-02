// 全域狀態管理器 (Store & History Navigation)
// 管理完整下鑽路徑 (World -> Continent -> Country -> City) 與地圖視角記憶回溯
(function() {
  const listeners = [];

  const state = {
    currentView: "world", // 'world' | 'continent' | 'country'
    selectedContinentId: null,
    selectedCountryId: null,
    selectedCityId: null,
    filters: {
      search: "",
      directOnly: false,
      budgetAffordable: false
    },
    // 地圖視角記憶庫 (View memory)
    mapMemory: {
      world: { center: [25.0, 10.0], zoom: 2.3 },
      continents: {} // 記錄每個洲最後離開時的視角：{ asia: { center, zoom }, ... }
    }
  };

  window.AppStore = {
    getState: () => ({ ...state }),

    subscribe: (fn) => {
      listeners.push(fn);
      return () => {
        const index = listeners.indexOf(fn);
        if (index > -1) listeners.splice(index, 1);
      };
    },

    notify: () => {
      listeners.forEach(fn => fn(state));
    },

    // 儲存當前地圖視角
    saveMapView: (scope, center, zoom) => {
      if (scope === "world") {
        state.mapMemory.world = { center, zoom };
      } else if (scope) {
        state.mapMemory.continents[scope] = { center, zoom };
      }
    },

    // 取得歷史地圖視角
    getSavedMapView: (scope) => {
      if (scope === "world") return state.mapMemory.world;
      return state.mapMemory.continents[scope] || null;
    },

    // 切換視圖與路徑
    navigateTo: (viewName, params = {}) => {
      state.currentView = viewName;
      if (params.continentId !== undefined) state.selectedContinentId = params.continentId;
      if (params.countryId !== undefined) state.selectedCountryId = params.countryId;
      if (params.cityId !== undefined) state.selectedCityId = params.cityId;
      window.AppStore.notify();
    },

    // 設定篩選條件
    setFilters: (newFilters) => {
      state.filters = { ...state.filters, ...newFilters };
      window.AppStore.notify();
    },

    // 重設全部狀態
    resetAll: () => {
      state.currentView = "world";
      state.selectedContinentId = null;
      state.selectedCountryId = null;
      state.selectedCityId = null;
      state.filters = { search: "", directOnly: false, budgetAffordable: false };
      window.AppStore.notify();
    }
  };
})();
