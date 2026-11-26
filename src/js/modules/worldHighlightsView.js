window.WorldHighlightsView = {
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
      id: "museums", title: "三座世界知名博物館", note: "代表性博物館選介，並非官方排名；開放時間請以館方公告為準。", source: "https://www.unesco.org/en/museums",
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
    }
  ],
  escape: value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]),
  getItem: function(groupId, itemIndex) {
    const group = this.groups.find(entry => entry.id === groupId);
    const index = Number(itemIndex);
    if (!group || !Number.isInteger(index) || index < 0 || index >= group.items.length) return null;
    return { group, item: group.items[index], index };
  },
  render: function() {
    const host = document.getElementById("world-highlights-list");
    if (!host) return;
    host.innerHTML = this.groups.map(group => `
      <section class="world-highlight-group" aria-labelledby="highlight-${group.id}">
        <header><div><span class="section-kicker">CURATED COLLECTION</span><h3 id="highlight-${group.id}">${this.escape(group.title)}</h3><p>${this.escape(group.note)}</p></div><a href="${group.source}" target="_blank" rel="noopener noreferrer">資料來源 ↗</a></header>
        <ol>${group.items.map(([name, location, lat, lng, description], index) => `
          <li><span class="world-highlight-number">${index + 1}</span><button type="button" class="world-highlight-open" data-highlight-open="${group.id}" data-highlight-item="${index}" aria-label="查看${this.escape(name)}詳細介紹"><span class="world-highlight-copy"><strong>${this.escape(name)}</strong><small>${this.escape(location)}</small><span class="world-highlight-description">${this.escape(description)}</span></span><span class="world-highlight-chevron" aria-hidden="true">→</span></button><button type="button" class="world-highlight-map" data-highlight-lat="${lat}" data-highlight-lng="${lng}" data-highlight-name="${this.escape(name)}" aria-label="在地圖查看${this.escape(name)}">地圖定位</button></li>
        `).join("")}</ol>
      </section>
    `).join("");
    host.onclick = event => {
      const detailButton = event.target.closest("[data-highlight-open]");
      if (detailButton) {
        window.appNavigate?.("highlight-detail", { groupId: detailButton.dataset.highlightOpen, itemIndex: detailButton.dataset.highlightItem });
        return;
      }
      const button = event.target.closest("[data-highlight-lat]");
      if (!button) return;
      const lat = Number(button.dataset.highlightLat), lng = Number(button.dataset.highlightLng);
      const close = document.querySelector("#world-highlights-drawer [data-close-drawer]");
      close?.click();
      window.appNavigate?.("world");
      window.setTimeout(() => window.mapManager?.focusCoordinates?.(lat, lng, 8.5, button.dataset.highlightName), 280);
    };
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
    host.innerHTML = `<span class="section-kicker">${this.escape(group.title)} · 第 ${index + 1} 項</span><h1 id="highlight-detail-title">${this.escape(name)}</h1><p class="highlight-detail-location">📍 ${this.escape(location)}</p><p class="highlight-detail-description">${this.escape(description)}</p><div class="highlight-detail-context"><h2>關於這份名錄</h2><p>${this.escape(group.note)}</p><a href="${this.escape(group.source)}" target="_blank" rel="noopener noreferrer">查看名錄資料來源 ↗</a></div><p class="highlight-coordinate-note">地圖標記為地點參考位置；部分古代遺址或文明範圍使用近似座標。</p><button type="button" class="primary-action highlight-locate-button" data-highlight-detail-locate data-lat="${Number(lat)}" data-lng="${Number(lng)}" data-name="${this.escape(name)}">在地圖上查看位置</button>`;
    host.onclick = event => {
      const locate = event.target.closest("[data-highlight-detail-locate]");
      if (!locate) return;
      const latitude = Number(locate.dataset.lat), longitude = Number(locate.dataset.lng);
      window.appNavigate?.("world");
      window.setTimeout(() => window.mapManager?.focusCoordinates?.(latitude, longitude, 8.5, locate.dataset.name), 260);
    };
  }
};
