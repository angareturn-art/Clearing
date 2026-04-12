import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';

const API_URL = 'http://localhost:5000/api';

const CostManager = () => {
  const [costs, setCosts] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(dayjs().format('YYYY-MM'));
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({
    date: dayjs().format('YYYY-MM-DD'),
    description: '',
    vendor: '',
    amount: '',
    notes: '',
    category: 'general'
  });
  const [sortField, setSortField] = useState('date');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    fetchCosts();
  }, [currentMonth]);

  const fetchCosts = async () => {
    const res = await fetch(`${API_URL}/costs?month=${currentMonth}`);
    const data = await res.json();
    setCosts(data || []);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...form, amount: parseInt(form.amount) || 0 };
    if (editId) {
      await fetch(`${API_URL}/costs/${editId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      await fetch(`${API_URL}/costs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }
    setShowForm(false);
    setEditId(null);
    setForm({ date: dayjs().format('YYYY-MM-DD'), description: '', vendor: '', amount: '', notes: '', category: 'general' });
    fetchCosts();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('삭제하시겠습니까?')) return;
    await fetch(`${API_URL}/costs/${id}`, { method: 'DELETE' });
    fetchCosts();
  };

  const handleEdit = (c) => {
    setForm({ date: c.date, description: c.description, vendor: c.vendor, amount: c.amount.toString(), notes: c.notes || '', category: c.category || 'general' });
    setEditId(c.id);
    setShowForm(true);
  };

  const totalAmount = costs.reduce((a, c) => a + (c.amount || 0), 0);
  
  const sorted = [...costs].sort((a, b) => {
    let va = a[sortField], vb = b[sortField];
    if (sortField === 'amount') { va = parseInt(va); vb = parseInt(vb); }
    if (sortDir === 'asc') return va > vb ? 1 : -1;
    return va < vb ? 1 : -1;
  });

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  // 카테고리별 합계 (차트용)
  const categoryTotals = costs.reduce((acc, c) => {
    acc[c.category || 'general'] = (acc[c.category || 'general'] || 0) + c.amount;
    return acc;
  }, {});
  const catLabels = { general: '일반', material: '자재', equipment: '장비', labor: '노무비', other: '기타' };
  const maxCat = Math.max(...Object.values(categoryTotals), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-black text-primary tracking-tight font-headline">비용 관리</h2>
          <p className="text-on-surface-variant font-body mt-1">경비 내역 기록 및 분석</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditId(null); setForm({ date: dayjs().format('YYYY-MM-DD'), description: '', vendor: '', amount: '', notes: '', category: 'general' }); }} className="flex items-center gap-2 bg-gradient-to-br from-primary to-primary-container text-white px-5 py-2.5 rounded font-label font-bold text-xs uppercase tracking-widest shadow-lg hover:shadow-primary/20 transition-all">
          <span className="material-symbols-outlined text-sm">add</span> 비용 추가
        </button>
      </div>

      {/* 월 선택 + 합계 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 bg-surface-container-lowest rounded-lg p-5 shadow-sm border border-outline-variant/20 flex items-center gap-4">
          <button onClick={() => setCurrentMonth(dayjs(currentMonth).subtract(1,'month').format('YYYY-MM'))} className="p-2 hover:bg-surface-container rounded transition-colors">
            <span className="material-symbols-outlined text-primary">chevron_left</span>
          </button>
          <div className="flex-1 text-center">
            <p className="font-headline font-black text-2xl text-primary">{dayjs(currentMonth).format('YYYY년 MM월')}</p>
            <p className="font-label text-[10px] text-outline uppercase tracking-widest mt-1">{costs.length}건 지출</p>
          </div>
          <button onClick={() => setCurrentMonth(dayjs(currentMonth).add(1,'month').format('YYYY-MM'))} className="p-2 hover:bg-surface-container rounded transition-colors">
            <span className="material-symbols-outlined text-primary">chevron_right</span>
          </button>
        </div>
        <div className="bg-gradient-to-br from-primary to-primary-container text-white rounded-lg p-5 shadow-lg">
          <p className="font-label text-[10px] uppercase tracking-widest opacity-70">이번 달 총 지출</p>
          <p className="text-3xl font-black font-headline mt-2">₩{totalAmount.toLocaleString()}</p>
        </div>
      </div>

      {/* 카테고리 차트 */}
      {Object.keys(categoryTotals).length > 0 && (
        <div className="bg-surface-container-lowest rounded-lg p-6 shadow-sm border border-outline-variant/20">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-secondary">pie_chart</span>
            <h3 className="font-label text-sm font-bold uppercase tracking-widest text-secondary">카테고리 분석</h3>
          </div>
          <div className="space-y-3">
            {Object.entries(categoryTotals).map(([cat, amt]) => (
              <div key={cat}>
                <div className="flex justify-between mb-1">
                  <span className="font-label text-xs font-bold text-on-surface">{catLabels[cat] || cat}</span>
                  <span className="font-label text-xs text-outline">₩{amt.toLocaleString()}</span>
                </div>
                <div className="h-2 bg-surface-container rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${(amt / totalAmount) * 100}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 테이블 */}
      <div className="bg-surface-container-lowest rounded-lg shadow-sm overflow-x-auto border border-outline-variant/20">
        <table className="w-full text-left">
          <thead className="bg-surface-dim/20">
            <tr>
              {[
                { label: '날짜', field: 'date' },
                { label: '내용', field: 'description' },
                { label: '구매처', field: 'vendor' },
                { label: '금액', field: 'amount' },
              ].map(col => (
                <th key={col.field} className="py-4 px-4 font-label text-[10px] uppercase tracking-widest text-outline cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort(col.field)}>
                  <div className="flex items-center gap-1">
                    {col.label}
                    <span className="material-symbols-outlined text-xs">{sortField === col.field ? (sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}</span>
                  </div>
                </th>
              ))}
              <th className="py-4 px-4 font-label text-[10px] uppercase tracking-widest text-outline">비고</th>
              <th className="py-4 px-4 font-label text-[10px] uppercase tracking-widest text-outline text-right">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-variant/50">
            {sorted.map(c => (
              <tr key={c.id} className="hover:bg-surface-container-low transition-colors">
                <td className="py-3 px-4 font-label text-sm text-on-surface">{c.date}</td>
                <td className="py-3 px-4 font-body text-sm">
                  <div>{c.description}</div>
                  <div className="text-[10px] text-outline uppercase tracking-wider">{catLabels[c.category] || c.category}</div>
                </td>
                <td className="py-3 px-4 font-body text-sm text-on-surface-variant">{c.vendor}</td>
                <td className="py-3 px-4 font-label font-bold text-primary">₩{(c.amount||0).toLocaleString()}</td>
                <td className="py-3 px-4 font-body text-sm text-on-surface-variant text-xs">{c.notes}</td>
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center gap-2 justify-end">
                    <span className="material-symbols-outlined text-outline cursor-pointer hover:text-primary transition-colors text-sm" onClick={() => handleEdit(c)}>edit</span>
                    <span className="material-symbols-outlined text-outline cursor-pointer hover:text-error transition-colors text-sm" onClick={() => handleDelete(c.id)}>delete</span>
                  </div>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr><td colSpan="6" className="py-12 text-center text-outline font-body">이번 달 비용 내역이 없습니다.</td></tr>
            )}
          </tbody>
          {sorted.length > 0 && (
            <tfoot className="bg-surface-container/50">
              <tr>
                <td colSpan="3" className="py-3 px-4 font-label font-bold text-outline text-sm uppercase tracking-widest">합계</td>
                <td className="py-3 px-4 font-headline font-black text-primary text-lg">₩{totalAmount.toLocaleString()}</td>
                <td colSpan="2"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* 입력 모달 */}
      {showForm && (
        <div className="fixed inset-0 bg-surface-variant/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest w-full max-w-lg p-8 shadow-xl rounded-lg relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-secondary-container"></div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-label text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                <span className="material-symbols-outlined">payments</span>
                {editId ? '비용 수정' : '비용 추가'}
              </h3>
              <button onClick={() => { setShowForm(false); setEditId(null); }}>
                <span className="material-symbols-outlined text-outline hover:text-on-surface">close</span>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">날짜</label>
                  <input required type="date" className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-primary transition-all text-on-surface font-bold py-2" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                </div>
                <div>
                  <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">카테고리</label>
                  <select className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-primary transition-all text-on-surface font-bold py-2" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                    <option value="general">일반</option>
                    <option value="material">자재</option>
                    <option value="equipment">장비</option>
                    <option value="labor">노무비</option>
                    <option value="other">기타</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">내용</label>
                <input required type="text" className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-primary transition-all text-on-surface font-bold py-2" placeholder="예: 박리제용 분무기 구매" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">구매처</label>
                  <input type="text" className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-primary transition-all text-on-surface font-bold py-2" placeholder="예: 만우리철물" value={form.vendor} onChange={e => setForm({...form, vendor: e.target.value})} />
                </div>
                <div>
                  <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">금액 (원)</label>
                  <input required type="number" className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-primary transition-all text-on-surface font-bold py-2" placeholder="220000" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">비고</label>
                <textarea rows="2" className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-primary transition-all text-on-surface font-body py-2" placeholder="메모..." value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
              </div>
              <div className="pt-2 flex justify-end">
                <button type="submit" className="bg-gradient-to-br from-primary to-primary-container text-white px-8 py-3 rounded font-label font-bold text-sm uppercase tracking-widest shadow-lg hover:shadow-primary/20 transition-all flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">save</span> 저장하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CostManager;
