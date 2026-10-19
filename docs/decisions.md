# Decisions

## D07 — Evidence-first boundary and stale-input repair (2026-10-13)

Context: the new post-maintenance audit executed failing assertions before product edits; see [edge audit](edge-cases-20261013.md). Async file completion could replace a later accepted file, edit/new document, or still-focused typed text.

Options: block the whole editor while reading, accept whichever read finishes last, or invalidate pending reads when newer user input takes precedence. Decision: keep a page-memory generation in app.js; capture it at file selection, invalidate on subsequent input/edit/undo/redo/replacement and relevant gestures/jobs, and ignore stale completion/error before parsing or confirmation. Clear the file input immediately so older completion cannot clear a newer file. Rationale: preserve the user's newer work without freezing the editor or changing persisted data.

Additional boundary decision: Keep2MB import and1.9MB autosave thresholds as UTF-8 bytes, retaining unknown project metadata and preserving oversized editable work for file export. Require numeric meter components, consistent with app-created project data; do not coerce malformed imports or migrate saved documents. Audio tests use explicit stubs only for scheduling/cancellation; no fidelity claim.

Affected files: dist/src/app.js, dist/src/model.js, test/edge.test.js, test/audio-edge.test.js, tools/edge-browser.mjs, docs/edge-cases-20261013.md, docs/verification.md, docs/decisions.md. No architecture/layer/schema/storage-key/resource-limit/dependency expansion. Review: the exact failing assertions pass after fixes; full suite and real1440/390/320 interactions/export harness pass. Baseline-passing tests remain coverage additions. Physical hardware, external editor interoperability and remote CI/live require separate review; parent owns publication.

## D06 — Stable note editing, bounded group movement and a short practice project (2026-10-13)

Context: recreating note nodes lost keyboard focus after one arrow edit; Escape/pointer cancellation committed a drag. Per-note boundary clipping could change intervals within a selected phrase. Options: individually clamp each note, refuse every boundary move, or clamp one shared time/pitch delta. Decision: the pure model computes one bounded integer delta for the group; app keeps grid/note focus, restores cancelled drags, preserves selection/track on rejected changes and avoids pushing unchanged projects into history. Inputs/composition and native button Space handling retain their own behavior. Decision: add a validated two-bar/two-track question/response project behind explicit replacement confirmation, with an optional four-step practice panel. Rationale: preserve a phrase and make exact timing, mixing and file portability easy to try. Affected: model/app/index/styles, model tests and browser verification tools. No schema, dependency, audio fidelity, export resolution, account or storage-boundary change. Review: focused consecutive keys, Escape, group boundary pointer move, exact 1/419 ticks, imported files, quota/180-second refusal, every existing export and desktop/mobile QA. Listening quality and external DAW compatibility remain NOT_RUN.

## D01 — local composition and bounded resources (2026-10-09)

Context: an independent, free creative tool must preserve existing WEB LAB records. Options: shared schema, backend storage, own local key. Decision: own bounded key, JSON files, eight tracks/4096 notes and a 180-second WAV limit. No API, ranking or shared-summary writes. Invalid autosave remains untouched pending explicit replacement. Rationale: no account costs or migration/data-loss risk. Files: model, app, audio, CSP. Review: actual browser quota failures and imports, not just static checks.

## D02 — exact playback versus readable engraving

Options: silently round all notes, claim arbitrary microtiming is standard notation, separate views. Decision: 960-tick performance timing for edit/audio/MIDI/MusicXML; explicitly labelled 1/16-grid printed SVG/PDF. VexFlow 4.2.5 and jsPDF 4.2.1 are pinned, locally bundled; PDF pages are rasterized at 300 dpi while SVG remains vector. Rationale: precise edits without misleading notation or remote font dependencies. Files: model, notation, vendor entry/build, UI. Review: measure actual file headers, bar durations and PDF page count.

## D03 — piano redistribution and audio lifecycle

Options: oscillator-only piano, giant raw bank, selected licensed MP3 samples. Decision: 15 same-origin Salamander samples redistributed by Tone.js, authored by Alexander Holm, CC BY 3.0. Keep source README and attribution; do not claim original 16 velocity layers or uncompressed fidelity. Other instruments are labelled synthesized. Use explicit actions, finite voices, look-ahead scheduling, generation cancellation and page-hide stop. Rationale: actual piano timbre with modest downloads and no tracking. Files: audio, assets/piano, assets/licenses, README. Review: sample decoding, cancellation and offline output waveform.

## D04 — local UI font

Reuse unmodified Pretendard Variable 1.3.9 (SIL OFL 1.1) with full license. No remote fonts. Retain native/system fallbacks for SVG title text. Files: assets/fonts, CSS. Review: downloads remain readable without a network font service.

## D05 — complete bundled notices

Bundle only VexFlow's Bravura/Custom entry, not unused Petaluma/Gonville/Leland fonts. Retain the Steinberg Bravura SIL OFL 1.1 notice and copyright alongside VexFlow's MIT. Generate a combined notice from every bundled dependency identified by esbuild's metafile; fail the build if a license is missing. Preserve upstream legal comments and generated template-string content rather than trimming JavaScript whitespace. Limit Git whitespace-check exceptions to the generated vendor and upstream piano README; authored sources remain checked. See [Git attributes](https://git-scm.com/docs/gitattributes#_checking_whitespace_errors). Rationale: provenance must include transitive runtime code, not just top-level packages. Files: vendor entry, build script, attributes, assets/licenses, README. Review: rebuild in CI before publishing committed local assets; do not download fonts at runtime.
## D08 — 2026-10-19: MUSIC ROOM and orchestral editing

- Context: user explicitly approved 16 tracks and redistributable real orchestra recordings; ease of use and instrument variety are mandatory. Previous eight-track/piano-only boundary is superseded by this approval.
- Options: keep synthetic presets; remote soundfont/CDN; bundle an entire multi-GB library; redistribute a compact licensed subset. Choose pinned VSCO CE CC0 recordings, prepared locally with provenance/hashes and lazy same-origin loading. No runtime CDN, accounts, fees or new dependencies.
- Decision: brand MUSIC ROOM · 작곡실; keep score-lab URL, version-1 projects and score-lab-project-v1. Preserve six legacy engines so old songs are not silently revoiced. Sixteen total tracks means 15 melodic plus one unpitched kit, reserving GM channel 10; timpani remains pitched. The UI explains the budget before adding tracks.
- Sound/resource policy: one dynamic layer, mono PCM16 at source rate, 5s sustain / 9s one-shot bounds, 180ms crossfade sustain loops, 128 MiB decoded cache, four downloads, 96 live voices. WAV keeps the existing 180s bound and full composition. Loop playback schedules on one audio clock, without the old restart gap. No claim of multi-layer commercial-sampler fidelity.
- UX: searchable instrument families and audition, original editable starter arrangements, larger piano roll, select/draw/erase tools, chord insertion, group velocity/quantization and readable durations. Pure musical operations stay outside DOM orchestration. Automatic save remains local; damaged bytes are not replaced without confirmation.
- Affected: architecture/requirements/README, instruments/sampler/editing/templates/model/audio/app/notation, HTML/CSS, sample assets/preparation tool, tests and WEB LAB metadata/preview.
- Review: test old project roundtrip, new instrument programs/channels, audio cancellation/loop boundary/loading errors, exports, keyboard/pointer cancellation and mobile layout. Physical MIDI devices, VST plug-ins and external DAW interoperability are out of scope, not verified.
