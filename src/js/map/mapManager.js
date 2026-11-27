// MapLibre GL JS 單一地圖引擎：Mercator 與 globe 投影共用向量圖層及互動狀態。
class MapManager {
  static MAX_CITY_SPOT_MARKERS = 100;

  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.defaultCenter = options.center || [20, 0];
    this.defaultZoom = options.zoom || 2.4;
    this.map = null;
    this.activeLayerKey = "voyager";
    this.navigationAnimationEnabled = true;
    this.prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    this.isCoarsePointer = window.matchMedia?.("(pointer: coarse)").matches === true;
    this.tiltedView = false;
    this.citySpotMarkers = new Map();
    this.itineraryDomMarkers = new Map();
    this.globalCityDomMarkers = new Map();
    this.cityContextDomMarkers = new Map();
    this.continentDomMarkers = new Map();
    this.localCityDomMarkers = new Map();
    this.globalCityMarkerSignature = "";
    this.overviewMarkerSignature = "";
    this.currentCityContext = null;
    this.activeMapPopup = null;
    this.activeMapPopupKey = "";
    this.cityContextRequestId = 0;
    this.cityContextExitZoom = 5.8;
    this.cityContextExitPending = false;
    this.cityContextZoomOutPending = false;
    this.cityContextFitTimer = null;
    this.cityContextUserInteracted = false;
    this.activeCitySpotCategory = "all";
    this.visibleCityUpdateFrame = null;
    this.markerVisibilityFrame = null;
    this.invalidateSizeTimer = null;
    this.layerInstallScheduled = false;
    this.layerInstallAttempts = 0;
    this.flightOrigin = [25.0797, 121.2342];
    this.layersReady = false;
    this.onContinentSelect = options.onContinentSelect || (() => {});
    this.onCountrySelect = options.onCountrySelect || (() => {});
    this.onCitySelect = options.onCitySelect || (() => {});
    this.onGlobalCitySelect = options.onGlobalCitySelect || (() => {});
    this.onCityContextExit = options.onCityContextExit || (() => {});
    this.tileProviders = {
      voyager: { name: "探索地圖", style: "https://tiles.openfreemap.org/styles/liberty" },
      light: { name: "簡約地圖", style: "https://tiles.openfreemap.org/styles/positron" },
      satellite: {
        name: "衛星航照",
        style: {
          version: 8,
          glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
          sources: {
            "satellite-imagery": {
              type: "raster",
              tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
              tileSize: 256,
              maxzoom: 19,
              attribution: "© Esri, Maxar, Earthstar Geographics"
            }
          },
          layers: [{ id: "satellite-imagery", type: "raster", source: "satellite-imagery", paint: { "raster-opacity": 1 } }]
        }
      }
    };
    this.geojson = { continents: this.emptyCollection(), cities: this.emptyCollection(), globalCities: this.emptyCollection(), spots: this.emptyCollection(), airports: this.emptyCollection(), routes: this.emptyCollection(), itinerary: this.emptyCollection() };
  }

  emptyCollection() { return { type: "FeatureCollection", features: [] }; }
  feature(id, coordinates, properties = {}) { return { type: "Feature", id: String(id), properties, geometry: { type: "Point", coordinates } }; }
  lineFeature(id, coordinates, properties = {}) { return { type: "Feature", id: String(id), properties, geometry: { type: "LineString", coordinates } }; }
  sourceData(key) { return this.map?.getSource(key); }
  syncSource(key) { this.sourceData(key)?.setData(this.geojson[key]); }
  showMapPopup(key, popup) {
    if (!this.map || !popup) return null;
    if (this.activeMapPopup && this.activeMapPopupKey === key) {
      this.activeMapPopup.remove();
      this.activeMapPopup = null;
      this.activeMapPopupKey = "";
      return null;
    }
    this.activeMapPopup?.remove();
    this.activeMapPopup = popup;
    this.activeMapPopupKey = key;
    popup.on("close", () => {
      if (this.activeMapPopup === popup) {
        this.activeMapPopup = null;
        this.activeMapPopupKey = "";
      }
    });
    popup.addTo(this.map);
    return popup;
  }
  syncAllSources() { Object.keys(this.geojson).forEach(key => this.syncSource(key)); }

  init() {
    const container = document.getElementById(this.containerId);
    const status = document.getElementById("map-load-status");
    if (!container) { if (status) status.textContent = "找不到地圖容器，請重新載入頁面。"; return; }
    if (!window.maplibregl) { if (status) status.textContent = "地圖程式載入失敗，請確認網路連線。"; return; }
    if (this.map) return;
    const initialZoom = Math.max(1.2, Math.min(this.defaultZoom, Math.log2(Math.max(container.clientWidth, 256) / 256)));
    this.initialZoom = initialZoom;
    this.map = new window.maplibregl.Map({
      container, style: this.tileProviders.voyager.style,
      center: [this.defaultCenter[1], this.defaultCenter[0]], zoom: initialZoom,
      minZoom: 1.2, maxZoom: 18, projection: { type: "mercator" },
      renderWorldCopies: true, attributionControl: false,
      canvasContextAttributes: { antialias: false, preserveDrawingBuffer: false }, fadeDuration: 0
    });
    this.initialMapLoadTimer = window.setTimeout(() => {
      if (!this.map?.isStyleLoaded?.() && status) {
        status.textContent = "地圖底圖載入逾時；請檢查網路，或切換底圖後再試。";
      }
    }, 12000);
    this.lastMapZoom = this.map.getZoom();
    this.cityContextZoomDirection = "in";
    this.map.on("zoom", event => {
      const zoom = this.map.getZoom();
      this.cityContextZoomDirection = zoom < this.lastMapZoom ? "out" : "in";
      this.lastMapZoom = zoom;
      if (this.currentCityContext && event?.originalEvent) this.cityContextUserInteracted = true;
    });
    this.map.on("dragstart", event => {
      if (this.currentCityContext && event?.originalEvent) this.cityContextUserInteracted = true;
    });
    this.map.addControl(new window.maplibregl.AttributionControl({ compact: true }), "bottom-right");
    this.map.on("error", event => { if (event?.error) console.warn("MapLibre map/tile error:", event.error); });
    this.map.on("load", () => {
      window.clearTimeout(this.initialMapLoadTimer);
      this.layersReady = false;
      this.ensureLayersInstalled();
      if (status) status.textContent = "";
      this.updateMarkersVisibility();
    });
    this.map.on("style.load", () => {
      if (!this.layersReady || !this.map.getSource("continents")) {
        this.layersReady = false;
        this.ensureLayersInstalled();
      }
      this.configureCityBuildings();
    });
    this.map.on("idle", () => {
      if (!this.layersReady) this.ensureLayersInstalled();
      if (!this.globalCityDomMarkers.size && this.getGlobalCityList().some(city => city.lat !== null && city.lat !== undefined && Number.isFinite(Number(city.lat)) && Number.isFinite(Number(city.lng)))) {
        this.renderCityMarkers();
        this.renderGlobalCityDomMarkers(true);
        this.renderOverviewDomMarkers(true);
      }
    });
    this.map.on("moveend", () => {
      this.updateMarkersVisibility();
      this.scheduleVisibleCityUpdate();
    });
    this.map.on("zoomend", event => {
      this.updateMarkersVisibility();
      this.scheduleVisibleCityUpdate();
      this.handleCityContextZoom(event);
    });
    this.map.on("click", event => this.handleMapClick(event));
    this.map.on("mousemove", event => this.updateCityMapPointer(event));
    this.map.on("mouseenter", "itinerary-stop-circles", event => {
      const feature = event.features?.[0];
      if (feature) this.setItineraryStopHover(feature.properties.dayIndex, feature.properties.spotIndex, true);
    });
    this.map.on("mouseleave", "itinerary-stop-circles", event => {
      const feature = event.features?.[0];
      if (feature) this.setItineraryStopHover(feature.properties.dayIndex, feature.properties.spotIndex, false);
    });
    ["continent-symbols", "global-city-symbols", "global-city-labels", "global-city-clusters", "global-city-cluster-count"].forEach(layer => {
      this.map.on("mouseenter", layer, () => { this.map.getCanvas().style.cursor = "pointer"; });
      this.map.on("mouseleave", layer, () => { this.map.getCanvas().style.cursor = ""; });
    });
    if (this.isCoarsePointer) this.map.scrollZoom.disable();
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

  installSourcesAndLayers() {
    if (!this.map) return;
    if (!this.map.isStyleLoaded()) {
      if (!this.layerInstallScheduled) {
        this.layerInstallScheduled = true;
        this.map.once("idle", () => {
          this.layerInstallScheduled = false;
          this.installSourcesAndLayers();
        });
      }
      return;
    }
    if (this.map.getSource("continents")) {
      this.layersReady = true;
      return;
    }
    Object.keys(this.geojson).forEach(key => this.map.addSource(key, { type: "geojson", data: this.geojson[key], ...(key === "globalCities" ? { cluster: true, clusterMaxZoom: 4, clusterRadius: 42 } : {}) }));
    this.map.addLayer({ id: "route-lines", type: "line", source: "routes", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": ["match", ["get", "kind"], "transit-flight", "#f59e0b", "airport-city", "#598b88", "#0f766e"], "line-width": ["match", ["get", "kind"], "transit-flight", 3, "airport-city", 2, 2.5], "line-opacity": ["match", ["get", "kind"], "airport-city", 0.55, 0.9], "line-dasharray": [2, 2] } });
    this.map.addLayer({ id: "route-lines-hit-area", type: "line", source: "routes", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffffff", "line-width": 14, "line-opacity": 0.001 } });
    const dayColors = ["#4f46a5", "#16836f", "#c17a21", "#337da0", "#a74867", "#64783d", "#7254a6"];
    const dayColorExpression = ["match", ["get", "dayIndex"], ...dayColors.flatMap((color, index) => [index, color]), "#b65337"];
    this.map.addLayer({ id: "itinerary-route-line", type: "line", source: "itinerary", filter: ["==", ["get", "kind"], "route"], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": dayColorExpression, "line-width": 3, "line-opacity": 0.82, "line-dasharray": [2, 2] } });
    this.map.addLayer({ id: "itinerary-route-hit-area", type: "line", source: "itinerary", filter: ["==", ["get", "kind"], "route"], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffffff", "line-width": 14, "line-opacity": 0.001 } });
    this.map.addLayer({ id: "itinerary-stop-circles", type: "circle", source: "itinerary", filter: ["==", ["get", "kind"], "stop"], paint: { "circle-radius": ["case", ["boolean", ["feature-state", "hovered"], false], 18, 13], "circle-color": ["case", ["boolean", ["feature-state", "hovered"], false], "#f2a900", dayColorExpression], "circle-stroke-color": "#ffffff", "circle-stroke-width": 2.5, "circle-opacity": 0, "circle-stroke-opacity": 0 } });
    this.map.addLayer({ id: "itinerary-stop-labels", type: "symbol", source: "itinerary", filter: ["==", ["get", "kind"], "stop"], layout: { "text-field": ["get", "number"], "text-size": 11, "text-font": ["Noto Sans Bold"], "text-allow-overlap": true }, paint: { "text-color": "#ffffff", "text-opacity": 0 } });
    this.map.addLayer({ id: "continent-symbols", type: "symbol", source: "continents", layout: { "text-field": ["get", "label"], "text-font": ["Noto Sans Regular"], "text-size": 13, "text-padding": 8, "text-allow-overlap": true, "text-ignore-placement": true }, paint: { "text-color": "#173847", "text-halo-color": "#ffffff", "text-halo-width": 2.5 } });
    this.map.addLayer({ id: "city-circles", type: "circle", source: "cities", layout: { visibility: "none" }, paint: { "circle-radius": 5, "circle-color": "#138b80", "circle-stroke-color": "#ffffff", "circle-stroke-width": 1.5 } });
    this.map.addLayer({ id: "city-symbols", type: "symbol", source: "cities", layout: { visibility: "none", "text-field": ["get", "label"], "text-font": ["Noto Sans Regular"], "text-size": 11, "text-offset": [0, 1.3], "text-anchor": "top", "text-optional": true }, paint: { "text-color": "#18544f", "text-halo-color": "#ffffff", "text-halo-width": 1.5 } });
    this.map.addLayer({ id: "global-city-clusters", type: "circle", source: "globalCities", filter: ["has", "point_count"], layout: { visibility: "none" }, paint: { "circle-color": "#176b5b", "circle-radius": ["step", ["get", "point_count"], 14, 10, 18, 30, 23], "circle-opacity": 0.9, "circle-stroke-width": 2, "circle-stroke-color": "#ffffff" } });
    this.map.addLayer({ id: "global-city-cluster-count", type: "symbol", source: "globalCities", filter: ["has", "point_count"], layout: { visibility: "none", "text-field": ["get", "point_count_abbreviated"], "text-size": 11 }, paint: { "text-color": "#ffffff" } });
    this.map.addLayer({ id: "global-city-symbols", type: "circle", source: "globalCities", filter: ["!", ["has", "point_count"]], layout: { visibility: "none" }, paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 3, 5, 6, 9, 9], "circle-color": "#2563eb", "circle-opacity": 0.96, "circle-stroke-color": "#ffffff", "circle-stroke-width": 1.6 } });
    this.map.addLayer({ id: "direct-flight-labels", type: "symbol", source: "routes", filter: ["==", ["get", "kind"], "direct-flight"], layout: { "symbol-placement": "line", "text-field": ["get", "label"], "text-size": 11, "text-font": ["Noto Sans Regular"], "text-allow-overlap": true }, paint: { "text-color": "#155e75", "text-halo-color": "#ffffff", "text-halo-width": 2 } });
    this.map.addLayer({ id: "global-city-labels", type: "symbol", source: "globalCities", filter: ["!", ["has", "point_count"]], layout: { visibility: "none", "text-field": ["get", "label"], "text-font": ["Noto Sans Regular"], "text-size": ["step", ["zoom"], 0, 4.2, 9, 6, 11], "text-offset": [0, 1.1], "text-anchor": "top", "text-optional": true, "text-allow-overlap": false }, paint: { "text-color": "#1e3a8a", "text-halo-color": "#ffffff", "text-halo-width": 1.6 } });
    this.map.addLayer({ id: "spot-circles", type: "circle", source: "spots", filter: ["!=", ["get", "kind"], "center"], layout: { visibility: "none" }, paint: { "circle-radius": 8, "circle-color": "#d3483c", "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 } });
    this.map.addLayer({ id: "spot-labels", type: "symbol", source: "spots", filter: ["!=", ["get", "kind"], "center"], layout: { visibility: "none", "text-field": ["get", "label"], "text-size": 11, "text-offset": [0, 1.1], "text-anchor": "top", "text-optional": true }, paint: { "text-color": "#7f2927", "text-halo-color": "#ffffff", "text-halo-width": 1.5 } });
    this.map.addLayer({ id: "city-center", type: "circle", source: "spots", filter: ["==", ["get", "kind"], "center"], paint: { "circle-radius": 7, "circle-color": "#1689bb", "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 } });
    this.map.addLayer({ id: "airport-circles", type: "circle", source: "airports", paint: { "circle-radius": 8, "circle-color": "#0f766e", "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 } });
    this.map.addLayer({ id: "airport-labels", type: "symbol", source: "airports", layout: { "text-field": ["get", "label"], "text-size": 10, "text-offset": [0, 1.1], "text-anchor": "top", "text-optional": true }, paint: { "text-color": "#125a55", "text-halo-color": "#ffffff", "text-halo-width": 1.5 } });
    this.layersReady = true;
    this.renderContinentMarkers(); this.renderCityMarkers(); this.updateMarkersVisibility();
    this.renderGlobalCityDomMarkers();
    this.renderOverviewDomMarkers();
    this.configureCityBuildings();
  }

  ensureLayersInstalled() {
    if (!this.map || this.layersReady || this.layerInstallScheduled) return;
    this.layerInstallScheduled = true;
    const attempt = () => {
      this.layerInstallScheduled = false;
      if (!this.map || this.layersReady) return;
      if (!this.map.isStyleLoaded()) {
        this.layerInstallAttempts += 1;
        if (this.layerInstallAttempts < 60) window.setTimeout(() => this.ensureLayersInstalled(), 100);
        return;
      }
      this.layerInstallAttempts = 0;
      this.installSourcesAndLayers();
      this.syncAllSources();
      this.updateMarkersVisibility();
    };
    if (this.map.isStyleLoaded()) attempt();
    else window.setTimeout(attempt, 50);
  }

  handleMapClick(event) {
    if (!this.map) return;
    if (event.originalEvent?.target?.closest?.(".itinerary-route-marker")) return;
    const layers = ["itinerary-stop-circles", "itinerary-stop-labels", "spot-circles", "spot-labels", "airport-circles", "airport-labels", "city-center", "route-lines-hit-area", "itinerary-route-hit-area", "continent-symbols", "city-circles", "city-symbols", "global-city-symbols", "global-city-labels", "global-city-clusters", "global-city-cluster-count"];
    const features = this.map.queryRenderedFeatures(event.point, { layers: layers.filter(id => this.map.getLayer(id)) });
    const priority = ["stop", "spot", "airport", "center", "route", "airport-city", "direct-flight", "transit-flight", "continent", "local-city", "global-city"];
    const feature = features.find(item => priority.includes(String(item.properties?.kind || ""))) || features[0] || null;
    if (!feature) {
      if (this.currentCityContext) this.openMapLocationPopup(event.lngLat, null);
      return;
    }
    const props = feature.properties || {};
    if (props.kind === "continent") { this.onContinentSelect(props.id); return; }
    if (props.kind === "local-city") { this.onCitySelect(props.continentId, props.countryId, props.cityId); return; }
    if (props.kind === "global-city") { this.onGlobalCitySelect(props.cityId); return; }
    if (props.cluster_id) {
      this.sourceData("globalCities")?.getClusterExpansionZoom(props.cluster_id, (error, zoom) => {
        if (!error) this.map.easeTo({ center: feature.geometry.coordinates, zoom, duration: 450 });
      }); return;
    }
    if (props.kind === "spot") this.openSpotPopup(feature);
    else if (props.kind === "airport") this.openAirportPopup(feature);
    else if (props.kind === "center") this.openCityCenterPopup(feature, event.lngLat);
    else if (props.kind === "stop") this.openItineraryStopPopup(feature);
    else if (["route", "airport-city", "direct-flight", "transit-flight"].includes(props.kind)) this.openRoutePopup(feature, event.lngLat);
    else if (this.currentCityContext) this.openMapLocationPopup(event.lngLat, this.findNamedBaseFeature(event.point));
  }

  updateCityMapPointer(event) {
    if (!this.map || !this.currentCityContext || this.map.getZoom() < 10.5) return;
    this.pendingPointerPoint = event.point;
    if (this.pointerCheckTimer) return;
    this.pointerCheckTimer = window.setTimeout(() => {
      this.pointerCheckTimer = null;
      if (!this.map || !this.currentCityContext || this.map.getZoom() < 10.5) return;
      const point = this.pendingPointerPoint;
      if (!point) return;
      const clickableLayers = ["spot-circles", "airport-circles", "city-center", "itinerary-stop-circles", "route-lines-hit-area", "itinerary-route-hit-area"]
        .filter(id => this.map.getLayer(id));
      const hasAppFeature = clickableLayers.length && this.map.queryRenderedFeatures(point, { layers: clickableLayers }).length > 0;
      const feature = hasAppFeature || this.findNamedBaseFeature(point);
      this.map.getCanvas().style.cursor = feature ? "pointer" : "grab";
    }, 90);
  }

  findNamedBaseFeature(point) {
    if (!this.map || !point) return null;
    const appSources = new Set(Object.keys(this.geojson));
    const features = this.map.queryRenderedFeatures(point).filter(feature => {
      if (appSources.has(feature.source)) return false;
      const props = feature.properties || {};
      return [props.name, props["name:zh-Hant"], props["name:zh"], props.name_zh, props.name_en, props["name:latin"]]
        .some(value => typeof value === "string" && value.trim());
    });
    if (!features.length) return null;
    const score = feature => {
      const layer = String(feature.layer?.id || "").toLowerCase();
      const sourceLayer = String(feature.sourceLayer || "").toLowerCase();
      return (/poi|place|building|transportation_name|water_name/.test(`${layer} ${sourceLayer}`) ? 10 : 0)
        + (feature.geometry?.type === "Point" ? 3 : 0)
        + (feature.properties?.class || feature.properties?.subclass ? 1 : 0);
    };
    return features.sort((a, b) => score(b) - score(a))[0];
  }

  getMapFeatureName(properties = {}) {
    return [properties["name:zh-Hant"], properties["name:zh"], properties.name_zh, properties.name, properties.name_en, properties["name:latin"]]
      .find(value => typeof value === "string" && value.trim())?.trim() || "附近地圖位置";
  }

  getMapFeatureType(properties = {}, sourceLayer = "") {
    const raw = String(properties.subclass || properties.class || properties.type || sourceLayer || "").toLowerCase();
    const labels = {
      attraction: "景點", museum: "博物館", monument: "紀念地標", memorial: "紀念地標", museum: "博物館",
      park: "公園綠地", garden: "花園", restaurant: "餐廳", cafe: "咖啡館", fast_food: "速食",
      hotel: "住宿", marketplace: "市場", shop: "商店", station: "車站", airport: "機場",
      church: "教堂", temple: "寺廟", mosque: "清真寺", building: "建築物", highway: "道路",
      water: "水域", river: "河川", park: "公園綠地", place: "地名", railway: "鐵路設施", aeroway: "航空設施"
    };
    if (labels[raw]) return labels[raw];
    if (/poi/.test(raw)) return "地圖地點";
    if (/building/.test(raw)) return "建築物";
    if (/transportation|highway/.test(raw)) return "道路／交通設施";
    return raw ? "地圖地點" : "地圖位置";
  }

  openMapLocationPopup(lngLat, feature) {
    if (!this.map || !lngLat) return;
    const properties = feature?.properties || {};
    const name = this.getMapFeatureName(properties);
    const type = feature ? this.getMapFeatureType(properties, feature.sourceLayer) : "附近位置";
    const detail = [properties.address || properties["addr:street"], properties.operator || properties.brand]
      .filter(value => typeof value === "string" && value.trim()).join(" · ");
    const query = encodeURIComponent(`${name} ${this.currentCityContext?.name || ""} ${this.currentCityContext?.countryName || ""}`.trim());
    const coordinateQuery = encodeURIComponent(`${Number(lngLat.lat).toFixed(6)},${Number(lngLat.lng).toFixed(6)}`);
    const googleUrl = `https://www.google.com/maps/search/?api=1&query=${feature ? query : coordinateQuery}`;
    const osmUrl = `https://www.openstreetmap.org/search?query=${coordinateQuery}`;
    const html = `<div class="map-feature-popup"><strong>${this.escapePopupText(name)}</strong><span>${this.escapePopupText(type)}</span>${detail ? `<p>${this.escapePopupText(detail)}</p>` : `<p>座標 ${Number(lngLat.lat).toFixed(5)}, ${Number(lngLat.lng).toFixed(5)}</p>`}<div class="map-feature-popup-actions"><a href="${this.escapePopupText(googleUrl)}" target="_blank" rel="noopener noreferrer">Google 地圖搜尋</a><a href="${this.escapePopupText(osmUrl)}" target="_blank" rel="noopener noreferrer">OpenStreetMap</a></div><small>地圖標籤僅供探索，請出發前確認地點資訊。</small></div>`;
    const key = `map-feature:${feature?.id || `${name}:${type}`}:${Number(lngLat.lng).toFixed(3)}:${Number(lngLat.lat).toFixed(3)}`;
    this.showMapPopup(key, new window.maplibregl.Popup({ closeButton: true, maxWidth: "320px" }).setLngLat(lngLat).setHTML(html));
  }

  openAirportPopup(feature) {
    const properties = feature.properties || {};
    const airport = this.getAirportData(this.currentCityContext).find(item => `${item.name} (${item.code})` === properties.name);
    const links = airport?.sourceUrl ? `<a href="${this.escapePopupText(this.safeExternalUrl(airport.sourceUrl))}" target="_blank" rel="noopener noreferrer">查看機場資料來源</a>` : "";
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(properties.name || "機場")}`;
    const html = `<div class="map-feature-popup"><strong>${this.escapePopupText(properties.name || "機場")}</strong><span>航空交通節點</span><p>航班與市區接駁請依出發日期確認。</p>${links}<a href="${mapsUrl}" target="_blank" rel="noopener noreferrer">在 Google 地圖開啟</a></div>`;
    this.showMapPopup(`airport:${properties.name || "airport"}`, new window.maplibregl.Popup({ closeButton: true, maxWidth: "300px" }).setLngLat(feature.geometry.coordinates).setHTML(html));
  }

  openCityCenterPopup(feature, lngLat) {
    const city = this.currentCityContext;
    if (!city) return;
    const sourceUrl = this.safeExternalUrl(city.coordinateSource?.sourceUrl);
    const source = sourceUrl ? `<a href="${this.escapePopupText(sourceUrl)}" target="_blank" rel="noopener noreferrer">查看座標來源</a>` : "城市座標參考點";
    const html = `<div class="map-feature-popup"><strong>${this.escapePopupText(city.name)} 市中心參考點</strong><span>城市位置</span>${source ? `<p>${source}</p>` : ""}<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${city.name} ${city.countryName || ""}`)}" target="_blank" rel="noopener noreferrer">在 Google 地圖搜尋</a></div>`;
    this.showMapPopup(`city-center:${city.id}`, new window.maplibregl.Popup({ closeButton: true, maxWidth: "300px" }).setLngLat(lngLat || feature.geometry.coordinates).setHTML(html));
  }

  openItineraryStopPopup(feature) {
    const properties = feature.properties || {};
    const dayNumber = Number(properties.dayIndex) + 1;
    const stopNumber = Number(properties.number) || 1;
    const city = this.currentCityContext;
    const matching = [...this.citySpotMarkers.values()].find(entry => entry.city?.id === city?.id
      && String(entry.spot?.name || "").normalize("NFKC").trim().toLowerCase() === String(properties.name || "").normalize("NFKC").trim().toLowerCase());
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${properties.name || "景點"} ${city?.name || ""}`)}`;
    const itineraryCard = document.querySelector(`.itinerary-spot-card[data-day-index="${dayNumber - 1}"][data-spot-index="${Number(properties.spotIndex)}"]`);
    const cardButton = itineraryCard
      ? `<button type="button" data-map-focus-itinerary="${Number(properties.spotIndex)}">在當日行程查看</button>`
      : matching ? `<button type="button" data-map-focus-card="${matching.index}">在景點清單查看</button>` : "";
    const popup = this.showMapPopup(`itinerary:${dayNumber}:${properties.spotIndex ?? stopNumber}`, new window.maplibregl.Popup({ closeButton: true, maxWidth: "300px" }).setLngLat(feature.geometry.coordinates)
      .setHTML(`<div class="map-feature-popup"><strong>Day ${dayNumber} · 第 ${stopNumber} 站</strong><span>${this.escapePopupText(properties.name || "行程景點")}</span><p>此標記依目前行程順序排列。</p>${cardButton}<a href="${mapsUrl}" target="_blank" rel="noopener noreferrer">在 Google 地圖搜尋</a></div>`));
    if (!popup) return;
    popup.getElement().querySelector("[data-map-focus-card]")?.addEventListener("click", () => {
      this.scrollToSpotCard(city.id, Number(matching.index));
      popup.remove();
    });
    popup.getElement().querySelector("[data-map-focus-itinerary]")?.addEventListener("click", event => {
      const card = document.querySelector(`.itinerary-spot-card[data-day-index="${dayNumber - 1}"][data-spot-index="${Number(event.currentTarget.dataset.mapFocusItinerary)}"]`);
      const day = card?.closest(".itinerary-day-card");
      if (day) day.open = true;
      card?.scrollIntoView({ behavior: this.prefersReducedMotion ? "auto" : "smooth", block: "center" });
      card?.classList.add("is-map-hovered");
      window.setTimeout(() => card?.classList.remove("is-map-hovered"), 1600);
      popup.remove();
    });
  }

  openRoutePopup(feature, lngLat) {
    const properties = feature.properties || {};
    let title = "地圖路線";
    let description = "此線段依地圖資料繪製，僅供位置參考。";
    if (properties.kind === "route") {
      title = `Day ${Number(properties.dayIndex) + 1} 行程動線`;
      description = properties.routeSource === "OSRM"
        ? `OSRM 開車路線參考：${(Number(properties.distanceMeters) / 1000).toFixed(1)} 公里，約 ${Math.max(1, Math.round(Number(properties.durationSeconds) / 60))} 分鐘；時間依實際路況而異。`
        : "依行程景點順序連線，並非即時導航路線。";
    } else if (properties.kind === "airport-city") {
      title = "機場到市區參考線";
      description = `地圖直線距離約 ${Number(properties.distanceKm) || "—"} 公里；實際交通路線與時間依交通方式和路況而異。`;
    } else {
      title = properties.kind === "direct-flight" ? "直飛航線示意" : "轉機航線示意";
      description = "弧線為規劃示意，不代表即時航班航跡或目前班表。請查看航空公司資訊。";
    }
    const html = `<div class="map-feature-popup"><strong>${this.escapePopupText(title)}</strong><p>${this.escapePopupText(description)}</p></div>`;
    const key = `route:${properties.kind || "route"}:${properties.dayIndex ?? properties.segment ?? 0}`;
    this.showMapPopup(key, new window.maplibregl.Popup({ closeButton: true, maxWidth: "300px" }).setLngLat(lngLat || feature.geometry.coordinates?.[0]).setHTML(html));
  }

  setTileLayer(layerKey, { suppressTimeoutFallback = false } = {}) {
    if (!this.map) return false;
    layerKey = this.tileProviders[layerKey] ? layerKey : "voyager";
    if (layerKey === this.activeLayerKey) return true;
    const previousLayerKey = this.activeLayerKey || "voyager";
    const config = this.tileProviders[layerKey]; this.activeLayerKey = layerKey;
    this.styleLoadGeneration = (this.styleLoadGeneration || 0) + 1;
    const generation = this.styleLoadGeneration;
    window.clearTimeout(this.styleLoadTimer);
    this.map.getContainer().dataset.mapTheme = layerKey;
    const status = document.getElementById("map-load-status"); if (status) status.textContent = `${config.name}樣式載入中…`;
    this.layersReady = false;
    this.layerInstallAttempts = 0;
    const onStyleLoad = () => {
      if (generation !== this.styleLoadGeneration || this.activeLayerKey !== layerKey) return;
      window.clearTimeout(this.styleLoadTimer);
      this.layersReady = false;
      this.ensureLayersInstalled();
      try { this.map.setProjection({ type: this.projectionMode || "mercator" }); } catch (error) { console.warn("目前底圖不支援所選地圖投影：", error); }
      if (status) status.textContent = "";
    };
    this.map.once("style.load", onStyleLoad);
    this.styleLoadTimer = window.setTimeout(() => {
      if (generation !== this.styleLoadGeneration) return;
      if (suppressTimeoutFallback) {
        if (status) status.textContent = `${config.name}底圖仍未載入，請檢查網路後重試。`;
        return;
      }
      if (status) status.textContent = `${config.name}底圖逾時，正在切回原圖層…`;
      document.querySelectorAll(".map-layer-btn").forEach(button => {
        const selected = button.id === `btn-layer-${previousLayerKey}`;
        button.classList.toggle("active", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
      this.setTileLayer(previousLayerKey, { suppressTimeoutFallback: true });
    }, 12000);
    try {
      this.map.setStyle(config.style, { diff: false });
    } catch (error) {
      window.clearTimeout(this.styleLoadTimer);
      this.map.off("style.load", onStyleLoad);
      this.activeLayerKey = previousLayerKey;
      this.map.getContainer().dataset.mapTheme = previousLayerKey;
      if (status) status.textContent = `${config.name}無法切換，已保留原底圖。`;
      console.warn("地圖底圖切換失敗：", error);
      return false;
    }
    return true;
  }

  configureCityBuildings() {
    if (!this.map?.isStyleLoaded?.()) return;
    const styleLayers = this.map.getStyle()?.layers || [];
    const existing = styleLayers.find(layer => layer.type === "fill-extrusion" && layer.id !== "journey-city-3d-buildings");
    if (existing) {
      this.cityBuildingLayerId = existing.id;
      this.updateCityBuildingView();
      return;
    }
    if (this.activeLayerKey !== "voyager" || this.map.getLayer("journey-city-3d-buildings")) return;
    const buildingLayer = styleLayers.find(layer => layer.type === "fill" && layer["source-layer"] === "building" && layer.source);
    if (!buildingLayer) return;
    try {
      this.map.addLayer({
        id: "journey-city-3d-buildings", type: "fill-extrusion", source: buildingLayer.source,
        "source-layer": buildingLayer["source-layer"], minzoom: 14,
        paint: {
          "fill-extrusion-color": "#d9d2c5",
          "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 14, 0, 15, ["coalesce", ["to-number", ["get", "render_height"]], ["to-number", ["get", "height"]], 0]],
          "fill-extrusion-base": ["coalesce", ["to-number", ["get", "render_min_height"]], ["to-number", ["get", "min_height"]], 0],
          "fill-extrusion-opacity": 0.78
        }
      }, buildingLayer.id);
      this.cityBuildingLayerId = "journey-city-3d-buildings";
      this.updateCityBuildingView();
    } catch (error) { console.warn("目前底圖不支援 3D 建築圖層：", error); }
  }

  updateCityBuildingView() {
    if (!this.map || !this.cityBuildingLayerId || !this.map.getLayer(this.cityBuildingLayerId)) return;
    const enabled = Boolean(this.currentCityContext && this.activeLayerKey === "voyager" && this.map.getZoom() >= 14);
    try { this.map.setLayoutProperty(this.cityBuildingLayerId, "visibility", enabled ? "visible" : "none"); } catch (error) { /* 樣式切換期間圖層可能正在重建 */ }
    if (this.currentCityContext && this.activeLayerKey === "voyager" && this.map.getZoom() >= 14 && !this.prefersReducedMotion) {
      if (this.map.getPitch() < 30) this.map.easeTo({ pitch: 45, duration: 650, essential: false });
    } else if (this.map.getPitch() > 0) this.map.easeTo({ pitch: 0, duration: this.prefersReducedMotion ? 0 : 450, essential: false });
  }

  setNavigationAnimationEnabled(enabled) { this.navigationAnimationEnabled = Boolean(enabled); }
  animateAllowed(animate = true) { return animate && this.navigationAnimationEnabled && !this.prefersReducedMotion; }
  renderContinentMarkers() {
    this.geojson.continents = this.emptyCollection();
    Object.entries(window.GEO_CONTINENTS || {}).forEach(([id, continent]) => this.geojson.continents.features.push(this.feature(`continent-${id}`, [continent.center[1], continent.center[0]], { kind: "continent", id, label: `🌏 ${continent.name}` })));
    this.syncSource("continents");
  }
  renderCityMarkers() {
    this.geojson.globalCities = this.emptyCollection();
    this.getGlobalCityList().forEach(city => {
      if (city.lat === null || city.lat === undefined || city.lat === "" || city.lng === null || city.lng === undefined || city.lng === "") return;
      const lat = Number(city.lat);
      const lng = Number(city.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) this.geojson.globalCities.features.push(this.feature(city.id, [lng, lat], { kind: "global-city", cityId: city.id, label: `${city.flag || ""} ${city.name}`.trim(), name: city.name, country: city.countryName || "" }));
    });
    this.geojson.cities = this.emptyCollection();
    (window.TRAVEL_DATA?.countries || []).forEach(country => (country.cities || []).forEach(city => {
      if (this.hasGlobalCity(city, country.name)) return;
      const lat = city.lat;
      const lng = city.lng;
      if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) this.geojson.cities.features.push(this.feature(city.id, [lng, lat], { kind: "local-city", cityId: city.id, countryId: country.id, continentId: country.continentId, label: `${country.flag || ""} ${city.name}`.trim() }));
    }));
    this.syncSource("globalCities"); this.syncSource("cities");
  }
  renderGlobalCityDomMarkers(force = false) {
    if (!this.map || !window.maplibregl) return;
    const cities = this.getGlobalCityList();
    const signature = cities.map(city => `${city.id}:${city.lat}:${city.lng}`).join("|");
    if (!force && signature === this.globalCityMarkerSignature && this.globalCityDomMarkers.size) {
      this.updateMarkersVisibility();
      return;
    }
    this.globalCityMarkerSignature = signature;
    this.globalCityDomMarkers.forEach(marker => marker.remove());
    this.globalCityDomMarkers.clear();
    cities.forEach(city => {
      if (city.lat === null || city.lat === undefined || city.lat === "" || city.lng === null || city.lng === undefined || city.lng === "") return;
      const lat = Number(city.lat), lng = Number(city.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return;
      const element = document.createElement("button");
      element.type = "button";
      element.className = `map-global-city-marker city-tier-${this.getCityTier(city)}`;
      element.title = `${city.name}（${city.countryName || ""}）`;
      element.setAttribute("aria-label", `前往${city.countryName || ""}${city.name}`);
      element.dataset.cityId = city.id;
      element.innerHTML = `<span class="map-global-city-dot" aria-hidden="true"></span><span class="map-global-city-label">${this.escapePopupText(city.name)}</span>`;
      const flightInfo = city.flightInfo || this.getGlobalCityFlightInfo(city.id);
      if (flightInfo?.hasDirect === true || city.directFlight === true) {
        const routeDestination = { ...city, flightInfo: flightInfo || {} };
        element.title = `${city.name}｜台北直飛參考：${flightInfo?.flightTime || "航程時間請依航班查詢"}`;
        element.addEventListener("mouseenter", () => this.showFlightRoute(routeDestination, true));
        element.addEventListener("mouseleave", () => { if (!this.currentCityContext) this.clearFlightPreview(); });
      }
      element.addEventListener("click", event => {
        event.stopPropagation();
        this.onGlobalCitySelect(city.id);
      });
      const marker = new window.maplibregl.Marker({ element, anchor: "center", subpixelPositioning: true }).setLngLat([lng, lat]).addTo(this.map);
      this.globalCityDomMarkers.set(city.id, marker);
    });
    this.updateMarkersVisibility();
  }
  getGlobalCityList() {
    return window.TRAVEL_DATA?.globalCityLists?.nameSorted || window.TRAVEL_DATA?.globalCities || [];
  }
  getGlobalCityFlightInfo(cityId) {
    const matches = (window.TRAVEL_DATA?.countries || []).flatMap(country => (country.cities || []).map(city => ({ country, city })));
    const match = matches.find(({ city }) => city.id === cityId);
    return match?.city?.flightInfo || (match?.city?.directFlight === true ? { hasDirect: true } : null);
  }
  clearFlightPreview() {
    this.geojson.routes = this.emptyCollection();
    this.syncSource("routes");
  }
  normalizeCityIdentity(value) {
    return String(value || "").normalize("NFKC").trim().toLocaleLowerCase().replace(/[\s\p{P}]+/gu, "");
  }
  hasGlobalCity(city, countryName = "") {
    return this.getGlobalCityList().some(item => item.id === city.id || (
      this.normalizeCityIdentity(item.countryName) === this.normalizeCityIdentity(countryName || city.countryName)
      && this.normalizeCityIdentity(item.englishName || item.name) === this.normalizeCityIdentity(city.englishName || city.name)
    ));
  }
  renderOverviewDomMarkers(force = false) {
    if (!this.map || !window.maplibregl) return;
    const countries = window.TRAVEL_DATA?.countries || [];
    const signature = [
      Object.entries(window.GEO_CONTINENTS || {}).map(([id, continent]) => `${id}:${continent.center.join(",")}`).join("|"),
      countries.flatMap(country => (country.cities || []).map(city => `${country.id}:${city.id}:${city.lat}:${city.lng}`)).join("|")
    ].join("::");
    if (!force && signature === this.overviewMarkerSignature
      && (this.continentDomMarkers.size || this.localCityDomMarkers.size)) {
      this.updateMarkersVisibility();
      return;
    }
    this.overviewMarkerSignature = signature;
    [...this.continentDomMarkers.values(), ...this.localCityDomMarkers.values()].forEach(marker => marker.remove());
    this.continentDomMarkers.clear();
    this.localCityDomMarkers.clear();
    const addMarker = (collection, key, coordinates, className, content, title, onClick) => {
      const element = document.createElement("button");
      element.type = "button";
      element.className = className;
      element.title = title;
      element.innerHTML = content;
      element.addEventListener("click", event => {
        event.stopPropagation();
        onClick();
      });
      collection.set(key, new window.maplibregl.Marker({ element, anchor: "center" }).setLngLat(coordinates).addTo(this.map));
    };
    Object.entries(window.GEO_CONTINENTS || {}).forEach(([id, continent]) => {
      addMarker(this.continentDomMarkers, id, [continent.center[1], continent.center[0]], "map-continent-marker", `<span class="map-continent-label">🌏 ${this.escapePopupText(continent.name)}</span>`, continent.name, () => this.onContinentSelect(id));
    });
    countries.forEach(country => (country.cities || []).forEach(city => {
      if (this.hasGlobalCity(city, country.name)) return;
      const lat = city.lat;
      const lng = city.lng;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      addMarker(this.localCityDomMarkers, `${country.id}:${city.id}`, [lng, lat], `map-local-city-marker city-tier-${this.getCityTier(city)}`, `<span class="map-local-city-dot"></span><span class="map-local-city-label">${this.escapePopupText(`${country.flag || ""} ${city.name}`.trim())}</span>`, `${city.name} (${country.name})`, () => this.onCitySelect(country.continentId, country.id, city.id));
    }));
    this.updateMarkersVisibility();
  }
  getCityTier(city) {
    const globalCity = this.getGlobalCityList().find(item => item.id === city.id);
    if ((globalCity?.spots?.length || city.spots?.length || 0) >= 3 || (globalCity?.airports?.length || city.airports?.length || 0) > 0) return "medium";
    return "small";
  }
  scheduleVisibleCityUpdate() {
    if (!this.map || this.visibleCityUpdateFrame !== null) return;
    this.visibleCityUpdateFrame = window.requestAnimationFrame(() => {
      this.visibleCityUpdateFrame = null;
      this.updateMarkersVisibility();
    });
  }
  updateVisibleGlobalCities() { this.scheduleVisibleCityUpdate(); }
  updateMarkersVisibility() {
    if (this.markerVisibilityFrame !== null) return;
    this.markerVisibilityFrame = window.requestAnimationFrame(() => {
      this.markerVisibilityFrame = null;
      this.applyMarkersVisibility();
    });
  }
  applyMarkersVisibility() {
    if (!this.map || !this.layersReady) return;
    const world = !this.currentCityContext, zoom = this.map.getZoom();
    this.updateCityBuildingView();
    this.map.getLayer("continent-symbols")?.setLayoutProperty("visibility", world && zoom < 2.8 ? "visible" : "none");
    ["city-circles", "city-symbols"].forEach(id => this.map.getLayer(id)?.setLayoutProperty("visibility", "none"));
    const showClusters = world && zoom < 4.4;
    const showGlobalCities = false;
    this.map.getLayer("global-city-clusters")?.setLayoutProperty("visibility", showClusters ? "visible" : "none");
    this.map.getLayer("global-city-cluster-count")?.setLayoutProperty("visibility", showClusters ? "visible" : "none");
    this.map.getLayer("global-city-symbols")?.setLayoutProperty("visibility", showGlobalCities ? "visible" : "none");
    this.map.getLayer("global-city-labels")?.setLayoutProperty("visibility", world && zoom >= 4.2 ? "visible" : "none");
    this.cityContextDomMarkers.forEach(marker => {
      const element = marker.getElement();
      const filteredOut = element.dataset.cityMarkerType === "spot"
        && this.activeCitySpotCategory !== "all"
        && element.dataset.spotCategory !== this.activeCitySpotCategory;
      element.hidden = !this.currentCityContext || filteredOut;
      element.classList.toggle("labels-visible", Boolean(this.currentCityContext) && zoom >= 10.5);
    });
    this.applyCitySpotDensity(zoom);
    this.continentDomMarkers.forEach(marker => {
      marker.getElement().hidden = !world || zoom >= 3.4;
    });
    this.localCityDomMarkers.forEach(marker => {
      const element = marker.getElement();
      const tier = element.classList.contains("city-tier-major") ? "major" : element.classList.contains("city-tier-medium") ? "medium" : "small";
      const minimumZoom = tier === "major" ? 3.2 : tier === "medium" ? 4.0 : 4.8;
      element.hidden = !world || zoom < minimumZoom;
      element.classList.toggle("labels-visible", zoom >= (tier === "major" ? 3.2 : tier === "medium" ? 4.2 : 5.2));
    });
    const cityMarkers = [...this.globalCityDomMarkers.values()].map(marker => ({ marker, element: marker.getElement() }))
      .sort((a, b) => Number(b.element.classList.contains("city-tier-major")) - Number(a.element.classList.contains("city-tier-major"))
        || String(a.element.dataset.cityId).localeCompare(String(b.element.dataset.cityId)));
    // Show useful city coverage from the initial world view, then relax spacing as the user zooms in.
    const minDistance = zoom < 2.8 ? 48 : zoom < 3.5 ? 40 : zoom < 4.5 ? 30 : zoom < 5.5 ? 18 : 0;
    const accepted = [];
    cityMarkers.forEach(({ marker, element }) => {
      const point = this.map.project(marker.getLngLat());
      const inViewport = point.x >= -20 && point.y >= -20 && point.x <= this.map.getContainer().clientWidth + 20 && point.y <= this.map.getContainer().clientHeight + 20;
      const overlaps = minDistance > 0 && accepted.some(other => (point.x - other.x) ** 2 + (point.y - other.y) ** 2 < minDistance ** 2);
      element.hidden = !world || zoom < 4.4 || !inViewport || overlaps;
      element.classList.toggle("labels-visible", world && zoom >= 3.0 && !overlaps);
      if (!element.hidden) accepted.push(point);
    });
  }
  applyCitySpotDensity(zoom = this.map?.getZoom() || 0) {
    if (!this.map || !this.currentCityContext) return;
    // Keep every location reachable while reducing overlapping pins at city scale.
    // At neighborhood zoom all pins return; at wider zoom keep a stable, spatially
    // distributed subset, recalculated as the map moves or zooms.
    const minDistance = zoom < 8 ? 52 : zoom < 9 ? 42 : zoom < 10 ? 32 : zoom < 11 ? 24 : zoom < 12 ? 14 : 0;
    const pins = [...this.cityContextDomMarkers.values()]
      .map(marker => ({ marker, element: marker.getElement() }))
      .filter(item => item.element.dataset.cityMarkerType === "spot"
        && Boolean(this.currentCityContext)
        && (this.activeCitySpotCategory === "all" || item.element.dataset.spotCategory === this.activeCitySpotCategory))
      .sort((a, b) => Number(b.element.dataset.featured === "true") - Number(a.element.dataset.featured === "true")
        || Number(a.element.dataset.featuredRank || a.element.dataset.spotIndex || 0) - Number(b.element.dataset.featuredRank || b.element.dataset.spotIndex || 0));
    const accepted = [];
    pins.forEach(({ marker, element }) => {
      const point = this.map.project(marker.getLngLat());
      const container = this.map.getContainer();
      const inViewport = point.x >= -24 && point.y >= -24
        && point.x <= container.clientWidth + 24 && point.y <= container.clientHeight + 24;
      const overlaps = inViewport && minDistance > 0 && accepted.some(other => {
        const dx = point.x - other.x;
        const dy = point.y - other.y;
        return dx * dx + dy * dy < minDistance * minDistance;
      });
      element.hidden = !inViewport || overlaps;
      if (inViewport && !overlaps) accepted.push(point);
    });
    this.updateCitySpotCount(this.currentCityContext.id);
  }
  handleCityContextZoom(event) {
    const userInitiatedZoomOut = (Boolean(event?.originalEvent) && this.cityContextZoomDirection === "out")
      || this.cityContextZoomOutPending;
    this.cityContextZoomOutPending = false;
    if (!userInitiatedZoomOut || !this.currentCityContext || this.cityContextExitPending || !this.map) return;
    if (this.map.getZoom() > this.cityContextExitZoom) return;
    const city = this.currentCityContext;
    this.cityContextExitPending = true;
    this.currentCityContext = null;
    this.clearCitySpots();
    this.geojson.routes = this.emptyCollection();
    this.syncSource("routes");
    this.renderOverviewDomMarkers();
    this.updateMarkersVisibility();
    this.onCityContextExit(city);
  }
  flyToContinent(continentId, { animate = true } = {}) {
    const continent = window.GEO_CONTINENTS?.[continentId]; if (!continent || !this.map) return;
    const bounds = [[continent.bounds[0][1], continent.bounds[0][0]], [continent.bounds[1][1], continent.bounds[1][0]]];
    this.map.stop(); this.map.fitBounds(bounds, { padding: this.isCoarsePointer ? 28 : 48, maxZoom: continent.zoom || 5, duration: this.animateAllowed(animate) ? 1200 : 0, essential: false });
  }
  flyToCity(lat, lng, zoom = 7, { animate = true } = {}) {
    if (!this.map || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    this.map.stop();
    const options = { center: [lng, lat], zoom, speed: 1.2, curve: 1.4, essential: false };
    if (this.animateAllowed(animate)) this.map.flyTo(options);
    else this.map.jumpTo({ center: options.center, zoom, essential: false });
  }
  showCityContext(city, { animate = true, preserveView = false } = {}) {
    if (!this.map || !city || !Number.isFinite(city.lat) || !Number.isFinite(city.lng)
      || city.lat < -90 || city.lat > 90 || city.lng < -180 || city.lng > 180) return;
    const keepUserView = preserveView && this.currentCityContext?.id === city.id && this.cityContextUserInteracted;
    this.currentCityContext = city; this.cityContextExitPending = false; this.cityContextZoomOutPending = false; this.cityContextUserInteracted = keepUserView; this.activeCitySpotCategory = "all"; this.clearCitySpots();
    const requestId = this.cityContextRequestId;
    const sourceSpots = this.getCitySpots(city);
    const spots = [];
    const visibleSpots = sourceSpots.slice(0, MapManager.MAX_CITY_SPOT_MARKERS);
    visibleSpots.forEach((spot, index) => {
      const hasCoords = Number.isFinite(spot.lat) && Number.isFinite(spot.lng)
        && spot.lat !== 0 && spot.lng !== 0
        && spot.lat >= -90 && spot.lat <= 90 && spot.lng >= -180 && spot.lng <= 180
        && this.distanceKm([city.lng, city.lat], [spot.lng, spot.lat]) <= 50;
      const feature = hasCoords
        ? this.feature(`${city.id}-spot-${index}`, [spot.lng, spot.lat], { kind: "spot", cityId: city.id, index, name: spot.name, label: `${index + 1}. ${spot.name}`, category: spot.category || "景點", rating: spot.rating || "—", note: spot.note || "", isFeatured: spot.isFeatured === true, featuredRank: Number.isFinite(spot.featuredRank) ? spot.featuredRank : null, approximate: false })
        : null;
      this.citySpotMarkers.set(`${city.id}:${index}`, { feature, city, spot, index });
      this.syncSpotMapButton(city.id, index, Boolean(feature));
      if (feature) spots.push(feature);
      else window.SpotService?.fetchSpotDetail(spot.name, city.name, city)
        .then(detail => {
          if (requestId === this.cityContextRequestId && this.currentCityContext?.id === city.id) this.updateSpotDetail(city.id, index, detail);
        })
        .catch(error => console.warn(`無法定位「${spot.name}」：`, error));
    });
    window.SpotService?.fetchNearbyPlaces(city, { radius: 20000, limit: MapManager.MAX_CITY_SPOT_MARKERS }).then(places => {
      if (requestId !== this.cityContextRequestId || this.currentCityContext?.id !== city.id || !Array.isArray(places)) return;
      const normalizeName = value => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").normalize("NFKC").trim().toLocaleLowerCase().replace(/[\s\p{P}]+/gu, "");
      const knownNames = new Set(sourceSpots.map(spot => normalizeName(spot.name)));
      let nextIndex = sourceSpots.length;
      places.forEach(spot => {
        if (this.geojson.spots.features.filter(feature => feature.properties?.kind === "spot").length >= MapManager.MAX_CITY_SPOT_MARKERS) return;
        if (!Number.isFinite(spot?.lat) || !Number.isFinite(spot?.lng) || spot.lat === 0 || spot.lng === 0
          || spot.lat < -90 || spot.lat > 90 || spot.lng < -180 || spot.lng > 180) return;
        spot = window.SpotTextService?.normalizeSpot(spot) || spot;
        if (!(window.SpotTextService?.isTravelAttraction(spot) ?? true)) return;
        const name = normalizeName(spot.name);
        if (!name || knownNames.has(name)) return;
        knownNames.add(name);
        const index = nextIndex++;
        const placeId = spot.osmId || spot.wikidataId || `${spot.sourceId || "place"}-${index}`;
        const feature = this.feature(`${city.id}-${spot.sourceId || "place"}-${placeId}`, [spot.lng, spot.lat], {
          kind: "spot", cityId: city.id, index, name: spot.name,
          label: `${index + 1}. ${spot.name}`, category: spot.category || "景點",
          rating: "—", note: spot.note, address: spot.address, openingHours: spot.openingHours,
          website: spot.website, sourceId: spot.sourceId, sourceUrl: spot.sourceUrl,
          sourceLabel: spot.sourceLabel, approximate: false
        });
        this.citySpotMarkers.set(`${city.id}:${index}`, { feature, city, spot, index });
        this.geojson.spots.features.push(feature);
        this.syncSpotMapButton(city.id, index, true);
      });
      this.syncSource("spots");
      this.renderCityContextDomMarkers();
      this.updateMarkersVisibility();
      this.updateCitySpotCount(city.id);
      this.scheduleCityContextFit(city.id);
    }).catch(error => {
      console.warn(`無法載入 ${city.name} 的開放地圖景點：`, error);
      this.updateCitySpotCount(city.id);
    });
    const centerLabel = city.destinationType === "island" ? `${city.name} 島嶼地名點` : `${city.name} 地名參考點`;
    this.geojson.spots = { type: "FeatureCollection", features: [{ type: "Feature", id: `${city.id}-center`, properties: { kind: "center", cityId: city.id, label: centerLabel }, geometry: { type: "Point", coordinates: [city.lng, city.lat] } }, ...spots] };
    this.geojson.airports = { type: "FeatureCollection", features: this.getAirportData(city).map((a, i) => this.feature(`${city.id}-airport-${i}`, [a.lng, a.lat], { kind: "airport", name: `${a.name} (${a.code})`, label: `✈ ${a.code}` })) };
    this.syncSource("spots"); this.syncSource("airports");
    this.geojson.routes = this.emptyCollection();
    const nearestAirport = this.geojson.airports.features.map(feature => ({ feature, distance: this.distanceKm([city.lng, city.lat], feature.geometry.coordinates) })).sort((a, b) => a.distance - b.distance)[0];
    if (nearestAirport) this.geojson.routes.features.push(this.lineFeature(`${city.id}-airport-city`, [[city.lng, city.lat], nearestAirport.feature.geometry.coordinates], { kind: "airport-city", distanceKm: Math.round(nearestAirport.distance) }));
    this.syncSource("routes");
    this.renderCityContextDomMarkers();
    this.updateMarkersVisibility();
    this.updateCitySpotCount(city.id);
    this.invalidateSize();
    if (!keepUserView) this.fitCityContext(city, animate);
  }
  restoreOverviewMarkers() {
    this.currentCityContext = null; this.cityContextExitPending = false; this.cityContextZoomOutPending = false; this.clearCitySpots(); this.geojson.routes = this.emptyCollection(); this.syncSource("routes"); this.updateMarkersVisibility();
  }
  distanceKm(from, to) {
    const radians = value => value * Math.PI / 180;
    const [lng1, lat1] = from, [lng2, lat2] = to;
    const dLat = radians(lat2 - lat1), dLng = radians(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  clearCitySpots() {
    this.cityContextRequestId += 1;
    window.clearTimeout(this.cityContextFitTimer);
    this.cityContextFitTimer = null;
    this.citySpotMarkers.clear(); this.geojson.spots = this.emptyCollection(); this.geojson.airports = this.emptyCollection();
    this.cityContextDomMarkers.forEach(marker => marker.remove());
    this.cityContextDomMarkers.clear();
    this.syncSource("spots"); this.syncSource("airports");
    this.clearItineraryRoute();
  }
  getItineraryStopCoordinate(city, spot) {
    const isValid = (lat, lng) => lat !== null && lat !== undefined && lat !== "" && lng !== null && lng !== undefined && lng !== ""
      && Number.isFinite(Number(lat)) && Number(lat) >= -90 && Number(lat) <= 90
      && Number.isFinite(Number(lng)) && Number(lng) >= -180 && Number(lng) <= 180
      && !(Number(lat) === 0 && Number(lng) === 0);
    const direct = [Number(spot?.lng), Number(spot?.lat)];
    if (isValid(spot?.lat, spot?.lng)) return direct;
    const normalize = value => String(value || "").normalize("NFKC").trim().toLocaleLowerCase();
    const entry = [...this.citySpotMarkers.values()].find(candidate => candidate.city?.id === city?.id
      && normalize(candidate.spot?.name) === normalize(spot?.name) && candidate.feature);
    const coordinates = entry?.feature?.geometry?.coordinates;
    return Array.isArray(coordinates) && isValid(coordinates[1], coordinates[0])
      ? [Number(coordinates[0]), Number(coordinates[1])] : null;
  }
  showItineraryDay(city, itinerarySpots, dayIndex = 0, travelMode = "transit") {
    if (!this.map || !city?.id || this.currentCityContext?.id !== city.id) return 0;
    const stops = (itinerarySpots || []).map((item, index) => {
      const spot = item?.spot || item;
      const coordinates = this.getItineraryStopCoordinate(city, spot);
      return coordinates ? { name: spot.name || "景點", coordinates, spotIndex: Number.isInteger(item?.index) ? item.index : index } : null;
    }).filter(Boolean);
    const requestToken = this.itineraryRouteToken = (this.itineraryRouteToken || 0) + 1;
    this.cancelItineraryAnimation();
    this.clearItineraryDomMarkers();
    this.geojson.itinerary = this.emptyCollection();
    if (!stops.length) { this.syncSource("itinerary"); return 0; }
    dayIndex = Math.max(0, Number(dayIndex) || 0);
    const stopFeatures = stops.map((stop, index) => this.feature(`itinerary-stop-${dayIndex}-${index}`, stop.coordinates, { kind: "stop", number: String(index + 1), name: stop.name, spotIndex: stop.spotIndex, dayIndex }));
    this.geojson.itinerary.features = stopFeatures;
    if (stops.length > 1) this.geojson.itinerary.features.unshift(this.lineFeature("itinerary-day-route", [stops[0].coordinates, stops[0].coordinates], { kind: "route", dayIndex }));
    this.syncSource("itinerary");
    this.renderItineraryDomMarkers(city, stops, dayIndex, requestToken);
    if (travelMode === "driving" && stops.length > 1 && window.RoadRouteService) {
      window.RoadRouteService.getDrivingRoute(stops.map(stop => stop.coordinates)).then(route => {
        if (!route || requestToken !== this.itineraryRouteToken || this.currentCityContext?.id !== city.id) return;
        const line = this.geojson.itinerary.features.find(feature => feature.properties?.kind === "route");
        if (!line) return;
        this.cancelItineraryAnimation();
        line.geometry = this.buildItineraryLineGeometry(route.coordinates);
        line.properties = { ...line.properties, routeSource: "OSRM", distanceMeters: route.distanceMeters, durationSeconds: route.durationSeconds };
        this.syncSource("itinerary");
        this.revealItineraryMarkers(stops.length);
      });
    }
    const bounds = new window.maplibregl.LngLatBounds(stops[0].coordinates, stops[0].coordinates);
    let previousLongitude = stops[0].coordinates[0];
    stops.slice(1).forEach(stop => {
      let longitude = stop.coordinates[0];
      const difference = longitude - previousLongitude;
      if (difference > 180) longitude -= 360;
      else if (difference < -180) longitude += 360;
      bounds.extend([longitude, stop.coordinates[1]]);
      previousLongitude = longitude;
    });
    if (stops.length === 1) this.map.flyTo({ center: stops[0].coordinates, zoom: Math.max(13, this.map.getZoom()), duration: this.animateAllowed(true) ? 650 : 0, essential: false });
    else this.map.fitBounds(bounds, { padding: this.isCoarsePointer ? 56 : 84, maxZoom: 14, duration: this.animateAllowed(true) ? 700 : 0, essential: false });
    if (stops.length > 1) this.animateItineraryLine(stops.map(stop => stop.coordinates), dayIndex, requestToken, stopFeatures);
    else this.revealItineraryMarkers(1);
    return stops.length;
  }
  cancelItineraryAnimation() {
    if (this.itineraryAnimationFrameId !== null && this.itineraryAnimationFrameId !== undefined) cancelAnimationFrame(this.itineraryAnimationFrameId);
    this.itineraryAnimationFrameId = null;
  }
  clearItineraryDomMarkers() {
    this.itineraryDomMarkers.forEach(marker => marker.remove());
    this.itineraryDomMarkers.clear();
  }
  revealItineraryMarkers(count) {
    [...this.itineraryDomMarkers.values()].slice(0, count).forEach(marker => marker.getElement().classList.add("is-visible"));
  }
  buildItineraryLineGeometry(coordinates) {
    const wrap = lng => ((Number(lng) + 540) % 360) - 180;
    const points = (coordinates || []).filter(point => Array.isArray(point) && point.length >= 2
      && Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1])))
      .map(([lng, lat]) => [wrap(lng), Number(lat)]);
    if (points.length < 2) return { type: "LineString", coordinates: points };
    const segments = [[points[0]]];
    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1];
      const next = points[index];
      const delta = next[0] - previous[0];
      if (delta > 180 || delta < -180) {
        const eastward = delta < -180;
        const unwrappedNextLng = next[0] + (eastward ? 360 : -360);
        const boundaryLng = eastward ? 180 : -180;
        const ratio = (boundaryLng - previous[0]) / (unwrappedNextLng - previous[0]);
        const crossingLat = previous[1] + (next[1] - previous[1]) * ratio;
        segments[segments.length - 1].push([boundaryLng, crossingLat]);
        segments.push([[eastward ? -180 : 180, crossingLat], next]);
      } else segments[segments.length - 1].push(next);
    }
    const validSegments = segments.filter(segment => segment.length >= 2);
    return validSegments.length > 1
      ? { type: "MultiLineString", coordinates: validSegments }
      : { type: "LineString", coordinates: validSegments[0] || points };
  }
  renderItineraryDomMarkers(city, stops, dayIndex, requestToken) {
    if (!this.map || !window.maplibregl?.Marker) return;
    const colors = ["#4f46a5", "#16836f", "#c17a21", "#337da0", "#a74867", "#64783d", "#7254a6"];
    const color = colors[dayIndex % colors.length];
    stops.forEach((stop, index) => {
      const element = document.createElement("button");
      element.type = "button";
      element.className = "itinerary-route-marker";
      element.style.setProperty("--itinerary-marker-color", color);
      element.setAttribute("aria-label", `Day ${dayIndex + 1}，第 ${index + 1} 站：${stop.name}。點擊查看行程卡片`);
      element.title = `${index + 1}. ${stop.name}`;
      element.innerHTML = `<span class="itinerary-route-marker__badge" aria-hidden="true">${index + 1}</span>`;
      element.addEventListener("mouseenter", () => this.setItineraryStopHover(dayIndex, stop.spotIndex, true));
      element.addEventListener("mouseleave", () => this.setItineraryStopHover(dayIndex, stop.spotIndex, false));
      element.addEventListener("focus", () => this.setItineraryStopHover(dayIndex, stop.spotIndex, true));
      element.addEventListener("blur", () => this.setItineraryStopHover(dayIndex, stop.spotIndex, false));
      ["pointerdown", "mousedown", "touchstart", "click"].forEach(type => {
        element.addEventListener(type, event => event.stopPropagation(), type === "touchstart" ? { passive: true } : undefined);
      });
      element.addEventListener("click", event => {
        if (requestToken !== this.itineraryRouteToken) return;
        const focusCard = () => {
          const card = document.querySelector(`.itinerary-spot-card[data-day-index="${dayIndex}"][data-spot-index="${stop.spotIndex}"]`);
          const day = card?.closest(".itinerary-day-card");
          if (day && !day.open) {
            document.querySelectorAll(".itinerary-day-card").forEach(item => { item.open = item === day; });
          }
          window.requestAnimationFrame(() => {
            const currentCard = document.querySelector(`.itinerary-spot-card[data-day-index="${dayIndex}"][data-spot-index="${stop.spotIndex}"]`);
            currentCard?.scrollIntoView({ behavior: this.prefersReducedMotion ? "auto" : "smooth", block: "center" });
            currentCard?.focus({ preventScroll: true });
            currentCard?.classList.add("is-route-target");
            window.setTimeout(() => currentCard?.classList.remove("is-route-target"), 1800);
          });
        };
        const plannerDrawer = document.getElementById("planner-drawer");
        if (plannerDrawer?.getAttribute("aria-hidden") === "true") {
          window.openPlannerDrawerForCurrentCity?.();
          window.setTimeout(focusCard, 320);
        } else focusCard();
      });
      const marker = new window.maplibregl.Marker({ element, anchor: "center", subpixelPositioning: true }).setLngLat(stop.coordinates).addTo(this.map);
      this.itineraryDomMarkers.set(`${dayIndex}:${stop.spotIndex}`, marker);
    });
  }
  animateItineraryLine(coordinates, dayIndex, requestToken, stopFeatures) {
    const line = this.geojson.itinerary.features.find(feature => feature.properties?.kind === "route");
    if (!line) return;
    const distance = (a, b) => this.distanceKm(a, b);
    const segmentLengths = coordinates.slice(1).map((point, index) => distance(coordinates[index], point));
    const totalLength = segmentLengths.reduce((sum, value) => sum + value, 0);
    this.prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    if (!totalLength || this.prefersReducedMotion || !this.navigationAnimationEnabled) {
      line.geometry = this.buildItineraryLineGeometry(coordinates);
      this.syncSource("itinerary");
      this.revealItineraryMarkers(stopFeatures.length);
      return;
    }
    const cumulative = [0];
    segmentLengths.forEach(length => cumulative.push(cumulative[cumulative.length - 1] + length));
    const startedAt = performance.now();
    const duration = 820;
    const draw = now => {
      if (requestToken !== this.itineraryRouteToken || !this.map) return;
      const rawProgress = Math.min(1, (now - startedAt) / duration);
      const progress = 1 - (1 - rawProgress) ** 3;
      const distanceAlong = totalLength * progress;
      const drawn = [coordinates[0]];
      for (let index = 0; index < segmentLengths.length; index += 1) {
        const startDistance = cumulative[index];
        const endDistance = cumulative[index + 1];
        if (distanceAlong >= endDistance) drawn.push(coordinates[index + 1]);
        else if (distanceAlong > startDistance) {
          const ratio = (distanceAlong - startDistance) / (endDistance - startDistance || 1);
          const [startLng, startLat] = coordinates[index];
          const [endLng, endLat] = coordinates[index + 1];
          let longitudeDelta = endLng - startLng;
          if (longitudeDelta > 180) longitudeDelta -= 360;
          else if (longitudeDelta < -180) longitudeDelta += 360;
          const longitude = ((startLng + longitudeDelta * ratio + 540) % 360) - 180;
          drawn.push([longitude, startLat + (endLat - startLat) * ratio]);
          break;
        } else break;
      }
      line.geometry = this.buildItineraryLineGeometry(drawn.length === 1 ? [drawn[0], drawn[0]] : drawn);
      this.syncSource("itinerary");
      let revealed = 0;
      while (revealed < cumulative.length && distanceAlong >= cumulative[revealed]) revealed += 1;
      this.revealItineraryMarkers(revealed);
      if (rawProgress < 1) this.itineraryAnimationFrameId = requestAnimationFrame(draw);
      else { this.itineraryAnimationFrameId = null; this.revealItineraryMarkers(stopFeatures.length); }
    };
    this.itineraryAnimationFrameId = requestAnimationFrame(draw);
  }
  clearItineraryRoute() { this.itineraryRouteToken = (this.itineraryRouteToken || 0) + 1; this.cancelItineraryAnimation(); this.clearItineraryDomMarkers(); this.geojson.itinerary = this.emptyCollection(); this.syncSource("itinerary"); }
  setItineraryStopHover(dayIndex, spotIndex, active) {
    const feature = this.geojson.itinerary.features.find(item => item.properties?.kind === "stop"
      && Number(item.properties.dayIndex) === Number(dayIndex) && Number(item.properties.spotIndex) === Number(spotIndex));
    if (!feature) return;
    this.map?.setFeatureState({ source: "itinerary", id: feature.id }, { hovered: Boolean(active) });
    this.itineraryDomMarkers.get(`${Number(dayIndex)}:${Number(spotIndex)}`)?.getElement().classList.toggle("is-active", Boolean(active));
    document.querySelectorAll(`.itinerary-spot-card[data-day-index="${Number(dayIndex)}"][data-spot-index="${Number(spotIndex)}"]`)
      .forEach(card => card.classList.toggle("is-map-hovered", Boolean(active)));
  }
  renderCityContextDomMarkers() {
    if (!this.map || !window.maplibregl) return;
    this.cityContextDomMarkers.forEach(marker => marker.remove());
    this.cityContextDomMarkers.clear();
    const addMarker = (key, coordinates, className, content, title, onClick, markerType, category = "", metadata = {}) => {
      const element = document.createElement("button");
      element.type = "button";
      element.className = `${className} map-context-landmark`;
      element.title = title;
      element.setAttribute("aria-label", title);
      element.dataset.cityMarkerType = markerType;
      if (category) element.dataset.spotCategory = category;
      if (metadata.spotIndex !== undefined) element.dataset.spotIndex = String(metadata.spotIndex);
      if (metadata.featuredRank !== null && metadata.featuredRank !== undefined) element.dataset.featuredRank = String(metadata.featuredRank);
      if (metadata.featured) element.dataset.featured = "true";
      element.innerHTML = content;
      if (markerType === "spot") {
        element.addEventListener("mouseenter", () => this.setSpotHover(city.id, metadata.spotIndex, true));
        element.addEventListener("mouseleave", () => this.setSpotHover(city.id, metadata.spotIndex, false));
      }
      element.addEventListener("click", event => {
        event.stopPropagation();
        onClick?.();
      });
      const marker = new window.maplibregl.Marker({ element, anchor: "center", subpixelPositioning: true }).setLngLat(coordinates).addTo(this.map);
      this.cityContextDomMarkers.set(key, marker);
    };
    const city = this.currentCityContext;
    const placeLabel = city.destinationType === "island" ? "島嶼地名參考點" : "地名參考點";
    const coordinateSourceUrl = this.safeExternalUrl(city.coordinateSource?.sourceUrl);
    const coordinateSourceLabel = city.coordinateSource?.provider || "GeoNames";
    const coordinateSource = coordinateSourceUrl
      ? `<a href="${this.escapePopupText(coordinateSourceUrl)}" target="_blank" rel="noopener noreferrer">${this.escapePopupText(coordinateSourceLabel)} 來源資料</a>`
      : "座標來源由城市目錄提供";
    addMarker(`${city.id}-center`, [city.lng, city.lat], "map-city-center-marker", `<span class="city-center-pin">●</span>`, `${city.name} ${placeLabel}`, () => {
      this.showMapPopup(`city-center:${city.id}`, new window.maplibregl.Popup({ maxWidth: "260px" }).setLngLat([city.lng, city.lat]).setHTML(`<strong>${this.escapePopupText(city.name)} ${placeLabel}</strong><p>${coordinateSource}</p>`));
    }, "center");
    this.geojson.spots.features.filter(feature => feature.properties.kind === "spot").forEach(feature => {
      const properties = feature.properties;
      addMarker(String(feature.id), feature.geometry.coordinates, "map-spot-marker", `<span class="spot-pin-number"><b>${Number(properties.index) + 1}</b></span><span class="map-context-landmark-label">${this.escapePopupText(properties.name)}</span>`, properties.name, () => this.openSpotPopup(feature), "spot", properties.category || "景點", { spotIndex: properties.index, featured: properties.isFeatured, featuredRank: properties.featuredRank });
    });
    this.geojson.airports.features.forEach(feature => {
      const properties = feature.properties;
      const distance = this.distanceKm([city.lng, city.lat], feature.geometry.coordinates);
      addMarker(String(feature.id), feature.geometry.coordinates, "map-airport-marker", `<span class="airport-pin">✈</span><span class="map-context-landmark-label">${this.escapePopupText(properties.name)}</span>`, properties.name, () => {
        this.showMapPopup(`airport:${properties.name}`, new window.maplibregl.Popup({ maxWidth: "280px" }).setLngLat(feature.geometry.coordinates).setHTML(`<strong>${this.escapePopupText(properties.name)}</strong><p>距城市地標直線約 ${distance.toFixed(0)} 公里。實際進城方式與時間依交通工具及路況而異。</p>`));
      }, "airport");
    });
    this.refreshCitySpotCategoryFilter();
  }
  refreshCitySpotCategoryFilter() {
    const select = document.getElementById("map-spot-category-filter");
    if (!select) return;
    const categories = [...new Set(this.geojson.spots.features
      .filter(feature => feature.properties?.kind === "spot")
      .map(feature => String(feature.properties.category || "景點").trim())
      .filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-Hant"));
    const selected = categories.includes(this.activeCitySpotCategory) ? this.activeCitySpotCategory : "all";
    select.replaceChildren(new Option("全部", "all"), ...categories.map(category => new Option(category, category)));
    select.value = selected;
    select.disabled = categories.length === 0;
    this.filterCitySpots(selected);
  }
  filterCitySpots(category = "all") {
    this.activeCitySpotCategory = category || "all";
    this.cityContextDomMarkers.forEach(marker => {
      const element = marker.getElement();
      if (element.dataset.cityMarkerType !== "spot") return;
      element.hidden = !this.currentCityContext
        || (this.activeCitySpotCategory !== "all" && element.dataset.spotCategory !== this.activeCitySpotCategory);
    });
    this.applyCitySpotDensity();
    if (this.currentCityContext) this.updateCitySpotCount(this.currentCityContext.id);
  }
  getAirportData(city) {
    if (!Array.isArray(city?.airports)) return [];
    return city.airports.filter(airport => Number.isFinite(airport.lat) && Number.isFinite(airport.lng)
      && airport.lat >= -90 && airport.lat <= 90 && airport.lng >= -180 && airport.lng <= 180
      && Boolean(this.safeExternalUrl(airport.sourceUrl)));
  }
  getCitySpots(city) {
    const normalize = items => items.map(spot => window.SpotTextService?.normalizeSpot(spot) || spot)
      .filter(spot => window.SpotTextService?.isTravelAttraction(spot) ?? true).filter(spot => {
      const normalizeName = value => (window.SpotTextService?.toTraditional(value) || String(value || ""))
        .normalize("NFKC").toLocaleLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
      const cityName = normalizeName(city?.name);
      const englishName = normalizeName(city?.englishName);
      const spotName = normalizeName(spot?.name);
      return spot?.category !== "city" && spotName && spotName !== cityName && spotName !== englishName;
    });
    if (Array.isArray(city?.spots) && city.spots.length) return normalize(city.spots);
    if (Array.isArray(city?.spotCandidates) && city.spotCandidates.length) return normalize(city.spotCandidates);
    if (Array.isArray(city?.attractions) && city.attractions.length) {
      return normalize(city.attractions.map(name => typeof name === "string" ? { name } : name));
    }
    return [];
  }
  safeExternalUrl(value) {
    try {
      const url = new URL(value);
      return ["https:", "http:"].includes(url.protocol) ? url.href : "";
    } catch (error) {
      return "";
    }
  }
  escapePopupText(value) { return String(value || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  createSpotPopup(city, spot, index, detail = null) {
    const hasRating = spot.rating !== null && spot.rating !== undefined && spot.rating !== ""
      && Number.isFinite(Number(spot.rating)) && Number(spot.rating) >= 0 && Number(spot.rating) <= 5
      && Boolean(String(spot.ratingSource || "").trim());
    const rating = hasRating ? `★ ${Number(spot.rating).toFixed(1)} · ${this.escapePopupText(spot.ratingSource)}` : "";
    const ratingLink = hasRating ? "" : `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${spot.name || "景點"}, ${city.name || ""}`)}" target="_blank" rel="noopener noreferrer">查看地圖評價 ↗</a>`;
    const sourceUrl = this.safeExternalUrl(spot.sourceUrl);
    const sourceLink = sourceUrl ? `<a href="${this.escapePopupText(sourceUrl)}" target="_blank" rel="noopener noreferrer">${this.escapePopupText(spot.sourceLabel || "資料來源")}</a>` : "";
    const address = spot.address ? `<span>地址：${this.escapePopupText(spot.address)}</span>` : "";
    const openingHours = spot.openingHours ? `<span>開放時間：${this.escapePopupText(spot.openingHours)}</span>` : "";
    const websiteUrl = this.safeExternalUrl(spot.website);
    const website = websiteUrl ? `<a href="${this.escapePopupText(websiteUrl)}" target="_blank" rel="noopener noreferrer">官方網站／資訊</a>` : "";
    return `<div class="map-spot-popup"><strong>#${index + 1} ${this.escapePopupText(detail?.title || spot.name)}</strong><span>${this.escapePopupText(spot.category || "景點")}${rating ? ` · ${rating}` : ""}</span>${ratingLink}<p>${this.escapePopupText(detail?.extract || spot.note || "尚無補充說明")}</p>${address}${openingHours}${website}${sourceLink}</div>`;
  }
  openSpotPopup(feature) {
    const p = feature.properties || {}, entry = this.citySpotMarkers.get(`${p.cityId}:${p.index}`); if (!entry) return;
    this.showMapPopup(`spot:${p.cityId}:${p.index}`, new window.maplibregl.Popup({ closeButton: true, maxWidth: "300px" }).setLngLat(feature.geometry.coordinates).setHTML(this.createSpotPopup(entry.city, entry.spot, entry.index, entry.detail)));
  }
  setSpotHover(cityId, index, active) {
    const marker = [...this.cityContextDomMarkers.values()].find(item => {
      const element = item.getElement();
      return element.dataset.cityMarkerType === "spot" && element.dataset.spotIndex === String(index);
    });
    marker?.getElement().classList.toggle("is-hovered", active);
    this.setSpotCardHighlight(cityId, index, active);
  }
  setSpotCardHighlight(cityId, index, active) {
    const card = document.querySelector(`#spot-item-${Number(index)}[data-city-id="${String(cityId).replace(/[^\w-]/g, "")}"]`);
    if (!card) return;
    card.classList.toggle("spot-item-map-hover", active);
    const marker = [...this.cityContextDomMarkers.values()].find(item => {
      const element = item.getElement();
      return element.dataset.cityMarkerType === "spot" && element.dataset.spotIndex === String(index);
    });
    marker?.getElement().classList.toggle("is-hovered", active);
  }
  scrollToSpotCard(cityId, index) {
    const card = document.querySelector(`#spot-item-${Number(index)}[data-city-id="${String(cityId).replace(/[^\w-]/g, "")}"]`);
    card?.scrollIntoView({ behavior: this.prefersReducedMotion ? "auto" : "smooth", block: "center" });
    card?.classList.add("spot-item-map-focus");
    window.setTimeout(() => card?.classList.remove("spot-item-map-focus"), 1600);
  }
  updateSpotDetail(cityId, index, detail) {
    const entry = this.citySpotMarkers.get(`${cityId}:${index}`); if (!entry || !detail) return;
    const loc = detail.location;
    const city = this.currentCityContext;
    if (!Number.isFinite(loc?.latitude) || !Number.isFinite(loc?.longitude)
      || loc.latitude < -90 || loc.latitude > 90 || loc.longitude < -180 || loc.longitude > 180
      || loc.category === "city" || city?.id !== cityId
      || this.distanceKm([city.lng, city.lat], [loc.longitude, loc.latitude]) > 50) return;
    entry.spot.lat = loc.latitude; entry.spot.lng = loc.longitude;
    if (loc.pageUrl) entry.spot.sourceUrl = loc.pageUrl;
    if (loc.sourceLabel) entry.spot.sourceLabel = loc.sourceLabel;
    entry.detail = detail;
    if (detail.nearbyPlace) {
      ["address", "openingHours", "website"].forEach(key => {
        if (detail.nearbyPlace[key] && !entry.spot[key]) entry.spot[key] = detail.nearbyPlace[key];
      });
    }
    if (!entry.feature) {
      entry.feature = this.feature(`${cityId}-spot-${index}`, [loc.longitude, loc.latitude], {
        kind: "spot", cityId, index, name: entry.spot.name, label: `${index + 1}. ${entry.spot.name}`,
        category: entry.spot.category || "景點", rating: entry.spot.rating || "—", note: entry.spot.note || "", approximate: false
      });
      this.geojson.spots.features.push(entry.feature);
    } else {
      entry.feature.geometry.coordinates = [loc.longitude, loc.latitude];
    }
    this.syncSource("spots");
    this.renderCityContextDomMarkers();
    this.updateMarkersVisibility();
    this.updateCitySpotCount(cityId);
    this.syncSpotMapButton(cityId, index, true);
    this.scheduleCityContextFit(cityId);
  }
  syncSpotMapButton(cityId, index, isMapped) {
    const card = document.querySelector(`[data-city-id="${cityId}"][data-spot-index="${index}"]`);
    const button = card?.querySelector("[data-map-focus-spot]");
    if (!button) return;
    button.disabled = false;
    button.dataset.mapReady = String(Boolean(isMapped));
    button.textContent = isMapped ? "🗺️ 在地圖查看" : "↗ Google 地圖搜尋";
    button.title = isMapped ? "在城市地圖定位此景點" : "此景點尚無可信座標，將以 Google 地圖搜尋";
  }
  focusSpot(cityId, index) {
    const entry = this.citySpotMarkers.get(`${cityId}:${index}`);
    if (!entry?.feature || !this.map) return false;
    this.cityContextUserInteracted = true;
    const coordinates = entry.feature.geometry.coordinates;
    const zoom = this.activeLayerKey === "voyager" ? Math.max(14.2, this.map.getZoom()) : Math.max(13, this.map.getZoom());
    const pitch = this.activeLayerKey === "voyager" ? 45 : this.map.getPitch();
    let popupOpened = false;
    const openPopup = () => {
      if (popupOpened) return;
      popupOpened = true;
      this.openSpotPopup(entry.feature);
    };
    if (this.animateAllowed(true)) {
      this.map.once("moveend", openPopup);
      this.map.flyTo({ center: coordinates, zoom, pitch, speed: 1.2, curve: 1.4, essential: false });
      window.setTimeout(openPopup, 2400);
    } else {
      this.map.jumpTo({ center: coordinates, zoom, pitch, essential: false });
      window.requestAnimationFrame(openPopup);
    }
    return true;
  }
  scheduleCityContextFit(cityId) {
    window.clearTimeout(this.cityContextFitTimer);
    this.cityContextFitTimer = window.setTimeout(() => {
      this.cityContextFitTimer = null;
      const city = this.currentCityContext;
      if (!this.map || city?.id !== cityId || this.cityContextUserInteracted) return;
      if (this.map.isMoving()) {
        this.scheduleCityContextFit(cityId);
        return;
      }
      this.fitCityContext(city, true);
    }, 250);
  }
  updateCitySpotCount(cityId) {
    if (this.currentCityContext?.id !== cityId) return;
    const spots = this.geojson.spots.features.filter(feature => feature.properties?.kind === "spot");
    const filteredSpots = this.activeCitySpotCategory === "all"
      ? spots
      : spots.filter(feature => String(feature.properties.category || "景點") === this.activeCitySpotCategory);
    const visibleCount = [...this.cityContextDomMarkers.values()].filter(marker => {
      const element = marker.getElement();
      return element.dataset.cityMarkerType === "spot" && !element.hidden
        && (this.activeCitySpotCategory === "all" || element.dataset.spotCategory === this.activeCitySpotCategory);
    }).length;
    const label = document.querySelector("#map-context-info .map-context-spot-count");
    if (!label) return;
    if (!spots.length) label.textContent = "🔴 尚無已核實座標的景點";
    else {
      const total = filteredSpots.length;
      const shown = Math.min(visibleCount, total);
      const prefix = this.activeCitySpotCategory === "all" ? "🔴 地圖景點" : `🔴 ${this.activeCitySpotCategory}`;
      label.textContent = shown < total
        ? `${prefix}：顯示 ${shown} / ${total} 個・移動或放大可查看更多`
        : `${prefix}：${total} 個`;
    }
  }
  fitCityContext(city, animate = true) {
    if (!this.map || this.currentCityContext?.id !== city.id) return;
    const spotPoints = this.geojson.spots.features
      .filter(item => item.properties?.kind === "spot")
      .map(item => item.geometry.coordinates);
    const points = [[city.lng, city.lat], ...spotPoints, ...this.geojson.airports.features.map(item => item.geometry.coordinates)];
    if (points.length < 2) {
      this.flyToCity(city.lat, city.lng, 11, { animate });
      return;
    }
    const bounds = points.reduce((b, point) => b.extend(point), new window.maplibregl.LngLatBounds(points[0], points[0]));
    if (!bounds.isEmpty()) {
      const padding = this.isCoarsePointer ? 48 : 68;
      if (this.map.getZoom() < 6 && this.animateAllowed(animate)) {
        const camera = this.map.cameraForBounds(bounds, { padding, maxZoom: 11 });
        if (camera) {
          this.map.stop();
          this.map.flyTo({ ...camera, speed: 1.2, curve: 1.4, essential: false });
        } else this.map.fitBounds(bounds, { padding, maxZoom: 11, duration: 900, essential: false });
      } else this.map.fitBounds(bounds, { padding, maxZoom: 11, duration: this.animateAllowed(animate) ? 850 : 0, essential: false });
    }
    else this.flyToCity(city.lat, city.lng, 11, { animate });
  }
  showFlightRoute(destination, hasDirect = false) {
    this.geojson.routes = this.emptyCollection();
    if (!destination || !Number.isFinite(destination.lat) || !Number.isFinite(destination.lng)) { this.syncSource("routes"); return; }
    const origin = this.flightOrigin;
    const destinationPoint = [destination.lat, destination.lng];
    const stops = hasDirect ? [origin, destinationPoint] : [origin, this.getTransitHub(destination), destinationPoint];
    const routeFeatures = [];
    const nearestAirport = this.getAirportData(destination).map(airport => ({ airport, distance: this.distanceKm([destination.lng, destination.lat], [airport.lng, airport.lat]) })).sort((a, b) => a.distance - b.distance)[0];
    if (nearestAirport) routeFeatures.push(this.lineFeature("airport-city-context", [[destination.lng, destination.lat], [nearestAirport.airport.lng, nearestAirport.airport.lat]], { kind: "airport-city", distanceKm: Math.round(nearestAirport.distance) }));
    for (let segment = 0; segment < stops.length - 1; segment += 1) {
      const arcParts = this.createFlightArc(stops[segment], stops[segment + 1]);
      arcParts.forEach((coordinates, partIndex) => routeFeatures.push(this.lineFeature(`flight-route-${segment}-${partIndex}`, coordinates, {
        kind: hasDirect ? "direct-flight" : "transit-flight",
        segment: segment + 1,
        label: partIndex === 0 && hasDirect && destination.flightInfo?.flightTime ? `TPE → ${destination.name} · ${destination.flightInfo.flightTime}` : ""
      })));
    }
    this.geojson.routes.features = routeFeatures;
    this.syncSource("routes");
  }
  getTransitHub(destination) {
    const lng = Number(destination.lng);
    if (lng >= 95 && lng <= 145) return [37.46, 126.441]; // Seoul / Incheon
    if (lng > 45 && lng < 95) return [25.253, 55.365]; // Dubai
    if (lng <= 45 && lng >= -20) return [25.273, 51.608]; // Doha
    if (lng < -20 && lng > -100) return [33.942, -118.408]; // Los Angeles
    if (lng <= -100) return [49.194, -123.184]; // Vancouver
    return [-6.125, 106.655]; // Jakarta
  }
  createFlightArc(from, to) {
    const fromLat = Number(from?.[0]), fromLng = Number(from?.[1]);
    const toLat = Number(to?.[0]), toLng = Number(to?.[1]);
    if (![fromLat, fromLng, toLat, toLng].every(Number.isFinite)) return [];
    const latitudeDelta = toLat - fromLat;
    const longitudeDelta = ((toLng - fromLng + 540) % 360) - 180;
    const unwrappedEndLng = fromLng + longitudeDelta;
    const mid = [
      (fromLat + toLat) / 2 + Math.min(18, Math.max(7, Math.abs(latitudeDelta) * 0.08)),
      (fromLng + unwrappedEndLng) / 2
    ];
    const points = [];
    for (let i = 0; i <= 24; i += 1) {
      const x = i / 24;
      const y = 1 - x;
      const lat = y * y * fromLat + 2 * y * x * mid[0] + x * x * toLat;
      const lng = y * y * fromLng + 2 * y * x * mid[1] + x * x * unwrappedEndLng;
      points.push({ lng, lat });
    }
    const normalizeLongitude = lng => ((lng + 180) % 360 + 360) % 360 - 180;
    const parts = [[[normalizeLongitude(points[0].lng), points[0].lat]]];
    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1], current = points[index];
      const previousWorld = Math.floor((previous.lng + 180) / 360);
      const currentWorld = Math.floor((current.lng + 180) / 360);
      if (previousWorld === currentWorld) {
        parts[parts.length - 1].push([normalizeLongitude(current.lng), current.lat]);
        continue;
      }
      const eastbound = current.lng > previous.lng;
      const boundary = eastbound ? 180 + previousWorld * 360 : -180 + previousWorld * 360;
      const ratio = (boundary - previous.lng) / (current.lng - previous.lng);
      const crossingLatitude = previous.lat + ratio * (current.lat - previous.lat);
      parts[parts.length - 1].push([eastbound ? 180 : -180, crossingLatitude]);
      parts.push([[eastbound ? -180 : 180, crossingLatitude], [normalizeLongitude(current.lng), current.lat]]);
    }
    return parts.filter(part => part.length > 1);
  }
  clearFlightRoute() { this.geojson.routes = this.emptyCollection(); this.syncSource("routes"); }
  flyToWorld({ animate = true } = {}) {
    if (!this.map) return;
    this.currentCityContext = null; this.clearCitySpots(); this.clearFlightRoute(); this.updateMarkersVisibility();
    const options = { center: [this.defaultCenter[1], this.defaultCenter[0]], zoom: this.initialZoom || this.defaultZoom, duration: this.animateAllowed(animate) ? 850 : 0, essential: false };
    this.map.stop(); if (options.duration) this.map.flyTo(options); else this.map.jumpTo(options);
  }
  setProjection(mode) {
    if (!this.map) return false;
    const type = mode === "globe" ? "globe" : "mercator";
    try { this.map.setProjection({ type }); } catch (error) { console.warn("切換地圖投影失敗：", error); return false; }
    this.projectionMode = type; this.tiltedView = type === "globe";
    this.map.easeTo({ pitch: 0, bearing: 0, duration: this.animateAllowed(true) ? 450 : 0 });
    return true;
  }
  focusCoordinates(latitude, longitude, zoom = 8.5, label = "") {
    const lat = Number(latitude), lng = Number(longitude);
    if (!this.map || !Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
    this.map.stop();
    this.map.flyTo({ center: [lng, lat], zoom: Math.max(2, Math.min(13, Number(zoom) || 8.5)), pitch: 0, speed: 1.2, curve: 1.4, essential: false });
    if (label && window.maplibregl?.Popup) {
      const safeLabel = this.escapePopupText(label);
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${label} ${lat},${lng}`)}`;
      this.showMapPopup("world-highlight", new window.maplibregl.Popup({ closeButton: true, maxWidth: "280px" }).setLngLat([lng, lat])
        .setHTML(`<div class="map-feature-popup"><strong>${safeLabel}</strong><p>名錄位置為探索參考；部分歷史遺址座標為近似位置。</p><a href="${mapsUrl}" target="_blank" rel="noopener noreferrer">在 Google 地圖開啟</a></div>`));
    }
    return true;
  }
  toggleProjection() { this.setProjection(this.tiltedView ? "mercator" : "globe"); return this.tiltedView; }
  zoomIn() {
    if (!this.map) return;
    if (this.currentCityContext) this.cityContextUserInteracted = true;
    this.map.zoomIn({ duration: this.animateAllowed(true) ? 250 : 0 });
  }
  zoomOut() {
    if (!this.map) return;
    if (this.currentCityContext) this.cityContextUserInteracted = true;
    if (this.currentCityContext && this.map.getZoom() - 1 <= this.cityContextExitZoom) this.cityContextZoomOutPending = true;
    this.map.zoomOut({ duration: this.animateAllowed(true) ? 250 : 0 });
  }
  invalidateSize() { if (!this.map || this.invalidateSizeTimer !== null) return; this.invalidateSizeTimer = window.setTimeout(() => { this.invalidateSizeTimer = null; this.map?.resize(); }, 80); }
  recordCurrentView(scope) {
    if (!this.map || !window.AppStore || this.map.isMoving()) return;
    const center = this.map.getCenter(); window.AppStore.saveMapView(scope, [center.lat, center.lng], this.map.getZoom());
  }
  restoreSavedView(scope, { animate = true } = {}) {
    if (!this.map || !window.AppStore) return false;
    const saved = window.AppStore.getSavedMapView(scope);
    if (!saved || !Array.isArray(saved.center) || saved.center.length !== 2 || !saved.center.every(Number.isFinite) || !Number.isFinite(saved.zoom)) return false;
    const options = { center: [saved.center[1], saved.center[0]], zoom: saved.zoom, duration: this.animateAllowed(animate) ? 800 : 0 };
    this.map.stop(); if (options.duration) this.map.flyTo(options); else this.map.jumpTo(options); return true;
  }
}
window.MapManager = MapManager;
