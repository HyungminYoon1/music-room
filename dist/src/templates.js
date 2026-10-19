import {
  emptyProject,
  demoProject,
  uid,
  validate,
  barTicks,
  PPQ,
} from "./model.js";
export const TEMPLATES = [
  {
    id: "orchestra",
    name: "새벽의 서곡",
    detail: "10파트 오케스트라 · 8마디 · 96 BPM",
  },
  {
    id: "quartet",
    name: "현악 사중주",
    detail: "바이올린 2 · 비올라 · 첼로 · 8마디",
  },
  {
    id: "chamber",
    name: "작은 정원",
    detail: "플루트 · 클라리넷 · 하프 · 첼로 · 6/8",
  },
  {
    id: "electronic",
    name: "빛이 드는 오후",
    detail: "피아노 · 신스 베이스 · 패드 · 드럼",
  },
];
export function templateProject(kind = "orchestra") {
  if (kind === "electronic") return demoProject();
  if (!["orchestra", "quartet", "chamber"].includes(kind))
    throw Error("편곡 예제를 선택하세요.");
  const p = emptyProject();
  p.title = TEMPLATES.find((t) => t.id === kind).name;
  p.tempo = kind === "chamber" ? 112 : 96;
  p.tracks = [];
  if (kind === "chamber") p.meter = [6, 8];
  const add = (name, instrument, volume, pan) => {
    const t = {
      id: uid(),
      name,
      instrument,
      volume,
      pan,
      mute: false,
      solo: false,
      notes: [],
    };
    p.tracks.push(t);
    return t;
  };
  const note = (t, pitch, start, duration, velocity = 82) =>
    t.notes.push({
      id: uid(),
      pitch,
      start: Math.round(start),
      duration: Math.min(
        p.bars * barTicks(p) - Math.round(start),
        Math.round(duration),
      ),
      velocity,
    });
  const bt = barTicks(p),
    roots = [48, 45, 41, 43, 48, 45, 41, 48];
  const lead = add(
    kind === "chamber" ? "플루트 선율" : "제1 바이올린",
    kind === "chamber" ? "flute" : "violin",
    0.64,
    -0.24,
  );
  const harmony = add(
    kind === "chamber" ? "클라리넷 응답" : "제2 바이올린",
    kind === "chamber" ? "clarinet" : "violin-section",
    0.42,
    0.2,
  );
  const middle = add(
    kind === "chamber" ? "하프 아르페지오" : "비올라",
    kind === "chamber" ? "harp" : "viola",
    0.42,
    -0.1,
  );
  const bass = add("첼로", "cello", 0.5, 0.3);
  const melody = [
    [72, 76, 79, 76],
    [72, 69, 76, 72],
    [69, 72, 77, 76],
    [71, 74, 79, 74],
    [76, 79, 84, 79],
    [81, 76, 72, 69],
    [77, 76, 74, 71],
    [72, 76, 79, 72],
  ];
  for (let b = 0; b < 8; b++) {
    const root = roots[b],
      third = [1, 5].includes(b) ? 3 : 4,
      chord = [root, root + third, root + 7];
    melody[b].forEach((pitch, i) =>
      note(
        lead,
        pitch,
        b * bt + (i * bt) / 4,
        (bt / 4) * 0.9,
        82 + (i === 0 ? 12 : 0) + (b > 3 ? 4 : 0),
      ),
    );
    note(harmony, chord[1] + 12, b * bt, bt * 0.48, 72);
    note(harmony, chord[2] + 12, b * bt + bt / 2, bt * 0.46, 68);
    if (kind === "chamber")
      for (let i = 0; i < 6; i++)
        note(
          middle,
          chord[i % 3] + 12,
          b * bt + (i * bt) / 6,
          (bt / 6) * 0.9,
          60 + i * 3,
        );
    else {
      note(middle, chord[1], b * bt, bt * 0.94, 64);
      note(middle, chord[2], b * bt, bt * 0.94, 59);
    }
    note(bass, root - 12, b * bt, bt * 0.47, 78);
    note(
      bass,
      (b === 7 ? root : root + 7) - 12,
      b * bt + bt / 2,
      bt * 0.47,
      70,
    );
  }
  if (kind === "orchestra") {
    const flute = add("플루트", "flute", 0.38, 0.1),
      horn = add("호른", "horn", 0.38, -0.32),
      low = add("콘트라베이스", "contrabass", 0.42, 0.3),
      harp = add("하프", "harp", 0.48, -0.48),
      timpani = add("팀파니", "timpani", 0.4, 0.2),
      kit = add("큰북 · 심벌", "orchestral-kit", 0.32, 0.1);
    for (let b = 0; b < 8; b++) {
      note(low, roots[b] - 12, b * bt, bt * 0.9, 72);
      if (b % 2 === 0) note(horn, roots[b] + 7, b * bt, bt * 1.5, 70);
      if (b >= 4)
        melody[b]
          .slice(0, 2)
          .forEach((n, i) =>
            note(flute, n + 12, b * bt + (i * bt) / 2, bt * 0.4, 64),
          );
      for (let i = 0; i < 8; i++)
        note(
          harp,
          roots[b] +
            [12, 16, 19, 24][i % 4] -
            (roots[b] === 45 && i % 4 === 1 ? 1 : 0),
          b * bt + (i * PPQ) / 2,
          PPQ * 0.8,
          58 + (i % 4) * 5,
        );
      if ([0, 3, 7].includes(b)) note(timpani, roots[b], b * bt, PPQ, 88);
      if (b === 0 || b === 4 || b === 7) note(kit, 36, b * bt, PPQ, 75);
      if (b === 4 || b === 7) note(kit, 49, b * bt, PPQ, 65);
    }
  }
  return validate(p);
}
