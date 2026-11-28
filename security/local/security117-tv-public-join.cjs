"use strict";
// SECURITY-117: offline-only join; no browser or Supabase connection.
const {project}=require("./security116-tv-metadata.cjs");
const {adapt}=require("./security102-tv-adapter.cjs");
function join(metadataRows,predictionRows){
 const games=project(metadataRows);
 if(!Array.isArray(predictionRows)||predictionRows.length>40)throw new TypeError("invalid predictions batch");
 const ids=new Set(games.map(g=>g.game_id));
 const seen=new Set();
 for(const row of predictionRows){
  if(!row||!Number.isSafeInteger(row.game_id)||row.game_id<=0)throw new TypeError("invalid prediction ID");
  if(seen.has(row.game_id))throw new TypeError("duplicate prediction ID");
  if(!ids.has(row.game_id))throw new TypeError("orphan prediction ID");
  seen.add(row.game_id);
 }
 const {shadow,preview}=adapt(games,predictionRows);
 const byShadow=new Map(shadow.map(x=>[x.game_id,x]));
 const byPreview=new Map(preview.map(x=>[x.game_id,x]));
 const rows=games.map(g=>{
  const s=byShadow.get(g.game_id),p=byPreview.get(g.game_id);
  return {...g,core42_away:s?.core42_away??null,core42_home:s?.core42_home??null,
   core43_away:s?.core43_away??null,core43_home:s?.core43_home??null,
   core43_preview_away:p?.core43_preview_away??null,core43_preview_home:p?.core43_preview_home??null,
   away_gsax_per100:p?.away_gsax_per100??null,home_gsax_per100:p?.home_gsax_per100??null};
 });
 return {rows,matched:seen.size,missing:games.length-seen.size,complete:seen.size===games.length};
}
module.exports={join};
