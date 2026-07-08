import { useState, useEffect } from 'react';
import api from '../api';

const DAYS   = ['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'];
const DSHORT = ['SEG','TER','QUA','QUI','SEX','SÁB','DOM'];
const PALETTE = ['#C49A2A','#e74c3c','#1abc9c','#f39c12','#8e44ad','#e67e22','#16a085','#e91e63','#2980b9','#d35400','#27ae60','#f1c40f'];
const S = 6, E = 22, PX = 60, TW = 44, CW = 130;

function todayKey() { return new Date().toISOString().slice(0,10); }
function todayIdx() { const d = new Date().getDay(); return d === 0 ? 6 : d - 1; }
function toMins(t)  { const [h,m] = t.split(':').map(Number); return h*60+m; }
function getWeekMonday() {
  const d = new Date();
  const day = d.getDay() || 7;
  if (day !== 1) d.setDate(d.getDate() - (day - 1));
  return d.toISOString().slice(0, 10);
}

function positionClasses(dayCls) {
  if (!dayCls.length) return [];
  const sorted = [...dayCls].sort((a,b) => toMins(a.time) - toMins(b.time));
  const cols = [], assgn = [];
  for (const cls of sorted) {
    const s = toMins(cls.time), e = s + cls.duration;
    let ci = cols.findIndex(end => end <= s);
    if (ci === -1) { ci = cols.length; cols.push(e); } else cols[ci] = e;
    assgn.push({ cls, ci });
  }
  return assgn.map(a => {
    const s = toMins(a.cls.time), e = s + a.cls.duration;
    const sim = assgn.filter(b => { const bs = toMins(b.cls.time), be = bs + b.cls.duration; return bs < e && be > s; });
    const n = Math.max(...sim.map(c => c.ci)) + 1;
    return { cls: a.cls, lp: (a.ci/n)*100, wp: (1/n)*100 };
  });
}

export default function Schedule({ members, teachers, classes, reload }) {
  const [modal, setModal]           = useState(null);
  const [overrides, setOverrides]   = useState([]);
  const [financialClients, setFinancialClients] = useState([]);
  const [addClientVal, setAddClientVal]         = useState('');
  const [editing, setEditing]   = useState(false);
  const [editForm, setEditForm] = useState({});
  const [weekOnly, setWeekOnly] = useState(false);
  const [busy, setBusy] = useState(new Set());
  const isBusy = k => busy.has(k);
  const run = async (key, fn) => {
    if (busy.has(key)) return;
    setBusy(p => new Set(p).add(key));
    try { await fn(); } finally {
      setBusy(p => { const s = new Set(p); s.delete(key); return s; });
    }
  };
  const today = todayKey();
  const tIdx  = todayIdx();

  useEffect(() => { loadOverrides(); loadFinancialClients(); }, []);

  useEffect(() => {
    if (modal && !editing) {
      const updated = effectiveClasses.find(c => c.id === modal.id);
      if (updated) setModal(updated);
    }
  }, [classes]);

  async function loadOverrides() {
    try {
      const { data } = await api.get(`/classes/overrides?week=${getWeekMonday()}`);
      setOverrides(data);
    } catch {}
  }

  // Aplica overrides semanais sobre as aulas base
  const effectiveClasses = classes.map(c => {
    const ov = overrides.find(o => o.class_id === c.id);
    if (!ov) return c;
    return { ...c, name: ov.name ?? c.name, time: ov.time ?? c.time, duration: ov.duration ?? c.duration, color: ov.color ?? c.color, teacher_id: ov.teacher_id ?? c.teacher_id, teacher_name: ov.teacher_name ?? c.teacher_name };
  });

  async function loadFinancialClients() {
    try {
      const { data } = await api.get('/finance/clients');
      setFinancialClients(data.filter(c => c.active));
    } catch {}
  }

  function openModal(cls) {
    setModal(cls);
    setEditing(false);
    setAddClientVal('');
  }

  function openEdit() {
    if (!modal) return;
    setEditForm({
      name: modal.name,
      time: modal.time,
      duration: modal.duration,
      color: modal.color || '#85a800',
      teacher_id: modal.teacher_id || '',
      allowed_members: (modal.allowed_members || []).map(m => m.id),
    });
    setWeekOnly(false);
    setEditing(true);
  }

  function toggleEditMember(id) {
    setEditForm(f => ({
      ...f,
      allowed_members: f.allowed_members.includes(id)
        ? f.allowed_members.filter(m => m !== id)
        : [...f.allowed_members, id]
    }));
  }

  async function saveEdit() {
    try {
      if (weekOnly) {
        await api.post(`/classes/${modal.id}/override`, {
          week_date: getWeekMonday(),
          name: editForm.name,
          time: editForm.time,
          duration: editForm.duration,
          color: editForm.color,
          teacher_id: editForm.teacher_id || null,
        });
        await loadOverrides();
      } else {
        await api.put(`/classes/${modal.id}`, {
          name: editForm.name,
          day: modal.day,
          time: editForm.time,
          duration: editForm.duration,
          color: editForm.color,
          teacher_id: editForm.teacher_id || null,
          allowed_members: editForm.allowed_members,
        });
        await reload();
      }
      setEditing(false);
      setModal(null);
    } catch(e) {
      alert('Erro ao guardar: ' + (e.response?.data?.error || e.message));
    }
  }

  async function addToClass() {
    if (!addClientVal || !modal) return;
    const fc = financialClients.find(c => c.id === addClientVal);
    if (!fc) return;
    await run(`add-${modal.id}`, async () => {
      setModal(prev => ({
        ...prev,
        allowed_members: [...(prev.allowed_members || []), { id: 'tmp-' + fc.id, name: fc.name }],
      }));
      setAddClientVal('');
      const currentFcIds = (modal.allowed_members || []).map(m => {
        const f = financialClients.find(c => c.name.toLowerCase().trim() === m.name.toLowerCase().trim());
        return f?.id;
      }).filter(Boolean);
      await api.post(`/classes/${modal.id}/set-financial-members`, {
        financial_client_ids: [...new Set([...currentFcIds, addClientVal])],
      });
      await reload();
    });
  }

  async function removeFromClass(member) {
    if (!modal) return;
    await run(`rem-${member.id}`, async () => {
      setModal(prev => ({
        ...prev,
        allowed_members: (prev.allowed_members || []).filter(m => m.id !== member.id),
      }));
      const remainingFcIds = (modal.allowed_members || [])
        .filter(m => m.id !== member.id)
        .map(m => {
          const f = financialClients.find(c => c.name.toLowerCase().trim() === m.name.toLowerCase().trim());
          return f?.id;
        }).filter(Boolean);
      try {
        await api.post(`/classes/${modal.id}/set-financial-members`, { financial_client_ids: remainingFcIds });
        await reload();
      } catch {
        await reload();
      }
    });
  }

  return (
    <div>
      <div className="sec-title">
        <span>QUADRO SEMANAL</span>
        <span className="today-label">{new Date().toLocaleDateString('pt-PT',{weekday:'long',day:'numeric',month:'long'}).toUpperCase()}</span>
      </div>

      <div className="sch-scroll">
        <div className="sch-grid" style={{ gridTemplateColumns: `${TW}px repeat(7,${CW}px)`, gridTemplateRows: `38px repeat(${E-S},${PX}px)`, minWidth: TW+7*CW }}>

          <div style={{ gridColumn:1, gridRow:1, position:'sticky', top:0, left:0, zIndex:30, background:'var(--card)', borderRight:'1px solid var(--border)', borderBottom:'2px solid var(--border2)' }}/>

          {DAYS.map((_,i) => {
            const isT = i === tIdx;
            return (
              <div key={i} style={{ gridColumn:i+2, gridRow:1, position:'sticky', top:0, zIndex:20, background: isT ? 'rgba(133,168,0,0.07)' : 'var(--card)', borderRight:'1px solid var(--border)', borderBottom:`2px solid ${isT?'var(--accent)':'var(--border2)'}`, display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                <span style={{ fontWeight:900, fontSize:11, letterSpacing:2, color: isT ? 'var(--accent)' : 'var(--muted)' }}>{DSHORT[i]}</span>
                {isT && <span style={{ fontSize:8, background:'var(--accent)', color:'#fff', padding:'1px 5px', borderRadius:8, fontWeight:700 }}>HOJE</span>}
              </div>
            );
          })}

          {Array.from({length: E-S}, (_,h) => (
            <div key={h} style={{ gridColumn:1, gridRow:h+2, position:'sticky', left:0, zIndex:10, background:'var(--card)', borderRight:'1px solid var(--border)', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'flex-start', justifyContent:'flex-end', padding:'3px 6px 0 0' }}>
              <span style={{ fontFamily:'monospace', fontSize:9, color:'var(--dim)' }}>{String(S+h).padStart(2,'0')}:00</span>
            </div>
          ))}

          {DAYS.map((_,dayIdx) => {
            const isT = dayIdx === tIdx;
            const now = new Date();
            const nowM = now.getHours()*60 + now.getMinutes();
            const dayCls = effectiveClasses.filter(c => c.day === dayIdx);

            return (
              <div key={dayIdx} style={{ gridColumn:dayIdx+2, gridRow:`2/${E-S+2}`, position:'relative', borderRight:'1px solid var(--border)', backgroundImage:`repeating-linear-gradient(to bottom,transparent 0,transparent ${PX-1}px,var(--border) ${PX-1}px,var(--border) ${PX}px)`, backgroundColor: isT ? 'rgba(133,168,0,0.03)' : undefined }}>

                {isT && nowM > S*60 && nowM < E*60 && (
                  <>
                    <div style={{ position:'absolute', left:-4, top:nowM-S*60-4, width:8, height:8, borderRadius:'50%', background:'var(--accent)', zIndex:6, pointerEvents:'none' }}/>
                    <div style={{ position:'absolute', left:0, right:0, top:nowM-S*60, height:2, background:'var(--accent)', zIndex:5, pointerEvents:'none', opacity:.8 }}/>
                  </>
                )}

                {positionClasses(dayCls).map(({ cls, lp, wp }) => {
                  const top  = toMins(cls.time) - S*60;
                  const h    = Math.max(cls.duration, 22);
                  const total = (cls.allowed_members || []).length;
                  const color = cls.color || '#85a800';
                  const compact = h < 50;
                  const hasOverride = overrides.some(o => o.class_id === cls.id);

                  return (
                    <div key={cls.id} onClick={() => openModal(cls)} style={{ position:'absolute', top:top+1, left:`calc(${lp}% + 2px)`, width:`calc(${wp}% - 4px)`, height:h-2, background:`${color}1c`, border:`1px solid ${color}55`, borderLeft:`3px solid ${color}`, borderRadius:6, cursor:'pointer', overflow:'hidden', padding: compact ? '3px 5px' : '5px 7px', touchAction:'manipulation' }}>
                      <div style={{ fontWeight:700, fontSize:compact?10:12, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        {cls.name.toUpperCase()}
                        {hasOverride && <span style={{ fontSize:8, marginLeft:3, opacity:.7 }}>~</span>}
                      </div>
                      <div style={{ fontFamily:'monospace', fontSize:compact?8:9, color, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{cls.time}</div>
                      {h >= 54 && total > 0 && <div style={{ fontFamily:'monospace', fontSize:8, color:'var(--muted)', marginTop:3 }}>{total} cliente{total !== 1 ? 's' : ''}</div>}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => { setModal(null); setEditing(false); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle"/>
            <div className="modal-header">
              <div>
                <div className="modal-title">{editing ? 'EDITAR AULA' : modal.name.toUpperCase()}</div>
                {!editing && <div style={{ fontFamily:'monospace', fontSize:12, color: modal.color }}>{DAYS[modal.day]} · {modal.time} · {modal.duration}min</div>}
                {!editing && modal.teacher_name && <div style={{ fontFamily:'monospace', fontSize:11, color:'var(--muted)', marginTop:4 }}>👤 {modal.teacher_name}</div>}
              </div>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                {!editing && (
                  <button onClick={openEdit} style={{ fontSize:11, padding:'5px 12px', borderRadius:6, cursor:'pointer', background:'var(--card2)', border:'1px solid var(--border)', color:'var(--muted)', fontWeight:500 }}>✎ Editar</button>
                )}
                <button className="modal-close" onClick={() => { setModal(null); setEditing(false); }}>×</button>
              </div>
            </div>

            {/* Modo edição */}
            {editing && (
              <div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
                  <div>
                    <div className="modal-label">NOME</div>
                    <input className="input" value={editForm.name} onChange={e=>setEditForm(f=>({...f,name:e.target.value}))}/>
                  </div>
                  <div>
                    <div className="modal-label">HORA</div>
                    <input className="input" type="time" value={editForm.time} onChange={e=>setEditForm(f=>({...f,time:e.target.value}))}/>
                  </div>
                  <div>
                    <div className="modal-label">DURAÇÃO (min)</div>
                    <input className="input" type="number" min="15" max="180" step="15" value={editForm.duration} onChange={e=>setEditForm(f=>({...f,duration:+e.target.value}))}/>
                  </div>
                  <div>
                    <div className="modal-label">PROFESSOR</div>
                    <select className="input" value={editForm.teacher_id} onChange={e=>setEditForm(f=>({...f,teacher_id:e.target.value}))}>
                      <option value="">— sem professor —</option>
                      {teachers.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="modal-label">COR</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:7, marginBottom:12 }}>
                  {PALETTE.map(c=>(
                    <div key={c} onClick={()=>setEditForm(f=>({...f,color:c}))} style={{ width:22, height:22, borderRadius:'50%', background:c, cursor:'pointer', border:editForm.color===c?'3px solid var(--text)':'3px solid transparent' }}/>
                  ))}
                </div>

                <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, cursor:'pointer', marginBottom:12, padding:'10px 12px', background:'var(--accent-bg)', border:'1px solid var(--accent)', borderRadius:8 }}>
                  <input type="checkbox" checked={weekOnly} onChange={e=>setWeekOnly(e.target.checked)}/>
                  <div>
                    <span style={{ color:'var(--accent)', fontWeight:600 }}>Só para esta semana</span>
                    <span style={{ color:'var(--muted)', fontSize:10, marginLeft:8 }}>alteração temporária</span>
                  </div>
                </label>

                {!weekOnly && (
                  <>
                    <div className="modal-label">MEMBROS COM ACESSO</div>
                    <div style={{ marginBottom:12 }}>
                      {members.map(m => {
                        const on = editForm.allowed_members.includes(m.id);
                        const color = editForm.color || '#85a800';
                        return (
                          <button key={m.id} className="tag-btn" onClick={() => toggleEditMember(m.id)} style={on ? { background:`${color}22`, borderColor:`${color}88`, color } : {}}>
                            {on ? '✓ ' : '+ '}{m.name}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                <div style={{ display:'flex', gap:8 }}>
                  <button disabled={isBusy('save-edit')} className="green-btn" onClick={()=>run('save-edit',saveEdit)}>{isBusy('save-edit')?'…':'GUARDAR'}</button>
                  <button onClick={() => setEditing(false)} style={{ background:'none', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:8, padding:'6px 14px', fontSize:11, cursor:'pointer' }}>Cancelar</button>
                </div>
              </div>
            )}

            {/* Alocação de clientes */}
            {!editing && (
              <>
                <div className="modal-label">CLIENTES ALOCADOS</div>
                {(modal.allowed_members || []).length === 0
                  ? <p style={{ fontFamily:'monospace', fontSize:11, color:'var(--muted)', margin:'4px 0 12px' }}>Nenhum cliente alocado</p>
                  : (modal.allowed_members || []).map(m => (
                      <div key={m.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 12px', background:'var(--card2)', border:'1px solid var(--border)', borderRadius:8, marginBottom:6 }}>
                        <span style={{ fontWeight:600, fontSize:15 }}>{m.name}</span>
                        <button
                          disabled={isBusy(`rem-${m.id}`)}
                          onClick={() => removeFromClass(m)}
                          style={{ background:'var(--red-bg)', border:'1px solid var(--red-b)', color:'var(--red)', borderRadius:6, padding:'3px 10px', fontSize:10, fontWeight:700, cursor:'pointer' }}
                        >{isBusy(`rem-${m.id}`) ? '…' : '✕ REMOVER'}</button>
                      </div>
                    ))
                }
                <div style={{ display:'flex', gap:8, marginTop:12, alignItems:'center' }}>
                  <select
                    value={addClientVal}
                    onChange={e => setAddClientVal(e.target.value)}
                    className="input"
                    style={{ flex:1, fontSize:12, padding:'8px 10px' }}
                  >
                    <option value="">— adicionar cliente —</option>
                    {financialClients
                      .filter(fc => !(modal.allowed_members||[]).some(m => m.name.toLowerCase().trim() === fc.name.toLowerCase().trim()))
                      .map(fc => <option key={fc.id} value={fc.id}>{fc.name}</option>)
                    }
                  </select>
                  <button
                    disabled={!addClientVal || isBusy(`add-${modal.id}`)}
                    onClick={addToClass}
                    style={{ background:'var(--accent-bg)', border:'1px solid var(--accent)', color:'var(--accent)', borderRadius:8, padding:'8px 16px', fontSize:14, fontWeight:700, cursor:'pointer' }}
                  >{isBusy(`add-${modal.id}`) ? '…' : '+'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
