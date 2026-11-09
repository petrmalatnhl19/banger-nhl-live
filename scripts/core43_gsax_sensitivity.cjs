/* CORE 4.3 GSAx sensitivity experiment, NOT a calibrated prediction model.
 * The coefficient is explicitly hypothetical; no production writes.
 */
"use strict";
const finite=x=>typeof x==="number"&&Number.isFinite(x);
const validTime=x=>typeof x==="string"&&Number.isFinite(Date.parse(x));
function calculateShadow({baseline,awayGoalie,homeGoalie,asOf,coefficient=0.02}={}){
 const reject=reason=>({available:false,reason,production:false});
 if(!baseline||![baseline.away,baseline.home].every(x=>finite(x)&&x>=0&&x<=20))
  return reject("missing_baseline_goals");
 if(!validTime(asOf)||!validTime(baseline.predictedAt)||Date.parse(baseline.predictedAt)>Date.parse(asOf))
  return reject("baseline_after_asof");
 if(!finite(coefficient)||coefficient<0||coefficient>0.05)return reject("invalid_experimental_coefficient");
 for(const [side,goalie] of [["away",awayGoalie],["home",homeGoalie]]){
  if(!goalie||!goalie.available||!goalie.value||!finite(goalie.value.gsaxPer100Shots))
   return reject("missing_"+side+"_goalie_gsax");
  if(!validTime(goalie.value.fetchedAt)||Date.parse(goalie.value.fetchedAt)>Date.parse(asOf))
   return reject("goalie_snapshot_after_asof");
  if(!finite(goalie.value.shotsAgainst)||goalie.value.shotsAgainst<30)
   return reject("insufficient_"+side+"_goalie_sample");
 }
 // A better home goalie lowers AWAY expected goals; a better away goalie lowers HOME.
 const clamp=x=>Math.max(-0.2,Math.min(0.2,x));
 const awayAdjustment=clamp(-homeGoalie.value.gsaxPer100Shots*coefficient);
 const homeAdjustment=clamp(-awayGoalie.value.gsaxPer100Shots*coefficient);
 const round=x=>Math.round(x*1000)/1000;
 return {available:true,production:false,experimental:true,calibrated:false,
  model:"core43_gsax_sensitivity_v0",coefficient,
  baseline:{away:baseline.away,home:baseline.home,predictedAt:baseline.predictedAt},
  expectedAwayGoals:round(Math.max(0,baseline.away+awayAdjustment)),
  expectedHomeGoals:round(Math.max(0,baseline.home+homeAdjustment)),
  adjustments:{away:round(awayAdjustment),home:round(homeAdjustment)},
  asOf,warning:"Hypothetical sensitivity only; coefficient is not empirically calibrated; do not publish as forecast."};
}
module.exports={calculateShadow};
