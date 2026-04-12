# The Blueprint Authority — 건설 현장 관리 시스템

아파트 건설 현장의 세대청소, 박리제칠, 갱폼 인양 등의 공정을 통합 관리하는 시스템입니다.

## 기술 스택
- **Frontend:** React (Vite) + Tailwind CSS + Material Symbols
- **Backend:** Node.js (Express) + Better-SQLite3
- **Design:** Material Design 3 기반 커스텀 디자인 시스템

## 주요 기능
| 모듈 | 기능 |
|------|------|
| 대시보드 | 실시간 날씨 정보, KPI, 동별 진행률 |
| 배치도 | 입면도 뷰 (청소/기름칠/인양 상태) |
| 캘린더 | 월간 작업 일정 및 날씨 이력 |
| 기록 관리 | 청소/박리제칠/갱폼인양 기록 CRUD |
| 비용 관리 | 비용 입력/카테고리별 분석 |
| 인원 관리 | 공수 기록, 멀티 선택, 개인별 통계 |
| 작업자 | 작업자 기준정보 등록/관리 |
| 비상 연락망 | SOS 버튼, 카테고리별 연락처 |
| 기준 정보 | 동/호수/층수 설정 |

## 실행 방법

```bash
# 1. 프론트엔드 의존성 설치
npm install

# 2. 백엔드 의존성 설치
cd server && npm install && cd ..

# 3. 백엔드 서버 실행 (포트 5000)
node server/index.js

# 4. 프론트엔드 개발 서버 (포트 5173)
npm run dev
```

## 프로젝트 구조
```
├── src/
│   ├── App.jsx              # 메인 앱 (라우팅/상태)
│   ├── components/
│   │   ├── Dashboard.jsx     # 대시보드
│   │   ├── ElevationView.jsx # 배치도(입면도)
│   │   ├── CalendarView.jsx  # 캘린더
│   │   ├── MasterManager.jsx # 기준정보 관리
│   │   ├── CostManager.jsx   # 비용 관리
│   │   ├── PersonnelManager.jsx # 인원 관리
│   │   ├── WorkerManager.jsx # 작업자 기준정보
│   │   ├── EmergencyContacts.jsx # 비상 연락망
│   │   └── LoginPage.jsx     # 로그인/회원가입
│   └── index.css             # Tailwind + 글로벌 스타일
├── server/
│   ├── index.js              # Express API 서버
│   └── package.json
├── tailwind.config.js
└── vite.config.js
```

## 라이선스
Private Project
