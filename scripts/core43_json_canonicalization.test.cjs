"use strict";
const assert=require("node:assert/strict");
const test=require("node:test");
const crypto=require("node:crypto");
const {VERSION,canonicalize,hashRecord}=require("./core43_json_canonicalization.cjs");
test("V2 ignores JSONB key reordering at all nesting levels",()=>{
 const a={schema:"core43_shadow_capture_v1",serializationVersion:VERSION,goalies:{away:{id:1,status:"projected"},home:{id:2}},baseline:{home:3,away:2}};
 const b={baseline:{away:2,home:3},goalies:{home:{id:2},away:{status:"projected",id:1}},serializationVersion:VERSION,schema:"core43_shadow_capture_v1"};
 assert.equal(hashRecord(a),hashRecord(b));
 assert.equal(hashRecord(a),crypto.createHash("sha256").update(canonicalize(a)).digest("hex"));
 assert.notEqual(hashRecord(a),hashRecord({...a,baseline:{...a.baseline,away:4}}));
});
test("legacy V1 preserves insertion-order hashing",()=>{
 const v1={schema:"core43_shadow_capture_v1",away:1,home:2};
 assert.equal(hashRecord(v1),crypto.createHash("sha256").update(JSON.stringify(v1)).digest("hex"));
 assert.notEqual(hashRecord(v1),hashRecord({home:2,away:1,schema:"core43_shadow_capture_v1"}));
});
test("JCS ordering, number and string serialization",()=>{
 assert.equal(canonicalize({z:1,a:{y:2,x:3}}),'{"a":{"x":3,"y":2},"z":1}');
 assert.equal(canonicalize({n:1e-7,m:-0,s:"é"}),'{"m":0,"n":1e-7,"s":"é"}');
 assert.throws(()=>canonicalize({bad:NaN}),/invalid_number/);
 assert.throws(()=>canonicalize({bad:undefined}),/invalid_json_value/);
 assert.throws(()=>canonicalize({bad:String.fromCharCode(0xd800)}),/invalid_unicode/);
 assert.throws(()=>hashRecord({serializationVersion:"unknown"}),/unsupported_serialization_version/);
});
