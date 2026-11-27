import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isImageAttributionComplete, resolveWikimediaImageMetadata } from "./wikimedia-image-metadata.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = path.join(root, "scripts", "data", "prebuilt-spots.json");
const catalog = JSON.parse(await fs.readFile(catalogPath, "utf8"));
const spots = (catalog.cities || []).flatMap(city => city.spots || []);
const checkOnly = process.argv.includes("--check");

const remaining = () => spots.filter(spot => String(spot.imageUrl || "").trim() && !isImageAttributionComplete(spot));
if (checkOnly) {
  const incomplete = remaining();
  console.log(`預建資料圖片署名檢查：${spots.filter(spot => String(spot.imageUrl || "").trim()).length} 張圖片，${incomplete.length} 張缺少作者、授權或檔案來源頁。`);
  if (incomplete.length) process.exitCode = 1;
} else {
  const report = await resolveWikimediaImageMetadata(spots, { clearUnverified: true });
  const incomplete = remaining();
  catalog.generatedAt = new Date().toISOString();
  await fs.writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  console.log(`Wikimedia 署名同步完成：解析 ${report.imageCount} 個檔案、${report.requestCount} 次 API 請求、${report.matched} 張補齊作者與授權、${report.unresolved} 張無法確認並移除照片、${report.unsupported} 張不支援格式。`);
  console.log(`仍缺署名的可見圖片：${incomplete.length}`);
  if (incomplete.length) process.exitCode = 1;
}
