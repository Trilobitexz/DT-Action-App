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
      },
      {
        id: "nice",
        name: "尼斯",
        englishName: "Nice",
        lat: 43.7102,
        lng: 7.2620,
        description: "法國蔚藍海岸的度假城市，以海濱大道、老城與地中海陽光著稱。",
        spots: [
          { name: "英國人散步大道", category: "海濱景觀", rating: 4.7, tag: "海岸地標", note: "沿著地中海海岸漫步，欣賞尼斯灣與卵石海灘。" },
          { name: "尼斯舊城與薩雷雅市集", category: "歷史街區", rating: 4.6, tag: "在地漫遊", note: "穿梭彩色街巷與花果市集，品嚐南法風味。" }
        ]
      },
      {
        id: "lyon",
        name: "里昂",
        englishName: "Lyon",
        lat: 45.7640,
        lng: 4.8357,
        description: "以美食、文藝復興街區與索恩河畔風景聞名的法國城市。",
        spots: [
          { name: "里昂舊城", category: "世界遺產", rating: 4.7, tag: "歷史漫遊", note: "探索文藝復興建築、隱蔽通道與傳統街巷。" },
          { name: "富維耶聖母聖殿", category: "宗教建築", rating: 4.7, tag: "城市全景", note: "登高參觀白色聖殿並俯瞰里昂市區。" }
        ]
      },
      {
        id: "marseille",
        name: "馬賽",
        englishName: "Marseille",
        lat: 43.2965,
        lng: 5.3698,
        description: "地中海港都，以海鮮料理、舊港風光與南法海岸景致聞名。",
        spots: [
          { name: "馬賽舊港", category: "港灣景觀", rating: 4.6, tag: "城市地標", note: "感受魚市場、遊船碼頭與地中海港灣生活。" },
          { name: "伊夫堡與弗里烏爾群島", category: "海島歷史", rating: 4.7, tag: "海岸探索", note: "搭船探訪海上古堡與清澈海灣。" }
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
      },
      {
        id: "vik",
        name: "維克",
        englishName: "Vik",
        lat: 63.4186,
        lng: -19.0060,
        description: "冰島南岸旅行重鎮，鄰近黑沙灘、火山岩柱與瀑布景觀。",
        spots: [
          { name: "雷尼斯黑沙灘", category: "自然奇景", rating: 4.8, tag: "海岸地標", note: "欣賞黑色火山沙、玄武岩柱與大西洋海岸景色。" },
          { name: "斯科加瀑布", category: "自然地質", rating: 4.8, tag: "瀑布景觀", note: "近距離感受冰島南岸寬闊壯觀的瀑布水幕。" }
        ]
      },
      {
        id: "akureyri",
        name: "阿克雷里",
        englishName: "Akureyri",
        lat: 65.6835,
        lng: -18.0878,
        description: "冰島北部的主要城鎮，是探索峽灣、瀑布與冬季極光的據點。",
        spots: [
          { name: "阿克雷里教堂", category: "城市地標", rating: 4.5, tag: "市區漫遊", note: "參觀俯瞰城鎮的地標教堂與周邊商店街。" },
          { name: "米湖與黛提瀑布", category: "自然探索", rating: 4.8, tag: "北部景觀", note: "從北部據點出發，探索火山湖泊與壯闊瀑布區域。" }
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
      },
      {
        id: "edinburgh",
        name: "愛丁堡",
        englishName: "Edinburgh",
        lat: 55.9533,
        lng: -3.1883,
        description: "蘇格蘭首府，以古堡、石板街與節慶文化構成迷人的歷史城市景觀。",
        spots: [
          { name: "愛丁堡城堡", category: "歷史古蹟", rating: 4.8, tag: "城市地標", note: "參觀城堡與蘇格蘭王冠珠寶，俯瞰城市天際線。" },
          { name: "皇家一英里", category: "歷史街區", rating: 4.7, tag: "必訪漫遊", note: "沿著古老街道探索教堂、巷弄與傳統商店。" }
        ]
      },
      {
        id: "manchester",
        name: "曼徹斯特",
        englishName: "Manchester",
        lat: 53.4808,
        lng: -2.2426,
        description: "融合工業遺產、足球文化與音樂藝術的英格蘭北方活力城市。",
        spots: [
          { name: "老特拉福德球場", category: "足球文化", rating: 4.7, tag: "球迷朝聖", note: "走訪曼聯主場球場與博物館，體驗英超足球氛圍。" },
          { name: "科學與工業博物館", category: "博物館", rating: 4.6, tag: "文化探索", note: "了解曼徹斯特在工業革命與科技發展中的重要角色。" }
        ]
      },
      {
        id: "oxford",
        name: "牛津",
        englishName: "Oxford",
        lat: 51.7520,
        lng: -1.2577,
        description: "以古老大學學院、圖書館與典雅石造建築著稱的學術名城。",
        spots: [
          { name: "牛津大學基督堂學院", category: "大學建築", rating: 4.7, tag: "經典景點", note: "參觀歷史悠久的學院建築與知名大廳。" },
          { name: "博德利圖書館", category: "文化古蹟", rating: 4.6, tag: "建築巡禮", note: "欣賞牛津大學主要研究圖書館群的歷史建築。" }
        ]
      }
    ]
  }
);
