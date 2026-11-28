"use strict";
// SECURITY-102: offline adapter for the future public API. Not imported by production UI.
const FIELDS=Object.freeze(["game_id","core42_away","core42_home","core43_away","core43_home",
"core43_preview_away","core43_preview_home","away_gsax_per100","home_gsax_per100"]);
function adapt(archive,publicRows){
  if(!Array.isArray(archive)||!Array.isArray(publicRows))throw new TypeError("arrays required");
  const ids=new Set(),map=new Map();
  for(const row of archive){
    if(!row||!Number.isSafeInteger(Number(row.game_id))||Number(row.game_id)<=0)throw new TypeError("invalid archive game id");
    const id=String(row.game_id);
    if(ids.has(id))throw new TypeError("duplicate archive game id");
    ids.add(id);
  }
  for(const row of publicRows){
    if(!row||!Number.isSafeInteger(Number(row.game_id))||Number(row.game_id)<=0)throw new TypeError("invalid public game id");
    const id=String(row.game_id);
    if(map.has(id))throw new TypeError("duplicate public game id");
    if(!ids.has(id))continue;
    const normalized={game_id:Number(row.game_id)};
    for(const field of FIELDS.slice(1)){
      const value=row[field];
      if(value===null||value===undefined){normalized[field]=null;continue;}
      if(typeof value!=="number"||!Number.isFinite(value))throw new TypeError("invalid "+field);
      normalized[field]=value;
    }
    map.set(id,normalized);
  }
  return {
    shadow:archive.map(row=>map.get(String(row.game_id))).filter(Boolean).map(row=>({
      game_id:row.game_id,core42_away:row.core42_away,core42_home:row.core42_home,
      core43_away:row.core43_away,core43_home:row.core43_home
    })),
    preview:archive.map(row=>map.get(String(row.game_id))).filter(Boolean).map(row=>({
      game_id:row.game_id,core43_preview_away:row.core43_preview_away,
      core43_preview_home:row.core43_preview_home,away_gsax_per100:row.away_gsax_per100,
      home_gsax_per100:row.home_gsax_per100
    }))
  };
}
module.exports={adapt,FIELDS};
