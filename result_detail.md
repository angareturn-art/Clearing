# 상세 작업 이력 (Result Detail)

## [2026-05-11 22:13] Supabase 직접 연동(Direct Connect) 마이그레이션 실행 완료
*   **요청 사항**: 승인된 마이그레이션 계획에 따라 `Clearing_Supabase` 환경 구축 및 코드 교체 진행.
*   **해결 내용**:
    *   **프로젝트 복제 및 정제**: 기존 코드를 `Clearing_Supabase` 폴더로 복제하고 불필요해진 로컬 `server` 폴더(Express, SQLite)를 완전 삭제함.
    *   **Supabase 클라이언트 연동**: `@supabase/supabase-js` 설치 및 `.env`, `supabaseClient.js` 구성.
    *   **API Adapter 패턴 적용 (무수정 원칙 달성)**: 프론트엔드의 화면이나 상태 관리, `fetch` 코드를 단 한 줄도 수정하지 않기 위해 전역 `window.fetch` 인터셉터(`apiAdapter.js`)를 도입. 기존 `/api/` 요청을 가로채어 Supabase 클라우드로 직접 통신하도록 매핑 구현.

## [2026-05-11 21:35] Supabase 직접 연동(Direct Connect) 전환 계획 수립 및 AI 정합성 검토
*   **요청 사항**: 기존 `Clearing` 프로그램을 보존하고 새로운 버전을 만들어 프론트엔드가 Supabase를 직접 조회/저장하도록 설계.
*   **해결 내용**:
    *   **마이그레이션 계획서 수립**: 기존 백엔드 API 호출을 Supabase JS SDK 호출로 1:1 교체하는 방안 마련. (`Clearing_Supabase_Migration_Plan.md`)
    *   **정합성 및 호환성 리뷰 (AI Review)**: 데이터 통신 시 JSON 구조의 일치성, 인증 및 보안(RLS) 이슈, 오프라인 동작 한계 등을 분석하여 기존 UI/비즈니스 로직을 전혀 변경하지 않고도 적용 가능하다는 결론 도출. (`Clearing_Supabase_Review_Report.md`)

## [2026-05-11 05:44] SyncManager 동기화 고도화 및 데이터 정합성 문제 해결
*   **문제 요약**: `house_id` 불일치 및 외래 키(FK) 제약 조건으로 인해 원격 `houses` 삭제 불가 및 수정 사항 미반영.
*   **해결 내용**:
    *   **DB 마이그레이션**: `index.js`에 SQLite Trigger 로직 추가 (14개 모든 테이블에 `sync_flag` 추가 및 `deleted_logs` 테이블 생성).
    *   **백엔드 자동화**: 데이터 추가(INSERT), 수정(UPDATE) 시 `sync_flag = 'f'`로 자동 설정 및 삭제(DELETE) 시 `deleted_logs`에 자동 기록하도록 Trigger 설정.
    *   **동기화 스크립트 전면 개편**: `compare-and-sync.js`를 증분 동기화 방식으로 재작성. FK 제약 조건을 준수하여 삭제 시 자식 → 부모 순, 추가/수정 시 부모 → 자식 순으로 전송하도록 순서 고정 보장 로직 적용.
*   **관련 문서**:
    *   `plans/sync_improvement_plan.md`
    *   `results/sync_improvement_report.md`
