# MUSIC ROOM · 작곡실

오케스트라와 전자음을 편곡하는 브라우저 작곡실입니다. [MUSIC ROOM 실행](https://hyungminyoon1.github.io/music-room/). 기존 SCORE LAB의 프로젝트와 같은 브라우저에 저장한 곡은 그대로 읽습니다. 악기를 찾아 미리 듣고, 피아노 롤에 음과 코드를 넣거나 MIDI 파일을 가져와 편집할 수 있습니다. 재생은 버튼을 눌러야 시작됩니다.

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

4,096음, 음높이 A0–C8. 기존 곡은 64마디, MIDI에서 가져온 버전 2 곡은 512마디까지 편집합니다. 권장 악기 음역 밖은 가까운 샘플을 이조합니다. MIDI·MusicXML에는 모든 트랙을, WAV에는 MUTE/SOLO 결과를 기록합니다. 실시간 재생은 96동시음으로 제한하며 초과 시 오래된 음부터 종료합니다. WAV에는 모든 음을 렌더링합니다. MIDI 파일을 재생하는 프로그램의 음원에 따라 소리가 달라집니다. 표기 음높이는 이조 악기를 포함해 모두 실음입니다.

현재 곡은 기존 키 `score-lab-project-v1`에 자동 저장됩니다. 사이트 주소가 바뀌어도 동일한 GitHub Pages 출처이므로 같은 브라우저의 곡을 유지합니다. 기존 버전 1 JSON과 알 수 없는 추가 메타데이터를 보존하며, 손상된 저장은 사용자 확인 전 덮어쓰지 않습니다. 다른 앱 기록은 읽거나 변경하지 않습니다. 브라우저를 옮기려면 JSON 파일을 저장하세요. 프로젝트 import 2 MB / autosave 1.9 MB(UTF-8) 한도가 있습니다. 외부 MIDI 기기·VST·오디오 녹음은 제공하지 않습니다.

## MIDI 가져오기

1. 상단 **MIDI 가져오기**에서 `.mid` 또는 `.midi` 파일을 선택합니다. 표준 MIDI 0/1·PPQ 방식, 파일 2MB·원본 256트랙까지 읽습니다.
2. 트랙 이름·GM 번호·대체 음색·음표 수를 확인하고 가져올 파트를 선택합니다. 원본 한 트랙에 여러 채널이 있으면 나눠 표시합니다. 최대 선율 15 + 타악기 1트랙, 합계 4,096음이며 한도를 넘으면 가져오기 버튼이 비활성화됩니다. 지휘 트랙의 템포·박자는 선택과 별도로 포함합니다.
3. **선택한 트랙 가져오기**를 눌러 현재 곡 교체를 확인합니다. 미리보기나 취소만으로 기존 곡이 바뀌지 않습니다. 원본 파일은 변경하지 않습니다.
4. 음표·악기를 고친 뒤 하단 **MIDI**로 저장합니다. 시간 지도에서 곡 중간 템포·박자 변화를 볼 수 있고 재생·WAV·MIDI에 적용됩니다. 상단 BPM·박자 변경은 시작 값만 바꿉니다. 다른 중간 변화의 위치와 값은 보존됩니다.

MIDI 해상도는 960 PPQ로 변환하며 필요한 1틱 반올림을 알립니다. 박자 변경이 마디 중간이면 짧은 마디로 표시하고 음표의 절대 위치는 유지합니다. 원본의 GM 프로그램 변화는 보존하며, 악기를 직접 바꾸면 해당 트랙의 악기 변경·뱅크 선택을 새 악기로 대체합니다. 앱에 없는 악기는 가까운 음색으로 재생하되 변경 전까지 원래 프로그램 번호를 MIDI에 보존합니다.

템포는 4분음표 기준 4–1000 BPM을 지원합니다. 지나치게 짧은 반복으로 브라우저가 멈추지 않도록 50ms 미만 반복 구간은 거절합니다. 밀집된 연주는 실시간 예약·동시음을 최대 96개로 제한하며, WAV는 전체 음을 포함합니다.

페달·컨트롤 자동화·피치 벤드는 MIDI 재저장에 보존하지만 브라우저 재생에는 적용하지 않습니다. 가사·마커·조표·SysEx·애프터터치는 보존하지 않으며 가져오기 전에 알립니다. SMPTE 시간 코드와 MIDI 형식 2, 지원 음역 밖의 트랙은 자동 변환·음표 삭제 없이 거절합니다. 화면/SVG/PDF 악보는 128쪽 및 16분음표 마디 경계 한도가 있으며, 그 밖의 정확한 타이밍은 MusicXML/MIDI로 저장하세요. [MIDI Association의 SMF 설명](https://midi.org/standard-midi-files).

저장소 이름을 `score-lab`에서 `music-room`으로 변경했습니다. 기존 GitHub 저장소 링크는 새 저장소로 연결되지만 옛 Pages 주소의 자동 이동은 지원되지 않습니다. WEB LAB은 새 주소를 사용합니다. [GitHub 저장소 이름 변경 안내](https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository).

## 개발 및 검증

`npm ci`, `npm run build`, `npm test`, `npm run check`; `npm run serve -- 4193`.

음원 재생성은 `node tools/prepare-orchestra.mjs`로 합니다(네트워크와 GitHub CLI 필요). 공개 사이트나 일반 빌드에서는 실행하지 않습니다. 명시적인 소스 커밋·SFZ MIDI root 매핑·원본/가공 파일 해시를 고정합니다. 버전·샘플 선택을 바꿀 때에는 라이선스와 provenance를 다시 확인해야 합니다.

UI font: [Pretendard 1.3.9](https://github.com/orioncactus/pretendard), SIL OFL 1.1. Bravura engraving glyphs: Steinberg Media Technologies, SIL OFL 1.1, distributed via VexFlow. Full sample, bundled dependency and font licenses are distributed under assets/licenses and assets/fonts. Validation status: docs/verification.md.
