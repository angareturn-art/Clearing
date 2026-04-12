import React, { useState, useEffect } from 'react';

const API_URL = 'http://localhost:5000/api';

const EmergencyContacts = () => {
  const [contacts, setContacts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ category: '현장 관리', name: '', phone: '', role: '' });
  const [showSOS, setShowSOS] = useState(false);

  useEffect(() => { fetchContacts(); }, []);

  const fetchContacts = async () => {
    const res = await fetch(`${API_URL}/emergency`);
    const data = await res.json();
    setContacts(data || []);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await fetch(`${API_URL}/emergency`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    setShowForm(false);
    setForm({ category: '현장 관리', name: '', phone: '', role: '' });
    fetchContacts();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('삭제하시겠습니까?')) return;
    await fetch(`${API_URL}/emergency/${id}`, { method: 'DELETE' });
    fetchContacts();
  };

  const grouped = contacts.reduce((acc, c) => {
    if (!acc[c.category]) acc[c.category] = [];
    acc[c.category].push(c);
    return acc;
  }, {});

  const catColors = {
    '현장 관리': 'text-primary bg-primary/10',
    '안전': 'text-warning bg-warning/10',
    '소방': 'text-error bg-error/10',
    '경찰': 'text-secondary bg-secondary/10',
  };

  const catIcons = {
    '현장 관리': 'engineering',
    '안전': 'health_and_safety',
    '소방': 'local_fire_department',
    '경찰': 'local_police',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-black text-primary tracking-tight font-headline">비상 연락망</h2>
          <p className="text-on-surface-variant font-body mt-1">긴급 상황 대응 연락처</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-gradient-to-br from-primary to-primary-container text-white px-5 py-2.5 rounded font-label font-bold text-xs uppercase tracking-widest shadow-lg">
          <span className="material-symbols-outlined text-sm">add</span> 연락처 추가
        </button>
      </div>

      {/* SOS 버튼 */}
      <div className="relative">
        <button 
          onClick={() => setShowSOS(!showSOS)}
          className="w-full bg-gradient-to-br from-error to-error-container text-white py-6 rounded-lg font-headline font-black text-2xl tracking-wider shadow-xl flex items-center justify-center gap-4 active:scale-[0.98] transition-all hover:shadow-error/30"
        >
          <span className="material-symbols-outlined text-4xl animate-pulse">sos</span>
          SOS 긴급 호출
          <span className="material-symbols-outlined text-4xl animate-pulse">emergency</span>
        </button>
        {showSOS && (
          <div className="mt-4 bg-error/5 border-2 border-error/30 rounded-lg p-6 space-y-3">
            <p className="font-label text-sm font-bold uppercase tracking-widest text-error flex items-center gap-2">
              <span className="material-symbols-outlined">warning</span> 긴급 연락처
            </p>
            {contacts.filter(c => ['소방', '경찰', '안전'].includes(c.category)).map(c => (
              <a key={c.id} href={`tel:${c.phone}`} className="flex items-center justify-between bg-surface-container-lowest p-4 rounded-lg border border-error/20 hover:border-error/50 transition-colors group">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-error">{catIcons[c.category] || 'call'}</span>
                  <div>
                    <p className="font-label font-bold text-on-surface">{c.name} <span className="text-outline font-normal">({c.role})</span></p>
                    <p className="font-label text-xl font-black text-error">{c.phone}</p>
                  </div>
                </div>
                <span className="material-symbols-outlined text-error group-hover:scale-110 transition-transform">phone_in_talk</span>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* 집결지 안내 */}
      <div className="bg-surface-container-lowest rounded-lg p-6 shadow-sm border border-outline-variant/20">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-warning/10 rounded-lg flex items-center justify-center">
            <span className="material-symbols-outlined text-warning">location_on</span>
          </div>
          <div>
            <h3 className="font-label text-sm font-bold uppercase tracking-widest text-warning">비상 집결지</h3>
            <p className="font-body text-sm text-on-surface-variant">현장 정문 앞 광장 (좌표: 37.5665, 126.9780)</p>
          </div>
        </div>
        <div className="bg-surface-container rounded-lg p-4 flex items-center gap-3">
          <span className="material-symbols-outlined text-primary">flag</span>
          <p className="font-body text-sm">비상 시 <strong>현장 정문 앞 광장</strong>으로 즉시 대피하세요. 인원 점검 후 안전 확인.</p>
        </div>
      </div>

      {/* 카테고리별 연락처 */}
      {Object.entries(grouped).map(([cat, catContacts]) => (
        <div key={cat} className="bg-surface-container-lowest rounded-lg p-6 shadow-sm border border-outline-variant/20">
          <div className="flex items-center gap-2 mb-4">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${catColors[cat] || 'text-primary bg-primary/10'}`}>
              <span className="material-symbols-outlined text-sm">{catIcons[cat] || 'person'}</span>
            </div>
            <h3 className="font-label text-sm font-bold uppercase tracking-widest text-on-surface">{cat}</h3>
            <span className="ml-auto font-label text-[10px] bg-surface-container px-2 py-1 rounded text-outline">{catContacts.length}명</span>
          </div>
          <div className="space-y-3">
            {catContacts.map(c => (
              <div key={c.id} className="flex items-center justify-between group hover:bg-surface-container rounded-lg p-3 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-surface-container rounded-full flex items-center justify-center font-headline font-black text-primary">
                    {c.name[0]}
                  </div>
                  <div>
                    <p className="font-label font-bold text-on-surface">{c.name} <span className="text-outline text-xs font-normal">({c.role})</span></p>
                    <a href={`tel:${c.phone}`} className="font-label text-sm text-primary hover:underline">{c.phone}</a>
                  </div>
                </div>
                <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a href={`tel:${c.phone}`} className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center hover:bg-primary/20 transition-colors">
                    <span className="material-symbols-outlined text-primary text-sm">call</span>
                  </a>
                  <button onClick={() => handleDelete(c.id)} className="w-8 h-8 bg-error/10 rounded-full flex items-center justify-center hover:bg-error/20 transition-colors">
                    <span className="material-symbols-outlined text-error text-sm">delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* 연락처 추가 모달 */}
      {showForm && (
        <div className="fixed inset-0 bg-surface-variant/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest w-full max-w-md p-8 shadow-xl rounded-lg relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-error"></div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-label text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                <span className="material-symbols-outlined">contacts</span> 연락처 추가
              </h3>
              <button onClick={() => setShowForm(false)}><span className="material-symbols-outlined text-outline hover:text-on-surface">close</span></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">카테고리</label>
                <select className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-primary transition-all text-on-surface font-bold py-2" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                  {['현장 관리', '안전', '소방', '경찰', '의료', '기타'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">이름</label>
                  <input required type="text" className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-primary transition-all text-on-surface font-bold py-2" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                </div>
                <div>
                  <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">직책/역할</label>
                  <input type="text" className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-primary transition-all text-on-surface font-bold py-2" value={form.role} onChange={e => setForm({...form, role: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">전화번호</label>
                <input required type="text" className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-primary transition-all text-on-surface font-bold py-2" placeholder="010-0000-0000" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
              </div>
              <div className="pt-2 flex justify-end">
                <button type="submit" className="bg-gradient-to-br from-primary to-primary-container text-white px-8 py-3 rounded font-label font-bold text-sm uppercase tracking-widest shadow-lg flex items-center gap-2">
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

export default EmergencyContacts;
