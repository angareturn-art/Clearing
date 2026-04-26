---
name: implementation-checklist
description: "Use when: implementing features, fixing bugs, or modifying code for the Clearing project"
applyTo: ["src/**", "server/**"]
---

# 구현 전 체크리스트 (Implementation Pre-Flight)

이 지침은 **모든 코드 수정 및 기능 구현**에 적용됩니다.

## 1. 구현 전 (Before Coding)

- [ ] **사용자 승인 확인**: 사전 계획/설계 제시 후 명시적 승인 받았는가?
- [ ] **백업 확인**:
  - [ ] GitHub 최신 커밋 상태 확인
  - [ ] DB 변경인 경우 `construction_backup_[YYYYMMDD].db` 생성 또는 존재 확인

---

## 2. 구현 중 (During Coding)

### 임포트 확인
- [ ] 모든 필요한 라이브러리 import 되었는가?
  - 예: `dayjs`, `axios`, `useState` 등
- [ ] 미사용 import가 없는가?

### 다중 현장(Multi-Site) 필수 검사
- [ ] API 요청에 `X-Site-Id` 헤더가 포함되었는가?
- [ ] DB 쿼리에 `site_id` 필터링이 적용되었는가?
- [ ] 새로운 테이블에 `site_id` 컬럼이 있는가?

### 데이터 무결성
- [ ] 기존 데이터 삭제 로직이 없는가?
- [ ] 마이그레이션이 필요한 경우 기존 데이터 이관 계획이 있는가?
- [ ] 필수 필드 검증이 포함되었는가?

### 코드 스타일
- [ ] 변수 명명이 일관성 있는가?
- [ ] 함수/컴포넌트 이름이 명확한가?
- [ ] 주석이 필요한 부분에 작성되었는가?

---

## 3. 구현 후 (After Coding)

### 최종 검증
- [ ] 전체 코드 문법 검토 완료
- [ ] 부수 효과(side effects) 없는가?
- [ ] 콘솔 에러/경고가 없는가?

### 문서화 업데이트
- [ ] `result_detail.md`에 변경 사항 기록 (`[YYYY-MM-DD HH:mm]` 타임스탬프 포함)?
- [ ] 필요시 `result.md`, `plan.md` 업데이트?
- [ ] 스펙 문서와 불일치는 없는가?

### Git 커밋
- [ ] `git add`, `commit`, `push` 완료?
- [ ] 커밋 메시지가 명확한가?

---

## 4. 특수 케이스 체크리스트

### 배치도(ElevationView) 수정 시
- [ ] 색상 표준 준수 (진파랑/하늘색/초록색)?
- [ ] 한국 층수 로직 (0층 없음, 1층↔B1)?
- [ ] 갱폼/기성선/청소 연동 로직 검증?

### 데이터베이스 스키마 변경 시
- [ ] 모든 기존 테이블에 `site_id` 필터 추가?
- [ ] 마이그레이션 스크립트 작성?
- [ ] `server/construction_backup_[YYYYMMDD].db` 생성?

### API 엔드포인트 추가 시
- [ ] `X-Site-Id` 헤더 검증 미들웨어 적용?
- [ ] 요청/응답 형식 JSON 스키마 정의?
- [ ] 오류 처리 로직 포함?

---

## 참고
이 체크리스트는 [gemini.md](../../gemini.md#6-자기-검증-및-누락-방지-중요)의 자기 검증 섹션을 기반으로 합니다.
