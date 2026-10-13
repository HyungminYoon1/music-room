import test from "node:test";
import assert from "node:assert/strict";
import {
  PPQ,
  demoProject,
  emptyProject,
  validate,
  parseProject,
  History,
  encodeMidi,
  musicXML,
  encodeWav,
  lanes,
  vlq,
  totalTicks,
  barTicks,
  moveNotes,
  exerciseProject,
} from "../dist/src/model.js";
test("valid original project, exact ticks and strict imported bounds", () => {
  const p = demoProject();
  p.tracks[0].notes[0].start = 1;
  p.tracks[0].notes[0].duration = 959;
  assert.deepEqual(parseProject(JSON.stringify(p)), p);
  for (const mutate of [
    (x) => (x.tempo = NaN),
    (x) => (x.bars = 65),
    (x) => (x.tracks[0].notes[0].start = totalTicks(x)),
    (x) => (x.tracks[0].notes[0].velocity = 0),
    (x) => (x.tracks[1].id = x.tracks[0].id),
  ]) {
    const q = structuredClone(p);
    mutate(q);
    assert.throws(() => validate(q));
  }
});

test('group translation keeps timing and pitch intervals at every boundary',()=>{
  const notes=[{id:'a',pitch:107,start:10,duration:100,velocity:88},{id:'b',pitch:100,start:300,duration:200,velocity:60}];
  const before=structuredClone(notes);
  for(const [dt,dp] of [[-100,20],[900,-200],[1,1],[-1,-1]]){
    const moved=moveNotes(notes,dt,dp,1000);
    assert.equal(moved[1].start-moved[0].start,290);
    assert.equal(moved[0].pitch-moved[1].pitch,7);
    assert(moved.every(n=>n.start>=0&&n.start+n.duration<=1000&&n.pitch>=21&&n.pitch<=108));
    assert.deepEqual(moved.map(n=>[n.id,n.duration,n.velocity]),notes.map(n=>[n.id,n.duration,n.velocity]));
  }
  assert.deepEqual(notes,before);
  assert.throws(()=>moveNotes(notes,NaN,0,1000));
});

test('two-bar exercise remains editable through project, MIDI and printed timing',()=>{
  const p=exerciseProject(),raw=JSON.stringify(p);
  assert.deepEqual(parseProject(raw),p);
  assert.equal(p.bars,2);assert.equal(p.tracks.length,2);
  assert(p.tracks[0].notes.every(n=>n.start+n.duration<=barTicks(p)));
  assert(p.tracks[1].notes.every(n=>n.start>=barTicks(p)));
  const q=parseProject(raw);q.tracks[0].notes[0].start=1;q.tracks[0].notes[0].duration=419;
  validate(q);assert(encodeMidi(q).byteLength>100);assert(musicXML(q).includes('<duration>419</duration>'));
  lanes(q.tracks[0].notes,240,8);assert.equal(q.tracks[0].notes[0].start,1);
  assert.equal(JSON.stringify(p),raw);
});
test("history preserves exact notes and drops redo after branching", () => {
  const p = demoProject(),
    h = new History();
  h.push(p);
  const q = structuredClone(p);
  q.tempo = 170;
  assert.equal(h.undo(q).tempo, 104);
  assert.equal(h.redo(p).tempo, 170);
  for (let i = 0; i < 70; i++) h.push(p);
  assert.equal(h.back.length, 60);
  h.push(p);
  assert.equal(h.forward.length, 0);
});
test("type 1 MIDI header, PPQ, tracks, variable lengths and exact note bytes", () => {
  const p = emptyProject();
  p.tracks[0].notes = [
    { id: "n", pitch: 61, start: 961, duration: 479, velocity: 81 },
  ];
  const m = encodeMidi(p),
    v = new DataView(m.buffer);
  assert.equal(new TextDecoder().decode(m.subarray(0, 4)), "MThd");
  assert.equal(v.getUint16(8), 1);
  assert.equal(v.getUint16(10), 2);
  assert.equal(v.getUint16(12), PPQ);
  assert.deepEqual(vlq(961), [135, 65]);
  assert(
    m.some(
      (_, i) =>
        m[i] === 135 &&
        m[i + 1] === 65 &&
        m[i + 2] === 144 &&
        m[i + 3] === 61 &&
        m[i + 4] === 81,
    ),
  );
  assert.throws(() => vlq(-1));
});
test("MusicXML exact overlapping voices, rests, bar-crossing ties and escaping", () => {
  const p = emptyProject();
  p.title = "<&>";
  p.tracks[0].notes = [
    { id: "a", pitch: 60, start: 3700, duration: 400, velocity: 80 },
    { id: "b", pitch: 67, start: 3701, duration: 200, velocity: 70 },
  ];
  const x = musicXML(p);
  assert(x.includes("&lt;&amp;&gt;"));
  assert(x.includes("<duration>140</duration>"));
  assert(x.includes('<tie type="stop"/>'));
  assert(x.includes("<backup><duration>3840</duration>"));
  assert(x.includes("<voice>2</voice>"));
});
test("printed lanes quantize without changing original notes", () => {
  const p = demoProject(),
    raw = JSON.stringify(p),
    v = lanes(p.tracks[0].notes, 240, 8);
  assert(
    v.every((l) => l.every((g) => g.start % 240 === 0 && g.end % 240 === 0)),
  );
  assert.equal(JSON.stringify(p), raw);
});
test("24-bit stereo WAV fields, signed samples, finite bound and attenuation", () => {
  const b = encodeWav(
      new Float32Array([0, -1, 2]),
      new Float32Array([1, 0, -2]),
    ),
    v = new DataView(b);
  assert.equal(v.getUint16(22, true), 2);
  assert.equal(v.getUint16(34, true), 24);
  assert.equal(v.getUint32(24, true), 48000);
  assert.equal(b.byteLength, 62);
  assert.throws(() => encodeWav([NaN], [0]));
  assert.throws(() => encodeWav([0], []));
});
