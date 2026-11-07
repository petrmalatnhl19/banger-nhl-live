/* Experimental MoneyPuck goalie CSV ingestion.
 * Explicit column map required until source header has been independently verified.
 * The download timestamp is NOT historical proof that each row existed before kickoff.
 */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.BangerMoneyPuckGoalies=api;})(typeof globalThis!=="undefined"?globalThis:null,function(){
"use strict";
function parseCsv(input){
 if(typeof input!=="string")throw new TypeError("CSV text required");
 const rows=[];let row=[],cell="",quoted=false;
 for(let i=0;i<input.length;i++){
  const c=input[i];
  if(quoted){
   if(c==='"'&&input[i+1]==='"'){cell+='"';i++;}
   else if(c==='"')quoted=false;
   else cell+=c;
  }else if(c==='"')quoted=true;
  else if(c===","){row.push(cell);cell="";}
  else if(c==="\n"){row.push(cell.replace(/\r$/,""));rows.push(row);row=[];cell="";}
  else cell+=c;
 }
 if(quoted)throw new Error("Unclosed CSV quote");
 if(cell!==""||row.length){row.push(cell.replace(/\r$/,""));rows.push(row);}
 const headers=rows.shift()||[];
 if(new Set(headers).size!==headers.length)throw new Error("Duplicate CSV header");
 return rows.filter(r=>r.some(v=>v.trim()!=="")).map(r=>{
  if(r.length!==headers.length)throw new Error("CSV column count mismatch");
  return Object.fromEntries(headers.map((h,i)=>[h,r[i]]));
 });
}
const numeric=v=>v!==""&&v!=null&&Number.isFinite(Number(v))?Number(v):NaN;
function normalize(csv,{columns,goalieId,sourceUpdatedAt,cutoff}={}){
 const keys=["goalieId","gameDate","xGoalsAgainst","goalsAgainst","shotsAgainst","situation"];
 if(!columns||keys.some(k=>typeof columns[k]!=="string"))throw new Error("Explicit column mapping required");
 if(!Number.isFinite(Date.parse(sourceUpdatedAt))||!Number.isFinite(Date.parse(cutoff)))throw new Error("Source and cutoff timestamps required");
 // An archive of the file as it existed before kickoff is required for valid historical comparisons.
 if(Date.parse(sourceUpdatedAt)>=Date.parse(cutoff))return {available:false,reason:"source_not_pregame",rows:[]};
 const parsed=parseCsv(csv);
 if(parsed.length===0)return {available:false,reason:"empty_csv",rows:[]};
 const header=new Set(Object.keys(parsed[0]));
 if(keys.some(k=>!header.has(columns[k])))return {available:false,reason:"missing_columns",rows:[]};
 const rows=parsed.filter(r=>String(r[columns.goalieId])===String(goalieId)).map(r=>({
  goalieId:String(r[columns.goalieId]),gameDate:r[columns.gameDate],
  xGoalsAgainst:numeric(r[columns.xGoalsAgainst]),goalsAgainst:numeric(r[columns.goalsAgainst]),
  shotsAgainst:numeric(r[columns.shotsAgainst]),situation:r[columns.situation],
  sourceUpdatedAt
 }));
 if(rows.some(r=>!Number.isFinite(Date.parse(r.gameDate))||!Number.isFinite(r.xGoalsAgainst)||!Number.isFinite(r.goalsAgainst)||!Number.isFinite(r.shotsAgainst)))
  return {available:false,reason:"invalid_rows",rows:[]};
 return {available:true,reason:null,rows};
}
return {parseCsv,normalize};
});
