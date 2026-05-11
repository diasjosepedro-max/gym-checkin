import { useState } from 'react';
import api from '../api';

export default function Login({ onLogin }) {
  const [mode, setMode]       = useState('login'); // 'login' | 'register'
  const [email, setEmail]     = useState('');
  const [password, setPass]   = useState('');
  const [name, setName]       = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
      const payload  = mode === 'login' ? { email, password } : { email, password, name };
      const { data } = await api.post(endpoint, payload);
      localStorage.setItem('gym_token', data.token);
      onLogin(data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao autenticar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)' }}>
      <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, padding:32, width:'100%', maxWidth:380, boxShadow:'0 4px 24px rgba(0,0,0,.08)' }}>

        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <div style={{ fontWeight:900, fontSize:28, letterSpacing:4 }}>
            <span style={{ color:'var(--accent)' }}>●</span> GYM
          </div>
          <div style={{ fontFamily:'monospace', fontSize:10, color:'var(--muted)', letterSpacing:3, marginTop:4 }}>CHECK-IN</div>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:6, marginBottom:24 }}>
          <button onClick={() => { setMode('login'); setError(''); }} style={{ flex:1, padding:'8px 0', borderRadius:8, border:'1px solid var(--border)', fontFamily:'Barlow Condensed, sans-serif', fontWeight:700, fontSize:13, letterSpacing:1, cursor:'pointer', background: mode==='login' ? 'var(--accent)' : 'var(--card2)', color: mode==='login' ? '#fff' : 'var(--muted)' }}>
            ENTRAR
          </button>
          <button onClick={() => { setMode('register'); setError(''); }} style={{ flex:1, padding:'8px 0', borderRadius:8, border:'1px solid var(--border)', fontFamily:'Barlow Condensed, sans-serif', fontWeight:700, fontSize:13, letterSpacing:1, cursor:'pointer', background: mode==='register' ? 'var(--accent)' : 'var(--card2)', color: mode==='register' ? '#fff' : 'var(--muted)' }}>
            REGISTAR
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div style={{ marginBottom:12 }}>
              <div style={{ fontFamily:'monospace', fontSize:10, color:'var(--muted)', marginBottom:5, letterSpacing:1 }}>NOME</div>
              <input className="input" type="text" placeholder="O teu nome" value={name} onChange={e => setName(e.target.value)} style={{ width:'100%' }}/>
            </div>
          )}

          <div style={{ marginBottom:12 }}>
            <div style={{ fontFamily:'monospace', fontSize:10, color:'var(--muted)', marginBottom:5, letterSpacing:1 }}>EMAIL</div>
            <input className="input" type="email" placeholder="email@exemplo.com" value={email} onChange={e => setEmail(e.target.value)} required style={{ width:'100%' }}/>
          </div>

          <div style={{ marginBottom:20 }}>
            <div style={{ fontFamily:'monospace', fontSize:10, color:'var(--muted)', marginBottom:5, letterSpacing:1 }}>PASSWORD</div>
            <input className="input" type="password" placeholder="••••••••" value={password} onChange={e => setPass(e.target.value)} required style={{ width:'100%' }}/>
          </div>

          {error && (
            <div style={{ background:'var(--red-bg)', border:'1px solid var(--red-b)', color:'var(--red)', borderRadius:8, padding:'10px 14px', fontFamily:'monospace', fontSize:11, marginBottom:16 }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{ width:'100%', padding:13, borderRadius:10, fontSize:16, letterSpacing:2, fontFamily:'Barlow Condensed, sans-serif', fontWeight:700, textTransform:'uppercase', border:'none', cursor:'pointer', background:'var(--accent)', color:'#fff', opacity: loading ? .7 : 1 }}>
            {loading ? 'A processar...' : mode === 'login' ? 'ENTRAR' : 'CRIAR CONTA'}
          </button>
        </form>
      </div>
    </div>
  );
}