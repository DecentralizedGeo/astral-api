import fs from 'fs';
// split top-level commas (tuple(...) safe)
export function parse(s){ const out=[]; let depth=0, cur=''; for(const ch of s){ if(ch==='('||ch==='[') depth++; if(ch===')'||ch===']') depth--; if(ch===','&&depth===0){out.push(cur);cur='';} else cur+=ch; } out.push(cur);
  return out.map(f=>f.trim().replace(/\s+/g,' ')).filter(Boolean).map(f=>{ const i=f.lastIndexOf(' '); return i<0?{type:'?',name:f,raw:f}:{type:f.slice(0,i).replace(/\s+/g,''),name:f.slice(i+1),raw:f}; }); }
const norm = n => n.toLowerCase().replace(/[_\-\s]/g,'');
const ROLE = { lpversion:'version', specversion:'version', srs:'srs', locationtype:'locationType', location:'location' };
const OK = { version:['string'], srs:['string'], locationType:['string'], location:['string'] };
export function classify(schema){
  const fields=parse(schema); const roles={}; const notes=[];
  for(const f of fields){ const r=ROLE[norm(f.name)]; if(!r) continue; (roles[r]??=[]).push(f); }
  for(const r in roles) if(roles[r].length>1) notes.push('duplicate '+r);
  const has = r => roles[r]?.[0];
  if(!has('location') || !has('locationType') && !has('srs')) return {tier:'non-compliant',notes};
  if(!has('srs') || !has('locationType')) return {tier:'missing-required', notes:[!has('srs')?'no srs':'no locationType']};
  const v2names = ['lp_version','srs','location_type','location'];
  const v1names = ['specVersion','srs','locationType','location'];
  const legacynames = ['srs','locationType','location'];
  const exact = names => names.every(n=>fields.some(f=>f.name===n));
  const typeBad = [];
  for(const r of ['version','srs','locationType','location']){ const f=has(r); if(!f) continue; if(!OK[r].includes(f.type)) typeBad.push(`${f.name}:${f.type}`); }
  // version field tolerance: uint8 lp_version/specVersion appears in spec EAS appendix
  const verUint = has('version') && /^uint\d+$/.test(has('version').type);
  let tier;
  if(exact(v2names)) tier='v0.2';
  else if(exact(v1names)) tier='v0.1';
  else if(!has('version') && exact(legacynames)) tier='legacy-noversion';
  else tier='name-variant';
  if(tier==='name-variant') notes.push('names differ only by case/underscore: '+['version','srs','locationType','location'].filter(has).map(r=>has(r).name).join(','));
  if(typeBad.length===0) return {tier: tier==='name-variant'?'near-compliant':'compliant-'+tier, notes};
  if(typeBad.length===1 && verUint && tier!=='name-variant') return {tier:'compliant-'+tier+' (uint version, per spec appendix)', notes:[...notes,...typeBad]};
  return {tier:'near-compliant', notes:[...notes, 'type mismatch '+typeBad.join(' ')]};
}
if (process.argv[1].endsWith('classify.mjs')) {
  const summary={};
  for (const file of fs.readdirSync('crawl')){
    const host=file.replace('.json',''); const rows=JSON.parse(fs.readFileSync('crawl/'+file));
    const s={total:rows.length, srsLocSubstring:0}; summary[host]=s;
    for(const r of rows){ const sl=r.schema.toLowerCase(); if(sl.includes('srs')&&sl.includes('location')) s.srsLocSubstring++;
      const c=classify(r.schema); if(c.tier==='non-compliant') continue; s[c.tier]=(s[c.tier]||0)+1;
      console.log([host.replace('.easscan.org','')||'mainnet', r.id, r._count.attestations, c.tier, c.notes.join('; '), r.schema].join('\t')); }
  }
  console.error(JSON.stringify(summary,null,1));
}
