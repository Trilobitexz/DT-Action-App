// 城市資料補充：統一維持每座城市至少 3 個景點，並補上更多航線目的地。
(function () {
  const spot = (name, category, tag, note, rating = 4.6) => ({ name, category, rating, tag, note });

  const additionalSpots = {
    kyoto: spot("嵐山竹林與渡月橋", "自然景觀", "四季推薦", "沿著桂川散步，感受竹林、古寺與山景交織的京都風情。"),
    nara: spot("春日大社", "文化古蹟", "古都巡禮", "沿著石燈籠參拜鹿群環繞的古老神社。"),
    bangkok: spot("大皇宮與玉佛寺", "文化古蹟", "必訪名勝", "欣賞泰國王室建築與金碧輝煌的寺院群。"),
    "chiang-mai": spot("帕邢寺", "文化古蹟", "古城巡禮", "在清邁古城欣賞蘭納風格寺院與金色佛塔。"),
    pattaya: spot("真理寺", "宗教建築", "海岸地標", "欣賞全木雕工藝與泰國灣海岸景色。"),
    busan: spot("甘川文化村", "藝術街區", "熱門打卡", "漫步山城彩色屋舍與巷弄藝術作品。"),
    incheon: spot("松島中央公園", "城市休閒", "現代景觀", "搭乘水上計程車，欣賞松島國際都市天際線。"),
    paris: spot("蒙馬特與聖心堂", "藝術街區", "浪漫漫遊", "登上白色聖心堂眺望巴黎，探索畫家廣場與坡道街巷。"),
    nice: spot("城堡山公園", "城市景觀", "全景推薦", "登高俯瞰尼斯灣、老城屋頂與蔚藍海岸。"),
    lyon: spot("里昂壁畫", "藝術街區", "城市探索", "沿著索恩河與市區尋找巨幅城市壁畫。"),
    marseille: spot("聖母加德大教堂", "宗教建築", "城市全景", "登上山丘欣賞港灣與地中海群島全景。"),
    reykjavik: spot("哈爾格林姆教堂", "城市地標", "建築名勝", "參觀冰島代表性現代教堂並登塔欣賞市景。"),
    vik: spot("塞里雅蘭瀑布", "自然地質", "瀑布景觀", "沿步道走到瀑布後方，欣賞南岸經典水幕。"),
    akureyri: spot("胡薩維克觀鯨", "自然生態", "海上體驗", "從北部港口出發，尋找座頭鯨與海鳥蹤跡。"),
    london: spot("倫敦塔與塔橋", "歷史古蹟", "河岸地標", "沿泰晤士河參觀王室城堡與經典吊橋。"),
    edinburgh: spot("亞瑟王座", "自然景觀", "城市全景", "健行登上火山丘陵，俯瞰愛丁堡城堡與海岸。"),
    manchester: spot("科學與工業博物館", "文化藝術", "親子推薦", "從蒸汽機與鐵路展覽認識工業革命歷史。"),
    oxford: spot("博德利圖書館", "文化藝術", "大學古蹟", "欣賞歷史悠久的大學圖書館與石造建築群。"),
    "san-francisco": spot("九曲花街", "城市街區", "經典打卡", "沿著海德街欣賞花木簇擁的陡坡街景。"),
    seattle: spot("奇胡利玻璃藝術園", "文化藝術", "室內景點", "欣賞色彩繽紛的大型玻璃雕塑與太空針塔景觀。"),
    "las-vegas": spot("紅岩峽谷", "自然景觀", "近郊探索", "在賭城近郊欣賞紅色砂岩峽谷與沙漠步道。"),
    sydney: spot("皇家植物園與麥覺理夫人座椅", "城市自然", "港灣全景", "沿港灣綠地散步，拍攝歌劇院與海港大橋。"),
    brisbane: spot("布里斯本市政廳鐘樓", "城市地標", "市中心漫遊", "參觀市政廳與鐘樓，探索皇后街購物區。"),
    "gold-coast": spot("華納兄弟電影世界", "主題樂園", "親子熱門", "體驗電影主題遊樂設施與季節限定遊行。"),
    perth: spot("羅特尼斯島", "海島自然", "近郊必訪", "搭船探索白沙海灣與可愛短尾矮袋鼠。"),
    queenstown: spot("皇后鎮天空纜車", "城市景觀", "全景推薦", "登上鮑勃峰俯瞰瓦卡蒂普湖與南阿爾卑斯山。"),
    wellington: spot("威塔洞穴工作室", "電影文化", "創意體驗", "認識電影模型、特效與紐西蘭影視製作。"),
    christchurch: spot("雅芳河 punting 撐篙船", "城市休閒", "慢活體驗", "乘船穿過市中心河道，欣賞花園城市風景。"),
    rotorua: spot("蒂普亞毛利文化村", "在地文化", "文化體驗", "認識毛利工藝、歌舞與地熱景觀。")
  };

  window.TRAVEL_DATA.countries.forEach(country => {
    country.cities.forEach(city => {
      if (additionalSpots[city.id] && Array.isArray(city.spots) && city.spots.length < 5) {
        city.spots.push(additionalSpots[city.id]);
      }
    });
  });

  const newCountries = [
    {
      id: "vietnam", continentId: "asia", name: "越南", englishName: "Vietnam", flag: "🇻🇳",
      currency: "越南盾 (VND)", exchangeRate: "1 TWD ≈ 800 VND", visa: "依最新電子簽證規定辦理",
      directFlight: true,
      flightInfo: { hasDirect: true, departureFrom: "台北 (TPE) / 高雄 (KHH)", flightTime: "約 3 ~ 3.5 小時", airlines: ["中華航空", "長榮航空", "越捷航空", "星宇航空"], tips: "河內與胡志明市皆有台灣直飛航班，航班會依季節調整。" },
      priceLevel: { tier: "實惠親民", rating: "$", dailyBudgetTwd: "NT$ 1,200 - 2,500 / 天", dining: "街頭小吃約 NT$ 50 - 180", transit: "市區叫車與大眾運輸約 NT$ 100 - 300 / 天", hotel: "市區雙人房約 NT$ 1,200 - 3,000 / 晚" },
      cities: [
        { id: "hanoi", name: "河內", englishName: "Hanoi", lat: 21.0278, lng: 105.8342, description: "湖泊、老城街巷與越南北方文化交織的千年古都。", airports: [{ name: "內排國際機場", code: "HAN", lat: 21.2212, lng: 105.8072 }], spots: [
          spot("還劍湖與玉山祠", "城市地標", "市中心漫遊", "沿湖散步，感受河內市中心的歷史傳說與日常生活。", 4.7),
          spot("河內老城三十六古街", "歷史街區", "在地體驗", "穿梭巷弄商店與街頭小吃，觀察老城生活節奏。", 4.6),
          spot("文廟國子監", "文化古蹟", "古都必訪", "參觀越南最具代表性的儒學古蹟與庭院建築。", 4.7)
        ] },
        { id: "ho-chi-minh", name: "胡志明市", englishName: "Ho Chi Minh City", lat: 10.8231, lng: 106.6297, description: "法式建築、咖啡文化與活力街區交會的南越大城。", airports: [{ name: "新山一國際機場", code: "SGN", lat: 10.8188, lng: 106.6519 }], spots: [
          spot("中央郵局與紅教堂", "城市地標", "法式建築", "一次欣賞兩座經典殖民時期建築，適合市中心步行探索。", 4.6),
          spot("濱城市場", "在地市集", "美食購物", "採買咖啡、香料與伴手禮，品嚐越南街頭小吃。", 4.5),
          spot("戰爭遺跡博物館", "歷史文化", "深度旅行", "透過展覽了解越南近代歷史與和平議題。", 4.6)
        ] }
      ]
    },
    {
      id: "singapore", continentId: "asia", name: "新加坡", englishName: "Singapore", flag: "🇸🇬",
      currency: "新加坡幣 (SGD)", exchangeRate: "1 SGD ≈ 24 TWD", visa: "短期觀光免簽，出發前確認入境規定",
      directFlight: true,
      flightInfo: { hasDirect: true, departureFrom: "台北 (TPE)", flightTime: "約 4.5 小時", airlines: ["中華航空", "長榮航空", "新加坡航空", "酷航"], tips: "台北往返新加坡航班密集，適合安排城市短途旅行。" },
      priceLevel: { tier: "中高", rating: "$$-$$$", dailyBudgetTwd: "NT$ 2,800 - 5,500 / 天", dining: "熟食中心約 NT$ 120 - 300 / 餐", transit: "地鐵與公車約 NT$ 100 - 250 / 天", hotel: "市區雙人房約 NT$ 3,000 - 7,000 / 晚" },
      cities: [{ id: "singapore", name: "新加坡", englishName: "Singapore", lat: 1.3521, lng: 103.8198, description: "花園城市融合多元文化、美食與未來感建築。", airports: [{ name: "新加坡樟宜機場", code: "SIN", lat: 1.3644, lng: 103.9915 }], spots: [
        spot("濱海灣花園", "城市自然", "夜間景觀", "欣賞超級樹、溫室花園與濱海灣夜間燈光秀。", 4.8),
        spot("濱海灣金沙觀景台", "城市景觀", "全景推薦", "從高處眺望金融區、海灣與城市天際線。", 4.7),
        spot("牛車水與麥士威熟食中心", "在地美食", "美食必訪", "探索華人街區、寺廟與新加坡經典熟食攤。", 4.6)
      ] }]
    },
    {
      id: "italy", continentId: "europe", name: "義大利", englishName: "Italy", flag: "🇮🇹",
      currency: "歐元 (EUR)", exchangeRate: "1 EUR ≈ 34.5 TWD", visa: "申根免簽證（180天內最長90天）",
      directFlight: false,
      flightInfo: { hasDirect: false, departureFrom: "台北 (TPE) 出發需轉機", flightTime: "約 15 ~ 18 小時（含轉機）", airlines: ["阿聯酋航空", "卡達航空", "土耳其航空"], tips: "可經杜拜、杜哈或伊斯坦堡轉往羅馬、米蘭等主要城市。" },
      priceLevel: { tier: "中高", rating: "$$$", dailyBudgetTwd: "NT$ 3,500 - 7,000 / 天", dining: "一般餐館約 NT$ 500 - 1,200 / 餐", transit: "火車與市區交通約 NT$ 200 - 700 / 天", hotel: "市區雙人房約 NT$ 3,500 - 8,000 / 晚" },
      cities: [
        { id: "rome", name: "羅馬", englishName: "Rome", lat: 41.9028, lng: 12.4964, description: "古羅馬遺跡、文藝復興藝術與天主教文化交會的永恆之城。", airports: [{ name: "羅馬菲烏米奇諾機場", code: "FCO", lat: 41.8003, lng: 12.2389 }], spots: [
          spot("羅馬競技場與古羅馬廣場", "世界遺產", "必訪名勝", "沿著古蹟步道探索帝國時代的城市核心。", 4.8),
          spot("萬神殿與納沃納廣場", "歷史古蹟", "市區漫遊", "欣賞保存完整的古代圓頂與巴洛克廣場噴泉。", 4.7),
          spot("梵蒂岡博物館與聖彼得大教堂", "藝術博物館", "世界頂級", "預約參觀西斯汀禮拜堂與壯觀宗教藝術收藏。", 4.8)
        ] },
        { id: "milan", name: "米蘭", englishName: "Milan", lat: 45.4642, lng: 9.1900, description: "時尚、設計與藝術匯聚的義大利北方現代都會。", airports: [{ name: "米蘭馬爾彭薩機場", code: "MXP", lat: 45.6306, lng: 8.7281 }], spots: [
          spot("米蘭大教堂與艾曼紐二世迴廊", "建築地標", "城市必訪", "登上大教堂屋頂欣賞尖塔與市中心景色。", 4.8),
          spot("達文西最後的晚餐", "藝術博物館", "預約必看", "提前預約欣賞文藝復興壁畫真跡。", 4.7),
          spot("納維利運河區", "夜生活", "在地漫遊", "沿運河散步，在酒吧與餐館感受米蘭夜生活。", 4.6)
        ] }
      ]
    },
    {
      id: "spain", continentId: "europe", name: "西班牙", englishName: "Spain", flag: "🇪🇸",
      currency: "歐元 (EUR)", exchangeRate: "1 EUR ≈ 34.5 TWD", visa: "申根免簽證（180天內最長90天）",
      directFlight: false,
      flightInfo: { hasDirect: false, departureFrom: "台北 (TPE) 出發需轉機", flightTime: "約 16 ~ 19 小時（含轉機）", airlines: ["阿聯酋航空", "卡達航空", "土耳其航空"], tips: "可經中東或歐洲樞紐轉往馬德里與巴塞隆納。" },
      priceLevel: { tier: "中等", rating: "$$-$$$", dailyBudgetTwd: "NT$ 2,800 - 5,500 / 天", dining: "Tapas 與套餐約 NT$ 350 - 900 / 餐", transit: "地鐵與城際火車約 NT$ 180 - 700 / 天", hotel: "市區雙人房約 NT$ 2,800 - 6,000 / 晚" },
      cities: [
        { id: "barcelona", name: "巴塞隆納", englishName: "Barcelona", lat: 41.3874, lng: 2.1686, description: "高第建築、地中海海岸與創意街區交織的加泰隆尼亞城市。", airports: [{ name: "巴塞隆納機場", code: "BCN", lat: 41.2974, lng: 2.0833 }], spots: [
          spot("聖家堂", "建築地標", "世界名作", "欣賞高第未完工的奇幻教堂與彩色光影。", 4.8),
          spot("桂爾公園", "城市景觀", "藝術漫遊", "在馬賽克長椅與山丘步道眺望巴塞隆納。", 4.7),
          spot("哥德區與蘭布拉大道", "歷史街區", "市區探索", "漫步古老巷弄、市場與地中海城市商業街。", 4.6)
        ] },
        { id: "madrid", name: "馬德里", englishName: "Madrid", lat: 40.4168, lng: -3.7038, description: "博物館、皇宮、公園與夜生活充滿活力的西班牙首都。", airports: [{ name: "馬德里巴拉哈斯機場", code: "MAD", lat: 40.4983, lng: -3.5676 }], spots: [
          spot("普拉多博物館", "藝術博物館", "世界頂級", "欣賞委拉斯奎茲、哥雅等西班牙大師作品。", 4.8),
          spot("馬德里王宮", "歷史古蹟", "皇室建築", "參觀華麗宮殿、皇家軍械庫與周邊廣場。", 4.7),
          spot("麗池公園與水晶宮", "城市自然", "慢活推薦", "在市中心綠地划船、散步與欣賞玻璃宮。", 4.6)
        ] }
      ]
    },
    {
      id: "canada", continentId: "north-america", name: "加拿大", englishName: "Canada", flag: "🇨🇦",
      currency: "加拿大元 (CAD)", exchangeRate: "1 CAD ≈ 23 TWD", visa: "通常需申請 eTA，出發前確認資格",
      directFlight: true,
      flightInfo: { hasDirect: true, departureFrom: "台北 (TPE)", flightTime: "約 11.5 ~ 13 小時", airlines: ["中華航空", "長榮航空", "加拿大航空"], tips: "台北可直飛溫哥華與多倫多，國內城市間適合搭乘航班。" },
      priceLevel: { tier: "偏高", rating: "$$$", dailyBudgetTwd: "NT$ 3,500 - 7,000 / 天", dining: "一般餐館含小費約 NT$ 600 - 1,300 / 餐", transit: "市區交通約 NT$ 180 - 450 / 天", hotel: "市區雙人房約 NT$ 3,500 - 7,500 / 晚" },
      cities: [
        { id: "vancouver", name: "溫哥華", englishName: "Vancouver", lat: 49.2827, lng: -123.1207, description: "山海相依的西岸城市，融合戶外自然、多元美食與都市生活。", airports: [{ name: "溫哥華國際機場", code: "YVR", lat: 49.1947, lng: -123.1792 }], spots: [
          spot("史丹利公園海堤", "城市自然", "戶外首選", "騎單車或步行沿海堤欣賞山海與城市天際線。", 4.8),
          spot("格蘭維爾島市場", "在地市集", "美食購物", "品嚐海鮮、烘焙與加拿大在地食材。", 4.6),
          spot("卡皮拉諾吊橋公園", "自然探索", "冒險體驗", "穿越森林吊橋與樹梢步道，感受西岸雨林。", 4.7)
        ] },
        { id: "toronto", name: "多倫多", englishName: "Toronto", lat: 43.6532, lng: -79.3832, description: "多元文化、藝術展演與湖畔天際線交會的加拿大大城。", airports: [{ name: "多倫多皮爾遜國際機場", code: "YYZ", lat: 43.6777, lng: -79.6248 }], spots: [
          spot("CN塔", "城市地標", "全景推薦", "登塔俯瞰安大略湖與多倫多市區天際線。", 4.7),
          spot("聖羅倫斯市場", "在地市集", "美食必訪", "探索新鮮食材、熟食與多倫多移民文化。", 4.6),
          spot("皇家安大略博物館", "文化藝術", "雨天備案", "參觀自然史、世界文化與恐龍收藏。", 4.7)
        ] }
      ]
    }
  ];

  newCountries.forEach(country => window.TRAVEL_DATA.countries.push(country));

  const newGlobalCities = newCountries.flatMap(country => country.cities.map(city => ({
    ...city,
    countryName: country.name,
    flag: country.flag,
    continentName: window.TRAVEL_DATA.continents.find(item => item.id === country.continentId)?.name || country.continentId,
    climate: "依季節呈現鮮明氣候特色，適合先確認當地天氣與活動開放時間。",
    culture: `${city.name}融合${country.name}的飲食、歷史與日常生活，適合用步行與公共交通深入探索。`,
    history: `${city.name}保有歷史街區與現代城市景觀，能從文化古蹟與在地市場認識城市脈絡。`,
    attractions: city.spots.map(item => item.name)
  })));
  newGlobalCities.forEach(city => {
    const existingIndex = window.TRAVEL_DATA.globalCities.findIndex(item => item.id === city.id);
    if (existingIndex >= 0) {
      window.TRAVEL_DATA.globalCities[existingIndex] = {
        ...window.TRAVEL_DATA.globalCities[existingIndex],
        ...city
      };
    } else {
      window.TRAVEL_DATA.globalCities.push(city);
    }
  });
  window.TRAVEL_DATA.globalCities.forEach((city, index) => {
    city.populationRank = index + 1;
    city.travelRank = ((index * 37) % 100) + 1;
  });
  window.GLOBAL_CITIES = window.TRAVEL_DATA.globalCities;
  window.TRAVEL_DATA.globalCityLists = {
    population: window.TRAVEL_DATA.globalCities.slice(0, 100),
    travel: window.TRAVEL_DATA.globalCities.slice().sort((a, b) => a.travelRank - b.travelRank).slice(0, 100)
  };
})();
