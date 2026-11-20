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
      },
      {
        id: "osaka",
        name: "大阪",
        englishName: "Osaka",
        lat: 34.6937,
        lng: 135.5023,
        description: "以道頓堀美食、熱鬧商圈與親子樂園聞名的關西門戶。",
        spots: [
          { name: "大阪城", category: "歷史古蹟", rating: 4.7, tag: "代表地標", note: "漫步大阪城公園，欣賞天守閣與季節花景。" },
          { name: "道頓堀與心齋橋", category: "美食購物", rating: 4.8, tag: "必訪名勝", note: "品嚐章魚燒與大阪燒，感受固力果招牌霓虹夜景。" },
          { name: "日本環球影城", category: "主題樂園", rating: 4.9, tag: "親子熱門", note: "體驗超級任天堂世界及多元人氣主題園區。" }
        ]
      },
      {
        id: "fukuoka",
        name: "福岡",
        englishName: "Fukuoka",
        lat: 33.5904,
        lng: 130.4017,
        description: "交通便利、拉麵與屋台文化盛行的九州美食城市。",
        spots: [
          { name: "博多運河城", category: "購物娛樂", rating: 4.5, tag: "熱門商圈", note: "大型複合商場匯集購物、餐飲與水舞表演。" },
          { name: "太宰府天滿宮", category: "文化古蹟", rating: 4.7, tag: "近郊必訪", note: "參拜學問之神，沿參道品嚐梅枝餅。" },
          { name: "中洲屋台街", category: "在地美食", rating: 4.6, tag: "夜間體驗", note: "在河畔屋台品嚐豚骨拉麵與九州小吃。" }
        ]
      },
      {
        id: "sapporo",
        name: "札幌",
        englishName: "Sapporo",
        lat: 43.0618,
        lng: 141.3545,
        description: "北海道首府，以雪祭、海鮮、味噌拉麵與冬季滑雪聞名。",
        spots: [
          { name: "大通公園與札幌電視塔", category: "城市地標", rating: 4.6, tag: "市中心漫遊", note: "四季花園與冬季雪祭主會場，登塔可眺望市區。" },
          { name: "二條市場", category: "在地美食", rating: 4.5, tag: "海鮮必吃", note: "品嚐北海道新鮮海產與人氣海鮮丼。" },
          { name: "白色戀人公園", category: "主題觀光", rating: 4.6, tag: "親子熱門", note: "參觀北海道代表性甜點工廠與英式庭園。" }
        ]
      },
      {
        id: "nara",
        name: "奈良",
        englishName: "Nara",
        lat: 34.6851,
        lng: 135.8048,
        description: "古寺與奈良公園交織的歷史古都，適合安排關西一日遊。",
        spots: [
          { name: "東大寺", category: "世界遺產", rating: 4.8, tag: "必訪名勝", note: "瞻仰壯觀的大佛殿，漫步古都寺院群。" },
          { name: "奈良公園", category: "自然休閒", rating: 4.7, tag: "熱門體驗", note: "在公園步道欣賞古蹟並觀察野生梅花鹿。" }
        ]
      },
      {
        id: "okinawa",
        name: "沖繩",
        englishName: "Okinawa",
        lat: 26.2124,
        lng: 127.6809,
        description: "擁有琉球文化、蔚藍海岸與離島風光的日本南方度假勝地。",
        spots: [
          { name: "首里城公園", category: "文化古蹟", rating: 4.5, tag: "琉球文化", note: "認識琉球王國歷史與朱紅色王城建築。" },
          { name: "美麗海水族館", category: "海洋生態", rating: 4.8, tag: "親子必訪", note: "欣賞黑潮之海大型水槽與鯨鯊等海洋生物。" },
          { name: "國際通", category: "美食購物", rating: 4.5, tag: "熱門商圈", note: "採買沖繩伴手禮並品嚐在地料理。" }
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
      },
      {
        id: "chiang-mai",
        name: "清邁",
        englishName: "Chiang Mai",
        lat: 18.7883,
        lng: 98.9853,
        description: "泰北慢活古城，以寺廟、夜市、咖啡館與山林自然聞名。",
        spots: [
          { name: "雙龍寺", category: "文化古蹟", rating: 4.8, tag: "必訪名勝", note: "登上素帖山參訪金色佛塔，俯瞰清邁市景。" },
          { name: "清邁古城與週日夜市", category: "古城漫遊", rating: 4.7, tag: "在地體驗", note: "沿古城寺廟散步，週日夜市品嚐泰北小吃。" }
        ]
      },
      {
        id: "phuket",
        name: "普吉島",
        englishName: "Phuket",
        lat: 7.8804,
        lng: 98.3923,
        description: "泰國最大海島度假地，適合海灘放鬆、跳島與水上活動。",
        spots: [
          { name: "芭東海灘", category: "海濱度假", rating: 4.5, tag: "熱門海灘", note: "體驗海上活動並欣賞安達曼海日落。" },
          { name: "普吉老城", category: "文化街區", rating: 4.6, tag: "文青漫遊", note: "欣賞中葡式建築、彩色街屋與特色咖啡店。" },
          { name: "攀牙灣", category: "自然奇景", rating: 4.8, tag: "跳島推薦", note: "搭船探索石灰岩島嶼、海蝕洞與碧綠海灣。" }
        ]
      },
      {
        id: "pattaya",
        name: "芭達雅",
        englishName: "Pattaya",
        lat: 12.9236,
        lng: 100.8825,
        description: "曼谷近郊海濱度假城市，兼具海灘活動、親子景點與夜生活。",
        spots: [
          { name: "真理寺", category: "建築藝術", rating: 4.7, tag: "特色地標", note: "欣賞以精細木雕打造的海濱寺廟建築。" },
          { name: "格蘭島", category: "海島度假", rating: 4.6, tag: "海灘推薦", note: "搭船前往清澈海灣，享受浮潛與沙灘時光。" }
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
      },
      {
        id: "jeju",
        name: "濟州",
        englishName: "Jeju",
        lat: 33.4996,
        lng: 126.5312,
        description: "以火山地形、海岸景觀與特色美食聞名的韓國熱門度假島嶼。",
        spots: [
          { name: "城山日出峰", category: "自然景觀", rating: 4.8, tag: "世界自然遺產", note: "登上火山凝灰錐欣賞海岸全景與日出。" },
          { name: "漢拏山國立公園", category: "登山健行", rating: 4.7, tag: "自然探索", note: "沿步道探索韓國最高峰的火山地形與四季生態。" },
          { name: "東門市場", category: "在地美食", rating: 4.5, tag: "人氣市場", note: "品嚐黑豬肉、海鮮與橘子等濟州特色小吃。" }
        ]
      },
      {
        id: "incheon",
        name: "仁川",
        englishName: "Incheon",
        lat: 37.4563,
        lng: 126.7052,
        description: "鄰近首爾的海港城市，融合機場交通、海岸風光與近代街區。",
        spots: [
          { name: "松島中央公園", category: "城市景觀", rating: 4.5, tag: "休閒漫遊", note: "欣賞現代建築天際線，體驗公園水上遊覽。" },
          { name: "仁川中國城", category: "文化街區", rating: 4.4, tag: "美食散步", note: "漫步韓國歷史悠久的華人街區並品嚐在地中華料理。" }
        ]
      }
    ]
  }
);
