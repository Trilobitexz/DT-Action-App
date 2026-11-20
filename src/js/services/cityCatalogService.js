(function () {
  window.CityCatalogService = {
    cache: new Map(),
    waitForFirestore: function () {
      if (window.firebaseFirestore) return Promise.resolve(window.firebaseFirestore);
      return new Promise(resolve => {
        let attempts = 0;
        const timer = window.setInterval(() => {
          attempts += 1;
          if (window.firebaseFirestore) {
            window.clearInterval(timer);
            resolve(window.firebaseFirestore);
          } else if (attempts >= 100) {
            window.clearInterval(timer);
            resolve(null);
          }
        }, 100);
      });
    },
    fetchCity: async function (cityId) {
      const key = String(cityId || "");
      if (!key) return null;
      if (this.cache.has(key)) return this.cache.get(key);
      const db = await this.waitForFirestore();
      if (!db) return null;
      try {
        const [citySnapshot, spotSnapshot] = await Promise.all([
          db.collection("cities").doc(key).get(),
          db.collection("cities").doc(key).collection("spots").orderBy("index").get()
        ]);
        const city = citySnapshot.exists ? citySnapshot.data() : null;
        const spots = [];
        spotSnapshot.forEach(doc => {
          const data = doc.data();
          if (!data || !data.name) return;
          spots.push({
            id: doc.id,
            name: data.name,
            englishName: data.englishName || "",
            category: data.category || "景點",
            tag: data.tag || "資料庫景點",
            note: data.note || "",
            description: data.description || "",
            lat: Number.isFinite(Number(data.lat)) ? Number(data.lat) : null,
            lng: Number.isFinite(Number(data.lng)) ? Number(data.lng) : null,
            sourceUrl: data.sourceUrl || "",
            sourceLabel: data.sourceLabel || "後台公開目錄",
            website: data.website || "",
            openingHours: data.openingHours || "",
            address: data.address || "",
            rating: data.rating || null,
            ratingSource: data.ratingSource || null,
            publishedAt: data.publishedAt?.toMillis ? data.publishedAt.toMillis() : null
          });
        });
        const result = { city: city || null, spots };
        this.cache.set(key, result);
        return result;
      } catch (error) {
        console.warn(`讀取後台城市目錄失敗（${key}）：`, error);
        return null;
      }
    }
  };
})();
