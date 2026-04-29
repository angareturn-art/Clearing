# Specification: Cloud Synchronization Manager (SyncManager)

## 1. 시스템 개요 (Overview)
기존 CLI(Command Line Interface) 기반으로 실행되던 Supabase 동기화 스크립트(`compare-and-sync.js`)를 웹 GUI(Clearing 프론트엔드)에 통합하여, 관리자가 원클릭으로 데이터를 동기화하고 결과를 시각적으로 확인할 수 있게 하는 기능.

---

## 2. 프론트엔드 설계 (Frontend: `SyncManager.jsx`)

### 2.1 UI 구성
*   **권한 제어**: `currentUser.role === 'admin'` 인 경우에만 접근 가능 (일반 작업자는 탭 미노출).
*   **상태 정보 (State)**:
    *   `isSyncing (boolean)`: 동기화 진행 중 상태 (버튼 비활성화 및 스피너 표시).
    *   `syncResult (array)`: 백엔드에서 전달받은 파싱된 결과 객체 배열.
    *   `lastSynced (string)`: 마지막 동기화 성공 시간.
    *   `error (string)`: 에러 발생 시 출력할 메시지.
*   **컴포넌트 렌더링**:
    1.  상단: 큰 "클라우드 동기화 시작" 버튼 (아이콘 포함).
    2.  로딩 중: 스켈레톤 UI 또는 로딩 스피너 출력.
    3.  완료 시: 결과를 표(Table)로 렌더링 (테이블명, 로컬 수량, 원격 수량, 상태). `상태` 컬럼의 '⚠️ 누락' 등 특정 키워드에 따라 색상(Red/Green) 강조 적용.

### 2.2 API 호출
*   `POST /api/sync/run` 호출 시, HTTP 타임아웃을 넉넉히 주어 백그라운드 동기화가 완료될 때까지 대기.
*   **헤더**: `Authorization: Bearer <token>` 필수 포함.

---

## 3. 백엔드 설계 (Backend: `server/index.js`)

### 3.1 API Endpoint (`POST /api/sync/run`)
*   **권한 미들웨어 (`authMiddleware`)**: JWT 토큰 검증.
*   **권한 체크**: `req.user.role === 'admin'` 확인.
*   **프로세스 실행**:
    *   `require('child_process').exec` 또는 `spawn` 활용.
    *   실행 명령: `node compare-and-sync.js`
    *   작업 디렉토리(CWD): 백엔드 기준 상대 경로가 아닌 `path.join(__dirname, '../../clearing-supabase-migration')`를 사용하여 절대 경로로 지정.

### 3.2 데이터 파싱 로직 (Data Parsing)
*   `compare-and-sync.js`는 `| 테이블명 | 로컬 | 원격 | 상태 |` 형태의 Markdown 표를 콘솔에 출력함.
*   표준 출력(stdout) 문자열을 줄바꿈(`\n`)으로 나누어, 파이프(`|`)로 구분된 행만 정규식으로 추출.
*   추출된 데이터를 JSON 배열 구조로 변환하여 프론트엔드에 응답(`res.json`).
    ```json
    [
      { "table": "users", "local": 3, "remote": 3, "status": "✅ 일치" },
      ...
    ]
    ```

---

## 4. 제약 사항 및 고려 대상 (Constraints)
*   네트워크 지연이나 데이터 양에 따라 `compare-and-sync.js` 실행 시간이 10초 이상 길어질 수 있음.
*   동기화 중 다른 사용자가 데이터를 조작할 때 발생할 수 있는 SQLite Lock 대비 필요.
