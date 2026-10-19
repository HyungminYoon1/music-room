import test from "node:test";
import assert from "node:assert/strict";
import {
  parseMidi,
  midiToProject,
  reviewMidiSelection,
} from "../dist/src/midi-import.js";
import {
  encodeMidi,
  validate,
  parseProject,
  emptyProject,
  totalTicks,
  musicXML,
} from "../dist/src/model.js";
import { barMap, tickSeconds, secondsTick } from "../dist/src/timeline.js";
import { smf, name, tempo, meter, changingMidi } from "./midi-fixtures.js";
import { setTrackInstrument, trackAtNote } from "../dist/src/instruments.js";
test("an extra note-off never consumes a later note-on of the same pitch", () => {
  const m = parseMidi(
    smf([
      [
        [0, [0x90, 60, 70]],
        [100, [0x80, 60, 0]],
        [120, [0x80, 60, 0]],
        [200, [0x90, 60, 80]],
        [300, [0x80, 60, 0]],
      ],
    ]),
  );
  assert.deepEqual(
    m.tracks[0].notes.map((n) => [n.start, n.duration]),
    [
      [0, 200],
      [400, 200],
    ],
  );
});
const all = (m) => m.tracks.map((t) => t.id);
test("extreme MIDI tempo cannot create unbounded sub-millisecond looping", () => {
  for (const us of [1, 59999, 15000001])
    assert.throws(
      () =>
        parseMidi(
          smf([
            [
              [0, tempo(us)],
              [0, [0x90, 60, 80]],
              [1, [0x80, 60, 0]],
            ],
          ]),
        ),
      /템포|BPM/,
    );
  for (const us of [60000, 15000000]) {
    const m = parseMidi(
      smf([
        [
          [0, tempo(us)],
          [0, [0x90, 60, 80]],
          [1, [0x80, 60, 0]],
        ],
      ]),
    );
    validate(midiToProject(m, all(m)));
  }
});
test("SMF 1 imports names, exact tempo and meter changes, program changes, notes and percussion", () => {
  const m = parseMidi(changingMidi());
  assert.equal(m.tracks.length, 2);
  const p = midiToProject(m, all(m));
  validate(p);
  assert.equal(p.version, 2);
  assert.equal(p.tempo, 120);
  assert.equal(p.tracks[0].name, "바이올린");
  assert.equal(p.tracks[0].instrument, "violin");
  assert.equal(p.tracks[0].notes[0].duration, 960);
  assert.deepEqual(
    p.tempoMap.map((x) => [x.tick, x.microseconds]),
    [
      [0, 500000],
      [3840, 666667],
      [6720, 400000],
    ],
  );
  assert.deepEqual(
    p.meterMap.map((x) => [x.tick, x.numerator, x.denominator]),
    [
      [0, 4, 4],
      [3840, 3, 4],
      [6720, 6, 8],
    ],
  );
  assert.deepEqual(
    p.tracks[0].midi.programs.map((x) => [x.tick, x.program]),
    [
      [0, 40],
      [3840, 73],
    ],
  );
  assert.equal(p.tracks[1].instrument, "orchestral-kit");
  assert.deepEqual(
    barMap(p).map((b) => b.start),
    [0, 3840, 6720],
  );
  assert.equal(totalTicks(p), 9600);
  assert(Math.abs(tickSeconds(p, 6720) - 4.000001) < 1e-9);
  for (const tick of [0, 1, 3839, 3840, 5000, 6720, 9000])
    assert(Math.abs(secondsTick(p, tickSeconds(p, tick)) - tick) < 1e-7);
  assert.deepEqual(parseProject(JSON.stringify(p)), p);
  const round = parseMidi(encodeMidi(p));
  assert.deepEqual(round.tempoMap, m.tempoMap);
  assert.deepEqual(round.meterMap, m.meterMap);
  assert.deepEqual(
    round.tracks.map((t) =>
      t.notes.map(({ pitch, start, duration, velocity }) => ({
        pitch,
        start,
        duration,
        velocity,
      })),
    ),
    m.tracks.map((t) =>
      t.notes.map(({ pitch, start, duration, velocity }) => ({
        pitch,
        start,
        duration,
        velocity,
      })),
    ),
  );
  const xml = musicXML(p);
  assert(xml.includes("<beats>3</beats>"));
  assert(xml.includes("<beats>6</beats>"));
  assert(xml.includes('tempo="' + 60000000 / 666667 + '"'));
});
test("SMF 0 splits channels, supports running status and note-on zero note-off", () => {
  const m = parseMidi(
    smf(
      [
        [
          [0, name("채널")],
          [0, [0xc0, 68]],
          [0, [0xc1, 71]],
          [0, [0x90, 60, 80]],
          [120, [62, 70]],
          [240, [60, 0]],
          [360, [62, 0]],
          [360, [0x91, 67, 90]],
          [480, [0x81, 67, 0]],
        ],
      ],
      { format: 0 },
    ),
  );
  assert.equal(m.tracks.length, 2);
  assert.equal(m.tracks[0].notes[0].duration, 480);
  assert.equal(m.tracks[0].notes[1].duration, 480);
  assert.deepEqual(
    midiToProject(m, all(m)).tracks.map((t) => t.instrument),
    ["oboe", "clarinet"],
  );
});
test("more than 16 source parts require selection; 15 melodic plus kit can be chosen without truncation", () => {
  const tracks = Array.from({ length: 18 }, (_, i) => [
    [0, name("파트 " + i)],
    [0, [255, 33, 1, i]],
    [0, [0xc0, 40]],
    [0, [0x90, 60, 80]],
    [480, [0x80, 60, 0]],
  ]);
  tracks.push([
    [0, [0x99, 36, 90]],
    [120, [0x89, 36, 0]],
  ]);
  const m = parseMidi(smf(tracks));
  assert.equal(m.tracks.length, 19);
  assert(!reviewMidiSelection(m, all(m)).ok);
  assert.throws(() => midiToProject(m, all(m)), /16|15/);
  const selected = [...all(m).slice(0, 15), all(m).at(-1)];
  assert(reviewMidiSelection(m, selected).ok);
  assert.equal(midiToProject(m, selected).tracks.length, 16);
  assert.throws(() => midiToProject(m, []));
  assert.throws(() => midiToProject(m, [selected[0], selected[0]]));
  assert.throws(() => midiToProject(m, ["unknown"]));
});
test("unknown GM sounds and unsupported expression are disclosed while MIDI export preserves their data", () => {
  const m = parseMidi(
    smf([
      [
        [0, [0xc0, 25]],
        [0, [0xb0, 64, 127]],
        [0, [0x90, 60, 90]],
        [240, [0xe0, 1, 65]],
        [480, [0x80, 60, 0]],
        [960, [0xb0, 64, 0]],
        [960, [0xf0, 2, 1, 0xf7]],
      ],
    ]),
  );
  const p = midiToProject(m, all(m));
  assert(m.warnings.length);
  assert(m.tracks[0].warnings.length);
  const m2 = parseMidi(encodeMidi(p));
  assert.equal(m2.tracks[0].programs[0].program, 25);
  assert(
    m2.tracks[0].controllers.some(
      (e) => e.controller === 64 && e.value === 127,
    ),
  );
  assert.equal(m2.tracks[0].bends[0].value, 8321);
});
test("reject malformed header, tracks, VLQ, invalid data, SMPTE, format2 and oversized files atomically", () => {
  const malformed = [
    new Uint8Array(),
    new Uint8Array(2000001),
    changingMidi().slice(0, -1),
    smf([[[0, [0x90, 60, 200]]]]),
    smf([[[0, [60, 90]]]]),
    smf([[[0, tempo(0)]]]),
    smf([[]], { format: 2 }),
    smf([[]], { ppq: 0xe728 }),
  ];
  for (const bytes of malformed) assert.throws(() => parseMidi(bytes));
  const v = smf([
    [
      [0, [0x90, 60, 80]],
      [480, [0x80, 60, 0]],
    ],
  ]);
  v.set([0x81, 0x81, 0x81, 0x81, 0], 22);
  assert.throws(() => parseMidi(v));
});
test("unterminated and unmatched notes have explicit warnings; out-of-range pitches and note budget never silently disappear", () => {
  const m = parseMidi(
    smf([
      [
        [0, [0x80, 70, 0]],
        [0, [0x90, 60, 80]],
        [480, name("종료")],
      ],
    ]),
  );
  assert(m.tracks[0].warnings.length);
  assert.equal(m.tracks[0].notes[0].duration, 960);
  const low = parseMidi(
    smf([
      [
        [0, [0x90, 10, 80]],
        [480, [0x80, 10, 0]],
      ],
    ]),
  );
  assert(!reviewMidiSelection(low, all(low)).ok);
  const many = parseMidi(
    smf([
      Array.from({ length: 4097 }, (_, i) => [
        [i * 2, [0x90, 60, 90]],
        [i * 2 + 1, [0x80, 60, 0]],
      ]).flat(),
    ]),
  );
  assert(!reviewMidiSelection(many, all(many)).ok);
});
test("arbitrary PPQ conversion is bounded and reported; partial meter bars keep absolute tick positions", () => {
  const m = parseMidi(
    smf(
      [
        [
          [0, meter(7, 8)],
          [1, [0x90, 60, 80]],
          [4, [0x80, 60, 0]],
          [400, meter(5, 4)],
          [500, [0x90, 70, 80]],
          [600, [0x80, 70, 0]],
        ],
      ],
      { ppq: 1000 },
    ),
  );
  const p = midiToProject(m, all(m));
  assert(m.warnings.some((w) => w.includes("틱")));
  assert.equal(p.tracks[0].notes[0].start, 1);
  assert.equal(barMap(p)[0].end, 384);
  validate(p);
});
test("legacy v1 remains readable and corrupt timing maps fail before playback", () => {
  const legacy = emptyProject();
  assert.deepEqual(parseProject(JSON.stringify(legacy)), legacy);
  const p = midiToProject(
    parseMidi(changingMidi()),
    all(parseMidi(changingMidi())),
  );
  for (const modify of [
    (q) => (q.tempoMap[1].tick = -1),
    (q) => (q.tempoMap[0].microseconds = 0),
    (q) => (q.meterMap[1].denominator = 3),
    (q) => q.tempoMap.reverse(),
    (q) => (q.tracks[0].midi.bends = [{ tick: 0, value: 20000 }]),
  ]) {
    const q = structuredClone(p);
    modify(q);
    assert.throws(() => validate(q));
  }
});
test("late controller/program events and trailing rests are retained rather than failing validation", () => {
  const m = parseMidi(
    smf([
      [
        [0, [0xc0, 40]],
        [0, [0x90, 60, 90]],
        [480, [0x80, 60, 0]],
        [3000, [0xb0, 64, 0]],
        [4000, [0xc0, 73]],
        [8000, name("end")],
      ],
    ]),
  );
  const p = midiToProject(m, all(m));
  assert(totalTicks(p) >= 16000);
  assert.equal(parseMidi(encodeMidi(p)).tracks[0].programs.at(-1).tick, 8000);
});
test("long MIDI fits up to 512 bars, but 513 bars and duplicated controller budget are refused", () => {
  for (const bars of [65, 128, 512, 513]) {
    const m = parseMidi(
      smf([
        [
          [0, [0x90, 60, 80]],
          [bars * 1920, [0x80, 60, 0]],
        ],
      ]),
    );
    const review = reviewMidiSelection(m, all(m));
    assert.equal(review.ok, bars <= 512);
    if (review.ok) assert.equal(midiToProject(m, all(m)).bars, bars);
  }
  const m = parseMidi(changingMidi());
  m.tracks[0].controllers = Array.from({ length: 20000 }, () => ({
    tick: 0,
    controller: 64,
    value: 0,
  }));
  assert(!reviewMidiSelection(m, all(m)).ok);
});
test("overlapping same-pitch notes pair FIFO, including a zero-velocity release", () => {
  const m = parseMidi(
    smf(
      [
        [
          [0, [0x90, 60, 70]],
          [120, [60, 80]],
          [240, [60, 0]],
          [480, [0x80, 60, 0]],
        ],
      ],
      { format: 0 },
    ),
  );
  assert.deepEqual(
    m.tracks[0].notes.map((n) => [n.start, n.duration, n.velocity]),
    [
      [0, 480, 70],
      [240, 720, 80],
    ],
  );
});
test("explicit instrument edits replace imported programs and banks but retain notes, pedal and bends", () => {
  const m = parseMidi(changingMidi()),
    p = midiToProject(m, all(m)),
    t = p.tracks[0];
  assert.equal(trackAtNote(t, 4000).instrument, "flute");
  t.midi.controllers.push({ tick: 500, controller: 32, value: 1 });
  const notes = structuredClone(t.notes);
  setTrackInstrument(t, "cello");
  assert.deepEqual(t.notes, notes);
  assert.equal(t.midi.programs, undefined);
  assert(!t.midi.controllers.some((e) => [0, 32].includes(e.controller)));
  assert.equal(parseMidi(encodeMidi(p)).tracks[0].programs[0].program, 42);
});
