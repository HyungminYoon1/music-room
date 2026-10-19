import { validate, uid, PPQ } from "./model.js";
import {
  CATALOG,
  KIT_NOTES,
  gmInstrument,
  isPercussion,
} from "./instruments.js";
import { barsForEnd } from "./timeline.js";
export const MIDI_MAX_BYTES = 2000000;
const clean = (s, length) =>
  s
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, length);
const unique = (items) => [...new Set(items)];
const atZero = (items, fallback) => {
  const m = new Map();
  for (const e of items) m.set(e.tick, e);
  if (!m.has(0)) m.set(0, { tick: 0, ...fallback });
  return [...m.values()].sort((a, b) => a.tick - b.tick);
};
class Reader {
  constructor(bytes) {
    this.bytes = bytes;
    this.at = 0;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  need(n) {
    if (n < 0 || this.at + n > this.bytes.length)
      throw Error("MIDI 파일이 잘렸거나 청크 길이가 올바르지 않습니다.");
  }
  u8() {
    this.need(1);
    return this.bytes[this.at++];
  }
  u16() {
    this.need(2);
    const n = this.view.getUint16(this.at);
    this.at += 2;
    return n;
  }
  u32() {
    this.need(4);
    const n = this.view.getUint32(this.at);
    this.at += 4;
    return n;
  }
  take(n) {
    this.need(n);
    const out = this.bytes.subarray(this.at, this.at + n);
    this.at += n;
    return out;
  }
  tag() {
    return String.fromCharCode(...this.take(4));
  }
  vl() {
    let n = 0;
    for (let i = 0; i < 4; i++) {
      const b = this.u8();
      n = n * 128 + (b & 127);
      if (!(b & 128)) return n;
    }
    throw Error("MIDI 가변 길이 값은 최대 4바이트입니다.");
  }
}
export function parseMidi(input) {
  const bytes =
    input instanceof Uint8Array
      ? input
      : input instanceof ArrayBuffer
        ? new Uint8Array(input)
        : null;
  if (!bytes || bytes.byteLength > MIDI_MAX_BYTES)
    throw Error("MIDI 파일은 2MB 이내여야 합니다.");
  const r = new Reader(bytes);
  if (r.tag() !== "MThd")
    throw Error("표준 MIDI(.mid/.midi) 파일을 선택하세요.");
  const length = r.u32();
  if (length < 6) throw Error("MIDI 헤더 길이가 올바르지 않습니다.");
  r.need(length);
  const format = r.u16(),
    trackCount = r.u16(),
    ppq = r.u16();
  r.take(length - 6);
  if (![0, 1].includes(format))
    throw Error(
      "MIDI 형식 0·1을 지원합니다. 독립 패턴 형식 2는 먼저 형식 1로 변환하세요.",
    );
  if (!trackCount || trackCount > 256 || (format === 0 && trackCount !== 1))
    throw Error("원본 MIDI 트랙은 1–256개까지 읽을 수 있습니다.");
  if (!ppq || ppq & 0x8000)
    throw Error(
      "SMPTE 시간 코드 MIDI는 지원하지 않습니다. PPQ 방식으로 변환하세요.",
    );
  const warnings = [],
    rawTempos = [],
    rawMeters = [],
    parts = [],
    channelEvents = [],
    trackNames = [];
  let eventCount = 0,
    noteCount = 0,
    chunks = 0,
    trackIndex = 0,
    maxTick = 0,
    rounded = false,
    discarded = false;
  const scale = (t) => {
    const x = (t * PPQ) / ppq;
    if (!Number.isInteger(x)) rounded = true;
    return Math.round(x);
  };
  const text = (b) => {
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(b);
    } catch {
      warnings.push(
        "일부 트랙 이름은 UTF-8이 아니어서 Windows-1252로 읽었습니다. 이름을 확인하세요.",
      );
      return new TextDecoder("windows-1252").decode(b);
    }
  };
  while (r.at < bytes.length) {
    if (++chunks > 512) throw Error("MIDI 청크 수가 너무 많습니다.");
    const tag = r.tag(),
      size = r.u32(),
      data = r.take(size);
    if (tag !== "MTrk") {
      warnings.push("알 수 없는 MIDI 청크는 가져오지 않습니다.");
      continue;
    }
    if (trackIndex >= trackCount)
      throw Error("MIDI 트랙 수와 헤더가 일치하지 않습니다.");
    const tr = new Reader(data),
      groups = new Map();
    let tick = 0,
      running = 0,
      ended = false,
      port = 0,
      title = "";
    const group = (channel) => {
      const key = port + ":" + channel;
      if (!groups.has(key))
        groups.set(key, {
          id: `t${trackIndex}p${port}c${channel}`,
          sourceTrack: trackIndex,
          port,
          channel,
          notes: [],
          warnings: [],
          active: new Map(),
        });
      return groups.get(key);
    };
    while (tr.at < data.length) {
      if (++eventCount > 200000)
        throw Error("MIDI 이벤트가 200,000개를 넘습니다.");
      tick += tr.vl();
      if (tick > 1000000000 || scale(tick) > 1000000000)
        throw Error("MIDI 시간 범위가 너무 큽니다.");
      let status = tr.u8(),
        first;
      if (status < 128) {
        if (!running)
          throw Error("MIDI running status 앞에 채널 상태가 없습니다.");
        first = status;
        status = running;
      }
      if (status === 255) {
        running = 0;
        const type = tr.u8(),
          n = tr.vl(),
          b = tr.take(n);
        if (type === 47) {
          if (n !== 0 || tr.at !== data.length)
            throw Error("MIDI 트랙 종료 위치가 올바르지 않습니다.");
          ended = true;
          break;
        }
        if (type === 3) title = clean(text(b), 60);
        else if (type === 81) {
          if (n !== 3) throw Error("MIDI 템포 길이가 올바르지 않습니다.");
          const microseconds = b[0] * 65536 + b[1] * 256 + b[2];
          if (microseconds < 60000 || microseconds > 15000000)
            throw Error(
              "지원하는 MIDI 템포 범위는 4–1000 BPM입니다. 원래 값을 자동으로 바꾸지 않습니다.",
            );
          rawTempos.push({ tick: scale(tick), microseconds });
        } else if (type === 88) {
          if (n !== 4 || b[0] < 1 || b[0] > 32 || b[1] > 5 || b[3] === 0)
            throw Error("지원 박자: 분자 1–32, 분모 1·2·4·8·16·32.");
          rawMeters.push({
            tick: scale(tick),
            numerator: b[0],
            denominator: 2 ** b[1],
            clocks: b[2],
            thirtyseconds: b[3],
          });
        } else if (type === 33) {
          if (n !== 1) throw Error("MIDI 포트 값이 올바르지 않습니다.");
          port = b[0];
        } else if (![32, 0].includes(type)) discarded = true;
        continue;
      }
      if (status === 240 || status === 247) {
        running = 0;
        tr.take(tr.vl());
        discarded = true;
        continue;
      }
      if (status < 128 || status > 239)
        throw Error("지원하지 않는 MIDI 시스템 상태입니다.");
      running = status;
      const kind = status >> 4,
        channel = status & 15,
        a = first ?? tr.u8(),
        b = [12, 13].includes(kind) ? 0 : tr.u8();
      if (a > 127 || b > 127)
        throw Error("MIDI 채널 데이터는 0–127 범위입니다.");
      if (kind === 9 && b > 0) {
        if (++noteCount > 100000)
          throw Error("원본 음표가 100,000개를 넘습니다. 트랙을 나눠 주세요.");
        const g = group(channel),
          n = { pitch: a, start: scale(tick), velocity: b };
        if (!g.active.has(a)) g.active.set(a, { items: [], at: 0 });
        g.active.get(a).items.push(n);
      } else if (kind === 8 || (kind === 9 && b === 0)) {
        const g = group(channel),
          q = g.active.get(a),
          n = q && q.at < q.items.length ? q.items[q.at++] : null;
        if (!n) {
          g.warnings.push("시작이 없는 note-off는 무시했습니다.");
          continue;
        }
        const end = scale(tick);
        if (end <= n.start)
          g.warnings.push(
            "0틱 길이 음표는 편집 가능한 최소 1틱으로 바꿨습니다.",
          );
        g.notes.push({ ...n, duration: Math.max(1, end - n.start) });
      } else if ([11, 12, 14].includes(kind))
        channelEvents.push({ tick: scale(tick), port, channel, kind, a, b });
      else discarded = true;
    }
    if (!ended) throw Error("MIDI 트랙 종료 이벤트가 없습니다.");
    const end = scale(tick);
    maxTick = Math.max(maxTick, end);
    trackNames.push(title);
    for (const g of groups.values()) {
      for (const q of g.active.values())
        for (const n of q.items.slice(q.at)) {
          g.notes.push({ ...n, duration: Math.max(1, end - n.start) });
          g.warnings.push("끝나지 않은 음표를 원본 트랙 끝까지 유지했습니다.");
        }
      delete g.active;
      if (!g.notes.length) continue;
      g.endTick = end;
      g.name = title || `트랙 ${trackIndex + 1}`;
      if (groups.size > 1)
        g.name = clean(g.name + ` · 채널 ${g.channel + 1}`, 60);
      g.notes.sort((a, b) => a.start - b.start || a.pitch - b.pitch);
      parts.push(g);
    }
    trackIndex++;
  }
  if (trackIndex !== trackCount)
    throw Error("MIDI 트랙 수와 헤더가 일치하지 않습니다.");
  if (!parts.length) throw Error("가져올 음표가 없습니다.");
  if (channelEvents.length > 20000)
    throw Error("악기·컨트롤 이벤트는 20,000개 이내로 가져올 수 있습니다.");
  const tempoMap = atZero(rawTempos, { microseconds: 500000 }),
    meterMap = atZero(rawMeters, {
      numerator: 4,
      denominator: 4,
      clocks: 24,
      thirtyseconds: 8,
    });
  if (tempoMap.length > 2048 || meterMap.length > 2048)
    throw Error("템포·박자 변화는 각각 2,048개 이내입니다.");
  for (const g of parts) {
    const events = channelEvents
      .filter((e) => e.port === g.port && e.channel === g.channel)
      .sort((a, b) => a.tick - b.tick);
    g.programs = atZero(
      events
        .filter((e) => e.kind === 12)
        .map((e) => ({ tick: e.tick, program: e.a })),
      { program: 0 },
    );
    g.controllers = events
      .filter((e) => e.kind === 11)
      .map((e) => ({ tick: e.tick, controller: e.a, value: e.b }));
    g.bends = events
      .filter((e) => e.kind === 14)
      .map((e) => ({ tick: e.tick, value: e.a + 128 * e.b }));
    g.instrument = gmInstrument(
      g.programs[0].program,
      g.channel === 9,
      g.notes.map((n) => n.pitch),
    );
    if (
      g.channel !== 9 &&
      g.programs.some(
        (e) =>
          !Object.values(CATALOG).some(
            (c) => !c.percussion && c.program === e.program,
          ),
      )
    )
      g.warnings.push(
        "일부 GM 악기는 가까운 음색으로 재생합니다. 악기를 바꾸지 않으면 MIDI의 원래 악기 번호는 보존됩니다.",
      );
    if (g.channel === 9 && g.instrument === "drums")
      g.warnings.push(
        "이 타악기 패턴은 합성 드럼으로 재생하며, 원래 MIDI 음높이는 유지합니다.",
      );
    if (
      g.controllers.some(
        (e) => ![7, 10].includes(e.controller) || e.tick > 0,
      ) ||
      g.bends.length
    )
      g.warnings.push(
        "페달·컨트롤 자동화·피치 벤드는 MIDI에 보존하지만 이 앱의 재생에는 적용하지 않습니다.",
      );
    if (g.controllers.some((e) => [0, 32].includes(e.controller) && e.value))
      g.warnings.push(
        "사용자 음원 뱅크는 설치되지 않습니다. GM 대체 음색으로 재생합니다.",
      );
    g.warnings = unique(g.warnings);
    g.duration = Math.max(
      g.endTick,
      g.notes.reduce((end, n) => Math.max(end, n.start + n.duration), 0),
      events.at(-1)?.tick ?? 0,
    );
  }
  if (rounded)
    warnings.push(
      "원본 해상도를 960 PPQ로 변환하면서 일부 위치를 가장 가까운 1틱으로 반올림했습니다.",
    );
  if (discarded)
    warnings.push(
      "가사·마커·조표 메타데이터·SysEx·애프터터치는 가져오지 않습니다. 원본 파일은 변경하지 않습니다.",
    );
  return {
    format,
    ppq,
    title: clean(trackNames[0] || "가져온 MIDI", 160),
    tempoMap,
    meterMap,
    tracks: parts,
    warnings: unique(warnings),
    endTick: maxTick,
  };
}
export function reviewMidiSelection(m, ids) {
  const errors = [],
    tracks = m.tracks.filter((t) => ids.includes(t.id));
  if (!ids.length) errors.push("가져올 트랙을 선택하세요.");
  if (new Set(ids).size !== ids.length || tracks.length !== ids.length)
    errors.push("트랙 선택을 확인하세요.");
  const percussion = tracks.filter((t) => isPercussion(t.instrument)).length,
    melodic = tracks.length - percussion;
  if (tracks.length > 16 || melodic > 15 || percussion > 1)
    errors.push("최대 16트랙: 선율 15개 + 타악기 키트 1개를 선택하세요.");
  const notes = tracks.reduce((sum, t) => sum + t.notes.length, 0);
  if (notes > 4096)
    errors.push(
      `선택한 음표 ${notes.toLocaleString()}개: 4,096음 이내로 트랙을 줄여 주세요.`,
    );
  if (
    tracks.reduce(
      (n, t) => n + t.programs.length + t.controllers.length + t.bends.length,
      0,
    ) > 20000
  )
    errors.push(
      "선택한 트랙의 악기·컨트롤 이벤트가 20,000개를 넘습니다. 트랙을 줄여 주세요.",
    );
  if (tracks.some((t) => t.notes.some((n) => n.pitch < 21 || n.pitch > 108)))
    errors.push(
      "A0–C8(21–108) 밖의 음이 있는 트랙은 가져올 수 없습니다. 원본을 자동 이조하거나 삭제하지 않습니다.",
    );
  let bars = 0;
  try {
    const end = Math.max(
      1,
      ...tracks.map((t) => t.duration),
      m.tempoMap.at(-1).tick + 1,
      m.meterMap.at(-1).tick + 1,
    );
    bars = barsForEnd(m.meterMap, end);
  } catch (e) {
    errors.push(e.message);
  }
  return {
    ok: !errors.length,
    errors,
    tracks,
    notes,
    melodic,
    percussion,
    bars,
    warnings: unique([...m.warnings, ...tracks.flatMap((t) => t.warnings)]),
  };
}
export function midiToProject(m, ids) {
  const review = reviewMidiSelection(m, ids);
  if (!review.ok) throw Error(review.errors.join(" "));
  const p = {
    version: 2,
    title: m.title,
    tempo: 60000000 / m.tempoMap[0].microseconds,
    meter: [m.meterMap[0].numerator, m.meterMap[0].denominator],
    bars: review.bars,
    tempoMap: structuredClone(m.tempoMap),
    meterMap: structuredClone(m.meterMap),
    tracks: review.tracks.map((t) => {
      const initial = (cc) =>
        t.controllers.filter((e) => e.tick === 0 && e.controller === cc).at(-1)
          ?.value;
      return {
        id: uid(),
        name: t.name,
        instrument: t.instrument,
        volume: (initial(7) ?? 100) / 127,
        pan: ((initial(10) ?? 64) - 64) / 64,
        mute: false,
        solo: false,
        notes: t.notes.map((n) => ({ ...n, id: uid() })),
        midi: {
          programs: structuredClone(t.programs),
          controllers: structuredClone(t.controllers),
          bends: structuredClone(t.bends),
        },
      };
    }),
  };
  return validate(p);
}
