# 모바일 조회 앱(Supabase 연동) 개발 마스터 플랜 (UI/UX 최적화 버전)

기존 Clearing 시스템의 데이터를 동기화한 **Supabase(클라우드 DB)**를 핸드폰에서 직접 조회하는 모바일 앱 개발 계획입니다. 
특히 **야외 건설 현장에서의 핸드폰 사용성(색상 대비, 터치 크기)**을 최우선으로 고려하여 재검토된 기획안입니다.

---

## 1. 📱 모바일 특화 UI/UX 디자인 시스템 (색상 및 크기)

핸드폰 화면의 물리적 한계와 현장의 야외 환경(직사광선 등)을 극복하기 위한 디자인 기준입니다.

### 1.1 색상 (Color Palette) - 야외 시인성 극대화
*   **배경색 (Background)**: 눈부심이 덜한 연한 회색 바탕(`#F8FAFC`) 사용. 다크 모드 시 완전한 검정(`#000000`) 바탕 적용.
*   **상태 강조 색상 (Status Colors)**: 
    *   **완료 (Success)**: 아주 진하고 선명한 녹색 (`#16A34A`)
    *   **진행중 (Progress)**: 시선을 끄는 진한 파란색 (`#2563EB`)
    *   **주의/미완료 (Warning)**: 눈에 띄는 주황/빨강 (`#EA580C`, `#DC2626`)
*   **텍스트 (Text)**: 흐린 회색을 배제하고 가장 진한 검정/진회색(`#0F172A`)을 사용하여 가독성 확보.

### 1.2 크기 및 간격 (Sizes & Touch Targets) - 오터치 방지
*   **터치 영역 (Touch Targets)**: 모든 버튼 크기는 최소 **`48px × 48px`** 이상으로 강제.
*   **폰트 크기 (Typography)**: 
    *   **본문**: 최소 `16px` 이상.
    *   **제목**: `20px ~ 24px` 로 굵게(Bold) 처리.
*   **레이아웃 (Layout)**: 촘촘한 표(Table) 대신 큼직한 **카드(Card) 형태**의 리스트 뷰 적용.

---

## 2. 🤖 [AI 아키텍트] 인프라 및 환경 검토 (Review)

> **⚠️ 모바일 환경의 치명적 문제점**
> 1. **오프라인 (네트워크 단절)**: 건설 현장의 특성상 지하 주차장 등 인터넷 음영 구역 진입 시 앱이 멈추거나 하얀 화면(White Screen)이 뜨는 문제 발생.
> 2. **배터리 소모**: 잦은 DB 통신은 핸드폰 배터리 광탈의 주원인.

---

## 3. 수정된 아키텍처 적용 (Revised Plan)

### 3.1 오프라인-퍼스트 (Offline-First) 캐싱
*   핸드폰 내부 저장소(`AsyncStorage`)에 마지막 데이터를 저장해 둡니다.
*   인터넷이 끊긴 상황에서도 앱이 멈추지 않고 **내장된 기존 데이터를 즉시 표출**하며, 상단에 `인터넷 연결 끊김 (마지막 동기화: 10분 전)` 알림 표시.

### 3.2 페이지네이션 (무한 스크롤)
*   화면을 밑으로 내릴 때마다 10~20건씩 쪼개서 로딩(무한 스크롤)하여 통신량 및 배터리 소모 최소화.

---

## 4. 💡 추가 구성 제안 (Proposals)

### 제안 1. 다크 모드 (Dark Mode)
*   눈부심 방지 및 야외 시인성, 배터리 절약을 위한 완전한 검정색 배경의 다크모드 탑재.

### 제안 2. 스마트 푸시 알림 (Push Notification)
*   PC 웹에서 새로운 기록이 등록되면 현장 관리자의 폰으로 **"🔔 1동 3호 청소 1차 완료"** 푸시 알림 즉시 전송.

---

## 5. 🏗️ 구체적인 구현 방안 및 디렉토리 구조 (Implementation Details)

앱 개발을 위한 구체적인 기술 명세와 폴더 구성 가이드입니다.

### 5.1 앱 디렉토리 구조 설계 (Directory Structure)
프로젝트명: `clearing-mobile`
```text
clearing-mobile/
├── App.js                 # 앱 진입점 및 라우팅 (React Navigation)
├── src/
│   ├── assets/            # 로고, 이미지, 폰트 파일
│   ├── components/        # 재사용 가능한 UI 모듈 (버튼, 카드, 상태 뱃지 등)
│   ├── screens/           # 개별 화면
│   │   ├── LoginScreen.js      # Supabase Auth 기반 로그인
│   │   ├── DashboardScreen.js  # 대시보드 (금일 진행률)
│   │   ├── BuildingListScreen.js # 동/호수별 공정 조회 (드릴다운 UI)
│   │   ├── RecordFeedScreen.js   # 최근 작업 피드 (무한 스크롤)
│   │   └── SettingsScreen.js     # 다크모드 설정, 로그아웃
│   ├── navigation/        # 네비게이션 스택 및 탭 설정
│   ├── services/          # 백엔드 통신 로직
│   │   └── supabase.js    # Supabase 초기화 및 API 호출 함수
│   ├── store/             # 전역 상태 및 오프라인 캐시 관리
│   │   └── useStore.js    # Zustand 상태 관리 (AsyncStorage 연동)
│   └── utils/             # 날짜 포맷 변환 등 공통 유틸 함수
├── app.json               # Expo 앱 설정 파일 (앱 이름, 아이콘, 권한 지정)
├── babel.config.js        # NativeWind (Tailwind) 및 애니메이션 플러그인 설정
└── package.json           # 의존성 패키지 관리
```

### 5.2 핵심 모듈 상세 구현 방안

#### A. 프로젝트 초기화 및 라우팅 (Expo & React Navigation)
*   **초기화**: `npx create-expo-app clearing-mobile` 명령어로 가벼운 모바일 환경 구축.
*   **하단 탭 구조**: 화면 하단에 `[홈] - [배치조회] - [기록피드] - [설정]` 4개의 탭 바를 고정으로 띄워 한 손가락으로 즉시 화면 간 이동이 가능하게 구성.

#### B. 데이터 통신 및 보안 (`src/services/supabase.js`)
*   웹과 달리 브라우저 쿠키가 없으므로, `@supabase/supabase-js`와 `react-native-async-storage`를 결합하여 안전한 자동 로그인을 구현.
*   인증 키와 URL은 핸드폰 내부에 안전하게 암호화하여 저장 (`.env`).

#### C. 오프라인 로직 (`src/store/useStore.js`)
*   **Cache-First 전략**: 앱을 켜면 일단 핸드폰(`AsyncStorage`)에 저장된 '어제' 데이터를 0.1초 만에 화면에 띄웁니다.
*   **Background Sync**: 그 뒤로 몰래 Supabase에 최신 데이터를 요청하여 변경점이 있으면 화면을 부드럽게 갱신하고 다시 핸드폰에 덮어씁니다. (인터넷이 없으면 에러 없이 기존 화면 유지)

#### D. 스타일링 연동 (NativeWind)
*   웹 개발에서 사용했던 Tailwind 클래스(`bg-primary`, `text-lg`, `font-bold` 등)를 그대로 복사해서 앱에 붙여넣을 수 있는 `NativeWind` 라이브러리 세팅.
*   `className="bg-white dark:bg-slate-900"` 형태로 작성하여 다크 모드를 자동 지원.
