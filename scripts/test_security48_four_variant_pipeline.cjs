"use strict";
/* SECURITY-48: isolated four-variant calculation using existing real sensitivity engine.
 * Synthetic evidence only; no real CORE43-CAL planner, production or persistence.
 */
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const {calculateShadow}=require("./core43_gsax_sensitivity.cjs");
const coefficients=[0,0.005,0.02,0.03];
const cutoff="2026-11-16T19:00:00Z",kickoff="2026-11-16T20:00:00Z";
const baseline={away:2.8,home:3.2,predictedAt:"2026-11-16T18:00:00Z"};
const goalie=(id,gsax,at)=>({id,available:true,value:{gsaxPer100Shots:gsax,shotsAgainst:200,fetchedAt:at}});
const input={gameId:"synthetic-48",status:"scheduled",cutoff,kickoff,baseline,
  awayGoalie:goalie("A",2,"2026-11-16T18:30:00Z"),
  homeGoalie:goalie("B",-1,"2026-11-16T18:40:00Z"),
  evidence:[{id:"synthetic-source-a",publishedAt:"2026-11-16T18:20:00Z",
    verifiedAt:"2026-11-16T18:25:00Z",ingestedAt:"2026-11-16T18:26:00Z"}]};
function canonical(value){
  if(Array.isArray(value))return "["+value.map(canonical).join(",")+"]";
  if(value!==null&&typeof value==="object")
    return "{"+Object.keys(value).sort().map(k=>JSON.stringify(k)+":"+canonical(value[k])).join(",")+"}";
  return JSON.stringify(value);
}
function calculate(x){
  const fail=reason=>({ready:false,reason,production:false,writeEnabled:false});
  const at=Date.parse(x.cutoff),start=Date.parse(x.kickoff);
  if(!Number.isFinite(at)||!Number.isFinite(start)||at>=start||x.status!=="scheduled")
    return fail("not_verified_pregame");
  if(!Array.isArray(x.evidence)||x.evidence.length===0)return fail("missing_provenance");
  for(const e of x.evidence){
    if(!e.id||["publishedAt","verifiedAt","ingestedAt"].some(k=>!Number.isFinite(Date.parse(e[k]))||Date.parse(e[k])>at))
      return fail("late_or_invalid_evidence");
  }
  for(const g of [x.awayGoalie,x.homeGoalie]){
    if(!g||!g.id||!g.available||!g.value||!Number.isFinite(Date.parse(g.value.fetchedAt))||
      Date.parse(g.value.fetchedAt)>at)return fail("late_or_missing_goalie");
  }
  if(x.awayGoalie.id===x.homeGoalie.id)return fail("duplicate_goalie");
  const variants=coefficients.map(coefficient=>{
    const result=calculateShadow({baseline:x.baseline,awayGoalie:x.awayGoalie,
      homeGoalie:x.homeGoalie,asOf:x.cutoff,coefficient});
    if(!result.available)return {error:result.reason};
    const record={schema:"security48_offline_v1",gameId:x.gameId,cutoff:x.cutoff,
      kickoff:x.kickoff,coefficient,inputs:{baseline:x.baseline,
      goalieIds:[x.awayGoalie.id,x.homeGoalie.id],evidence:x.evidence},
      output:{away:result.expectedAwayGoals,home:result.expectedHomeGoals},
      engine:result.model,calibrated:false,production:false,persistable:false};
    return {record,sha256:crypto.createHash("sha256").update(canonical(record)).digest("hex")};
  });
  if(variants.some(v=>v.error))return fail("engine_rejected_input");
  return {ready:true,production:false,writeEnabled:false,variants};
}
const before=canonical(input),first=calculate(input);
assert.equal(first.ready,true,JSON.stringify(first));
assert.equal(first.variants.length,4);
assert.deepEqual(first.variants.map(v=>v.record.coefficient),coefficients);
assert.equal(new Set(first.variants.map(v=>v.sha256)).size,4);
assert.deepEqual(calculate(input),first);
assert.equal(canonical(input),before,"input mutation");
assert(first.variants.every(v=>v.record.calibrated===false&&v.record.persistable===false));
const changed=calculate({...input,homeGoalie:goalie("C",3,"2026-11-16T18:40:00Z")});
assert.equal(changed.ready,true);
assert.notEqual(changed.variants[1].record.output.away,first.variants[1].record.output.away);
assert.deepEqual(calculate(input),first,"frozen original unchanged");
assert.equal(calculate({...input,status:"live"}).reason,"not_verified_pregame");
assert.equal(calculate({...input,kickoff:"2026-11-16T18:59:00Z"}).reason,"not_verified_pregame");
assert.equal(calculate({...input,evidence:[{...input.evidence[0],publishedAt:"2026-11-16T19:01:00Z"}]}).reason,"late_or_invalid_evidence");
assert.equal(calculate({...input,evidence:[{...input.evidence[0],verifiedAt:"2026-11-16T19:01:00Z"}]}).reason,"late_or_invalid_evidence");
assert.equal(calculate({...input,evidence:[{...input.evidence[0],ingestedAt:"2026-11-16T19:01:00Z"}]}).reason,"late_or_invalid_evidence");
assert.equal(calculate({...input,awayGoalie:goalie("A",2,"2026-11-16T19:01:00Z")}).reason,"late_or_missing_goalie");
assert.equal(calculate({...input,homeGoalie:{...input.homeGoalie,id:"A"}}).reason,"duplicate_goalie");
const tampered=structuredClone(first.variants[1].record);
tampered.output.away+=0.1;
assert.notEqual(crypto.createHash("sha256").update(canonical(tampered)).digest("hex"),first.variants[1].sha256);
console.log("PASS SECURITY-48 four-variant offline CORE 4.3 sensitivity pipeline");
