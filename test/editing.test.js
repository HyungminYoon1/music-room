import test from "node:test";
import assert from "node:assert/strict";
import {
  chordNotes,
  quantizeNotes,
  scalePitches,
  intersectingNotes,
  transportPosition,
  loopEvents,
} from "../dist/src/editing.js";
test("chords use real intervals/inversions and reject rather than drop out-of-range notes", () => {
  assert.deepEqual(
    chordNotes(60, "maj7", 1, 0, 960, 90, 3840).map((n) => n.pitch),
    [64, 67, 71, 72],
  );
  assert.throws(() => chordNotes(108, "major", 0, 0, 960, 90, 3840));
  assert.throws(() => chordNotes(60, "major", 0, 3600, 960, 90, 3840));
  assert.throws(() => chordNotes(60, "__proto__", 0, 0, 960, 90, 3840));
});
test("quantize preserves pitches and durations, clamps to last valid tick and is pure", () => {
  const ns = [
      { id: "a", pitch: 60, start: 133, duration: 419, velocity: 90 },
      { id: "b", pitch: 72, start: 3800, duration: 40, velocity: 80 },
    ],
    raw = JSON.stringify(ns);
  const q = quantizeNotes(ns, 240, 3840);
  assert.equal(q[0].start, 240);
  assert.equal(q[0].duration, 419);
  assert.equal(q[1].start, 3800);
  assert.equal(JSON.stringify(ns), raw);
  assert.throws(() => quantizeNotes(ns, 0, 3840));
});
test("marquee intersects note duration, not only its onset", () => {
  const ns = [
    { id: "a", pitch: 60, start: 0, duration: 960 },
    { id: "b", pitch: 63, start: 0, duration: 960 },
  ];
  assert.deepEqual(intersectingNotes(ns, 500, 600, 60, 62), ["a"]);
});
test("musical clock uses denominator beats in 6/8", () => {
  assert.equal(transportPosition({ meter: [6, 8] }, 2400), "01 : 6 : 000");
  assert.equal(transportPosition({ meter: [6, 8] }, 2880), "02 : 1 : 000");
  assert.equal(scalePitches(0, "major").has(1), false);
});
test("loop boundary has no artificial silence, schedules each event once and clips end", () => {
  const ns = [
    { n: { start: 0, duration: 240 }, t: {} },
    { n: { start: 1900, duration: 600 }, t: {} },
  ];
  const a = loopEvents(
    ns,
    { start: 0, end: 1920, offset: 0, loop: true },
    1800,
    2200,
  );
  assert.deepEqual(
    a.map((e) => [e.at, e.duration]),
    [
      [1900, 20],
      [1920, 240],
    ],
  );
  assert.deepEqual(
    loopEvents(ns, { start: 0, end: 1920, offset: 0, loop: true }, 2200, 2300),
    [],
  );
  assert.equal(
    loopEvents(ns, { start: 0, end: 1920, offset: 0, loop: false }, 1800, 2200)
      .length,
    1,
  );
});
