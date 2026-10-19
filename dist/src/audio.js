import {
  PPQ,
  totalTicks,
  soundingTracks,
  encodeWav,
  validate,
} from "./model.js";
import { CATALOG, trackAtNote } from "./instruments.js";
import { tickSeconds, secondsTick, beatEvents } from "./timeline.js";
import { loadSamples } from "./sampler.js";
import { loopEvents } from "./editing.js";
let context,
  generation = 0,
  timer,
  transport,
  master,
  analyser,
  limiter;
const voices = new Set();
export const audioState = () =>
  transport
    ? {
        playing: true,
        tick: secondsTick(
          transport.project,
          transport.loop
            ? transport.start +
                ((transport.offset -
                  transport.start +
                  Math.max(0, context.currentTime - transport.time)) %
                  (transport.end - transport.start))
            : Math.min(
                transport.end,
                transport.offset +
                  Math.max(0, context.currentTime - transport.time),
              ),
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
async function ensure(events, onProgress) {
  context ??= new AudioContext();
  await context.resume();
  return {
    ctx: context,
    samples: await loadSamples(context, events, onProgress),
  };
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
function voice(
  ctx,
  dest,
  t,
  n,
  when,
  seconds,
  offset = 0,
  trackLive = false,
  samples = new Map(),
) {
  const gain = ctx.createGain(),
    pan = ctx.createStereoPanner();
  gain.connect(pan);
  pan.pan.value = t.pan;
  pan.connect(dest);
  const nodes = [],
    amp = (n.velocity / 127) ** 1.5 * t.volume * 0.23,
    release =
      CATALOG[t.instrument].sampled && t.instrument !== "piano"
        ? 0.35
        : t.instrument === "pad"
          ? 0.45
          : 0.16,
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
  if (CATALOG[t.instrument].sampled) {
    const sample = samples.get(t.instrument + ":" + n.pitch),
      s = ctx.createBufferSource();
    if (!sample) throw Error("준비되지 않은 음원입니다. 다시 재생해 주세요.");
    s.buffer = sample.buffer;
    s.playbackRate.value = 2 ** ((n.pitch - sample.root) / 12);
    if (sample.loop) {
      s.loop = true;
      s.loopStart = sample.loop[0];
      s.loopEnd = sample.loop[1];
    }
    s.connect(gain);
    nodes.push(s);
    let at = offset * s.playbackRate.value;
    if (sample.loop && at >= s.loopEnd)
      at = s.loopStart + ((at - s.loopStart) % (s.loopEnd - s.loopStart));
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
    while (voices.size >= 96) voices.values().next().value.stop();
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
  limiter?.disconnect();
  analyser?.disconnect();
  master = null;
  analyser = null;
  limiter = null;
}
export async function play(
  p,
  startTick = 0,
  loop = false,
  onEnd = () => {},
  options = {},
) {
  stop();
  validate(p);
  const token = generation,
    notes = soundingTracks(p).flatMap((t) =>
      t.notes.map((n) => ({
        t: p.version === 2 ? trackAtNote(t, n.start) : t,
        n,
      })),
    );
  let loaded;
  try {
    loaded = await ensure(notes, (done, total) => {
      if (token === generation) options.onProgress?.(done, total);
    });
  } catch (e) {
    if (token !== generation) return;
    throw e;
  }
  const { ctx, samples } = loaded;
  if (token !== generation || document.hidden) return;
  master = ctx.createGain();
  master.gain.value = 0.75;
  analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  const compressor = ctx.createDynamicsCompressor();
  limiter = compressor;
  master.connect(compressor);
  compressor.connect(analyser);
  analyser.connect(ctx.destination);
  const start = loop ? (options.loopStart ?? 0) : 0,
    end = loop ? (options.loopEnd ?? totalTicks(p)) : totalTicks(p);
  if (
    !Number.isFinite(startTick) ||
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end > totalTicks(p) ||
    start >= end ||
    (loop && tickSeconds(p, end) - tickSeconds(p, start) < 0.05)
  ) {
    stop();
    throw Error(
      "재생 구간을 확인하세요. 반복 구간은 50밀리초 이상이어야 합니다.",
    );
  }
  const offset = tickSeconds(p, Math.max(start, Math.min(end - 1, startTick)));
  const timed = notes.map(({ t, n }) => ({
    t,
    n: {
      ...n,
      start: tickSeconds(p, n.start),
      duration: tickSeconds(p, n.start + n.duration) - tickSeconds(p, n.start),
    },
  }));
  const clicks = beatEvents(p).map((n) => ({
    t: {},
    n: { ...n, start: tickSeconds(p, n.start), duration: 0.001 },
  }));
  let scheduled = 0;
  transport = {
    start: tickSeconds(p, start),
    offset,
    loop,
    project: p,
    time: ctx.currentTime + 0.07,
    end: tickSeconds(p, end),
  };
  const schedule = () => {
    if (!transport || token !== generation) return;
    if (
      !loop &&
      ctx.currentTime >= transport.time + transport.end - offset + 0.55
    ) {
      stop();
      onEnd();
      return;
    }
    const elapsed = Math.max(0, ctx.currentTime - transport.time),
      ahead = elapsed + 0.15;
    // If the main thread stalled, skip expired starts instead of bursting old notes.
    const from = Math.max(scheduled, elapsed - 0.04);
    // Bound creation as well as active voices; dense MIDI must not allocate
    // thousands of immediately discarded nodes during each scheduling window.
    for (const event of loopEvents(timed, transport, from, ahead).slice(-96))
      voice(
        ctx,
        master,
        event.t,
        event.n,
        transport.time + event.at,
        event.duration + event.offset,
        event.offset,
        true,
        samples,
      );
    if (options.metronome) {
      for (const event of loopEvents(clicks, transport, from, ahead)) {
        const o = ctx.createOscillator(),
          g = ctx.createGain(),
          at = transport.time + event.at;
        o.frequency.value = event.n.accent ? 1200 : 850;
        g.gain.setValueAtTime(0.08, at);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.035);
        o.connect(g);
        g.connect(master);
        o.start(at);
        o.stop(at + 0.04);
        o.onended = () => {
          o.disconnect();
          g.disconnect();
        };
      }
    }
    scheduled = ahead;
  };
  schedule();
  timer = setInterval(schedule, 30);
}
export async function preview(t, pitch, velocity = 85) {
  const token = generation,
    { ctx, samples } = await ensure([{ t, n: { pitch } }]);
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
    samples,
  );
}
export async function wav(p) {
  validate(p);
  stop();
  const token = generation,
    seconds = tickSeconds(p, totalTicks(p)) + 1.5;
  if (seconds > 180)
    throw Error(
      "WAV는 잔향 포함 180초까지 내보낼 수 있습니다. 마디 수를 줄이거나 템포를 높여 주세요.",
    );
  const events = soundingTracks(p).flatMap((t) =>
    t.notes.map((n) => ({
      t: p.version === 2 ? trackAtNote(t, n.start) : t,
      n,
    })),
  );
  const { samples } = await ensure(events);
  if (token !== generation) throw Error("음원 내보내기가 취소되었습니다.");
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * 48000), 48000),
    g = ctx.createGain(),
    compressor = ctx.createDynamicsCompressor();
  g.gain.value = 0.75;
  g.connect(compressor);
  compressor.connect(ctx.destination);
  for (const { t, n } of events)
    voice(
      ctx,
      g,
      t,
      n,
      tickSeconds(p, n.start),
      tickSeconds(p, n.start + n.duration) - tickSeconds(p, n.start),
      0,
      false,
      samples,
    );
  const b = await ctx.startRendering();
  if (token !== generation) throw Error("음원 내보내기가 취소되었습니다.");
  return encodeWav(b.getChannelData(0), b.getChannelData(1));
}
export const cancelExport = stop;
