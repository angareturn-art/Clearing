# Clearing 현장 관리 시스템 통합 관리 계획 (Master Plan)

이 문서는 "Clearing" 아파트 현장 관리 시스템의 구조를 상세히 분석하고, 현재까지의 진행 상황 및 향후 계획을 통합하여 관리하는 마스터 플랜입니다.

---

## 1. 프로그램 개요 및 목적
본 시스템은 아파트 신축 현장에서 발생하는 **박리제칠(Oiling)** 및 **세대청소(Cleaning)** 공정의 진행 현황을 실시간으로 추적하고, 투입 인력의 노무비 계산 및 현장 관리 데이터를 디지털화하는 것을 목적으로 합니다. 
*(상세 규칙은 [전체 시스템 기술 명세서](file:///c:/Antigravity/TEst/Clearing/Specification_Clearing_System.md) 참조)*

## 2. 시스템 아키텍처 분석

### 데이터 안전 및 백업 프로토콜 (Safety First)
- **작업 전 GitHub 동기화**: 모든 코드 수정 전 현재 상태를 `commit & push`하여 작업 이력을 보존합니다.
- **DB 스냅샷 생성**: 테이블 스키마 변경 또는 대규모 마이그레이션 전 `construction_backup_[날짜].db` 형태의 백업 파일을 생성하여 데이터 유실을 방지합니다.
- **데이터 무결성 원칙**: 기존 데이터는 어떠한 경우에도 삭제되지 않으며, 마이그레이션 시 기존 데이터를 새로운 구조에 안전하게 이관(Mapping)하는 것을 원칙으로 합니다.

### 프론트엔드 (Frontend)
- **Framework**: React (Vite 기반)
- **Styling**: Vanilla CSS + Tailwind CSS
- **주요 컴포넌트**:
    - `App.jsx`: 애플리케이션 프레임워크, 인증 상태 관리, 전역 데이터 패칭.
    - `SiteSelector.jsx`: 로그인 후 접근할 프로젝트 현장을 선택하는 인터페이스.
    - `Dashboard.jsx`: 현장 KPI 및 진행률 시각화 (Infinity 오류 수정 완료).
    - `PersonnelManager.jsx`: 일자별 유효 단가가 적용된 노무 관리 시스템.
    - `MasterManager.jsx`: 현장 설정, 건물/세대 관리 및 사용자 관리 탭 포함.
    - **전체 화면 메뉴 상세 내역**: 각 화면의 동작 및 기초 데이터는 [상세 화면 메뉴 명세서](file:///c:/Antigravity/TEst/Clearing/Specification_UI_Menu_Detail.md)를 참조하여 재현한다.
    - `ElevationView.jsx` ([상세 설계 명세서](file:///c:/Antigravity/TEst/Clearing/Specification_ElevationView.md) 참조):
        *   **시각적 구조**: 그리드(Grid) 기반 수직 단면도. 왼쪽 층수(Y), 하단 호수(X) 배치.
        *   **색상 표준**: 박리제(진파랑), 청소진행(하늘색), 최종완료(초록색).
        *   **핵심 기능**: 🏗️ 갱폼 위치 표시, 🔴 기성 기준선, 갱폼-청소 연동(Lifting-2) 알림.
        *   **특이 사항**: 한국 건설 특성 반영 (1층 → B1 다이렉트 연결, 0층 없음).

### 백엔드 (Backend)
- **Runtime**: Node.js (Express)
- **Database**: SQLite (`better-sqlite3`)
- **Multi-Site Support**: 모든 쿼리에 `site_id` 필터링 적용.

---

## 3. 진행 상황 및 로드맵

- [x] **Phase 0: 데이터 안전 확보** (GitHub 백업 및 DB 스냅샷 자동화 규칙 수립)
- [x] **Phase 1: 대시보드 및 기초 오류 수정** (Infinity 오류 및 층수 표시 오류 해결)
- [x] **Phase 2: 임금 변동 이력 관리 시스템** (날짜별 유효 단가 기반 정산 구현)
- [x] **Phase 3: 관리자 보안 및 사용자 관리** (Admin 전용 가입 및 관리 인터페이스 구현)
- [x] **Phase 4: 다중 현장(Multi-Site) 아키텍처** (현장별 데이터 격리 및 선택 기능 구현)
- [ ] **Phase 5: 현장별 기성비 산출 고도화** (추가 정산 로직 및 보고서 출력)

---

## 4. 향후 작업 계획
- **현장별 통계 보고서**: 원청/하청 정보를 포함한 엑셀 출력 및 상세 분석 리포트.
- **모바일 최적화**: 현장 작업자를 위한 입력 인터페이스 간소화 및 모바일 웹 대응.
- **데이터 시각화**: 공정별 완료 추이 그래프 및 예상 종료일 산출 기능.

---
*Last Updated: [2026-04-24 19:03]*
