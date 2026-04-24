# Clearing 시스템 전체 기술 명세 및 설계 표준

이 문서는 "Clearing" 시스템의 아키텍처, 데이터 흐름, 시각적 가이드라인 및 개발 규칙에 대한 최상위 표준을 정의합니다.

---

## 1. 기술 스택 표준 (Tech Stack)
*   **Frontend**: React (Vite 기반), 전역 상태 관리 및 컴포넌트 기반 아키텍처.
*   **Styling**: Vanilla CSS + TailwindCSS 혼용 (Material Design 3 스타일 지향).
*   **Backend**: Node.js (Express), RESTful API 아키텍처.
*   **Database**: SQLite (`better-sqlite3`), 현장별 물리적/논리적 격리 지원.
*   **인증**: JWT (JSON Web Token) 기반 보안 세션 관리.

## 2. UI/UX 디자인 표준 (Design System)
*   **색상 체계 (Color Palette)**:
    - `Primary`: `#005CBB` (진파랑 - 신뢰, 박리제 완료)
    - `Success`: `#2E7D32` (초록 - 청소 완료, 안전)
    - `Error`: `#D32F2F` (빨강 - 미완료, 경고, 기성 기준선)
    - `Surface`: `#F8F9FA` (연회색 - 배경, 중립)
*   **타이포그래피**: 
    - 헤드라인: `font-headline` (Black/Bold) - 공정 상태 강조
    - 본문: `font-body` (Regular/Medium) - 기록 및 메모
*   **컴포넌트 일관성**: 모든 모달(Modal)은 `z-index: 200` 이상, 백드롭 블러(`backdrop-blur-sm`) 효과를 공통 적용한다.

## 3. 데이터 및 보안 표준 (Data & Security)
*   **다중 현장 격리 (Multi-Site Isolation)**:
    - 모든 API 요청은 헤더에 `X-Site-Id`를 포함해야 한다.
    - 데이터베이스의 모든 테이블은 `site_id` 컬럼을 가져야 하며, 쿼리 시 반드시 필터링한다.
*   **노무비 계산 로직**:
    - 기본 8시간을 1.0공수로 계산.
    - 가산 공수: 연장/야간 작업 시간에 따라 +0.1, +0.5, +1.0 적용.
*   **데이터 보존**: 모든 수정 작업 전 물리적 DB 백업(`construction_backup_날짜.db`)을 수행한다.

## 4. 개발 및 문서화 규칙
*   **승인 후 구현**: 모든 기능 변경은 사용자 승인 후 진행한다.
*   **타임스탬프 의무화**: 모든 `.md` 파일 수정 시 `[YYYY-MM-DD HH:mm]` 형식을 유지한다.
*   **변경 이력 관리**: 주요 사항은 `result_detail.md`에 누적 기록한다.

---
*Last Updated: [2026-04-24 19:14]*
