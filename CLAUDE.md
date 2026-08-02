# Clearing (세대청소 관리)

## 버전 / 변경이력 관리 (필수)

이 앱의 동작에 영향을 주는 커밋(기능 추가, 버그 수정, 화면 개편 등)은 **반드시** 아래 3가지를 함께 커밋해야 합니다. 하나라도 빠지면 버전 번호와 변경이력이 어긋나므로 예외 없이 지킬 것.

1. **`package.json`의 `version` 증가** (semver: 버그 수정 `patch`, 기능 추가 `minor`).
2. **`src/constants/changelog.js` 배열 맨 위에 새 항목 추가.**
   - `version`은 1번에서 올린 `package.json` 버전과 반드시 일치시킬 것.
   - `App.jsx`의 사이드바 브랜드 영역(데스크탑 사이드바 + 모바일 드로어 헤더, 2곳)이 이 파일의 `APP_VERSION`을 그대로 사용하므로 자동 반영됩니다.
3. **`npm run release:notes` 실행.**
   - `src/constants/changelog.js`를 읽어 `PATCH_NOTES.md`를 재생성합니다. `PATCH_NOTES.md`는 생성 산출물이므로 직접 편집하지 마세요.

즉 버전/변경이력에 관한 한 손으로 편집하는 파일은 `package.json`(버전 숫자)과 `src/constants/changelog.js`(변경 내용) 두 곳뿐입니다. `PATCH_NOTES.md`와 사이드바에 표시되는 버전은 모두 여기서 파생됩니다.

`scripts/gen-patchnotes.js`는 ESM(`import`/`export`)으로 작성되어 있습니다 — 이 프로젝트의 `package.json`이 `"type": "module"`이기 때문에 CommonJS(`require`)로 작성하면 동작하지 않습니다. `clearing-mobile`(별도 프로젝트, CommonJS)의 스크립트를 그대로 복사하지 마세요.

`clearing-mobile`도 동일한 방식(자체 `CLAUDE.md`, `src/constants/changelog.js`, `scripts/gen-patchnotes.js`)으로 버전을 관리합니다. 두 프로젝트는 서로 다른 저장소/버전 체계이므로 버전 번호를 맞출 필요는 없습니다.
