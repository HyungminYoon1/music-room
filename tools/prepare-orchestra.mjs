// Reproducible, bounded CC0 asset preparation. Never run as part of a visitor request.
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { CATALOG, KIT_NOTES } from "../dist/src/instruments.js";
const root = resolve(import.meta.dirname, ".."),
  out = resolve(root, "dist/assets/orchestra");
const sourceCommit = "440300901dfe9275fd84e0b7763af1f8443ae62e",
  mappingCommit = "6dd651d55dde97fd4028699be9d4481f26917891";
const url = (sha, path) =>
  "https://raw.githubusercontent.com/sgossner/VSCO-2-CE/" +
  sha +
  "/" +
  path.split("/").map(encodeURIComponent).join("/");
const banks = {
  "pipe-organ": "OrganQuiet.sfz",
  violin: "SViolinVib.sfz",
  "violin-section": "ViolinEnsSusVib.sfz",
  viola: "ViolaEnsSusVib.sfz",
  cello: "CelloEnsSusVib.sfz",
  contrabass: "ContrabassSusNV.sfz",
  "violin-pizz": "ViolinEnsPizz.sfz",
  "cello-pizz": "CelloEnsPizz.sfz",
  harp: "Harp.sfz",
  flute: "FluteSusNV.sfz",
  piccolo: "PiccoloSus.sfz",
  oboe: "OboeSusNV.sfz",
  clarinet: "ClarinetSus.sfz",
  bassoon: "BassoonSus.sfz",
  trumpet: "TrumpetSus.sfz",
  horn: "FHornSus.sfz",
  trombone: "TromboneSus.sfz",
  tuba: "TubaSus.sfz",
  timpani: "Timpani.sfz",
  glockenspiel: "Glockenspiel.sfz",
  marimba: "Marimba.sfz",
  xylophone: "Xylophone.sfz",
  "tubular-bells": "TubularBells.sfz",
  "orchestral-kit": "GM-StylePerc.sfz",
};
const hash = (b) => createHash("sha256").update(b).digest("hex");
await mkdir(out, { recursive: true });
await mkdir(resolve(root, "output/source-audio"), { recursive: true });
async function download(address, limit = 15000000) {
  const res = await fetch(address, { signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw Error(res.status + " " + address);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > limit) throw Error("Oversize asset");
  return bytes;
}
// gh keeps authentication private; no token is read, printed or written by this script.
const tree = JSON.parse(
  execFileSync(
    "gh",
    [
      "api",
      "repos/sgossner/VSCO-2-CE/git/trees/" + sourceCommit + "?recursive=1",
    ],
    { encoding: "utf8", maxBuffer: 6000000 },
  ),
);
if (tree.truncated) throw Error("Incomplete source tree");
const waves = tree.tree.filter((f) => /\.wav$/i.test(f.path));
function parse(raw) {
  const prefix =
    raw
      .match(/default_path=([^\r\n]+)/)?.[1]
      .trim()
      .replaceAll("\\", "/") || "";
  const regions = raw
    .split("<region>")
    .slice(1)
    .map((s) => {
      const v = Object.fromEntries(
        [...s.split("<")[0].matchAll(/(\w+)=([^\r\n]+)/g)].map((m) => [
          m[1],
          m[2].trim(),
        ]),
      );
      return {
        path: prefix + v.sample,
        base: v.sample,
        root: Number(v.pitch_keycenter ?? v.key),
        lo: Number(v.lovel ?? 0),
        hi: Number(v.hivel ?? 127),
      };
    })
    .filter((r) => Number.isFinite(r.root) && r.lo <= 90 && r.hi >= 90);
  return [...new Map(regions.map((r) => [r.root, r])).values()].sort(
    (a, b) => a.root - b.root,
  );
}
function processWav(bytes, sustain) {
  if (
    bytes.toString("ascii", 0, 4) !== "RIFF" ||
    bytes.toString("ascii", 8, 12) !== "WAVE"
  )
    throw Error("Not WAV");
  let fmt, data;
  for (let i = 12; i + 8 <= bytes.length;) {
    const size = bytes.readUInt32LE(i + 4),
      name = bytes.toString("ascii", i, i + 4);
    if (i + 8 + size > bytes.length) throw Error("Truncated WAV");
    if (name === "fmt ") fmt = bytes.subarray(i + 8, i + 8 + size);
    if (name === "data") data = bytes.subarray(i + 8, i + 8 + size);
    i += 8 + size + (size % 2);
  }
  if (!fmt || !data) throw Error("Missing WAV chunks");
  const format = fmt.readUInt16LE(0),
    channels = fmt.readUInt16LE(2),
    rate = fmt.readUInt32LE(4),
    bits = fmt.readUInt16LE(14);
  if (
    format !== 1 ||
    ![16, 24].includes(bits) ||
    ![1, 2].includes(channels) ||
    ![44100, 48000].includes(rate)
  )
    throw Error(`Unexpected PCM ${format}/${channels}/${rate}/${bits}`);
  const frame = (bits / 8) * channels,
    len = Math.floor(data.length / frame),
    mono = new Float32Array(len);
  for (let i = 0; i < len; i++)
    for (let c = 0; c < channels; c++)
      mono[i] +=
        data.readIntLE(i * frame + (c * bits) / 8, bits / 8) /
        (2 ** (bits - 1) * channels);
  let start = 0;
  while (start < len && Math.abs(mono[start]) < 0.001) start++;
  start = Math.max(0, start - Math.round(rate * 0.008));
  let finish = len;
  while (finish > start && Math.abs(mono[finish - 1]) < 0.0003) finish--;
  finish = Math.min(
    len,
    finish + Math.round(rate * 0.06),
    start + Math.round(rate * (sustain ? 5 : 9)),
  );
  const audio = mono.slice(start, finish);
  if (audio.length < rate * 0.08) throw Error("Silent/short sample");
  let peak = 0;
  for (const x of audio) peak = Math.max(peak, Math.abs(x));
  if (peak < 0.002) throw Error("Silent sample");
  for (let i = 0; i < audio.length; i++) audio[i] *= 0.8 / peak;
  let loop = null;
  if (sustain && audio.length > rate * 1.8) {
    const begin = Math.round(rate * 0.55),
      end = audio.length - Math.round(rate * 0.3),
      fade = Math.round(rate * 0.18);
    for (let i = 0; i < fade; i++) {
      const f = i / (fade - 1);
      audio[end - fade + i] =
        audio[end - fade + i] * (1 - f) + audio[begin + i] * f;
    }
    loop = [(begin + fade) / rate, end / rate];
  }
  const fade = Math.min(Math.round(rate * 0.02), Math.floor(audio.length / 4));
  for (let i = 0; i < fade; i++) {
    audio[i] *= i / fade;
    audio[audio.length - 1 - i] *= i / fade;
  }
  const b = Buffer.alloc(44 + audio.length * 2);
  b.write("RIFF");
  b.writeUInt32LE(b.length - 8, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(audio.length * 2, 40);
  for (let i = 0; i < audio.length; i++)
    b.writeInt16LE(
      Math.round(Math.max(-1, Math.min(1, audio[i])) * 32767),
      44 + i * 2,
    );
  return { bytes: b, loop, rate, frames: audio.length };
}
const manifest = {
  license: "CC0-1.0",
  sourceCommit,
  mappingCommit,
  processing:
    "Mono PCM16, original sample rate; peak -1.94dBFS, trimmed <=5s sustain / 9s one-shot; 180ms crossfade sustain loops; one dynamic layer, no round robin.",
  banks: {},
};
for (const [id, sfz] of Object.entries(banks)) {
  const sfzBytes = await download(url(mappingCommit, sfz));
  await writeFile(resolve(root, "output/source-audio", sfz), sfzBytes);
  let regions = parse(sfzBytes.toString());
  if (id === "orchestral-kit")
    regions = regions.filter((r) => Object.hasOwn(KIT_NOTES, r.root));
  else if (regions.length > 8) {
    const chosen = [];
    for (let i = 0; i < 8; i++)
      chosen.push(regions[Math.round((i * (regions.length - 1)) / 7)]);
    regions = [...new Set(chosen)];
  }
  if (!regions.length) throw Error("Empty mapping " + id);
  const list = [];
  for (const r of regions) {
    const matches = waves.filter(
      (f) => f.path.toLowerCase() === r.path.toLowerCase(),
    );
    const src =
      matches[0] ??
      waves.find((f) =>
        f.path.toLowerCase().endsWith("/" + r.base.toLowerCase()),
      );
    if (!src) throw Error("Missing " + r.path);
    const cache = resolve(
      root,
      "output/source-audio",
      hash(Buffer.from(src.path)) + ".wav",
    );
    let raw;
    try {
      raw = await readFile(cache);
    } catch {
      raw = await download(url(sourceCommit, src.path));
      await writeFile(cache, raw);
    }
    const result = processWav(raw, CATALOG[id].sustain),
      file = id + "-" + r.root + ".wav";
    await writeFile(resolve(out, file), result.bytes);
    list.push({
      root: r.root,
      file,
      loop: result.loop,
      bytes: result.bytes.length,
      frames: result.frames,
      rate: result.rate,
      sha256: hash(result.bytes),
      source: src.path,
      sourceSha256: hash(raw),
    });
  }
  manifest.banks[id] = {
    mapping: sfz,
    mappingSha256: hash(sfzBytes),
    samples: list,
  };
  console.log(id + ": " + list.length + " samples");
}
await writeFile(
  resolve(out, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\r\n",
  "utf8",
);
await writeFile(
  resolve(out, "CC0.txt"),
  await download(url(sourceCommit, "LICENSE")),
);
await writeFile(
  resolve(out, "Readme-upstream.txt"),
  await download(url(sourceCommit, "Readme.txt")),
);
const samples = Object.values(manifest.banks).flatMap((b) => b.samples);
console.log(
  JSON.stringify({
    banks: Object.keys(manifest.banks).length,
    samples: samples.length,
    bytes: samples.reduce((n, s) => n + s.bytes, 0),
  }),
);
