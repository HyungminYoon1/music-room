import { VF, jsPDF } from "../vendor/music.js";
import { lanes, barTicks, pitchName } from "./model.js";
import { CATALOG } from "./instruments.js";
import { barMap, tempoEvents } from "./timeline.js";
const Q = 240;
function pieces(start, end) {
  const out = [];
  while (start < end) {
    let d =
      [3840, 1920, 960, 480, 240].find(
        (v) => v <= end - start && start % v === 0,
      ) || 240;
    out.push({ start, d });
    start += d;
  }
  return out;
}
function key(p) {
  const pc = ["c", "c#", "d", "d#", "e", "f", "f#", "g", "g#", "a", "a#", "b"][
    p % 12
  ];
  return pc + "/" + (Math.floor(p / 12) - 1);
}
export function scorePages(p) {
  const pages = [],
    measures = barMap(p),
    W = 794,
    H = 1123;
  if (p.tracks.length * Math.ceil(p.bars / 8) > 128)
    throw Error(
      "화면·PDF 악보는 최대 128쪽입니다. 트랙이나 구간을 나누거나 MIDI·MusicXML로 저장하세요.",
    );
  if (measures.some((b) => b.start % Q || b.end % Q))
    throw Error(
      "16분음표 격자 중간에 박자가 바뀌는 곡입니다. 정확한 악보는 MusicXML로 저장하세요.",
    );
  for (const t of p.tracks) {
    const voices = lanes(t.notes, Q, 8),
      clef = CATALOG[t.instrument].clef;
    for (let pageBar = 0; pageBar < p.bars; pageBar += 8) {
      const host = document.createElement("div"),
        renderer = new VF.Renderer(host, VF.Renderer.Backends.SVG);
      renderer.resize(W, H);
      const ctx = renderer.getContext();
      ctx.setFont("sans-serif", 19, "");
      ctx.fillText(p.title, 42, 40);
      ctx.setFont("sans-serif", 12, "");
      ctx.fillText(
        `${t.name} · ♩ = ${p.tempo} · ${p.meter.join("/")} · 1/16 grid`,
        42,
        65,
      );
      const previous = new Map();
      for (let b = pageBar; b < Math.min(pageBar + 8, p.bars); b++) {
        const measure = measures[b];
        const row = Math.floor((b - pageBar) / 2),
          col = (b - pageBar) % 2,
          x = 42 + col * 354,
          y = 95 + row * 232,
          stave = new VF.Stave(x, y, 354);
        if (col === 0) stave.addClef(clef);
        if (
          b === 0 ||
          measures[b - 1].meter.join("/") !== measure.meter.join("/")
        )
          stave.addTimeSignature(measure.meter.join("/"));
        stave.setContext(ctx).draw();
        ctx.setFont("sans-serif", 11, "");
        ctx.fillText(String(b + 1), x + 5, y - 5);
        const tempo = tempoEvents(p).filter(
          (e) => e.tick >= measure.start && e.tick < measure.end,
        );
        if (tempo.length)
          ctx.fillText(
            tempo
              .map(
                (e) =>
                  "♩ " +
                  (60000000 / e.microseconds).toFixed(2) +
                  (e.tick > measure.start
                    ? " @" + (e.tick - measure.start)
                    : ""),
              )
              .join(" · "),
            x + 45,
            y - 5,
          );
        const rendered = [],
          ties = [],
          beams = [];
        for (const [vi, lane] of voices.entries()) {
          const events = [];
          let cursor = measure.start;
          for (const g of lane) {
            const s = Math.max(g.start, measure.start),
              e = Math.min(g.end, measure.end);
            if (s >= e) continue;
            if (s > cursor)
              for (const r of pieces(cursor, s))
                events.push({ ...r, notes: null });
            for (const r of pieces(s, e))
              events.push({ ...r, notes: g.notes, group: g });
            cursor = e;
          }
          for (const r of pieces(cursor, measure.end))
            events.push({ ...r, notes: null });
          const notes = events.map((e) => {
            const duration = {
                3840: "w",
                1920: "h",
                960: "q",
                480: "8",
                240: "16",
              }[e.d],
              rest = !e.notes,
              n = new VF.StaveNote({
                clef,
                keys: rest
                  ? [clef === "bass" ? "d/3" : "b/4"]
                  : [...e.notes]
                      .sort((a, b) => a.pitch - b.pitch)
                      .map((n) => key(n.pitch)),
                duration: duration + (rest ? "r" : ""),
              });
            if (!rest)
              [...e.notes]
                .sort((a, b) => a.pitch - b.pitch)
                .map((n) => key(n.pitch))
                .forEach((k, i) => {
                  if (k.includes("#")) n.addModifier(new VF.Accidental("#"), i);
                });
            if (!rest) {
              const groupKey = vi + ":" + e.group.start + ":" + e.group.end;
              if (e.start > e.group.start) {
                const indices = e.notes.map((_, i) => i);
                ties.push(
                  new VF.StaveTie({
                    first_note: previous.get(groupKey) || null,
                    last_note: n,
                    first_indices: indices,
                    last_indices: indices,
                  }),
                );
              }
              previous.set(groupKey, n);
              if (
                e.start + e.d ===
                  measures[Math.min(pageBar + 7, p.bars - 1)].end &&
                e.group.end > e.start + e.d
              ) {
                const indices = e.notes.map((_, i) => i);
                ties.push(
                  new VF.StaveTie({
                    first_note: n,
                    last_note: null,
                    first_indices: indices,
                    last_indices: indices,
                  }),
                );
              }
            }
            return n;
          });
          const v = new VF.Voice({
            num_beats: measure.meter[0],
            beat_value: measure.meter[1],
          })
            .setMode(VF.Voice.Mode.SOFT)
            .addTickables(notes);
          rendered.push(v);
          beams.push(...VF.Beam.generateBeams(notes));
        }
        new VF.Formatter()
          .joinVoices(rendered)
          .format(rendered, stave.getNoteEndX() - stave.getNoteStartX() - 12);
        for (const v of rendered) v.draw(ctx, stave);
        for (const beam of beams) beam.setContext(ctx).draw();
        for (const tie of ties) tie.setContext(ctx).draw();
      }
      const svg = host.querySelector("svg");
      svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      bg.setAttribute("width", W);
      bg.setAttribute("height", H);
      bg.setAttribute("fill", "white");
      svg.prepend(bg);
      pages.push(svg);
    }
  }
  return pages;
}
export async function pdf(pages) {
  const pdf = new jsPDF({ unit: "pt", format: "a4", compress: true });
  for (const [i, svg] of pages.entries()) {
    if (i) pdf.addPage();
    const raw = new XMLSerializer().serializeToString(svg),
      url = URL.createObjectURL(new Blob([raw], { type: "image/svg+xml" }));
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = 2480;
      canvas.height = 3508;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 595.28, 841.89);
      canvas.width = 1;
      canvas.height = 1;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  return pdf.output("arraybuffer");
}
