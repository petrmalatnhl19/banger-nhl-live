/* CORE 4.1/4.2 verified accuracy, read-only. Never use unverified archive-only results. */
(function(root){
"use strict";
function calculate(archive,schedules){
 const map=new Map(),conflicts=new Set();
 for(const s of schedules){
  if(!s||s.game_id==null)continue;
  const id=String(s.game_id),prev=map.get(id);
  if(prev&&(prev.kickoff_at!==s.kickoff_at||prev.away_team!==s.away_team||prev.home_team!==s.home_team))conflicts.add(id);
  else map.set(id,s);
 }
 const samples=[];
 for(const a of archive){
  if(!a||a.status!=="final"||!Number.isInteger(a.actual_away)||!Number.isInteger(a.actual_home)||a.actual_away===a.actual_home)continue;
  const id=String(a.game_id),s=map.get(id);
  if(!s||conflicts.has(id)||a.away_team!==s.away_team||a.home_team!==s.home_team)continue;
  const kickoff=Date.parse(s.kickoff_at);
  if(!Number.isFinite(kickoff))continue;
  for(const model of ["core41","core42"]){
   const at=a[model+"_predicted_at"],away=a[model+"_away"],home=a[model+"_home"];
   if(typeof at!=="string"||!Number.isFinite(Date.parse(at))||Date.parse(at)>=kickoff||
      typeof away!=="number"||typeof home!=="number"||!Number.isFinite(away)||!Number.isFinite(home))continue;
   samples.push({id,model,win:away===home?null:(away>home)===(a.actual_away>a.actual_home),
    error:(Math.abs(away-a.actual_away)+Math.abs(home-a.actual_home))/2});
  }
 }
 const paired=new Set();
 const byGame=new Map();
 for(const s of samples){if(!byGame.has(s.id))byGame.set(s.id,new Set());byGame.get(s.id).add(s.model);}
 for(const [id,models] of byGame)if(models.size===2)paired.add(id);
 const metrics=(model,pairedOnly)=>{
  const data=samples.filter(s=>s.model===model&&(!pairedOnly||paired.has(s.id)));
  const calls=data.filter(s=>s.win!==null);
  return {games:data.length,calls:calls.length,correct:calls.filter(s=>s.win).length,
   mae:data.length?data.reduce((sum,s)=>sum+s.error,0)/data.length:null};
 };
 return {core41:metrics("core41",false),core42:metrics("core42",false),
  paired41:metrics("core41",true),paired42:metrics("core42",true),pairedGames:paired.size};
}
function mount(){
 const panel=document.querySelector(".analyst-accuracy-panel .analyst-fold-body");
 if(!panel||panel.querySelector("#core43VerifiedMetrics"))return false;
 const section=document.createElement("section");
 section.id="core43VerifiedMetrics";
 section.style.cssText="margin:12px 0;padding:12px;border:1px solid #49d6ed70;border-radius:12px;background:#091f35";
 section.innerHTML='<h4 style="margin:0 0 8px">🎯 Ověřená přesnost CORE 4.1 / 4.2</h4><p class="analysis-small" id="core43VerifiedStatus">Načítám ověřená data…</p><div id="core43VerifiedResults"></div><p class="analysis-small">Pouze dokončené zápasy s ověřeným časem predikce před začátkem a shodou týmů. Srovnání na stejných zápasech je oddělené. Malý vzorek neprokazuje převahu modelu.</p>';
 panel.insertBefore(section,panel.firstChild);
 const status=section.querySelector("#core43VerifiedStatus"),out=section.querySelector("#core43VerifiedResults");
 (async()=>{
  try{
   const url="https://xxwqeiuyislnoxsmjuul.supabase.co/rest/v1/";
   const headers={apikey:"sb_publishable_SfeHMIvUkYTuD3jCrWub8w_fPIY0B-G"};
   const fetchRows=async(path)=>{
    const response=await fetch(url+path,{headers});
    if(!response.ok)throw Error("HTTP "+response.status);
    const rows=await response.json();
    if(!Array.isArray(rows))throw Error("invalid_rows");
    return rows;
   };
   const [archive,schedules]=await Promise.all([
    fetchRows("nhl_prediction_archive?select=game_id,status,away_team,home_team,actual_away,actual_home,core41_away,core41_home,core41_predicted_at,core42_away,core42_home,core42_predicted_at&status=eq.final&limit=1000"),
    fetchRows("nhl_core43_schedule_snapshots?select=game_id,away_team,home_team,kickoff_at&limit=1000")
   ]);
   if(archive.length===1000||schedules.length===1000)throw Error("pagination_required");
   const result=calculate(archive,schedules);
   const render=(label,r)=>'<div style="display:flex;justify-content:space-between;gap:8px;padding:7px 0;border-bottom:1px solid #ffffff20"><span>'+label+'</span><strong>'+(r.calls?(100*r.correct/r.calls).toFixed(1)+' % ('+r.correct+'/'+r.calls+')':'—')+'</strong><span style="color:#a9c7d9">MAE '+(r.mae===null?'—':r.mae.toFixed(3))+'</span></div>';
   status.textContent="Ověřená předzápasová data · modely se mohou lišit počtem zápasů.";
   out.innerHTML=render("CORE 4.1",result.core41)+render("CORE 4.2",result.core42)+
    '<p class="analysis-small" style="margin:12px 0 4px">Férové srovnání: '+result.pairedGames+' společných zápasů</p>'+
    render("CORE 4.1 · společné",result.paired41)+render("CORE 4.2 · společné",result.paired42);
  }catch(e){
   status.textContent="Ověřená přesnost momentálně není dostupná. Nezobrazujeme neověřená čísla.";
   out.textContent="";
   console.warn("CORE verified accuracy unavailable",e.message);
  }
 })();
 return true;
}
if(typeof module!=="undefined"&&module.exports)module.exports={calculate};
if(typeof window!=="undefined")window.BangerVerifiedAccuracyCalculate=calculate;
if(typeof document!=="undefined"){
 let attempts=0;
 const timer=setInterval(()=>{if(mount()||++attempts>=45)clearInterval(timer)},1000);
}
})(typeof globalThis!=="undefined"?globalThis:this);
