/* CORE 4.3 MoneyPuck season CSV -> validated GSAx bridge.
 * Consumes a snapshot and its metadata from the SAME archived download.
 * No live network, no production model modifications.
 */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.BangerCore43GSAxBridge=api;})(typeof globalThis!=="undefined"?globalThis:null,function(){
"use strict";
function parseCsv(input){
 if(typeof input!=="string")throw new TypeError("CSV required");
 const rows=[];let row=[],cell="",quoted=false;
 for(let i=0;i<input.length;i++){
  const c=input[i];
  if(quoted){if(c==='"'&&input[i+1]==='"'){cell+='"';i++;}else if(c==='"')quoted=false;else cell+=c;}
  else if(c==='"')quoted=true;
  else if(c===","){row.push(cell);cell="";}
  else if(c==="\n"){row.push(cell.replace(/\r$/,""));rows.push(row);row=[];cell="";}
  else cell+=c;
 }
 if(quoted)throw new Error("Unclosed CSV quote");
 if(cell!==""||row.length){row.push(cell.replace(/\r$/,""));rows.push(row);}
 const headers=rows.shift()||[];
 if(!headers.length||new Set(headers).size!==headers.length)throw new Error("Invalid headers");
 const required=["playerId","team","situation","xGoals","goals","ongoal"];
 if(required.some(k=>!headers.includes(k)))throw new Error("Missing required MoneyPuck fields");
 return rows.filter(r=>r.some(x=>x.trim()!=="")).map(r=>{
  if(r.length!==headers.length)throw new Error("CSV column mismatch");
  return Object.fromEntries(headers.map((h,i)=>[h,r[i]]));
 });
}
const number=x=>typeof x==="number"&&Number.isFinite(x)?x:(typeof x==="string"&&x.trim()!==""&&Number.isFinite(Number(x))?Number(x):NaN);
function evaluate({csv,metadata,goalieId,team,kickoff,minShots=30}={}){
 const unavailable=reason=>({available:false,reason,value:null});
 if(!metadata||typeof metadata.fetchedAt!=="string"||!Number.isFinite(Date.parse(metadata.fetchedAt))||
    typeof kickoff!=="string"||!Number.isFinite(Date.parse(kickoff)))return unavailable("missing_snapshot_timestamp");
 if(Date.parse(metadata.fetchedAt)>=Date.parse(kickoff))return unavailable("snapshot_not_pregame");
 if(metadata.status!=="archived_snapshot_not_model_integrated")return unavailable("unverified_snapshot_metadata");
 if(goalieId==null||!team)return unavailable("missing_goalie_identity");
 let rows;
 try{rows=parseCsv(csv);}catch(_){return unavailable("invalid_csv_schema");}
 if(metadata.rows!==rows.length)return unavailable("snapshot_row_count_mismatch");
 const selected=rows.filter(r=>String(r.playerId)===String(goalieId)&&String(r.team).toUpperCase()===String(team).toUpperCase()&&String(r.situation).toLowerCase()==="all");
 if(selected.length!==1)return unavailable(selected.length?"ambiguous_goalie":"goalie_not_found");
 const r=selected[0],x=number(r.xGoals),g=number(r.goals),s=number(r.ongoal);
 if(![x,g,s].every(Number.isFinite)||x<0||g<0||s<0)return unavailable("invalid_goalie_stats");
 if(s<minShots)return unavailable("insufficient_shots");
 const gsax=x-g;
 return {available:true,reason:null,experimental:true,value:{
   goalieId:String(goalieId),team:String(team).toUpperCase(),situation:"all",
   gsax:Math.round(gsax*100)/100,gsaxPer100Shots:Math.round(gsax/s*10000)/100,
   xGoalsAgainst:x,goalsAgainst:g,shotsAgainst:s,fetchedAt:metadata.fetchedAt,
   sourceSha256:metadata.sha256||null,sourceType:"archived_moneypuck_season_summary"
 }};
}
return {parseCsv,evaluate};
});
