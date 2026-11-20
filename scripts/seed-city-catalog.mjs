import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import admin from 'firebase-admin';

const root=process.cwd();
const input=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const window={};
['src/data/travelData.js','src/data/countries/asia.js','src/data/countries/europe.js','src/data/countries/others.js','src/data/globalCities.js','src/data/cityCatalogExpansion.js','src/data/cityGeonames.js','src/data/cityEnrichment.js'].forEach(file=>vm.runInNewContext(input(file),{window},{filename:file}));
const projectId=process.env.FIREBASE_PROJECT_ID||process.env.GCLOUD_PROJECT||'dt-action-app';
admin.initializeApp({credential:admin.credential.applicationDefault(),projectId});
const db=admin.firestore();
const normalize=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').normalize('NFKC').trim().toLocaleLowerCase().replace(/[\s\p{P}]+/gu,'');
const slug=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').normalize('NFKC').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,120)||'spot';
const distanceKm=(lat1,lng1,lat2,lng2)=>{const r=Math.PI/180;const dLat=(lat2-lat1)*r;const dLng=(lng2-lng1)*r;const a=Math.sin(dLat/2)**2+Math.cos(lat1*r)*Math.cos(lat2*r)*Math.sin(dLng/2)**2;return 6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));};
const attractionCategory=/tourist attraction|museum|gallery|monument|memorial|park|garden|temple|church|mosque|cathedral|castle|palace|historic|heritage|archaeolog|landmark|monastery|shrine|square|bridge|tower|theatre|theater|zoo|aquarium|fort|beach|waterfall|mountain|botanical|island|cave|stadium|opera|library|market|district|plaza|building|protected area/i;
async function fetchWikipediaSpots(city){
  if(!Number.isFinite(Number(city.lat))||!Number.isFinite(Number(city.lng))) return [];
  const params=new URLSearchParams({action:'query',generator:'geosearch',ggscoord:`${city.lat}|${city.lng}`,ggsradius:'20000',ggslimit:'50',ggsnamespace:'0',prop:'coordinates|extracts|categories',exintro:'1',explaintext:'1',exsentences:'2',cllimit:'20',clshow:'!hidden',format:'json',formatversion:'2',origin:'*'});
  const res=await fetch('https://en.wikipedia.org/w/api.php?'+params,{headers:{'User-Agent':'JourneyAtlasCityCatalog/2.0'}});
  if(!res.ok) throw new Error('Wikipedia HTTP '+res.status);
  const data=await res.json();
  return (data.query?.pages||[]).map(page=>{
    const point=page.coordinates?.[0];const lat=Number(point?.lat);const lng=Number(point?.lon);
    if(!page.title||!Number.isFinite(lat)||!Number.isFinite(lng)) return null;
    const distance=distanceKm(city.lat,city.lng,lat,lng);
    if(distance>20) return null;
    const categories=(page.categories||[]).map(item=>String(item.title||'').replace(/^Category:/,''));
    if(!categories.some(category=>attractionCategory.test(category))) return null;
    const categoryText=categories.join(' ').toLowerCase();
    const category=/museum|gallery/i.test(categoryText)?'博物館與藝術':/park|garden|botanical|protected area|waterfall|mountain|beach|island|cave/i.test(categoryText)?'公園與自然':/temple|church|mosque|cathedral|monastery|shrine/i.test(categoryText)?'宗教建築':/historic|heritage|archaeolog|castle|palace|fort|monument|memorial/i.test(categoryText)?'歷史與文化遺產':/district|square|plaza|market/i.test(categoryText)?'街區與市集':'地標與建築';
    const pageUrl='https://en.wikipedia.org/wiki/'+encodeURIComponent(page.title.replaceAll(' ','_'));
    return {name:page.title,category,tag:'Wikipedia 地理景點',note:String(page.extract||'').replace(/\s+/g,' ').trim(),description:String(page.extract||'').replace(/\s+/g,' ').trim(),lat,lng,sourceUrl:pageUrl,sourceLabel:'English Wikipedia geosearch',distanceKm:Math.round(distance*100)/100};
  }).filter(Boolean).sort((a,b)=>a.distanceKm-b.distanceKm).slice(0,12);
}
let cityCount=0;let spotCount=0;let citiesWithWikipedia=0;
for(const city of window.TRAVEL_DATA.globalCities||[]) {
  if(!city?.id) continue;
  let sourceSpots=[...(Array.isArray(city.spots)?city.spots:[]),...(Array.isArray(city.spotCandidates)?city.spotCandidates:[])];
  if(Number.isFinite(Number(city.lat))&&Number.isFinite(Number(city.lng))) {
    try {
      const live=await fetchWikipediaSpots(city);
      if(live.length) citiesWithWikipedia++;
      sourceSpots=[...sourceSpots,...live];
    } catch(error) { console.warn('Wikipedia query failed:',city.id,error.message); }
  }
  sourceSpots=sourceSpots.filter((spot,index,list)=>{
    const name=String(typeof spot==='string'?spot:spot?.name||'').trim();if(!name)return false;
    return list.findIndex(candidate=>normalize(typeof candidate==='string'?candidate:candidate?.name||'')===normalize(name))===index;
  });
  await db.collection('cities').doc(city.id).set({id:city.id,name:city.name||city.englishName||city.id,englishName:city.englishName||city.name||'',countryName:city.countryName||'',countryCode:city.countryCode||'',flag:city.flag||'',continentName:city.continentName||'',lat:Number.isFinite(Number(city.lat))?Number(city.lat):null,lng:Number.isFinite(Number(city.lng))?Number(city.lng):null,description:city.descriptionSource?.text||city.description||'',sourceLabel:city.descriptionSource?.sourceLabel||'後台城市目錄',sourceUrl:city.descriptionSource?.pageUrl||city.coordinateSource?.sourceUrl||'',spotCount:sourceSpots.length,publishedAt:admin.firestore.FieldValue.serverTimestamp(),dataVersion:'2026.11.21-published-catalog-wikipedia'}, {merge:true});
  cityCount++;
  for(let index=0;index<sourceSpots.length;index++){
    const candidate=sourceSpots[index];const spot=typeof candidate==='string'?{name:candidate}:candidate;const name=String(spot.name||'').trim();if(!name)continue;
    await db.collection('cities').doc(city.id).collection('spots').doc(`${String(index).padStart(3,'0')}-${slug(name)}`).set({index,name,englishName:spot.englishName||'',category:spot.category||'景點',tag:spot.tag||'',note:spot.note||'',description:spot.description||spot.note||'',lat:Number.isFinite(Number(spot.lat))?Number(spot.lat):null,lng:Number.isFinite(Number(spot.lng))?Number(spot.lng):null,sourceUrl:spot.sourceUrl||spot.pageUrl||'',sourceLabel:spot.sourceLabel||'專案館藏資料',website:spot.website||'',openingHours:spot.openingHours||'',address:spot.address||'',rating:Number.isFinite(Number(spot.rating))?Number(spot.rating):null,ratingSource:spot.ratingSource||'',publishedAt:admin.firestore.FieldValue.serverTimestamp()}, {merge:true});spotCount++;
  }
  await new Promise(resolve=>setTimeout(resolve,750));
}
console.log(JSON.stringify({projectId,cityCount,spotCount,citiesWithWikipedia},null,2));
