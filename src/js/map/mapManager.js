// MapLibre GL JS 單一地圖引擎：Mercator 與 globe 投影共用向量圖層及互動狀態。
class MapManager {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.defaultCenter = options.center || [25, 10];
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
    this.currentCityContext = null;
    this.cityContextExitZoom = 5.8;
    this.cityContextExitPending = false;
    this.visibleCityUpdateFrame = null;
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
    this.geojson = { continents: this.emptyCollection(), cities: this.emptyCollection(), globalCities: this.emptyCollection(), spots: this.emptyCollection(), airports: this.emptyCollection(), routes: this.emptyCollection() };
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
    this.map = new window.maplibregl.Map({
      container, style: this.tileProviders.voyager.style,
      center: [this.defaultCenter[1], this.defaultCenter[0]], zoom: this.defaultZoom,
      minZoom: 1.5, maxZoom: 18, projection: { type: "mercator" },
      renderWorldCopies: true, attributionControl: false,
      canvasContextAttributes: { antialias: false, preserveDrawingBuffer: false }, fadeDuration: 0
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
    });
    this.map.on("idle", () => {
      if (!this.layersReady) this.ensureLayersInstalled();
    });
    this.map.on("moveend", () => this.scheduleVisibleCityUpdate());
    this.map.on("zoomend", () => {
      this.updateMarkersVisibility();
      this.scheduleVisibleCityUpdate();
      this.handleCityContextZoom();
    });
    this.map.on("click", event => this.handleMapClick(event));
    ["continent-symbols", "city-circles", "city-symbols", "global-city-symbols", "global-city-labels"].forEach(layer => {
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
    this.map.addLayer({ id: "route-lines", type: "line", source: "routes", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": ["match", ["get", "kind"], "transit-flight", "#f59e0b", "#0f766e"], "line-width": ["match", ["get", "kind"], "transit-flight", 3, 2.5], "line-opacity": 0.9, "line-dasharray": [2, 2] } });
    this.map.addLayer({ id: "continent-symbols", type: "symbol", source: "continents", layout: { "text-field": ["get", "label"], "text-font": ["Noto Sans Regular"], "text-size": 13, "text-padding": 8, "text-allow-overlap": true, "text-ignore-placement": true }, paint: { "text-color": "#173847", "text-halo-color": "#ffffff", "text-halo-width": 2.5 } });
    this.map.addLayer({ id: "city-circles", type: "circle", source: "cities", layout: { visibility: "none" }, paint: { "circle-radius": 5, "circle-color": "#138b80", "circle-stroke-color": "#ffffff", "circle-stroke-width": 1.5 } });
    this.map.addLayer({ id: "city-symbols", type: "symbol", source: "cities", layout: { visibility: "none", "text-field": ["get", "label"], "text-font": ["Noto Sans Regular"], "text-size": 11, "text-offset": [0, 1.3], "text-anchor": "top", "text-optional": true }, paint: { "text-color": "#18544f", "text-halo-color": "#ffffff", "text-halo-width": 1.5 } });
    this.map.addLayer({ id: "global-city-clusters", type: "circle", source: "globalCities", filter: ["has", "point_count"], layout: { visibility: "none" }, paint: { "circle-color": "#2563eb", "circle-radius": ["step", ["get", "point_count"], 13, 10, 17, 30, 21], "circle-opacity": 0.86, "circle-stroke-width": 2, "circle-stroke-color": "#ffffff" } });
    this.map.addLayer({ id: "global-city-cluster-count", type: "symbol", source: "globalCities", filter: ["has", "point_count"], layout: { visibility: "none", "text-field": ["get", "point_count_abbreviated"], "text-size": 11 }, paint: { "text-color": "#ffffff" } });
    this.map.addLayer({ id: "global-city-symbols", type: "circle", source: "globalCities", filter: ["!", ["has", "point_count"]], layout: { visibility: "none" }, paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 3, 5, 6, 9, 9], "circle-color": "#2563eb", "circle-opacity": 0.96, "circle-stroke-color": "#ffffff", "circle-stroke-width": 1.6 } });
    this.map.addLayer({ id: "global-city-labels", type: "symbol", source: "globalCities", filter: ["!", ["has", "point_count"]], layout: { visibility: "none", "text-field": ["get", "label"], "text-font": ["Noto Sans Regular"], "text-size": ["step", ["zoom"], 0, 3.3, 9, 5.2, 11], "text-offset": [0, 1.1], "text-anchor": "top", "text-optional": true, "text-allow-overlap": false }, paint: { "text-color": "#1e3a8a", "text-halo-color": "#ffffff", "text-halo-width": 1.6 } });
    this.map.addLayer({ id: "spot-circles", type: "circle", source: "spots", filter: ["!=", ["get", "kind"], "center"], paint: { "circle-radius": 8, "circle-color": "#d3483c", "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 } });
    this.map.addLayer({ id: "spot-labels", type: "symbol", source: "spots", filter: ["!=", ["get", "kind"], "center"], layout: { "text-field": ["get", "label"], "text-size": 11, "text-offset": [0, 1.1], "text-anchor": "top", "text-optional": true }, paint: { "text-color": "#7f2927", "text-halo-color": "#ffffff", "text-halo-width": 1.5 } });
    this.map.addLayer({ id: "city-center", type: "circle", source: "spots", filter: ["==", ["get", "kind"], "center"], paint: { "circle-radius": 7, "circle-color": "#1689bb", "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 } });
    this.map.addLayer({ id: "airport-circles", type: "circle", source: "airports", paint: { "circle-radius": 8, "circle-color": "#0f766e", "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 } });
    this.map.addLayer({ id: "airport-labels", type: "symbol", source: "airports", layout: { "text-field": ["get", "label"], "text-size": 10, "text-offset": [0, 1.1], "text-anchor": "top", "text-optional": true }, paint: { "text-color": "#125a55", "text-halo-color": "#ffffff", "text-halo-width": 1.5 } });
    this.layersReady = true;
    this.renderContinentMarkers(); this.renderCityMarkers(); this.updateMarkersVisibility();
    this.renderGlobalCityDomMarkers();
    this.renderOverviewDomMarkers();
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
    const layers = ["continent-symbols", "city-circles", "city-symbols", "global-city-symbols", "global-city-labels", "global-city-clusters", "spot-circles", "airport-circles"];
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
      const lat = Number(city.lat);
      const lng = Number(city.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) this.geojson.globalCities.features.push(this.feature(city.id, [lng, lat], { kind: "global-city", cityId: city.id, label: `${city.flag || ""} ${city.name}`.trim(), name: city.name, country: city.countryName || "" }));
    });
    this.geojson.cities = this.emptyCollection();
    (window.TRAVEL_DATA?.countries || []).forEach(country => (country.cities || []).forEach(city => {
      if (this.hasGlobalCity(city, country.name)) return;
      const lat = Number(city.lat);
      const lng = Number(city.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) this.geojson.cities.features.push(this.feature(city.id, [lng, lat], { kind: "local-city", cityId: city.id, countryId: country.id, continentId: country.continentId, label: `${country.flag || ""} ${city.name}`.trim() }));
    }));
    this.syncSource("globalCities"); this.syncSource("cities");
  }
  renderGlobalCityDomMarkers() {
    if (!this.map || !window.maplibregl) return;
    this.globalCityDomMarkers.forEach(marker => marker.remove());
    this.globalCityDomMarkers.clear();
    this.getGlobalCityList().forEach(city => {
      const lat = Number(city.lat);
      const lng = Number(city.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const element = document.createElement("button");
      element.type = "button";
      element.className = `map-global-city-marker city-tier-${this.getCityTier(city)}`;
      element.title = `${city.name} (${city.countryName || ""})`;
      element.innerHTML = `<span class="map-global-city-dot"></span><span class="map-global-city-label">${this.escapePopupText(`${city.flag || ""} ${city.name}`.trim())}</span>`;
      element.addEventListener("click", event => {
        event.stopPropagation();
        this.onGlobalCitySelect(city.id);
      });
      const marker = new window.maplibregl.Marker({ element, anchor: "center" }).setLngLat([lng, lat]).addTo(this.map);
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
  renderOverviewDomMarkers() {
    if (!this.map || !window.maplibregl) return;
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
    (window.TRAVEL_DATA?.countries || []).forEach(country => (country.cities || []).forEach(city => {
      if (this.hasGlobalCity(city, country.name)) return;
      const lat = Number(city.lat);
      const lng = Number(city.lng);
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
      this.visibleCityUpdateFrame = null; if (!this.map || !this.layersReady) return;
      ["global-city-clusters", "global-city-cluster-count", "global-city-symbols", "global-city-labels"].forEach(id => this.map.getLayer(id)?.setLayoutProperty("visibility", "none"));
    });
  }
  updateVisibleGlobalCities() { this.scheduleVisibleCityUpdate(); }
  updateMarkersVisibility() {
    if (!this.map || !this.layersReady) return;
    const world = !this.currentCityContext, zoom = this.map.getZoom();
    this.map.getLayer("continent-symbols")?.setLayoutProperty("visibility", world && zoom < 3.4 ? "visible" : "none");
    ["city-circles", "city-symbols"].forEach(id => this.map.getLayer(id)?.setLayoutProperty("visibility", "none"));
    ["global-city-symbols", "global-city-labels", "global-city-clusters", "global-city-cluster-count"].forEach(id => this.map.getLayer(id)?.setLayoutProperty("visibility", "none"));
    this.globalCityDomMarkers.forEach(marker => {
      const element = marker.getElement();
      const tier = element.classList.contains("city-tier-major") ? "major" : element.classList.contains("city-tier-medium") ? "medium" : "small";
      const minimumZoom = tier === "major" ? 2.2 : tier === "medium" ? 3.2 : 4.6;
      element.hidden = !world || zoom < minimumZoom;
      element.classList.toggle("labels-visible", zoom >= (tier === "major" ? 2.8 : tier === "medium" ? 3.8 : 5.2));
    });
    this.cityContextDomMarkers.forEach(marker => {
      marker.getElement().hidden = !this.currentCityContext;
      marker.getElement().classList.toggle("labels-visible", Boolean(this.currentCityContext) && zoom >= 7.5);
    });
    this.continentDomMarkers.forEach(marker => {
      marker.getElement().hidden = !world || zoom >= 3.4;
    });
    this.localCityDomMarkers.forEach(marker => {
      const element = marker.getElement();
      const tier = element.classList.contains("city-tier-major") ? "major" : element.classList.contains("city-tier-medium") ? "medium" : "small";
      const minimumZoom = tier === "major" ? 4.0 : tier === "medium" ? 4.6 : 5.2;
      element.hidden = !world || zoom < minimumZoom;
      element.classList.toggle("labels-visible", zoom >= (tier === "major" ? 3.8 : tier === "medium" ? 4.7 : 5.8));
    });
    this.scheduleVisibleCityUpdate();
  }
  handleCityContextZoom() {
    if (!this.currentCityContext || this.cityContextExitPending || !this.map) return;
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
    this.map.stop(); const opts = { center: [lng, lat], zoom, duration: this.animateAllowed(animate) ? (this.isCoarsePointer ? 700 : 1000) : 0, essential: false };
    if (opts.duration) this.map.flyTo(opts); else this.map.jumpTo(opts);
  }
  showCityContext(city, { animate = true } = {}) {
    if (!this.map || !city || !Number.isFinite(city.lat) || !Number.isFinite(city.lng)) return;
    this.currentCityContext = city; this.cityContextExitPending = false; this.clearCitySpots();
    const sourceSpots = this.getCitySpots(city);
    const spots = [];
    sourceSpots.forEach((spot, index) => {
      const hasCoords = Number.isFinite(spot.lat) && Number.isFinite(spot.lng)
        && spot.lat >= -90 && spot.lat <= 90 && spot.lng >= -180 && spot.lng <= 180;
      const feature = hasCoords
        ? this.feature(`${city.id}-spot-${index}`, [spot.lng, spot.lat], { kind: "spot", cityId: city.id, index, name: spot.name, label: `${index + 1}. ${spot.name}`, category: spot.category || "景點", rating: spot.rating || "—", note: spot.note || "", approximate: false })
        : null;
      this.citySpotMarkers.set(`${city.id}:${index}`, { feature, city, spot, index });
      if (feature) spots.push(feature);
      else window.SpotService?.fetchSpotDetail(spot.name, city.name, city)
        .then(detail => this.updateSpotDetail(city.id, index, detail))
        .catch(error => console.warn(`無法定位「${spot.name}」：`, error));
    });
    window.SpotService?.fetchNearbyPlaces(city).then(places => {
      if (this.currentCityContext?.id !== city.id || !Array.isArray(places)) return;
      const normalizeName = value => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").normalize("NFKC").trim().toLocaleLowerCase().replace(/[\s\p{P}]+/gu, "");
      const knownNames = new Set(sourceSpots.map(spot => normalizeName(spot.name)));
      let nextIndex = sourceSpots.length;
      places.forEach(spot => {
        const name = normalizeName(spot.name);
        if (!name || knownNames.has(name)) return;
        knownNames.add(name);
        const index = nextIndex++;
        const feature = this.feature(`${city.id}-osm-${spot.osmId}`, [spot.lng, spot.lat], {
          kind: "spot", cityId: city.id, index, name: spot.name,
          label: `${index + 1}. ${spot.name}`, category: spot.category || "景點",
          rating: "—", note: spot.note, sourceId: spot.sourceId, sourceUrl: spot.sourceUrl,
          sourceLabel: spot.sourceLabel, approximate: false
        });
        this.citySpotMarkers.set(`${city.id}:${index}`, { feature, city, spot, index });
        this.geojson.spots.features.push(feature);
      });
      this.syncSource("spots");
      this.renderCityContextDomMarkers();
      this.updateMarkersVisibility();
      const spotCountLabel = document.querySelector("#map-context-info .map-context-spot-count");
      if (spotCountLabel) {
        const count = this.geojson.spots.features.filter(feature => feature.properties?.kind === "spot").length;
        spotCountLabel.textContent = `🔴 地圖景點 ${count} 個`;
      }
    }).catch(error => console.warn(`無法載入 ${city.name} 的開放地圖景點：`, error));
    const centerLabel = city.destinationType === "island" ? `${city.name} 島嶼地名點` : `${city.name} 地名參考點`;
    this.geojson.spots = { type: "FeatureCollection", features: [{ type: "Feature", id: `${city.id}-center`, properties: { kind: "center", cityId: city.id, label: centerLabel }, geometry: { type: "Point", coordinates: [city.lng, city.lat] } }, ...spots] };
    this.geojson.airports = { type: "FeatureCollection", features: this.getAirportData(city).filter(a => Number.isFinite(a.lat) && Number.isFinite(a.lng)).map((a, i) => this.feature(`${city.id}-airport-${i}`, [a.lng, a.lat], { kind: "airport", name: `${a.name} (${a.code})`, label: `✈ ${a.code}` })) };
    this.syncSource("spots"); this.syncSource("airports"); this.geojson.routes = this.emptyCollection(); this.syncSource("routes");
    this.renderCityContextDomMarkers();
    this.updateMarkersVisibility();
    this.map.resize();
    this.fitCityContext(city, animate);
  }
  restoreOverviewMarkers() {
    this.currentCityContext = null; this.cityContextExitPending = false; this.clearCitySpots(); this.geojson.routes = this.emptyCollection(); this.syncSource("routes"); this.updateMarkersVisibility();
  }
  clearCitySpots() {
    this.citySpotMarkers.clear(); this.geojson.spots = this.emptyCollection(); this.geojson.airports = this.emptyCollection();
    this.cityContextDomMarkers.forEach(marker => marker.remove());
    this.cityContextDomMarkers.clear();
    this.syncSource("spots"); this.syncSource("airports");
  }
  renderCityContextDomMarkers() {
    if (!this.map || !window.maplibregl) return;
    this.cityContextDomMarkers.forEach(marker => marker.remove());
    this.cityContextDomMarkers.clear();
    const addMarker = (key, coordinates, className, content, title, onClick) => {
      const element = document.createElement("button");
      element.type = "button";
      element.className = `${className} map-context-landmark`;
      element.title = title;
      element.innerHTML = content;
      element.addEventListener("click", event => {
        event.stopPropagation();
        onClick?.();
      });
      const marker = new window.maplibregl.Marker({ element, anchor: "center", subpixelPositioning: true }).setLngLat(coordinates).addTo(this.map);
      this.cityContextDomMarkers.set(key, marker);
    };
    const city = this.currentCityContext;
    const placeLabel = city.destinationType === "island" ? "島嶼地名參考點" : "地名參考點";
    const coordinateSource = city.coordinateSource?.sourceUrl
      ? `<a href="${this.escapePopupText(city.coordinateSource.sourceUrl)}" target="_blank" rel="noopener noreferrer">GeoNames 來源資料</a>`
      : "座標來源尚未交叉核對";
    addMarker(`${city.id}-center`, [city.lng, city.lat], "map-city-center-marker", `<span class="city-center-pin">●</span>`, `${city.name} ${placeLabel}`, () => {
      new window.maplibregl.Popup({ maxWidth: "260px" }).setLngLat([city.lng, city.lat]).setHTML(`<strong>${this.escapePopupText(city.name)} ${placeLabel}</strong><p>${coordinateSource}</p>`).addTo(this.map);
    });
    this.geojson.spots.features.filter(feature => feature.properties.kind === "spot").forEach(feature => {
      const properties = feature.properties;
      addMarker(String(feature.id), feature.geometry.coordinates, "map-spot-marker", `<span class="spot-pin-number"><b>${Number(properties.index) + 1}</b></span><span class="map-context-landmark-label">${this.escapePopupText(properties.name)}</span>`, properties.name, () => this.openSpotPopup(feature));
    });
    this.geojson.airports.features.forEach(feature => {
      const properties = feature.properties;
      addMarker(String(feature.id), feature.geometry.coordinates, "map-airport-marker", `<span class="airport-pin">✈</span><span class="map-context-landmark-label">${this.escapePopupText(properties.name)}</span>`, properties.name, () => {
        new window.maplibregl.Popup({ maxWidth: "280px" }).setLngLat(feature.geometry.coordinates).setHTML(`<strong>${this.escapePopupText(properties.name)}</strong><p>城市交通節點，建議出發前確認航班與接駁方式。</p>`).addTo(this.map);
      });
    });
  }
  getAirportData(city) {
    if (Array.isArray(city.airports) && city.airports.length) return city.airports;
    const catalog = {
      "東京": [{ name: "成田國際機場", code: "NRT", lat: 35.772, lng: 140.392 }, { name: "羽田機場", code: "HND", lat: 35.549, lng: 139.779 }],
      "大阪": [{ name: "關西國際機場", code: "KIX", lat: 34.434, lng: 135.244 }], "京都": [{ name: "關西國際機場", code: "KIX", lat: 34.434, lng: 135.244 }],
      "首爾": [{ name: "仁川國際機場", code: "ICN", lat: 37.46, lng: 126.441 }, { name: "金浦機場", code: "GMP", lat: 37.558, lng: 126.791 }],
      "曼谷": [{ name: "蘇凡納布國際機場", code: "BKK", lat: 13.69, lng: 100.75 }], "新加坡": [{ name: "樟宜機場", code: "SIN", lat: 1.364, lng: 103.991 }],
      "巴黎": [{ name: "戴高樂機場", code: "CDG", lat: 49.009, lng: 2.548 }, { name: "奧利機場", code: "ORY", lat: 48.726, lng: 2.365 }],
      "倫敦": [{ name: "希斯洛機場", code: "LHR", lat: 51.47, lng: -0.454 }], "雪梨": [{ name: "雪梨機場", code: "SYD", lat: -33.946, lng: 151.177 }],
      "洛杉磯": [{ name: "洛杉磯國際機場", code: "LAX", lat: 33.942, lng: -118.408 }], "紐約": [{ name: "甘迺迪國際機場", code: "JFK", lat: 40.6413, lng: -73.7781 }, { name: "紐華克自由國際機場", code: "EWR", lat: 40.6895, lng: -74.1745 }, { name: "拉瓜迪亞機場", code: "LGA", lat: 40.7769, lng: -73.874 }],
      "舊金山": [{ name: "舊金山國際機場", code: "SFO", lat: 37.621, lng: -122.379 }]
    };
    if (catalog[city.name]) return catalog[city.name];
    return [];
  }
  getCitySpots(city) {
    if (Array.isArray(city?.spots) && city.spots.length) return city.spots;
    if (Array.isArray(city?.attractions) && city.attractions.length) {
      return city.attractions.map(name => typeof name === "string" ? { name } : name);
    }
    return [];
  }
  escapePopupText(value) { return String(value || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  createSpotPopup(city, spot, index, detail = null) {
    const rating = spot.ratingSource ? `★ ${spot.rating} · ${spot.ratingSource}` : "評分資料未提供";
    const sourceLink = spot.sourceUrl ? `<a href="${this.escapePopupText(spot.sourceUrl)}" target="_blank" rel="noopener noreferrer">${this.escapePopupText(spot.sourceLabel || "資料來源")}</a>` : "";
    return `<div class="map-spot-popup"><strong>#${index + 1} ${this.escapePopupText(detail?.title || spot.name)}</strong><span>${this.escapePopupText(spot.category || "景點")} · ${this.escapePopupText(rating)}</span><p>${this.escapePopupText(detail?.extract || spot.note || "尚無補充說明")}</p>${sourceLink}<button type="button" data-map-spot-index="${index}">查看景點詳細資訊</button></div>`;
  }
  openSpotPopup(feature) {
    const p = feature.properties || {}, entry = this.citySpotMarkers.get(`${p.cityId}:${p.index}`); if (!entry) return;
    const popup = new window.maplibregl.Popup({ closeButton: true, maxWidth: "300px" }).setLngLat(feature.geometry.coordinates).setHTML(this.createSpotPopup(entry.city, entry.spot, entry.index)).addTo(this.map);
    popup.getElement().querySelector("[data-map-spot-index]")?.addEventListener("click", () => {
      const card = document.querySelector(`[data-city-id="${entry.city.id}"][data-spot-index="${entry.index}"]`);
      card?.scrollIntoView({ behavior: this.prefersReducedMotion ? "auto" : "smooth", block: "center" }); card?.classList.add("spot-item-map-focus");
      window.setTimeout(() => card?.classList.remove("spot-item-map-focus"), 1600); popup.remove();
    });
  }
  updateSpotDetail(cityId, index, detail) {
    const entry = this.citySpotMarkers.get(`${cityId}:${index}`); if (!entry || !detail) return;
    const loc = detail.location;
    if (!Number.isFinite(loc?.latitude) || !Number.isFinite(loc?.longitude)
      || loc.latitude < -90 || loc.latitude > 90 || loc.longitude < -180 || loc.longitude > 180
      || loc.category === "city" || this.currentCityContext?.id !== cityId) return;
    entry.spot.lat = loc.latitude; entry.spot.lng = loc.longitude;
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
  }
  fitCityContext(city, animate = true) {
    if (!this.map || this.currentCityContext?.id !== city.id) return;
    const points = [[city.lng, city.lat], ...this.geojson.spots.features.map(item => item.geometry.coordinates), ...this.geojson.airports.features.map(item => item.geometry.coordinates)];
    if (points.length < 2) {
      this.flyToCity(city.lat, city.lng, 11, { animate });
      return;
    }
    const bounds = points.reduce((b, point) => b.extend(point), new window.maplibregl.LngLatBounds(points[0], points[0]));
    if (!bounds.isEmpty()) this.map.fitBounds(bounds, { padding: this.isCoarsePointer ? 48 : 68, maxZoom: 11, duration: this.animateAllowed(animate) ? 900 : 0, essential: false });
    else this.flyToCity(city.lat, city.lng, 11, { animate });
  }
  showFlightRoute(destination, hasDirect = false) {
    this.geojson.routes = this.emptyCollection();
    if (!destination || !Number.isFinite(destination.lat) || !Number.isFinite(destination.lng)) { this.syncSource("routes"); return; }
    const origin = this.flightOrigin;
    const destinationPoint = [destination.lat, destination.lng];
    const stops = hasDirect ? [origin, destinationPoint] : [origin, this.getTransitHub(destination), destinationPoint];
    const routeFeatures = [];
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
    const options = { center: [this.defaultCenter[1], this.defaultCenter[0]], zoom: this.defaultZoom, duration: this.animateAllowed(animate) ? 850 : 0, essential: false };
    this.map.stop(); if (options.duration) this.map.flyTo(options); else this.map.jumpTo(options);
  }
  setProjection(mode) {
    if (!this.map) return;
    const type = mode === "globe" ? "globe" : "mercator"; this.map.setProjection({ type }); this.tiltedView = type === "globe";
    this.map.easeTo({ pitch: 0, bearing: 0, duration: this.animateAllowed(true) ? 450 : 0 });
  }
  toggleProjection() { this.setProjection(this.tiltedView ? "mercator" : "globe"); return this.tiltedView; }
  zoomIn() { this.map?.zoomIn({ duration: this.animateAllowed(true) ? 250 : 0 }); }
  zoomOut() { this.map?.zoomOut({ duration: this.animateAllowed(true) ? 250 : 0 }); }
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
