import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';

const API_BASE = '/api';

function MonthlyClosing({ siteId, token }) {
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'));
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (month && siteId) {
      fetchData();
    }
  }, [month, siteId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/closing/monthly?month=${month}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Site-Id': siteId
        }
      });
      if (res.ok) {
        const result = await res.json();
        setData(result);
      } else {
        console.error('Failed to fetch closing data');
      }
    } catch (err) {
      console.error('Error fetching closing data:', err);
    }
    setLoading(false);
  };

  const handleExport = async () => {
    if (!month) return;
    try {
      const res = await fetch(`${API_BASE}/export/closing?month=${month}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Site-Id': siteId
        }
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `월별마감_${month}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } else {
        alert('엑셀 내보내기에 실패했습니다.');
      }
    } catch (err) {
      console.error('Export error:', err);
      alert('다운로드 중 오류가 발생했습니다.');
    }
  };

  const daysInMonth = dayjs(month).isValid() ? dayjs(month).daysInMonth() : 31;
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="bg-white p-6 rounded-lg shadow min-h-[500px]">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800">월별 마감 (공수 통합조회)</h2>
        <div className="flex items-center space-x-4">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded shadow transition-colors"
          >
            엑셀 내보내기 (.xlsx)
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-10">데이터를 불러오는 중입니다...</div>
      ) : data.length === 0 ? (
        <div className="text-center text-gray-500 py-10 bg-gray-50 rounded">해당 월에 등록된 작업 내역이 없습니다.</div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-100 text-gray-700 sticky top-0">
              <tr>
                <th className="px-3 py-3 font-semibold whitespace-nowrap bg-gray-100 sticky left-0 z-10 border-b border-r">작업자 이름</th>
                {daysArray.map(day => (
                  <th key={day} className="px-2 py-3 font-semibold text-center border-b border-r min-w-[40px]">{day}</th>
                ))}
                <th className="px-3 py-3 font-semibold text-center border-b border-l border-r bg-blue-50 whitespace-nowrap">총 공수</th>
                <th className="px-3 py-3 font-semibold text-right border-b border-r bg-blue-50 whitespace-nowrap">적용 단가</th>
                <th className="px-3 py-3 font-semibold text-right border-b bg-blue-50 whitespace-nowrap">총 노무비</th>
              </tr>
            </thead>
            <tbody>
              {data.map((worker, idx) => (
                <tr key={worker.name + idx} className="border-b hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium bg-white sticky left-0 z-10 border-r">{worker.name}</td>
                  {daysArray.map(day => {
                    const md = worker.daily[day];
                    return (
                      <td key={day} className="px-2 py-2 text-center border-r text-gray-600">
                        {md ? Number(md.toFixed(3)) : ''}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-center font-bold text-blue-700 border-l border-r bg-blue-50/30">
                    {Number(worker.total_md.toFixed(3))}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-700 border-r bg-blue-50/30">
                    {worker.unit_price.toLocaleString()}원
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-gray-900 bg-blue-50/30">
                    {worker.total_amount.toLocaleString()}원
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-200 font-bold sticky bottom-0">
              <tr>
                <td className="px-3 py-3 sticky left-0 bg-gray-200 border-r z-10 text-center">합계</td>
                {daysArray.map(day => (
                  <td key={day} className="px-2 py-3 text-center border-r border-gray-300">
                    {Number(data.reduce((sum, w) => sum + (w.daily[day] || 0), 0).toFixed(3)) || ''}
                  </td>
                ))}
                <td className="px-3 py-3 text-center border-l border-r border-gray-300">
                  {Number(data.reduce((sum, w) => sum + w.total_md, 0).toFixed(3))}
                </td>
                <td className="px-3 py-3 border-r border-gray-300"></td>
                <td className="px-3 py-3 text-right">
                  {data.reduce((sum, w) => sum + w.total_amount, 0).toLocaleString()}원
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <div className="mt-4 text-sm text-gray-500 bg-yellow-50 p-3 rounded border border-yellow-200">
        <strong>💡 공수(Man-days) 산정 기준 (현장 실무 적용):</strong>
        기본 공수(근무 시간 / 8.0) + 추가 공수(OT 및 야간 합산: 1시간 이상 +0.1 / 2시간 이상 +0.5 / 4시간 이상 +1.0)
        <br/>
        예시: 하루 10시간 근무 (기본 8 + OT 2) = 1.0 + 0.5 = 1.5 공수
      </div>
    </div>
  );
}

export default MonthlyClosing;
