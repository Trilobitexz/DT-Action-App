// 大洲經緯度邊界 (Bounding Boxes) 與中心座標定義
window.GEO_CONTINENTS = {
  asia: {
    id: "asia",
    name: "亞洲",
    englishName: "Asia",
    center: [34.0479, 100.6197],
    zoom: 3.5,
    bounds: [
      [-10.0, 60.0],  // 西南角 [lat, lng]
      [55.0, 145.0]   // 東北角 [lat, lng]
    ]
  },
  europe: {
    id: "europe",
    name: "歐洲",
    englishName: "Europe",
    center: [50.5260, 15.2551],
    zoom: 4,
    bounds: [
      [34.0, -12.0],  // 西南角
      [68.0, 40.0]    // 東北角
    ]
  },
  "north-america": {
    id: "north-america",
    name: "北美洲",
    englishName: "North America",
    center: [39.8283, -98.5795],
    zoom: 3.5,
    bounds: [
      [15.0, -130.0], // 西南角
      [60.0, -60.0]   // 東北角
    ]
  },
  oceania: {
    id: "oceania",
    name: "大洋洲",
    englishName: "Oceania",
    center: [-25.2744, 133.7751],
    zoom: 4,
    bounds: [
      [-45.0, 110.0], // 西南角
      [-10.0, 178.0]  // 東北角
    ]
  }
};
