// 亞洲國家資料
window.TRAVEL_DATA.countries.push(
  {
    id: "japan",
    continentId: "asia",
    name: "日本",
    englishName: "Japan",
    flag: "🇯🇵",
    currency: "日圓 (JPY)",
    exchangeRate: "1 TWD ≈ 4.8 JPY",
    visa: "免簽證（觀光最長 90 天）",
    directFlight: true,
    flightInfo: {
      hasDirect: true,
      departureFrom: "台北 (TPE/TSA) / 高雄 (KHH)",
      flightTime: "約 2.5 ~ 3.5 小時",
      airlines: ["長榮航空", "中華航空", "星宇航空", "全日空 (ANA)", "日本航空 (JAL)", "台灣虎航", "樂桃航空"],
      tips: "台日航班極為密集，廉航至傳統航空選擇齊全。"
    },
    priceLevel: {
      tier: "中等",
      rating: "$$",
      dailyBudgetTwd: "NT$ 2,500 - 4,500 / 天",
      dining: "平價餐食約 800-1300 JPY (NT$ 170-270)",
      transit: "地鐵單程約 180-250 JPY (NT$ 40-55)",
      hotel: "商務旅館雙人房約 NT$ 2,200 - 3,800 / 晚"
    },
    cities: [
      {
        id: "tokyo",
        name: "東京",
        englishName: "Tokyo",
        lat: 35.6895,
        lng: 139.6917,
        description: "融合前衛科技與傳統神社的世界級超級大都會。",
        spots: [
          { name: "淺草寺 (雷門)", category: "文化古蹟", rating: 4.6, tag: "必訪名勝", note: "穿浴衣體驗江戶風情與仲見世商店街美食。" },
          { name: "SHIBUYA SKY", category: "都會夜景", rating: 4.8, tag: "熱門打卡", note: "俯瞰澀谷十字路口與 360 度壯麗夜景。" },
          { name: "東京迪士尼度假區", category: "主題樂園", rating: 4.9, tag: "親子熱門", note: "包含陸地與全球唯一的海洋園區。" }
        ]
      },
      {
        id: "kyoto",
        name: "京都",
        englishName: "Kyoto",
        lat: 35.0116,
        lng: 135.7681,
        description: "日本千年古都，擁有上千座寺院神社與四季絕景。",
        spots: [
          { name: "伏見稻荷大社", category: "文化古蹟", rating: 4.8, tag: "必訪名勝", note: "綿延不絕的千本鳥居，拍照打卡首選。" },
          { name: "清水寺", category: "文化古蹟", rating: 4.7, tag: "世界遺產", note: "著名清水舞台，春櫻秋楓四季動人。" }
        ]
      }
    ]
  },
  {
    id: "thailand",
    continentId: "asia",
    name: "泰國",
    englishName: "Thailand",
    flag: "🇹🇭",
    currency: "泰銖 (THB)",
    exchangeRate: "1 TWD ≈ 1.12 THB",
    visa: "免簽證（觀光停留最高 60 天）",
    directFlight: true,
    flightInfo: {
      hasDirect: true,
      departureFrom: "台北 (TPE) / 高雄 (KHH)",
      flightTime: "約 3.5 ~ 4 小時",
      airlines: ["長榮航空", "中華航空", "星宇航空", "泰國航空", "泰越捷", "亞洲航空"],
      tips: "直飛曼谷與清邁班次頻繁，小資旅行首選。"
    },
    priceLevel: {
      tier: "實惠親民",
      rating: "$",
      dailyBudgetTwd: "NT$ 1,200 - 2,200 / 天",
      dining: "街頭小吃與夜市約 50-100 THB (NT$ 45-90)",
      transit: "BTS/MRT 單程約 20-50 THB (NT$ 18-45)",
      hotel: "特色泳池飯店雙人房約 NT$ 1,500 - 2,800 / 晚"
    },
    cities: [
      {
        id: "bangkok",
        name: "曼谷",
        englishName: "Bangkok",
        lat: 13.7563,
        lng: 100.5018,
        description: "熱情洋溢的天使之城，匯聚平價美食、頂級百貨與文創市集。",
        spots: [
          { name: "鄭王廟 (黎明寺)", category: "文化古蹟", rating: 4.7, tag: "熱門打卡", note: "白瓷雕花佛塔與泰服體驗拍照勝地。" },
          { name: "洽圖洽週末市集", category: "購物市集", rating: 4.5, tag: "必訪名勝", note: "全球最大的戶外市集之一，上萬攤位應有盡有。" }
        ]
      }
    ]
  },
  {
    id: "south-korea",
    continentId: "asia",
    name: "韓國",
    englishName: "South Korea",
    flag: "🇰🇷",
    currency: "韓元 (KRW)",
    exchangeRate: "1 TWD ≈ 42 KRW",
    visa: "K-ETA 電子旅行許可（暫時免除/免簽）",
    directFlight: true,
    flightInfo: {
      hasDirect: true,
      departureFrom: "台北 (TPE/TSA) / 高雄 (KHH) / 台中 (RMQ)",
      flightTime: "約 2.5 小時",
      airlines: ["長榮航空", "中華航空", "星宇航空", "大韓航空", "韓亞航空", "濟州航空", "德威航空"],
      tips: "直飛首爾仁川/金浦及釜山班次非常多，促銷廉航票價極具吸引力。"
    },
    priceLevel: {
      tier: "中等",
      rating: "$$",
      dailyBudgetTwd: "NT$ 2,200 - 4,000 / 天",
      dining: "街頭小吃與韓式烤肉約 8,000-18,000 KRW (NT$ 190-430)",
      transit: "地鐵單程約 1,400 KRW (NT$ 33)",
      hotel: "市區飯店雙人房約 NT$ 2,000 - 3,500 / 晚"
    },
    cities: [
      {
        id: "seoul",
        name: "首爾",
        englishName: "Seoul",
        lat: 37.5665,
        lng: 126.9780,
        description: "兼具 K-POP 潮流、歷史古宮與不夜城魅力的時尚之都。",
        spots: [
          { name: "景福宮", category: "歷史古蹟", rating: 4.6, tag: "必訪名勝", note: "穿韓服免費入場，體驗朝鮮王朝最壯麗的正宮。" },
          { name: "N首爾塔", category: "都會夜景", rating: 4.7, tag: "熱門地標", note: "南山頂俯瞰首爾璀璨夜景與浪漫愛情鎖牆。" },
          { name: "弘大商圈", category: "逛街潮流", rating: 4.5, tag: "年輕活力", note: "街頭藝人表演、平價服飾與道地美食聚集地。" }
        ]
      },
      {
        id: "busan",
        name: "釜山",
        englishName: "Busan",
        lat: 35.1796,
        lng: 129.0756,
        description: "依山傍海的活力港都，享有海鮮美食與悠閒海灘風光。",
        spots: [
          { name: "甘川洞文化村", category: "文創壁畫", rating: 4.6, tag: "打卡首選", note: "五彩斑斕的小屋依山而建，被譽為韓國的聖托里尼。" },
          { name: "海雲台海灘", category: "海濱度假", rating: 4.7, tag: "必訪名勝", note: "漫步金色沙灘與搭乘熱門海雲台天空膠囊列車。" }
        ]
      }
    ]
  }
);
