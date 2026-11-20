/* VIDEO-06: deterministic join of Gamecenter goals with official clips. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.BangerGoalVideoMap=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 function mapGoals(gameId,landing,clips){
  const periods=Array.isArray(landing?.summary?.scoring)?landing.summary.scoring:[];
  const byEvent=new Map((Array.isArray(clips)?clips:[]).filter(c=>c&&String(c.gameId)===String(gameId)&&Number.isSafeInteger(c.eventId)).map(c=>[c.eventId,c]));
  return periods.map((period,periodIndex)=>({
   periodIndex,
   goals:(Array.isArray(period.goals)?period.goals:[]).map(goal=>{
    const id=goal?.eventId??goal?.eventID;
    const clip=Number.isSafeInteger(Number(id))?byEvent.get(Number(id)):null;
    return {goal,video:clip?.status==='link-available'&&typeof clip.officialUrl==='string'?{officialUrl:clip.officialUrl,eventId:clip.eventId}:null};
   })
  }));
 }
 return Object.freeze({mapGoals});
});
