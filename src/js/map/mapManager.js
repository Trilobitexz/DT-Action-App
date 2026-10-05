// 地圖管理器 (支援多圖資備援、CartoDB 高清圖磚、大洲與熱門城市雙層地標)
class MapManager {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.defaultCenter = options.center || [25.0, 10.0];
    this.defaultZoom = options.zoom || 2.4;
    this.map = null;
    this.currentTileLayer = null;
    this.activeLayerKey = "voyager";
    this.continentMarkersLayer = null;
    this.cityMarkersLayer = null;
    this.onContinentSelect = options.onContinentSelect || (() => {});
    this.onCountrySelect = options.onCountrySelect || (() => {});
    this.onCitySelect = options.onCitySelect || (() => {});

    // 高品質免金鑰瓦片圖資供應商清單（含無痛容錯備援機制）
    this.tileProviders = {
      // 1. CartoDB Voyager：專為現代旅遊與視覺導航設計的精美彩色地圖
      voyager: {
        name: "CartoDB Voyager (探索)",
        url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        subdomains: "abcd",
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19
      },
      // 2. CartoDB Positron：簡約柔和淺色風格，突顯標籤與資訊
      light: {
        name: "CartoDB Positron (簡約)",
        url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        subdomains: "abcd",
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
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
    if (!container || !window.L) {
      console.error("Leaflet.js 未載入或找不到地圖容器：", this.containerId);
      return;
    }

    // 初始化 Leaflet 地圖，支援雙手捏合縮放 (Pinch-to-zoom)、滾輪縮放與流暢慣性平移
    this.map = L.map(this.containerId, {
      center: this.defaultCenter,
      zoom: this.defaultZoom,
      minZoom: 2,
      maxZoom: 18,
      zoomControl: false,
      touchZoom: true,
      scrollWheelZoom: true,
      worldCopyJump: true
    });

    // 載入預設圖層 (CartoDB Voyager)
    this.setTileLayer("voyager");

    this.continentMarkersLayer = L.layerGroup().addTo(this.map);
    this.cityMarkersLayer = L.layerGroup().addTo(this.map);

    this.renderContinentMarkers();

    this.map.on("zoomend", () => {
      this.updateMarkersVisibility();
    });

    setTimeout(() => {
      this.map.invalidateSize();
    }, 200);
  }

  // 切換底圖圖磚 (支援 voyager / light / satellite)
  setTileLayer(layerKey) {
    if (!this.map) return;
    const config = this.tileProviders[layerKey] || this.tileProviders.voyager;

    if (this.currentTileLayer) {
      this.map.removeLayer(this.currentTileLayer);
    }

    this.activeLayerKey = layerKey;

    const layerOptions = {
      attribution: config.attribution,
      maxZoom: config.maxZoom,
      detectRetina: true
    };
    if (config.subdomains) {
      layerOptions.subdomains = config.subdomains;
    }

    this.currentTileLayer = L.tileLayer(config.url, layerOptions);

    this.currentTileLayer.on("tileerror", () => {
      if (this.activeLayerKey !== "esriStreet") {
        console.warn(`圖層 ${this.activeLayerKey} 載入失敗，自動切換至備援圖層 ESRI Street`);
        this.setTileLayer("esriStreet");
      }
    });

    this.currentTileLayer.addTo(this.map);
  }

  // 渲染大洲層級的懸浮地標徽章
  renderContinentMarkers() {
    this.continentMarkersLayer.clearLayers();
    const continents = window.GEO_CONTINENTS;
    if (!continents) return;

    Object.keys(continents).forEach(key => {
      const cont = continents[key];
      const customIcon = L.divIcon({
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

      const marker = L.marker(cont.center, { icon: customIcon });
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

        const cityIcon = L.divIcon({
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

        const marker = L.marker([city.lat, city.lng], { icon: cityIcon });
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

    this.map.flyToBounds(cont.bounds, {
      padding: [40, 40],
      duration: 1.4,
      easeLinearity: 0.25
    });
  }

  // 聚焦至特定城市
  flyToCity(lat, lng, zoom = 7) {
    if (!this.map) return;
    this.map.flyTo([lat, lng], zoom, {
      duration: 1.2
    });
  }

  // 重設至世界全景
  flyToWorld() {
    if (!this.map) return;
    this.map.flyTo(this.defaultCenter, this.defaultZoom, {
      duration: 1.2
    });
  }

  zoomIn() {
    if (this.map) this.map.zoomIn();
  }

  zoomOut() {
    if (this.map) this.map.zoomOut();
  }

  invalidateSize() {
    if (this.map) {
      setTimeout(() => this.map.invalidateSize(), 150);
    }
  }

  // 儲存當前視角至記憶庫
  recordCurrentView(scope) {
    if (!this.map || !window.AppStore) return;
    const center = this.map.getCenter();
    const zoom = this.map.getZoom();
    window.AppStore.saveMapView(scope, [center.lat, center.lng], zoom);
  }

  // 從記憶庫還原視角 (Memory Restore)
  restoreSavedView(scope) {
    if (!this.map || !window.AppStore) return false;
    const saved = window.AppStore.getSavedMapView(scope);
    if (saved && saved.center && saved.zoom) {
      this.map.flyTo(saved.center, saved.zoom, { duration: 1.1 });
      return true;
    }
    return false;
  }
}

window.MapManager = MapManager;
