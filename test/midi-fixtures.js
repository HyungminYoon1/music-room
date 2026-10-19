// Independent SMF fixtures: not encoded by the application's exporter.
export const vl = (n) => {
  const out = [n & 127];
  while ((n = Math.floor(n / 128))) out.unshift((n & 127) | 128);
  return out;
};
const be = (n, len) =>
  Array.from({ length: len }, (_, i) => (n >>> ((len - i - 1) * 8)) & 255);
const text = (s) => [...new TextEncoder().encode(s)];
export const meta = (type, bytes) => [255, type, ...vl(bytes.length), ...bytes];
export const name = (s) => meta(3, text(s));
export const tempo = (us) => meta(81, be(us, 3));
export const meter = (n, d) => meta(88, [n, Math.log2(d), 24, 8]);
export function smf(tracks, { format = 1, ppq = 480 } = {}) {
  const chunks = tracks.flatMap((events) => {
    let tick = 0;
    const bytes = [];
    for (const [at, data] of events) {
      bytes.push(...vl(at - tick), ...data);
      tick = at;
    }
    bytes.push(0, 255, 47, 0);
    return [...text("MTrk"), ...be(bytes.length, 4), ...bytes];
  });
  return new Uint8Array([
    ...text("MThd"),
    ...be(6, 4),
    ...be(format, 2),
    ...be(tracks.length, 2),
    ...be(ppq, 2),
    ...chunks,
  ]);
}
export function changingMidi() {
  return smf([
    [
      [0, name("변화 연습")],
      [0, tempo(500000)],
      [0, meter(4, 4)],
      [1920, tempo(666667)],
      [1920, meter(3, 4)],
      [3360, tempo(400000)],
      [3360, meter(6, 8)],
    ],
    [
      [0, name("바이올린")],
      [0, [0xc0, 40]],
      [0, [0xb0, 7, 100]],
      [0, [0x90, 60, 90]],
      [480, [0x80, 60, 0]],
      [1920, [0xc0, 73]],
      [1920, [0x90, 64, 70]],
      [3840, [0x80, 64, 0]],
    ],
    [
      [0, name("리듬")],
      [0, [0x99, 36, 100]],
      [120, [0x89, 36, 0]],
    ],
  ]);
}
