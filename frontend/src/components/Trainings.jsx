import { useState, useEffect } from 'react';
import api from '../api';

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const TAG = { PT:{bg:'#E6F1FB',c:'#185FA5'}, Pilates:{bg:'#E1F5EE',c:'#0F6E56'}, Grupo:{bg:'#FAEEDA',c:'#854F0B'} };
const getTag = t => TAG[t] || {bg:'var(--card2)',c:'var(--muted)'};

export default function Trainings() {
  const [month, setMonth]     = useState(MONTHS[new Date().getMonth()]);
  const [clients, setClients] = useState([]);
  const [counts, setCounts]   = useState({});
  const [loading, setLoading] = useState(true);

  const year = 2026;

  useEffect(() => { loadAll(); }, [month]);

  async function loadAll() {
    setLoading(true);
    try {
      const [{ data: cls }, { data: trs }] = await Promise.all([
        api.get('/finance/clients'),
        api.get(`/trainings?month=${month}&year=${year}`),
      ]);
      setClients(cls.filter(c => c.active));
      const map = {};
      trs.forEach(t => { map[t.client_id] = Number(t.count); });
      setCounts(map);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function updateCount(clientId, next) {
    const val = Math.max(0, next);
    setCounts(prev => ({ ...prev, [clientId]: val }));
    try { await api.post(`/trainings/${clientId}`, { month, year, count: val }); }
    catch(e) { console.error(e); }
  }

  if (loading) return (
    <div style={{textAlign:'center',padding:40,fontFamily:'monospace',fontSize:12,color:'var(--muted)'}}>A carregar...</div>
  );

  const total = Object.values(counts).reduce((s, n) => s + n, 0);

  return (
    <div>
      <div className="sec-title"><span>TREINOS</span></div>

      {/* Selector de mês */}
      <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:20}}>
        {MONTHS.map(m => (
          <button key={m} onClick={() => setMonth(m)} style={{
            background: m===month ? 'var(--accent-bg)' : 'var(--card)',
            border:     m===month ? '1px solid var(--accent)' : '1px solid var(--border)',
            color:      m===month ? 'var(--accent)' : 'var(--muted)',
            fontSize:11, padding:'4px 11px', borderRadius:20, cursor:'pointer',
            fontWeight: m===month ? 700 : 400,
          }}>{m}</button>
        ))}
      </div>

      {/* Resumo */}
      <div style={{background:'var(--card2)',border:'1px solid var(--border)',borderRadius:8,padding:'10px 14px',marginBottom:16,display:'flex',gap:24,alignItems:'center'}}>
        <div>
          <div style={{fontSize:22,fontWeight:500}}>{total}</div>
          <div style={{fontSize:10,color:'var(--muted)',textTransform:'uppercase',letterSpacing:1.5}}>Total treinos {month}</div>
        </div>
        <div>
          <div style={{fontSize:22,fontWeight:500}}>{clients.filter(c=>counts[c.id]>0).length}</div>
          <div style={{fontSize:10,color:'var(--muted)',textTransform:'uppercase',letterSpacing:1.5}}>Clientes ativos</div>
        </div>
      </div>

      {/* Lista */}
      <div style={{border:'1px solid var(--border)',borderRadius:10,overflow:'hidden'}}>
        {clients.length === 0
          ? <div style={{padding:32,textAlign:'center',fontFamily:'monospace',fontSize:12,color:'var(--muted)'}}>Sem clientes ativos.</div>
          : clients.map((c, i) => {
              const count = counts[c.id] || 0;
              const tag   = getTag(c.type);
              return (
                <div key={c.id} style={{
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  padding:'10px 14px',
                  borderBottom: i < clients.length-1 ? '1px solid var(--border)' : 'none',
                  background: count > 0 ? 'var(--accent-bg)' : undefined,
                }}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span style={{fontWeight:600,fontSize:13}}>{c.name}</span>
                    <span style={{background:tag.bg,color:tag.c,fontSize:9,fontWeight:500,padding:'1px 5px',borderRadius:4}}>{c.type}</span>
                    {c.sessions && <span style={{fontFamily:'monospace',fontSize:10,color:'var(--muted)'}}>{c.sessions}</span>}
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                    <button
                      onClick={() => updateCount(c.id, count - 1)}
                      style={{width:28,height:28,borderRadius:6,border:'1px solid var(--border)',background:'var(--card)',color:'var(--text)',fontSize:18,cursor:'pointer',fontWeight:700,lineHeight:1}}
                    >−</button>
                    <input
                      type="number"
                      min="0"
                      value={count}
                      onChange={e => updateCount(c.id, parseInt(e.target.value) || 0)}
                      style={{width:52,textAlign:'center',padding:'5px 0',borderRadius:6,border:'1px solid var(--border)',fontFamily:'Space Mono,monospace',fontSize:15,fontWeight:700,background:'var(--card)',color:'var(--text)',outline:'none'}}
                    />
                    <button
                      onClick={() => updateCount(c.id, count + 1)}
                      style={{width:28,height:28,borderRadius:6,border:'1px solid var(--accent)',background:'var(--accent-bg)',color:'var(--accent)',fontSize:18,cursor:'pointer',fontWeight:700,lineHeight:1}}
                    >+</button>
                  </div>
                </div>
              );
            })
        }
      </div>
    </div>
  );
}
