import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { CATALOG } from "../dist/src/instruments.js";
import {
  nearestSample,
  loadSamples,
  sampleCacheInfo,
} from "../dist/src/sampler.js";
const manifest = JSON.parse(
  await readFile(
    new URL("../dist/assets/orchestra/manifest.json", import.meta.url),
    "utf8",
  ),
);
test("all 180 bundled recordings have pinned provenance, verified PCM and valid loop points", async () => {
  let count = 0;
  for (const [id, bank] of Object.entries(manifest.banks)) {
    assert(CATALOG[id].sampled);
    assert(bank.samples.length > 0);
    assert.match(bank.mappingSha256, /^[a-f0-9]{64}$/);
    for (const s of bank.samples) {
      count++;
      const raw = await readFile(
        new URL("../dist/assets/orchestra/" + s.file, import.meta.url),
      );
      assert.equal(createHash("sha256").update(raw).digest("hex"), s.sha256);
      assert.equal(raw.length, s.bytes);
      assert.equal(raw.subarray(0, 4).toString(), "RIFF");
      assert.equal(raw.readUInt16LE(22), 1);
      assert.equal(raw.readUInt16LE(34), 16);
      assert([44100, 48000].includes(raw.readUInt32LE(24)));
      assert(Number.isInteger(s.root) && s.root >= 21 && s.root <= 108);
      assert(s.frames / s.rate <= 9);
      if (s.loop) {
        assert(CATALOG[id].sustain);
        assert(
          s.loop[0] > 0 &&
            s.loop[1] > s.loop[0] &&
            s.loop[1] < s.frames / s.rate,
        );
      }
      assert(raw.subarray(44).some((v) => v !== 0));
    }
  }
  assert.equal(count, 180);
  assert.equal(Object.keys(manifest.banks).length, 24);
  for (const [id, info] of Object.entries(CATALOG))
    if (info.sampled && id !== "piano") assert(manifest.banks[id], id);
});
test("sample selection uses true MIDI roots; percussion never silently plays another instrument", () => {
  const bank = [{ root: 48 }, { root: 60 }, { root: 72 }];
  assert.equal(nearestSample("violin", 62, bank).root, 60);
  assert.equal(
    nearestSample("orchestral-kit", 36, [{ root: 36 }, { root: 38 }]).root,
    36,
  );
  assert.throws(() => nearestSample("orchestral-kit", 60, [{ root: 36 }]));
});
test("lazy piano requests only the needed root, reuses cache and synth needs no fetch", async (t) => {
  const original = globalThis.fetch,
    urls = [];
  t.after(() => (globalThis.fetch = original));
  globalThis.fetch = async (u) => {
    urls.push(String(u));
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) };
  };
  const ctx = {
    decodeAudioData: async () => ({
      length: 100,
      numberOfChannels: 1,
      duration: 1,
    }),
  };
  const events = [60, 61, 62].map((pitch) => ({
    t: { instrument: "piano" },
    n: { pitch },
  }));
  const samples = await loadSamples(ctx, events);
  assert.equal(urls.length, 1);
  assert(urls[0].endsWith("/piano/C4.mp3"));
  assert.equal(samples.size, 3);
  await loadSamples(ctx, events);
  assert.equal(urls.length, 1);
  await loadSamples(ctx, [{ t: { instrument: "pad" }, n: { pitch: 60 } }]);
  assert.equal(urls.length, 1);
  assert.equal(sampleCacheInfo(ctx).bytes, 400);
});
test("failed sample can retry; failure does not poison the cache", async (t) => {
  const original = globalThis.fetch;
  t.after(() => (globalThis.fetch = original));
  let calls = 0;
  globalThis.fetch = async () => ({
    ok: ++calls > 1,
    arrayBuffer: async () => new ArrayBuffer(8),
  });
  const ctx = {
      decodeAudioData: async () => ({
        length: 100,
        numberOfChannels: 1,
        duration: 1,
      }),
    },
    events = [{ t: { instrument: "piano" }, n: { pitch: 60 } }];
  await assert.rejects(loadSamples(ctx, events), /음원/);
  assert.equal(sampleCacheInfo(ctx).entries, 0);
  await loadSamples(ctx, events);
  assert.equal(calls, 2);
});
test("concurrent previews share a global four-download budget per audio context", async (t) => {
  const original = globalThis.fetch;
  t.after(() => (globalThis.fetch = original));
  let active = 0,
    peak = 0;
  globalThis.fetch = async () => {
    active++;
    peak = Math.max(peak, active);
    await new Promise((r) => setTimeout(r, 5));
    active--;
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) };
  };
  const ctx = {
    decodeAudioData: async () => ({
      length: 100,
      numberOfChannels: 1,
      duration: 1,
    }),
  };
  await Promise.all(
    [21, 30, 36, 42, 48, 54, 60, 66, 72, 78, 84, 90].map((pitch) =>
      loadSamples(ctx, [{ t: { instrument: "piano" }, n: { pitch } }]),
    ),
  );
  assert(peak <= 4, "peak concurrent sample downloads = " + peak);
});
