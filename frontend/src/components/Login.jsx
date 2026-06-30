import { useState } from 'react';
import api from '../api';

export default function Login({ onLogin }) {
  const [email, setEmail]     = useState('');
  const [password, setPass]   = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      localStorage.setItem('gym_token', data.token);
      onLogin(data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Email ou password incorretos');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)' }}>
      <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:20, padding:'36px 32px', width:'100%', maxWidth:380, boxShadow:'0 8px 40px rgba(140,100,30,.14)' }}>

        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:36 }}>
          <img
            src="/IMG-20251118-WA0009.jpg"
            alt="Habitus"
            style={{ width:72, height:72, borderRadius:'50%', objectFit:'cover', margin:'0 auto 14px', display:'block', boxShadow:'0 4px 16px rgba(196,154,42,.35)' }}
          />
          <div style={{ fontFamily:'Playfair Display, Georgia, serif', fontWeight:700, fontSize:26, letterSpacing:5, color:'var(--text)', textTransform:'uppercase' }}>
            Habitus
          </div>
          <div style={{ fontFamily:'Barlow Condensed, sans-serif', fontSize:10, color:'var(--muted)', letterSpacing:3, marginTop:4, textTransform:'uppercase' }}>
            Personal Training Studio
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom:14 }}>
            <div style={{ fontFamily:'monospace', fontSize:10, color:'var(--muted)', marginBottom:5, letterSpacing:1 }}>EMAIL</div>
            <input className="input" type="email" placeholder="email@exemplo.com" value={email} onChange={e => setEmail(e.target.value)} required style={{ width:'100%' }}/>
          </div>

          <div style={{ marginBottom:24 }}>
            <div style={{ fontFamily:'monospace', fontSize:10, color:'var(--muted)', marginBottom:5, letterSpacing:1 }}>PASSWORD</div>
            <input className="input" type="password" placeholder="••••••••" value={password} onChange={e => setPass(e.target.value)} required style={{ width:'100%' }}/>
          </div>

          {error && (
            <div style={{ background:'var(--red-bg)', border:'1px solid var(--red-b)', color:'var(--red)', borderRadius:8, padding:'10px 14px', fontFamily:'monospace', fontSize:11, marginBottom:16 }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{ width:'100%', padding:13, borderRadius:10, fontSize:16, letterSpacing:2, fontFamily:'Barlow Condensed, sans-serif', fontWeight:700, textTransform:'uppercase', border:'none', cursor:'pointer', background:'var(--accent)', color:'#fff', opacity: loading ? .7 : 1 }}>
            {loading ? 'A entrar...' : 'ENTRAR'}
          </button>
        </form>
      </div>
    </div>
  );
}