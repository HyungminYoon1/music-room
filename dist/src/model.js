export const PPQ = 960,
  KEY = "score-lab-project-v1";
export const INSTRUMENTS = {
  piano: "그랜드 피아노",
  bass: "신스 베이스",
  organ: "오르간",
  pluck: "플럭 신스",
  pad: "패드",
  drums: "드럼 키트",
};
export const uid = () => crypto.randomUUID();
export const clone = (x) => structuredClone(x);
const finite = (x, min, max) =>
  typeof x === "number" && Number.isFinite(x) && x >= min && x <= max;
export const barTicks = (p) => (PPQ * p.meter[0] * 4) / p.meter[1];
export const totalTicks = (p) => p.bars * barTicks(p);
export const pitchName = (p) =>
  ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"][p % 12] +
  (Math.floor(p / 12) - 1);
export const xml = (x) =>
  String(x).replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );
export function validate(p) {
  if (
    !p ||
    p.version !== 1 ||
    typeof p.title !== "string" ||
    p.title.length > 160 ||
    !finite(p.tempo, 40, 240) ||
    !Number.isInteger(p.tempo) ||
    !Array.isArray(p.meter) ||
    !["4/4", "3/4", "6/8"].includes(p.meter.join("/")) ||
    !Number.isInteger(p.bars) ||
    p.bars < 1 ||
    p.bars > 64 ||
    !Array.isArray(p.tracks) ||
    !p.tracks.length ||
    p.tracks.length > 8
  )
    throw Error("프로젝트 형식이나 범위를 확인하세요.");
  const ids = new Set();
  let count = 0,
    drums = 0;
  const id = (x) => {
    if (typeof x !== "string" || x.length > 80 || !x || ids.has(x))
      throw Error("중복된 항목 ID입니다.");
    ids.add(x);
  };
  for (const t of p.tracks) {
    id(t.id);
    if (
      typeof t.name !== "string" ||
      t.name.length > 60 ||
      !Object.hasOwn(INSTRUMENTS, t.instrument) ||
      !finite(t.volume, 0, 1) ||
      !finite(t.pan, -1, 1) ||
      typeof t.mute !== "boolean" ||
      typeof t.solo !== "boolean" ||
      !Array.isArray(t.notes)
    )
      throw Error("트랙 설정을 확인하세요.");
    if (t.instrument === "drums") drums++;
    for (const n of t.notes) {
      id(n.id);
      count++;
      if (
        !Number.isInteger(n.pitch) ||
        !finite(n.pitch, 21, 108) ||
        !Number.isInteger(n.start) ||
        !finite(n.start, 0, totalTicks(p) - 1) ||
        !Number.isInteger(n.duration) ||
        !finite(n.duration, 1, totalTicks(p) - n.start) ||
        !Number.isInteger(n.velocity) ||
        !finite(n.velocity, 1, 127)
      )
        throw Error("음높이·시간·세기 범위를 확인하세요.");
    }
  }
  if (count > 4096 || drums > 1)
    throw Error("최대 4096음, 드럼 트랙은 1개까지입니다.");
  return p;
}
export function parseProject(raw) {
  if (typeof raw !== "string" || raw.length > 2000000)
    throw Error("프로젝트 파일은 2MB 이내입니다.");
  return validate(JSON.parse(raw));
}
export function emptyProject() {
  return {
    version: 1,
    title: "새 곡",
    tempo: 108,
    meter: [4, 4],
    bars: 8,
    tracks: [
      {
        id: uid(),
        name: "피아노",
        instrument: "piano",
        volume: 0.7,
        pan: 0,
        mute: false,
        solo: false,
        notes: [],
      },
    ],
  };
}
export function demoProject() {
  const p = emptyProject();
  p.title = "빛이 드는 오후";
  p.tempo = 104;
  const make = (name, instrument, volume, pan) => ({
    id: uid(),
    name,
    instrument,
    volume,
    pan,
    mute: false,
    solo: false,
    notes: [],
  });
  p.tracks.push(
    make("낮은 현", "bass", 0.45, -0.12),
    make("공기", "pad", 0.3, 0.2),
    make("리듬", "drums", 0.4, 0),
  );
  const chords = [
      [60, 64, 67],
      [57, 60, 64],
      [53, 57, 60],
      [55, 59, 62],
    ],
    melody = [72, 76, 79, 76, 74, 72, 69, 72, 72, 69, 65, 69, 71, 74, 67, 71];
  const add = (t, pitch, start, duration, velocity) =>
    t.notes.push({ id: uid(), pitch, start, duration, velocity });
  for (let b = 0; b < 8; b++) {
    const c = chords[b % 4];
    for (let i = 0; i < 8; i++)
      add(
        p.tracks[0],
        i % 2
          ? c[i % 3] + 12
          : melody[(b * 2 + Math.floor(i / 4)) % melody.length],
        b * 3840 + i * 480,
        420,
        i % 2 ? 64 : 88,
      );
    for (let i = 0; i < 4; i++)
      add(p.tracks[1], c[0] - 24, b * 3840 + i * 960, 720, i === 0 ? 94 : 76);
    for (const v of c) add(p.tracks[2], v, b * 3840, 3600, 56);
    for (let i = 0; i < 8; i++) {
      add(p.tracks[3], 42, b * 3840 + i * 480, 140, i % 2 ? 48 : 62);
      if (i % 4 === 0) add(p.tracks[3], 36, b * 3840 + i * 480, 230, 100);
      if (i % 4 === 2) add(p.tracks[3], 38, b * 3840 + i * 480, 180, 86);
    }
  }
  return validate(p);
}
export function soundingTracks(p) {
  const solo = p.tracks.some((t) => t.solo);
  return p.tracks.filter((t) => !t.mute && (!solo || t.solo));
}
export function exerciseProject() {
  const p = emptyProject();
  p.title = "주고받는 두 마디";
  p.bars = 2;
  p.tracks[0].name = "질문 · 첫 마디";
  p.tracks[0].notes = [72,76,79,76].map((pitch,i)=>({
    id:uid(),pitch,start:i*480,duration:420,velocity:i%2?70:90,
  }));
  p.tracks.push({id:uid(),name:"응답 · 둘째 마디",instrument:"pluck",
    volume:.6,pan:0,mute:false,solo:false,
    notes:[72,74,67,72].map((pitch,i)=>({id:uid(),pitch,
      start:barTicks(p)+i*480,duration:420,velocity:i%2?70:90})),
  });
  return validate(p);
}
export function moveNotes(notes, dt, dp, end) {
  if (![dt, dp, end].every(Number.isInteger) || end < 1)
    throw Error("음 이동 범위를 확인하세요.");
  if (!notes.length) return [];
  dt = Math.max(-Math.min(...notes.map(n=>n.start)),
    Math.min(end-Math.max(...notes.map(n=>n.start+n.duration)),dt));
  dp = Math.max(21-Math.min(...notes.map(n=>n.pitch)),
    Math.min(108-Math.max(...notes.map(n=>n.pitch)),dp));
  return notes.map(n=>({...n,start:n.start+dt,pitch:n.pitch+dp}));
}
export class History {
  constructor() {
    this.back = [];
    this.forward = [];
  }
  push(p) {
    this.back.push(JSON.stringify(p));
    this.forward = [];
    this.trim();
  }
  trim() {
    while (
      this.back.length > 60 ||
      this.back.reduce((s, v) => s + v.length, 0) > 12000000
    )
      this.back.shift();
    while (
      this.forward.length > 60 ||
      this.forward.reduce((s, v) => s + v.length, 0) > 12000000
    )
      this.forward.shift();
  }
  undo(p) {
    if (!this.back.length) return p;
    this.forward.push(JSON.stringify(p));
    const r = parseProject(this.back.pop());
    this.trim();
    return r;
  }
  redo(p) {
    if (!this.forward.length) return p;
    this.back.push(JSON.stringify(p));
    const r = parseProject(this.forward.pop());
    this.trim();
    return r;
  }
}
const be = (n, len) =>
  Array.from({ length: len }, (_, i) => (n >>> ((len - i - 1) * 8)) & 255);
export function vlq(n) {
  if (!Number.isInteger(n) || n < 0 || n > 0xfffffff)
    throw Error("MIDI delta range");
  let out = [n & 127];
  while ((n >>= 7)) out.unshift((n & 127) | 128);
  return out;
}
function midiTrack(events) {
  events.sort((a, b) => a.tick - b.tick || a.order - b.order);
  let time = 0;
  const out = [];
  for (const e of events) {
    out.push(...vlq(e.tick - time), ...e.data);
    time = e.tick;
  }
  out.push(0, 255, 47, 0);
  return [...new TextEncoder().encode("MTrk"), ...be(out.length, 4), ...out];
}
export function encodeMidi(p) {
  validate(p);
  const tempo = Math.round(60000000 / p.tempo),
    tracks = [
      midiTrack([
        { tick: 0, order: 0, data: [255, 81, 3, ...be(tempo, 3)] },
        {
          tick: 0,
          order: 1,
          data: [255, 88, 4, p.meter[0], Math.log2(p.meter[1]), 24, 8],
        },
      ]),
    ];
  const programs = { piano: 0, bass: 38, organ: 16, pluck: 80, pad: 89 };
  let ch = 0;
  for (const t of p.tracks) {
    const c = t.instrument === "drums" ? 9 : ch++,
      e = [];
    e.push(
      { tick: 0, order: 0, data: [192 + c, programs[t.instrument] ?? 0] },
      { tick: 0, order: 1, data: [176 + c, 7, Math.round(t.volume * 127)] },
      {
        tick: 0,
        order: 1,
        data: [176 + c, 10, Math.round((t.pan + 1) * 63.5)],
      },
    );
    for (const n of t.notes)
      e.push(
        { tick: n.start, order: 3, data: [144 + c, n.pitch, n.velocity] },
        { tick: n.start + n.duration, order: 2, data: [128 + c, n.pitch, 0] },
      );
    tracks.push(midiTrack(e));
  }
  return new Uint8Array([
    ...new TextEncoder().encode("MThd"),
    ...be(6, 4),
    0,
    1,
    ...be(tracks.length, 2),
    ...be(PPQ, 2),
    ...tracks.flat(),
  ]);
}
export function lanes(notes, quantum = 1, limit = Infinity) {
  const groups = new Map();
  for (const n of notes) {
    const start = Math.round(n.start / quantum) * quantum,
      end = Math.max(
        start + quantum,
        Math.round((n.start + n.duration) / quantum) * quantum,
      ),
      key = start + ":" + end;
    if (!groups.has(key)) groups.set(key, { start, end, notes: [] });
    const g = groups.get(key);
    if (!g.notes.some((v) => v.pitch === n.pitch))
      g.notes.push({ ...n, start, duration: end - start });
  }
  const out = [];
  for (const g of [...groups.values()].sort(
    (a, b) => a.start - b.start || a.end - b.end,
  )) {
    let l = out.find((l) => l.at(-1).end <= g.start);
    if (!l) {
      l = [];
      out.push(l);
    }
    l.push(g);
  }
  if (out.length > limit)
    throw Error(
      `악보에 겹치는 성부가 ${limit}개를 넘습니다. 트랙을 나눠 주세요.`,
    );
  return out.length ? out : [[]];
}
export function musicXML(p) {
  validate(p);
  const bt = barTicks(p);
  let out =
    '<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0"><work><work-title>' +
    xml(p.title) +
    "</work-title></work><part-list>" +
    p.tracks
      .map((t, i) => {
        const pitches = [...new Set(t.notes.map((n) => n.pitch))];
        const instruments =
          t.instrument === "drums"
            ? pitches
                .map(
                  (pitch) =>
                    `<score-instrument id="P${i + 1}I${pitch}"><instrument-name>GM Drum ${pitch}</instrument-name></score-instrument>`,
                )
                .join("") +
              pitches
                .map(
                  (pitch) =>
                    `<midi-instrument id="P${i + 1}I${pitch}"><midi-channel>10</midi-channel><midi-unpitched>${pitch + 1}</midi-unpitched></midi-instrument>`,
                )
                .join("")
            : "";
        return `<score-part id="P${i + 1}"><part-name>${xml(t.name)}</part-name>${instruments}</score-part>`;
      })
      .join("") +
    "</part-list>";
  for (const [ti, t] of p.tracks.entries()) {
    out += `<part id="P${ti + 1}">`;
    const voices = lanes(t.notes);
    for (let b = 0; b < p.bars; b++) {
      out += `<measure number="${b + 1}">`;
      if (b === 0)
        out += `<attributes><divisions>${PPQ}</divisions><time><beats>${p.meter[0]}</beats><beat-type>${p.meter[1]}</beat-type></time><clef><sign>${t.instrument === "bass" ? "F" : "G"}</sign><line>${t.instrument === "bass" ? 4 : 2}</line></clef></attributes><direction><sound tempo="${p.tempo}"/></direction>`;
      voices.forEach((lane, vi) => {
        if (vi) out += `<backup><duration>${bt}</duration></backup>`;
        let cursor = b * bt;
        const rest = (d) =>
          `<note><rest/><duration>${d}</duration><voice>${vi + 1}</voice></note>`;
        for (const g of lane) {
          const start = Math.max(g.start, b * bt),
            end = Math.min(g.end, (b + 1) * bt);
          if (start >= end) continue;
          if (start > cursor) out += rest(start - cursor);
          g.notes.forEach((n, ni) => {
            const pc = n.pitch % 12,
              step = [
                "C",
                "C",
                "D",
                "D",
                "E",
                "F",
                "F",
                "G",
                "G",
                "A",
                "A",
                "B",
              ][pc],
              alt = [1, 3, 6, 8, 10].includes(pc) ? "<alter>1</alter>" : "";
            out +=
              "<note>" +
              (ni ? "<chord/>" : "") +
              (t.instrument === "drums"
                ? `<unpitched><display-step>${step}</display-step><display-octave>${Math.floor(n.pitch / 12) - 1}</display-octave></unpitched>`
                : `<pitch><step>${step}</step>${alt}<octave>${Math.floor(n.pitch / 12) - 1}</octave></pitch>`) +
              `<duration>${end - start}</duration>` +
              (g.start < start ? '<tie type="stop"/>' : "") +
              (g.end > end ? '<tie type="start"/>' : "") +
              (t.instrument === "drums"
                ? `<instrument id="P${ti + 1}I${n.pitch}"/>`
                : "") +
              `<voice>${vi + 1}</voice></note>`;
          });
          cursor = end;
        }
        if (cursor < (b + 1) * bt) out += rest((b + 1) * bt - cursor);
      });
      out += "</measure>";
    }
    out += "</part>";
  }
  return out + "</score-partwise>";
}
export function encodeWav(left, right, sampleRate = 48000) {
  if (
    left.length !== right.length ||
    left.length > sampleRate * 180 ||
    !Number.isInteger(sampleRate) ||
    sampleRate < 8000 ||
    sampleRate > 96000
  )
    throw Error("WAV export bound");
  let peak = 0;
  for (let i = 0; i < left.length; i++) {
    if (!Number.isFinite(left[i]) || !Number.isFinite(right[i]))
      throw Error("Invalid waveform");
    peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  }
  const gain = peak > 1 ? 0.98 / peak : 1,
    b = new ArrayBuffer(44 + left.length * 6),
    v = new DataView(b),
    text = (o, t) =>
      [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  text(0, "RIFF");
  v.setUint32(4, b.byteLength - 8, true);
  text(8, "WAVE");
  text(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 2, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 6, true);
  v.setUint16(32, 6, true);
  v.setUint16(34, 24, true);
  text(36, "data");
  v.setUint32(40, left.length * 6, true);
  let o = 44;
  for (let i = 0; i < left.length; i++)
    for (const x of [left[i], right[i]]) {
      const n = Math.round(Math.max(-1, Math.min(1, x * gain)) * 8388607);
      v.setUint8(o++, n & 255);
      v.setUint8(o++, (n >> 8) & 255);
      v.setUint8(o++, (n >> 16) & 255);
    }
  return b;
}
