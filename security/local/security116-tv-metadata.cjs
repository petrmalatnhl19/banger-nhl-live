"use strict";
// SECURITY-116: pure offline game metadata projection. Not a deployed endpoint.
const FIELDS=Object.freeze(["game_id","game_date","away_team","home_team","status"]);
const TEAM=/^[A-Z]{3}$/;
const DATE=/^\d{4}-\d{2}-\d{2}$/;
function project(rows){
 if(!Array.isArray(rows)||rows.length>40)throw new TypeError("invalid metadata batch");
 const seen=new Set();
 return rows.map(row=>{
  if(!row||typeof row!=="object"||Array.isArray(row))throw new TypeError("invalid metadata row");
  const {game_id,game_date,away_team,home_team,status}=row;
  if(!Number.isSafeInteger(game_id)||game_id<=0||seen.has(game_id))throw new TypeError("invalid or duplicate game ID");
  seen.add(game_id);
  if(typeof game_date!=="string"||!DATE.test(game_date)||Number.isNaN(Date.parse(game_date+"T00:00:00Z"))||new Date(game_date+"T00:00:00Z").toISOString().slice(0,10)!==game_date)throw new TypeError("invalid game date");
  if(typeof away_team!=="string"||!TEAM.test(away_team)||typeof home_team!=="string"||!TEAM.test(home_team)||away_team===home_team)throw new TypeError("invalid teams");
  if(status!=="pending")throw new TypeError("invalid game status");
  return {game_id,game_date,away_team,home_team,status};
 });
}
module.exports={FIELDS,project};
