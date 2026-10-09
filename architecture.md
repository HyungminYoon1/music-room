# SCORE LAB architecture

Static GitHub Pages application. No backend, accounts, microphone, uploads or CDN. Editable composition data and rendering remain in the browser. Same-origin piano samples are fetched only following an explicit audio action. WEB LAB's shared storage is never read or written.

Layers: `model.js` owns validated musical data, history and MIDI/MusicXML encoding; `audio.js` owns native Web Audio voices, scheduling and WAV rendering; `notation.js` owns VexFlow engraving and PDF; `app.js` owns DOM interaction. Libraries are pinned and bundled into same-origin vendor modules. Build tooling is not required by visitors.

Performance data uses 960 ticks per quarter note. Printed notation explicitly quantizes to a sixteenth-note grid. Quantization never modifies the composition, MIDI or audio. MusicXML retains original tick durations, with separate voices for overlapping notes. Piano sample fidelity is that of the redistributed MP3 files, not the original multi-velocity raw bank.

Limits: 8 tracks, one drum track, 4096 notes, 64 bars, 40–240 BPM, piano pitches 21–108, 4/4, 3/4 or 6/8. Offline WAV exports are limited to 180 seconds including release tails. No silent truncation. One bounded composition is saved under `score-lab-project-v1`; malformed existing data is preserved until explicit replacement.

See docs/decisions.md. Changes to these boundaries require a documented decision.
