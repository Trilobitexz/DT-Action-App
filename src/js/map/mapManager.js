// 地圖管理器 (Leaflet 實體管理、Pinch-to-zoom、動態飛行動畫與標記)
class MapManager {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.defaultCenter = options.center || [25.0, 10.0];
    this.defaultZoom = options.zoom || 2.4;
    this.map = null;
    this.continentMarkersLayer = null;
    this.countryMarkersLayer = null;
    this.onContinentSelect = options.onContinentSelect || (() => {});
    this.onCountrySelect = options.onCountrySelect || (() => {});
  }

  init() {
    const container = document.getElementById(this.containerId);
    if (!container || !window.L) {
      console.error("Leaflet.js 未載入或找不到地圖容器：", this.containerId);
      return;
    }

    // 初始化 Leaflet 地圖，啟用雙手手勢與滾輪縮放
    this.map = L.map(this.containerId, {
      center: this.defaultCenter,
      zoom: this.defaultZoom,
      minZoom: 2,
      maxZoom: 18,
      zoomControl: false, // 採用自訂 UI 控制器
      touchZoom: true,    // 支援行動端 Pinch-to-zoom
      scrollWheelZoom: true,
      worldCopyJump: true
    });

    // 採用 OpenStreetMap 官方全球最主流、高穩定的圖磚來源（備用支援 CartoDB）
    const osmLayer = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    });

    osmLayer.on("tileerror", function(error, tile) {
      console.warn("OSM 圖磚載入異常，自動切換至備用圖磚：", error);
    });

    osmLayer.addTo(this.map);

    this.continentMarkersLayer = L.layerGroup().addTo(this.map);
    this.countryMarkersLayer = L.layerGroup().addTo(this.map);

    this.renderContinentMarkers();

    // 延遲二次校正尺寸，避免首次渲染時容器寬高未定
    setTimeout(() => {
      this.map.invalidateSize();
    }, 200);
  }

  // 渲染大洲層級的懸浮地標徽章
  renderContinentMarkers() {
    this.continentMarkersLayer.clearLayers();
    const continents = window.GEO_CONTINENTS;

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
      marker.on("click", () => {
        this.flyToContinent(cont.id);
        this.onContinentSelect(cont.id);
      });
      this.continentMarkersLayer.addLayer(marker);
    });
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
}

window.MapManager = MapManager;
