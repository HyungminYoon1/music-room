import {
  PPQ,
  KEY,
  INSTRUMENTS,
  uid,
  clone,
  validate,
  parseProject,
  emptyProject,
  demoProject,
  barTicks,
  totalTicks,
  pitchName,
  History,
  encodeMidi,
  musicXML,
  moveNotes,
  exerciseProject,
} from "./model.js";
import * as audio from "./audio.js";
import { scorePages, pdf } from "./notation.js";
import {
  CATALOG,
  isPercussion,
  KIT_NOTES,
  setTrackInstrument,
} from "./instruments.js";
import {
  barMap,
  barStart,
  tempoEvents,
  meterEvents,
  setInitialTempo,
  setInitialMeter,
  tickSeconds,
} from "./timeline.js";
import {
  parseMidi,
  midiToProject,
  reviewMidiSelection,
  MIDI_MAX_BYTES,
} from "./midi-import.js";
import {
  chordNotes,
  quantizeNotes,
  intersectingNotes,
  transportPosition,
} from "./editing.js";
import { TEMPLATES, templateProject } from "./templates.js";
const $ = (id) => document.getElementById(id),
  status = (s) => ($("status").textContent = s),
  history = new History();
let p = templateProject(),
  trackId = p.tracks[0].id,
  selection = new Set(),
  playTick = 0,
  clipboard = [],
  blocked = false,
  dirty = false,
  exporting = false,
  px = 72,
  snap = 240,
  drag = null,
  pages = [];
const ROW = 22;
let editTool = "draw",
  blankDrag = null,
  velocityGesture = null,
  addingInstrument = false,
  instrumentFamily = "전체",
  auditionGeneration = 0;
let importGeneration = 0,
  pendingMidi = null;
// A late file read must not discard even an input that has not blurred yet.
document.addEventListener("input", (e) => {
  if (!e.target.closest("#midi-dialog")) importGeneration++;
});
try {
  const raw = localStorage.getItem(KEY);
  if (raw) p = parseProject(raw);
} catch {
  blocked = true;
  status(
    "기존 저장 내용을 읽지 못했습니다. 파일을 열거나 새 곡을 만들기 전까지 보존합니다.",
  );
}
trackId = p.tracks[0].id;
const track = () => p.tracks.find((t) => t.id === trackId) || p.tracks[0],
  selected = () => track().notes.filter((n) => selection.has(n.id));
const rowPitches = () =>
  track().instrument === "orchestral-kit"
    ? Object.keys(KIT_NOTES)
        .map(Number)
        .sort((a, b) => b - a)
    : Array.from({ length: 88 }, (_, i) => 108 - i);
const rowOf = (pitch) => rowPitches().indexOf(pitch);
const pitchAt = (y) =>
  rowPitches()[
    Math.max(0, Math.min(rowPitches().length - 1, Math.floor(y / ROW)))
  ];
const noteLabel = (pitch) =>
  track().instrument === "orchestral-kit" ? KIT_NOTES[pitch] : pitchName(pitch);
const colors = [
  "#9ce5bd",
  "#b4cfa7",
  "#cbb5e5",
  "#e2bb8f",
  "#9bc8db",
  "#dfb3ad",
  "#d7d496",
  "#96cdbb",
];
function save() {
  dirty = true;
  if (blocked) {
    $("save-state").textContent = "기존 저장 보존 중";
    return;
  }
  try {
    const raw = JSON.stringify(validate(p));
    if (new TextEncoder().encode(raw).byteLength > 1900000) throw Error();
    localStorage.setItem(KEY, raw);
    if (localStorage.getItem(KEY) !== raw) throw Error();
    $("save-state").textContent = "자동 저장됨";
    dirty = false;
  } catch {
    $("save-state").textContent = "파일 저장 필요";
    status("브라우저 저장 공간이 부족합니다. 프로젝트 파일로 저장하세요.");
  }
}
function change(fn) {
  importGeneration++;
  audio.stop();
  const before = clone(p);
  const beforeSelection = new Set(selection),
    beforeTrack = trackId;
  try {
    fn();
    validate(p);
    if (JSON.stringify(p) !== JSON.stringify(before)) history.push(before);
    pages = [];
    save();
    render();
    return true;
  } catch (e) {
    p = before;
    selection = beforeSelection;
    trackId = beforeTrack;
    render();
    status(e.message);
    return false;
  }
}
function field(id, fn) {
  $(id).addEventListener("change", () => change(() => fn($(id).value)));
}
function make(tag, text, cls) {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (cls) e.className = cls;
  return e;
}
function render() {
  if (!p.tracks.some((t) => t.id === trackId)) trackId = p.tracks[0].id;
  selection = new Set(
    [...selection].filter((id) => track().notes.some((n) => n.id === id)),
  );
  $("title").value = p.title;
  $("tempo").value = Number(p.tempo.toFixed(6));
  $("tempo").min = p.version === 2 ? 4 : 40;
  $("tempo").max = p.version === 2 ? 1000 : 240;
  $("tempo").step = p.version === 2 ? "any" : "1";
  $("tempo").title =
    p.version === 2
      ? "곡 시작 BPM. 이후의 템포 변화는 유지됩니다."
      : "곡 전체 BPM";
  $("meter").replaceChildren(
    ...(p.version === 2
      ? Array.from({ length: 32 }, (_, i) =>
          [1, 2, 4, 8, 16, 32].map((d) => [i + 1, d].join("/")),
        ).flat()
      : ["4/4", "3/4", "6/8"]
    ).map((s) => {
      const o = make("option", s);
      o.value = s;
      return o;
    }),
  );
  $("meter").value = p.meter.join("/");
  $("meter").title =
    p.version === 2
      ? "곡 시작 박자. 이후의 박자 변화와 음표 위치는 유지됩니다."
      : "곡 전체 박자";
  $("bars").max = p.version === 2 ? 512 : 64;
  $("bars").value = p.bars;
  $("timing-map").textContent =
    "시간 지도" +
    (p.version === 2
      ? " · " + (p.tempoMap.length + p.meterMap.length - 2) + "회 변화"
      : "");
  for (const id of ["loop-start", "loop-end"]) {
    $(id).max = p.bars;
    $(id).value = Math.min(p.bars, Math.max(1, Number($(id).value) || 1));
  }
  const t = track();
  $("track-name").value = t.name;
  $("instrument").value = t.instrument;
  $("volume").value = t.volume;
  $("pan").value = t.pan;
  $("volume-read").value = Math.round(t.volume * 100) + "%";
  $("pan-read").value =
    t.pan === 0
      ? "중앙"
      : (t.pan < 0 ? "L " : "R ") + Math.round(Math.abs(t.pan) * 100);
  $("undo").disabled = !history.back.length;
  $("redo").disabled = !history.forward.length;
  $("add-track").disabled = p.tracks.length >= 16;
  $("track-count").textContent = p.tracks.length + " / 16";
  $("active-track").textContent = t.name;
  const info = CATALOG[t.instrument];
  $("instrument-info").textContent =
    (info.sampled ? "실제 녹음" : "합성음") +
    " · " +
    info.family +
    (info.percussion
      ? " · 타악기 키트"
      : " · 권장 음역 " +
        pitchName(info.range[0]) +
        "–" +
        pitchName(info.range[1]));
  if (p.version === 2 && t.midi?.programs?.length)
    $("instrument-info").textContent +=
      " · 원본 GM " +
      (t.midi.programs[0].program + 1) +
      (t.midi.programs.length > 1
        ? " · 곡 중간 악기 변경 " + (t.midi.programs.length - 1) + "회"
        : "");
  if (
    p.version === 2 &&
    t.midi &&
    (t.midi.bends.length ||
      t.midi.controllers.some(
        (e) => e.tick > 0 || ![7, 10].includes(e.controller),
      ))
  )
    $("instrument-info").textContent +=
      " · 페달·컨트롤·벤드: MIDI 저장에만 반영";
  $("add-chord").disabled = isPercussion(t.instrument);
  $("remove-track").disabled = p.tracks.length === 1;
  $("track-list").replaceChildren();
  p.tracks.forEach((t, i) => {
    const c = make(
      "div",
      undefined,
      "track-card" + (t.id === trackId ? " active" : ""),
    );
    c.tabIndex = 0;
    c.setAttribute("role", "button");
    c.setAttribute("aria-label", t.name + " 트랙 선택");
    c.setAttribute("aria-pressed", String(t.id === trackId));
    c.style.setProperty("--track-color", colors[i % colors.length]);
    c.append(
      make("strong", t.name),
      make("small", INSTRUMENTS[t.instrument] + " · " + t.notes.length + "음"),
    );
    const dot = make("i", undefined, "track-color");
    dot.style.background = colors[i % colors.length];
    c.append(dot);
    const s = make("div", undefined, "switches");
    for (const [k, label] of [
      ["mute", "M"],
      ["solo", "S"],
    ]) {
      const b = make("button", label);
      b.setAttribute("aria-pressed", t[k]);
      b.setAttribute(
        "aria-label",
        t.name + " " + (k === "mute" ? "MUTE" : "SOLO"),
      );
      b.title = k === "mute" ? "이 트랙 끄기" : "이 트랙만 듣기";
      b.onclick = (e) => {
        e.stopPropagation();
        change(() => (t[k] = !t[k]));
      };
      s.append(b);
    }
    c.append(s);
    c.onclick = () => {
      trackId = t.id;
      selection.clear();
      render();
      fitNotes();
    };
    c.onkeydown = (e) => {
      if (e.target === c && ["Enter", " "].includes(e.key)) {
        e.preventDefault();
        c.click();
      }
    };
    $("track-list").append(c);
  });
  renderRoll();
  renderArrangement();
  inspect();
  if (!$("score-view").hidden) showScore();
}
function renderRoll() {
  const focused = document.activeElement;
  const focusId = focused?.classList.contains("note")
    ? focused.dataset.id
    : null;
  const keepFocus = focused === $("grid") || !!focusId;
  const width = (totalTicks(p) / PPQ) * px;
  $("grid").style.width = width + "px";
  $("grid").style.height = rowPitches().length * ROW + "px";
  $("grid").dataset.tool = editTool;
  $("grid").style.setProperty(
    "--note-color",
    colors[p.tracks.indexOf(track()) % colors.length],
  );
  $("keys").replaceChildren();
  for (const i of rowPitches()) {
    const e = make(
      "button",
      track().instrument === "orchestral-kit"
        ? KIT_NOTES[i]
        : i % 12 === 0
          ? pitchName(i)
          : "",
      "key" +
        ([1, 3, 6, 8, 10].includes(i % 12) ? " black" : "") +
        (i % 12 === 0 ? " c" : "") +
        (track().instrument === "orchestral-kit" ? " drum" : ""),
    );
    e.setAttribute("aria-label", noteLabel(i) + " 들어보기");
    e.onclick = () => audio.preview(track(), i).catch((e) => status(e.message));
    $("keys").append(e);
  }
  $("ruler").style.width = width + "px";
  $("ruler").replaceChildren();
  for (const [b, measure] of barMap(p).entries()) {
    const el = make(
      "span",
      b +
        1 +
        (p.version === 2
          ? " · " + measure.meter.join("/") + (measure.partial ? " *" : "")
          : ""),
      "bar-label",
    );
    el.style.left = (measure.start / PPQ) * px + "px";
    el.style.width = ((measure.end - measure.start) / PPQ) * px + "px";
    if (
      $("loop").checked &&
      b >= Number($("loop-start").value) - 1 &&
      b < Number($("loop-end").value)
    )
      el.classList.add("in-loop");
    el.onclick = (e) => {
      audio.stop();
      const rect = $("ruler").getBoundingClientRect();
      playTick = Math.max(
        0,
        Math.min(
          totalTicks(p) - 1,
          quant(((e.clientX - rect.left) / px) * PPQ),
        ),
      );
      tick();
    };
    $("ruler").append(el);
  }
  $("grid").style.backgroundSize =
    `${(barTicks(p) / PPQ) * px}px ${ROW}px,${Math.max(3, (px * snap) / PPQ)}px ${ROW}px,100% ${ROW}px`;
  for (const e of $("grid").querySelectorAll(
    ".note,.pitch-shade,.measure-line",
  ))
    e.remove();
  if (p.version === 2) {
    $("grid").style.backgroundSize =
      `0px ${ROW}px,${Math.max(3, (px * snap) / PPQ)}px ${ROW}px,100% ${ROW}px`;
    for (const b of barMap(p)) {
      const line = make("i", undefined, "measure-line");
      line.style.left = (b.start / PPQ) * px + "px";
      $("grid").append(line);
    }
  }
  if (!isPercussion(track().instrument))
    for (const [row, pitch] of rowPitches().entries()) {
      const outside =
        pitch < CATALOG[track().instrument].range[0] ||
        pitch > CATALOG[track().instrument].range[1];
      if (outside || [1, 3, 6, 8, 10].includes(pitch % 12)) {
        const shade = make(
          "i",
          undefined,
          "pitch-shade" + (outside ? " outside" : ""),
        );
        shade.style.top = row * ROW + "px";
        $("grid").append(shade);
      }
    }
  for (const n of track().notes) {
    const e = make(
      "div",
      noteLabel(n.pitch),
      "note" + (selection.has(n.id) ? " selected" : ""),
    );
    e.dataset.id = n.id;
    e.setAttribute("role", "button");
    e.setAttribute(
      "aria-label",
      `${pitchName(n.pitch)}, 시작 ${n.start}틱, 길이 ${n.duration}틱, 세기 ${n.velocity}`,
    );
    e.tabIndex = 0;
    e.style.left = (n.start / PPQ) * px + "px";
    e.style.top = rowOf(n.pitch) * ROW + 1 + "px";
    e.style.width = (n.duration / PPQ) * px + "px";
    e.style.opacity = 0.4 + (n.velocity / 127) * 0.6;
    e.onpointerdown = beginDrag;
    e.onkeydown = keyEdit;
    $("grid").append(e);
  }
  tick();
  renderVelocity();
  if (keepFocus) {
    const target = [...$("grid").querySelectorAll(".note")].find(
      (e) => e.dataset.id === focusId,
    );
    (target || $("grid")).focus({ preventScroll: true });
  }
}
function inspect() {
  const ns = selected();
  $("selection").textContent =
    ns.length === 1
      ? pitchName(ns[0].pitch)
      : ns.length
        ? `${ns.length}음 선택`
        : "음 선택";
  for (const [id, key] of [
    ["note-pitch", "pitch"],
    ["note-start", "start"],
    ["note-duration", "duration"],
    ["note-velocity", "velocity"],
  ]) {
    $(id).disabled = key === "velocity" ? !ns.length : ns.length !== 1;
    $(id).value =
      ns.length === 1 ||
      (key === "velocity" &&
        ns.length &&
        ns.every((n) => n.velocity === ns[0].velocity))
        ? ns[0][key]
        : "";
  }
  $("delete").disabled =
    $("copy").disabled =
    $("duplicate").disabled =
      !ns.length;
  $("paste").disabled = !clipboard.length;
  $("length-preset").disabled = $("quantize").disabled = !ns.length;
}
for (const [id, key] of [
  ["note-pitch", "pitch"],
  ["note-start", "start"],
  ["note-duration", "duration"],
  ["note-velocity", "velocity"],
])
  field(id, (v) => {
    if (key === "velocity") for (const n of selected()) n.velocity = Number(v);
    else if (selected().length === 1) selected()[0][key] = Number(v);
  });
function quant(t) {
  return Math.round(t / snap) * snap;
}
function beginDrag(e) {
  if (e.button !== 0) return;
  importGeneration++;
  e.preventDefault();
  e.stopPropagation();
  $("grid").focus({ preventScroll: true });
  audio.stop();
  const id = e.currentTarget.dataset.id,
    n = track().notes.find((n) => n.id === id);
  if (editTool === "erase") {
    selection = new Set([id]);
    remove();
    return;
  }
  if (e.ctrlKey || e.shiftKey) {
    if (selection.has(id)) selection.delete(id);
    else selection.add(id);
    renderRoll();
    inspect();
    return;
  }
  if (!selection.has(id)) selection = new Set([id]);
  const rect = e.currentTarget.getBoundingClientRect();
  drag = {
    id,
    resize: e.clientX > rect.right - 8,
    x: e.clientX,
    y: e.clientY,
    before: clone(p),
    notes: clone(selected()),
    moved: false,
  };
  e.currentTarget.setPointerCapture(e.pointerId);
  e.currentTarget.onpointermove = moveDrag;
  e.currentTarget.onpointerup = endDrag;
  e.currentTarget.onpointercancel = () => endDrag(true);
  e.currentTarget.onlostpointercapture = () => {
    if (drag) endDrag(true);
  };
  inspect();
}
function moveDrag(e) {
  if (!drag) return;
  const dt = quant(((e.clientX - drag.x) / px) * PPQ),
    dp =
      track().instrument === "orchestral-kit"
        ? 0
        : -Math.round((e.clientY - drag.y) / ROW);
  if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 3)
    drag.moved = true;
  const moved = moveNotes(drag.notes, dt, dp, totalTicks(p));
  for (const original of drag.notes) {
    const n = track().notes.find((n) => n.id === original.id);
    if (drag.resize)
      n.duration = Math.max(
        1,
        Math.min(totalTicks(p) - n.start, original.duration + dt),
      );
    else {
      const result = moved.find((n) => n.id === original.id);
      n.start = result.start;
      n.pitch = result.pitch;
    }
    const el = [...$("grid").querySelectorAll(".note")].find(
      (el) => el.dataset.id === n.id,
    );
    el.style.left = (n.start / PPQ) * px + "px";
    el.style.top = rowOf(n.pitch) * ROW + 1 + "px";
    el.style.width = (n.duration / PPQ) * px + "px";
    el.textContent = noteLabel(n.pitch);
  }
  inspect();
}
function endDrag(cancel = false) {
  if (!drag) return;
  const d = drag;
  drag = null;
  if (cancel === true) {
    p = d.before;
  } else if (d.moved) {
    validate(p);
    history.push(d.before);
    pages = [];
    save();
  } else
    audio
      .preview(track(), selected()[0]?.pitch ?? 60)
      .catch((e) => status(e.message));
  render();
}
$("grid").addEventListener("pointerdown", (e) => {
  if (e.button !== 0 || e.target !== $("grid")) return;
  if (editTool === "erase") return;
  importGeneration++;
  audio.stop();
  e.preventDefault();
  $("grid").focus({ preventScroll: true });
  const rect = $("grid").getBoundingClientRect(),
    start = Math.max(
      0,
      Math.min(totalTicks(p) - 1, quant(((e.clientX - rect.left) / px) * PPQ)),
    ),
    pitch = pitchAt(e.clientY - rect.top);
  const el = make(
    "div",
    editTool === "draw" ? noteLabel(pitch) : undefined,
    editTool === "draw" ? "note ghost" : "marquee",
  );
  blankDrag = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
    start,
    pitch,
    el,
    selection: new Set(selection),
    mode: editTool,
    moved: false,
    duration: Math.min(totalTicks(p) - start, Number($("draw-duration").value)),
    additive: e.ctrlKey || e.shiftKey,
  };
  $("grid").append(el);
  $("grid").setPointerCapture(e.pointerId);
  moveBlank(e);
});
function keyEdit(e) {
  if (e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
  if (
    ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key) &&
    selected().length
  ) {
    e.preventDefault();
    change(() => {
      const step = e.shiftKey ? 1 : snap;
      const dt =
        e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
      const dp =
        track().instrument === "orchestral-kit"
          ? 0
          : e.key === "ArrowUp"
            ? 1
            : e.key === "ArrowDown"
              ? -1
              : 0;
      for (const result of moveNotes(selected(), dt, dp, totalTicks(p)))
        Object.assign(
          track().notes.find((n) => n.id === result.id),
          result,
        );
    });
  }
  if (e.key === "Delete" || e.key === "Backspace") {
    e.preventDefault();
    remove();
  }
}
$("grid").addEventListener("keydown", (e) => {
  if (e.target === $("grid")) keyEdit(e);
});
function remove() {
  if (selected().length)
    change(() => {
      track().notes = track().notes.filter((n) => !selection.has(n.id));
      selection.clear();
    });
}
function copy() {
  const ns = clone(selected());
  if (!ns.length) return;
  const first = Math.min(...ns.map((n) => n.start));
  clipboard = ns.map((n) => ({ ...n, start: n.start - first }));
  inspect();
  status(`${ns.length}음을 복사했습니다.`);
}
function paste() {
  if (!clipboard.length) return;
  change(() => {
    if (
      clipboard.some(
        (n) => quant(playTick) + n.start + n.duration > totalTicks(p),
      )
    )
      throw Error(
        "붙여넣을 구절이 곡 끝을 넘습니다. 상단의 마디 수를 늘리거나 재생 커서를 앞쪽으로 옮기세요.",
      );
    selection.clear();
    for (const n of clipboard) {
      const note = { ...n, id: uid(), start: quant(playTick) + n.start };
      track().notes.push(note);
      selection.add(note.id);
    }
  });
}
$("copy").onclick = copy;
$("paste").onclick = paste;
$("delete").onclick = remove;
$("duplicate").onclick = () => {
  const ns = selected();
  if (!ns.length) return;
  const end = Math.max(...ns.map((n) => n.start + n.duration));
  copy();
  playTick = end;
  paste();
};
$("undo").onclick = () => {
  importGeneration++;
  audio.stop();
  p = history.undo(p);
  pages = [];
  save();
  render();
};
$("redo").onclick = () => {
  importGeneration++;
  audio.stop();
  p = history.redo(p);
  pages = [];
  save();
  render();
};
field("title", (v) => (p.title = v));
field("tempo", (v) => setInitialTempo(p, Number(v)));
field("meter", (v) => setInitialMeter(p, v.split("/").map(Number)));
field("bars", (v) => (p.bars = Number(v)));
field("track-name", (v) => (track().name = v));
field("instrument", (v) => setTrackInstrument(track(), v));
field("volume", (v) => (track().volume = Number(v)));
field("pan", (v) => (track().pan = Number(v)));
$("add-track").onclick = () => openInstruments(true);
$("remove-track").onclick = () => {
  if (p.tracks.length > 1 && confirm("선택한 트랙과 음을 삭제할까요?"))
    change(() => (p.tracks = p.tracks.filter((t) => t.id !== trackId)));
};
$("snap").onchange = () => {
  snap = Number($("snap").value);
  renderRoll();
};
$("zoom").oninput = () => {
  px = Number($("zoom").value);
  renderRoll();
};
$("play").onclick = async () => {
  if (audio.audioState().playing) {
    playTick = audio.audioState().tick;
    audio.stop();
    $("play").textContent = "▶ 재생";
    return;
  }
  status("음원 준비 중…");
  try {
    await audio.play(
      clone(p),
      playTick >= totalTicks(p) ? 0 : playTick,
      $("loop").checked,
      () => {
        $("play").textContent = "▶ 재생";
      },
      {
        loopStart: barStart(p, Number($("loop-start").value) - 1),
        loopEnd: barStart(p, Number($("loop-end").value)),
        metronome: $("metronome").checked,
        onProgress: (done, total) => status(`음원 준비 ${done} / ${total}`),
      },
    );
    if (audio.audioState().playing)
      status("재생 중 · 편집하면 재생이 멈춥니다.");
  } catch (e) {
    status(e.message);
  }
};
$("stop").onclick = () => {
  audio.stop();
  playTick = 0;
  tick();
  status("정지");
};
function tick() {
  const s = audio.audioState();
  if (s.playing) playTick = s.tick;
  $("playhead").style.left = (playTick / PPQ) * px + "px";
  $("clock").value = transportPosition(p, playTick);
  $("play").textContent = s.playing ? "Ⅱ 일시 정지" : "▶ 재생";
  $("level").style.width = audio.meter() * 100 + "%";
}
setInterval(tick, 60);
function showScore() {
  try {
    pages = scorePages(p);
    $("score-pages").replaceChildren(
      ...pages.map((svg) => svg.cloneNode(true)),
    );
  } catch (e) {
    $("score-pages").replaceChildren(make("p", e.message));
    status(e.message);
    pages = [];
  }
}
$("roll-tab").onclick = () => {
  audio.stop();
  $("roll-view").hidden = false;
  $("score-view").hidden = true;
  $("roll-tab").setAttribute("aria-pressed", "true");
  $("score-tab").setAttribute("aria-pressed", "false");
};
$("score-tab").onclick = () => {
  audio.stop();
  $("roll-view").hidden = true;
  $("score-view").hidden = false;
  $("roll-tab").setAttribute("aria-pressed", "false");
  $("score-tab").setAttribute("aria-pressed", "true");
  showScore();
};
function download(data, type, name) {
  const u = URL.createObjectURL(new Blob([data], { type })),
    a = make("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 30000);
}
$("save").onclick = () => {
  download(
    JSON.stringify(validate(p), null, 2),
    "application/json",
    "score-project.json",
  );
  status("프로젝트 파일 저장을 요청했습니다.");
};
function replace(q) {
  importGeneration++;
  audio.stop();
  p = validate(q);
  trackId = p.tracks[0].id;
  selection.clear();
  history.back = [];
  history.forward = [];
  blocked = false;
  playTick = 0;
  pages = [];
  $("loop-start").value = 1;
  $("loop-end").value = p.bars;
  save();
  render();
  fitNotes();
  if (!$("score-view").hidden) showScore();
}
$("new").onclick = () => {
  if (confirm("새 곡을 시작할까요? 현재 곡은 파일로 저장해 두세요."))
    replace(emptyProject());
};
$("open-exercise").onclick = () => {
  if (
    confirm(
      "두 마디 연습 곡을 열까요? 현재 곡은 프로젝트 파일로 저장해 두세요.",
    )
  )
    replace(exerciseProject());
};
$("open").onchange = async () => {
  const token = ++importGeneration;
  const f = $("open").files[0];
  $("open").value = "";
  if (!f) return;
  try {
    if (f.size > 2000000) throw Error("2MB 이하의 프로젝트 파일을 선택하세요.");
    const raw = await f.text();
    if (token !== importGeneration) return;
    const q = parseProject(raw);
    if (confirm("현재 곡을 불러온 파일로 바꿀까요?")) replace(q);
  } catch (e) {
    if (token === importGeneration) status(e.message);
  }
};
$("midi-open").onchange = async () => {
  const token = ++importGeneration,
    file = $("midi-open").files[0];
  $("midi-open").value = "";
  if (!file) return;
  if ($("midi-dialog").open) $("midi-dialog").close();
  try {
    if (file.size > MIDI_MAX_BYTES)
      throw Error("MIDI 파일은 2MB 이내여야 합니다.");
    const bytes = await file.arrayBuffer();
    if (token !== importGeneration) return;
    const data = parseMidi(bytes),
      all = data.tracks.map((t) => t.id);
    pendingMidi = {
      data,
      token,
      filename: file.name,
      ids: new Set(reviewMidiSelection(data, all).ok ? all : []),
    };
    renderMidiImport();
    $("midi-dialog").showModal();
  } catch (e) {
    if (token === importGeneration) status(e.message);
  }
};
function renderMidiImport() {
  if (!pendingMidi) return;
  const { data, ids, filename } = pendingMidi;
  $("midi-summary").textContent =
    filename +
    " · MIDI " +
    data.format +
    " · " +
    data.ppq +
    " PPQ · " +
    data.tracks.length +
    "개 파트";
  $("midi-tracks").replaceChildren();
  for (const t of data.tracks) {
    const label = make("label", undefined, "midi-track"),
      check = make("input");
    check.type = "checkbox";
    check.checked = ids.has(t.id);
    check.dataset.track = t.id;
    check.onchange = () => {
      if (check.checked) ids.add(t.id);
      else ids.delete(t.id);
      updateMidiReview();
    };
    const text = make("span");
    text.append(
      make("strong", t.name),
      make(
        "small",
        (t.channel === 9 ? "타악기" : "GM " + (t.programs[0].program + 1)) +
          " → " +
          CATALOG[t.instrument].name +
          " · " +
          t.notes.length.toLocaleString() +
          "음 · 채널 " +
          (t.channel + 1),
      ),
    );
    label.append(check, text);
    $("midi-tracks").append(label);
  }
  updateMidiReview();
}
function updateMidiReview() {
  if (!pendingMidi) return;
  const review = reviewMidiSelection(pendingMidi.data, [...pendingMidi.ids]);
  $("midi-selection").textContent =
    `선율 ${review.melodic}/15 · 타악기 ${review.percussion}/1 · ${review.notes.toLocaleString()}/4,096음` +
    (review.bars ? " · " + review.bars + "마디" : "");
  $("midi-errors").textContent = review.errors.join(" ");
  $("midi-warnings").replaceChildren(
    ...review.warnings.map((s) => make("li", s)),
  );
  $("midi-confirm").disabled = !review.ok;
}
$("midi-none").onclick = () => {
  pendingMidi.ids.clear();
  renderMidiImport();
};
$("midi-all").onclick = () => {
  pendingMidi.ids = new Set(pendingMidi.data.tracks.map((t) => t.id));
  renderMidiImport();
};
$("midi-confirm").onclick = () => {
  if (!pendingMidi) return;
  if (pendingMidi.token !== importGeneration) {
    $("midi-dialog").close();
    status("파일을 읽는 동안 곡이 변경되었습니다. MIDI를 다시 선택하세요.");
    return;
  }
  try {
    const q = midiToProject(pendingMidi.data, [...pendingMidi.ids]);
    if (
      !confirm(
        "선택한 MIDI 트랙으로 현재 곡을 바꿀까요? 필요한 곡은 프로젝트 파일로 먼저 저장하세요.",
      )
    )
      return;
    replace(q);
    $("midi-dialog").close();
    status(
      "MIDI를 가져왔습니다. 악기와 음표를 편집한 뒤 MIDI 또는 프로젝트로 저장하세요.",
    );
  } catch (e) {
    $("midi-errors").textContent = e.message;
  }
};
$("midi-dialog").addEventListener("close", () => {
  pendingMidi = null;
});
$("timing-map").onclick = () => {
  const events = [
    ...tempoEvents(p).map((e) => ({
      tick: e.tick,
      text:
        "BPM " + (60000000 / e.microseconds).toFixed(6).replace(/\.?0+$/, ""),
    })),
    ...meterEvents(p).map((e) => ({
      tick: e.tick,
      text: "박자 " + e.numerator + "/" + e.denominator,
    })),
  ].sort((a, b) => a.tick - b.tick);
  $("timing-events").replaceChildren(
    ...events.map((e) => {
      const row = make("div", undefined, "timing-event");
      row.append(
        make("span", transportPosition(p, e.tick)),
        make("strong", e.text),
        make(
          "small",
          e.tick + "틱 · " + tickSeconds(p, e.tick).toFixed(3) + "초",
        ),
      );
      return row;
    }),
  );
  $("timing-dialog").showModal();
};
document.querySelectorAll("[data-export]").forEach(
  (b) =>
    (b.onclick = async () => {
      if (exporting) return;
      exporting = true;
      audio.stop();
      document
        .querySelectorAll("[data-export]")
        .forEach((b) => (b.disabled = true));
      const kind = b.dataset.export;
      $("cancel-export").hidden = kind !== "wav";
      status("내보내는 중…");
      try {
        if (kind === "midi") download(encodeMidi(p), "audio/midi", "score.mid");
        if (kind === "xml")
          download(
            musicXML(p),
            "application/vnd.recordare.musicxml+xml",
            "score.musicxml",
          );
        if (kind === "wav")
          download(await audio.wav(clone(p)), "audio/wav", "score.wav");
        if (kind === "svg" || kind === "pdf") {
          const out = scorePages(p);
          if (kind === "pdf")
            download(await pdf(out), "application/pdf", "score.pdf");
          else {
            const root = document.createElementNS(
              "http://www.w3.org/2000/svg",
              "svg",
            );
            root.setAttribute("xmlns", "http://www.w3.org/2000/svg");
            root.setAttribute("width", "794");
            root.setAttribute("height", 1123 * out.length);
            out.forEach((s, i) => {
              s.setAttribute("y", 1123 * i);
              root.append(s);
            });
            download(
              new XMLSerializer().serializeToString(root),
              "image/svg+xml",
              "score.svg",
            );
          }
        }
        status("파일 저장을 요청했습니다.");
      } catch (e) {
        status(e.message);
      } finally {
        exporting = false;
        document
          .querySelectorAll("[data-export]")
          .forEach((b) => (b.disabled = false));
        $("cancel-export").hidden = true;
      }
    }),
);
$("cancel-export").onclick = () => {
  audio.cancelExport();
  status("음원 내보내기를 취소했습니다.");
};
document.addEventListener("keydown", (e) => {
  if (e.target.closest("input,textarea,select") || e.isComposing) return;
  if (e.key === "Escape" && (drag || blankDrag || velocityGesture)) {
    e.preventDefault();
    endDrag(true);
    endBlank(true);
    endVelocity(true);
    return;
  }
  const mod = e.ctrlKey || e.metaKey;
  if (e.target.closest("dialog")) return;
  if (mod && e.key.toLowerCase() === "a") {
    e.preventDefault();
    selection = new Set(track().notes.map((n) => n.id));
    renderRoll();
    inspect();
  }
  if (mod && e.key.toLowerCase() === "d") {
    e.preventDefault();
    $("duplicate").click();
  }
  if (!mod && !e.altKey && ["d", "v", "e"].includes(e.key.toLowerCase()))
    setTool({ d: "draw", v: "select", e: "erase" }[e.key.toLowerCase()]);
  if (mod && e.key.toLowerCase() === "z") {
    e.preventDefault();
    $(e.shiftKey ? "redo" : "undo").click();
  }
  if (mod && e.key.toLowerCase() === "s") {
    e.preventDefault();
    $("save").click();
  }
  if (mod && e.key.toLowerCase() === "c") {
    e.preventDefault();
    copy();
  }
  if (mod && e.key.toLowerCase() === "v") {
    e.preventDefault();
    paste();
  }
  if (e.code === "Space") {
    if (e.target.closest("button,a")) return;
    e.preventDefault();
    $("play").click();
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    audio.stop();
    if (exporting) status("화면을 떠나 음원 내보내기를 취소했습니다.");
  }
});
window.addEventListener("pagehide", audio.stop);
window.addEventListener("blur", () => {
  endDrag(true);
  endBlank(true);
  endVelocity(true);
});
window.addEventListener("beforeunload", (e) => {
  if (dirty) {
    e.preventDefault();
    e.returnValue = "";
  }
});
window.addEventListener("storage", (e) => {
  if (e.key === KEY) {
    blocked = true;
    status(
      "다른 탭에서 곡이 변경되었습니다. 현재 편집 내용은 파일로 저장하세요.",
    );
  }
});
function fitNotes() {
  const ns = track().notes,
    pitches = ns.map((n) => n.pitch),
    center = pitches.length
      ? (Math.max(...pitches) + Math.min(...pitches)) / 2
      : Math.min(72, CATALOG[track().instrument].range[1]);
  $("roll-scroll").scrollTop =
    track().instrument === "orchestral-kit"
      ? 0
      : Math.max(
          0,
          (108 - center) * ROW - $("roll-scroll").clientHeight / 2 + 40,
        );
  const first = ns.length ? Math.min(...ns.map((n) => n.start)) : 0;
  $("roll-scroll").scrollLeft = Math.max(0, (first / PPQ) * px - 40);
}
function renderArrangement() {
  $("arrangement").replaceChildren();
  $("arrangement-info").textContent =
    p.bars +
    "마디 · " +
    p.tracks.reduce((s, t) => s + t.notes.length, 0) +
    "음";
  for (const [i, t] of p.tracks.entries()) {
    const row = make(
      "button",
      undefined,
      "arrangement-row" + (t.id === trackId ? " active" : ""),
    );
    row.setAttribute("aria-label", t.name + " 편곡 선택");
    row.style.setProperty("--track-color", colors[i % colors.length]);
    const name = make("span", t.name, "arrangement-name"),
      notes = make("span", undefined, "arrangement-notes");
    notes.style.setProperty("--bar-width", 100 / p.bars + "%");
    for (const n of t.notes) {
      const mark = make("i");
      mark.style.left = (n.start / totalTicks(p)) * 100 + "%";
      mark.style.width =
        Math.max(0.2, (n.duration / totalTicks(p)) * 100) + "%";
      mark.style.top = 2 + ((108 - n.pitch) / 87) * 9 + "px";
      notes.append(mark);
    }
    row.append(name, notes);
    row.onclick = () => {
      trackId = t.id;
      selection.clear();
      render();
      fitNotes();
    };
    $("arrangement").append(row);
  }
}
function renderVelocity() {
  const focusId = document.activeElement?.classList.contains("velocity-bar")
    ? document.activeElement.dataset.id
    : null;
  $("velocity-lane").replaceChildren();
  $("velocity-lane").style.width = (totalTicks(p) / PPQ) * px + "px";
  for (const n of track().notes) {
    const el = make(
      "button",
      undefined,
      "velocity-bar" + (selection.has(n.id) ? " selected" : ""),
    );
    el.dataset.id = n.id;
    el.style.left = (n.start / PPQ) * px + "px";
    el.style.height = (n.velocity / 127) * 60 + "px";
    el.setAttribute("aria-label", noteLabel(n.pitch) + " 세기 " + n.velocity);
    el.title = noteLabel(n.pitch) + " · " + n.velocity;
    el.onpointerdown = (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      importGeneration++;
      audio.stop();
      velocityGesture = {
        id: n.id,
        before: clone(p),
        el,
        y: e.clientY,
        velocity: n.velocity,
      };
      el.setPointerCapture(e.pointerId);
      selection = new Set([n.id]);
      inspect();
    };
    el.onpointermove = (e) => {
      if (!velocityGesture || velocityGesture.el !== el) return;
      n.velocity = Math.max(
        1,
        Math.min(
          127,
          Math.round(
            velocityGesture.velocity +
              ((velocityGesture.y - e.clientY) * 127) / 60,
          ),
        ),
      );
      el.style.height = (n.velocity / 127) * 60 + "px";
      inspect();
    };
    el.onpointerup = () => endVelocity(false);
    el.onpointercancel = () => endVelocity(true);
    el.onlostpointercapture = () => endVelocity(true);
    el.onkeydown = (e) => {
      if (["ArrowUp", "ArrowDown"].includes(e.key)) {
        e.preventDefault();
        change(
          () =>
            (n.velocity = Math.max(
              1,
              Math.min(127, n.velocity + (e.key === "ArrowUp" ? 1 : -1)),
            )),
        );
      }
    };
    $("velocity-lane").append(el);
  }
  $("velocity-scroll").scrollLeft = $("roll-scroll").scrollLeft;
  if (focusId)
    [...$("velocity-lane").children]
      .find((el) => el.dataset.id === focusId)
      ?.focus({ preventScroll: true });
}
function endVelocity(cancel) {
  if (!velocityGesture) return;
  const d = velocityGesture;
  velocityGesture = null;
  if (cancel) p = d.before;
  else if (JSON.stringify(p) !== JSON.stringify(d.before)) {
    history.push(d.before);
    pages = [];
    save();
  }
  render();
}
function moveBlank(e) {
  if (!blankDrag) return;
  const d = blankDrag,
    r = $("grid").getBoundingClientRect(),
    x = Math.max(0, Math.min(r.width, e.clientX - r.left)),
    y = Math.max(0, Math.min(r.height - 1, e.clientY - r.top));
  if (Math.abs(x - d.x) + Math.abs(y - d.y) > 4) d.moved = true;
  if (d.mode === "draw") {
    if (d.moved)
      d.duration = Math.min(
        totalTicks(p) - d.start,
        Math.max(snap, quant((x / px) * PPQ) - d.start),
      );
    Object.assign(d.el.style, {
      left: (d.start / PPQ) * px + "px",
      top: rowOf(d.pitch) * ROW + 1 + "px",
      width: (d.duration / PPQ) * px + "px",
    });
  } else {
    const left = Math.min(x, d.x),
      top = Math.min(y, d.y),
      width = Math.abs(x - d.x),
      height = Math.abs(y - d.y);
    Object.assign(d.el.style, {
      left: left + "px",
      top: top + "px",
      width: width + "px",
      height: height + "px",
    });
    const a = pitchAt(top),
      b = pitchAt(top + height);
    selection = new Set([
      ...(d.additive ? d.selection : []),
      ...intersectingNotes(
        track().notes,
        (left / px) * PPQ,
        ((left + width) / px) * PPQ,
        Math.min(a, b),
        Math.max(a, b),
      ),
    ]);
    for (const el of $("grid").querySelectorAll(".note:not(.ghost)"))
      el.classList.toggle("selected", selection.has(el.dataset.id));
    inspect();
  }
}
function endBlank(cancel) {
  if (!blankDrag) return;
  const d = blankDrag;
  blankDrag = null;
  d.el.remove();
  if (cancel) {
    selection = d.selection;
    renderRoll();
    inspect();
    return;
  }
  if (d.mode === "draw") {
    const good = change(() => {
      const n = {
        id: uid(),
        pitch: d.pitch,
        start: d.start,
        duration: d.duration,
        velocity: 88,
      };
      track().notes.push(n);
      selection = new Set([n.id]);
    });
    if (good) audio.preview(track(), d.pitch).catch((e) => status(e.message));
  } else {
    renderRoll();
    inspect();
  }
}
function setTool(tool) {
  editTool = tool;
  $("grid").dataset.tool = tool;
  document
    .querySelectorAll("[data-tool]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.tool === tool)),
    );
  $("tool-hint").textContent =
    tool === "select"
      ? "빈 곳을 드래그해 여러 음 선택 · Ctrl/Shift 클릭: 선택 추가 · Ctrl+D: 복제 · Esc: 선택 취소"
      : tool === "erase"
        ? "지울 음을 클릭하세요. Ctrl+Z로 되돌릴 수 있습니다."
        : "빈 곳 클릭·드래그: 음 그리기 · 음 드래그: 이동 · 오른쪽 끝: 길이 · Ctrl/Shift 클릭: 여러 음 선택";
}
function openInstruments(add) {
  addingInstrument = add;
  instrumentFamily = "전체";
  $("instrument-search").value = "";
  $("instrument-mode").textContent = add
    ? "새 트랙에 넣을 악기를 선택하세요. 선율 악기 15트랙 + 타악기 키트 1트랙까지 사용할 수 있습니다."
    : track().name + " 트랙의 악기를 바꿉니다. 기존 음표는 유지됩니다.";
  $("audition-status").textContent = "";
  renderInstruments();
  $("instrument-dialog").showModal();
}
function renderInstruments() {
  $("families").replaceChildren();
  for (const family of [
    "전체",
    ...new Set(Object.values(CATALOG).map((i) => i.family)),
  ]) {
    const b = make("button", family);
    b.setAttribute("aria-pressed", String(family === instrumentFamily));
    b.onclick = () => {
      instrumentFamily = family;
      renderInstruments();
    };
    $("families").append(b);
  }
  $("instrument-results").replaceChildren();
  const query = $("instrument-search").value.trim().toLowerCase();
  for (const [id, info] of Object.entries(CATALOG)) {
    if (
      (instrumentFamily !== "전체" && info.family !== instrumentFamily) ||
      !`${id} ${info.name} ${info.family}`.toLowerCase().includes(query)
    )
      continue;
    const item = make("div", undefined, "instrument-item"),
      text = make("div");
    text.append(
      make("strong", info.name),
      make(
        "small",
        info.family +
          " · " +
          (info.sampled ? "실제 녹음" : "합성음") +
          (info.percussion
            ? " · 키트"
            : " · " +
              pitchName(info.range[0]) +
              "–" +
              pitchName(info.range[1])),
      ),
    );
    item.append(
      text,
      make(
        "span",
        { 현악: "∿", 목관: "♮", 금관: "♭", 타악: "◈", 건반: "▥", 전자음: "⌁" }[
          info.family
        ],
        "family-icon",
      ),
    );
    const actions = make("div", undefined, "instrument-actions"),
      listen = make("button", "▶ 들어보기"),
      use = make("button", addingInstrument ? "트랙 추가" : "이 악기로 변경");
    listen.setAttribute("aria-label", info.name + " 미리듣기");
    listen.onclick = async () => {
      const token = ++auditionGeneration;
      audio.stop();
      $("audition-status").textContent = info.name + " 준비 중…";
      try {
        await audio.preview(
          { instrument: id, volume: 0.65, pan: 0 },
          info.percussion
            ? 36
            : Math.max(info.range[0], Math.min(info.range[1], 60)),
          95,
        );
        if (token === auditionGeneration)
          $("audition-status").textContent = info.name + " · 미리듣기";
      } catch (e) {
        if (token === auditionGeneration)
          $("audition-status").textContent = e.message;
      }
    };
    use.setAttribute(
      "aria-label",
      info.name + " " + (addingInstrument ? "트랙 추가" : "사용"),
    );
    const rest = p.tracks.filter((t) => addingInstrument || t.id !== trackId),
      melodic = rest.filter((t) => !isPercussion(t.instrument)).length;
    use.disabled =
      (addingInstrument && rest.length >= 16) ||
      (info.percussion && rest.some((t) => isPercussion(t.instrument))) ||
      (!info.percussion && melodic >= 15);
    use.onclick = () => {
      const okay = change(() => {
        if (addingInstrument) {
          const t = {
            id: uid(),
            name: info.name,
            instrument: id,
            volume: 0.55,
            pan: 0,
            mute: false,
            solo: false,
            notes: [],
          };
          p.tracks.push(t);
          trackId = t.id;
          selection.clear();
        } else setTrackInstrument(track(), id);
      });
      if (okay) {
        $("instrument-dialog").close();
        fitNotes();
      } else $("audition-status").textContent = $("status").textContent;
    };
    actions.append(listen, use);
    item.append(actions);
    $("instrument-results").append(item);
  }
  if (!$("instrument-results").children.length)
    $("instrument-results").append(
      make("p", "검색 결과가 없습니다. 다른 악기 이름을 입력하세요."),
    );
}
function currentChord() {
  return chordNotes(
    Number($("chord-root").value) + Number($("chord-octave").value),
    $("chord-quality").value,
    Number($("chord-inversion").value),
    quant(playTick),
    Number($("chord-duration").value),
    82,
    totalTicks(p),
  );
}
function updateChord() {
  try {
    $("chord-preview").textContent = currentChord()
      .map((n) => pitchName(n.pitch))
      .join(" · ");
    $("insert-chord").disabled = false;
  } catch (e) {
    $("chord-preview").textContent = e.message;
    $("insert-chord").disabled = true;
  }
}
function initializeControls() {
  const families = [...new Set(Object.values(CATALOG).map((i) => i.family))];
  for (const family of families) {
    const group = make("optgroup");
    group.label = family;
    for (const [id, info] of Object.entries(CATALOG).filter(
      ([, v]) => v.family === family,
    )) {
      const op = make("option", info.name);
      op.value = id;
      group.append(op);
    }
    $("instrument").append(group);
  }
  $("instrument").addEventListener("change", fitNotes);
  $("browse-instruments").onclick = () => openInstruments(false);
  $("instrument-search").oninput = renderInstruments;
  document
    .querySelectorAll("[data-close]")
    .forEach((b) => (b.onclick = () => $(b.dataset.close).close()));
  $("instrument-dialog").addEventListener("close", () => {
    auditionGeneration++;
    audio.stop();
  });
  $("templates").onclick = () => $("template-dialog").showModal();
  for (const template of TEMPLATES) {
    const b = make("button");
    b.append(make("strong", template.name), make("small", template.detail));
    b.onclick = () => {
      if (
        confirm(
          "현재 곡을 이 편곡 예제로 바꿀까요? 필요한 곡은 프로젝트 파일로 저장해 두세요.",
        )
      ) {
        replace(templateProject(template.id));
        $("template-dialog").close();
      }
    };
    $("template-list").append(b);
  }
  $("add-chord").onclick = () => {
    updateChord();
    $("chord-dialog").showModal();
  };
  for (const id of [
    "chord-root",
    "chord-octave",
    "chord-quality",
    "chord-inversion",
    "chord-duration",
  ])
    $(id).onchange = updateChord;
  $("insert-chord").onclick = () => {
    if (
      change(() => {
        const notes = currentChord();
        track().notes.push(...notes);
        selection = new Set(notes.map((n) => n.id));
      })
    ) {
      $("chord-dialog").close();
      fitNotes();
    }
  };
  $("quantize").onclick = () =>
    change(() => {
      for (const n of quantizeNotes(selected(), snap, totalTicks(p)))
        Object.assign(
          track().notes.find((v) => v.id === n.id),
          n,
        );
    });
  $("length-preset").onchange = () => {
    const length = Number($("length-preset").value);
    if (length)
      change(() => {
        for (const n of selected()) n.duration = length;
      });
    $("length-preset").value = "";
  };
  $("fit-notes").onclick = fitNotes;
  document
    .querySelectorAll("[data-tool]")
    .forEach((b) => (b.onclick = () => setTool(b.dataset.tool)));
  for (const id of ["loop", "loop-start", "loop-end", "metronome"])
    $(id).onchange = () => {
      audio.stop();
      renderRoll();
    };
  $("grid").addEventListener("pointermove", moveBlank);
  $("grid").addEventListener("pointerup", () => endBlank(false));
  $("grid").addEventListener("pointercancel", () => endBlank(true));
  $("grid").addEventListener("lostpointercapture", () => endBlank(true));
  $("roll-scroll").addEventListener(
    "scroll",
    () => ($("velocity-scroll").scrollLeft = $("roll-scroll").scrollLeft),
  );
  if (matchMedia("(max-width:560px)").matches)
    document.querySelector(".track-settings").open = false;
}
initializeControls();
render();
if (!blocked) save();
requestAnimationFrame(() => {
  fitNotes();
});
