"use strict";
// SECURITY-101 real PostgREST HTTP test against disposable private-schema source.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const endpoint = "http://127.0.0.1:55433";
const secret = "security99_disposable_test_secret_32chars_only";
const sign = role => {
  const enc = obj => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const body = enc({role,exp:Math.floor(Date.now()/1000)+300});
  const prefix = enc({alg:"HS256",typ:"JWT"})+"."+body;
  return prefix+"."+crypto.createHmac("sha256",secret).update(prefix).digest("base64url");
};
const columns = ["game_id","core42_away","core42_home","core43_away","core43_home",
  "core43_preview_away","core43_preview_home","away_gsax_per100","home_gsax_per100"];
async function request(role,path,method="GET",body) {
  const headers = {authorization:"Bearer "+sign(role)};
  if (body) headers["content-type"]="application/json";
  const res = await fetch(endpoint+path,{method,headers,...(body?{body:JSON.stringify(body)}:{})});
  return {status:res.status,body:await res.text()};
}
(async()=>{
  for (const role of ["anon","authenticated"]) {
    const read = await request(role,"/security101_tv_public_v1?game_id=eq.101");
    assert.equal(read.status,200,role+" read "+read.body);
    const rows = JSON.parse(read.body);
    assert.equal(rows.length,1);
    assert.deepEqual(Object.keys(rows[0]).sort(),columns.slice().sort());
    assert.equal(rows[0].game_id,101);
    assert.equal(rows[0].core43_away,2.2);
    assert.ok(!read.body.includes("private starter"));
    assert.ok(!read.body.includes("never expose"));
    for (const method of ["POST","PATCH","DELETE"]) {
      const path="/security101_tv_public_v1"+(method==="POST"?"":"?game_id=eq.101");
      const result=await request(role,path,method,method==="DELETE"?undefined:{game_id:102,core43_away:99});
      assert.equal(result.status,role==="anon"?401:403,role+" "+method+" "+result.body);
    }
    const privateResult=await request(role,"/tv_source");
    assert.equal(privateResult.status,404,role+" private source not exposed "+privateResult.body);
    const privateSchema=await fetch(endpoint+"/tv_source",{headers:{
      authorization:"Bearer "+sign(role),"accept-profile":"security101_private"
    }});
    assert.ok(privateSchema.status>=400,role+" private schema not exposed");
  }
  console.log("PASS SECURITY-101: invoker view 9 fields, denied writes, private schema inaccessible");
})().catch(err=>{console.error(err);process.exitCode=1;});
