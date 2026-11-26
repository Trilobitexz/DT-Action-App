window.WorldHighlightsView = {
  storageKey: "journey-atlas-world-highlights-v1",
  activeFilter: "all",
  groups: [
    {
      id: "ancient-wonders", title: "古代世界七大奇蹟", note: "古典時代流傳下來的名錄；現存者只有吉薩大金字塔。部分遺址位置為近似參考。", source: "https://www.britannica.com/list/seven-wonders-of-the-ancient-world",
      items: [
        ["吉薩大金字塔", "埃及・吉薩", 29.9792, 31.1342, "唯一仍大致保存至今的古代奇蹟。"],
        ["巴比倫空中花園", "古巴比倫（今伊拉克）", 32.5364, 44.4207, "其是否存在、實際位置至今仍有學術爭議。"],
        ["奧林匹亞宙斯神像", "希臘・奧林匹亞", 37.6383, 21.6300, "古代奧林匹亞宙斯神殿遺址。"],
        ["以弗所阿耳忒彌斯神殿", "土耳其・塞爾丘克", 37.9497, 27.3639, "古代以弗所神殿遺址。"],
        ["哈利卡納蘇斯陵墓", "土耳其・博德魯姆", 37.0379, 27.4241, "陵墓遺址位於古代哈利卡納蘇斯。"],
        ["羅得島太陽神巨像", "希臘・羅得島", 36.4510, 28.2270, "雕像已不存，標記為羅得島市區參考位置。"],
        ["亞歷山卓燈塔", "埃及・亞歷山卓", 31.2135, 29.8853, "燈塔遺址位於法羅斯島一帶，座標為近似位置。"]
      ]
    },
    {
      id: "modern-wonders", title: "新世界七大奇蹟", note: "New7Wonders 於 2007 年公布的全球票選名單；這不是 UNESCO 官方排名。", source: "https://www.new7wonders.com/wonders/",
      items: [
        ["萬里長城", "中國", 40.4319, 116.5704, "八達嶺段參考座標。"],
        ["佩特拉古城", "約旦", 30.3285, 35.4444, "納巴泰古城與岩鑿建築群。"],
        ["里約熱內盧基督像", "巴西・里約熱內盧", -22.9519, -43.2105, "科爾科瓦多山上的基督像。"],
        ["馬丘比丘", "秘魯", -13.1631, -72.5450, "安地斯山脈的印加遺址。"],
        ["奇琴伊察", "墨西哥・尤卡坦", 20.6843, -88.5678, "瑪雅文明考古遺址。"],
        ["羅馬競技場", "義大利・羅馬", 41.8902, 12.4922, "古羅馬圓形競技場。"],
        ["泰姬瑪哈陵", "印度・阿格拉", 27.1751, 78.0421, "蒙兀兒王朝陵墓建築群。"]
      ]
    },
    {
      id: "museums", title: "三大博物館", note: "三座經典大型博物館選介，並非官方排名；開放時間請以館方公告為準。", source: "https://www.unesco.org/en/museums",
      items: [
        ["羅浮宮博物館", "法國・巴黎", 48.8606, 2.3376, "典藏涵蓋古代文明至近代藝術。"],
        ["大英博物館", "英國・倫敦", 51.5194, -0.1270, "展示世界各地歷史與文化收藏。"],
        ["大都會藝術博物館", "美國・紐約", 40.7794, -73.9632, "跨越多個地區與時代的藝術典藏。"]
      ]
    },
    {
      id: "civilizations", title: "四大古文明", note: "常見的世界史教學分類，以主要河流流域與考古區域概括；文明邊界並非現代國界。", source: "https://www.britannica.com/topic/ancient-civilization",
      items: [
        ["兩河流域文明", "底格里斯河與幼發拉底河流域", 33.1000, 44.1000, "涵蓋蘇美、阿卡德、巴比倫等多個古代政體。"],
        ["古埃及文明", "尼羅河流域・埃及", 26.8206, 30.8025, "以尼羅河流域為核心發展的古代文明。"],
        ["印度河流域文明", "今巴基斯坦與印度西北部", 27.3290, 68.1380, "哈拉帕與摩亨佐-達羅是代表性遺址。"],
        ["黃河流域文明", "中國・黃河中下游", 35.8617, 109.5000, "以黃河流域早期國家與考古文化為核心。"]
      ]
    },
    {
      id: "heritage-sites", title: "世界遺產代表地", note: "跨區域精選的 UNESCO 世界遺產地點，不是完整名單或排名；點開來源可查各地官方登錄資料。", source: "https://whc.unesco.org/en/list/",
      items: [
        ["吳哥古蹟", "柬埔寨・暹粒", 13.4125, 103.8670, "高棉帝國遺址群，以吳哥窟與吳哥城等古蹟聞名。"],
        ["佩特拉", "約旦・馬安省", 30.3285, 35.4444, "納巴泰文明的岩鑿建築與古代商貿城市。"],
        ["馬丘比丘歷史保護區", "秘魯・庫斯科大區", -13.1631, -72.5450, "安地斯山脈中的印加遺址與山地生態景觀。"],
        ["泰姬瑪哈陵", "印度・阿格拉", 27.1751, 78.0421, "17 世紀建成的大理石陵墓建築群。"],
        ["雅典衛城", "希臘・雅典", 37.9715, 23.7257, "古希臘重要遺址，帕德嫩神廟位於衛城上。"],
        ["長城（八達嶺段）", "中國・北京", 40.4319, 116.5704, "中國長城的重要代表路段；標記為八達嶺附近。"],
        ["伊瓜蘇國家公園", "阿根廷與巴西邊境", -25.6953, -54.4367, "以伊瓜蘇瀑布群及周邊亞熱帶雨林生態著稱。"],
        ["姬路城", "日本・兵庫縣", 34.8394, 134.6939, "保存完整的日本城郭建築代表之一。"]
      ]
    },
    {
      id: "natural-wonders", title: "世界七大自然奇觀", note: "採 New7Wonders of Nature 於 2011 年公布的民間票選名單；票選結果不是唯一的自然奇觀分類。", source: "https://www.new7wonders.com/wonders-of-nature/",
      items: [
        ["亞馬遜雨林", "南美洲・亞馬遜流域", -3.4653, -62.2159, "橫跨多國的熱帶雨林與河流生態系；座標為流域參考位置。"],
        ["哈隆灣", "越南・廣寧省", 20.9101, 107.1839, "以石灰岩島嶼與海灣地景聞名。"],
        ["伊瓜蘇瀑布", "阿根廷與巴西邊境", -25.6953, -54.4367, "由多條瀑布組成，位於兩國國家公園交界。"],
        ["濟州島", "韓國・濟州特別自治道", 33.3617, 126.5292, "火山島地景，含漢拏山與熔岩洞窟等自然景觀。"],
        ["科莫多國家公園", "印尼・東努沙登加拉", -8.5500, 119.4800, "由多座島嶼與海域構成，以科莫多龍及海洋生態聞名。"],
        ["公主港地下河", "菲律賓・巴拉望", 10.1800, 118.9200, "流經石灰岩洞穴的地下河，位置在公主港地下河國家公園。"],
        ["桌山", "南非・開普敦", -33.9628, 18.4098, "俯瞰開普敦的平頂山地標與自然保護區。"]
      ]
    },
    {
      id: "seven-summits", title: "七大洲最高峰", note: "採常見的 Messner 七大洲版本；大洋洲採查亞峰。另一種 Bass 版本以澳洲科修斯科峰為代表，兩者口徑不同。", source: "https://www.britannica.com/list/the-seven-summits-the-highest-mountains-on-each-continent",
      items: [
        ["珠穆朗瑪峰", "亞洲・尼泊爾／中國邊界", 27.9881, 86.9250, "海拔約 8,849 公尺，為全球最高峰。"],
        ["阿空加瓜山", "南美洲・阿根廷", -32.6532, -70.0109, "安地斯山脈高峰，也是南美洲最高峰。"],
        ["迪納利山", "北美洲・美國阿拉斯加", 63.0695, -151.0074, "阿拉斯加山脈高峰，北美洲最高峰。"],
        ["吉力馬札羅山", "非洲・坦尚尼亞", -3.0674, 37.3556, "非洲最高峰，山體由多座火山錐構成。"],
        ["厄爾布魯士山", "歐洲・俄羅斯高加索", 43.3499, 42.4453, "常見七大洲名單採用的歐洲最高峰；洲界定義存在不同看法。"],
        ["文森山", "南極洲・埃爾斯沃思山脈", -78.5254, -85.6171, "南極洲最高峰，位於偏遠的內陸山區。"],
        ["查亞峰", "大洋洲・印尼巴布亞", -4.0785, 137.1580, "Messner 版本採用的最高峰；Bass 版本則使用科修斯科峰。"]
      ]
    },
    {
      id: "great-lakes", title: "北美五大湖", note: "北美洲五大湖的地理名錄，地圖標記湖區參考中心，並非湖岸景點入口。", source: "https://www.britannica.com/place/Great-Lakes",
      items: [
        ["蘇必略湖", "美國與加拿大", 47.7000, -87.5000, "五大湖中面積最大、蓄水量最多的湖泊。"],
        ["密西根湖", "美國", 44.0000, -87.0000, "五大湖中唯一完全位於美國境內的湖泊。"],
        ["休倫湖", "美國與加拿大", 44.8000, -82.4000, "與密西根湖相連，湖區包含喬治亞灣。"],
        ["伊利湖", "美國與加拿大", 42.2000, -81.2000, "位於五大湖最南端，與尼加拉河相接。"],
        ["安大略湖", "美國與加拿大", 43.7000, -77.9000, "五大湖最東側的湖泊，經聖羅倫斯河通往大西洋。"]
      ]
    },
    {
      id: "ancient-sites", title: "古文明遺址巡禮", note: "跨文明遺址精選，不是完整名單或競賽排名；部分遺址位於更廣大的考古區域內。", source: "https://whc.unesco.org/en/list/",
      items: [
        ["烏爾古城遺址", "伊拉克・濟加爾省", 30.9626, 46.1031, "蘇美文明的重要城市遺址，包含烏爾大塔廟。"],
        ["卡納克神廟群", "埃及・路克索", 25.7188, 32.6573, "古埃及多個時期持續擴建的大型神廟建築群。"],
        ["摩亨佐-達羅", "巴基斯坦・信德省", 27.3290, 68.1380, "印度河流域文明的重要城市遺址，呈現早期城市規劃。"],
        ["波斯波利斯", "伊朗・法爾斯省", 29.9351, 52.8916, "阿契美尼德王朝的重要都城與儀典建築遺址。"],
        ["特奧蒂瓦坎", "墨西哥・墨西哥州", 19.6925, -98.8438, "中美洲古代城市遺址，以太陽金字塔與月亮金字塔聞名。"],
        ["吳哥古蹟", "柬埔寨・暹粒", 13.4125, 103.8670, "高棉文明遺址群，包含吳哥窟與吳哥城等地點。"],
        ["帕倫克古城", "墨西哥・恰帕斯州", 17.4849, -92.0460, "瑪雅文明城市遺址，保存神廟與宮殿建築群。"]
      ]
    }
  ],
  escape: value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]),
  getSaved: function() {
    try {
      const data = JSON.parse(localStorage.getItem(this.storageKey) || "[]");
      return new Set(Array.isArray(data) ? data.filter(key => typeof key === "string") : []);
    } catch (error) { return new Set(); }
  },
  save: function(groupId, itemIndex) {
    const key = `${groupId}:${itemIndex}`;
    const saved = this.getSaved();
    if (saved.has(key)) saved.delete(key); else saved.add(key);
    try { localStorage.setItem(this.storageKey, JSON.stringify([...saved])); }
    catch (error) { console.warn("世界之最收藏無法儲存：", error); }
    return saved.has(key);
  },
  getItem: function(groupId, itemIndex) {
    const group = this.groups.find(entry => entry.id === groupId);
    const index = Number(itemIndex);
    if (!group || !Number.isInteger(index) || index < 0 || index >= group.items.length) return null;
    return { group, item: group.items[index], index };
  },
  renderFilters: function(host) {
    if (!host) return;
    const filters = [{ id: "all", label: "全部" }, { id: "saved", label: "已收藏" }, ...this.groups.map(group => ({ id: group.id, label: group.title }))];
    host.innerHTML = filters.map(filter => `<button type="button" class="world-highlights-filter ${this.activeFilter === filter.id ? "active" : ""}" data-highlight-filter="${this.escape(filter.id)}" aria-pressed="${this.activeFilter === filter.id}">${this.escape(filter.label)}</button>`).join("");
  },
  applyFilters: function() {
    const host = document.getElementById("world-highlights-list");
    if (!host) return;
    const query = String(document.getElementById("world-highlights-search")?.value || "").trim().toLocaleLowerCase();
    const saved = this.getSaved();
    const clear = document.getElementById("world-highlights-clear");
    if (clear) clear.hidden = !query;
    let shown = 0;
    host.querySelectorAll(".world-highlight-group").forEach(section => {
      const group = this.groups.find(entry => entry.id === section.dataset.groupId);
      if (!group) { section.hidden = true; return; }
      const groupMatches = this.activeFilter === "all" || this.activeFilter === "saved" || this.activeFilter === group.id;
      let groupShown = 0;
      section.querySelectorAll("li[data-highlight-key]").forEach(row => {
        const key = row.dataset.highlightKey;
        const itemMatches = this.activeFilter !== "saved" || saved.has(key);
        const textMatches = !query || row.dataset.searchText.includes(query) || group.title.toLocaleLowerCase().includes(query);
        row.hidden = !(groupMatches && itemMatches && textMatches);
        if (!row.hidden) { groupShown += 1; shown += 1; }
      });
      section.hidden = !groupShown;
    });
    let empty = host.querySelector(".world-highlights-empty");
    if (!shown && !empty) {
      empty = document.createElement("p"); empty.className = "world-highlights-empty"; empty.setAttribute("role", "status");
      empty.textContent = this.activeFilter === "saved" && !query ? "還沒有收藏項目。點選地點旁的書籤即可保存。" : "找不到符合條件的名錄項目，試試其他關鍵字或篩選。";
      host.appendChild(empty);
    } else if (shown && empty) empty.remove();
    const count = document.getElementById("world-highlights-result-count");
    if (count) count.textContent = `顯示 ${shown} / ${this.groups.reduce((sum, group) => sum + group.items.length, 0)} 個地點`;
  },
  render: function() {
    const host = document.getElementById("world-highlights-list");
    if (!host) return;
    const saved = this.getSaved();
    host.innerHTML = this.groups.map(group => `
      <section class="world-highlight-group" data-group-id="${this.escape(group.id)}" aria-labelledby="highlight-${this.escape(group.id)}">
        <header><div><span class="section-kicker">CURATED COLLECTION</span><h3 id="highlight-${this.escape(group.id)}">${this.escape(group.title)}</h3><p>${this.escape(group.note)}</p></div><a href="${this.escape(group.source)}" target="_blank" rel="noopener noreferrer">資料來源 ↗</a></header>
        <ol>${group.items.map(([name, location, lat, lng, description], index) => {
          const key = `${group.id}:${index}`;
          const searchText = `${name} ${location} ${description} ${group.title} ${group.note}`.toLocaleLowerCase();
          const isSaved = saved.has(key);
          return `<li data-highlight-key="${key}" data-search-text="${this.escape(searchText)}"><span class="world-highlight-number">${index + 1}</span><button type="button" class="world-highlight-open" data-highlight-open="${group.id}" data-highlight-item="${index}" aria-label="查看${this.escape(name)}詳細介紹"><span class="world-highlight-copy"><strong>${this.escape(name)}</strong><small>${this.escape(location)}</small><span class="world-highlight-description">${this.escape(description)}</span></span><span class="world-highlight-chevron" aria-hidden="true">→</span></button><div class="world-highlight-actions"><button type="button" class="world-highlight-map" data-highlight-lat="${lat}" data-highlight-lng="${lng}" data-highlight-name="${this.escape(name)}" aria-label="在地圖查看${this.escape(name)}">地圖定位</button><button type="button" class="world-highlight-save" data-highlight-save="${key}" aria-label="${isSaved ? "取消收藏" : "收藏"}${this.escape(name)}" aria-pressed="${isSaved}" title="${isSaved ? "取消收藏" : "收藏地點"}">${isSaved ? "♥" : "♡"}</button></div></li>`;
        }).join("")}</ol>
      </section>
    `).join("");
    const search = document.getElementById("world-highlights-search");
    const filters = document.getElementById("world-highlights-filters");
    this.renderFilters(filters);
    if (search && !search.dataset.bound) {
      search.dataset.bound = "true";
      search.addEventListener("input", () => this.applyFilters());
      document.getElementById("world-highlights-clear")?.addEventListener("click", () => { search.value = ""; search.focus(); this.applyFilters(); });
      filters?.addEventListener("click", event => {
        const button = event.target.closest("[data-highlight-filter]");
        if (!button) return;
        this.activeFilter = button.dataset.highlightFilter;
        this.renderFilters(filters);
        this.applyFilters();
      });
    }
    host.onclick = event => {
      const saveButton = event.target.closest("[data-highlight-save]");
      if (saveButton) {
        const [groupId, index] = saveButton.dataset.highlightSave.split(":");
        this.save(groupId, Number(index));
        const isSaved = this.getSaved().has(saveButton.dataset.highlightSave);
        saveButton.setAttribute("aria-pressed", String(isSaved));
        saveButton.setAttribute("aria-label", `${isSaved ? "取消收藏" : "收藏"}${saveButton.closest("li")?.querySelector(".world-highlight-copy strong")?.textContent || "地點"}`);
        saveButton.title = isSaved ? "取消收藏" : "收藏地點";
        saveButton.textContent = isSaved ? "♥" : "♡";
        this.applyFilters();
        return;
      }
      const detailButton = event.target.closest("[data-highlight-open]");
      if (detailButton) {
        window.appNavigate?.("highlight-detail", { groupId: detailButton.dataset.highlightOpen, itemIndex: detailButton.dataset.highlightItem });
        return;
      }
      const mapButton = event.target.closest("[data-highlight-lat]");
      if (!mapButton) return;
      const lat = Number(mapButton.dataset.highlightLat), lng = Number(mapButton.dataset.highlightLng);
      const name = mapButton.dataset.highlightName;
      document.querySelector("#world-highlights-drawer [data-close-drawer]")?.click();
      window.appNavigate?.("world");
      window.setTimeout(() => window.mapManager?.focusCoordinates?.(lat, lng, 8.5, name), 280);
    };
    this.applyFilters();
  },
  renderDetail: function(groupId, itemIndex) {
    const host = document.getElementById("highlight-detail-content");
    const record = this.getItem(groupId, itemIndex);
    if (!host) return;
    if (!record) {
      host.innerHTML = '<div class="highlight-detail-empty"><h1 id="highlight-detail-title">找不到這筆名錄資料</h1><p>請返回世界之最，重新選擇一個項目。</p></div>';
      return;
    }
    const { group, item, index } = record;
    const [name, location, lat, lng, description] = item;
    const saved = this.getSaved().has(`${group.id}:${index}`);
    const previous = index > 0 ? `<button type="button" class="highlight-step-button" data-highlight-step="${index - 1}">← ${this.escape(group.items[index - 1][0])}</button>` : "<span></span>";
    const next = index < group.items.length - 1 ? `<button type="button" class="highlight-step-button" data-highlight-step="${index + 1}">${this.escape(group.items[index + 1][0])} →</button>` : "<span></span>";
    host.innerHTML = `<span class="section-kicker">${this.escape(group.title)} · 第 ${index + 1} / ${group.items.length} 項</span><h1 id="highlight-detail-title">${this.escape(name)}</h1><p class="highlight-detail-location">📍 ${this.escape(location)}</p><p class="highlight-detail-description">${this.escape(description)}</p><div class="highlight-detail-actions"><button type="button" class="world-highlight-save highlight-detail-save" data-highlight-detail-save data-group="${this.escape(group.id)}" data-index="${index}" aria-label="${saved ? "取消收藏" : "收藏"}${this.escape(name)}" aria-pressed="${saved}">${saved ? "♥ 已收藏" : "♡ 收藏地點"}</button><button type="button" class="primary-action highlight-locate-button" data-highlight-detail-locate data-lat="${Number(lat)}" data-lng="${Number(lng)}" data-name="${this.escape(name)}">在地圖上查看位置</button></div><div class="highlight-detail-context"><h2>關於這份名錄</h2><p>${this.escape(group.note)}</p><a href="${this.escape(group.source)}" target="_blank" rel="noopener noreferrer">查看名錄資料來源 ↗</a></div><p class="highlight-coordinate-note">地圖標記為地點參考位置；部分歷史遺址或文明範圍使用近似座標。</p><nav class="highlight-detail-pager" aria-label="同一名錄項目導覽">${previous}${next}</nav>`;
    host.onclick = event => {
      const step = event.target.closest("[data-highlight-step]");
      if (step) { window.appNavigate?.("highlight-detail", { groupId: group.id, itemIndex: Number(step.dataset.highlightStep) }); return; }
      const saveButton = event.target.closest("[data-highlight-detail-save]");
      if (saveButton) {
        const isSaved = this.save(saveButton.dataset.group, Number(saveButton.dataset.index));
        saveButton.setAttribute("aria-pressed", String(isSaved));
        saveButton.setAttribute("aria-label", `${isSaved ? "取消收藏" : "收藏"}${this.escape(name)}`);
        saveButton.textContent = isSaved ? "♥ 已收藏" : "♡ 收藏地點";
        return;
      }
      const locate = event.target.closest("[data-highlight-detail-locate]");
      if (!locate) return;
      const latitude = Number(locate.dataset.lat), longitude = Number(locate.dataset.lng), label = locate.dataset.name;
      window.appNavigate?.("world");
      window.setTimeout(() => window.mapManager?.focusCoordinates?.(latitude, longitude, 8.5, label), 260);
    };
  }
};
