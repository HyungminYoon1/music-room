// Pure musical time. No DOM, audio context or persistence.
export const TICKS = 960;
export const MAX_BARS = 512;
const integer = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
export const tempoEvents = (p) =>
  p.tempoMap ?? [{ tick: 0, microseconds: Math.round(60000000 / p.tempo) }];
export const meterEvents = (p) =>
  p.meterMap ?? [
    {
      tick: 0,
      numerator: p.meter[0],
      denominator: p.meter[1],
      clocks: 24,
      thirtyseconds: 8,
    },
  ];
export function validateTimeline(p) {
  if (p.version === 1) {
    if (p.tempoMap !== undefined || p.meterMap !== undefined)
      throw Error("템포·박자 지도는 버전 2 프로젝트로 저장하세요.");
    return;
  }
  for (const [items, kind] of [
    [p.tempoMap, "tempo"],
    [p.meterMap, "meter"],
  ]) {
    if (
      !Array.isArray(items) ||
      !items.length ||
      items.length > 2048 ||
      items[0]?.tick !== 0
    )
      throw Error("템포·박자 지도 형식을 확인하세요.");
    let prev = -1;
    for (const e of items) {
      if (!e || !integer(e.tick, 0, 1000000000) || e.tick <= prev)
        throw Error("시간 지도는 0틱부터 중복 없이 정렬되어야 합니다.");
      prev = e.tick;
      if (
        kind === "tempo"
          ? !integer(e.microseconds, 60000, 15000000)
          : !integer(e.numerator, 1, 32) ||
            ![1, 2, 4, 8, 16, 32].includes(e.denominator) ||
            !integer(e.clocks, 0, 255) ||
            !integer(e.thirtyseconds, 1, 255)
      )
        throw Error("템포·박자 값이 지원 범위를 벗어납니다.");
    }
  }
  if (
    Math.abs(p.tempo - 60000000 / p.tempoMap[0].microseconds) > 1e-7 ||
    p.meter.join("/") !==
      [p.meterMap[0].numerator, p.meterMap[0].denominator].join("/")
  )
    throw Error("시작 템포·박자와 시간 지도가 일치하지 않습니다.");
}
export function barMap(p, count = p.bars) {
  const changes = meterEvents(p),
    out = [];
  let start = 0,
    index = 0;
  for (let b = 0; b < count; b++) {
    while (index + 1 < changes.length && changes[index + 1].tick <= start)
      index++;
    const m = changes[index],
      length = (TICKS * 4 * m.numerator) / m.denominator;
    const end = Math.min(start + length, changes[index + 1]?.tick ?? Infinity);
    out.push({
      start,
      end,
      meter: [m.numerator, m.denominator],
      partial: end - start < length,
    });
    start = end;
  }
  return out;
}
export const barStart = (p, index) =>
  index <= 0 ? 0 : barMap(p, Math.min(MAX_BARS, index)).at(-1).end;
export function barsForEnd(meterMap, end) {
  const bars = barMap({ meterMap }, MAX_BARS);
  const i = bars.findIndex((b) => b.end >= Math.max(1, end));
  if (i < 0)
    throw Error(
      "선택한 곡은 512마디 한도를 넘습니다. MIDI 편집기에서 구간을 나눠 저장하세요.",
    );
  return i + 1;
}
export function tickSeconds(p, tick) {
  let seconds = 0,
    at = 0,
    us = tempoEvents(p)[0].microseconds;
  for (const e of tempoEvents(p).slice(1)) {
    if (e.tick >= tick) break;
    seconds += ((e.tick - at) * us) / 1000000 / TICKS;
    at = e.tick;
    us = e.microseconds;
  }
  return seconds + ((tick - at) * us) / 1000000 / TICKS;
}
export function secondsTick(p, seconds) {
  let time = 0,
    at = 0,
    us = tempoEvents(p)[0].microseconds;
  for (const e of tempoEvents(p).slice(1)) {
    const duration = ((e.tick - at) * us) / 1000000 / TICKS;
    if (time + duration >= seconds) break;
    time += duration;
    at = e.tick;
    us = e.microseconds;
  }
  return at + ((seconds - time) * 1000000 * TICKS) / us;
}
export function setInitialTempo(p, bpm) {
  if (!Number.isFinite(bpm) || bpm < 4 || bpm > 1000)
    throw Error("BPM은 4–1000 사이로 입력하세요.");
  if (p.version === 2) {
    p.tempoMap[0].microseconds = Math.round(60000000 / bpm);
    p.tempo = 60000000 / p.tempoMap[0].microseconds;
  } else p.tempo = bpm;
}
export function setInitialMeter(p, meter) {
  p.meter = meter;
  if (p.version === 2) {
    p.meterMap[0].numerator = meter[0];
    p.meterMap[0].denominator = meter[1];
  }
}
export function beatEvents(p) {
  return barMap(p).flatMap((b) => {
    const step = (TICKS * 4) / b.meter[1],
      out = [];
    for (let t = b.start; t < b.end; t += step)
      out.push({ start: t, accent: t === b.start });
    return out;
  });
}
