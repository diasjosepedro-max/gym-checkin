import { useState } from 'react';
import { createMember, deleteMember, createTeacher, deleteTeacher, createClass, deleteClass, getCheckins, deleteCheckin } from '../api';

const DAYS    = ['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'];
const PALETTE = ['#85a800','#e74c3c','#1abc9c','#f39c12','#8e44ad','#e67e22','#16a085','#e91e63','#2980b9','#d35400','#27ae60','#f1c40f'];

export default function Admin({ members, teachers, classes, reload }) {
  const [tab, setTab]           = useState('classes');
  const [nmName, setNmName]     = useState('');
  const [ntName, setNtName]     = useState('');
  const [checkins, setCheckins] = useState([]);
  const [ncForm, setNcForm]     = useState({ name:'', day:0, time:'08:00', duration:60, teacher_id:'', color:PALETTE[0], allowed_members:[] });

  const today = new Date().toISOString().slice(0,10);

  async function loadCheckins() {
    const { data } = await getCheckins(today);
    setCheckins(data);
  }

  function handleTab(t) {
    setTab(t);
    if (t === 'checkins') loadCheckins();
  }

  // Members
  async function addMember() {
    if (!nmName.trim()) return;
    await createMember(nmName.trim()); setNmName(''); await reload();
  }

  // Teachers
  async function addTeacher() {
    if (!ntName.trim()) return;
    await createTeacher(ntName.trim()); setNtName(''); await reload();
  }

  // Classes
  async function addNewClass() {
    if (!ncForm.name.trim()) return;
    await createClass({ ...ncForm, teacher_id: ncForm.teacher_id || null });
    setNcForm({ name:'', day:0, time:'08:00', duration:60, teacher_id:'', color:PALETTE[0], allowed_members:[] });
    await reload();
  }

  function toggleMember(id) {
    setNcForm(f => ({
      ...f,
      allowed_members: f.allowed_members.includes(id)
        ? f.allowed_members.filter(m => m !== id)
        : [...f.allowed_members, id]
    }));
  }

  // Cancel check-in
  async function cancelCheckin(classId, memberId) {
    await deleteCheckin({ class_id: classId, member_id: memberId, date: today });
    await loadCheckins();
    await reload();
  }

  return (
    <div id="admin-view">
      <div className="sec-title"><span>ADMINISTRAÇÃO</span></div>

      <div className="tab-btns">
        {['classes','members','teachers','checkins'].map(t => (
          <button key={t} className={`tab-btn ${tab===t?'active':''}`} onClick={() => handleTab(t)}>
            {t === 'classes' ? 'Aulas' : t === 'members' ? 'Membros' : t === 'teachers' ? 'Professores' : 'Check-ins'}
          </button>
        ))}
      </div>

      {/* AULAS */}
      {tab === 'classes' && (
        <div>
          <div className="card">
            <div className="card-title">NOVA AULA</div>
            <div className="form-grid">
              <input className="input" placeholder="Nome da aula" value={ncForm.name} onChange={e => setNcForm(f=>({...f,name:e.target.value}))}/>
              <select className="input" value={ncForm.day} onChange={e => setNcForm(f=>({...f,day:+e.target.value}))}>
                {DAYS.map((d,i) => <option key={i} value={i}>{d}</option>)}
              </select>
              <input className="input" type="time" value={ncForm.time} onChange={e => setNcForm(f=>({...f,time:e.target.value}))}/>
              <input className="input" type="number" min="15" max="180" step="15" value={ncForm.duration} onChange={e => setNcForm(f=>({...f,duration:+e.target.value}))}/>
            </div>
            <div className="form-row">
              <div>
                <div className="input-label">PROFESSOR</div>
                <select className="input" value={ncForm.teacher_id} onChange={e => setNcForm(f=>({...f,teacher_id:e.target.value}))}>
                  <option value="">— sem professor —</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <div className="input-label">COR</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
                  {PALETTE.map(c => (
                    <div key={c} onClick={() => setNcForm(f=>({...f,color:c}))} style={{ width:22, height:22, borderRadius:'50%', background:c, cursor:'pointer', border: ncForm.color===c ? '3px solid var(--text)' : '3px solid transparent' }}/>
                  ))}
                </div>
              </div>
            </div>
            <div className="input-label" style={{ marginBottom:7 }}>MEMBROS PERMITIDOS</div>
            <div>
              {members.map(m => {
                const on = ncForm.allowed_members.includes(m.id);
                return (
                  <button key={m.id} className="tag-btn" onClick={() => toggleMember(m.id)} style={ on ? { background:`${ncForm.color}22`, borderColor:`${ncForm.color}88`, color:ncForm.color } : {}}>
                    {on ? '✓ ' : '+ '}{m.name}
                  </button>
                );
              })}
            </div>
            <button className="green-btn" style={{ marginTop:14 }} onClick={addNewClass}>CRIAR AULA</button>
          </div>

          {DAYS.map((day,idx) => {
            const dayCls = classes.filter(c => c.day === idx);
            if (!dayCls.length) return null;
            return (
              <div key={idx}>
                <div className="admin-day-title">{day.toUpperCase()}</div>
                {dayCls.map(cls => (
                  <div key={cls.id} className="cls-row" style={{ borderLeft:`3px solid ${cls.color||'#85a800'}` }}>
                    <div className="cls-row-top">
                      <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                        <span style={{ width:8, height:8, borderRadius:'50%', background:cls.color, display:'inline-block' }}/>
                        <span className="cls-row-name">{cls.name.toUpperCase()}</span>
                        <span className="cls-row-time" style={{ color:cls.color }}>{cls.time}</span>
                        <span className="cls-row-dur">{cls.duration}min</span>
                        {cls.teacher_name && <span style={{ fontFamily:'monospace', fontSize:10, color:'var(--muted)', background:'var(--card2)', border:'1px solid var(--border)', padding:'2px 8px', borderRadius:10 }}>👤 {cls.teacher_name}</span>}
                      </div>
                      <button className="del-btn" onClick={async () => { await deleteClass(cls.id); await reload(); }}>REMOVER</button>
                    </div>
                    <div className="section-sub">MEMBROS COM ACESSO</div>
                    <div>{(cls.allowed_members||[]).map(m => <span key={m.id} style={{ fontFamily:'monospace', fontSize:11, background:`${cls.color}22`, color:cls.color, border:`1px solid ${cls.color}55`, borderRadius:20, padding:'3px 10px', margin:3, display:'inline-block' }}>✓ {m.name}</span>)}</div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* MEMBROS */}
      {tab === 'members' && (
        <div>
          <div className="card">
            <div className="card-title">NOVO MEMBRO</div>
            <div style={{ display:'flex', gap:10 }}>
              <input className="input" placeholder="Nome completo" value={nmName} onChange={e => setNmName(e.target.value)} onKeyDown={e => e.key==='Enter' && addMember()}/>
              <button className="green-btn" onClick={addMember}>ADICIONAR</button>
            </div>
          </div>
          {members.map(m => (
            <div key={m.id} className="card" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', marginBottom:8 }}>
              <div style={{ fontWeight:700, fontSize:17 }}>{m.name}</div>
              <button className="del-btn" onClick={async () => { await deleteMember(m.id); await reload(); }}>REMOVER</button>
            </div>
          ))}
        </div>
      )}

      {/* PROFESSORES */}
      {tab === 'teachers' && (
        <div>
          <div className="card">
            <div className="card-title">NOVO PROFESSOR</div>
            <div style={{ display:'flex', gap:10 }}>
              <input className="input" placeholder="Nome do professor" value={ntName} onChange={e => setNtName(e.target.value)} onKeyDown={e => e.key==='Enter' && addTeacher()}/>
              <button className="green-btn" onClick={addTeacher}>ADICIONAR</button>
            </div>
          </div>
          {teachers.map(t => (
            <div key={t.id} className="card" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', marginBottom:8 }}>
              <div style={{ fontWeight:700, fontSize:17 }}>{t.name}</div>
              <button className="del-btn" onClick={async () => { await deleteTeacher(t.id); await reload(); }}>REMOVER</button>
            </div>
          ))}
        </div>
      )}

      {/* CHECK-INS */}
      {tab === 'checkins' && (
        <div>
          <div className="sec-title" style={{ marginBottom:16 }}>
            <span>CHECK-INS DE HOJE</span>
            <span style={{ fontFamily:'monospace', fontSize:10, fontWeight:400 }}>{new Date().toLocaleDateString('pt-PT',{weekday:'long',day:'numeric',month:'long'}).toUpperCase()}</span>
          </div>
          {checkins.length === 0
            ? <div className="card" style={{ textAlign:'center', padding:24, fontFamily:'monospace', fontSize:12, color:'var(--muted)' }}>Sem check-ins hoje.</div>
            : Object.entries(checkins.reduce((acc, ci) => {
                if (!acc[ci.class_id]) acc[ci.class_id] = { name: ci.class_name, items: [] };
                acc[ci.class_id].items.push(ci);
                return acc;
              }, {})).map(([classId, { name, items }]) => {
                const cls = classes.find(c => c.id === classId);
                const color = cls?.color || '#85a800';
                return (
                  <div key={classId} className="card" style={{ borderLeft:`3px solid ${color}`, marginBottom:12 }}>
                    <div style={{ fontWeight:900, fontSize:16, marginBottom:12, letterSpacing:1 }}>{name.toUpperCase()}</div>
                    {items.map(ci => (
                      <div key={ci.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 12px', background:'var(--green-bg)', border:'1px solid var(--green-b)', borderRadius:8, marginBottom:6 }}>
                        <span style={{ fontWeight:700, fontSize:16, color:'var(--green)' }}>✓ {ci.member_name}</span>
                        <button className="del-btn" onClick={() => cancelCheckin(classId, ci.member_id)}>✕ REMOVER</button>
                      </div>
                    ))}
                  </div>
                );
              })
          }
        </div>
      )}
    </div>
  );
}