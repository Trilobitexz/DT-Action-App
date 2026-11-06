// 地圖管理器 (支援多來源免金鑰圖磚、大洲與熱門城市雙層地標)
class MapManager {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.defaultCenter = options.center || [25.0, 10.0];
    this.defaultZoom = options.zoom || 2.4;
    this.map = null;
    this.currentTileLayer = null;
    this.activeLayerKey = "voyager";
    this.failedTileProviders = new Set();
    this.continentMarkersLayer = null;
    this.cityMarkersLayer = null;
    this.globalCityMarkersLayer = null;
    this.flightRouteLayer = null;
    this.citySpotsLayer = null;
    this.cityAirportLayer = null;
    this.cityCenterLayer = null;
    this.citySpotMarkers = new Map();
    this.visibleCityUpdateFrame = null;
    this.tiltedView = false;
    this.currentCityContext = null;
    this.invalidateSizeTimer = null;
    this.flightOrigin = [25.0797, 121.2342];
    this.isCoarsePointer = window.matchMedia?.("(pointer: coarse)").matches === true;
    this.prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    this.navigationAnimationEnabled = true;

    this.onContinentSelect = options.onContinentSelect || (() => {});
    this.onCountrySelect = options.onCountrySelect || (() => {});
    this.onCitySelect = options.onCitySelect || (() => {});
    this.onGlobalCitySelect = options.onGlobalCitySelect || (() => {});

    // 使用 Esri 公開圖磚，避免 OSM 403 與 CARTO API key 限制。
    const esriAttribution = 'Tiles &copy; <a href="https://www.esri.com/">Esri</a>';
    this.tileProviders = {
      // 探索風格：Esri 街道圖。
      voyager: {
        name: "探索地圖",
        sources: [
          { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", attribution: esriAttribution },
          { url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", subdomains: "abc", attribution: '&copy; OpenStreetMap contributors' },
          { url: "https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png", attribution: '&copy; OpenStreetMap contributors, HOT' }
        ],
        maxZoom: 19
      },
      // 簡約風格：Esri 地形圖，與探索街道圖保持明顯差異。
      light: {
        name: "簡約地圖",
        sources: [
          { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}", attribution: esriAttribution },
          { url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png", subdomains: "abcd", attribution: '&copy; CARTO' },
          { url: "https://a.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png", attribution: '&copy; CARTO' }
        ],
        maxZoom: 18
      },
      // 3. ESRI ArcGIS World Imagery：世界高解析度真實衛星航照
      satellite: {
        name: "ESRI World Imagery (衛星)",
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        subdomains: "",
        attribution: 'Tiles &copy; Esri &mdash; DigitalGlobe, GeoEye, Earthstar Geographics',
        maxZoom: 18
      },
      // 4. ESRI ArcGIS Street Map (街道備援)
      esriStreet: {
        name: "OSM Humanitarian (備援)",
        url: "https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
        subdomains: "",
        attribution: '&copy; OpenStreetMap contributors, HOT',
        maxZoom: 19
      }
    };
  }

  init() {
    const container = document.getElementById(this.containerId);
    const status = document.getElementById("map-load-status");
    if (!container) {
      console.error("找不到地圖容器：", this.containerId);
      if (status) status.textContent = "找不到地圖容器，請重新載入頁面。";
      return;
    }
    if (!window.L) {
      console.error("Leaflet.js 未載入。請確認 CDN 網路連線。");
      if (status) status.textContent = "地圖程式載入失敗，請確認網路連線或稍後重試。";
      return;
    }
    if (this.map) return;

    // 初始化 Leaflet 地圖；允許小數縮放並修正隱藏/動畫容器的尺寸測量。
    this.map = window.L.map(container, {
      center: this.defaultCenter,
      zoom: this.defaultZoom,
      zoomSnap: 0.1,
      minZoom: 2,
      maxZoom: 18,
      zoomControl: false,
      preferCanvas: true,
      zoomAnimation: !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
      fadeAnimation: !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
      markerZoomAnimation: !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
      touchZoom: true,
      scrollWheelZoom: !this.isCoarsePointer,
      worldCopyJump: false
    });
    if (status) status.textContent = "";

    // 載入預設探索圖層
    this.setTileLayer("voyager");

    this.continentMarkersLayer = window.L.layerGroup().addTo(this.map);
    this.cityMarkersLayer = window.L.layerGroup().addTo(this.map);
    this.globalCityMarkersLayer = window.L.layerGroup().addTo(this.map);
    this.flightRouteLayer = window.L.layerGroup().addTo(this.map);
    this.citySpotsLayer = window.L.layerGroup().addTo(this.map);
    this.cityAirportLayer = window.L.layerGroup().addTo(this.map);
    this.cityCenterLayer = window.L.layerGroup().addTo(this.map);

    this.renderContinentMarkers();

    this.map.on("zoomend", () => {
      this.updateMarkersVisibility();
      this.scheduleVisibleCityUpdate();
    });
    this.map.on("moveend", () => this.scheduleVisibleCityUpdate());
    this.map.on("tileload", () => {
      const status = document.getElementById("map-load-status");
      if (status) status.textContent = "";
    });
    this.map.on("resize", () => this.invalidateSize());
    if ("ResizeObserver" in window) {
      this.mapResizeObserver = new window.ResizeObserver(entries => {
        if (entries.some(entry => entry.contentRect.width > 0 && entry.contentRect.height > 0)) this.invalidateSize();
      });
      this.mapResizeObserver.observe(container);
    }
    this.onVisibilityChange = () => { if (!document.hidden) this.invalidateSize(); };
    document.addEventListener("visibilitychange", this.onVisibilityChange);

    this.invalidateSize();
  }

  // 設定底圖樣式。一般圖層可逐一嘗試多個免金鑰來源，衛星保留原始圖源。
  setTileLayer(layerKey) {
    if (!this.map) return;
    layerKey = this.tileProviders[layerKey] ? layerKey : "voyager";
    this.activeLayerKey = layerKey;
    this.sourceAttempt = 0;
    const status = document.getElementById("map-load-status");
    if (status) status.textContent = "";
    this.loadTileSource(layerKey);
  }

  loadTileSource(layerKey) {
    if (!this.map || this.activeLayerKey !== layerKey) return;
    const config = this.tileProviders[layerKey];
    const sources = config.sources || [config];
    const sourceIndex = this.sourceAttempt || 0;
    const source = sources[sourceIndex];
    const loadToken = (this.tileLoadToken || 0) + 1;
    this.tileLoadToken = loadToken;
    const status = document.getElementById("map-load-status");

    if (!source) {
      if (this.currentTileLayer) {
        this.map.removeLayer(this.currentTileLayer);
        this.currentTileLayer = null;
      }
      if (status) status.textContent = `${config.name}載入失敗，請檢查網路連線後切換圖層重試。`;
      console.error(`${config.name} 的所有免金鑰圖磚來源皆無法載入。`);
      return;
    }

    if (this.currentTileLayer) {
      this.map.removeLayer(this.currentTileLayer);
      this.currentTileLayer = null;
    }

    if (status) status.textContent = `${config.name}地圖載入中…`;

    const layerOptions = {
      attribution: source.attribution || config.attribution,
      maxZoom: config.maxZoom,
      detectRetina: false,
      crossOrigin: false,
      updateWhenIdle: true,
      updateWhenZooming: false,
      updateInterval: 180,
      keepBuffer: 2,
      className: "journey-map-tiles"
    };
    if (source.subdomains) layerOptions.subdomains = source.subdomains;

    const requestedIndex = sourceIndex;
    const tileLayer = window.L.tileLayer(source.url, layerOptions);
    this.currentTileLayer = tileLayer;
    let tileLoaded = false;
    let fallbackStarted = false;
    let tileErrorCount = 0;
    let fallbackTimer = null;

    const fallbackToNextSource = (reason) => {
      if (fallbackStarted || tileLoaded || this.activeLayerKey !== layerKey || this.currentTileLayer !== tileLayer || this.tileLoadToken !== loadToken) return;
      fallbackStarted = true;
      if (fallbackTimer) window.clearTimeout(fallbackTimer);
      this.sourceAttempt = requestedIndex + 1;
      console.warn(`${config.name} 圖磚來源 ${requestedIndex + 1} 失敗，嘗試備援來源。`, reason || "");
      this.loadTileSource(layerKey);
    };

    tileLayer.on("tileload", () => {
      if (this.activeLayerKey !== layerKey || this.currentTileLayer !== tileLayer || this.tileLoadToken !== loadToken) return;
      tileLoaded = true;
      this.sourceAttempt = requestedIndex;
      this.failedTileProviders.delete(layerKey);
      if (fallbackTimer) window.clearTimeout(fallbackTimer);
      if (status) status.textContent = "";
    });

    tileLayer.on("tileerror", (event) => {
      if (this.activeLayerKey !== layerKey || this.currentTileLayer !== tileLayer || this.tileLoadToken !== loadToken || tileLoaded) return;
      tileErrorCount += 1;
      // 單張圖磚可能是服務端暫時缺圖，累積錯誤後才切換來源，避免畫面閃爍。
      if (tileErrorCount >= 3) fallbackToNextSource(event && event.error);
    });

    tileLayer.once("load", () => {
      if (this.activeLayerKey === layerKey && this.currentTileLayer === tileLayer && this.tileLoadToken === loadToken && status) {
        status.textContent = "";
      }
    });

    this.map.addLayer(tileLayer);

    // Keep the primary layer during interaction; switch only if it never yields a tile.
    fallbackTimer = window.setTimeout(() => {
      if (this.activeLayerKey !== layerKey || this.currentTileLayer !== tileLayer || this.tileLoadToken !== loadToken || tileLoaded) return;
      if (requestedIndex + 1 < sources.length) {
        fallbackToNextSource("圖磚逾時");
      } else if (status) {
        status.textContent = `${config.name}載入逾時，請檢查網路連線後切換圖層重試。`;
      }
    }, 4500);
  }

  setNavigationAnimationEnabled(enabled) {
    this.navigationAnimationEnabled = Boolean(enabled);
  }

  // 渲染大洲層級的懸浮地標徽章
  renderContinentMarkers() {
    this.continentMarkersLayer.clearLayers();
    const continents = window.GEO_CONTINENTS;
    if (!continents) return;

    Object.keys(continents).forEach(key => {
      const cont = continents[key];
      const customIcon = window.L.divIcon({
        className: "custom-continent-marker",
        html: `
          <div class="continent-pin-badge" data-continent-id="${cont.id}">
            <span class="pin-icon">🌏</span>
            <span class="pin-name">${cont.name}</span>
          </div>
        `,
        iconSize: [110, 36],
        iconAnchor: [55, 18]
      });

      const marker = window.L.marker(cont.center, { icon: customIcon });
      marker.on("click", (e) => {
        if (window.L && window.L.DomEvent) window.L.DomEvent.stopPropagation(e);
        this.flyToContinent(cont.id);
        this.onContinentSelect(cont.id);
      });
      this.continentMarkersLayer.addLayer(marker);
    });

    this.renderCityMarkers();
  }

  // 渲染熱門城市地標 (支援多縮放細節 LOD)
  renderCityMarkers() {
    if (!this.cityMarkersLayer || !this.globalCityMarkersLayer) return;
    this.cityMarkersLayer.clearLayers();
    this.globalCityMarkersLayer.clearLayers();

    const globalCities = window.TRAVEL_DATA?.globalCities || [];
    this.globalCityMarkers = [];
    globalCities.forEach(city => {
      if (!Number.isFinite(city.lat) || !Number.isFinite(city.lng)) return;

      const cityIcon = window.L.divIcon({
        className: "custom-global-city-marker",
        html: `
          <div class="global-city-pin-badge" title="${city.name} (${city.countryName})">
            <span class="global-city-pin-dot"></span>
            <span class="global-city-pin-text">${city.flag} ${city.name}</span>
          </div>
        `,
        iconSize: [118, 28],
        iconAnchor: [59, 14]
      });
      const marker = window.L.marker([city.lat, city.lng], {
        icon: cityIcon,
        title: `${city.name} (${city.countryName})`,
        riseOnHover: true
      });
      marker.on("click", event => {
        if (window.L?.DomEvent) window.L.DomEvent.stopPropagation(event);
        this.onGlobalCitySelect(city.id);
      });
      this.globalCityMarkersLayer.addLayer(marker);
      this.globalCityMarkers.push({ marker, city });
    });

    if (!window.TRAVEL_DATA?.countries) {
      this.updateMarkersVisibility();
      this.scheduleVisibleCityUpdate();
      return;
    }

    window.TRAVEL_DATA.countries.forEach(country => {
      country.cities.forEach(city => {
        if (!Number.isFinite(city.lat) || !Number.isFinite(city.lng)) return;

        const cityIcon = window.L.divIcon({
          className: "custom-city-marker",
          html: `
            <div class="city-pin-badge" title="${city.name} (${country.name})">
              <span class="city-pin-dot"></span>
              <span class="city-pin-text">${country.flag} ${city.name}</span>
            </div>
          `,
          iconSize: [96, 26],
          iconAnchor: [48, 13]
        });

        const marker = window.L.marker([city.lat, city.lng], { icon: cityIcon });
        marker.on("click", (e) => {
          if (window.L && window.L.DomEvent) window.L.DomEvent.stopPropagation(e);
          if (this.onCitySelect) {
            this.onCitySelect(country.continentId, country.id, city.id);
          }
        });
        this.cityMarkersLayer.addLayer(marker);
      });
    });

    this.updateMarkersVisibility();
    this.scheduleVisibleCityUpdate();
  }

  // 合併地圖移動期間的標籤計算，避免重複掃描 200 個城市。
  scheduleVisibleCityUpdate() {
    if (!this.map || !this.globalCityMarkers) return;
    if (this.visibleCityUpdateFrame !== null) return;
    this.visibleCityUpdateFrame = window.requestAnimationFrame(() => {
      this.visibleCityUpdateFrame = null;
      this.updateVisibleGlobalCities();
    });
  }

  // 依地圖視窗與熱門度顯示少量城市標籤，避免全球城市名稱互相遮擋。
  updateVisibleGlobalCities() {
    if (!this.map || !this.globalCityMarkers || !this.map.hasLayer(this.globalCityMarkersLayer)) return;
    const bounds = this.map.getBounds().pad(0.08);
    const maxLabels = this.isCoarsePointer ? 10 : 18;
    const zoom = this.map.getZoom();
    const candidates = this.globalCityMarkers
      .filter(({ marker }) => marker.getOpacity() > 0 && bounds.contains(marker.getLatLng()))
      .filter(({ city }) => city.travelRank <= maxLabels || (zoom >= 5.2 && city.travelRank <= maxLabels * 2))
      .sort((a, b) => a.city.travelRank - b.city.travelRank)
      .slice(0, maxLabels);
    const visibleMarkers = new Set(candidates.map(item => item.marker));
    this.globalCityMarkers.forEach(({ marker }) => {
      const label = marker.getElement()?.querySelector(".global-city-pin-text");
      if (label && label.hidden !== !visibleMarkers.has(marker)) {
        label.hidden = !visibleMarkers.has(marker);
      }
    });
  }

  // 根據縮放等級調整標記顯隱
  updateMarkersVisibility() {
    if (!this.map || !this.cityMarkersLayer || !this.globalCityMarkersLayer) return;
    const currentZoom = this.map.getZoom();
    const mapContainer = this.map.getContainer();
    mapContainer.classList.toggle("global-city-labels-visible", currentZoom >= 4.2);
    if (currentZoom >= 2.2) {
      if (!this.map.hasLayer(this.globalCityMarkersLayer)) {
        this.map.addLayer(this.globalCityMarkersLayer);
      }
    } else {
      if (this.map.hasLayer(this.globalCityMarkersLayer)) {
        this.map.removeLayer(this.globalCityMarkersLayer);
      }
    }

    if (currentZoom >= 4.2) {
      if (!this.map.hasLayer(this.cityMarkersLayer)) {
        this.map.addLayer(this.cityMarkersLayer);
      }
    } else {
      if (this.map.hasLayer(this.cityMarkersLayer)) {
        this.map.removeLayer(this.cityMarkersLayer);
      }
    }
  }

  // 平滑飛向特定大洲（下鑽動畫）
  flyToContinent(continentId, { animate = true } = {}) {
    const cont = window.GEO_CONTINENTS?.[continentId];
    if (!cont || !this.map) return;
    const bounds = window.L.latLngBounds(cont.bounds);
    if (!animate || !this.navigationAnimationEnabled || this.prefersReducedMotion) {
      this.map.stop();
      this.map.fitBounds(bounds, { padding: this.isCoarsePointer ? [28, 28] : [48, 48], maxZoom: cont.zoom || 5, animate: false });
      return;
    }
    this.map.flyToBounds(bounds, {
      padding: this.isCoarsePointer ? [28, 28] : [48, 48],
      maxZoom: cont.zoom || 5,
      duration: this.isCoarsePointer ? 1.1 : 1.45,
      easeLinearity: 0.22
    });
  }

  // 聚焦至特定城市
  flyToCity(lat, lng, zoom = 7, { animate = true } = {}) {
    if (!this.map || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    if (!animate || !this.navigationAnimationEnabled || this.prefersReducedMotion) {
      this.map.stop();
      this.map.setView([lat, lng], zoom, { animate: false });
      return;
    }
    this.map.flyTo([lat, lng], zoom, {
      animate: true,
      duration: this.isCoarsePointer ? 0.85 : 1.1,
      easeLinearity: 0.2
    });
  }

  showCityContext(city, { animate = true } = {}) {
    if (!this.map || !city || !Number.isFinite(city.lat) || !Number.isFinite(city.lng)) return;
    this.currentCityContext = city;
    [this.continentMarkersLayer, this.cityMarkersLayer, this.globalCityMarkersLayer].forEach(layer => {
      if (layer && this.map.hasLayer(layer)) this.map.removeLayer(layer);
    });
    [this.citySpotsLayer, this.cityAirportLayer, this.cityCenterLayer].forEach(layer => {
      if (layer && !this.map.hasLayer(layer)) this.map.addLayer(layer);
    });
    this.clearCitySpots();
    this.renderCitySpotMarkers(city);
    this.renderCityContextMarkers(city);
    if (!animate || !this.navigationAnimationEnabled || this.prefersReducedMotion) {
      this.map.stop();
      this.map.setView([city.lat, city.lng], 11, { animate: false });
    } else {
      this.flyToCity(city.lat, city.lng, 11, { animate: true });
    }
    this.fitCityContext(city, animate);
  }

  restoreOverviewMarkers() {
    if (!this.map) return;
    this.currentCityContext = null;
    if (this.visibleCityUpdateFrame !== null) {
      window.cancelAnimationFrame(this.visibleCityUpdateFrame);
      this.visibleCityUpdateFrame = null;
    }
    if (this.continentMarkersLayer && !this.map.hasLayer(this.continentMarkersLayer)) {
      this.map.addLayer(this.continentMarkersLayer);
    }
    this.updateMarkersVisibility();
    this.scheduleVisibleCityUpdate();
  }

  clearCitySpots() {
    if (this.citySpotsLayer) this.citySpotsLayer.clearLayers();
    if (this.cityAirportLayer) this.cityAirportLayer.clearLayers();
    if (this.cityCenterLayer) this.cityCenterLayer.clearLayers();
    this.citySpotMarkers.clear();
  }

  getAirportData(city) {
    if (Array.isArray(city.airports)) return city.airports;
    const airportCatalog = {
      "東京": [{ name: "成田國際機場", code: "NRT", lat: 35.772, lng: 140.392 }, { name: "羽田機場", code: "HND", lat: 35.549, lng: 139.779 }],
      "大阪": [{ name: "關西國際機場", code: "KIX", lat: 34.434, lng: 135.244 }],
      "京都": [{ name: "關西國際機場", code: "KIX", lat: 34.434, lng: 135.244 }],
      "首爾": [{ name: "仁川國際機場", code: "ICN", lat: 37.46, lng: 126.441 }, { name: "金浦機場", code: "GMP", lat: 37.558, lng: 126.791 }],
      "曼谷": [{ name: "蘇凡納布國際機場", code: "BKK", lat: 13.69, lng: 100.75 }],
      "新加坡": [{ name: "樟宜機場", code: "SIN", lat: 1.364, lng: 103.991 }],
      "巴黎": [{ name: "戴高樂機場", code: "CDG", lat: 49.009, lng: 2.548 }, { name: "奧利機場", code: "ORY", lat: 48.726, lng: 2.365 }],
      "倫敦": [{ name: "希斯洛機場", code: "LHR", lat: 51.47, lng: -0.454 }],
      "雪梨": [{ name: "雪梨機場", code: "SYD", lat: -33.946, lng: 151.177 }],
      "洛杉磯": [{ name: "洛杉磯國際機場", code: "LAX", lat: 33.942, lng: -118.408 }],
      "舊金山": [{ name: "舊金山國際機場", code: "SFO", lat: 37.621, lng: -122.379 }],
      "台北": [{ name: "桃園國際機場", code: "TPE", lat: 25.079, lng: 121.235 }]
    };
    return airportCatalog[city.name] || [];
  }

  getSpotCoordinates(city, spot, index) {
    if (Number.isFinite(spot.lat) && Number.isFinite(spot.lng)) {
      return [spot.lat, spot.lng];
    }
    // Do not invent coordinates: request a real OSM place match, otherwise keep a
    // clearly identified city-level fallback marker until the lookup completes.
    return [city.lat, city.lng];
  }

  escapePopupText(value) {
    return String(value || "").replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[character]));
  }

  createSpotPopup(city, spot, index, detail = null) {
    const title = this.escapePopupText(detail?.title || spot.name);
    const description = this.escapePopupText(detail?.extract || spot.note || "精選景點");
    const category = this.escapePopupText(spot.category || "景點");
    return `
      <div class="map-spot-popup">
        <strong>#${index + 1} ${title}</strong>
        <span>${category} · ★ ${this.escapePopupText(spot.rating)}</span>
        <p>${description}</p>
        <button type="button" data-map-spot-index="${index}">查看景點詳細資訊</button>
      </div>
    `;
  }

  renderCitySpotMarkers(city) {
    if (!this.citySpotsLayer || !Array.isArray(city.spots)) return;
    city.spots.forEach((spot, index) => {
      const coordinates = this.getSpotCoordinates(city, spot, index);
      const icon = window.L.divIcon({
        className: "custom-spot-marker",
        html: `<span class="spot-pin-number"><b>${index + 1}</b></span>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });
      const marker = window.L.marker(coordinates, { icon, title: spot.name });
      marker.bindPopup(this.createSpotPopup(city, spot, index));
      marker.on("popupopen", event => {
        event.popup.getElement()?.querySelector("[data-map-spot-index]")?.addEventListener("click", () => {
          const card = document.querySelector(`[data-city-id="${city.id}"][data-spot-index="${index}"]`);
          card?.scrollIntoView({ behavior: "smooth", block: "center" });
          card?.classList.add("spot-item-map-focus");
          window.setTimeout(() => card?.classList.remove("spot-item-map-focus"), 1600);
        });
      });
      this.citySpotsLayer.addLayer(marker);
      this.citySpotMarkers.set(`${city.id}:${index}`, { marker, city, spot, index });
      if (!Number.isFinite(spot.lat) || !Number.isFinite(spot.lng)) {
        window.SpotService?.fetchSpotDetail(spot.name, city.name, city).then(detail => {
          if (!detail?.location || this.citySpotMarkers.get(`${city.id}:${index}`)?.marker !== marker) return;
          this.updateSpotDetail(city.id, index, detail);
          this.fitCityContext(city, false);
        }).catch(error => console.warn(`無法定位「${spot.name}」：`, error));
      }
    });
  }

  fitCityContext(city, animate = true) {
    if (!this.map || !this.citySpotsLayer || !this.cityCenterLayer) return;
    animate = animate && this.currentCityContext?.id === city.id;
    const points = [];
    this.citySpotMarkers.forEach(({ city: markerCity, marker, spot }) => {
      if (markerCity.id === city.id && Number.isFinite(spot.lat) && Number.isFinite(spot.lng)) points.push(marker.getLatLng());
    });
    const airports = this.getAirportData(city).filter(airport => Number.isFinite(airport.lat) && Number.isFinite(airport.lng));
    const fitPoints = [...points, ...airports.map(airport => window.L.latLng(airport.lat, airport.lng))];
    if (fitPoints.length > 1) {
      const bounds = window.L.latLngBounds(fitPoints);
      if (bounds.isValid()) {
        if (animate && this.navigationAnimationEnabled && !this.prefersReducedMotion) {
          this.map.flyToBounds(bounds, {
            padding: this.isCoarsePointer ? [56, 56] : [76, 76],
            maxZoom: 13,
            duration: this.isCoarsePointer ? 0.75 : 0.95
          });
        } else {
          this.map.fitBounds(bounds, { padding: [48, 48], maxZoom: 13, animate: false });
        }
      }
    }
  }

  renderCityContextMarkers(city) {
    if (!this.cityCenterLayer || !this.cityAirportLayer) return;
    const centerIcon = window.L.divIcon({
      className: "custom-city-center-marker",
      html: '<span class="city-center-pin">●</span>',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
    window.L.marker([city.lat, city.lng], { icon: centerIcon, title: `${city.name}市中心` })
      .bindTooltip(`${city.name} 市中心`, { direction: "top", offset: [0, -10] })
      .addTo(this.cityCenterLayer);

    const airportIcon = window.L.divIcon({
      className: "custom-airport-marker",
      html: '<span class="airport-pin">✈</span>',
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });
    this.getAirportData(city).forEach(airport => {
      if (!Number.isFinite(airport.lat) || !Number.isFinite(airport.lng)) return;
      const label = `${airport.name} (${airport.code})`;
      window.L.marker([airport.lat, airport.lng], { icon: airportIcon, title: label })
        .bindPopup(`<strong>${this.escapePopupText(label)}</strong><p>城市交通節點，建議出發前確認航班與接駁方式。</p>`)
        .addTo(this.cityAirportLayer);
    });
  }

  updateSpotDetail(cityId, index, detail) {
    const entry = this.citySpotMarkers.get(`${cityId}:${index}`);
    if (!entry || !detail) return;
    const hasRealCoordinates = Number.isFinite(detail.location?.latitude) && Number.isFinite(detail.location?.longitude)
      && detail.location.category !== "city";
    if (hasRealCoordinates) {
      entry.marker.setLatLng([detail.location.latitude, detail.location.longitude]);
      entry.spot.lat = detail.location.latitude;
      entry.spot.lng = detail.location.longitude;
      entry.marker.setOpacity(1);
      entry.marker.setZIndexOffset(100 + index);
    } else {
      entry.marker.setOpacity(0.5);
    }
    entry.marker.setPopupContent(this.createSpotPopup(entry.city, entry.spot, index, detail));
  }

  // 顯示桃園 TPE 至直飛目的地的弧線航線。
  showFlightRoute(destination, hasDirect = false) {
    this.clearFlightRoute();
    if (!this.map || !this.flightRouteLayer || !hasDirect
      || !destination || !Number.isFinite(destination.lat) || !Number.isFinite(destination.lng)) return;

    const origin = this.flightOrigin;
    const target = [destination.lat, destination.lng];
    const longitudeDelta = target[1] - origin[1];
    const midpoint = [
      (origin[0] + target[0]) / 2 + Math.min(18, Math.max(7, Math.abs(longitudeDelta) * 0.08)),
      origin[1] + longitudeDelta / 2
    ];
    const points = [];
    for (let index = 0; index <= 40; index += 1) {
      const t = index / 40;
      const inverse = 1 - t;
      points.push([
        inverse * inverse * origin[0] + 2 * inverse * t * midpoint[0] + t * t * target[0],
        inverse * inverse * origin[1] + 2 * inverse * t * midpoint[1] + t * t * target[1]
      ]);
    }

    const route = window.L.polyline(points, {
      className: "flight-route-line",
      color: "#0f766e",
      weight: 3,
      opacity: 0.9,
      dashArray: "8 12",
      lineCap: "round",
      interactive: false
    });
    const originMarker = window.L.circleMarker(origin, {
      className: "flight-route-origin",
      radius: 5,
      color: "#0f766e",
      weight: 2,
      fillColor: "#ffffff",
      fillOpacity: 1
    }).bindTooltip("桃園 TPE", { direction: "top", offset: [0, -4] });
    const destinationMarker = window.L.circleMarker(target, {
      className: "flight-route-destination",
      radius: 6,
      color: "#f97316",
      weight: 2,
      fillColor: "#fff7ed",
      fillOpacity: 1
    }).bindTooltip(`${destination.name || "目的地"} 直飛`, { direction: "top", offset: [0, -5] });

    this.flightRouteLayer.addLayer(route);
    this.flightRouteLayer.addLayer(originMarker);
    this.flightRouteLayer.addLayer(destinationMarker);
  }

  clearFlightRoute() {
    if (this.flightRouteLayer) this.flightRouteLayer.clearLayers();
  }

  // 重設至世界全景
  flyToWorld({ animate = true } = {}) {
    if (!this.map) return;
    if (!animate || !this.navigationAnimationEnabled || this.prefersReducedMotion) {
      this.map.stop();
      this.map.setView(this.defaultCenter, this.defaultZoom, { animate: false });
      return;
    }
    this.map.flyTo(this.defaultCenter, this.defaultZoom, {
      duration: this.isCoarsePointer ? 0.75 : 1,
      easeLinearity: 0.2
    });
  }

  zoomIn() {
    if (this.map) {
      this.map.zoomIn(1, { animate: true });
    }
  }

  zoomOut() {
    if (this.map) {
      this.map.zoomOut(1, { animate: true });
    }
  }

  invalidateSize() {
    if (!this.map || this.invalidateSizeTimer !== null) return;
    this.invalidateSizeTimer = window.setTimeout(() => {
      this.invalidateSizeTimer = null;
      if (this.map) this.map.invalidateSize({ pan: false, debounceMoveend: true });
    }, 80);
  }

  // 儲存當前視角至記憶庫
  recordCurrentView(scope) {
    if (!this.map || !window.AppStore) return;
    if (this.map._animatingZoom || this.map._flyToFrame) return;
    const center = this.map.getCenter();
    const zoom = this.map.getZoom();
    if (!center || !Number.isFinite(center.lat) || !Number.isFinite(center.lng) || !Number.isFinite(zoom)) return;
    window.AppStore.saveMapView(scope, [center.lat, center.lng], zoom);
  }

  // 從記憶庫還原視角 (Memory Restore)
  restoreSavedView(scope, { animate = true } = {}) {
    if (!this.map || !window.AppStore) return false;
    const saved = window.AppStore.getSavedMapView(scope);
    if (saved && Array.isArray(saved.center) && saved.center.length === 2
      && saved.center.every(Number.isFinite) && Number.isFinite(saved.zoom)) {
      if (!animate || !this.navigationAnimationEnabled || this.prefersReducedMotion) {
        this.map.stop();
        this.map.setView(saved.center, saved.zoom, { animate: false });
      } else {
        this.map.flyTo(saved.center, saved.zoom, { duration: this.isCoarsePointer ? 0.7 : 0.95 });
      }
      return true;
    }
    return false;
  }
}

window.MapManager = MapManager;
