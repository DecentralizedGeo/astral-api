import fs from 'fs';
const hosts = process.argv.slice(2);
const Q = `query($take:Int!,$cursor:SchemaWhereUniqueInput,$skip:Int){ schemata(orderBy:[{time:asc},{id:asc}], take:$take, cursor:$cursor, skip:$skip){ id schema time _count{attestations} } }`;
async function gql(host, variables){ for (let a=0;a<5;a++){ const t=Date.now(); try{ const r=await fetch(`https://${host}/graphql`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:Q,variables})}); if(r.status!==200) throw new Error('HTTP '+r.status); const j=await r.json(); if(j.errors) throw new Error(JSON.stringify(j.errors).slice(0,300)); return [j.data.schemata, Date.now()-t];}catch(e){ console.error('retry',host,a,e.message.slice(0,120)); await new Promise(r=>setTimeout(r,1500*(a+1)));} } throw new Error('failed'); }
for (const host of hosts){
  const all=[]; let cursor=null, ms=0, pages=0; const t0=Date.now();
  while(true){ const v={take:250}; if(cursor){v.cursor={id:cursor}; v.skip=1;} const [rows,dt]=await gql(host,v); ms+=dt; pages++; all.push(...rows); if(rows.length<250) break; cursor=rows.at(-1).id; }
  fs.writeFileSync(`crawl/${host}.json`, JSON.stringify(all));
  console.log(`${host} schemas=${all.length} pages=${pages} wall=${Date.now()-t0}ms`);
}
