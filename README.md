# SCORE LAB · 작곡실

다중 트랙 피아노 롤에서 음을 만들고 길이·높이·세기를 편집합니다. 시작과 길이는 960 PPQ의 1틱 단위로 조절할 수 있습니다. 재생은 버튼을 눌러야 시작됩니다.

피아노는 Alexander Holm의 Salamander Grand Piano를 Tone.js 저장소에서 재배포한 MP3 샘플 15개를 사용합니다. 원본 16단계 세기 레이어 전체가 아닌 단일 샘플 뱅크이며 다른 악기는 합성음입니다. [출처와 CC BY 3.0](https://github.com/Tonejs/audio/tree/master/salamander), [원본 프로젝트](https://freepats.zenvoid.org/Piano/acoustic-grand-piano.html). 편집 내용은 서버로 보내지 않습니다.

WAV: 48 kHz, 스테레오, 24-bit PCM, 꼬리 포함 180초 이내. MIDI type 1과 MusicXML은 원래 틱을 유지합니다. 화면·SVG·PDF 악보는 읽기 쉽게 16분음표 격자로 표시하며 원본 연주 데이터는 바꾸지 않습니다. PDF는 300 dpi A4, SVG는 벡터입니다. 저장 JSON은 다시 편집할 수 있습니다.

8트랙, 4096음, 64마디. 음높이 A0–C8. 과거 프로젝트/다른 앱 기록을 읽지 않습니다. 자동저장은 현재 브라우저에만 있으며 파일 저장으로 보관하세요.

`npm ci`, `npm run build`, `npm test`, `npm run check`; `npm run serve -- 4193`.

UI font: [Pretendard 1.3.9](https://github.com/orioncactus/pretendard), SIL OFL 1.1. Bravura engraving glyphs: Steinberg Media Technologies, SIL OFL 1.1, distributed via VexFlow. Full sample, bundled dependency and font licenses are distributed under assets/licenses and assets/fonts. Validation status: docs/verification.md.
