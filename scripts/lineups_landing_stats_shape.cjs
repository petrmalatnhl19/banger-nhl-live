'use strict';
// LINEUPS-03.27: inspect official NHL landing statistics shapes without
// guessing values or leaking full feed contents into CI logs.
function inspectLandingStatistics(landing){
 const keys=value=>value&&typeof value==='object'&&!Array.isArray(value)?Object.keys(value).sort():[];
 const summary=landing?.summary;
 if(!landing||landing.fetchError||!summary||typeof summary!=='object')return {status:'unavailable',topLevelKeys:keys(landing),summaryKeys:[],statPaths:[]};
 const paths=[];
 function visit(value,path,depth){
  if(depth>3||!value||typeof value!=='object'||paths.length>=80)return;
  if(Array.isArray(value)){if(value.length)visit(value[0],path+'[0]',depth+1);return;}
  for(const [k,v] of Object.entries(value)){
   if(paths.length>=80)break;
   if(/power.?play|penalty|time.?on.?ice|team.?stat|special.?team/i.test(k))paths.push({path:path+'.'+k,kind:Array.isArray(v)?'array':typeof v,keys:keys(v).slice(0,12)});
   if(typeof v==='object'&&v)visit(v,path+'.'+k,depth+1);
  }
 }
 visit(summary,'summary',0);
 return {status:'shape-only',topLevelKeys:keys(landing),summaryKeys:keys(summary),statPaths:paths};
}
module.exports={inspectLandingStatistics};
