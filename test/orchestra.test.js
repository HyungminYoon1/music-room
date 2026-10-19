import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyProject,
  validate,
  encodeMidi,
  musicXML,
  INSTRUMENTS,
} from "../dist/src/model.js";

function orchestra() {
  const p = emptyProject(),
    original = p.tracks[0];
  p.tracks = Array.from({ length: 16 }, (_, i) => ({
    ...structuredClone(original),
    id: "t" + i,
    name: "파트 " + i,
    instrument: i === 4 ? "orchestral-kit" : "violin",
    notes: [
      {
        id: "n" + i,
        pitch: i === 4 ? 36 : 60,
        start: 1,
        duration: 419,
        velocity: 90,
      },
    ],
  }));
  return p;
}
function midiChannels(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    out = [];
  let pos = 14;
  while (pos < bytes.length) {
    const end = pos + 8 + view.getUint32(pos + 4);
    let i = pos + 8,
      channel;
    const variable = () => {
      let v = 0,
        b;
      do {
        b = bytes[i++];
        v = (v << 7) | (b & 127);
      } while (b & 128);
      return v;
    };
    while (i < end) {
      variable();
      const status = bytes[i++];
      if (status === 255) {
        i++;
        i += variable();
      } else {
        if ((status & 240) === 144) channel = status & 15;
        i += [192, 208].includes(status & 240) ? 1 : 2;
      }
    }
    if (channel !== undefined) out.push(channel);
    pos = end;
  }
  return out;
}
test("orchestra families contain real instruments, not renamed legacy synthesizers", () => {
  for (const id of [
    "violin",
    "violin-section",
    "viola",
    "cello",
    "contrabass",
    "flute",
    "piccolo",
    "oboe",
    "clarinet",
    "bassoon",
    "trumpet",
    "horn",
    "trombone",
    "tuba",
    "harp",
    "glockenspiel",
    "marimba",
    "xylophone",
    "timpani",
    "orchestral-kit",
  ])
    assert(Object.hasOwn(INSTRUMENTS, id), id);
});
test("16-track orchestra validates; 17 tracks or two percussion kits do not", () => {
  const p = orchestra();
  assert.doesNotThrow(() => validate(p));
  p.tracks.push({ ...p.tracks[0], id: "extra", notes: [] });
  assert.throws(() => validate(p));
  p.tracks.pop();
  p.tracks[0].instrument = "drums";
  assert.throws(() => validate(p));
});
test("MIDI reserves channel 10 even when percussion is in the middle", () => {
  const p = orchestra(),
    channels = midiChannels(encodeMidi(p));
  assert.equal(channels.length, 16);
  assert.equal(channels[4], 9);
  assert.equal(new Set(channels).size, 16);
  assert(!channels.filter((_, i) => i !== 4).includes(9));
  assert(
    Buffer.from(encodeMidi(p)).includes(Buffer.from([192, 40])),
    "violin GM program",
  );
});
test("channel budget refuses 16 melodic tracks instead of silently colliding with drums", () => {
  const p = orchestra();
  p.tracks[4].instrument = "piano";
  assert.throws(() => validate(p), /15|타악/);
});
test("orchestral MusicXML retains exact timing, names and instrument program", () => {
  const p = orchestra();
  p.tracks[0].instrument = "viola";
  const raw = JSON.stringify(p),
    xml = musicXML(p);
  assert(xml.includes("<duration>419</duration>"));
  assert(xml.includes("<midi-program>42</midi-program>"));
  assert(xml.includes("<sign>C</sign><line>3</line>"));
  assert.equal(JSON.stringify(p), raw);
});
