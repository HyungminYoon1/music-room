# MUSIC ROOM · 작곡실

오케스트라와 전자음을 편곡하는 브라우저 작곡실입니다. 기존 SCORE LAB의 저장소·사이트 주소·프로젝트 파일은 그대로 유지합니다. 악기를 찾아 미리 듣고, 피아노 롤에 음과 코드를 넣거나 네 가지 오리지널 편곡 예제를 고쳐 쓸 수 있습니다. 재생은 버튼을 눌러야 시작됩니다.

## 악기와 편집

- 30개 음색: 실제 녹음 25개 프리셋 + 기존 전자음 5개. 바이올린 솔로/앙상블·비올라·첼로·콘트라베이스·피치카토·하프, 플루트·피콜로·오보에·클라리넷·바순, 트럼펫·호른·트롬본·튜바, 팀파니·글로켄슈필·마림바·실로폰·튜블러 벨·오케스트라 타악기, 피아노·파이프 오르간을 제공합니다. 프리셋 수는 서로 다른 악기 종류 수와 같지 않습니다.
- 최대 16트랙: 선율 15 + 타악기 키트 1. GM 채널 10을 타악기에 예약합니다. 팀파니 등 유율 타악기는 선율 트랙입니다.
- 960 PPQ, 1틱 수치 편집. 음 그리기·영역 선택·이동·길이·세기 막대, 여러 음의 길이/세기/격자 일괄 편집, 코드 8종과 전위, 복사·붙여넣기·복제·실행 취소.
- 마디 구간 반복, 메트로놈, 트랙 음량·좌우·MUTE/SOLO, 전체 편곡 미리보기. 음역 맞춤으로 선택한 악기의 음표를 찾을 수 있습니다.
- 오케스트라·현악 사중주·6/8 실내악·전자음 편곡 예제와 두 마디 편집 연습. 예제를 열기 전 기존 곡 교체를 확인합니다.

VSCO Community Edition(CC0)의 녹음 180개를 24개 뱅크로 제공합니다. 필요한 음역만 같은 사이트에서 불러오며, 해독한 음원 캐시 128 MiB·동시 다운로드 4개로 제한합니다. 단일 세기 레이어, 원본 44.1/48 kHz를 유지한 모노 16-bit PCM이며 긴 음에는 교차 페이드 루프를 사용합니다. 상용 다중 세기/주법 라이브러리 전체를 제공하는 것은 아닙니다. [제작사](https://versilian-studios.com/vsco-community/) · [원본과 CC0](https://github.com/sgossner/VSCO-2-CE) · [파일별 출처·해시](dist/assets/orchestra/manifest.json).

피아노는 Alexander Holm의 Salamander Grand Piano MP3 샘플 15개이며, 기존 곡의 여섯 악기 ID와 엔진을 유지합니다. [피아노 출처와 CC BY 3.0](https://github.com/Tonejs/audio/tree/master/salamander). 편집 내용은 서버로 보내지 않으며 유료 서비스·계정·CDN·마이크 권한은 사용하지 않습니다.

## 저장과 내보내기

WAV: 48 kHz, 스테레오, 24-bit PCM, 꼬리 포함 180초 이내. MIDI type 1과 MusicXML은 원래 틱을 유지합니다. 화면·SVG·PDF 악보는 읽기 쉽게 16분음표 격자로 표시하며 원본 연주 데이터는 바꾸지 않습니다. PDF는 300 dpi A4, SVG는 벡터입니다. 저장 JSON은 다시 편집할 수 있습니다.

4,096음, 64마디, 음높이 A0–C8. 권장 악기 음역 밖은 가까운 샘플을 이조합니다. MIDI·MusicXML에는 모든 트랙을, WAV에는 MUTE/SOLO 결과를 기록합니다. 실시간 재생은 96동시음으로 제한하며 초과 시 오래된 음부터 종료합니다. WAV에는 모든 음을 렌더링합니다. MIDI 파일을 재생하는 프로그램의 음원에 따라 소리가 달라집니다. 표기 음높이는 이조 악기를 포함해 모두 실음입니다.

현재 곡은 `score-lab-project-v1`에 자동 저장됩니다. 기존 버전 1 JSON과 알 수 없는 추가 메타데이터를 보존하며, 손상된 저장은 사용자 확인 전 덮어쓰지 않습니다. 다른 앱 기록은 읽거나 변경하지 않습니다. 브라우저를 옮기려면 JSON 파일을 저장하세요. 프로젝트 import 2 MB / autosave 1.9 MB(UTF-8) 한도가 있습니다. MIDI는 내보내기를 지원하며, MIDI 가져오기·외부 MIDI 기기·VST·오디오 녹음은 제공하지 않습니다.

## 개발 및 검증

`npm ci`, `npm run build`, `npm test`, `npm run check`; `npm run serve -- 4193`.

음원 재생성은 `node tools/prepare-orchestra.mjs`로 합니다(네트워크와 GitHub CLI 필요). 공개 사이트나 일반 빌드에서는 실행하지 않습니다. 명시적인 소스 커밋·SFZ MIDI root 매핑·원본/가공 파일 해시를 고정합니다. 버전·샘플 선택을 바꿀 때에는 라이선스와 provenance를 다시 확인해야 합니다.

UI font: [Pretendard 1.3.9](https://github.com/orioncactus/pretendard), SIL OFL 1.1. Bravura engraving glyphs: Steinberg Media Technologies, SIL OFL 1.1, distributed via VexFlow. Full sample, bundled dependency and font licenses are distributed under assets/licenses and assets/fonts. Validation status: docs/verification.md.
