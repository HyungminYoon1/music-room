import { CATALOG } from "./instruments.js";
const PIANO = [
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
].map(([file, root]) => ({ root, file: "piano/" + file + ".mp3", loop: null }));
const BUDGET = 128 * 1024 * 1024,
  pools = new WeakMap();
const pool = (ctx) => {
  if (!pools.has(ctx))
    pools.set(ctx, {
      cache: new Map(),
      pending: new Map(),
      bytes: 0,
      active: 0,
      queue: [],
    });
  return pools.get(ctx);
};
async function acquire(state) {
  if (state.active < 4) {
    state.active++;
    return;
  }
  await new Promise((resolve) => state.queue.push(resolve));
}
function release(state) {
  const next = state.queue.shift();
  if (next) next();
  else state.active--;
}
let manifestPromise;
async function manifest() {
  manifestPromise ??= fetch(
    new URL("../assets/orchestra/manifest.json", import.meta.url),
    { credentials: "omit" },
  )
    .then(async (r) => {
      if (!r.ok)
        throw Error("악기 목록을 불러오지 못했습니다. 다시 시도해 주세요.");
      const raw = await r.text();
      if (raw.length > 300000) throw Error("음원 목록 크기");
      const data = JSON.parse(raw);
      if (!data.banks) throw Error("음원 목록 형식");
      return data;
    })
    .catch((e) => {
      manifestPromise = null;
      throw e;
    });
  return manifestPromise;
}
export function nearestSample(instrument, pitch, bank) {
  if (!bank?.length) throw Error("악기 음원이 없습니다.");
  if (CATALOG[instrument]?.percussion) {
    const sample = bank.find((s) => s.root === pitch);
    if (!sample)
      throw Error("타악기 키트에서는 이름이 표시된 타악기 음을 사용하세요.");
    return sample;
  }
  return bank.reduce((a, b) =>
    Math.abs(a.root - pitch) <= Math.abs(b.root - pitch) ? a : b,
  );
}
async function load(ctx, sample) {
  const state = pool(ctx),
    { cache, pending } = state;
  const key = sample.file;
  if (cache.has(key)) {
    const value = cache.get(key);
    cache.delete(key);
    cache.set(key, value);
    return value;
  }
  if (pending.has(key)) return pending.get(key);
  const promise = (async () => {
    await acquire(state);
    try {
      if (!/^(piano|orchestra)\/[A-Za-z0-9-]+\.(mp3|wav)$/.test(key))
        throw Error("음원 경로 형식");
      const response = await fetch(
        new URL("../assets/" + key, import.meta.url),
        { credentials: "omit", signal: AbortSignal.timeout(30000) },
      );
      if (!response.ok)
        throw Error(
          "음원을 불러오지 못했습니다. 네트워크를 확인하고 다시 재생하세요.",
        );
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > 1200000) throw Error("음원 파일 크기 범위");
      const buffer = await ctx.decodeAudioData(bytes),
        size = buffer.length * buffer.numberOfChannels * 4;
      if (!Number.isFinite(size) || size > BUDGET)
        throw Error("음원 메모리 범위");
      const value = { ...sample, buffer, size };
      cache.set(key, value);
      state.bytes += size;
      return value;
    } finally {
      release(state);
    }
  })().finally(() => pending.delete(key));
  pending.set(key, promise);
  return promise;
}
export async function loadSamples(ctx, events, onProgress = () => {}) {
  const state = pool(ctx),
    { cache } = state;
  const sampled = events.filter((e) => CATALOG[e.t.instrument]?.sampled);
  if (!sampled.length) return new Map();
  const data = sampled.some((e) => e.t.instrument !== "piano")
    ? await manifest()
    : null;
  const requirements = new Map(),
    references = new Map();
  for (const { t, n } of sampled) {
    const bank =
      t.instrument === "piano"
        ? PIANO
        : data.banks[t.instrument]?.samples.map((s) => ({
            ...s,
            file: "orchestra/" + s.file,
          }));
    const sample = nearestSample(t.instrument, n.pitch, bank);
    requirements.set(sample.file, sample);
    references.set(t.instrument + ":" + n.pitch, sample.file);
  }
  const expected = [...requirements.values()].reduce(
    (sum, s) => sum + (s.frames ? s.frames * 4 : 4000000),
    0,
  );
  if (expected > BUDGET)
    throw Error(
      "이 곡의 음원이 브라우저 메모리 상한을 넘습니다. 악기 종류나 음역을 줄여 주세요.",
    );
  for (const [key, value] of cache) {
    if (state.bytes + expected <= BUDGET) break;
    if (!requirements.has(key)) {
      cache.delete(key);
      state.bytes -= value.size;
    }
  }
  const queue = [...requirements.values()],
    loaded = new Map();
  let index = 0,
    done = 0;
  const worker = async () => {
    while (index < queue.length) {
      const s = queue[index++],
        v = await load(ctx, s);
      loaded.set(s.file, v);
      onProgress(++done, queue.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, queue.length) }, worker));
  // Loaded references remain alive for this playback; unrelated old cache entries can be evicted.
  for (const [key, value] of cache) {
    if (state.bytes <= BUDGET) break;
    if (!requirements.has(key)) {
      cache.delete(key);
      state.bytes -= value.size;
    }
  }
  if (state.bytes > BUDGET)
    throw Error(
      "음원 메모리 상한을 넘었습니다. 페이지를 새로고침하고 악기 수를 줄여 주세요.",
    );
  return new Map([...references].map(([key, file]) => [key, loaded.get(file)]));
}
export const sampleCacheInfo = (ctx) => ({
  entries: pool(ctx).cache.size,
  bytes: pool(ctx).bytes,
  limit: BUDGET,
});
