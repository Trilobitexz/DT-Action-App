// MapLibre GL JS 單一地圖引擎：Mercator 與 globe 投影共用向量圖層及互動狀態。
class MapManager {
  static MAX_CITY_SPOT_MARKERS = 50;

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
    this.globalCityDomMarkers = new Map();
    this.cityContextDomMarkers = new Map();
    this.continentDomMarkers = new Map();
    this.localCityDomMarkers = new Map();
    this.globalCityMarkerSignature = "";
    this.overviewMarkerSignature = "";
    this.currentCityContext = null;
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
    const dayColors = ["#b65337", "#247a78", "#6f62a8", "#bd7a24", "#3e789c", "#a44868", "#64783d"];
    const dayColorExpression = ["match", ["get", "dayIndex"], ...dayColors.flatMap((color, index) => [index, color]), "#b65337"];
    this.map.addLayer({ id: "itinerary-route-line", type: "line", source: "itinerary", filter: ["==", ["get", "kind"], "route"], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": dayColorExpression, "line-width": 3, "line-opacity": 0.82, "line-dasharray": [2, 2] } });
    this.map.addLayer({ id: "itinerary-stop-circles", type: "circle", source: "itinerary", filter: ["==", ["get", "kind"], "stop"], paint: { "circle-radius": 13, "circle-color": dayColorExpression, "circle-stroke-color": "#ffffff", "circle-stroke-width": 2.5 } });
    this.map.addLayer({ id: "itinerary-stop-labels", type: "symbol", source: "itinerary", filter: ["==", ["get", "kind"], "stop"], layout: { "text-field": ["get", "number"], "text-size": 11, "text-font": ["Noto Sans Bold"], "text-allow-overlap": true }, paint: { "text-color": "#ffffff" } });
    this.map.addLayer({ id: "continent-symbols", type: "symbol", source: "continents", layout: { "text-field": ["get", "label"], "text-font": ["Noto Sans Regular"], "text-size": 13, "text-padding": 8, "text-allow-overlap": true, "text-ignore-placement": true }, paint: { "text-color": "#173847", "text-halo-color": "#ffffff", "text-halo-width": 2.5 } });
    this.map.addLayer({ id: "city-circles", type: "circle", source: "cities", layout: { visibility: "none" }, paint: { "circle-radius": 5, "circle-color": "#138b80", "circle-stroke-color": "#ffffff", "circle-stroke-width": 1.5 } });
    this.map.addLayer({ id: "city-symbols", type: "symbol", source: "cities", layout: { visibility: "none", "text-field": ["get", "label"], "text-font": ["Noto Sans Regular"], "text-size": 11, "text-offset": [0, 1.3], "text-anchor": "top", "text-optional": true }, paint: { "text-color": "#18544f", "text-halo-color": "#ffffff", "text-halo-width": 1.5 } });
    this.map.addLayer({ id: "global-city-clusters", type: "circle", source: "globalCities", filter: ["has", "point_count"], layout: { visibility: "none" }, paint: { "circle-color": "#176b5b", "circle-radius": ["step", ["get", "point_count"], 14, 10, 18, 30, 23], "circle-opacity": 0.9, "circle-stroke-width": 2, "circle-stroke-color": "#ffffff" } });
    this.map.addLayer({ id: "global-city-cluster-count", type: "symbol", source: "globalCities", filter: ["has", "point_count"], layout: { visibility: "none", "text-field": ["get", "point_count_abbreviated"], "text-size": 11 }, paint: { "text-color": "#ffffff" } });
    this.map.addLayer({ id: "global-city-symbols", type: "circle", source: "globalCities", filter: ["!", ["has", "point_count"]], layout: { visibility: "none" }, paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 3, 5, 6, 9, 9], "circle-color": "#2563eb", "circle-opacity": 0.96, "circle-stroke-color": "#ffffff", "circle-stroke-width": 1.6 } });
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
    const layers = ["continent-symbols", "city-circles", "city-symbols", "global-city-symbols", "global-city-labels", "global-city-clusters", "airport-circles"];
    const feature = this.map.queryRenderedFeatures(event.point, { layers: layers.filter(id => this.map.getLayer(id)) })[0];
    if (!feature) return;
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
    if (props.kind === "airport") new window.maplibregl.Popup({ maxWidth: "280px" }).setLngLat(feature.geometry.coordinates).setHTML(`<strong>${this.escapePopupText(props.name)}</strong><p>城市交通節點，建議出發前確認航班與接駁方式。</p>`).addTo(this.map);
  }

  setTileLayer(layerKey) {
    if (!this.map) return;
    layerKey = this.tileProviders[layerKey] ? layerKey : "voyager";
    const config = this.tileProviders[layerKey]; this.activeLayerKey = layerKey;
    this.map.getContainer().dataset.mapTheme = layerKey;
    const status = document.getElementById("map-load-status"); if (status) status.textContent = `${config.name}樣式載入中…`;
    this.layersReady = false;
    this.layerInstallAttempts = 0;
    this.map.setStyle(config.style, { diff: false });
    this.map.once("style.load", () => {
      if (this.activeLayerKey !== layerKey) return;
      this.layersReady = false;
      this.ensureLayersInstalled();
      if (status) status.textContent = "";
    });
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
    const showClusters = false;
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
      element.hidden = !world || !inViewport || overlaps;
      element.classList.toggle("labels-visible", world && zoom >= 3.0 && !overlaps);
      if (!element.hidden) accepted.push(point);
    });
  }
  applyCitySpotDensity(zoom = this.map?.getZoom() || 0) {
    if (!this.map || !this.currentCityContext) return;
    // Keep every location reachable while reducing overlapping pins at city scale.
    // At neighborhood zoom all pins return; at wider zoom keep a stable, spatially
    // distributed subset, recalculated as the map moves or zooms.
    const minDistance = zoom < 8 ? 64 : zoom < 9 ? 44 : zoom < 10 ? 28 : zoom < 11 ? 14 : 0;
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
      const overlaps = minDistance > 0 && accepted.some(other => {
        const dx = point.x - other.x;
        const dy = point.y - other.y;
        return dx * dx + dy * dy < minDistance * minDistance;
      });
      element.hidden = overlaps;
      if (!overlaps) accepted.push(point);
    });
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
        && spot.lat >= -90 && spot.lat <= 90 && spot.lng >= -180 && spot.lng <= 180;
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
    window.SpotService?.fetchNearbyPlaces(city, { radius: 20000, limit: 50 }).then(places => {
      if (requestId !== this.cityContextRequestId || this.currentCityContext?.id !== city.id || !Array.isArray(places)) return;
      const normalizeName = value => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").normalize("NFKC").trim().toLocaleLowerCase().replace(/[\s\p{P}]+/gu, "");
      const knownNames = new Set(sourceSpots.map(spot => normalizeName(spot.name)));
      let nextIndex = sourceSpots.length;
      places.forEach(spot => {
        if (this.geojson.spots.features.filter(feature => feature.properties?.kind === "spot").length >= MapManager.MAX_CITY_SPOT_MARKERS) return;
        if (!Number.isFinite(spot?.lat) || !Number.isFinite(spot?.lng) || spot.lat === 0 || spot.lng === 0
          || spot.lat < -90 || spot.lat > 90 || spot.lng < -180 || spot.lng > 180) return;
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
  showItineraryDay(city, itinerarySpots, dayIndex = 0) {
    if (!this.map || !city?.id || this.currentCityContext?.id !== city.id) return 0;
    const normalize = value => String(value || "").normalize("NFKC").trim().toLocaleLowerCase();
    const valid = (lat, lng) => lat !== null && lat !== undefined && lat !== "" && lng !== null && lng !== undefined && lng !== ""
      && Number.isFinite(Number(lat)) && Number(lat) >= -90 && Number(lat) <= 90
      && Number.isFinite(Number(lng)) && Number(lng) >= -180 && Number(lng) <= 180;
    const stops = (itinerarySpots || []).map(item => {
      const spot = item?.spot || item;
      let lat = Number(spot?.lat), lng = Number(spot?.lng);
      if (!valid(lat, lng)) {
        const entry = [...this.citySpotMarkers.values()].find(candidate => candidate.city?.id === city.id && normalize(candidate.spot?.name) === normalize(spot?.name) && candidate.feature);
        if (entry) [lng, lat] = entry.feature.geometry.coordinates;
      }
      return valid(lat, lng) ? { name: spot.name || "景點", coordinates: [lng, lat] } : null;
    }).filter(Boolean);
    this.geojson.itinerary = this.emptyCollection();
    if (!stops.length) { this.syncSource("itinerary"); return 0; }
    dayIndex = Math.max(0, Number(dayIndex) || 0);
    this.geojson.itinerary.features = stops.map((stop, index) => this.feature(`itinerary-stop-${index}`, stop.coordinates, { kind: "stop", number: String(index + 1), name: stop.name, dayIndex }));
    if (stops.length > 1) this.geojson.itinerary.features.unshift(this.lineFeature("itinerary-day-route", stops.map(stop => stop.coordinates), { kind: "route", dayIndex }));
    this.syncSource("itinerary");
    const bounds = stops.reduce((box, stop) => box.extend(stop.coordinates), new window.maplibregl.LngLatBounds(stops[0].coordinates, stops[0].coordinates));
    if (stops.length === 1) this.map.flyTo({ center: stops[0].coordinates, zoom: Math.max(13, this.map.getZoom()), duration: this.animateAllowed(true) ? 650 : 0, essential: false });
    else this.map.fitBounds(bounds, { padding: this.isCoarsePointer ? 56 : 84, maxZoom: 14, duration: this.animateAllowed(true) ? 700 : 0, essential: false });
    return stops.length;
  }
  clearItineraryRoute() { this.geojson.itinerary = this.emptyCollection(); this.syncSource("itinerary"); }
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
        if (markerType === "spot") {
          this.scrollToSpotCard(city.id, metadata.spotIndex);
          const zoom = this.activeLayerKey === "voyager" ? Math.max(14.2, this.map.getZoom()) : Math.max(13, this.map.getZoom());
          const camera = { center: coordinates, zoom, pitch: this.activeLayerKey === "voyager" ? 45 : this.map.getPitch(), speed: 1.2, curve: 1.4, essential: false };
          this.map.stop();
          if (this.animateAllowed(true)) this.map.flyTo(camera);
          else this.map.jumpTo({ center: coordinates, zoom, pitch: camera.pitch, essential: false });
        }
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
      new window.maplibregl.Popup({ maxWidth: "260px" }).setLngLat([city.lng, city.lat]).setHTML(`<strong>${this.escapePopupText(city.name)} ${placeLabel}</strong><p>${coordinateSource}</p>`).addTo(this.map);
    }, "center");
    this.geojson.spots.features.filter(feature => feature.properties.kind === "spot").forEach(feature => {
      const properties = feature.properties;
      addMarker(String(feature.id), feature.geometry.coordinates, "map-spot-marker", `<span class="spot-pin-number"><b>${Number(properties.index) + 1}</b></span><span class="map-context-landmark-label">${this.escapePopupText(properties.name)}</span>`, properties.name, () => this.openSpotPopup(feature), "spot", properties.category || "景點", { spotIndex: properties.index, featured: properties.isFeatured, featuredRank: properties.featuredRank });
    });
    this.geojson.airports.features.forEach(feature => {
      const properties = feature.properties;
      const distance = this.distanceKm([city.lng, city.lat], feature.geometry.coordinates);
      addMarker(String(feature.id), feature.geometry.coordinates, "map-airport-marker", `<span class="airport-pin">✈</span><span class="map-context-landmark-label">${this.escapePopupText(properties.name)}</span>`, properties.name, () => {
        new window.maplibregl.Popup({ maxWidth: "280px" }).setLngLat(feature.geometry.coordinates).setHTML(`<strong>${this.escapePopupText(properties.name)}</strong><p>距城市地標直線約 ${distance.toFixed(0)} 公里。實際進城方式與時間依交通工具及路況而異。</p>`).addTo(this.map);
      }, "airport");
    });
    this.refreshCitySpotCategoryFilter();
  }
  refreshCitySpotCategoryFilter() {
    const select = document.getElementById("map-spot-category-filter");
    if (!select) return;
    const categories = [...new Set([...this.cityContextDomMarkers.values()]
      .map(marker => marker.getElement())
      .filter(element => element.dataset.cityMarkerType === "spot")
      .map(element => element.dataset.spotCategory)
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
  }
  getAirportData(city) {
    if (!Array.isArray(city?.airports)) return [];
    return city.airports.filter(airport => Number.isFinite(airport.lat) && Number.isFinite(airport.lng)
      && airport.lat >= -90 && airport.lat <= 90 && airport.lng >= -180 && airport.lng <= 180
      && Boolean(this.safeExternalUrl(airport.sourceUrl)));
  }
  getCitySpots(city) {
    if (Array.isArray(city?.spots) && city.spots.length) return city.spots;
    if (Array.isArray(city?.spotCandidates) && city.spotCandidates.length) return city.spotCandidates;
    if (Array.isArray(city?.attractions) && city.attractions.length) {
      return city.attractions.map(name => typeof name === "string" ? { name } : name);
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
    const rating = hasRating ? `★ ${Number(spot.rating).toFixed(1)} · ${spot.ratingSource}` : "評分資料未提供";
    const sourceUrl = this.safeExternalUrl(spot.sourceUrl);
    const sourceLink = sourceUrl ? `<a href="${this.escapePopupText(sourceUrl)}" target="_blank" rel="noopener noreferrer">${this.escapePopupText(spot.sourceLabel || "資料來源")}</a>` : "";
    const address = spot.address ? `<span>地址：${this.escapePopupText(spot.address)}</span>` : "";
    const openingHours = spot.openingHours ? `<span>開放時間：${this.escapePopupText(spot.openingHours)}</span>` : "";
    const websiteUrl = this.safeExternalUrl(spot.website);
    const website = websiteUrl ? `<a href="${this.escapePopupText(websiteUrl)}" target="_blank" rel="noopener noreferrer">官方網站／資訊</a>` : "";
    return `<div class="map-spot-popup"><strong>#${index + 1} ${this.escapePopupText(detail?.title || spot.name)}</strong><span>${this.escapePopupText(spot.category || "景點")} · ${this.escapePopupText(rating)}</span><p>${this.escapePopupText(detail?.extract || spot.note || "尚無補充說明")}</p>${address}${openingHours}${website}${sourceLink}<button type="button" data-map-spot-index="${index}">查看景點詳細資訊</button></div>`;
  }
  openSpotPopup(feature) {
    const p = feature.properties || {}, entry = this.citySpotMarkers.get(`${p.cityId}:${p.index}`); if (!entry) return;
    const popup = new window.maplibregl.Popup({ closeButton: true, maxWidth: "300px" }).setLngLat(feature.geometry.coordinates).setHTML(this.createSpotPopup(entry.city, entry.spot, entry.index, entry.detail)).addTo(this.map);
    popup.getElement().querySelector("[data-map-spot-index]")?.addEventListener("click", () => {
      const card = document.querySelector(`[data-city-id="${entry.city.id}"][data-spot-index="${entry.index}"]`);
      card?.scrollIntoView({ behavior: this.prefersReducedMotion ? "auto" : "smooth", block: "center" }); card?.classList.add("spot-item-map-focus");
      window.setTimeout(() => card?.classList.remove("spot-item-map-focus"), 1600); popup.remove();
    });
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
    if (!Number.isFinite(loc?.latitude) || !Number.isFinite(loc?.longitude)
      || loc.latitude < -90 || loc.latitude > 90 || loc.longitude < -180 || loc.longitude > 180
      || loc.category === "city" || this.currentCityContext?.id !== cityId) return;
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
    if (button) button.disabled = !isMapped;
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
    const count = this.geojson.spots.features.filter(feature => feature.properties?.kind === "spot").length;
    const label = document.querySelector("#map-context-info .map-context-spot-count");
    if (label) label.textContent = count ? `🔴 地圖景點 ${count} 個` : "🔴 尚無已核實座標的景點";
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
      const coordinates = this.createFlightArc(stops[segment], stops[segment + 1]);
      routeFeatures.push(this.lineFeature(`flight-route-${segment}`, coordinates, {
        kind: hasDirect ? "direct-flight" : "transit-flight",
        segment: segment + 1
      }));
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
    const delta = to[1] - from[1];
    const mid = [(from[0] + to[0]) / 2 + Math.min(18, Math.max(7, Math.abs(delta) * 0.08)), from[1] + delta / 2];
    const coordinates = [];
    for (let i = 0; i <= 24; i += 1) {
      const x = i / 24;
      const y = 1 - x;
      const lat = y * y * from[0] + 2 * y * x * mid[0] + x * x * to[0];
      let lng = y * y * from[1] + 2 * y * x * mid[1] + x * x * to[1];
      if (lng > 180) lng -= 360;
      if (lng < -180) lng += 360;
      coordinates.push([lng, lat]);
    }
    return coordinates;
  }
  clearFlightRoute() { this.geojson.routes = this.emptyCollection(); this.syncSource("routes"); }
  flyToWorld({ animate = true } = {}) {
    if (!this.map) return;
    this.currentCityContext = null; this.clearCitySpots(); this.clearFlightRoute(); this.updateMarkersVisibility();
    const options = { center: [this.defaultCenter[1], this.defaultCenter[0]], zoom: this.initialZoom || this.defaultZoom, duration: this.animateAllowed(animate) ? 850 : 0, essential: false };
    this.map.stop(); if (options.duration) this.map.flyTo(options); else this.map.jumpTo(options);
  }
  setProjection(mode) {
    if (!this.map) return;
    const type = mode === "globe" ? "globe" : "mercator"; this.map.setProjection({ type }); this.tiltedView = type === "globe";
    this.map.easeTo({ pitch: 0, bearing: 0, duration: this.animateAllowed(true) ? 450 : 0 });
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
