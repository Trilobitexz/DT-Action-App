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
        description: "熱情洋溢的天使之城，匯聚平價美食、頂級百貨與文創市集。",
        spots: [
          { name: "鄭王廟 (黎明寺)", category: "文化古蹟", rating: 4.7, tag: "熱門打卡", note: "白瓷雕花佛塔與泰服體驗拍照勝地。" },
          { name: "洽圖洽週末市集", category: "購物市集", rating: 4.5, tag: "必訪名勝", note: "全球最大的戶外市集之一，上萬攤位應有盡有。" }
        ]
      }
    ]
  }
);
