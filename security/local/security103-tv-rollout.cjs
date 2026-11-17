"use strict";
// SECURITY-103: isolated rollout selector; deliberately NOT wired into production UI.
// No silent fallback from public mode to legacy internal views.
const {adapt}=require("./security102-tv-adapter.cjs");
const MODES=Object.freeze({LEGACY:"legacy",PUBLIC:"public",DISABLED:"disabled"});
async function loadTvData({mode=MODES.LEGACY,archive,fetchLegacy,fetchPublic}={}){
  if(!Array.isArray(archive))throw new TypeError("archive must be an array");
  if(!Object.values(MODES).includes(mode))throw new TypeError("unknown rollout mode");
  if(mode===MODES.DISABLED)return {mode,shadow:[],preview:[],available:false};
  if(mode===MODES.LEGACY){
    if(typeof fetchLegacy!=="function")throw new TypeError("legacy reader missing");
    const data=await fetchLegacy();
    if(!data||!Array.isArray(data.shadow)||!Array.isArray(data.preview))
      throw new TypeError("invalid legacy response");
    return {mode,shadow:data.shadow,preview:data.preview,available:true};
  }
  if(typeof fetchPublic!=="function")throw new TypeError("public reader missing");
  // Explicit fail-closed behavior: an API error cannot re-enable broad legacy reads.
  const rows=await fetchPublic();
  const data=adapt(archive,rows);
  return {mode,...data,available:true};
}
module.exports={loadTvData,MODES};
