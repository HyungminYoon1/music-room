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
const $ = (id) => document.getElementById(id),
  status = (s) => ($("status").textContent = s),
  history = new History();
let p = demoProject(),
  trackId = p.tracks[0].id,
  selection = new Set(),
  playTick = 0,
  clipboard = [],
  blocked = false,
  dirty = false,
  exporting = false,
  px = 84,
  snap = 240,
  drag = null,
  pages = [];
let importGeneration = 0;
// A late file read must not discard even an input that has not blurred yet.
document.addEventListener("input", () => { importGeneration++; });
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
const colors = [
  "#4770df",
  "#bf849a",
  "#78a59c",
  "#a18bce",
  "#c6924d",
  "#6a9cbf",
  "#aaad68",
  "#d18471",
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
  const beforeSelection = new Set(selection), beforeTrack = trackId;
  try {
    fn();
    validate(p);
    if (JSON.stringify(p) !== JSON.stringify(before)) history.push(before);
    pages = [];
    save();
    render();
  } catch (e) {
    p = before;
    selection = beforeSelection;
    trackId = beforeTrack;
    render();
    status(e.message);
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
  $("tempo").value = p.tempo;
  $("meter").value = p.meter.join("/");
  $("bars").value = p.bars;
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
  $("add-track").disabled = p.tracks.length >= 8;
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
    c.append(
      make("strong", t.name),
      make("small", INSTRUMENTS[t.instrument] + " · " + t.notes.length + "음"),
    );
    const dot = make("i", undefined, "track-color");
    dot.style.background = colors[i];
    c.append(dot);
    const s = make("div", undefined, "switches");
    for (const [k, label] of [
      ["mute", "MUTE"],
      ["solo", "SOLO"],
    ]) {
      const b = make("button", label);
      b.setAttribute("aria-pressed", t[k]);
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
  inspect();
  if (!$("score-view").hidden) showScore();
}
function renderRoll() {
  const focused = document.activeElement;
  const focusId = focused?.classList.contains("note") ? focused.dataset.id : null;
  const keepFocus = focused === $("grid") || !!focusId;
  const width = (totalTicks(p) / PPQ) * px;
  $("grid").style.width = width + "px";
  $("ruler").style.width = width + "px";
  $("ruler").replaceChildren();
  for (let b = 0; b < p.bars; b++) {
    const el = make("span", b + 1, "bar-label");
    el.style.left = ((b * barTicks(p)) / PPQ) * px + "px";
    el.style.width = (barTicks(p) / PPQ) * px + "px";
    el.onclick = () => {
      audio.stop();
      playTick = b * barTicks(p);
      tick();
    };
    $("ruler").append(el);
  }
  $("grid").style.backgroundSize = `${px}px 14px`;
  for (const e of $("grid").querySelectorAll(".note")) e.remove();
  for (const n of track().notes) {
    const e = make(
      "div",
      pitchName(n.pitch),
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
    e.style.top = (108 - n.pitch) * 14 + 1 + "px";
    e.style.width = (n.duration / PPQ) * px + "px";
    e.style.opacity = 0.4 + (n.velocity / 127) * 0.6;
    e.onpointerdown = beginDrag;
    e.onkeydown = keyEdit;
    $("grid").append(e);
  }
  tick();
  if (keepFocus) {
    const target = [...$("grid").querySelectorAll(".note")].find(e=>e.dataset.id===focusId);
    (target || $("grid")).focus({preventScroll:true});
  }
}
for (let i = 108; i >= 21; i--) {
  const e = make(
    "button",
    i % 12 === 0 ? pitchName(i) : "",
    "key" +
      ([1, 3, 6, 8, 10].includes(i % 12) ? " black" : "") +
      (i % 12 === 0 ? " c" : ""),
  );
  e.setAttribute("aria-label", pitchName(i) + " 들어보기");
  e.onclick = () => audio.preview(track(), i).catch((e) => status(e.message));
  $("keys").append(e);
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
    $(id).disabled = ns.length !== 1;
    $(id).value = ns.length === 1 ? ns[0][key] : "";
  }
  $("delete").disabled =
    $("copy").disabled =
    $("duplicate").disabled =
      !ns.length;
  $("paste").disabled = !clipboard.length;
}
for (const [id, key] of [
  ["note-pitch", "pitch"],
  ["note-start", "start"],
  ["note-duration", "duration"],
  ["note-velocity", "velocity"],
])
  field(id, (v) => {
    if (selected().length === 1) selected()[0][key] = Number(v);
  });
function quant(t) {
  return Math.round(t / snap) * snap;
}
function beginDrag(e) {
  if (e.button !== 0) return;
  importGeneration++;
  e.preventDefault();
  e.stopPropagation();
  $("grid").focus({preventScroll:true});
  audio.stop();
  const id = e.currentTarget.dataset.id,
    n = track().notes.find((n) => n.id === id);
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
  e.currentTarget.onlostpointercapture = () => { if (drag) endDrag(true); };
  inspect();
}
function moveDrag(e) {
  if (!drag) return;
  const dt = quant(((e.clientX - drag.x) / px) * PPQ),
    dp = -Math.round((e.clientY - drag.y) / 14);
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
      const result = moved.find(n=>n.id===original.id);
      n.start = result.start;
      n.pitch = result.pitch;
    }
    const el = $("grid").querySelector(`[data-id="${n.id}"]`);
    el.style.left = (n.start / PPQ) * px + "px";
    el.style.top = (108 - n.pitch) * 14 + 1 + "px";
    el.style.width = (n.duration / PPQ) * px + "px";
    el.textContent = pitchName(n.pitch);
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
  const rect = $("grid").getBoundingClientRect(),
    start = Math.max(
      0,
      Math.min(totalTicks(p) - 1, quant(((e.clientX - rect.left) / px) * PPQ)),
    ),
    pitch = Math.max(
      21,
      Math.min(108, 108 - Math.floor((e.clientY - rect.top) / 14)),
    );
  change(() => {
    const n = {
      id: uid(),
      pitch,
      start,
      duration: Math.min(totalTicks(p) - start, Math.max(snap, 240)),
      velocity: 88,
    };
    track().notes.push(n);
    selection = new Set([n.id]);
  });
  audio.preview(track(), pitch).catch((e) => status(e.message));
});
function keyEdit(e) {
  if (e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
  if (
    ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key) &&
    selected().length
  ) {
    e.preventDefault();
    change(() => {
      const step=e.shiftKey?1:snap;
      const dt=e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0;
      const dp=e.key==='ArrowUp'?1:e.key==='ArrowDown'?-1:0;
      for(const result of moveNotes(selected(),dt,dp,totalTicks(p)))
        Object.assign(track().notes.find(n=>n.id===result.id),result);
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
field("tempo", (v) => (p.tempo = Number(v)));
field("meter", (v) => (p.meter = v.split("/").map(Number)));
field("bars", (v) => (p.bars = Number(v)));
field("track-name", (v) => (track().name = v));
field("instrument", (v) => (track().instrument = v));
field("volume", (v) => (track().volume = Number(v)));
field("pan", (v) => (track().pan = Number(v)));
$("add-track").onclick = () =>
  change(() => {
    const t = {
      id: uid(),
      name: "트랙 " + (p.tracks.length + 1),
      instrument: "pluck",
      volume: 0.6,
      pan: 0,
      mute: false,
      solo: false,
      notes: [],
    };
    p.tracks.push(t);
    trackId = t.id;
    selection.clear();
  });
$("remove-track").onclick = () => {
  if (p.tracks.length > 1 && confirm("선택한 트랙과 음을 삭제할까요?"))
    change(() => (p.tracks = p.tracks.filter((t) => t.id !== trackId)));
};
$("snap").onchange = () => (snap = Number($("snap").value));
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
    );
    status("재생 중");
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
  $("clock").value =
    String(Math.floor(playTick / barTicks(p)) + 1).padStart(2, "0") +
    " : " +
    (Math.floor((playTick % barTicks(p)) / PPQ) + 1) +
    " : " +
    String(Math.floor(playTick % PPQ)).padStart(3, "0");
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
  save();
  render();
  if (!$("score-view").hidden) showScore();
}
$("new").onclick = () => {
  if (confirm("새 곡을 시작할까요? 현재 곡은 파일로 저장해 두세요."))
    replace(emptyProject());
};
$("open-exercise").onclick = () => {
  if (confirm("두 마디 연습 곡을 열까요? 현재 곡은 프로젝트 파일로 저장해 두세요."))
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
document.querySelectorAll("[data-export]").forEach(
  (b) =>
    (b.onclick = async () => {
      if (exporting) return;
      exporting = true;
      audio.stop();
      document
        .querySelectorAll("[data-export]")
        .forEach((b) => (b.disabled = true));
      $("cancel-export").hidden = false;
      const kind = b.dataset.export;
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
  if (e.key === "Escape" && drag) { e.preventDefault(); endDrag(true); return; }
  const mod = e.ctrlKey || e.metaKey;
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
window.addEventListener("blur", () => { if (drag) endDrag(true); });
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
render();
if (!blocked) save();
requestAnimationFrame(() => {
  $("roll-scroll").scrollTop = (108 - 79) * 14 - 90;
});
