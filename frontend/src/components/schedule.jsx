import { useState } from 'react';
import { createCheckin, deleteCheckin, getPayments } from '../api';

const DAYS   = ['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'];
const DSHORT = ['SEG','TER','QUA','QUI','SEX','SÁB','DOM'];
const S = 6, E = 22, PX = 60, TW = 44, CW = 130;

function todayKey() { return new Date().toISOString().slice(0,10); }
function todayIdx() { const d = new Date().getDay(); return d === 0 ? 6 : d - 1; }
function toMins(t)  { const [h,m] = t.split(':').map(Number); return h*60+m; }

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
  const [modal, setModal]   = useState(null);
  const [selMid, setSelMid] = useState(null);
  const [payments, setPayments] = useState({});
  const today = todayKey();
  const tIdx  = todayIdx();

  async function openModal(cls) {
    const month = today.slice(0,7);
    try {
      const { data } = await getPayments(month);
      const pm = {};
      data.forEach(p => { pm[p.member_id] = p.paid; });
      setPayments(pm);
    } catch {}
    setModal(cls); setSelMid(null);
  }

  async function doCheckIn() {
    if (!selMid || !modal) return;
    await createCheckin({ class_id: modal.id, member_id: selMid, date: today });
    await reload(); setSelMid(null);
    const updated = classes.find(c => c.id === modal.id);
    if (updated) setModal(updated);
  }

  async function doCancelCheckIn(classId, memberId) {
    await deleteCheckin({ class_id: classId, member_id: memberId, date: today });
    await reload();
    const updated = classes.find(c => c.id === classId);
    if (updated) setModal(updated);
  }

  const gridH = (E - S) * PX;

  return (
    <div>
      <div className="sec-title">
        <span>QUADRO SEMANAL</span>
        <span className="today-label">{new Date().toLocaleDateString('pt-PT',{weekday:'long',day:'numeric',month:'long'}).toUpperCase()}</span>
      </div>

      <div className="sch-scroll">
        <div className="sch-grid" style={{ gridTemplateColumns: `${TW}px repeat(7,${CW}px)`, gridTemplateRows: `38px repeat(${E-S},${PX}px)`, minWidth: TW+7*CW }}>

          {/* Corner */}
          <div style={{ gridColumn:1, gridRow:1, position:'sticky', top:0, left:0, zIndex:30, background:'var(--card)', borderRight:'1px solid var(--border)', borderBottom:'2px solid var(--border2)' }}/>

          {/* Day headers */}
          {DAYS.map((_,i) => {
            const isT = i === tIdx;
            return (
              <div key={i} style={{ gridColumn:i+2, gridRow:1, position:'sticky', top:0, zIndex:20, background: isT ? 'rgba(133,168,0,0.07)' : 'var(--card)', borderRight:'1px solid var(--border)', borderBottom:`2px solid ${isT?'var(--accent)':'var(--border2)'}`, display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                <span style={{ fontWeight:900, fontSize:11, letterSpacing:2, color: isT ? 'var(--accent)' : 'var(--muted)' }}>{DSHORT[i]}</span>
                {isT && <span style={{ fontSize:8, background:'var(--accent)', color:'#fff', padding:'1px 5px', borderRadius:8, fontWeight:700 }}>HOJE</span>}
              </div>
            );
          })}

          {/* Hour labels */}
          {Array.from({length: E-S}, (_,h) => (
            <div key={h} style={{ gridColumn:1, gridRow:h+2, position:'sticky', left:0, zIndex:10, background:'var(--card)', borderRight:'1px solid var(--border)', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'flex-start', justifyContent:'flex-end', padding:'3px 6px 0 0' }}>
              <span style={{ fontFamily:'monospace', fontSize:9, color:'var(--dim)' }}>{String(S+h).padStart(2,'0')}:00</span>
            </div>
          ))}

          {/* Day columns */}
          {DAYS.map((_,dayIdx) => {
            const isT = dayIdx === tIdx;
            const now = new Date();
            const nowM = now.getHours()*60 + now.getMinutes();
            const dayCls = classes.filter(c => c.day === dayIdx);

            return (
              <div key={dayIdx} style={{ gridColumn:dayIdx+2, gridRow:`2/${E-S+2}`, position:'relative', borderRight:'1px solid var(--border)', backgroundImage:`repeating-linear-gradient(to bottom,transparent 0,transparent ${PX-1}px,var(--border) ${PX-1}px,var(--border) ${PX}px)`, backgroundColor: isT ? 'rgba(133,168,0,0.03)' : undefined }}>

                {/* Current time */}
                {isT && nowM > S*60 && nowM < E*60 && (
                  <>
                    <div style={{ position:'absolute', left:-4, top:nowM-S*60-4, width:8, height:8, borderRadius:'50%', background:'var(--accent)', zIndex:6, pointerEvents:'none' }}/>
                    <div style={{ position:'absolute', left:0, right:0, top:nowM-S*60, height:2, background:'var(--accent)', zIndex:5, pointerEvents:'none', opacity:.8 }}/>
                  </>
                )}

                {/* Classes */}
                {positionClasses(dayCls).map(({ cls, lp, wp }) => {
                  const top  = toMins(cls.time) - S*60;
                  const h    = Math.max(cls.duration, 22);
                  const ci   = (cls.checkedIn || []).filter(ci => ci.date?.slice(0,10) === today).length;
                  const total = (cls.allowed_members || []).length;
                  const pct  = total > 0 ? (ci/total)*100 : 0;
                  const color = cls.color || '#85a800';
                  const compact = h < 50;

                  return (
                    <div key={cls.id} onClick={() => openModal(cls)} style={{ position:'absolute', top:top+1, left:`calc(${lp}% + 2px)`, width:`calc(${wp}% - 4px)`, height:h-2, background:`${color}1c`, border:`1px solid ${color}55`, borderLeft:`3px solid ${color}`, borderRadius:6, cursor:'pointer', overflow:'hidden', padding: compact ? '3px 5px' : '5px 7px', touchAction:'manipulation' }}>
                      <div style={{ fontWeight:700, fontSize:compact?10:12, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{cls.name.toUpperCase()}</div>
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
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle"/>
            <div className="modal-header">
              <div>
                <div className="modal-title">{modal.name.toUpperCase()}</div>
                <div style={{ fontFamily:'monospace', fontSize:12, color: modal.color }}>{DAYS[modal.day]} · {modal.time} · {modal.duration}min</div>
                {modal.teacher_name && <div style={{ fontFamily:'monospace', fontSize:11, color:'var(--muted)', marginTop:4 }}>👤 {modal.teacher_name}</div>}
              </div>
              <button className="modal-close" onClick={() => setModal(null)}>×</button>
            </div>

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
          </div>
        </div>
      )}
    </div>
  );
}