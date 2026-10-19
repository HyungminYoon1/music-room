# Verification

## 2026-10-19 MIDI import and music-room rename — LOCAL PASS

- User explicitly approved tempo/meter time-axis expansion and requested repository rename (D09). VERIFIED: architecture/requirements/README/decisions, authored model/time/import/audio/instrument/editing/notation/UI modules, HTML, relevant CSS and test/build/deploy tools. No api-spec/repository AGENTS file exists. Source URL/repository identity resolved to public HyungminYoon1/score-lab, repo ID1412016910 before rename. PARTIAL: unchanged vendor/sample internals and other WEB LAB applications; only relevant gallery metadata/links are modified.
- Node **65/65 PASS**, baseline49. Static **220 files PASS**, pinned vendor rebuilt and normalized with no runtime dependency changes. Tests cover standard SMF0/1, PPQ/running status/zero-velocity off/FIFO overlap, track/channel selection, exact tempo/meter/program and controller roundtrip, unknown GM disclosure, malformed/truncated/header/VLQ/data/type2/SMPTE/size failures, note/range/bars/controller bounds, v1 compatibility, long rests and timeline validation. Additional audio test doubles prove lifecycle/resource policies, not human sound quality.
- Failure-first: missing importer made the new tests fail before implementation. Added late-controller/end-rest case failed validation, then retained original track extent. Repeated note-off consumed a subsequent note; regression showed one missing note, then passed after bounded queue consumption. Extreme tempo/sub-50ms loop rejection tests failed, then passed. A dense4096-note fixture allocated12,291 nodes before the cap; allocation is now bounded before voice creation. An initial MusicXML test assumed rounded90BPM instead of exact89.999955; corrected that test expectation without rounding product data. Existing clock fixture exposed missing-bars compatibility, then restored its fixed-meter fast path.
- Real isolated Chrome **9 MIDI scenarios PASS**: preview/cancel/confirmation preserves song; variable tempo/meter/program import, map and reload; actual WAV duration **6.700001s** (frame rounded); real-time loop tempo integration; note pitch/start + instrument edit -> real MIDI download -> reimport -> JSON save; 19parts -> user-selected15melodic+1kit; invalid/oversized/type2/empty files leave current state untouched; delayed MIDI races/new file/unblurred typing; 390/320 chooser. No page errors. Viewed desktop track selection and320px dialog; actual gallery preview captured from default new UI.
- Independent interoperability check: ignored QA-only Mido1.3.3 reads actual downloaded edited.mid; type1/PPQ960/3file tracks/exact500000,666667,400000 tempo map/5.200001s song/celloGM42/edited pitch61 at tick11 PASS. Mido is not an app dependency or deployment asset. This is parser interoperability, not a commercial DAW certification.
- Retained orchestra browser **13 scenarios PASS** including all30 non-silent WAVs/all180sample decodes/notation/loop/mobile. Retained browser edges12 PASS and primary/download9check groups PASS: JSON races/quotas/corrupt saves, consecutive edits/drag rollback, real WAV/MIDI/XML/SVG/PDF and180s rejection. Existing save key remains score-lab-project-v1; no account/backend/upload/shared-summary changes.
- Evidence (ignored): output/playwright/midi-20261019/report.json, import/track-selection/timing/score/320/390 images, changing.wav, edited.mid/json; retained music-20261019 and edge-20261013. Reproduce: `node tools/midi-browser.mjs PATH_TO_PLAYWRIGHT_PACKAGE_JSON BASE_URL`; existing music/edge harnesses remain valid.
- NOT_RUN: real touch hardware/Safari/iPhone, commercial DAW import, physical MIDI, subjective playback fidelity, exhaustive all possible MIDI variants. NOT_SUPPORTED: format2/SMPTE, out-of-range pitches/tempo, SysEx/lyrics/key signatures/pressure; CC/pedal/bend are re-exported, not synthesized. Remote rename/Windows+LinuxCI/new Pages path/live browser are verified after push separately and reported in the handoff.

## 2026-10-19 MUSIC ROOM — LOCAL PASS

User approved the 16-track/orchestra architecture exception (D08). URL, version-1 projects and own save key remain unchanged. VERIFIED: architecture, requirements, README, decisions, authored model/audio/notation/app/HTML/CSS, tests and relevant tools/workflow. No api-spec or repository AGENTS file exists. All 180 new WAV hashes/headers and pinned sample/license provenance verified. Upstream raw library and vendor internals are PARTIAL, not fully audited. Other WEB LAB app implementations are out of scope.

- Node **49/49 PASS** (baseline 30; 19 new). Static **218 files PASS**; pinned vendor rebuilt without unintended dependency/bundle changes. UTF-8 no BOM / CRLF and diff whitespace checks are release gates.
- New browser suite **13/13 scenarios PASS**, isolated muted Chrome: search/family/audition/add; chord/inversion; group velocity/length/quantize/undo; marquee/group move; draw/erase/cancel; quoted IDs; loop/stop/invalid range; consecutive velocity-key edits; delayed-load stop status; 16-track/percussion budget; notation/XML; 1440/390/320 layouts. No page errors or root overflow.
- Actual Web Audio: all **30 presets** rendered non-silent stereo 48 kHz / 24-bit WAV; all **180** new recordings decoded. Sustained violin has waveform energy at seconds 6–7, beyond the original clip. Ten orchestral score parts render, including alto/bass/percussion clefs. This is waveform/format evidence, not human listening certification.
- Retained browser edges **12/12 PASS**: malformed/oversize import, cancellation/order/new/typing races, quota/denied/readback/corrupt-storage preservation, UTF-8 limits and mobile input. Retained primary suite PASS: exact 1/419 ticks, actual JSON download/reimport, MIDI/XML/WAV/SVG/PDF, 180s refusal and drag/history/selection.
- Failure-first: orchestra channel/catalog tests failed 5/5 before implementation. New harp template exceeded the last bar; its regression failed then passed. Concurrent sample requests peaked at 12 instead of 4; a per-context semaphore fixed the failing test. Velocity arrows produced 91 instead of 92; focus restoration fixed it. Delayed loading overwrote 정지 with 음원 준비 1 / 1; generation guarding fixed it. Coverage additions are not claimed as regressions. An initial duplicate-browser expectation used too short a fixture; that test was corrected to four bars, not the product boundary.
- Evidence (ignored): output/playwright/music-20261019/report.json, audio-render.json, desktop/library/notation/mobile screenshots; output/playwright/edge-20261013/music-browser.json and existing/report.json with actual exports. WEB LAB's JPEG is a real 1440×1050 isolated capture; other images are unchanged.

Reproduce with `node tools/serve.mjs 0`, npm run build/test/check, and an existing Playwright package:

```powershell
node tools/music-browser.mjs ../output/playwright/implement-20261012/package.json http://127.0.0.1:PORT/
node tools/edge-browser.mjs ../output/playwright/implement-20261012/package.json http://127.0.0.1:PORT/ music
node tools/edge-browser.mjs ../output/playwright/implement-20261012/package.json http://127.0.0.1:PORT/ existing
```

NOT_RUN: physical touch/MIDI devices, Safari/iPhone, low-memory phones, external DAW/MusicXML import, subjective fidelity and exhaustive 4096-note performance. MIDI import, VST and microphone recording are NOT_IMPLEMENTED. No server/DB/account change. Windows/Linux CI and Pages are checked after push, separately from local browser evidence; consult the release run and handoff for public status.

## 2026-10-13 NEW systematic edge audit — LOCAL / parent integration pending

[Full source inventory, existing/new executable matrix, RED_GREEN logs and limitations](edge-cases-20261013.md). Added 22 Node tests; **30/30** full suite PASS. New browser scenarios **12/12** PASS, plus the retained primary-flow/export harness. Tests passing unchanged source are coverage additions. All evidence: ignored output/playwright/edge-20261013. Decision D07. UI change: NO layout change. No commit/push/deploy/remote CI/live run; parent publishes.

## 2026-10-13 구절 편집과 두 마디 연습 — LOCAL / 통합 대기

- SOURCE VERIFIED: 저장소 인벤토리, architecture.md → requirements.md → README.md, decisions/verification, .gitattributes/ignore/workflow, model/app/audio/notation, HTML, 기존 테스트와 build/check/serve. api-spec.md와 AGENTS.md는 없음. SOURCE PARTIAL: CSS 관련 레이아웃과 번들/음원/폰트 인벤토리·정적 검사; 바이너리 전체 및 vendor의 모든 내부 구현을 재검토하지 않음.
- 재현→수정: 선택 음에서 방향키 두 번을 누르면 960→1200에서 멈춤(기대1440); Esc를 눌렀는데 드래그 시작1440→1920으로 저장됨. tools/browser-regression.js가 수정 전 각각 실패, 수정 후 PASS. 포커스/취소 복구, 거절된 변경의 트랙·선택 보존, 무변경 history push 방지. 그룹 이동은 하나의 시간·음높이 delta를 경계 안으로 제한해 간격 보존; 실제 왼쪽 경계 드래그와 순수 모델의 양끝 시간·음높이 경계 검사 PASS.
- 콘텐츠/UI: 기존 schema의 2마디/2트랙/8음 ‘주고받는 두 마디’, 사용자 확인 후 열기, 정확한1/419틱·여러 음·SOLO·파일 왕복 연습. UI change: YES. provenance: src/model.js의 PPQ/barTicks/exerciseProject/moveNotes, app.js의 입력·SOLO/저장, notation.js의 기존1/16 표시. 자체 작곡 예시와 검증된 앱 조작이며 새로운 음악 이론/과학적 측정 주장은 없음.
- LOCAL: npm run build PASS(기존 pinned vendor), npm test **8/8 PASS**, npm run check **30 public files PASS**, git diff --check와 브라우저 스크립트 구문 검사 PASS. 모델 테스트 수와 브라우저 검사는 별도.
- ACTUAL BROWSER: 독립 음소거 Chrome headless/127.0.0.1:4292. 연습 열기·1틱/419틱 편집·109 음높이 거절 시 선택 유지·undo/redo, JSON 실제 다운로드→재불러오기, 잘못된 파일 보존. 실제 그룹 경계 이동, 명시적 재생/정지. MIDI PPQ960, MusicXML419틱/XML 파싱, WAV **1,712,048bytes/48kHz/stereo/24bit/nonzero waveform**, SVG 파싱, 실제 PDF와2악보 페이지. 64마디/40BPM WAV180초 초과 거절 후 프로젝트 보존. quota fixture는 기존 자동저장 보존/파일 저장 필요 표시. 1440/390/320 root overflow0, 좁은 화면 선택과Shift+방향키1틱 편집, page errors0.
- 재실행: 서버 `node tools/serve.mjs 4292`; `node tools/verify-browser.mjs ../output/playwright/implement-20261012/package.json` (제공된 Playwright 설치와 현재 Windows Chrome 경로 사용). ignored output/playwright/qa-20261013에 report.json, desktop.png, score-desktop.png, mobile-390.png/mobile-320.png, JSON/WAV/MIDI/MusicXML/SVG/PDF 실제 파일. 화면 상태는 펼친 연습+2트랙/피아노 롤, score-desktop은 악보. selectors: #practice, #open-exercise, #grid, .note, #note-start, #open, #score-pages.
- NOT_RUN: 물리 스피커/청감 평가, 실제 터치, 모든 브라우저·4096음 성능·외부 DAW/MusicXML 호환성. REMOTE_CI/LIVE/commit/push/deploy는 실행하지 않음. D06 참조.
- 통합 파일(9): dist/src/app.js, dist/src/model.js, dist/index.html, dist/styles.css, test/model.test.js, docs/decisions.md, docs/verification.md, tools/browser-regression.js, tools/verify-browser.mjs. 모두 UTF-8 no BOM / CRLF 확인. 기존 vendor/라이선스 빌드 결과는 normalize 후 원래 bytes로 일치하여 변경 목록에서 제외됨.

## 2026-10-10 REMOTE_CI / LIVE

Implementation commit `79d456ed30c334e0894bd761ab1acbec09196680`: [verify/deploy PASS](https://github.com/HyungminYoon1/score-lab/actions/runs/37947861983). Public Pages uses the verified GitHub origin; normal pushes only.

LIVE HTTP: all 30 public dist files returned HTTP200 and matched the local verified SHA256 bytes. Across six affected services, 151/151 files matched after the gallery deployment completed.

LIVE BROWSER / EXPORT: UI retained start=1 and duration=419 ticks; explicit playback advanced transport. Downloaded editable JSON, WAV, MIDI, MusicXML, SVG and four-page PDF. WAV: 48kHz / 24-bit / stereo, 19.9615 seconds, 1803570 nonzero channel samples. Actual MIDI has PPQ960 and the edited note's on tick1/off tick420. MusicXML and SVG parse as XML; four staff pages render. Viewports 1440/390/320 without overflow or observed page errors. This does not establish subjective speaker/sample fidelity or external DAW compatibility.

The existing shared completion string was unchanged. Creative files stay browser-local; individual own keys are a code contract, not origin isolation between GitHub Pages paths. Physical hardware, all browsers and independent expert interoperability/scientific review remain NOT_RUN. This evidence update changes docs only.



2026-10-09 LOCAL: 6 model/export tests pass; static syntax/assets/CSP check passes for 28 files. npm install audit reported zero vulnerabilities. Exact start 1 tick / duration 419 ticks was edited through the UI; undo/redo, explicit playback/stop and 1440/390/320 layouts were exercised in an isolated Playwright browser. No page errors, no whole-page overflow, shared summary unchanged.

Real downloaded project JSON, MIDI, MusicXML, SVG, WAV and PDF were saved and inspected. WAV: 5,748,968 bytes, 48 kHz, 24-bit stereo, 19.96 seconds, 1,803,570 nonzero channel samples. PDF: %PDF-1.3, four pages. Real score rendering viewed; local sample playback advanced the transport. A negative countdown display during the 70ms scheduling lead was found and fixed by clamping elapsed time.

FINAL LOCAL: actual note creation/drag changed start to 1680 ticks, undo/redo passed. Lead-in clock after correction read 01:1:000, not negative. Beams and ties render; after the final Bravura-only build an isolated browser rendered four score pages and downloaded actual SVG (710827 bytes) and PDF (717074 bytes, four pages), without page errors. Build generates all transitive bundled license notices. Model/static tests still pass; static public file count is now 30. Browser autosave readback success no longer triggers an unnecessary reload warning.

NOT_RUN: physical speakers, subjective studio monitor comparison, external DAW/MusicXML import compatibility, exhaustive 4096-note performance. Remote CI and LIVE deployment pending. This is not certification of commercial-DAW parity.
