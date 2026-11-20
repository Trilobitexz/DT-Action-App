// Extra global destinations. The names are linked to the GeoNames gazetteer;
// coordinates are resolved from OpenStreetMap when a destination is opened.
(function () {
  const rows = [
    ["fukuoka", "福岡", "Fukuoka", "日本", "JP", "🇯🇵", "亞洲"],
    ["sapporo", "札幌", "Sapporo", "日本", "JP", "🇯🇵", "亞洲"],
    ["nara", "奈良", "Nara", "日本", "JP", "🇯🇵", "亞洲"],
    ["okinawa", "沖繩", "Okinawa", "日本", "JP", "🇯🇵", "亞洲"],
    ["pattaya", "芭達雅", "Pattaya", "泰國", "TH", "🇹🇭", "亞洲"],
    ["busan", "釜山", "Busan", "韓國", "KR", "🇰🇷", "亞洲"],
    ["jeju", "濟州", "Jeju", "韓國", "KR", "🇰🇷", "亞洲"],
    ["incheon", "仁川", "Incheon", "韓國", "KR", "🇰🇷", "亞洲"],
    ["nice", "尼斯", "Nice", "法國", "FR", "🇫🇷", "歐洲"],
    ["lyon", "里昂", "Lyon", "法國", "FR", "🇫🇷", "歐洲"],
    ["marseille", "馬賽", "Marseille", "法國", "FR", "🇫🇷", "歐洲"],
    ["vik", "維克", "Vik", "冰島", "IS", "🇮🇸", "歐洲"],
    ["akureyri", "阿克雷里", "Akureyri", "冰島", "IS", "🇮🇸", "歐洲"],
    ["manchester", "曼徹斯特", "Manchester", "英國", "GB", "🇬🇧", "歐洲"],
    ["oxford", "牛津", "Oxford", "英國", "GB", "🇬🇧", "歐洲"],
    ["seattle", "西雅圖", "Seattle", "美國", "US", "🇺🇸", "北美洲"],
    ["brisbane", "布里斯本", "Brisbane", "澳洲", "AU", "🇦🇺", "大洋洲"],
    ["gold-coast", "黃金海岸", "Gold Coast", "澳洲", "AU", "🇦🇺", "大洋洲"],
    ["perth", "伯斯", "Perth", "澳洲", "AU", "🇦🇺", "大洋洲"],
    ["queenstown", "皇后鎮", "Queenstown", "紐西蘭", "NZ", "🇳🇿", "大洋洲"],
    ["wellington", "威靈頓", "Wellington", "紐西蘭", "NZ", "🇳🇿", "大洋洲"],
    ["christchurch", "基督城", "Christchurch", "紐西蘭", "NZ", "🇳🇿", "大洋洲"],
    ["rotorua", "羅托魯瓦", "Rotorua", "紐西蘭", "NZ", "🇳🇿", "大洋洲"],
    ["hiroshima", "廣島", "Hiroshima", "日本", "JP", "🇯🇵", "亞洲"],
    ["nagasaki", "長崎", "Nagasaki", "日本", "JP", "🇯🇵", "亞洲"],
    ["kanazawa", "金澤", "Kanazawa", "日本", "JP", "🇯🇵", "亞洲"],
    ["sendai", "仙台", "Sendai", "日本", "JP", "🇯🇵", "亞洲"],
    ["hakodate", "函館", "Hakodate", "日本", "JP", "🇯🇵", "亞洲"],
    ["hangzhou", "杭州", "Hangzhou", "中國", "CN", "🇨🇳", "亞洲"],
    ["guilin", "桂林", "Guilin", "中國", "CN", "🇨🇳", "亞洲"],
    ["suzhou", "蘇州", "Suzhou", "中國", "CN", "🇨🇳", "亞洲"],
    ["harbin", "哈爾濱", "Harbin", "中國", "CN", "🇨🇳", "亞洲"],
    ["kunming", "昆明", "Kunming", "中國", "CN", "🇨🇳", "亞洲"],
    ["xiamen", "廈門", "Xiamen", "中國", "CN", "🇨🇳", "亞洲"],
    ["qingdao", "青島", "Qingdao", "中國", "CN", "🇨🇳", "亞洲"],
    ["nanjing", "南京", "Nanjing", "中國", "CN", "🇨🇳", "亞洲"],
    ["lhasa", "拉薩", "Lhasa", "中國", "CN", "🇨🇳", "亞洲"],
    ["dalian", "大連", "Dalian", "中國", "CN", "🇨🇳", "亞洲"],
    ["jaipur", "齋浦爾", "Jaipur", "印度", "IN", "🇮🇳", "亞洲"],
    ["agra", "阿格拉", "Agra", "印度", "IN", "🇮🇳", "亞洲"],
    ["kolkata", "加爾各答", "Kolkata", "印度", "IN", "🇮🇳", "亞洲"],
    ["kochi", "柯欽", "Kochi", "印度", "IN", "🇮🇳", "亞洲"],
    ["varanasi", "瓦拉納西", "Varanasi", "印度", "IN", "🇮🇳", "亞洲"],
    ["amritsar", "阿姆利則", "Amritsar", "印度", "IN", "🇮🇳", "亞洲"],
    ["panaji", "帕納吉", "Panaji", "印度", "IN", "🇮🇳", "亞洲"],
    ["kathmandu", "加德滿都", "Kathmandu", "尼泊爾", "NP", "🇳🇵", "亞洲"],
    ["colombo", "可倫坡", "Colombo", "斯里蘭卡", "LK", "🇱🇰", "亞洲"],
    ["yogyakarta", "日惹", "Yogyakarta", "印尼", "ID", "🇮🇩", "亞洲"],
    ["bandung", "萬隆", "Bandung", "印尼", "ID", "🇮🇩", "亞洲"],
    ["surabaya", "泗水", "Surabaya", "印尼", "ID", "🇮🇩", "亞洲"],
    ["george-town", "喬治市", "George Town", "馬來西亞", "MY", "🇲🇾", "亞洲"],
    ["melaka", "馬六甲", "Melaka", "馬來西亞", "MY", "🇲🇾", "亞洲"],
    ["da-nang", "峴港", "Da Nang", "越南", "VN", "🇻🇳", "亞洲"],
    ["hue", "順化", "Hue", "越南", "VN", "🇻🇳", "亞洲"],
    ["hoi-an", "會安", "Hoi An", "越南", "VN", "🇻🇳", "亞洲"],
    ["phnom-penh", "金邊", "Phnom Penh", "柬埔寨", "KH", "🇰🇭", "亞洲"],
    ["luang-prabang", "琅勃拉邦", "Luang Prabang", "寮國", "LA", "🇱🇦", "亞洲"],
    ["yangon", "仰光", "Yangon", "緬甸", "MM", "🇲🇲", "亞洲"],
    ["chiang-rai", "清萊", "Chiang Rai", "泰國", "TH", "🇹🇭", "亞洲"],
    ["ayutthaya", "大城", "Ayutthaya", "泰國", "TH", "🇹🇭", "亞洲"],
    ["cebu-city", "宿霧市", "Cebu City", "菲律賓", "PH", "🇵🇭", "亞洲"],
    ["davao", "達沃", "Davao", "菲律賓", "PH", "🇵🇭", "亞洲"],
    ["brussels", "布魯塞爾", "Brussels", "比利時", "BE", "🇧🇪", "歐洲"],
    ["munich", "慕尼黑", "Munich", "德國", "DE", "🇩🇪", "歐洲"],
    ["hamburg", "漢堡", "Hamburg", "德國", "DE", "🇩🇪", "歐洲"],
    ["bordeaux", "波爾多", "Bordeaux", "法國", "FR", "🇫🇷", "歐洲"],
    ["seville", "塞維亞", "Seville", "西班牙", "ES", "🇪🇸", "歐洲"],
    ["valencia", "瓦倫西亞", "Valencia", "西班牙", "ES", "🇪🇸", "歐洲"],
    ["porto", "波多", "Porto", "葡萄牙", "PT", "🇵🇹", "歐洲"],
    ["krakow", "克拉科夫", "Krakow", "波蘭", "PL", "🇵🇱", "歐洲"],
    ["warsaw", "華沙", "Warsaw", "波蘭", "PL", "🇵🇱", "歐洲"],
    ["tallinn", "塔林", "Tallinn", "愛沙尼亞", "EE", "🇪🇪", "歐洲"],
    ["helsinki", "赫爾辛基", "Helsinki", "芬蘭", "FI", "🇫🇮", "歐洲"],
    ["oslo", "奧斯陸", "Oslo", "挪威", "NO", "🇳🇴", "歐洲"],
    ["bergen", "卑爾根", "Bergen", "挪威", "NO", "🇳🇴", "歐洲"],
    ["dubrovnik", "杜布羅夫尼克", "Dubrovnik", "克羅埃西亞", "HR", "🇭🇷", "歐洲"],
    ["split", "斯普利特", "Split", "克羅埃西亞", "HR", "🇭🇷", "歐洲"],
    ["zagreb", "札格瑞布", "Zagreb", "克羅埃西亞", "HR", "🇭🇷", "歐洲"],
    ["bucharest", "布加勒斯特", "Bucharest", "羅馬尼亞", "RO", "🇷🇴", "歐洲"],
    ["sofia", "索菲亞", "Sofia", "保加利亞", "BG", "🇧🇬", "歐洲"],
    ["sarajevo", "塞拉耶佛", "Sarajevo", "波士尼亞與赫塞哥維納", "BA", "🇧🇦", "歐洲"],
    ["antalya", "安塔利亞", "Antalya", "土耳其", "TR", "🇹🇷", "亞洲"],
    ["boston", "波士頓", "Boston", "美國", "US", "🇺🇸", "北美洲"],
    ["washington-dc", "華盛頓特區", "Washington, D.C.", "美國", "US", "🇺🇸", "北美洲"],
    ["san-diego", "聖地牙哥", "San Diego", "美國", "US", "🇺🇸", "北美洲"],
    ["new-orleans", "紐奧良", "New Orleans", "美國", "US", "🇺🇸", "北美洲"],
    ["denver", "丹佛", "Denver", "美國", "US", "🇺🇸", "北美洲"],
    ["cancun", "坎昆", "Cancún", "墨西哥", "MX", "🇲🇽", "北美洲"],
    ["guadalajara", "瓜達拉哈拉", "Guadalajara", "墨西哥", "MX", "🇲🇽", "北美洲"],
    ["medellin", "麥德林", "Medellín", "哥倫比亞", "CO", "🇨🇴", "南美洲"],
    ["arequipa", "阿雷基帕", "Arequipa", "秘魯", "PE", "🇵🇪", "南美洲"],
    ["montevideo", "蒙得維的亞", "Montevideo", "烏拉圭", "UY", "🇺🇾", "南美洲"],
    ["salvador-bahia", "薩爾瓦多", "Salvador", "巴西", "BR", "🇧🇷", "南美洲"],
    ["alexandria", "亞歷山卓", "Alexandria", "埃及", "EG", "🇪🇬", "非洲"],
    ["luxor", "路克索", "Luxor", "埃及", "EG", "🇪🇬", "非洲"],
    ["addis-ababa", "阿迪斯阿貝巴", "Addis Ababa", "衣索比亞", "ET", "🇪🇹", "非洲"]
  ];

  const existingCities = new Map((window.TRAVEL_DATA.globalCities || []).map(city => [city.id, city]));
  const cities = rows.map(row => {
    const [id, name, englishName, countryName, countryCode, flag, continentName] = row;
    const sourceUrl = `https://www.geonames.org/search.html?country=${countryCode}&q=${encodeURIComponent(englishName)}`;
    const existingCity = existingCities.get(id);
    if (existingCity) {
      existingCity.countryCode ||= countryCode;
      existingCity.catalogSource ||= { provider: "GeoNames", sourceUrl };
      return null;
    }
    return {
      id, name, englishName, countryName, countryCode, flag, continentName,
      lat: null, lng: null, spots: [], airports: [],
      catalogSource: { provider: "GeoNames", sourceUrl },
      coordinateSource: null
    };
  }).filter(Boolean);

  window.TRAVEL_DATA.globalCities.push(...cities);
  window.GLOBAL_CITIES = window.TRAVEL_DATA.globalCities;
})();
