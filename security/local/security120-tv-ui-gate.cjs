"use strict";
// SECURITY-120: offline-only TV UI integration gate. Never imported by production.
const {present,STATES}=require("./security119-tv-failclosed-state.cjs");
const DEFAULT_MODE="legacy";
const LABELS=Object.freeze({
 [STATES.UNAVAILABLE]:"Data nejsou dostupná",
 [STATES.STALE]:"Data nejsou aktuální",
 [STATES.INCOMPLETE]:"Predikce nejsou kompletní",
 [STATES.INVALID]:"Data nelze ověřit"
});
function renderModel({mode=DEFAULT_MODE,snapshot}={}){
 if(mode!=="public-preview")return Object.freeze({mode:"legacy",enabled:false,rows:[],message:null});
 const result=present(snapshot);
 if(result.state!==STATES.READY)return Object.freeze({
  mode:"public-preview",enabled:true,state:result.state,rows:[],message:LABELS[result.state]||LABELS[STATES.INVALID],as_of:null
 });
 // Do not expose raw data or internal errors; copy only approved public presentation fields.
 const rows=result.rows.map(row=>Object.freeze({
  game_id:row.game_id,game_date:row.game_date,away_team:row.away_team,home_team:row.home_team,status:row.status,
  core42_away:row.core42_away,core42_home:row.core42_home,core43_away:row.core43_away,core43_home:row.core43_home,
  core43_preview_away:row.core43_preview_away,core43_preview_home:row.core43_preview_home,
  away_gsax_per100:row.away_gsax_per100,home_gsax_per100:row.home_gsax_per100
 }));
 return Object.freeze({mode:"public-preview",enabled:true,state:STATES.READY,rows:Object.freeze(rows),message:null,as_of:result.as_of});
}
module.exports={renderModel,DEFAULT_MODE};
