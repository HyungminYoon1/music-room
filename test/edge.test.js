import test from "node:test";
import assert from "node:assert/strict";
import {emptyProject,validate,parseProject,totalTicks,History,moveNotes,soundingTracks,encodeWav,encodeMidi,musicXML,vlq,lanes} from "../dist/src/model.js";
// Synthetic one-note fixture, not a user's composition.
const fixture=()=>{const p=emptyProject();p.bars=1;p.tracks[0].notes=[{id:"n",pitch:60,start:0,duration:1,velocity:1}];return p;};
const set=(o,path,value)=>{const keys=path.split(".");for(const k of keys.slice(0,-1))o=o[k];o[keys.at(-1)]=value;};
for(const [path,min,max,integer] of [
  ["tempo",40,240,true],["bars",1,64,true],["tracks.0.volume",0,1,false],["tracks.0.pan",-1,1,false],
  ["tracks.0.notes.0.pitch",21,108,true],["tracks.0.notes.0.start",0,3839,true],
  ["tracks.0.notes.0.duration",1,3840,true],["tracks.0.notes.0.velocity",1,127,true],
])test("numeric boundary "+path,()=>{
  for(const v of [min,max]){const p=fixture();set(p,path,v);assert.doesNotThrow(()=>validate(p));}
  for(const v of [min-1,max+1,NaN,Infinity,-Infinity,null,true,String(min),...(integer?[min+.5]:[])]){
    const p=fixture();set(p,path,v);const before=structuredClone(p);assert.throws(()=>validate(p),String(v));assert.deepEqual(p,before);
  }
});
test("meter requires numeric pair rather than coercible strings",()=>{
  for(const meter of [[4,4],[3,4],[6,8]])assert.doesNotThrow(()=>validate({...fixture(),meter}));
  for(const meter of [["4","4"],[3,"4"],["6",8],[4,4,0],[4],[5,4],null])
    assert.throws(()=>validate({...fixture(),meter}),JSON.stringify(meter));
});
test("tracks, drums, notes, IDs and end-of-score boundaries",()=>{
  const p=fixture(),t=p.tracks[0];
  p.tracks=Array.from({length:16},(_,i)=>({...structuredClone(t),id:"t"+i,instrument:i===15?'drums':t.instrument,notes:[]}));
  validate(p);p.tracks.push({...t,id:"overflow",notes:[]});assert.throws(()=>validate(p));p.tracks.pop();
  p.tracks[15].instrument='piano';p.tracks[0].instrument="drums";validate(p);p.tracks[1].instrument="drums";assert.throws(()=>validate(p));
  p.tracks=[t];t.notes=Array.from({length:4096},(_,i)=>({id:"n"+i,pitch:108,start:3839,duration:1,velocity:127}));
  validate(p);t.notes.push({...t.notes[0],id:"extra"});assert.throws(()=>validate(p));t.notes.pop();
  t.notes[0].duration=2;assert.throws(()=>validate(p));t.notes[0].duration=1;
  t.notes[0].id=t.id;assert.throws(()=>validate(p));
});
test("corrupt/oversize import is pure and rejects before replacement",()=>{
  const p=fixture(),before=JSON.stringify(p);
  for(const raw of ["{","null","[]","{}",true," ".repeat(2000001)])assert.throws(()=>parseProject(raw));
  assert.equal(JSON.stringify(p),before);
});
test("project 2MB bound measures UTF-8 bytes, including unknown imported metadata",()=>{
  const p=fixture();p.fixturePadding="가".repeat(666667);const raw=JSON.stringify(p);
  assert(raw.length<2000000);assert(Buffer.byteLength(raw,"utf8")>2000000);assert.throws(()=>parseProject(raw));
});
test("mute/solo intersection preserves original tracks across toggles",()=>{
  const p=fixture();p.tracks.push({...structuredClone(p.tracks[0]),id:"b",notes:[]});
  assert.equal(soundingTracks(p).length,2);p.tracks[0].solo=true;assert.deepEqual(soundingTracks(p),[p.tracks[0]]);
  p.tracks[0].mute=true;assert.deepEqual(soundingTracks(p),[]);p.tracks[1].solo=true;assert.deepEqual(soundingTracks(p),[p.tracks[1]]);
  p.tracks[0].solo=p.tracks[1].solo=false;assert.deepEqual(soundingTracks(p),[p.tracks[1]]);
});
test("one-tick group moves saturate together and remain reversible inside bounds",()=>{
  const ns=[{id:"a",pitch:21,start:0,duration:1,velocity:1},{id:"b",pitch:108,start:3839,duration:1,velocity:127}],before=structuredClone(ns);
  for(const dt of [-99999,0,99999])for(const dp of [-1000,0,1000])assert.deepEqual(moveNotes(ns,dt,dp,3840),ns);
  assert.deepEqual(moveNotes([],1,1,1),[]);assert.deepEqual(ns,before);
  for(const args of [[NaN,0,1],[0,Infinity,1],[0,0,0],[0,0,"1"],[.1,0,1]])assert.throws(()=>moveNotes(ns,...args));
});
test("history returns detached snapshots, redo branches, and byte cap",()=>{
  const p=fixture(),h=new History();h.push(p);p.title="edited";const old=h.undo(p);old.title="outside";
  assert.equal(h.redo(old).title,"edited");h.undo(p);h.push(p);assert.equal(h.forward.length,0);
  const large={...p,fixturePadding:"x".repeat(1000000)};for(let i=0;i<15;i++)h.push(large);
  assert(h.back.reduce((n,s)=>n+s.length,0)<=12000000);
});
test("WAV exact 180-second endpoint, invalid rates/samples, PCM signs",()=>{
  const a=new Float32Array(8000*180);assert.equal(encodeWav(a,a,8000).byteLength,44+a.length*6);
  assert.throws(()=>encodeWav(new Float32Array(a.length+1),new Float32Array(a.length+1),8000));
  for(const rate of [7999,96001,NaN,Infinity,8000.5,"48000"])assert.throws(()=>encodeWav([0],[0],rate));
  for(const v of [NaN,Infinity,-Infinity,"1",null])assert.throws(()=>encodeWav([v],[0]));
  const b=new Uint8Array(encodeWav([-1,1],[1,-1]));assert.deepEqual([...b.slice(44,50)],[1,0,128,255,255,127]);
});
test("MIDI variable-length boundaries roundtrip and note-off precedes retrigger",()=>{
  for(const n of [0,127,128,16383,16384,0xfffffff])assert.equal(vlq(n).reduce((v,b)=>v*128+(b&127),0),n);
  for(const n of [-1,0x10000000,NaN,Infinity,1.5,"1"])assert.throws(()=>vlq(n));
  const p=fixture();p.tracks[0].notes.push({id:"n2",pitch:60,start:1,duration:1,velocity:127});
  const before=JSON.stringify(p),m=Buffer.from(encodeMidi(p));
  assert(m.includes(Buffer.from([1,128,60,0,0,144,60,127])));musicXML(p);lanes(p.tracks[0].notes,240,8);assert.equal(JSON.stringify(p),before);
});
