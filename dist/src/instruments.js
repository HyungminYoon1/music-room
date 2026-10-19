// Programs are zero-based General MIDI; pitches are sounding MIDI notes (C4=60).
const define = (name, family, program, range, clef = "treble", extra = {}) => ({
  name,
  family,
  program,
  range,
  clef,
  ...extra,
});
export const CATALOG = Object.freeze({
  piano: define("그랜드 피아노", "건반", 0, [21, 108], "treble", {
    sampled: true,
  }),
  "pipe-organ": define("파이프 오르간", "건반", 19, [36, 96], "treble", {
    sampled: true,
    sustain: true,
  }),
  violin: define("솔로 바이올린", "현악", 40, [55, 96], "treble", {
    sampled: true,
    sustain: true,
  }),
  "violin-section": define("바이올린 앙상블", "현악", 48, [55, 86], "treble", {
    sampled: true,
    sustain: true,
  }),
  viola: define("비올라 앙상블", "현악", 41, [48, 84], "alto", {
    sampled: true,
    sustain: true,
  }),
  cello: define("첼로 앙상블", "현악", 42, [36, 77], "bass", {
    sampled: true,
    sustain: true,
  }),
  contrabass: define("콘트라베이스", "현악", 43, [28, 67], "bass", {
    sampled: true,
    sustain: true,
  }),
  "violin-pizz": define("바이올린 · 피치카토", "현악", 45, [55, 86], "treble", {
    sampled: true,
  }),
  "cello-pizz": define("첼로 · 피치카토", "현악", 45, [36, 77], "bass", {
    sampled: true,
  }),
  harp: define("하프", "현악", 46, [24, 96], "treble", { sampled: true }),
  flute: define("플루트", "목관", 73, [60, 96], "treble", {
    sampled: true,
    sustain: true,
  }),
  piccolo: define("피콜로", "목관", 72, [67, 91], "treble", {
    sampled: true,
    sustain: true,
  }),
  oboe: define("오보에", "목관", 68, [58, 89], "treble", {
    sampled: true,
    sustain: true,
  }),
  clarinet: define("클라리넷", "목관", 71, [50, 91], "treble", {
    sampled: true,
    sustain: true,
  }),
  bassoon: define("바순", "목관", 70, [34, 75], "bass", {
    sampled: true,
    sustain: true,
  }),
  trumpet: define("트럼펫", "금관", 56, [54, 82], "treble", {
    sampled: true,
    sustain: true,
  }),
  horn: define("프렌치 호른", "금관", 60, [34, 77], "treble", {
    sampled: true,
    sustain: true,
  }),
  trombone: define("트롬본", "금관", 57, [40, 72], "bass", {
    sampled: true,
    sustain: true,
  }),
  tuba: define("튜바", "금관", 58, [28, 65], "bass", {
    sampled: true,
    sustain: true,
  }),
  timpani: define("팀파니", "타악", 47, [36, 60], "bass", { sampled: true }),
  glockenspiel: define("글로켄슈필", "타악", 9, [67, 103], "treble", {
    sampled: true,
  }),
  marimba: define("마림바", "타악", 12, [45, 96], "treble", { sampled: true }),
  xylophone: define("실로폰", "타악", 13, [60, 96], "treble", {
    sampled: true,
  }),
  "tubular-bells": define("튜블러 벨", "타악", 14, [60, 77], "treble", {
    sampled: true,
  }),
  "orchestral-kit": define(
    "오케스트라 타악기",
    "타악",
    0,
    [36, 81],
    "percussion",
    { sampled: true, percussion: true },
  ),
  bass: define("신스 베이스", "전자음", 38, [21, 72], "bass"),
  organ: define("전자 오르간", "전자음", 16, [36, 96]),
  pluck: define("플럭 신스", "전자음", 80, [36, 96]),
  pad: define("신스 패드", "전자음", 89, [36, 96]),
  drums: define("전자 드럼 키트", "전자음", 0, [36, 46], "percussion", {
    percussion: true,
  }),
});
export const INSTRUMENTS = Object.freeze(
  Object.fromEntries(Object.entries(CATALOG).map(([k, v]) => [k, v.name])),
);
export const isPercussion = (id) => !!CATALOG[id]?.percussion;
export const KIT_NOTES = Object.freeze({
  36: "큰북",
  38: "작은북",
  49: "크래시 심벌",
  51: "서스펜디드 심벌",
  54: "탬버린",
  75: "클라베스",
  80: "트라이앵글 · 뮤트",
  81: "트라이앵글",
});
export function midiChannels(tracks) {
  let next = 0;
  return tracks.map((t) => {
    if (isPercussion(t.instrument)) return 9;
    if (next === 9) next++;
    if (next > 15)
      throw Error("선율 악기는 최대 15트랙, 타악기 키트는 1트랙입니다.");
    return next++;
  });
}
export function gmInstrument(program, percussion = false, pitches = []) {
  if (percussion)
    return pitches.every((n) => Object.hasOwn(KIT_NOTES, n))
      ? "orchestral-kit"
      : "drums";
  const exact = Object.entries(CATALOG).find(
    ([, v]) => !v.percussion && v.program === program,
  );
  if (exact) return exact[0];
  if (program < 8) return "piano";
  if (program < 16) return "marimba";
  if (program < 24) return "organ";
  if (program < 32) return "pluck";
  if (program < 40) return "bass";
  if (program < 56) return "violin-section";
  if (program < 64) return "trumpet";
  if (program < 72) return "clarinet";
  if (program < 80) return "flute";
  if (program < 88) return "pluck";
  return "pad";
}
export function trackAtNote(t, tick) {
  if (
    !Array.isArray(t.midi?.programs) ||
    !t.midi.programs.length ||
    isPercussion(t.instrument)
  )
    return t;
  let program = t.midi.programs[0].program;
  for (const e of t.midi.programs) {
    if (e.tick > tick) break;
    program = e.program;
  }
  return { ...t, instrument: gmInstrument(program) };
}
export function setTrackInstrument(t, id) {
  t.instrument = id;
  if (t.midi && Array.isArray(t.midi.controllers)) {
    delete t.midi.programs;
    t.midi.controllers = t.midi.controllers.filter(
      (e) => ![0, 32].includes(e.controller),
    );
  }
}
