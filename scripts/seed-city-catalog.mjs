import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import admin from 'firebase-admin';

const root = process.cwd();
const input = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const window = {};
['src/data/travelData.js','src/data/countries/asia.js','src/data/countries/europe.js','src/data/countries/others.js','src/data/globalCities.js','src/data/cityCatalogExpansion.js','src/data/cityGeonames.js','src/data/cityEnrichment.js'].forEach(file => vm.runInNewContext(input(file), {window}, {filename:file}));
const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || 'dt-action-app';
admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId });
const db = admin.firestore();
const slug = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').normalize('NFKC').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,120) || 'spot';
let cityCount = 0;
let spotCount = 0;
for (const city of window.TRAVEL_DATA.globalCities || []) {
  if (!city?.id) continue;
  const sourceSpots = [...(Array.isArray(city.spots) ? city.spots : []), ...(Array.isArray(city.spotCandidates) ? city.spotCandidates : [])].filter((spot,index,list) => {
    const name = String(typeof spot === 'string' ? spot : spot?.name || '').trim();
    if (!name) return false;
    return list.findIndex(candidate => String(typeof candidate === 'string' ? candidate : candidate?.name || '').trim().normalize('NFKC').toLocaleLowerCase() === name.normalize('NFKC').toLocaleLowerCase()) === index;
  });
  await db.collection('cities').doc(city.id).set({
    id:city.id, name:city.name || city.englishName || city.id, englishName:city.englishName || city.name || '',
    countryName:city.countryName || '', countryCode:city.countryCode || '', flag:city.flag || '', continentName:city.continentName || '',
    lat:Number.isFinite(Number(city.lat)) ? Number(city.lat) : null, lng:Number.isFinite(Number(city.lng)) ? Number(city.lng) : null,
    description:city.descriptionSource?.text || city.description || '', sourceLabel:city.descriptionSource?.sourceLabel || '後台城市目錄',
    sourceUrl:city.descriptionSource?.pageUrl || city.coordinateSource?.sourceUrl || '', spotCount:sourceSpots.length,
    publishedAt:admin.firestore.FieldValue.serverTimestamp(), dataVersion:'2026.11.21-published-catalog'
  }, {merge:true});
  cityCount++;
  for (let index=0; index<sourceSpots.length; index++) {
    const candidate=sourceSpots[index];
    const spot=typeof candidate==='string' ? {name:candidate} : candidate;
    const name=String(spot.name || '').trim();
    if (!name) continue;
    await db.collection('cities').doc(city.id).collection('spots').doc(`${String(index).padStart(3,'0')}-${slug(name)}`).set({
      index,name,englishName:spot.englishName || '',category:spot.category || '景點',tag:spot.tag || '',note:spot.note || '',
      description:spot.description || spot.note || '',lat:Number.isFinite(Number(spot.lat)) ? Number(spot.lat) : null,
      lng:Number.isFinite(Number(spot.lng)) ? Number(spot.lng) : null,sourceUrl:spot.sourceUrl || spot.pageUrl || '',
      sourceLabel:spot.sourceLabel || '專案館藏資料',website:spot.website || '',openingHours:spot.openingHours || '',
      address:spot.address || '',rating:Number.isFinite(Number(spot.rating)) ? Number(spot.rating) : null,
      ratingSource:spot.ratingSource || '',publishedAt:admin.firestore.FieldValue.serverTimestamp()
    }, {merge:true});
    spotCount++;
  }
}
console.log(JSON.stringify({projectId,cityCount,spotCount},null,2));
