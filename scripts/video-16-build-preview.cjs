'use strict';
// VIDEO-16: generate an isolated, self-contained Android preview from real NHL data.
// Never publishes or changes production; the output is a downloadable Actions artifact.
const fs=require('node:fs');
const path=require('node:path');
const {collect}=require('../video/live-highlights.js');
const id='2026020335';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
(async()=>{
 const response=await fetch('https://api-web.nhle.com/v1/gamecenter/'+id+'/landing',{signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('NHL API HTTP '+response.status);
 const data=await response.json();
 const clips=collect(id,data);
 const byEvent=new Map(clips.map(c=>[c.eventId,c]));
 const periods=Array.isArray(data.summary?.scoring)?data.summary.scoring:[];
 const goalCount=periods.reduce((n,p)=>n+(p.goals||[]).length,0);
 if(!goalCount||!clips.some(c=>c.status==='link-available'))throw Error('No valid official clips: refusing to build misleading preview');
 const rows=periods.map((p,i)=>'<section><h2>'+escape(p.periodDescriptor?.number||i+1)+'. třetina</h2>'+
 (p.goals||[]).map(g=>{
  const clip=byEvent.get(Number(g.eventId??g.eventID));
  const title=escape(g.name?.default||g.name||'Gól');
  const time=escape(g.timeInPeriod||'');
  const team=escape(g.teamAbbrev||'');
  const link=clip?.status==='link-available'?'<a href="'+escape(clip.officialUrl)+'" target="_blank" rel="noopener noreferrer">▶ Přehrát oficiální video NHL</a>':'<span class="pending">Video zatím není dostupné</span>';
  return '<article><div><strong>'+title+'</strong><small>'+team+' · '+time+'</small></div>'+link+'</article>';
 }).join('')+'</section>').join('');
 const html='<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BANGER VIDEO-16 – test na Androidu</title><style>body{margin:0;background:#061325;color:#e8faff;font:16px system-ui;padding:18px;max-width:720px;margin-inline:auto}h1{font-size:1.5rem}h2{font-size:1.1rem;color:#41eaff}article{background:#102442;border:1px solid #23466c;border-radius:12px;padding:14px;margin:10px 0;display:flex;flex-direction:column;gap:12px}small{display:block;color:#b7cadc;margin-top:5px}a{display:block;padding:12px;background:#41eaff;color:#001626;text-decoration:none;font-weight:700;border-radius:8px;text-align:center}.pending{color:#b7cadc}.note{color:#c9d8e6;line-height:1.5}</style></head><body><h1>🏒 BANGER NHL LIVE – VIDEO-16</h1><p class="note">Izolovaný test odkazů na skutečná videa NHL. Nejde o nasazenou aplikaci. Zápas Edmonton–Florida, ID '+id+'. Klepni na video, zkus přehrání a vrať se zpět.</p><p><strong>Góly: '+goalCount+' · Platné odkazy: '+clips.filter(c=>c.status==='link-available').length+'</strong></p>'+rows+'<p class="note">Odkazy vedou na oficiální web NHL. Přehrání může být omezeno regionem nebo dostupností videa. Soubor neobsahuje video a neposílá žádná data aplikaci.</p></body></html>';
 const dir=path.resolve('video16-preview');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'index.html'),html);
 console.log('VIDEO-16 preview artifact built: '+goalCount+' goals, '+clips.filter(c=>c.status==='link-available').length+' official links.');
})().catch(e=>{console.error(e);process.exitCode=1});
