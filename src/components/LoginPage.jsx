import React, { useState } from 'react';

const LoginPage = ({ onLogin }) => {
  const [mode, setMode] = useState('login'); // login | register | forgot
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'worker' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const API_URL = 'http://localhost:5000/api';

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, password: form.password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      localStorage.setItem('ba_token', data.token);
      localStorage.setItem('ba_user', JSON.stringify(data.user));
      onLogin(data.user);
    } catch (e) {
      setError(e.message || '로그인 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess('계정이 생성되었습니다. 로그인해주세요.');
      setMode('login');
    } catch (e) {
      setError(e.message || '가입 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary-container to-surface flex items-center justify-center p-4">
      <div className="absolute inset-0 blueprint-grid opacity-20"></div>
      
      {/* 배경 장식 */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-primary/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-secondary/10 rounded-full blur-3xl"></div>

      <div className="relative w-full max-w-md">
        {/* 로고 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 backdrop-blur rounded-2xl mb-4 shadow-xl">
            <span className="material-symbols-outlined text-white text-4xl">architecture</span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight font-headline">The Blueprint Authority</h1>
          <p className="text-white/60 font-body mt-2">건설 현장 통합 관리 시스템</p>
        </div>

        <div className="bg-surface-container-lowest/95 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-white/20">
          {/* 모드 탭 */}
          {mode !== 'forgot' && (
            <div className="flex gap-1 bg-surface-container p-1 rounded-lg mb-6">
              {[['login', '로그인'], ['register', '회원가입']].map(([m, label]) => (
                <button key={m} onClick={() => { setMode(m); setError(''); setSuccess(''); }} className={`flex-1 py-2 font-label text-xs font-bold uppercase tracking-wider rounded transition-all ${mode === m ? 'bg-primary text-white shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-high'}`}>
                  {label}
                </button>
              ))}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 bg-error/10 text-error border border-error/20 rounded-lg p-3 mb-4 font-body text-sm">
              <span className="material-symbols-outlined text-sm">error</span> {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 bg-success/10 text-success border border-success/20 rounded-lg p-3 mb-4 font-body text-sm">
              <span className="material-symbols-outlined text-sm">check_circle</span> {success}
            </div>
          )}

          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="group">
                <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2 group-focus-within:text-primary transition-colors">이메일</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-outline text-sm">email</span>
                  <input required type="email" className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-primary transition-all text-on-surface font-bold py-3 pl-9" placeholder="manager@site.com" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
                </div>
              </div>
              <div className="group">
                <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2 group-focus-within:text-primary transition-colors">비밀번호</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-outline text-sm">lock</span>
                  <input required type="password" className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-primary transition-all text-on-surface font-bold py-3 pl-9" placeholder="••••••••" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
                </div>
              </div>
              <button type="submit" disabled={loading} className="w-full bg-gradient-to-br from-primary to-primary-container text-white py-4 rounded-lg font-label font-black text-sm uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 transition-all hover:shadow-primary/30 active:scale-[0.98]">
                {loading ? <span className="material-symbols-outlined animate-spin">refresh</span> : <span className="material-symbols-outlined">login</span>}
                {loading ? '로그인 중...' : '로그인'}
              </button>
              <button type="button" onClick={() => { setMode('forgot'); setError(''); }} className="w-full text-center font-label text-[10px] text-outline hover:text-primary transition-colors uppercase tracking-widest">
                비밀번호를 잊어버리셨나요?
              </button>
            </form>
          )}

          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-5">
              <div>
                <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">이름</label>
                <input required type="text" className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-primary transition-all text-on-surface font-bold py-3" placeholder="홍길동" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              </div>
              <div>
                <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">이메일</label>
                <input required type="email" className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-primary transition-all text-on-surface font-bold py-3" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
              </div>
              <div>
                <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">비밀번호</label>
                <input required type="password" minLength="6" className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-primary transition-all text-on-surface font-bold py-3" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
              </div>
              <div>
                <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">역할</label>
                <select className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-primary transition-all text-on-surface font-bold py-3" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                  <option value="worker">작업자</option>
                  <option value="manager">현장 관리자</option>
                  <option value="admin">관리자</option>
                </select>
              </div>
              <button type="submit" disabled={loading} className="w-full bg-gradient-to-br from-primary to-primary-container text-white py-4 rounded-lg font-label font-black text-sm uppercase tracking-widest shadow-xl flex items-center justify-center gap-2">
                {loading ? <span className="material-symbols-outlined animate-spin">refresh</span> : <span className="material-symbols-outlined">person_add</span>}
                {loading ? '처리 중...' : '계정 만들기'}
              </button>
            </form>
          )}

          {mode === 'forgot' && (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 bg-warning/10 rounded-2xl flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-warning text-3xl">key</span>
              </div>
              <div>
                <h3 className="font-headline font-black text-xl text-on-surface">비밀번호 재설정</h3>
                <p className="font-body text-on-surface-variant text-sm mt-2">관리자에게 문의하거나 가입된 이메일로 임시 비밀번호를 요청하세요.</p>
              </div>
              <div className="bg-surface-container rounded-lg p-4 text-left">
                <p className="font-label text-xs text-outline uppercase tracking-widest mb-2">관리자 이메일</p>
                <a href="mailto:admin@blueprint.site" className="font-label font-bold text-primary">admin@blueprint.site</a>
              </div>
              <button onClick={() => setMode('login')} className="font-label text-[10px] text-outline hover:text-primary transition-colors uppercase tracking-widest flex items-center gap-1 mx-auto">
                <span className="material-symbols-outlined text-sm">arrow_back</span> 로그인으로 돌아가기
              </button>
            </div>
          )}
        </div>

        {/* 데모 계정 안내 */}
        <div className="text-center mt-6">
          <p className="text-white/50 font-label text-[10px] uppercase tracking-widest">
            처음 사용 시 회원가입 후 로그인하세요
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
