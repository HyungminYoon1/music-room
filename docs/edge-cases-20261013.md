# Edge audit — 2026-10-13 (after maintenance)

Status: LOCAL PASS, parent integration/publication pending. Baseline clean main.

## Inventory and planned executable matrix

Read authority in order: architecture.md, api-spec.md (absent), requirements.md, README.md, docs/decisions.md. Read package/workflow/attributes/ignore, previous verification, all authored dist/src modules, existing tests and browser harness, build/check/serve tools. HTML controls inventoried. CSS responsive rules selected; vendor internals, assets and lockfiles inventoried only.

| Surface / invariant | Existing coverage | New audit cases / evidence |
| --- | --- | --- |
| Numeric inputs | Representative malformed values and fine edits | Table-driven finite/type/min/max/outside cases for each model field |
| Import | Roundtrip and corrupt file | Corrupt/oversize rejection preserves document; delayed A then B; delayed A then edit/new |
| Storage | Some corrupt/quota coverage | Denied read, quota write, readback mismatch, sibling key sentinels; explicit file recovery |
| History / selection | Undo/redo, recent cancel regressions | Branch/no-op/budget boundaries; cancel new/import; invalid edit retains prior project |
| Limits / precision / export | Real existing file downloads | Exact resource endpoints, over-limit rejection, exported precision invariant |
| Async | Some lifecycle checks | Controlled delayed File.text fixture; late completion cannot replace newer input |
| Keyboard / focus | Recent key/movement regression | Text focus, repeated actions, cancelled gesture and next edit |
| Narrow layout | Prior 1440/390/320 | Fresh real inputs at all widths; initial and edited screenshots inspected |

Fixture data is synthetic and explicitly labelled. Browser input and actual downloaded output are distinguished from fixtures. Physical pen/touch, physical GPU certification, external DAW/CAD compatibility: NOT_RUN. API/server/database: N/A (static architecture). Remote CI/live: NOT_RUN.

The initial matrix above was written before execution. Final results follow; baseline-passing cases are coverage additions, never RED_GREEN.

## Executed results and case matrix

LOCAL PASS. Initial main revision: cb91067. Existing tests preserved: 8. New Node tests: 22. Full npm test: **30/30**. New browser scenarios: **12/12** (separate count). Existing browser/export suite also PASS. Parameter-loop assertions are not inflated into separate test counts.

| Feature / invariant | Coverage origin | Executable case / reference | Result |
| --- | --- | --- | --- |
| Numeric schema (8 cases) | NEW | BPM/bars, volume/pan, pitch/start/duration/velocity: finite/type/min/max/outside/fractional integer rejection; invalid validation leaves input unchanged | PASS baseline |
| Meter | NEW regression | Numeric4/4,3/4,6/8 allowed; coercible string pairs rejected | FAIL -> PASS |
| Track/note limits | NEW | 8/9 tracks,1/2 drums,4096/4097 notes, final tick+duration, ID collision | PASS baseline |
| Import bytes | NEW regression | UTF-8 >2MB with characters <2MB rejected; browser1.92MB synthetic metadata remains editable but must not overwrite1.9MB autosave | FAIL -> PASS |
| Mix/selection/history | NEW + existing | Mute/solo intersection, group boundary saturation without interval drift, detached snapshots, redo branch,12MB history bound; existing focus/Escape/group dragging retained | PASS baseline |
| Exports | NEW + existing | WAV exact180s endpoint,180s+1 sample reject, rates/type/nonfinite samples, signed PCM bytes; MIDI VLQ endpoints, note-off before retrigger, original ticks unchanged by XML/notation | PASS baseline |
| Async audio (5 cases) | NEW fixture coverage | Delayed play/preview stopped before nodes, hidden-page play blocked, WAV cancel before offline allocation/after rendering,180s refusal before context/fetch | PASS unchanged audio.js |
| Import atomicity/cancel | NEW + existing | tools/edge-browser.mjs: malformed and limit+1-byte files leave old state; valid import dismissal/new cancellation retain history; undo/redo | PASS baseline |
| Storage isolation | NEW fixture coverage | Denied getItem, quota setItem, readback mismatch and corrupt record: edits remain downloadable, old bytes retained, visible save warning; sibling key sentinels unchanged on every scenario | PASS baseline |
| Async import | NEW regression | Delayed File.text A/B completion order; newer committed edit, new document and unblurred typing defeat old A | FAIL -> PASS |
| Focus/narrow UI | NEW + existing | Real fill/Home/Delete/Tab and undo/redo at1440/390/320; initial+edited captures; root horizontal overflow0; retained primary canvas/note/object flows | PASS |

### Actual RED_GREEN evidence

1. Strict meter: baseline-tests.log test9 failed with Missing expected exception: ["4","4"]. Numeric component validation now rejects coercible strings without changing supported meters or valid files.
2. UTF-8 limits: utf8-audio-baseline.log test17 failed to reject >2MB bytes; bytes-red-browser.json showed 자동 저장됨 for a1.92MB UTF-8 fixture exceeding the1.9MB autosave bound. Parser/save now measure actual bytes; identical cases pass. Unknown metadata behavior and project schema are retained.
3. Import ordering: baseline-browser.json records three stale replacement failures; typing-red-browser.json records unfinished text lost before blur. Request generations invalidate later file reads on input/edit/drag/new/undo/redo. Clear file input at selection time so an older finally cannot clear a newer selection.

Unmodified new cases are **coverage additions**. They are not labelled RED_GREEN. Fixture scheduling/error injection is not a real storage device failure or audio/GPU hardware test.

### Commands and artifacts

Run from this app root (Node22+; provided Playwright resolver and installed Chrome executable). This session used owned persistent loopback servers on ephemeral ports; substitute the port printed by serve:

```powershell
node tools/serve.mjs 0
npm test
npm run check
node tools/edge-browser.mjs ../output/playwright/implement-20261012/package.json http://127.0.0.1:PORT/ final
node tools/edge-browser.mjs ../output/playwright/implement-20261012/package.json http://127.0.0.1:PORT/ existing
git diff --check
```

All evidence is ignored under output/playwright/edge-20261013: baseline-tests.log (executed before production edits), baseline-browser.json, typing-red-browser.json, final-tests.log, final-check.log, final-browser.json, existing-run.log, existing/report.json and actual downloads/screenshots. DRAW additionally has zoom-red-browser.json; SCORE additionally has utf8-audio-baseline.log and bytes-red-browser.json. No fabricated old failure runs. The earlier browser baseline had a cross-realm assertion/large-buffer transport harness error; the harness was corrected and rerun against unchanged source before product edits. The corrected baseline artifact is authoritative.

Persistent Playwright Interactive Chrome was isolated, headless and muted; File.text and Storage faults use explicit disposable context fixtures. The retained primary-flow harness runs from the CLI adapter (same pinned Playwright/Chrome, isolated/muted); only URL, output directory, browser ownership and cross-realm value comparison are adapted, not its product assertions. Node REPL string-code generation is unavailable, so that supplemental runner used ordinary Node. Existing test/harness source is unmodified.

Build: N/A for this change; no vendor/build input, dependency, license or generated bundle changed. Full syntax/assets checks run on committed dist bundles. No installation/update required.

### Browser and visual QA

Existing harness: exercise selection, exact1/419 ticks, invalid109 pitch rollback, group drag, explicit playback/stop, real JSON roundtrip, MIDI PPQ960, XML419 ticks, WAV1712048 bytes stereo48kHz24bit/nonzero data, vector SVG parsing and PDF2pages,180s refusal. Exploration:copy/duplicate/delete undo/redo, mute/solo cycles, six instruments, volume/pan endpoints,39BPM reject, grid/loop,8-track cap and last-track guard.

Screenshots reviewed directly: final-initial-1440.png, final-edited-390.png, final-edited-320.png and real edited/export states in existing/. No observed page errors or root horizontal overflow at the tested widths. Mobile layouts intentionally scroll; the piano roll and clay tool strip are their existing internally scrollable regions. Input boxes, main canvas/roll/mesh, toolbar, status and downstream panels were inspected separately. Explore results in exploratory.json and actual captures (not included in automated test count).

UI change: NO visual/layout change. Actual desktop, score-desktop,390/320 captures remain under output/playwright/edge-20261013/; parent can retain gallery image.

### Source accounting and remaining limits

- VERIFIED: all three named app directories inventoried independently; this report concerns only score-lab. architecture.md -> requirements.md -> README.md, decisions/verification, package.json, .gitattributes, .gitignore, .github/workflows/pages.yml fully read. api-spec.md and repository AGENTS.md absent (N/A); supplied user AGENTS instructions applied.
- VERIFIED authored scope: dist/src/model.js, app.js, audio.js, notation.js; dist/index.html; test/model.test.js; tools/browser-regression.js, verify-browser.mjs, build.mjs, check.mjs, serve.mjs, normalize.mjs, vendor-entry.js. New test/runner and production diff reviewed. No sibling source used for changes.
- PARTIAL: styles.css responsive/input rules and relevant layout reviewed; not every unrelated cosmetic rule. Font/icon/audio/license binaries and vendored library internals inventoried/static-checked, not fully manually audited. Lockfiles (where present) inventoried; dependency graph not re-audited because unchanged.
- VERIFIED local integration: existing+new npm tests, npm check, browser assertions, diff whitespace and edited-file UTF-8 without BOM / CRLF.
- NOT_RUN: physical pen/multitouch, physical GPU/browser matrix/low-memory devices, DAW/speaker/color/CAD/printer interoperability or certification. Exact maximum resource model bounds are tested where listed; exhaustive worst-case rendering/performance is NOT_RUN.
- NOT_RUN: remote CI/live/publication, commits/pushes/deployments. Parent owns final integration and release; no live claim.
- N/A: API/backend/database/migrations/new resource schema or provider. Architecture and numeric limits retained; no conflicting authority discovered.

Changed paths (8): dist/src/app.js, dist/src/model.js, test/edge.test.js, test/audio-edge.test.js, tools/edge-browser.mjs, docs/edge-cases-20261013.md, docs/verification.md, docs/decisions.md. Decision D07 records rationale/options/review. Existing tests preserved. Runtime artifacts stay ignored; parent must retain them separately if needed for release evidence.

