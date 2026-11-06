// 美洲與大洋洲國家資料
window.TRAVEL_DATA.countries.push(
  {
    id: "usa",
    continentId: "north-america",
    name: "美國 (美西)",
    englishName: "United States (West)",
    flag: "🇺🇸",
    currency: "美元 (USD)",
    exchangeRate: "1 USD ≈ 32 TWD",
    visa: "ESTA 電子旅遊許可",
    directFlight: true,
    flightInfo: {
      hasDirect: true,
      departureFrom: "台北 (TPE)",
      flightTime: "約 11 ~ 12.5 小時",
      airlines: ["長榮航空", "中華航空", "星宇航空", "聯合航空", "達美航空"],
      tips: "直飛洛杉磯 (LAX)、舊金山 (SFO)、西雅圖 (SEA) 班次密集。"
    },
    priceLevel: {
      tier: "高",
      rating: "$$$",
      dailyBudgetTwd: "NT$ 4,500 - 8,000 / 天",
      dining: "一般餐廳正餐加小費約 25-45 USD (NT$ 800-1450)",
      transit: "Uber/租車自駕日均約 50-90 USD",
      hotel: "連鎖商務飯店約 NT$ 5,000 - 8,500 / 晚"
    },
    cities: [
      {
        id: "san-francisco",
        name: "舊金山",
        englishName: "San Francisco",
        lat: 37.7749,
        lng: -122.4194,
        description: "兼具山坡叮噹車、金門大橋與矽谷創新活力的海灣名城。",
        spots: [
          { name: "金門大橋 (Golden Gate Bridge)", category: "世界地標", rating: 4.8, tag: "經典打卡", note: "漫步或騎自行車橫跨海灣，眺望太平洋迷霧。" },
          { name: "漁人碼頭 39 號碼頭", category: "休閒港灣", rating: 4.6, tag: "必吃美食", note: "觀賞可愛海獅曬太陽與品嚐酸麵包海鮮濃湯。" }
        ]
      },
      {
        id: "los-angeles",
        name: "洛杉磯",
        englishName: "Los Angeles",
        lat: 34.0522,
        lng: -118.2437,
        description: "融合電影娛樂、海灘生活與多元文化的美西代表性大都會。",
        spots: [
          { name: "好萊塢星光大道", category: "電影文化", rating: 4.4, tag: "經典地標", note: "沿著好萊塢大道尋找明星星形獎章與戲院地標。" },
          { name: "聖塔莫尼卡碼頭", category: "海濱休閒", rating: 4.6, tag: "海岸體驗", note: "在太平洋海岸欣賞夕陽、遊樂設施與海濱步道。" },
          { name: "格里斐斯天文台", category: "城市景觀", rating: 4.7, tag: "夜景推薦", note: "從山丘眺望洛杉磯市區與好萊塢標誌。" }
        ]
      },
      {
        id: "seattle",
        name: "西雅圖",
        englishName: "Seattle",
        lat: 47.6062,
        lng: -122.3321,
        description: "以咖啡文化、海灣天際線與創新產業聞名的太平洋西北門戶。",
        spots: [
          { name: "太空針塔", category: "城市地標", rating: 4.7, tag: "全景觀景", note: "登高欣賞市區、雷尼爾山與普吉特海灣景色。" },
          { name: "派克市場", category: "在地市集", rating: 4.6, tag: "美食必訪", note: "探索海鮮攤位、在地農產與初代星巴克周邊街區。" }
        ]
      },
      {
        id: "las-vegas",
        name: "拉斯維加斯",
        englishName: "Las Vegas",
        lat: 36.1699,
        lng: -115.1398,
        description: "霓虹燈火與大型娛樂表演交織的沙漠度假城市，也是國家公園旅程據點。",
        spots: [
          { name: "拉斯維加斯大道", category: "娛樂夜生活", rating: 4.7, tag: "夜間體驗", note: "欣賞主題飯店、噴泉秀與璀璨夜間街景。" },
          { name: "胡佛水壩", category: "工程景觀", rating: 4.6, tag: "近郊探索", note: "參觀科羅拉多河上的大型水壩與壯闊峽谷景色。" }
        ]
      }
    ]
  },
  {
    id: "australia",
    continentId: "oceania",
    name: "澳洲",
    englishName: "Australia",
    flag: "🇦🇺",
    currency: "澳幣 (AUD)",
    exchangeRate: "1 AUD ≈ 21.5 TWD",
    visa: "ETA 電子簽證 (手機 App 申請)",
    directFlight: true,
    flightInfo: {
      hasDirect: true,
      departureFrom: "台北 (TPE)",
      flightTime: "約 8.5 ~ 9.5 小時",
      airlines: ["中華航空", "長榮航空", "澳洲航空 (Qantas)"],
      tips: "直飛雪梨、墨爾本、布里斯本，時差僅 2-3 小時超輕鬆。"
    },
    priceLevel: {
      tier: "偏高",
      rating: "$$$",
      dailyBudgetTwd: "NT$ 3,500 - 6,000 / 天",
      dining: "咖啡廳早午餐約 20-30 AUD (NT$ 430-650)",
      transit: "大眾運輸一日上限約 15-18 AUD (NT$ 320-390)",
      hotel: "市中心飯店雙人房約 NT$ 3,800 - 6,500 / 晚"
    },
    cities: [
      {
        id: "sydney",
        name: "雪梨",
        englishName: "Sydney",
        lat: -33.8688,
        lng: 151.2093,
        description: "美麗的港灣都會，結合衝浪海灘、歌劇院與頂級咖啡文化。",
        spots: [
          { name: "雪梨歌劇院 (Sydney Opera House)", category: "世界遺產", rating: 4.8, tag: "全球地標", note: "揚帆造型建築奇蹟，港灣步道夜景絕佳。" },
          { name: "邦代海灘 (Bondi Beach)", category: "海灘休閒", rating: 4.7, tag: "衝浪勝地", note: "世界級金色沙灘與懸崖海邊健行步道。" }
        ]
      },
      {
        id: "melbourne",
        name: "墨爾本",
        englishName: "Melbourne",
        lat: -37.8136,
        lng: 144.9631,
        description: "以巷弄咖啡、藝術文化、運動賽事與多元美食聞名的澳洲文化之都。",
        spots: [
          { name: "聯邦廣場與弗林德斯街車站", category: "城市地標", rating: 4.6, tag: "市中心漫遊", note: "欣賞墨爾本經典車站與廣場建築，漫步雅拉河畔。" },
          { name: "維多利亞女王市場", category: "在地市集", rating: 4.6, tag: "美食購物", note: "探索歷史市場、在地農產與特色餐飲。" },
          { name: "大洋路十二門徒岩", category: "自然景觀", rating: 4.9, tag: "近郊必訪", note: "沿海岸公路欣賞壯觀石灰岩海蝕柱與南大洋景色。" }
        ]
      },
      {
        id: "brisbane",
        name: "布里斯本",
        englishName: "Brisbane",
        lat: -27.4698,
        lng: 153.0251,
        description: "陽光充足的河岸城市，鄰近黃金海岸與昆士蘭海島度假區。",
        spots: [
          { name: "南岸公園與昆士蘭文化中心", category: "文化休閒", rating: 4.6, tag: "河岸漫遊", note: "沿布里斯本河散步，參觀藝文場館與人工沙灘。" },
          { name: "龍柏無尾熊保護區", category: "野生動物", rating: 4.6, tag: "親子熱門", note: "近距離認識澳洲原生動物與保育教育。" }
        ]
      },
      {
        id: "gold-coast",
        name: "黃金海岸",
        englishName: "Gold Coast",
        lat: -28.0167,
        lng: 153.4000,
        description: "以綿長沙灘、衝浪文化與主題樂園聞名的昆士蘭海濱度假城市。",
        spots: [
          { name: "衝浪者天堂", category: "海灘休閒", rating: 4.7, tag: "海岸地標", note: "漫步金色沙灘、體驗衝浪並欣賞海濱高樓天際線。" },
          { name: "春之溪國家公園藍光蟲之旅", category: "自然探索", rating: 4.7, tag: "夜間體驗", note: "在雨林步道觀察季節性的藍光蟲自然景觀。" }
        ]
      },
      {
        id: "perth",
        name: "伯斯",
        englishName: "Perth",
        lat: -31.9505,
        lng: 115.8605,
        description: "西澳首府，以陽光海岸、公園綠地與印度洋夕陽聞名。",
        spots: [
          { name: "國王公園與植物園", category: "城市自然", rating: 4.7, tag: "全景推薦", note: "在廣闊公園步道欣賞市區天際線與天鵝河景色。" },
          { name: "弗里曼特爾歷史港區", category: "歷史街區", rating: 4.6, tag: "港灣漫遊", note: "探索港口市集、歷史建築與海邊咖啡館。" }
        ]
      }
    ]
  },
  {
    id: "new-zealand",
    continentId: "oceania",
    name: "紐西蘭",
    englishName: "New Zealand",
    flag: "🇳🇿",
    currency: "紐幣 (NZD)",
    exchangeRate: "1 NZD ≈ 19.5 TWD",
    visa: "NZeTA 電子旅行授權",
    directFlight: true,
    flightInfo: {
      hasDirect: true,
      departureFrom: "台北 (TPE)",
      flightTime: "約 11 小時",
      airlines: ["紐西蘭航空 (Air New Zealand)"],
      tips: "直飛奧克蘭 (AKL)，旺季建議提早 3-6 個月訂票。"
    },
    priceLevel: {
      tier: "偏高",
      rating: "$$$",
      dailyBudgetTwd: "NT$ 3,800 - 6,500 / 天",
      dining: "餐廳主餐約 25-40 NZD (NT$ 490-780)",
      transit: "露營車/租車自駕約 NT$ 2,500-4,500/天",
      hotel: "景觀旅館或度假屋約 NT$ 4,000 - 7,000 / 晚"
    },
    cities: [
      {
        id: "queenstown",
        name: "皇后鎮",
        englishName: "Queenstown",
        lat: -45.0312,
        lng: 168.6626,
        description: "世界冒險之都，依傍瓦卡蒂普湖與卓越山脈的戶外天堂。",
        spots: [
          { name: "米佛峽灣 (Milford Sound)", category: "世界遺產", rating: 4.9, tag: "自然奇景", note: "搭乘觀光郵輪穿越冰河切割峽灣與壯闊瀑布。" },
          { name: "天際纜車 (Skyline Gondola)", category: "俯瞰全景", rating: 4.8, tag: "必玩體驗", note: "俯瞰皇后鎮全景與刺激的斜坡滑車 (Luge)。" }
        ]
      },
      {
        id: "auckland",
        name: "奧克蘭",
        englishName: "Auckland",
        lat: -36.8509,
        lng: 174.7645,
        description: "紐西蘭最大城市，港灣、火山丘陵與毛利文化交織的北島門戶。",
        spots: [
          { name: "天空塔", category: "城市地標", rating: 4.6, tag: "全景觀景", note: "登塔俯瞰奧克蘭港灣與城市群島。" },
          { name: "伊甸山", category: "火山景觀", rating: 4.6, tag: "自然漫遊", note: "沿火山口步道欣賞城市與海港全景。" },
          { name: "奧克蘭戰爭紀念博物館", category: "歷史文化", rating: 4.7, tag: "文化探索", note: "認識紐西蘭歷史、自然生態與毛利文化。" }
        ]
      },
      {
        id: "wellington",
        name: "威靈頓",
        englishName: "Wellington",
        lat: -41.2866,
        lng: 174.7756,
        description: "紐西蘭首都，以海港風光、電影製作與蓬勃咖啡文化聞名。",
        spots: [
          { name: "紐西蘭蒂帕帕國家博物館", category: "博物館", rating: 4.8, tag: "文化必訪", note: "透過互動展覽認識紐西蘭自然、歷史與文化。" },
          { name: "威靈頓纜車與植物園", category: "城市景觀", rating: 4.6, tag: "全景漫遊", note: "搭乘紅色纜車登上山丘，俯瞰港灣與城市。" }
        ]
      },
      {
        id: "christchurch",
        name: "基督城",
        englishName: "Christchurch",
        lat: -43.5321,
        lng: 172.6362,
        description: "南島花園城市，是前往南阿爾卑斯山與坎特伯里平原的旅行據點。",
        spots: [
          { name: "基督城植物園", category: "城市花園", rating: 4.6, tag: "休閒漫遊", note: "沿雅芳河畔漫步，欣賞大型花園與季節植栽。" },
          { name: "國際南極中心", category: "互動體驗", rating: 4.6, tag: "親子推薦", note: "透過展覽與模擬體驗認識南極探索與極地環境。" }
        ]
      },
      {
        id: "rotorua",
        name: "羅托魯瓦",
        englishName: "Rotorua",
        lat: -38.1368,
        lng: 176.2497,
        description: "以地熱景觀、毛利文化與溫泉體驗聞名的北島旅遊城市。",
        spots: [
          { name: "蒂普亞地熱與毛利文化園區", category: "地熱文化", rating: 4.7, tag: "特色體驗", note: "觀察間歇泉與泥漿池，認識毛利傳統工藝與表演。" },
          { name: "紅木森林步道", category: "自然健行", rating: 4.6, tag: "戶外推薦", note: "穿梭高聳紅木林，體驗林間步道與樹冠吊橋。" }
        ]
      }
    ]
  }
);
