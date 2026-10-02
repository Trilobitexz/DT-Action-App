// 航班即時情報整合服務模組 (支援 Skyscanner / Google Flights 直達深層連結與即時狀態評估)
window.FlightService = {
  // 生成特定城市的 Skyscanner / Google Flights 即時機票比價深度連結
  generateSearchUrls: function(destinationCity, airportCode = "") {
    const origin = "TPE"; // 台灣主要國際機場
    const googleFlightsUrl = `https://www.google.com/travel/flights?q=Flights%20to%20${encodeURIComponent(destinationCity)}%20from%20Taipei`;
    const skyscannerUrl = `https://www.skyscanner.com.tw/transport/flights/tpe/${airportCode ? airportCode.toLowerCase() : encodeURIComponent(destinationCity)}/`;

    return { googleFlightsUrl, skyscannerUrl };
  },

  // 取得航班分析摘要卡片資料 (支援直飛航空公司、平均航程、航班密集度)
  getFlightInsight: function(country) {
    const info = country.flightInfo;
    return {
      statusText: info.hasDirect ? "台灣直飛航線營運中" : "需中途轉機（無直飛航班）",
      departureFrom: info.departureFrom,
      flightTime: info.flightTime,
      airlines: info.airlines,
      tips: info.tips
    };
  }
};
