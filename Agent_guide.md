# Clearing Project - AI Agent Guide (행동 지침)

이 문서는 Clearing 프로젝트를 담당하는 모든 AI 에이전트가 준수해야 할 핵심 행동 지침과 작업 워크플로우를 정의합니다. 새로운 기능을 추가하거나 기존 코드를 수정할 때 반드시 이 가이드를 읽고 따릅니다.

---

## 1. 워크플로우 및 문서화 규칙

### 1.1 계획 및 결과 폴더 강제화 (MANDATORY)
- 모든 프로그램 및 서브 프로젝트 개발 시, 반드시 루트 디렉토리에 `plans/`와 `results/` 폴더를 생성합니다.
- **`plans/`**: 작업 시작 전 작성하는 모든 계획서 및 설계 문서 (`implementation_plan.md`, `SPEC.md` 등)를 보관합니다.
- **`results/`**: 작업 완료 후의 결과 보고서, 테스트 로그, `result.md`, `walkthrough.md` 등을 보관합니다.

### 1.2 계획 우선 원칙 (Planning First)
- 모든 작업 시작 전 반드시 `plans/` 폴더에 버전별 계획서(예: `plan_v1_...md`)를 작성합니다.
- 복잡한 변경사항의 경우 `implementation_plan.md` 아티팩트를 업데이트하여 사용자 승인을 받습니다.

### 1.3 작업 추적 및 결과 보고
- **`task.md`**: 작업 진행 상황을 실시간으로 업데이트합니다 (`[ ]`, `[/]`, `[x]`).
- 작업 완료 후 최종 결과물은 반드시 `results/` 폴더 내에 저장하여 이력을 관리합니다.

---

## 2. 데이터 보존 및 안정성 규칙 (CRITICAL)

### 2.1 작업 전 백업 절차
중요한 코드 수정이나 DB 스키마 변경을 시작하기 전, 다음 두 가지를 반드시 수행합니다.
1. **GitHub 동기화**: `git add .`, `git commit -m "..."`, `git push`를 통해 현재 상태를 안전하게 원격 저장소에 업로드합니다.
2. **물리적 DB 백업**: `server/construction.db` 파일을 `server/construction_backup_YYYYMMDD.db` 형식으로 복사하여 백업본을 생성합니다.

### 2.2 데이터 무결성
- 기존 DB의 데이터가 삭제되거나 유실되지 않도록 마이그레이션 시 데이터 이관 계획을 우선 수립합니다.

---

## 3. 기술 스택 및 개발 원칙

### 3.1 기술 스택
- **Frontend**: React (Vite), Vanilla CSS (Rich Aesthetics 우선), Material Symbols (Icon).
- **Backend**: Node.js (Express), SQLite (`better-sqlite3`).

### 3.2 핵심 로직 및 기준
- **기준층 관리**: 모든 기준층(박리제/청소) 정보는 소스 코드에 하드코딩하지 않고 **데이터베이스(`buildings` 테이블)**에서 참조합니다.
- **인건비 계산**: 작업자 등록 시 단가 기록이 자동으로 `worker_wage_history`에 저장되도록 하여 일관성을 유지합니다.

---

## 4. 커뮤니케이션 스타일

- **언어**: 모든 응답과 주석은 **한국어**를 원칙으로 합니다.
- **전문성**: 직접적이고 전문적인 언어를 사용하며, 불필요한 서술은 생략하고 핵심 논리 위주로 설명합니다.

---

## 5. 주요 파일 구조
- `/plans`: 버전별 상세 구현 계획서
- `/server/index.js`: 백엔드 메인 로직 및 API
- `/src/App.jsx`: 프론트엔드 메인 엔트리 및 탭 관리
- `/src/components`: 기능별 컴포넌트 (MonthlyAnalysis, RevenueProjection 등)

---
*최종 업데이트: 2026-05-01 | Antigravity AI*
