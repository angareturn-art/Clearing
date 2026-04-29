# Clearing 데이터베이스 엑셀 추출 구현 계획 (초보자용 가이드)

이 문서는 Clearing 시스템의 데이터베이스(`construction.db`)에 저장된 자료를 읽어와서 사용자가 다운로드할 수 있는 엑셀 파일(`.xlsx`)로 만드는 과정을 초보자도 쉽게 따라 할 수 있도록 상세히 설명하는 계획서입니다.

## 1. 개요 및 준비 단계

### 목표
서버에 저장된 데이터베이스의 특정 데이터(예: 노무 인원 기록)를 엑셀 파일로 변환하여 사용자가 버튼을 눌러 다운로드하게 만듭니다.

### 준비물 (라이브러리)
엑셀 파일을 만들기 위해 누군가 이미 만들어 둔 도구(라이브러리)를 가져다 써야 합니다.
Node.js(백엔드 서버)에서는 **`xlsx`** 라는 라이브러리가 가장 많이 쓰입니다.

**설치 방법:**
터미널(명령 프롬프트)을 열고, 백엔드 코드가 있는 `server` 폴더로 이동한 뒤 아래 명령어를 입력합니다.
```bash
cd server
npm install xlsx
```

---

## 2. 백엔드 (서버) 구현 단계

엑셀을 만들어주는 기능을 `server/index.js` 파일에 추가합니다.

### 1단계: 엑셀 라이브러리 불러오기
`index.js` 파일의 맨 위쪽에 아래 코드를 추가하여 엑셀 도구를 사용할 준비를 합니다.
```javascript
const xlsx = require('xlsx');
```

### 2단계: 엑셀 다운로드를 위한 주소(API) 만들기
사용자가 "엑셀 다운로드" 버튼을 눌렀을 때 실행될 주소를 만듭니다. 예를 들어 `/api/export/personnel` 이라는 주소를 만듭니다.

```javascript
app.get('/api/export/personnel', (req, res) => {
  try {
    // 3단계와 4단계의 코드가 여기에 들어갑니다.
  } catch (error) {
    console.error('엑셀 생성 실패:', error);
    res.status(500).send('엑셀 파일을 만드는 중 문제가 발생했습니다.');
  }
});
```

### 3단계: 데이터베이스에서 원하는 데이터 읽어오기
`better-sqlite3`를 사용하여 엑셀에 넣고 싶은 데이터를 꺼냅니다.

```javascript
// (위 API 코드 내부에 작성)
// 예시: personnel_records(인원 기록) 테이블에서 이름, 날짜, 근무시간 등을 가져옵니다.
const records = db.prepare(`
  SELECT name AS '이름', date AS '날짜', work_hours AS '기본근무시간', 
         ot_hours AS '연장근무시간', night_hours AS '야간근무시간'
  FROM personnel_records
  ORDER BY date DESC
`).all();
```
> **팁:** `AS '이름'` 처럼 사용하면 엑셀 파일의 첫 번째 줄(헤더)이 영어 대신 한글로 예쁘게 출력됩니다.

### 4단계: 데이터를 엑셀로 변환하고 응답으로 보내기
꺼내온 데이터를 엑셀 시트로 만들고 파일 형태로 응답합니다.

```javascript
// 1. 조회한 데이터(records)를 엑셀의 '시트(Sheet)' 형태로 변환
const worksheet = xlsx.utils.json_to_sheet(records);

// 2. 새로운 엑셀 작업장(Workbook, 엑셀 파일 전체) 만들기
const workbook = xlsx.utils.book_new();

// 3. 작업장에 방금 만든 시트를 '인원기록'이라는 이름으로 추가
xlsx.utils.book_append_sheet(workbook, worksheet, '인원기록');

// 4. 엑셀 파일을 컴퓨터가 인터넷으로 보낼 수 있는 파일 형태(Buffer)로 쓰기
const excelBuffer = xlsx.write(workbook, { bookType: 'xlsx', type: 'buffer' });

// 5. 브라우저가 이것을 파일로 인식하고 다운로드하도록 설정 (파일 이름 지정)
res.setHeader('Content-Disposition', 'attachment; filename="personnel_records.xlsx"');
res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

// 6. 완성된 엑셀 데이터를 전송!
res.send(excelBuffer);
```

---

## 3. 프론트엔드 (화면) 구현 단계

이제 사용자가 누를 수 있는 버튼을 화면(`src` 폴더 안의 React 파일)에 만듭니다.

```javascript
// 예: PersonnelManager.jsx 또는 Dashboard.jsx 등

const ExportButton = () => {
  const handleDownload = () => {
    // 백엔드 서버의 엑셀 다운로드 API 주소로 바로 연결
    // (브라우저가 파일 다운로드를 감지하고 창을 띄워줍니다)
    window.location.href = 'http://localhost:5000/api/export/personnel';
  };

  return (
    <button 
      onClick={handleDownload}
      style={{ padding: '10px 20px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '5px' }}
    >
      엑셀로 내보내기 다운로드
    </button>
  );
};
```

---

## 4. 진행 절차 요약

1. **`npm install xlsx`** 로 서버에 라이브러리 설치
2. **`index.js`** 에 데이터를 `SELECT` 해와서 `xlsx` 라이브러리로 엑셀 형식(`Buffer`)으로 바꾸는 API 작성
3. **프론트엔드** 에 해당 API 주소(`window.location.href`)를 연결하는 버튼 추가
4. **테스트**: 버튼을 클릭하여 엑셀 파일이 잘 받아지는지, 안의 내용과 한글 깨짐이 없는지 확인

이 계획에 따라 순서대로 복사 및 붙여넣기를 진행하며 코드를 적용하면, 데이터베이스의 어떤 자료든 쉽게 엑셀로 추출할 수 있게 됩니다.
