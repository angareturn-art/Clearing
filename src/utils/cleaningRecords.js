// 같은 세대(house_id)+층에 2차 청소(phase=2) 기록이 여러 번(재청소/재서명) 있을 때,
// 완료 여부·기성 계산 등 "현재 상태" 판단에는 가장 나중에 입력된(id가 가장 큰) 기록
// 하나만 사용하고, 그보다 앞서 발생한 기록은 참고 이력으로만 남긴다.
// 기록(이력)·캘린더처럼 "그날 실제로 있었던 일"을 그대로 보여줘야 하는 화면에는 적용하지 않는다.
// server/index.js의 keepLatestPhase2와 동일한 규칙을 유지한다.
export function keepLatestPhase2(rows) {
  const latestByKey = {};
  const passthrough = [];
  (rows || []).forEach(r => {
    if (r.phase !== 2 || r.house_id == null) { passthrough.push(r); return; }
    const key = `${r.house_id}_${r.floor}`;
    if (!latestByKey[key] || r.id > latestByKey[key].id) latestByKey[key] = r;
  });
  return [...passthrough, ...Object.values(latestByKey)];
}
