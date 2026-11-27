const timeoutMs = 20000;
const batchSize = 30;
const requestGapMs = 250;
const userAgent = "JourneyAtlasImageAttribution/1.0 (https://github.com/Trilobitexz/Journey-Atlas)";

const decodeEntities = value => String(value || "")
  .replace(/<br\s*\/?>/gi, "; ")
  .replace(/<[^>]*>/g, " ")
  .replace(/&nbsp;|&#160;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, "<")
  .replace(/&gt;/gi, ">")
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
  .replace(/\s+/g, " ")
  .trim();

const normalizeTitle = value => String(value || "")
  .replace(/^File:/i, "")
  .replace(/_/g, " ")
  .normalize("NFKC")
  .trim()
  .toLocaleLowerCase();

function imageFileReference(imageUrl) {
  let url;
  try {
    url = new URL(String(imageUrl || ""));
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;

  const parts = url.pathname.split("/").filter(Boolean).map(part => {
    try { return decodeURIComponent(part); } catch { return part; }
  });
  const specialFilePathIndex = parts.findIndex(part => /^Special:FilePath$/i.test(part));
  if (specialFilePathIndex >= 0 && parts[specialFilePathIndex + 1]) {
    return {
      apiUrl: "https://commons.wikimedia.org/w/api.php",
      fileName: parts[specialFilePathIndex + 1].replace(/_/g, " "),
      filePageBase: "https://commons.wikimedia.org/wiki/"
    };
  }

  const wikipediaIndex = parts.indexOf("wikipedia");
  if (wikipediaIndex < 0) return null;
  const project = String(parts[wikipediaIndex + 1] || "").toLowerCase();
  if (!/^(commons|[a-z-]+)$/.test(project)) return null;
  const apiHost = project === "commons" ? "commons.wikimedia.org" : `${project}.wikipedia.org`;
  const thumbIndex = parts.indexOf("thumb", wikipediaIndex + 2);
  const fileName = thumbIndex >= 0
    ? parts[thumbIndex + 3]
    : parts.at(-1);
  if (!fileName || /^(?:\d+px-|thumb\/)/i.test(fileName)) return null;
  return {
    apiUrl: `https://${apiHost}/w/api.php`,
    fileName: fileName.replace(/_/g, " "),
    filePageBase: `https://${apiHost}/wiki/`
  };
}

function buildAttribution(page, reference) {
  const ext = page?.imageinfo?.[0]?.extmetadata || {};
  const author = decodeEntities(ext.Artist?.value || "") || decodeEntities(ext.Credit?.value || "");
  const license = decodeEntities(ext.LicenseShortName?.value || ext.UsageTerms?.value || "");
  const attributionRequired = String(ext.AttributionRequired?.value || "").toLowerCase() === "true";
  const noAuthorRequired = /\bcc0\b|public domain|\bpdm\b|\bpd[- ]/i.test(license)
    || String(ext.AttributionRequired?.value || "").toLowerCase() === "false";
  if (!license || (!author && !noAuthorRequired)) return null;

  const fileName = String(page.title || `File:${reference.fileName}`).replace(/^File:/i, "");
  const imageAttribution = [fileName, author, license].filter(Boolean).join(" · ");
  const rawLicenseUrl = decodeEntities(ext.LicenseUrl?.value || "");
  let imageLicenseUrl = "";
  if (rawLicenseUrl) {
    try {
      const parsed = new URL(rawLicenseUrl.startsWith("//") ? `https:${rawLicenseUrl}` : rawLicenseUrl);
      if (parsed.protocol === "https:") imageLicenseUrl = parsed.href;
    } catch { /* Keep the textual license when the metadata URL is malformed. */ }
  }
  const titleForUrl = `File:${fileName.replace(/ /g, "_")}`;
  const imageSourceUrl = `${reference.filePageBase}${encodeURIComponent(titleForUrl).replace(/%3A/i, ":")}`;
  return {
    imageSourceUrl,
    imageAttribution,
    imageArtist: author,
    imageLicense: license,
    imageLicenseUrl,
    attributionRequired
  };
}

async function requestBatch(apiUrl, fileNames) {
  const url = new URL(apiUrl);
  const params = {
    action: "query",
    titles: fileNames.map(fileName => `File:${fileName}`).join("|"),
    prop: "imageinfo",
    iiprop: "extmetadata",
    redirects: "1",
    format: "json",
    formatversion: "2"
  };
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  let lastError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": userAgent },
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (response.status === 429 || response.status >= 500) {
        const retryAfter = Number(response.headers.get("retry-after")) || attempt + 1;
        await new Promise(resolve => setTimeout(resolve, Math.min(retryAfter * 1000, 10000)));
        continue;
      }
      if (!response.ok) throw new Error(`Wikimedia API returned HTTP ${response.status}`);
      const data = await response.json();
      if (data.error) throw new Error(`Wikimedia API ${data.error.code}: ${data.error.info}`);
      return data.query?.pages || [];
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  throw lastError || new Error("Wikimedia API request failed after retries.");
}

export async function resolveWikimediaImageMetadata(spots, { clearUnverified = false } = {}) {
  const references = new Map();
  let unsupported = 0;
  for (const spot of spots || []) {
    if (!spot || !String(spot.imageUrl || "").trim()) continue;
    if (isImageAttributionComplete(spot)) continue;
    const reference = imageFileReference(spot.imageUrl);
    if (!reference) {
      unsupported += 1;
      continue;
    }
    const key = `${reference.apiUrl}|${normalizeTitle(reference.fileName)}`;
    if (!references.has(key)) references.set(key, { ...reference, spots: [] });
    references.get(key).spots.push(spot);
  }

  const groups = new Map();
  for (const item of references.values()) {
    if (!groups.has(item.apiUrl)) groups.set(item.apiUrl, []);
    groups.get(item.apiUrl).push(item);
  }

  let requestCount = 0;
  let matched = 0;
  let unresolved = 0;
  for (const [apiUrl, items] of groups) {
    for (let offset = 0; offset < items.length; offset += batchSize) {
      if (requestCount) await new Promise(resolve => setTimeout(resolve, requestGapMs));
      const batch = items.slice(offset, offset + batchSize);
      const pages = await requestBatch(apiUrl, batch.map(item => item.fileName));
      requestCount += 1;
      const pagesByTitle = new Map(pages.map(page => [normalizeTitle(page.title), page]));
      for (const item of batch) {
        const page = pagesByTitle.get(normalizeTitle(`File:${item.fileName}`));
        const metadata = buildAttribution(page, item);
        if (metadata) {
          item.spots.forEach(spot => Object.assign(spot, metadata));
          matched += item.spots.length;
        } else {
          unresolved += item.spots.length;
          if (clearUnverified) {
            item.spots.forEach(spot => {
              spot.imageUrl = "";
              spot.imageSourceUrl = "";
              spot.imageAttribution = "";
              spot.imageArtist = "";
              spot.imageLicense = "";
              spot.imageLicenseUrl = "";
            });
          }
        }
      }
    }
  }
  if (clearUnverified) {
    for (const spot of spots || []) {
      if (!String(spot?.imageUrl || "").trim() || isImageAttributionComplete(spot)) continue;
      spot.imageUrl = "";
      spot.imageSourceUrl = "";
      spot.imageAttribution = "";
      spot.imageArtist = "";
      spot.imageLicense = "";
      spot.imageLicenseUrl = "";
    }
  }
  return { imageCount: references.size, matched, unresolved, unsupported, requestCount };
}

export function isImageAttributionComplete(spot) {
  return Boolean(String(spot?.imageUrl || "").trim()
    && /^https:\/\//i.test(String(spot?.imageSourceUrl || ""))
    && String(spot?.imageAttribution || "").trim()
    && String(spot?.imageLicense || "").trim());
}
