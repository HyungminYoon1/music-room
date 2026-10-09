# Decisions

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
