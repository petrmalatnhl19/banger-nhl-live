/* VIDEO-09: opt-in clip refresh, no extra polling while tab is hidden. */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.BangerVideoRefresh=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 function create({fetchLanding,apply,isCurrent,isVisible,setTimer= setInterval,clearTimer=clearInterval,intervalMs=45000}){
  let timer=null,busy=false,epoch=0;
  async function tick(){
   if(busy||!isCurrent()||!isVisible())return false;
   const ticket=epoch;busy=true;
   try{const data=await fetchLanding();if(ticket!==epoch||!isCurrent()||!isVisible())return false;apply(data);return true}
   catch{return false}
   finally{busy=false}
  }
  function stop(){epoch++;if(timer!==null){clearTimer(timer);timer=null}}
  function start(){stop();timer=setTimer(tick,Math.max(30000,intervalMs));return tick}
  return Object.freeze({start,stop,tick});
 }
 return Object.freeze({create});
});
