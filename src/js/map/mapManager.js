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
    this.onContinentSelect = options.onContinentSelect || (() => {});
    this.onCountrySelect = options.onCountrySelect || (() => {});
    this.onCitySelect = options.onCitySelect || (() => {});

    // 探索／簡約改用不同於 Carto 的免金鑰圖磚網路，並保留多個獨立備援來源。
    const osmAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
    const hotAttribution = `${osmAttribution} &mdash; Tiles style by <a href="https://www.hotosm.org/">HOT</a>`;
    const osmFranceAttribution = `${osmAttribution} &mdash; <a href="https://openstreetmap.fr/">OpenStreetMap France</a>`;
    this.tileProviders = {
      // 探索風格：HOT 彩色地圖；備援 OSM France、OSM Germany。
      voyager: {
        name: "探索地圖",
        sources: [
          { url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", subdomains: "abc", attribution: osmAttribution },
          { url: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png", subdomains: "abc", attribution: hotAttribution },
          { url: "https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png", subdomains: "abc", attribution: osmFranceAttribution },
          { url: "https://tile.openstreetmap.de/{z}/{x}/{y}.png", attribution: osmAttribution },
          { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", attribution: 'Tiles &copy; Esri' }
        ],
        maxZoom: 19
      },
      // 簡約風格：OSM France 清爽底圖；備援 OSM Germany、HOT。
      light: {
        name: "簡約地圖",
        sources: [
          { url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", subdomains: "abc", attribution: osmAttribution },
          { url: "https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png", subdomains: "abc", attribution: osmFranceAttribution },
          { url: "https://tile.openstreetmap.de/{z}/{x}/{y}.png", attribution: osmAttribution },
          { url: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png", subdomains: "abc", attribution: hotAttribution },
          { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", attribution: 'Tiles &copy; Esri' }
        ],
        maxZoom: 19
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
        name: "ESRI World Street (街道備援)",
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
        subdomains: "",
        attribution: 'Tiles &copy; Esri',
        maxZoom: 18
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
      touchZoom: true,
      scrollWheelZoom: true,
      worldCopyJump: false
    });
    if (status) status.textContent = "";

    // 載入預設探索圖層
    this.setTileLayer("voyager");

    this.continentMarkersLayer = window.L.layerGroup().addTo(this.map);
    this.cityMarkersLayer = window.L.layerGroup().addTo(this.map);

    this.renderContinentMarkers();

    this.map.on("zoomend", () => {
      this.updateMarkersVisibility();
    });
    this.map.on("tileload", () => {
      const status = document.getElementById("map-load-status");
      if (status) status.textContent = "";
    });

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

    const layerOptions = {
      attribution: source.attribution || config.attribution,
      maxZoom: config.maxZoom,
      detectRetina: true,
      crossOrigin: true,
      updateWhenIdle: true,
      keepBuffer: 2
    };
    if (source.subdomains) layerOptions.subdomains = source.subdomains;

    const requestedIndex = sourceIndex;
    const tileLayer = window.L.tileLayer(source.url, layerOptions);
    this.currentTileLayer = tileLayer;
    let tileLoaded = false;
    let fallbackStarted = false;

    const fallbackToNextSource = (reason) => {
      if (fallbackStarted || tileLoaded || this.activeLayerKey !== layerKey || this.currentTileLayer !== tileLayer || this.tileLoadToken !== loadToken) return;
      fallbackStarted = true;
      this.sourceAttempt = requestedIndex + 1;
      console.warn(`${config.name} 圖磚來源 ${requestedIndex + 1} 失敗，嘗試備援來源。`, reason || "");
      this.loadTileSource(layerKey);
    };

    tileLayer.on("tileload", () => {
      if (this.activeLayerKey !== layerKey || this.currentTileLayer !== tileLayer || this.tileLoadToken !== loadToken) return;
      tileLoaded = true;
      this.sourceAttempt = requestedIndex;
      this.failedTileProviders.delete(layerKey);
      if (status) status.textContent = "";
    });

    tileLayer.on("tileerror", (event) => {
      if (this.activeLayerKey !== layerKey || this.currentTileLayer !== tileLayer || this.tileLoadToken !== loadToken || tileLoaded) return;
      // 圖磚載入失敗即切至獨立來源，不依賴 Leaflet 私有 _tiles 計數（該計數會隨下載進度改變）。
      fallbackToNextSource(event && event.error);
    });

    tileLayer.once("load", () => {
      if (this.activeLayerKey === layerKey && this.currentTileLayer === tileLayer && this.tileLoadToken === loadToken && status) {
        status.textContent = "";
      }
    });

    this.map.addLayer(tileLayer);

    // CDN 連線被代理/防火牆靜默丟棄且有備援時，逾時後改用下一個來源。
    window.setTimeout(() => {
      if (this.activeLayerKey !== layerKey || this.currentTileLayer !== tileLayer || this.tileLoadToken !== loadToken || tileLoaded) return;
      if (requestedIndex + 1 < sources.length) {
        fallbackToNextSource("圖磚逾時");
      } else if (status) {
        status.textContent = `${config.name}載入逾時，請檢查網路連線後切換圖層重試。`;
      }
    }, 8000);
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
    if (!this.cityMarkersLayer) return;
    this.cityMarkersLayer.clearLayers();
    if (!window.TRAVEL_DATA || !window.TRAVEL_DATA.countries) return;

    window.TRAVEL_DATA.countries.forEach(country => {
      country.cities.forEach(city => {
        if (!city.lat || !city.lng) return;

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
  }

  // 根據縮放等級調整標記顯隱
  updateMarkersVisibility() {
    if (!this.map || !this.cityMarkersLayer) return;
    const currentZoom = this.map.getZoom();
    if (currentZoom >= 3.3) {
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
  flyToContinent(continentId) {
    const cont = window.GEO_CONTINENTS[continentId];
    if (!cont || !this.map) return;

    this.map.fitBounds(cont.bounds, { padding: [40, 40], animate: false });
  }

  // 聚焦至特定城市
  flyToCity(lat, lng, zoom = 7) {
    if (!this.map || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    this.map.setView([lat, lng], zoom, { animate: false });
  }

  // 重設至世界全景
  flyToWorld() {
    if (!this.map) return;
    this.map.setView(this.defaultCenter, this.defaultZoom, { animate: false });
  }

  zoomIn() {
    if (this.map) {
      this.map.setZoom(this.map.getZoom() + 1, { animate: false });
    }
  }

  zoomOut() {
    if (this.map) {
      this.map.setZoom(this.map.getZoom() - 1, { animate: false });
    }
  }

  invalidateSize() {
    if (this.map) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (this.map) this.map.invalidateSize({ pan: false });
        });
      });
    }
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
  restoreSavedView(scope) {
    if (!this.map || !window.AppStore) return false;
    const saved = window.AppStore.getSavedMapView(scope);
    if (saved && Array.isArray(saved.center) && saved.center.length === 2
      && saved.center.every(Number.isFinite) && Number.isFinite(saved.zoom)) {
      this.map.setView(saved.center, saved.zoom, { animate: false });
      return true;
    }
    return false;
  }
}

window.MapManager = MapManager;
