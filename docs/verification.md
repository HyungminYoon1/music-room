# Verification

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
