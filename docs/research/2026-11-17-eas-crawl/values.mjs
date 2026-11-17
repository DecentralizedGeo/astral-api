const jobs = [
 ['sepolia.easscan.org','0xba4171c92572b1e4f241d044c32cdf083be9fd946b8766977558ca6378c824e2'],
 ['base.easscan.org','0xba4171c92572b1e4f241d044c32cdf083be9fd946b8766977558ca6378c824e2'],
 ['sepolia.easscan.org','0xde87be8a0b537bf996e1a623a3f98aaa51aad3b3362b56c3fac10fd81582ba81'],
 ['base-sepolia.easscan.org','0xde87be8a0b537bf996e1a623a3f98aaa51aad3b3362b56c3fac10fd81582ba81'],
 ['sepolia.easscan.org','0x3902cc7b8e415eb1ed9ac496431c31c88023cdbde0821cbb81195a8bcf74fffd'],
 ['sepolia.easscan.org','0x7e142d0cf99968d3b5d87cb4ec232f4fcca52fd15b808a073bd588526529111c'],
 ['sepolia.easscan.org','0xcb0405c020bc47f186c9dcfaa6e67e2addadff14afd2f29f9e51bda602324845'],
 ['sepolia.easscan.org','0x5894dbce58b99f80288b8a9e06bc4763d2df445b4c9e9f6ff302ab66aabec0fe'],
];
const Q = `query($id:String!,$take:Int!,$cursor:AttestationWhereUniqueInput,$skip:Int){ attestations(where:{schemaId:{equals:$id}}, orderBy:[{timeCreated:asc},{id:asc}], take:$take, cursor:$cursor, skip:$skip){ id decodedDataJson isOffchain revoked } }`;
async function gql(host, variables){ for (let a=0;a<4;a++){ try{ const r=await fetch(`https://${host}/graphql`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:Q,variables})}); const j=await r.json(); if(j.errors) throw new Error(JSON.stringify(j.errors).slice(0,300)); return j.data.attestations;}catch(e){ console.error('retry',host,a,e.message.slice(0,120)); await new Promise(r=>setTimeout(r,1000*(a+1)));} } throw new Error('failed'); }
for (const [host,id] of jobs){
  const tally = {}; let n=0, cursor=null, pages=0, off=0, rev=0;
  while(true){
    const v = {id, take:30}; if(cursor){ v.cursor={id:cursor}; v.skip=1; }
    const rows = await gql(host, v); pages++;
    for(const a of rows){ n++; if(a.isOffchain) off++; if(a.revoked) rev++; let d; try{ d=JSON.parse(a.decodedDataJson);}catch{continue}
      for(const f of d){ const k=f.name; if(!/^(srs|locationType|location_type|lp_version|specVersion)$/.test(k)) continue; let val=f.value?.value; if(val&&val.hex) val='0x'+parseInt(val.hex,16); val=String(val).slice(0,40); tally[k]??={}; tally[k][val]=(tally[k][val]||0)+1; }
      if (n<=1 || n%200==0) {} }
    if(rows.length<30) break; cursor=rows[rows.length-1].id;
  }
  console.log(`\n## ${host} ${id.slice(0,12)} n=${n} pages=${pages} offchain=${off} revoked=${rev}`);
  for(const [k,m] of Object.entries(tally)) console.log(' ',k, JSON.stringify(Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,8)));
}
