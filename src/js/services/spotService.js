// 景點即時資訊服務 (整合維基導遊/百科 API，即時拉取景點深度摘要與配圖)
window.SpotService = {
  cache: {},

  // 非同步取得景點百科/簡介與縮圖
  fetchSpotDetail: async function(spotName) {
    if (this.cache[spotName]) return this.cache[spotName];

    try {
      const cleanName = spotName.split("(")[0].trim();
      const url = `https://zh.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanName)}`;
      
      const res = await fetch(url, { headers: { "Accept": "application/json" } });
      if (!res.ok) throw new Error("Wiki API 查無此景點");
      const data = await res.json();

      const result = {
        title: data.title,
        extract: data.extract ? (data.extract.length > 95 ? data.extract.substring(0, 95) + "..." : data.extract) : "",
        thumbnail: data.thumbnail?.source || null,
        pageUrl: data.content_urls?.desktop?.page || null
      };

      this.cache[spotName] = result;
      return result;
    } catch (e) {
      return null;
    }
  }
};
