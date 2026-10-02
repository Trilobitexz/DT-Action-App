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
        description: "兼具山坡叮噹車、金門大橋與矽谷創新活力的海灣名城。",
        spots: [
          { name: "金門大橋 (Golden Gate Bridge)", category: "世界地標", rating: 4.8, tag: "經典打卡", note: "漫步或騎自行車橫跨海灣，眺望太平洋迷霧。" },
          { name: "漁人碼頭 39 號碼頭", category: "休閒港灣", rating: 4.6, tag: "必吃美食", note: "觀賞可愛海獅曬太陽與品嚐酸麵包海鮮濃湯。" }
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
        description: "美麗的港灣都會，結合衝浪海灘、歌劇院與頂級咖啡文化。",
        spots: [
          { name: "雪梨歌劇院 (Sydney Opera House)", category: "世界遺產", rating: 4.8, tag: "全球地標", note: "揚帆造型建築奇蹟，港灣步道夜景絕佳。" },
          { name: "邦代海灘 (Bondi Beach)", category: "海灘休閒", rating: 4.7, tag: "衝浪勝地", note: "世界級金色沙灘與懸崖海邊健行步道。" }
        ]
      }
    ]
  }
);
