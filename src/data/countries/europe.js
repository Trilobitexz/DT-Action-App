// 歐洲國家資料
window.TRAVEL_DATA.countries.push(
  {
    id: "france",
    continentId: "europe",
    name: "法國",
    englishName: "France",
    flag: "🇫🇷",
    currency: "歐元 (EUR)",
    exchangeRate: "1 EUR ≈ 34.5 TWD",
    visa: "申根免簽證（180天內最長90天）",
    directFlight: true,
    flightInfo: {
      hasDirect: true,
      departureFrom: "台北 (TPE)",
      flightTime: "約 13.5 ~ 15 小時",
      airlines: ["長榮航空", "法國航空 (Air France)"],
      tips: "長榮每週多班直飛巴黎戴高樂機場 (CDG)。"
    },
    priceLevel: {
      tier: "偏高",
      rating: "$$$",
      dailyBudgetTwd: "NT$ 4,000 - 7,000 / 天",
      dining: "一般餐館套餐約 18-30 EUR (NT$ 620-1030)",
      transit: "巴黎地鐵單程約 2.15 EUR (NT$ 75)",
      hotel: "市區三星雙人房約 NT$ 4,500 - 7,500 / 晚"
    },
    cities: [
      {
        id: "paris",
        name: "巴黎",
        englishName: "Paris",
        lat: 48.8566,
        lng: 2.3522,
        description: "花都浪漫之都，藝術、時裝與歷史建築的代表。",
        spots: [
          { name: "艾菲爾鐵塔", category: "地標名勝", rating: 4.7, tag: "全球知名", note: "戰神廣場野餐與夜間整點閃燈必看。" },
          { name: "羅浮宮博物館", category: "藝術博物館", rating: 4.8, tag: "世界頂級", note: "收藏蒙娜麗莎等數十萬件世界珍寶。" }
        ]
      }
    ]
  },
  {
    id: "iceland",
    continentId: "europe",
    name: "冰島",
    englishName: "Iceland",
    flag: "🇮🇸",
    currency: "冰島克朗 (ISK)",
    exchangeRate: "1 TWD ≈ 4.3 ISK",
    visa: "申根免簽證",
    directFlight: false,
    flightInfo: {
      hasDirect: false,
      departureFrom: "台灣出發需轉機 1-2 次",
      flightTime: "約 17 ~ 22 小時 (含轉機)",
      airlines: ["長榮/華航 + 冰島航空", "阿聯酋航空", "土耳其航空"],
      tips: "台灣無直飛航線，常見經阿姆斯特丹、倫敦轉機。"
    },
    priceLevel: {
      tier: "極高",
      rating: "$$$$",
      dailyBudgetTwd: "NT$ 6,000 - 10,000 / 天",
      dining: "一般主餐約 3500-6000 ISK (NT$ 800-1400)",
      transit: "以自駕租車為主 (約 NT$ 3,000-5,000/天)",
      hotel: "景觀旅館雙人房約 NT$ 6,000 - 12,000 / 晚"
    },
    cities: [
      {
        id: "reykjavik",
        name: "雷克雅維克",
        englishName: "Reykjavik",
        lat: 64.1466,
        lng: -21.9426,
        description: "冰火之國首都，追尋極光與冰川健行的啟程地。",
        spots: [
          { name: "藍湖溫泉 (Blue Lagoon)", category: "自然奇景", rating: 4.8, tag: "必訪名勝", note: "地熱火山黑石包圍的夢幻奶藍色礦物溫泉。" },
          { name: "黃金圈奇景 (間歇泉/黃金瀑布)", category: "自然地質", rating: 4.9, tag: "世界絕景", note: "冰島最經典的壯觀地質地貌。" }
        ]
      }
    ]
  },
  {
    id: "uk",
    continentId: "europe",
    name: "英國",
    englishName: "United Kingdom",
    flag: "🇬🇧",
    currency: "英鎊 (GBP)",
    exchangeRate: "1 GBP ≈ 41 TWD",
    visa: "免簽證（觀光停留最長 6 個月）",
    directFlight: true,
    flightInfo: {
      hasDirect: true,
      departureFrom: "台北 (TPE)",
      flightTime: "約 14.5 ~ 16 小時",
      airlines: ["長榮航空", "中華航空", "英國航空"],
      tips: "長榮與華航直飛倫敦希斯洛 (LHR)，需提早訂票。"
    },
    priceLevel: {
      tier: "偏高",
      rating: "$$$",
      dailyBudgetTwd: "NT$ 4,500 - 8,000 / 天",
      dining: "平價餐食約 12-25 GBP (NT$ 490-1025)",
      transit: "倫敦地鐵單程約 2.8-3.5 GBP (NT$ 115-145)",
      hotel: "倫敦市區雙人房約 NT$ 4,800 - 8,000 / 晚"
    },
    cities: [
      {
        id: "london",
        name: "倫敦",
        englishName: "London",
        lat: 51.5074,
        lng: -0.1278,
        description: "泰晤士河畔的古典與現代交織之都，博物館林立且多數免費。",
        spots: [
          { name: "大英博物館", category: "文化藝術", rating: 4.8, tag: "世界頂級", note: "常設展免費參觀，收藏羅塞塔石碑與埃及古文物。" },
          { name: "大笨鐘與倫敦眼", category: "代表地標", rating: 4.7, tag: "必訪名勝", note: "泰晤士河岸散步必拍的標誌性景觀組合。" }
        ]
      }
    ]
  }
);
