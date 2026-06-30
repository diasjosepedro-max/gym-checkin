import { useState, useEffect } from 'react';
import { createCheckin, deleteCheckin, getPayments } from '../api';
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
  const [modal, setModal]     = useState(null);
  const [selMid, setSelMid]   = useState(null);
  const [payments, setPayments] = useState({});
  const [overrides, setOverrides] = useState([]);
  const [editing, setEditing]   = useState(false);
  const [editForm, setEditForm] = useState({});
  const [weekOnly, setWeekOnly] = useState(false);
  const today = todayKey();
  const tIdx  = todayIdx();

  useEffect(() => { loadOverrides(); }, []);

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

  async function openModal(cls) {
    const month = today.slice(0,7);
    try {
      const { data } = await getPayments(month);
      const pm = {};
      data.forEach(p => { pm[p.member_id] = p.paid; });
      setPayments(pm);
    } catch {}
    setModal(cls); setSelMid(null); setEditing(false);
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

  async function doCheckIn() {
    if (!selMid || !modal) return;
    await createCheckin({ class_id: modal.id, member_id: selMid, date: today });
    await reload(); setSelMid(null);
    const updated = effectiveClasses.find(c => c.id === modal.id);
    if (updated) setModal(updated);
  }

  async function doCancelCheckIn(classId, memberId) {
    await deleteCheckin({ class_id: classId, member_id: memberId, date: today });
    await reload();
    const updated = effectiveClasses.find(c => c.id === classId);
    if (updated) setModal(updated);
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
                  const ci   = (cls.checkedIn || []).filter(ci => ci.date?.slice(0,10) === today).length;
                  const total = (cls.allowed_members || []).length;
                  const pct  = total > 0 ? (ci/total)*100 : 0;
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
                      {h >= 54 && <><div style={{ height:2, background:'rgba(0,0,0,.1)', borderRadius:1, marginTop:4, overflow:'hidden' }}><div style={{ height:'100%', width:`${pct}%`, background:color }}/></div><div style={{ fontFamily:'monospace', fontSize:8, color:'var(--muted)', marginTop:2 }}>{ci}/{total}</div></>}
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
                  <button className="green-btn" onClick={saveEdit}>GUARDAR</button>
                  <button onClick={() => setEditing(false)} style={{ background:'none', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:8, padding:'6px 14px', fontSize:11, cursor:'pointer' }}>Cancelar</button>
                </div>
              </div>
            )}

            {/* Modo check-in */}
            {!editing && (
              <>
                <div className="modal-label">SELECIONA O TEU NOME</div>
                {(modal.allowed_members || []).map(m => {
                  const checked = (modal.checkedIn || []).some(ci => ci.member_id === m.id && ci.date?.slice(0,10) === today);
                  const isSel   = selMid === m.id;
                  const unpaid  = !payments[m.id];
                  const color   = modal.color || '#85a800';

                  return (
                    <div key={m.id} style={{ display:'flex', alignItems:'stretch', marginBottom:7, borderRadius:10, overflow:'hidden', border:'1px solid var(--border)' }}>
                      {checked ? (
                        <>
                          <div style={{ flex:1, padding:'11px 14px', background:`${color}15`, fontWeight:600, fontSize:16, display:'flex', alignItems:'center', gap:10, color }}>
                            <span>✓</span><span>{m.name}</span>
                          </div>
                          <button onClick={() => doCancelCheckIn(modal.id, m.id)} style={{ background:'var(--red-bg)', border:'none', borderLeft:'1px solid var(--red-b)', color:'var(--red)', padding:'0 16px', fontFamily:'monospace', fontSize:10, fontWeight:700, cursor:'pointer', touchAction:'manipulation' }}>✕ ANULAR</button>
                        </>
                      ) : (
                        <button onClick={() => { setSelMid(isSel ? null : m.id); }} style={{ width:'100%', background: isSel ? `${color}22` : 'var(--card2)', border:'none', color: isSel ? color : 'var(--text)', padding:'11px 14px', fontWeight:600, fontSize:16, cursor:'pointer', textAlign:'left', display:'flex', alignItems:'center', gap:10, touchAction:'manipulation' }}>
                          <span>{isSel ? '●' : '○'}</span>
                          <span style={{ color: unpaid && !isSel ? 'var(--red)' : undefined }}>{m.name}</span>
                          {unpaid && !isSel && <span style={{ marginLeft:'auto', fontSize:9, fontFamily:'monospace', background:'var(--red-bg)', color:'var(--red)', border:'1px solid var(--red-b)', borderRadius:6, padding:'2px 6px' }}>💳 NÃO PAGO</span>}
                        </button>
                      )}
                    </div>
                  );
                })}

                {selMid && (
                  <button onClick={doCheckIn} style={{ width:'100%', padding:13, borderRadius:10, fontSize:16, marginTop:14, letterSpacing:2, fontWeight:700, textTransform:'uppercase', border:'none', cursor:'pointer', background: modal.color || '#85a800', color:'#fff', touchAction:'manipulation' }}>
                    CONFIRMAR CHECK-IN
                  </button>
                )}

                <div style={{ marginTop:14, borderTop:'1px solid var(--border)', paddingTop:12 }}>
                  <div className="modal-label">CHECK-INS HOJE</div>
                  {(modal.checkedIn || []).filter(ci => ci.date?.slice(0,10) === today).length === 0
                    ? <span style={{ color:'var(--dim)', fontFamily:'monospace', fontSize:11 }}>Nenhum ainda</span>
                    : (modal.checkedIn || []).filter(ci => ci.date?.slice(0,10) === today).map(ci => (
                        <span key={ci.member_id} style={{ display:'inline-flex', alignItems:'center', borderRadius:20, padding:'4px 10px', fontFamily:'monospace', fontSize:11, margin:3, background:`${modal.color}22`, border:`1px solid ${modal.color}55`, color: modal.color }}>
                          {ci.member_name || members.find(m => m.id === ci.member_id)?.name}
                        </span>
                      ))
                  }
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
