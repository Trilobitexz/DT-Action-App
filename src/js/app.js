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
    const worldButton = document.getElementById("btn-map-world");
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
    if (worldButton) worldButton.hidden = isWorld;
    if (mapContextInfo) {
      const city = state.globalCityId
        ? getGlobalCity(state.globalCityId)
        : window.TRAVEL_DATA.countries
          .find(country => country.id === state.selectedCountryId)?.cities
          .find(cityItem => cityItem.id === state.selectedCityId);
      mapContextInfo.hidden = !city || viewName !== "country";
      if (city && viewName === "country") {
        const spotCount = Array.isArray(city.spots) ? city.spots.length : 0;
        const airportCount = mapManager.getAirportData(city).length;
        mapContextInfo.innerHTML = `<strong>📍 ${city.name} 城市地圖</strong><span>🔴 精選景點 ${spotCount} 個</span><span>✈ 機場 ${airportCount ? `${airportCount} 個` : "資料待補充"}</span><small>景點若尚無精確座標會以淡色顯示；取得真實地點資料後會自動移到正確位置。</small><div class="city-map-key" aria-label="地圖圖例"><span><i>1</i>推薦景點編號與下方清單一致</span><span>🔵 市中心</span><span>✈ 機場</span><span>點擊標記看景點資訊</span></div>`;
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
  document.getElementById("btn-map-world")?.addEventListener("click", () => navigateTo("world"));
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
    document.getElementById("comparison-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  const backdrop = document.getElementById("drawer-backdrop");
  const drawers = document.querySelectorAll(".side-drawer");
  const readDrawerScale = () => {
    try {
      const stored = Number(localStorage.getItem("journey-atlas-drawer-scale"));
      return Number.isFinite(stored) && stored >= 0.8 && stored <= 1.1 ? stored : 1;
    } catch (error) {
      console.warn("無法讀取抽屜縮放設定，使用預設值。", error);
      return 1;
    }
  };
  let drawerScale = readDrawerScale();
  const updateDrawerScale = () => {
    drawerScale = Math.min(1.1, Math.max(0.8, drawerScale));
    try {
      localStorage.setItem("journey-atlas-drawer-scale", String(drawerScale));
    } catch (error) {
      console.warn("無法儲存抽屜縮放設定。", error);
    }
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
    if (drawer.getAttribute("aria-hidden") === "false") {
      closeDrawers();
      return;
    }
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

  // 3D 地球以非同步載入，避免 CDN 延遲阻塞既有城市地圖。
  const map3dPanel = document.getElementById("map-3d-experience");
  const map3dToggle = document.getElementById("btn-map-3d");
  const map3dStatus = document.getElementById("map-3d-status");
  let map3dViewer = null;
  let cesiumLoadPromise = null;
  let map3dResizeObserver = null;
  const update3DStatus = message => { if (map3dStatus) map3dStatus.textContent = message; };
  let map3dOpenToken = 0;
  const cesiumSources = [
    {
      script: "https://cdn.jsdelivr.net/npm/cesium@1.127.0/Build/Cesium/Cesium.js",
      baseUrl: "https://cdn.jsdelivr.net/npm/cesium@1.127.0/Build/Cesium/"
    },
    {
      script: "https://unpkg.com/cesium@1.127.0/Build/Cesium/Cesium.js",
      baseUrl: "https://unpkg.com/cesium@1.127.0/Build/Cesium/"
    }
  ];
  const ensureCesiumLoaded = () => {
    if (window.Cesium) return Promise.resolve(window.Cesium);
    if (cesiumLoadPromise) return cesiumLoadPromise;
    cesiumLoadPromise = new Promise((resolve, reject) => {
      const tryNext = () => {
        const source = cesiumSources.shift();
        if (!source) { reject(new Error("所有 Cesium CDN 都無法載入")); return; }
        const script = document.createElement("script");
        script.dataset.cesiumLoader = "journey-atlas";
        script.src = source.script;
        script.async = true;
        let settled = false;
        const loadTimeout = window.setTimeout(() => {
          if (settled) return;
          settled = true;
          script.remove();
          tryNext();
        }, 12000);
        script.onload = () => {
          if (settled) return;
          settled = true;
          window.clearTimeout(loadTimeout);
          if (!window.Cesium) { script.remove(); tryNext(); return; }
          window.CESIUM_BASE_URL = source.baseUrl;
          resolve(window.Cesium);
        };
        script.onerror = () => {
          if (settled) return;
          settled = true;
          window.clearTimeout(loadTimeout);
          script.remove();
          tryNext();
        };
        document.head.appendChild(script);
      };
      tryNext();
    }).catch(error => { cesiumLoadPromise = null; cesiumSources.splice(0, cesiumSources.length,
      { script: "https://cdn.jsdelivr.net/npm/cesium@1.127.0/Build/Cesium/Cesium.js", baseUrl: "https://cdn.jsdelivr.net/npm/cesium@1.127.0/Build/Cesium/" },
      { script: "https://unpkg.com/cesium@1.127.0/Build/Cesium/Cesium.js", baseUrl: "https://unpkg.com/cesium@1.127.0/Build/Cesium/" }
    ); throw error; });
    return cesiumLoadPromise;
  };
  const destroy3DViewer = () => {
    map3dResizeObserver?.disconnect();
    map3dResizeObserver = null;
    if (map3dViewer && !map3dViewer.isDestroyed()) {
      map3dViewer.destroy();
    }
    map3dViewer = null;
  };
  const close3DGlobe = () => {
    if (!map3dPanel || map3dPanel.hidden) return;
    map3dOpenToken += 1;
    map3dPanel.hidden = true;
    map3dToggle?.setAttribute("aria-expanded", "false");
    map3dToggle?.classList.remove("active");
    destroy3DViewer();
    update3DStatus("3D 地球已關閉。");
  };
  const open3DGlobe = async () => {
    if (!map3dPanel) return;
    const openToken = ++map3dOpenToken;
    map3dPanel.hidden = false;
    map3dToggle?.setAttribute("aria-expanded", "true");
    map3dToggle?.classList.add("active");
    mapManager.recordCurrentView("world");
    map3dPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    await new Promise(resolve => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
    if (map3dPanel.hidden || openToken !== map3dOpenToken) return;
    if (map3dViewer && !map3dViewer.isDestroyed()) { map3dViewer.resize(); map3dViewer.scene.requestRender(); return; }
    update3DStatus("正在載入 3D 地圖元件…若網路較慢可能需要數秒。 ");
    try {
      const Cesium = await ensureCesiumLoaded();
      if (map3dPanel.hidden || openToken !== map3dOpenToken) return;
      const globe = document.getElementById("map-3d-globe");
      if (!globe || globe.getBoundingClientRect().width < 2 || globe.getBoundingClientRect().height < 2) {
        throw new Error("3D 地圖容器沒有可用尺寸");
      }
      window.CESIUM_BASE_URL = window.CESIUM_BASE_URL || "https://cdn.jsdelivr.net/npm/cesium@1.127.0/Build/Cesium/";
      // Cesium's Natural Earth II texture is bundled with the library; no ion token required.
      map3dViewer = new Cesium.Viewer(globe, {
        animation: false, baseLayerPicker: false, fullscreenButton: true,
        geocoder: false, homeButton: true, infoBox: true, sceneModePicker: true,
        selectionIndicator: true, timeline: false, navigationHelpButton: true,
        requestRenderMode: true, maximumRenderTimeChange: Infinity,
        baseLayer: Cesium.ImageryLayer.fromProviderAsync(
          Cesium.TileMapServiceImageryProvider.fromUrl(Cesium.buildModuleUrl("Assets/Textures/NaturalEarthII"))
        )
      });
      map3dViewer.scene.globe.enableLighting = true;
      map3dViewer.scene.globe.showGroundAtmosphere = true;
      map3dViewer.scene.globe.depthTestAgainstTerrain = false;
      map3dViewer.scene.requestRender();
      map3dViewer.camera.setView({ destination: Cesium.Cartesian3.fromDegrees(15, 22, 23500000) });
      (window.TRAVEL_DATA?.globalCities || [])
        .filter(city => Number.isFinite(city.lat) && Number.isFinite(city.lng) && (city.travelRank == null || city.travelRank <= 30))
        .forEach(city => {
          const entity = map3dViewer.entities.add({
            name: `${city.name} (${city.countryName})`,
            position: Cesium.Cartesian3.fromDegrees(city.lng, city.lat, 12000),
            point: { pixelSize: 9, color: Cesium.Color.fromCssColorString("#ff795f"), outlineColor: Cesium.Color.WHITE, outlineWidth: 2 },
            label: { text: `${city.flag || ""} ${city.name}`, font: "13px sans-serif", style: Cesium.LabelStyle.FILL_AND_OUTLINE, fillColor: Cesium.Color.WHITE, outlineColor: Cesium.Color.fromCssColorString("#173847"), outlineWidth: 3, pixelOffset: new Cesium.Cartesian2(0, -18), distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 9000000), scaleByDistance: new Cesium.NearFarScalar(1000000, 1, 9000000, 0.65) }
          });
          entity.description = `<strong>${city.name}</strong><br>${city.countryName || ""}<br>座標：${city.lat.toFixed(3)}, ${city.lng.toFixed(3)}<br><small>城市詳細探索請使用下方 2D 地圖。</small>`;
        });
      map3dResizeObserver = new ResizeObserver(() => {
        if (map3dViewer && !map3dViewer.isDestroyed()) {
          map3dViewer.resize();
          map3dViewer.scene.requestRender();
        }
      });
      map3dResizeObserver.observe(globe);
      map3dViewer.scene.renderError.addEventListener((scene, renderError) => {
        console.error("Cesium WebGL render error:", renderError);
        update3DStatus(`3D 圖形渲染失敗：${renderError?.message || "WebGL 無法繪製"}。請更新瀏覽器或啟用硬體加速；2D 地圖仍可使用。`);
      });
      map3dViewer.resize();
      map3dViewer.scene.requestRender();
      update3DStatus("3D 地球已就緒（Natural Earth 全球底圖）。可拖曳旋轉、滾輪縮放，點選熱門城市查看資訊。");
    } catch (error) {
      if (openToken !== map3dOpenToken || map3dPanel.hidden) return;
      console.error("3D 地球初始化失敗：", error);
      destroy3DViewer();
      const reason = error?.message || "未知錯誤";
      update3DStatus(`3D 地圖載入失敗（${reason}）。請確認網路可連線至 CDN，並使用支援 WebGL 的瀏覽器；原有 2D 地圖仍可使用。可關閉後重試。`);
    }
  };
  map3dToggle?.addEventListener("click", () => map3dPanel?.hidden ? open3DGlobe() : close3DGlobe());
  document.getElementById("btn-map-3d-close")?.addEventListener("click", close3DGlobe);
  window.addEventListener("resize", () => {
    if (!map3dPanel?.hidden && map3dViewer && !map3dViewer.isDestroyed()) {
      map3dViewer.resize();
      map3dViewer.scene.requestRender();
    }
  });
  document.getElementById("btn-zoom-in")?.addEventListener("click", () => mapManager.zoomIn());
  document.getElementById("btn-zoom-out")?.addEventListener("click", () => mapManager.zoomOut());
  document.getElementById("btn-zoom-reset")?.addEventListener("click", () => {
    mapManager.setNavigationAnimationEnabled(true);
    if (state.currentView === "country") {
      const city = state.globalCityId
        ? getGlobalCity(state.globalCityId)
        : window.TRAVEL_DATA.countries.find(country => country.id === state.selectedCountryId)?.cities.find(item => item.id === state.selectedCityId);
      if (city) mapManager.showCityContext(city);
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
  function navigateTo(viewName, params = {}) {
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
    setMapContext(viewName);
    updateMapContextControls(viewName);

    updateBreadcrumb();
    const globalCity = state.globalCityId ? getGlobalCity(state.globalCityId) : null;
    document.title = viewName === "world"
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
        mapManager.showCityContext(city, { animate: shouldAnimateMap });
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
      mapManager.showCityContext(city, { animate: true });
      const hasDirect = globalCity
        ? window.CountryView?.getGlobalCityProfile(globalCity)?.hasDirect === true
        : country?.directFlight === true;
      mapManager.showFlightRoute(city, hasDirect);
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
