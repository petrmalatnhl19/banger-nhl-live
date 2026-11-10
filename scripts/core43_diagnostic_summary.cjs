"use strict";
const fs=require("node:fs");
function summary(report){
 const coverage=report.coverage||{},readiness=report.starterReadiness||{};
 const lines=["## CORE 4.3 – read-only diagnostic","",
  "| Metric | Games |","|---|---:|",
  "| Archived games | "+Number(report.total||0)+" |",
  "| Usable frozen schedule | "+Number(coverage.usableFrozenSchedule||0)+" |",
  "| Missing prediction timestamp | "+Number(coverage.missingPredictionTime||0)+" |",
  "| Missing frozen schedule | "+Number(coverage.missingFrozenSchedule||0)+" |",
  "| Confirmed starter readiness | "+Number(readiness.ready_confirmed||0)+" |",
  "| Projected starter readiness | "+Number(readiness.ready_projected||0)+" |",
  "| Unavailable starter readiness | "+Number(readiness.unavailable||0)+" |",
  "","Shadow diagnostic only. No production prediction writes."];
 return lines.join("\n")+"\n";
}
if(require.main===module){
 try{
  const file=process.argv[2];
  if(!file)throw Error("Missing report file");
  process.stdout.write(summary(JSON.parse(fs.readFileSync(file,"utf8"))));
 }catch(error){console.error(error.message);process.exitCode=1;}
}
module.exports={summary};
