import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = path.join(root, "scripts", "data", "prebuilt-spots.json");
const rulesPath = path.join(root, "firestore.rules");
const checkOnly = process.argv.includes("--check");
const catalog = JSON.parse(await fs.readFile(catalogPath, "utf8"));
const cityIds = [...new Set((catalog.cities || []).map(city => String(city.id || "").trim()).filter(Boolean))].sort();
const sandbox = { window: { TRAVEL_DATA: {} } };
for (const sourceFile of [
  "src/data/travelData.js",
  "src/data/countries/asia.js",
  "src/data/countries/europe.js",
  "src/data/countries/others.js",
  "src/data/globalCities.js",
  "src/data/cityCatalogExpansion.js",
  "src/data/cityEnrichment.js"
]) {
  vm.runInNewContext(await fs.readFile(path.join(root, sourceFile), "utf8"), sandbox, { filename: sourceFile });
}
const runtimeCityIds = [...new Set([
  ...(sandbox.window.TRAVEL_DATA.globalCities || []),
  ...(sandbox.window.TRAVEL_DATA.countries || []).flatMap(country => country.cities || [])
].map(city => String(city.id || "").trim()).filter(Boolean))].sort();

if (!cityIds.length || cityIds.some(cityId => !/^[a-z0-9-]{1,120}$/.test(cityId))) {
  throw new Error("City catalog contains no IDs or an ID that cannot be safely represented in Firestore Rules.");
}
if (JSON.stringify(cityIds) !== JSON.stringify(runtimeCityIds)) {
  throw new Error("Firestore budget IDs do not match the cities exposed by the runtime catalog.");
}

const rules = await fs.readFile(rulesPath, "utf8");
const functionStartMarker = "function isAllowedBudgetDataId(dataId) {";
const functionEndMarker = "function isLegacyBudgetDataId(dataId)";
const functionStart = rules.indexOf(functionStartMarker);
const functionEnd = rules.indexOf(functionEndMarker, functionStart);
if (functionStart < 0 || functionEnd < 0) throw new Error("Could not find isAllowedBudgetDataId() in firestore.rules.");
const functionBlock = rules.slice(functionStart, functionEnd);
const currentMatch = functionBlock.match(/return dataId\.matches\('([^']+)'\);/);

const expectedPattern = `^budget-(${cityIds.join("|")})$`;
const budgetIdPattern = new RegExp(expectedPattern);
if (cityIds.some(cityId => !budgetIdPattern.test(`budget-${cityId}`))
  || ["budget-unknown-city", "budget-tokyo-extra", "budget-", "x-budget-tokyo"].some(value => budgetIdPattern.test(value))) {
  throw new Error("Generated Firestore budget ID pattern does not match the current city ID set.");
}
if (currentMatch?.[1] === expectedPattern) {
  console.log(`Firestore budget ID allowlist is current: ${cityIds.length} cities.`);
} else if (checkOnly) {
  throw new Error(`Firestore budget ID allowlist is stale; expected ${cityIds.length} city IDs. Run npm run sync:firestore-budget-rules.`);
} else {
  const replacement = `function isAllowedBudgetDataId(dataId) {\n      return dataId.matches('${expectedPattern}');\n    }\n\n    `;
  const updatedRules = rules.slice(0, functionStart) + replacement + rules.slice(functionEnd);
  await fs.writeFile(rulesPath, updatedRules, "utf8");
  console.log(`Updated Firestore budget ID allowlist: ${cityIds.length} cities.`);
}
