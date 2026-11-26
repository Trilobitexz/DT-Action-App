import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "src", "data", "city-spots");
const files = fs.readdirSync(dataDir).filter(file => file.endsWith(".json")).sort();
const flags = [];
let total = 0;
const totals = { missingImage: 0, missingDescription: 0, missingCoordinates: 0, missingSource: 0 };
const eventPattern = /墜機|坠机|空難|空难|爆炸事件|槍擊|枪击|恐攻|恐怖襲擊|恐怖袭击|事故|災難|灾难|死亡事件/iu;
const lowTourismPattern = /\b(?:university|college|district|municipality|suburb|headquarters)\b|區政府|行政區|行政区|大學校區|大学校区/iu;

for (const file of files) {
  const cities = JSON.parse(fs.readFileSync(path.join(dataDir, file), "utf8"));
  for (const [cityId, spots] of Object.entries(cities)) {
    for (const spot of spots) {
      total++;
      const name = String(spot.name || "").trim();
      const description = String(spot.description || spot.summary || spot.note || "").trim();
      const hasCoords = Number.isFinite(Number(spot.lat)) && Number(spot.lat) >= -90 && Number(spot.lat) <= 90
        && Number.isFinite(Number(spot.lng)) && Number(spot.lng) >= -180 && Number(spot.lng) <= 180
        && !(Number(spot.lat) === 0 && Number(spot.lng) === 0);
      const hasSource = /^https?:\/\//i.test(String(spot.sourceUrl || ""));
      const imageUrl = spot.imageUrl || spot.image || "";
      if (!imageUrl) totals.missingImage++;
      if (description.length < 40) totals.missingDescription++;
      if (!hasCoords) totals.missingCoordinates++;
      if (!hasSource) totals.missingSource++;
      if (eventPattern.test(`${name} ${description}`)) flags.push({ level: "REVIEW", file, cityId, name, reason: "可能是災難／事件條目，人工確認是否適合作為旅遊景點" });
      if (lowTourismPattern.test(name)) flags.push({ level: "REVIEW", file, cityId, name, reason: "名稱像行政區或教育機構，人工確認觀光價值" });
      if (!hasCoords || !hasSource) flags.push({ level: "ERROR", file, cityId, name, reason: !hasCoords ? "缺少有效座標" : "缺少可用來源網址" });
    }
  }
}

console.log(`城市景點資料稽核：${files.length} 個檔案，${total} 筆景點`);
console.log(`缺圖片 ${totals.missingImage}；短介紹（少於 40 字）${totals.missingDescription}；缺座標 ${totals.missingCoordinates}；缺來源 ${totals.missingSource}`);
console.log(`需要人工確認的內容：${flags.length} 筆`);
for (const item of flags) console.log(`[${item.level}] ${item.file} / ${item.cityId} / ${item.name} — ${item.reason}`);
