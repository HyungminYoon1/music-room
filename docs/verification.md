# Verification

## 2026-10-10 REMOTE_CI / LIVE

Implementation commit `79d456ed30c334e0894bd761ab1acbec09196680`: [verify/deploy PASS](https://github.com/HyungminYoon1/score-lab/actions/runs/37947861983). Public Pages uses the verified GitHub origin; normal pushes only.

LIVE HTTP: all 30 public dist files returned HTTP200 and matched the local verified SHA256 bytes. Across six affected services, 151/151 files matched after the gallery deployment completed.

LIVE BROWSER / EXPORT: UI retained start=1 and duration=419 ticks; explicit playback advanced transport. Downloaded editable JSON, WAV, MIDI, MusicXML, SVG and four-page PDF. WAV: 48kHz / 24-bit / stereo, 19.9615 seconds, 1803570 nonzero channel samples. Actual MIDI has PPQ960 and the edited note's on tick1/off tick420. MusicXML and SVG parse as XML; four staff pages render. Viewports 1440/390/320 without overflow or observed page errors. This does not establish subjective speaker/sample fidelity or external DAW compatibility.

The existing shared completion string was unchanged. Creative files stay browser-local; individual own keys are a code contract, not origin isolation between GitHub Pages paths. Physical hardware, all browsers and independent expert interoperability/scientific review remain NOT_RUN. This evidence update changes docs only.



2026-10-09 LOCAL: 6 model/export tests pass; static syntax/assets/CSP check passes for 28 files. npm install audit reported zero vulnerabilities. Exact start 1 tick / duration 419 ticks was edited through the UI; undo/redo, explicit playback/stop and 1440/390/320 layouts were exercised in an isolated Playwright browser. No page errors, no whole-page overflow, shared summary unchanged.

Real downloaded project JSON, MIDI, MusicXML, SVG, WAV and PDF were saved and inspected. WAV: 5,748,968 bytes, 48 kHz, 24-bit stereo, 19.96 seconds, 1,803,570 nonzero channel samples. PDF: %PDF-1.3, four pages. Real score rendering viewed; local sample playback advanced the transport. A negative countdown display during the 70ms scheduling lead was found and fixed by clamping elapsed time.

FINAL LOCAL: actual note creation/drag changed start to 1680 ticks, undo/redo passed. Lead-in clock after correction read 01:1:000, not negative. Beams and ties render; after the final Bravura-only build an isolated browser rendered four score pages and downloaded actual SVG (710827 bytes) and PDF (717074 bytes, four pages), without page errors. Build generates all transitive bundled license notices. Model/static tests still pass; static public file count is now 30. Browser autosave readback success no longer triggers an unnecessary reload warning.

NOT_RUN: physical speakers, subjective studio monitor comparison, external DAW/MusicXML import compatibility, exhaustive 4096-note performance. Remote CI and LIVE deployment pending. This is not certification of commercial-DAW parity.
