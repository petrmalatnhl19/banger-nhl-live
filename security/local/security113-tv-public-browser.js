/* SECURITY-113: browser-side public TV reader, NOT loaded by index.html.
 * No endpoint is configured until reviewed and approved. */
(function(root){
  "use strict";
  const FIELDS=Object.freeze(["game_id","core42_away","core42_home","core43_away","core43_home","core43_preview_away","core43_preview_home","away_gsax_per100","home_gsax_per100"]);
  const SELECT=FIELDS.join(",");
  const DEFAULT_MODE="legacy";
  function validateEndpoint(endpoint){
    if(typeof endpoint!=="string"||!endpoint)throw new TypeError("approved endpoint required");
    const url=new URL(endpoint);
    if(url.protocol!=="https:"||url.username||url.password||url.search||url.hash||url.pathname.indexOf("/rest/v1/")<0)
      throw new TypeError("invalid public endpoint");
    if(url.hostname!=="xxwqeiuyislnoxsmjuul.supabase.co")throw new TypeError("unapproved API host");
    if(!/^\\/rest\\/v1\\/[a-z][a-z0-9_]*$/.test(url.pathname))throw new TypeError("invalid API path");
    if(/(?:archive|shadow|preview|security99|internal|private)/i.test(url.pathname))throw new TypeError("internal endpoint forbidden");
    return url;
  }
  async function readPublic({mode=DEFAULT_MODE,endpoint,apikey,fetchImpl,signal}={}){
    if(mode!=="public")throw new TypeError("public reader is disabled");
    const url=validateEndpoint(endpoint);
    if(typeof apikey!=="string"||!apikey.startsWith("sb_publishable_"))throw new TypeError("publishable key required");
    if(typeof fetchImpl!=="function")throw new TypeError("fetch required");
    url.searchParams.set("select",SELECT);
    url.searchParams.set("limit","40");
    const response=await fetchImpl(url.toString(),{method:"GET",headers:{apikey,Accept:"application/json"},signal});
    if(!response||!response.ok)throw new Error("TV public API unavailable");
    const rows=await response.json();
    if(!Array.isArray(rows)||rows.length>40)throw new TypeError("invalid public response");
    const seen=new Set();
    return rows.map(row=>{
      if(!row||typeof row!=="object"||Array.isArray(row)||!Number.isSafeInteger(row.game_id)||row.game_id<=0)throw new TypeError("invalid public game");
      if(seen.has(row.game_id))throw new TypeError("duplicate public game");
      seen.add(row.game_id);
      const out={game_id:row.game_id};
      for(const field of FIELDS.slice(1)){
        const value=row[field];
        if(value===undefined||value===null){out[field]=null;continue;}
        if(typeof value!=="number"||!Number.isFinite(value))throw new TypeError("invalid public number");
        out[field]=value;
      }
      return out;
    });
  }
  const api=Object.freeze({FIELDS,DEFAULT_MODE,readPublic});
  if(typeof module==="object"&&module.exports)module.exports=api;
  else Object.defineProperty(root,"BangerTvPublicReader113",{value:api,writable:false,configurable:false});
})(typeof globalThis!=="undefined"?globalThis:this);
