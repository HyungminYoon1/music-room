import { PPQ, barTicks, uid } from "./model.js";
export const CHORDS = Object.freeze({
  major: [0, 4, 7],
  minor: [0, 3, 7],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  dominant7: [0, 4, 7, 10],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  diminished: [0, 3, 6],
});
export function chordNotes(
  root,
  quality,
  inversion,
  start,
  duration,
  velocity,
  end,
) {
  if (
    !Object.hasOwn(CHORDS, quality) ||
    ![root, inversion, start, duration, velocity, end].every(
      Number.isInteger,
    ) ||
    inversion < 0 ||
    inversion >= CHORDS[quality].length ||
    duration < 1 ||
    start < 0 ||
    start + duration > end ||
    velocity < 1 ||
    velocity > 127
  )
    throw Error("코드의 위치·길이·세기를 확인하세요.");
  const pitches = CHORDS[quality].map((n) => n + root);
  for (let i = 0; i < inversion; i++) pitches.push(pitches.shift() + 12);
  if (pitches.some((n) => n < 21 || n > 108))
    throw Error("코드가 편집 가능한 음역을 벗어납니다. 옥타브를 바꿔 주세요.");
  return pitches.map((pitch) => ({
    id: uid(),
    pitch,
    start,
    duration,
    velocity,
  }));
}
export function quantizeNotes(notes, step, end) {
  if (!Number.isInteger(step) || step < 1 || !Number.isInteger(end) || end < 1)
    throw Error("격자 범위");
  return notes.map((n) => ({
    ...n,
    start: Math.max(
      0,
      Math.min(end - n.duration, Math.round(n.start / step) * step),
    ),
  }));
}
export function scalePitches(root, kind) {
  return new Set(
    (kind === "minor" ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11]).map(
      (n) => (n + root) % 12,
    ),
  );
}
export function intersectingNotes(notes, start, end, low, high) {
  return notes
    .filter(
      (n) =>
        n.start < end &&
        n.start + n.duration > start &&
        n.pitch >= low &&
        n.pitch <= high,
    )
    .map((n) => n.id);
}
export function transportPosition(p, tick) {
  const beat = (PPQ * 4) / p.meter[1],
    t = Math.max(0, Math.floor(tick));
  return (
    String(Math.floor(t / barTicks(p)) + 1).padStart(2, "0") +
    " : " +
    (Math.floor((t % barTicks(p)) / beat) + 1) +
    " : " +
    String(t % beat).padStart(3, "0")
  );
}
// Half-open scheduling window on one clock: loop boundaries never restart AudioContext.
export function loopEvents(notes, range, from, to) {
  const { start, end, offset, loop } = range,
    period = end - start;
  if (
    period <= 0 ||
    offset < start ||
    offset >= end ||
    !Number.isFinite(from) ||
    !Number.isFinite(to) ||
    to < from
  )
    throw Error("재생 구간을 확인하세요.");
  const first = loop
    ? Math.max(0, Math.floor((from + offset - start) / period) - 1)
    : 0;
  const last = loop
      ? Math.max(0, Math.floor((to + offset - start) / period))
      : 0,
    events = [];
  for (let cycle = first; cycle <= last; cycle++)
    for (const { n, t } of notes) {
      const ns = Math.max(start, n.start),
        ne = Math.min(end, n.start + n.duration);
      if (ns >= ne) continue;
      const base = cycle * period - offset;
      const at = Math.max(0, base + ns),
        skipped = Math.max(0, -base - ns);
      if (at >= from && at < to && ne - ns > skipped)
        events.push({
          n,
          t,
          at,
          offset: ns - n.start + skipped,
          duration: ne - ns - skipped,
        });
    }
  return events.sort((a, b) => a.at - b.at);
}
