// OSRM public demo router: driving routes only. Other travel modes use the app's schematic line.
window.RoadRouteService = {
  cache: new Map(),
  pending: new Map(),
  timeoutMs: 8500,
  retentionMs: 24 * 60 * 60 * 1000,
  getDrivingRoute: async function(coordinates) {
    if (!Array.isArray(coordinates) || coordinates.length < 2 || coordinates.length > 12) return null;
    const points = coordinates.map(point => [Number(point?.[0]), Number(point?.[1])]);
    if (points.some(([lng, lat]) => !Number.isFinite(lng) || !Number.isFinite(lat) || lng < -180 || lng > 180 || lat < -90 || lat > 90)) return null;
    const key = points.map(([lng, lat]) => `${lng.toFixed(5)},${lat.toFixed(5)}`).join(";");
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.retentionMs) return cached.data;
    const pendingRequest = this.pending.get(key);
    if (pendingRequest) return pendingRequest;
    const coordinatesPath = points.map(([lng, lat]) => `${lng},${lat}`).join(";");
    const params = new URLSearchParams({ overview: "full", geometries: "geojson", steps: "false", alternatives: "false" });
    const request = (async () => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordinatesPath}?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error(`OSRM ${response.status}`);
        const payload = await response.json();
        const route = payload.code === "Ok" ? payload.routes?.[0] : null;
        if (!route?.geometry?.coordinates?.length || !Number.isFinite(route.distance) || !Number.isFinite(route.duration)) return null;
        const data = { coordinates: route.geometry.coordinates, distanceMeters: route.distance, durationSeconds: route.duration, source: "OSRM / OpenStreetMap contributors" };
        this.cache.set(key, { timestamp: Date.now(), data });
        return data;
      } catch (error) {
        console.warn("OSRM 道路路線暫時無法取得，保留直線示意：", error);
        return null;
      } finally { window.clearTimeout(timeout); }
    })();
    this.pending.set(key, request);
    try { return await request; }
    finally { if (this.pending.get(key) === request) this.pending.delete(key); }
  }
};
