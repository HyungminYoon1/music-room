import test from "node:test";
import assert from "node:assert/strict";
import { emptyProject } from "../dist/src/model.js";
// Deterministic Web Audio test doubles: cancellation/lifecycle only, not sound quality.
async function fixture(t) {
  const originals = new Map(
    ["AudioContext", "OfflineAudioContext", "fetch", "document"].map((k) => [
      k,
      Object.getOwnPropertyDescriptor(globalThis, k),
    ]),
  );
  const state = {
    requests: [],
    contexts: 0,
    nodes: 0,
    offline: 0,
    render: null,
  };
  const param = () => ({
    value: 0,
    setValueAtTime() {},
    exponentialRampToValueAtTime() {},
    cancelScheduledValues() {},
  });
  const node = () => {
    state.nodes++;
    return {
      gain: param(),
      pan: param(),
      playbackRate: param(),
      connect() {},
      disconnect() {},
      start() {},
      stop() {},
    };
  };
  globalThis.document = { hidden: false };
  globalThis.AudioContext = class {
    constructor() {
      state.contexts++;
      this.currentTime = 0;
      this.destination = {};
    }
    async resume() {}
    async decodeAudioData() {
      return { duration: 1, length: 44100, numberOfChannels: 1 };
    }
    createGain() {
      return node();
    }
    createDynamicsCompressor() {
      return node();
    }
    createStereoPanner() {
      return node();
    }
    createBufferSource() {
      return node();
    }
    createAnalyser() {
      return { ...node(), fftSize: 0 };
    }
  };
  globalThis.fetch = () =>
    new Promise((resolve) =>
      state.requests.push(() =>
        resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }),
      ),
    );
  globalThis.OfflineAudioContext = class {
    constructor() {
      state.offline++;
      this.destination = {};
      this.currentTime = 0;
    }
    createGain() {
      return node();
    }
    createStereoPanner() {
      return node();
    }
    createBufferSource() {
      return node();
    }
    createDynamicsCompressor() {
      return node();
    }
    startRendering() {
      return new Promise(
        (resolve) =>
          (state.render = () =>
            resolve({ getChannelData: () => new Float32Array([0, 0.1, 0]) })),
      );
    }
  };
  const audio = await import(
    "../dist/src/audio.js?fixture=" + crypto.randomUUID()
  );
  t.after(() => {
    audio.stop();
    for (const [k, v] of originals)
      if (v) Object.defineProperty(globalThis, k, v);
      else delete globalThis[k];
  });
  const flush = async () => {
    for (let i = 0; i < 30; i++) await Promise.resolve();
  };
  const resolveSamples = async () => {
    await flush();
    assert.equal(state.requests.length, 1);
    state.requests.forEach((fn) => fn());
    await flush();
  };
  const p = emptyProject();
  p.tracks[0].notes = [
    { id: "one", pitch: 60, start: 0, duration: 960, velocity: 88 },
  ];
  return { audio, state, flush, resolveSamples, p };
}
test("stop cancels delayed play before any voice or transport is created", async (t) => {
  const { audio, state, p, flush, resolveSamples } = await fixture(t);
  const pending = audio.play(p);
  await flush();
  audio.stop();
  await resolveSamples();
  await pending;
  assert.deepEqual(audio.audioState(), { playing: false, tick: 0 });
  assert.equal(state.nodes, 0);
});
test("stop cancels delayed note preview and hidden page cancels play", async (t) => {
  const { audio, state, p, flush, resolveSamples } = await fixture(t);
  const pending = audio.preview(p.tracks[0], 60);
  await flush();
  audio.stop();
  await resolveSamples();
  await pending;
  assert.equal(state.nodes, 0);
  document.hidden = true;
  await audio.play(p);
  assert.equal(audio.audioState().playing, false);
  assert.equal(state.nodes, 0);
});
test("WAV cancellation while loading does not allocate offline rendering", async (t) => {
  const { audio, state, p, flush, resolveSamples } = await fixture(t);
  const pending = audio.wav(p);
  const rejected = assert.rejects(pending, /취소/);
  await flush();
  audio.cancelExport();
  await resolveSamples();
  await rejected;
  assert.equal(state.offline, 0);
});
test("WAV cancellation after rendering begins discards completed stale buffer", async (t) => {
  const { audio, state, p, flush, resolveSamples } = await fixture(t);
  const pending = audio.wav(p);
  const rejected = assert.rejects(pending, /취소/);
  await resolveSamples();
  await flush();
  assert.equal(state.offline, 1);
  audio.cancelExport();
  state.render();
  await rejected;
  assert.equal(audio.audioState().playing, false);
});
test("over-180-second WAV refuses before audio context/sample work", async (t) => {
  const { audio, state, p } = await fixture(t);
  p.bars = 64;
  p.tempo = 40;
  await assert.rejects(audio.wav(p), /180초/);
  assert.equal(state.contexts, 0);
  assert.equal(state.requests.length, 0);
  assert.equal(state.offline, 0);
});
test("sub-50ms loop is rejected before scheduling excessive repeat events", async (t) => {
  const { audio, p, resolveSamples } = await fixture(t);
  const pending = audio.play(p, 0, true, () => {}, {
    loopStart: 0,
    loopEnd: 1,
  });
  const rejected = assert.rejects(pending, /구간|50/);
  await resolveSamples();
  await rejected;
  assert.equal(audio.audioState().playing, false);
});
test("dense imported chord does not allocate thousands of voices before applying its live cap", async (t) => {
  const { audio, p, state, resolveSamples } = await fixture(t);
  p.tracks[0].notes = Array.from({ length: 4096 }, (_, i) => ({
    id: "dense" + i,
    pitch: 60,
    start: 0,
    duration: 960,
    velocity: 80,
  }));
  const pending = audio.play(p);
  await resolveSamples();
  await pending;
  assert(state.nodes <= 400, `allocated ${state.nodes} nodes`);
  audio.stop();
});
