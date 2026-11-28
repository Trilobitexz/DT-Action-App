// Keep spot labels and descriptions consistent with the zh-Hant interface.
window.SpotTextService = (() => {
  const pairs = [
    "开開", "罗羅", "门門", "马馬", "场場", "丽麗", "书書", "会會", "与與", "为為", "区區",
    "关關", "闻聞", "条條", "画畫", "乐樂", "学學", "习習", "阴陰", "阳陽", "结結", "体體", "证證",
    "单單", "头頭", "号號", "黄黃", "长長", "尽盡", "广廣", "称稱", "铁鐵", "钟鐘", "胜勝", "顾顧",
    "业業", "边邊", "叶葉", "万萬", "务務", "网網", "进進", "战戰", "东東", "经經", "济濟", "专專",
    "馆館", "图圖", "历歷", "风風", "龙龍", "树樹", "实實", "远遠", "连連", "员員", "备備", "练練",
    "码碼", "桥橋", "达達", "兴興", "妇婦", "过過", "苏蘇", "亲親", "观觀", "组組", "异異", "钱錢",
    "乌烏", "联聯", "应應", "众眾", "庆慶", "丰豐", "严嚴", "剑劍", "孙孫", "买買", "卖賣", "赵趙",
    "刘劉", "陈陳", "杨楊", "吴吳", "汉漢", "华華", "国國", "际際", "发發", "宁寧", "车車", "术術",
    "厅廳", "邮郵", "点點", "当當", "师師", "厂廠", "极極", "确確", "记記", "运運", "动動", "标標",
    "识識", "奥奧", "兰蘭", "圣聖", "贤賢", "宫宮", "剧劇", "园園", "层層", "红紅", "绿綠", "蓝藍",
    "书書", "语語", "话話", "时時", "间間", "东東", "电電", "云雲", "见見", "说說", "听聽", "让讓",
    "个個", "这這", "气氣", "问問", "转轉", "页頁", "数數", "线線", "织織", "级級",
    "达達", "获獲", "产產", "农農", "无無", "条條", "园園", "长長", "對對", "员員", "楼樓", "广廣",
    "阶階", "线線", "麦麥", "证證", "宽寬", "运運", "输輸", "战戰", "艺藝", "术術", "倾傾", "楼樓",
    "对對", "爱愛", "约約", "热熱", "亚亞", "内內", "环環", "绕繞", "类類", "项項", "贵貴", "声聲",
    "营營", "卫衛", "县縣", "办辦", "读讀", "写寫", "来來", "还還", "别別", "种種", "鲜鮮", "鱼魚",
    "鸟鳥", "岛島", "医醫", "药藥", "凤鳳", "复復", "遗遺", "迹跡", "变變", "处處", "构構", "规規",
    "划劃", "团團", "队隊", "荣榮", "静靜", "鸡雞", "迁遷", "设設", "独獨", "惯慣", "温溫", "湿濕",
    "润潤", "史史", "传傳", "统統", "节節", "礼禮", "欢歡", "护護", "从從", "财財", "仓倉", "储儲",
    "约約", "郑鄭", "韩韓", "项項", "倾傾", "响響", "炼煉", "举舉", "业業", "际際", "国國", "万萬",
    "译譯", "庙廟", "于於", "义義", "该該", "认認", "击擊", "断斷", "乡鄉", "亩畝", "庆慶", "岁歲",
    "后後", "纪紀", "届屆", "术術", "岛島", "众眾", "医醫", "药藥", "营營", "处處", "随隨", "达達",
    "连連", "续續", "对對", "应應", "实實", "际際", "时時", "间間", "还還", "这這", "从從", "过過",
    "办辦", "权權", "动動", "员員", "产產", "声聲", "显顯", "现現", "况況", "见見", "转轉", "为為",
    "边邊", "际際", "阶階", "级級", "门門", "户戶", "状狀", "态態", "质質", "数數", "线線", "标標",
    "萨薩", "圣聖", "献獻", "筑築", "计計", "协協", "机機", "视視", "范範", "并並",
    "离離", "据據", "决決", "择擇", "滨濱", "齐齊", "欢歡", "摆擺", "广廣", "经經",
    "给給", "尔爾", "补補", "强強", "坛壇", "达達", "际際", "围圍", "亿億", "费費",
    "后後", "图圖", "线線", "数數", "观觀", "历歷", "达達", "业業", "录錄", "将將"
  ];
  const supplementalPairs = [
    "饭飯", "词詞", "类類", "宾賓", "检檢", "测測", "坚堅", "历歷", "资資", "数數",
    "质質", "强強", "见見", "线線", "区區", "举舉", "华華", "当當", "尽盡", "备備",
    "价價", "饭飯", "际際", "坛壇", "简簡", "顺順", "报報", "闭閉", "闻聞", "网網",
    "读讀", "药藥", "灵靈", "欢歡", "画畫", "区區", "乌烏", "广廣", "优優", "顾顧",
    "务務", "饭飯", "馆館", "输輸", "评評", "价價", "获獲", "际際", "齐齊", "汇匯",
    "币幣", "权權", "验驗", "证證", "识識", "题題", "验驗", "术術", "译譯", "纪紀",
    "严嚴", "响響", "毕畢", "庆慶", "毕畢", "设設", "计計", "园園", "楼樓", "层層",
    "鲁魯", "总總", "创創", "侧側", "装裝", "换換"
  ];
  const chars = new Map([...pairs, ...supplementalPairs].map(pair => [pair[0], pair[1]]));
  const phrases = new Map([
    ["秘鲁", "秘魯"],
    ["总教区", "總教區"],
    ["创建", "創建"],
    ["卡萨布兰卡露德圣母堂", "卡薩布蘭卡露德聖母堂"],
    ["卡萨布兰卡圣心主教座堂", "卡薩布蘭卡聖心主教座堂"],
    ["卡萨布兰卡主教座堂", "卡薩布蘭卡主教座堂"],
    ["卡萨布兰卡", "卡薩布蘭卡"],
    ["卡萨布兰加", "卡薩布蘭加"],
    ["先贤祠", "先賢祠"],
    ["明治神宫", "明治神宮"],
    ["博物馆", "博物館"],
    ["图书馆", "圖書館"],
    ["战争纪念", "戰爭紀念"],
    ["战争", "戰爭"],
    ["人民大会堂", "人民大會堂"],
    ["国家图书馆", "國家圖書館"],
    ["科学博物馆", "科學博物館"],
    ["纪念碑", "紀念碑"],
    ["国际饭店", "國際飯店"],
    ["静安区", "靜安區"],
    ["静安寺", "靜安寺"]
  ]);
  const phrasePattern = new RegExp([...phrases.keys()].sort((a, b) => b.length - a.length).join("|"), "g");
  function toTraditional(value) {
    return String(value ?? "").replace(phrasePattern, phrase => phrases.get(phrase))
      .replace(/[\u3400-\u9fff]/g, character => chars.get(character) || character);
  }
  function normalizeSpot(spot) {
    if (!spot || typeof spot !== "object") return spot;
    const normalized = { ...spot };
    ["name", "englishName", "category", "tag", "note", "summary", "description", "address", "sourceLabel"].forEach(key => {
      if (typeof normalized[key] === "string") normalized[key] = toTraditional(normalized[key]);
    });
    return normalized;
  }
  function isValidHttpUrl(value) {
    try {
      const url = new URL(String(value ?? "").trim());
      return /^(?:https?:)$/.test(url.protocol) && Boolean(url.hostname) && !url.username && !url.password;
    } catch (error) { return false; }
  }
  // Filter encyclopedia pages that describe administrative units, institutions,
  // or events rather than places a traveller can visit. Named museums,
  // memorials, heritage areas, and other explicit visitor sites remain eligible.
  function isTravelAttraction(spot) {
    if (!spot) return false;
    const name = `${spot.name || ""} ${spot.englishName || ""}`.trim();
    const title = toTraditional(name);
    const category = toTraditional(spot.category || "");
    const summary = toTraditional(spot.description || spot.summary || spot.note || "");
    const summaryLead = summary.replace(/\b(vs|mr|mrs|dr|st|no)\./giu, "$1").split(/[.!?。！？]/u, 1)[0];
    const visitorSite = /(?:\b(?:museum|memorial|monument|heritage|historic|old town|arts district|cultural district|botanical|viewpoint|park|garden|temple|church|mosque|cathedral|castle|palace|shrine|market|square|bridge|tower|theatre|theater|zoo|aquarium|beach|waterfall|mountain|island|cave|stadium|opera|library|plaza|scenic area|protected area|fortress)\b|風景區|风景区|自然保護區|自然保护区|公園|公园|花園|花园|植物園|植物园|寺廟|寺庙|教堂|聖堂|圣堂|主教座堂|清真寺|修道院|神社|宗教建築|宗教建筑|聖殿|圣殿|大教堂|博物館|美術館|美术馆|藝術宮|艺术宫|紀念館|纪念馆|紀念堂|纪念堂|紀念碑|纪念碑|遺址|遗址|古蹟|古迹|歷史街區|历史街区|老城區|老城区|文化區|文化区|藝術區|艺术区|文化遺產|文化遗产|歷史與文化遺產|歷史与文化遗产|世界遺產|世界遗产|王城區|王城区|觀景台|观景台|觀景點|观景点|市集|市場|市场|廣場|广场|動物園|动物园|水族館|水族馆|海灘|海滩|瀑布|山岳|島嶼|岛屿|洞穴|體育場|体育场|歌劇院|歌剧院|圖書館|图书馆|鐘樓|钟楼|要塞|城郭|城跡|城址|共和國宮|共和国宫)/iu;
    const administrativeTitle = /(?:\b(?:electoral|congressional|administrative)?\s*district(?:\s+of\s+[\p{L}\p{M} .'-]+)?|\bmunicipality|\bcounty|\bprovince|\bprefecture|\bgovernorate|\bsubdistrict|\btownship|\bward|\bborough)\s*$/iu.test(name)
      || /^(?:district|county|province|municipality)\s+of\b/iu.test(name)
      || /(?:行政區|行政区|市轄區|市辖区|區政府|区政府|(?:縣|县|省|州|郡|區|区))\s*$/u.test(title);
    const administrativeSummary = /\b(?:is|was|are|were)\s+(?:(?:an?|the)\s+)?(?:(?:[\p{L}\p{M}-]+)\s+){0,3}(?:administrative\s+)?(?:district|municipality|commune|county|province|presidency|territory|region|suburb|neighborhood|village|university|college|school|central bank|capital(?:\s+city)?|city|town|borough|airline|air carrier|airport|business park|science park|research park|real[- ]estate project|development project)\b/iu.test(summaryLead)
      || /^(?:.{0,32})(?:是|為)(?:一個|一所|一座)?(?:城市|首都|城鎮|城镇|郊區|郊区|市郊|市轄區|市辖区|行政區|行政区|大學|大学|學院|学院|學校|学校|中央銀行|中央银行|航空公司|研究機構|商業園區|科學園區|科技園區)/u.test(summaryLead);
    const institutionalTitle = /\b(?:university|college|school|institute|think tank|central bank|bank of|ministry of|department of|airline|airlines|air carrier|airport|science park|technology park|business park|research park)\b/iu.test(name)
      || /(?:中央銀行|中央银行|大學|大学|學院|学院|學校|学校|專科學校|专科学校)/u.test(title);
    const institutionalSummary = /\b(?:is|was|are|were)\s+(?:(?:an?|the)\s+)?(?:(?:[\p{L}\p{M}-]+)\s+){0,3}(?:university|college|school|institute|think tank|central bank|airline|air carrier|airport|company|business park|science park|research park)\b|\b(?:parliament|legislative assembly|government headquarters|government office|parliament office)\b/iu.test(summaryLead);
    const eventTitle = /(?:air\s+crash|plane\s+crash|boxing\s+match|championship\s+match|sporting\s+event|bombing|terrorist attack|massacre|shootings?|earthquake|volcanic eruption|disaster|military operation|襲擊事件|袭击事件|墜機|坠机|空難|空难|恐攻|恐怖襲擊|恐怖袭击|爆炸事件|槍擊(?:事件|案)|枪击(?:事件|案)|屠殺|屠杀|地震|火山爆發|火山爆发|事故)/iu.test(`${name} ${category}`);
    const eventSummary = /\b(?:is|was|are|were)\s+(?:(?:an?|the)\s+)?(?:(?:[\p{L}\p{M}-]+)\s+){0,4}(?:boxing match|championship match|sporting event|shooting|air crash|plane crash|bombing|terrorist attack|massacre|military operation)\b/iu.test(summaryLead);
    const inactiveProject = /^.{0,90}\b(?:is|was|are|were)\b.{0,60}\b(?:planned to be built|proposed but never built|never built|not constructed|put on hold|cancelled|canceled|under construction)\b/iu.test(summaryLead)
      || /^.{0,60}(?:是|為)(?:一個|一座|一項)?(?:規劃興建中|計劃興建中|計畫興建中|未建成|已取消|停建|尚未建成)/u.test(summaryLead);
    // A location mentioned inside an administrative page's description must not
    // turn that district itself into an attraction (for example, Ermita mentions Intramuros).
    const namedVisitorSite = visitorSite.test(`${title} ${category}`)
      && !/\b(?:science|technology|business|research) park\b/iu.test(name);
    const accommodationOnly = /(?:\b(?:hotel|resort|hostel|guesthouse|inn)\b|酒店|飯店|旅館|旅店|民宿)/iu.test(title)
      && /(?:\b(?:hotel|resort|hostel|guesthouse|inn|accommodation)\b|酒店|飯店|旅館|旅店|民宿|五星級)/iu.test(summary)
      && !/(?:\b(?:landmark|heritage|historic|monument|architectural)\b|地標|古蹟|歷史建築|文化遺產|文物保護)/iu.test(`${title} ${summary}`);
    const governmentOfficePage = /\b(?:parliament|legislative assembly|government headquarters|government office|parliament office|parliamentary office)\b/iu.test(summaryLead);
    const cityOrInstitutionPage = ((administrativeTitle || administrativeSummary || institutionalTitle || institutionalSummary)
      && (!namedVisitorSite || governmentOfficePage))
      || accommodationOnly;
    const activityOrProjectPage = inactiveProject || (eventSummary && !namedVisitorSite);
    const transitFacility = /(?:\b(?:railway|train|metro|subway|bus|transit)\s+(?:station|terminal|stop)\b|\b(?:station|terminal|stop)\b|火車站|火车站|鐵路車站|铁路车站|地鐵站|地铁站|捷運站|捷运站|車站|车站|[駅站])$/iu.test(name);
    const notableFacility = namedVisitorSite
      || /\b(?:historic|heritage|museum|monument|memorial|landmark|old town|station building)\b|歷史建築|历史建筑|古蹟|古迹|博物館|博物馆|紀念館|纪念馆|遺址|遗址|地標|地标/iu.test(`${title} ${summary}`);
    const nonVisitorFacility = transitFacility && !notableFacility;
    return !cityOrInstitutionPage && !nonVisitorFacility && !activityOrProjectPage && !(eventTitle && !namedVisitorSite);
  }
  function isCompleteAIPlanningSpot(spot) {
    if (!spot || typeof spot !== "object" || spot.isSearchSuggestion) return false;
    if (!String(spot.name || "").trim() || !String(spot.category || "").trim()) return false;
    const description = String(spot.description || spot.summary || spot.note || "").trim();
    if (description.length < 40 || !isTravelAttraction(spot)) return false;
    const lat = spot.lat === null || spot.lat === undefined || spot.lat === "" ? NaN : Number(spot.lat);
    const lng = spot.lng === null || spot.lng === undefined || spot.lng === "" ? NaN : Number(spot.lng);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180
      || (lat === 0 && lng === 0)) return false;
    return isValidHttpUrl(spot.sourceUrl);
  }
  function validateAIPlanningSpots(spots, days) {
    if (!Array.isArray(spots) || !spots.length) return { valid: false, code: "ai/no-spots" };
    const requiredDays = Math.max(1, Math.min(7, Math.trunc(Number(days)) || 1));
    const invalidIndex = spots.findIndex(spot => !isCompleteAIPlanningSpot(spot));
    if (invalidIndex >= 0) return { valid: false, code: "ai/incomplete-spots", invalidIndex };
    if (spots.length < requiredDays) return { valid: false, code: "ai/insufficient-sourced-spots" };
    return { valid: true, code: "" };
  }
  return { toTraditional, normalizeSpot, isValidHttpUrl, isTravelAttraction, isCompleteAIPlanningSpot, validateAIPlanningSpots };
})();
