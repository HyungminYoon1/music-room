import {
  PPQ,
  totalTicks,
  soundingTracks,
  encodeWav,
  validate,
} from "./model.js";
const SAMPLES = [
  ["A0", 21],
  ["Fs1", 30],
  ["C2", 36],
  ["Fs2", 42],
  ["C3", 48],
  ["Fs3", 54],
  ["C4", 60],
  ["Fs4", 66],
  ["C5", 72],
  ["Fs5", 78],
  ["C6", 84],
  ["Fs6", 90],
  ["C7", 96],
  ["Fs7", 102],
  ["C8", 108],
];
let context,
  buffers,
  loading,
  generation = 0,
  timer,
  transport,
  master,
  analyser;
const voices = new Set();
export const audioState = () =>
  transport
    ? {
        playing: true,
        tick: Math.min(
          transport.end,
          transport.start +
            (Math.max(0, context.currentTime - transport.time) *
              transport.tempo *
              PPQ) /
              60,
        ),
      }
    : { playing: false, tick: 0 };
export function meter() {
  if (!analyser) return 0;
  const a = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(a);
  return Math.min(
    1,
    Math.sqrt(a.reduce((s, x) => s + x * x, 0) / a.length) * 3,
  );
}
async function ensure() {
  context ??= new AudioContext();
  await context.resume();
  if (!buffers) {
    loading ??= Promise.all(
      SAMPLES.map(async ([name, pitch]) => {
        const r = await fetch(
          new URL(`../assets/piano/${name}.mp3`, import.meta.url),
          { credentials: "omit" },
        );
        if (!r.ok) throw Error("피아노 음원을 불러오지 못했습니다.");
        const raw = await r.arrayBuffer();
        if (raw.byteLength > 1000000) throw Error("음원 크기 범위");
        return { pitch, buffer: await context.decodeAudioData(raw) };
      }),
    )
      .then((v) => {
        buffers = v;
        return v;
      })
      .finally(() => {
        loading = null;
      });
    await loading;
  }
  return context;
}
function noise(ctx, seed) {
  const b = ctx.createBuffer(
      1,
      Math.ceil(ctx.sampleRate * 0.6),
      ctx.sampleRate,
    ),
    d = b.getChannelData(0);
  let s = seed >>> 0;
  for (let i = 0; i < d.length; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    d[i] = s / 2147483648 - 1;
  }
  return b;
}
function voice(ctx, dest, t, n, when, seconds, offset = 0, trackLive = false) {
  const gain = ctx.createGain(),
    pan = ctx.createStereoPanner();
  gain.connect(pan);
  pan.pan.value = t.pan;
  pan.connect(dest);
  const nodes = [],
    amp = (n.velocity / 127) ** 1.5 * t.volume * 0.23,
    release = t.instrument === "pad" ? 0.45 : 0.16,
    dur = Math.max(0.012, seconds - offset),
    start = Math.max(ctx.currentTime, when),
    end = start + dur + release;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, amp), start + 0.006);
  gain.gain.setValueAtTime(Math.max(0.0001, amp), start + dur);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  const hz = 440 * 2 ** ((n.pitch - 69) / 12),
    osc = (freq, type, level = 1) => {
      const o = ctx.createOscillator(),
        g = ctx.createGain();
      o.frequency.setValueAtTime(freq, start);
      o.type = type;
      g.gain.value = level;
      o.connect(g);
      g.connect(gain);
      nodes.push(o, g);
      o.start(start);
      o.stop(end + 0.02);
      return o;
    };
  if (t.instrument === "piano") {
    const sample = buffers.reduce((a, b) =>
        Math.abs(a.pitch - n.pitch) < Math.abs(b.pitch - n.pitch) ? a : b,
      ),
      s = ctx.createBufferSource();
    s.buffer = sample.buffer;
    s.playbackRate.value = 2 ** ((n.pitch - sample.pitch) / 12);
    s.connect(gain);
    nodes.push(s);
    const at = offset * s.playbackRate.value;
    if (at < sample.buffer.duration) {
      s.start(start, at);
      s.stop(end + 0.02);
    }
  } else if (t.instrument === "drums") {
    gain.gain.cancelScheduledValues(start);
    gain.gain.setValueAtTime(amp, start);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      start + (n.pitch === 36 ? 0.35 : n.pitch === 38 ? 0.2 : 0.065),
    );
    if (n.pitch === 36) {
      const o = osc(145, "sine");
      o.frequency.exponentialRampToValueAtTime(42, start + 0.2);
    } else {
      const s = ctx.createBufferSource(),
        f = ctx.createBiquadFilter();
      s.buffer = noise(ctx, n.pitch * 10007 + n.start);
      f.type = "highpass";
      f.frequency.value = n.pitch === 38 ? 1000 : 6500;
      s.connect(f);
      f.connect(gain);
      nodes.push(s, f);
      s.start(start);
      s.stop(start + 0.6);
      if (n.pitch === 38) osc(190, "triangle", 0.4);
    }
  } else if (t.instrument === "bass") {
    osc(hz, "triangle");
    osc(hz / 2, "sine", 0.25);
  } else if (t.instrument === "organ") {
    osc(hz, "sine", 0.75);
    osc(hz * 2, "sine", 0.22);
    osc(hz * 3, "sine", 0.13);
  } else if (t.instrument === "pluck") {
    osc(hz, "triangle");
    gain.gain.cancelScheduledValues(start);
    gain.gain.setValueAtTime(Math.max(0.0001, amp), start);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
  } else {
    osc(hz, "sine", 0.65);
    osc(hz * 1.003, "triangle", 0.22);
  }
  let stopped = false;
  const v = {
    stop() {
      if (stopped) return;
      stopped = true;
      for (const node of nodes) {
        try {
          if (node.stop) node.stop();
          node.disconnect();
        } catch {}
      }
      gain.disconnect();
      pan.disconnect();
      voices.delete(v);
    },
  };
  if (trackLive) {
    voices.add(v);
    setTimeout(
      () => v.stop(),
      Math.max(0, (end - ctx.currentTime + 0.1) * 1000),
    );
  }
  return v;
}
export function stop() {
  generation++;
  clearInterval(timer);
  timer = null;
  transport = null;
  for (const v of [...voices]) v.stop();
  master?.disconnect();
  master = null;
  analyser = null;
}
export async function play(p, startTick = 0, loop = false, onEnd = () => {}) {
  stop();
  validate(p);
  const token = generation,
    ctx = await ensure();
  if (token !== generation || document.hidden) return;
  master = ctx.createGain();
  master.gain.value = 0.75;
  analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  master.connect(analyser);
  analyser.connect(ctx.destination);
  const notes = soundingTracks(p)
      .flatMap((t) => t.notes.map((n) => ({ t, n })))
      .sort((a, b) => a.n.start - b.n.start),
    sec = 60 / p.tempo / PPQ,
    end = totalTicks(p);
  let index = 0;
  transport = {
    start: startTick,
    time: ctx.currentTime + 0.07,
    tempo: p.tempo,
    end,
  };
  while (
    index < notes.length &&
    notes[index].n.start + notes[index].n.duration <= startTick
  )
    index++;
  const schedule = () => {
    if (!transport || token !== generation) return;
    const tick = audioState().tick;
    if (ctx.currentTime >= transport.time + (end - startTick) * sec + 0.55) {
      stop();
      if (loop && !document.hidden) play(p, 0, true, onEnd).catch(onEnd);
      else onEnd();
      return;
    }
    const ahead = tick + 0.15 / sec;
    while (index < notes.length && notes[index].n.start <= ahead) {
      const { t, n } = notes[index++];
      if (n.start + n.duration <= startTick) continue;
      if (voices.size > 96)
        for (const v of [...voices].slice(0, voices.size - 96)) v.stop();
      const offset = Math.max(0, startTick - n.start) * sec;
      voice(
        ctx,
        master,
        t,
        n,
        transport.time + Math.max(0, n.start - startTick) * sec,
        n.duration * sec,
        offset,
        true,
      );
    }
  };
  schedule();
  timer = setInterval(schedule, 30);
}
export async function preview(t, pitch, velocity = 85) {
  const token = generation,
    ctx = await ensure();
  if (token !== generation || document.hidden) return;
  voice(
    ctx,
    ctx.destination,
    { ...t, volume: t.volume * 0.45 },
    { pitch, velocity, start: 0 },
    ctx.currentTime + 0.015,
    0.45,
    0,
    true,
  );
}
export async function wav(p) {
  validate(p);
  stop();
  const token = generation,
    seconds = (totalTicks(p) * 60) / p.tempo / PPQ + 1.5;
  if (seconds > 180)
    throw Error(
      "WAV는 잔향 포함 180초까지 내보낼 수 있습니다. 마디 수를 줄이거나 템포를 높여 주세요.",
    );
  await ensure();
  if (token !== generation) throw Error("음원 내보내기가 취소되었습니다.");
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * 48000), 48000),
    g = ctx.createGain(),
    compressor = ctx.createDynamicsCompressor();
  g.gain.value = 0.75;
  g.connect(compressor);
  compressor.connect(ctx.destination);
  const sec = 60 / p.tempo / PPQ;
  for (const t of soundingTracks(p))
    for (const n of t.notes)
      voice(ctx, g, t, n, n.start * sec, n.duration * sec);
  const b = await ctx.startRendering();
  if (token !== generation) throw Error("음원 내보내기가 취소되었습니다.");
  return encodeWav(b.getChannelData(0), b.getChannelData(1));
}
export const cancelExport = stop;
