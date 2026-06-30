import { useState, useEffect } from 'react';
import { createMember, deleteMember, createTeacher, deleteTeacher, createClass, deleteClass, getCheckins, deleteCheckin } from '../api';
import api from '../api';

const DAYS    = ['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'];
const PALETTE = ['#C49A2A','#e74c3c','#1abc9c','#f39c12','#8e44ad','#e67e22','#16a085','#e91e63','#2980b9','#d35400','#27ae60','#f1c40f'];

export default function Admin({ members, teachers, classes, reload }) {
  const [tab, setTab]           = useState('classes');
  const [checkins, setCheckins] = useState([]);
  const [users, setUsers]       = useState([]);

  // Clientes financeiros (fonte de verdade para membros de aulas)
  const [financialClients, setFinancialClients] = useState([]);

  // Nova aula
  const [ncForm, setNcForm]               = useState({ name:'', day:0, time:'08:00', duration:60, teacher_id:'', color:PALETTE[0] });
  const [ncFilter, setNcFilter]           = useState('all');
  const [ncMembersSelected, setNcMembersSelected] = useState([]);
  const [ncAddMember, setNcAddMember]     = useState('');

  // Gerir membros de aula existente
  const [classEdit, setClassEdit]             = useState(null);
  const [classFilter, setClassFilter]         = useState('all');
  const [classMembersEdit, setClassMembersEdit] = useState([]);
  const [classAddMember, setClassAddMember]   = useState('');

  // Novo membro (com campos financeiros)
  const [nmForm, setNmForm] = useState({
    name:'', type:'PT', sessions:'1x', has_pack:false, has_insurance:false,
    professor_id:'', standard_value:'', value_to_professor:''
  });

  // Novo professor
  const [ntName, setNtName] = useState('');

  // Novo utilizador
  const [nuEmail, setNuEmail] = useState('');
  const [nuPass, setNuPass]   = useState('');
  const [nuName, setNuName]   = useState('');
  const [nuMsg, setNuMsg]     = useState('');

  const today = new Date().toISOString().slice(0,10);

  useEffect(() => { loadFinancialClients(); }, []);

  async function loadFinancialClients() {
    try {
      const { data } = await api.get('/finance/clients');
      setFinancialClients(data.filter(c => c.active));
    } catch(e) {}
  }

  async function loadCheckins() {
    const { data } = await getCheckins(today);
    setCheckins(data);
  }
  async function loadUsers() {
    const { data } = await api.get('/auth/users');
    setUsers(data);
  }
  function handleTab(t) {
    setTab(t);
    if (t==='checkins') loadCheckins();
    if (t==='users')    loadUsers();
  }

  // ── Membros ──────────────────────────────────────────────────────────
  async function addMember() {
    if (!nmForm.name.trim()) return;
    await createMember({
      name: nmForm.name.trim(),
      type: nmForm.type,
      sessions: nmForm.sessions,
      has_pack: nmForm.has_pack,
      has_insurance: nmForm.has_insurance,
      professor_id: nmForm.professor_id || null,
      standard_value: Number(nmForm.standard_value) || 0,
      value_to_professor: Number(nmForm.value_to_professor) || 0,
    });
    setNmForm({ name:'', type:'PT', sessions:'1x', has_pack:false, has_insurance:false, professor_id:'', standard_value:'', value_to_professor:'' });
    await reload();
  }

  // ── Professores ──────────────────────────────────────────────────────
  async function addTeacher() {
    if (!ntName.trim()) return;
    await createTeacher(ntName.trim()); setNtName(''); await reload();
  }

  // ── Aulas ────────────────────────────────────────────────────────────
  function filterClients(f) {
    if (f === 'pilates') return financialClients.filter(c => c.type === 'Pilates');
    if (f === 'pack')    return financialClients.filter(c => c.has_pack);
    return financialClients;
  }

  async function addNewClass() {
    if (!ncForm.name.trim()) return;
    const { data: cls } = await createClass({ ...ncForm, teacher_id: ncForm.teacher_id||null });
    if (ncMembersSelected.length) {
      await api.post(`/classes/${cls.id}/set-financial-members`, { financial_client_ids: ncMembersSelected });
    }
    setNcForm({ name:'', day:0, time:'08:00', duration:60, teacher_id:'', color:PALETTE[0] });
    setNcMembersSelected([]); setNcAddMember(''); setNcFilter('all');
    await reload();
  }

  function openClassEdit(cls) {
    setClassEdit(cls.id);
    setClassFilter('all');
    setClassAddMember('');
    // Mapeia nomes dos membros atuais para IDs de financial_clients
    const fcIds = (cls.allowed_members || []).map(m => {
      const fc = financialClients.find(c => c.name.toLowerCase().trim() === m.name.toLowerCase().trim());
      return fc?.id;
    }).filter(Boolean);
    setClassMembersEdit(fcIds);
  }

  async function saveClassMembers(cls) {
    await api.post(`/classes/${cls.id}/set-financial-members`, { financial_client_ids: classMembersEdit });
    setClassEdit(null); setClassAddMember('');
    await reload();
  }

  // ── Check-ins ────────────────────────────────────────────────────────
  async function cancelCheckin(classId, memberId) {
    await deleteCheckin({ class_id: classId, member_id: memberId, date: today });
    await loadCheckins(); await reload();
  }

  // ── Utilizadores ─────────────────────────────────────────────────────
  async function createUser() {
    if (!nuEmail.trim()||!nuPass.trim()) return;
    try {
      await api.post('/auth/register',{ email:nuEmail, password:nuPass, name:nuName });
      setNuMsg('✓ Utilizador criado!'); setNuEmail(''); setNuPass(''); setNuName('');
      loadUsers();
    } catch(e) { setNuMsg('✗ '+(e.response?.data?.error||'Erro')); }
    setTimeout(()=>setNuMsg(''),3000);
  }

  const inp = { background:'var(--card2)', border:'1px solid var(--border2)', borderRadius:8, color:'var(--text)', padding:'9px 12px', fontFamily:'Space Mono,monospace', fontSize:12, outline:'none', width:'100%' };
  const lbl = { color:'var(--muted)', fontSize:10, fontFamily:'Space Mono,monospace', marginBottom:4, letterSpacing:1, display:'block' };

  // UI para selecionar membros (usado em Nova Aula e edição de aula existente)
  function MemberPicker({ color, selected, setSelected, addVal, setAddVal, filter, setFilter }) {
    return (
      <div>
        <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:8,minHeight:28}}>
          {selected.length === 0
            ? <span style={{fontFamily:'monospace',fontSize:11,color:'var(--muted)'}}>Nenhum membro selecionado</span>
            : selected.map(fcId => {
                const fc = financialClients.find(c => c.id === fcId);
                if (!fc) return null;
                return <span key={fcId} style={{display:'inline-flex',alignItems:'center',gap:4,background:`${color}22`,color,border:`1px solid ${color}55`,borderRadius:20,padding:'3px 10px',fontSize:11}}>
                  ✓ {fc.name}
                  <button onClick={()=>setSelected(prev=>prev.filter(x=>x!==fcId))} style={{background:'none',border:'none',color,cursor:'pointer',fontSize:13,lineHeight:1,padding:'0 2px'}}>✕</button>
                </span>;
              })
          }
        </div>
        <div style={{display:'flex',gap:6,alignItems:'center'}}>
          <select className="input" value={filter} onChange={e=>{setFilter(e.target.value);setAddVal('');}} style={{width:'auto',padding:'6px 10px',fontSize:11}}>
            <option value="all">Todos</option>
            <option value="pilates">Pilates</option>
            <option value="pack">Pack</option>
          </select>
          <select className="input" value={addVal} onChange={e=>setAddVal(e.target.value)} style={{flex:1,padding:'6px 10px',fontSize:11}}>
            <option value="">— selecionar cliente —</option>
            {filterClients(filter).filter(c=>!selected.includes(c.id)).map(c=>(
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button
            onClick={()=>{if(addVal){setSelected(prev=>prev.includes(addVal)?prev:[...prev,addVal]);setAddVal('');}}}
            style={{background:'var(--accent-bg)',border:'1px solid var(--accent)',color:'var(--accent)',borderRadius:6,padding:'6px 14px',fontSize:13,fontWeight:700,cursor:'pointer'}}
          >+</button>
        </div>
      </div>
    );
  }

  return (
    <div id="admin-view">
      <div className="sec-title"><span>ADMINISTRAÇÃO</span></div>

      <div className="tab-btns">
        {[['classes','Aulas'],['teachers','Professores'],['checkins','Check-ins'],['users','Utilizadores']].map(([v,l])=>(
          <button key={v} className={`tab-btn ${tab===v?'active':''}`} onClick={()=>handleTab(v)}>{l}</button>
        ))}
      </div>

      {/* ── AULAS ───────────────────────────────────── */}
      {tab==='classes' && (
        <div>
          <div className="card">
            <div className="card-title">NOVA AULA</div>
            <div className="form-grid">
              <input className="input" placeholder="Nome da aula" value={ncForm.name} onChange={e=>setNcForm(f=>({...f,name:e.target.value}))}/>
              <select className="input" value={ncForm.day} onChange={e=>setNcForm(f=>({...f,day:+e.target.value}))}>
                {DAYS.map((d,i)=><option key={i} value={i}>{d}</option>)}
              </select>
              <input className="input" type="time" value={ncForm.time} onChange={e=>setNcForm(f=>({...f,time:e.target.value}))}/>
              <input className="input" type="number" min="15" max="180" step="15" value={ncForm.duration} onChange={e=>setNcForm(f=>({...f,duration:+e.target.value}))}/>
            </div>
            <div className="form-row">
              <div>
                <div className="input-label">PROFESSOR</div>
                <select className="input" value={ncForm.teacher_id} onChange={e=>setNcForm(f=>({...f,teacher_id:e.target.value}))}>
                  <option value="">— sem professor —</option>
                  {teachers.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <div className="input-label">COR</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:7}}>
                  {PALETTE.map(c=>(
                    <div key={c} onClick={()=>setNcForm(f=>({...f,color:c}))} style={{width:22,height:22,borderRadius:'50%',background:c,cursor:'pointer',border:ncForm.color===c?'3px solid var(--text)':'3px solid transparent'}}/>
                  ))}
                </div>
              </div>
            </div>
            <div className="input-label" style={{marginBottom:8}}>MEMBROS PERMITIDOS</div>
            <MemberPicker
              color={ncForm.color}
              selected={ncMembersSelected} setSelected={setNcMembersSelected}
              addVal={ncAddMember} setAddVal={setNcAddMember}
              filter={ncFilter} setFilter={setNcFilter}
            />
            <button className="green-btn" style={{marginTop:14}} onClick={addNewClass}>CRIAR AULA</button>
          </div>

          {DAYS.map((day,idx)=>{
            const dayCls=classes.filter(c=>c.day===idx); if(!dayCls.length) return null;
            return(<div key={idx}><div className="admin-day-title">{day.toUpperCase()}</div>
              {dayCls.map(cls=>(
                <div key={cls.id} className="cls-row" style={{borderLeft:`3px solid ${cls.color||'#85a800'}`}}>
                  <div className="cls-row-top">
                    <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                      <span style={{width:8,height:8,borderRadius:'50%',background:cls.color,display:'inline-block'}}/>
                      <span className="cls-row-name">{cls.name.toUpperCase()}</span>
                      <span className="cls-row-time" style={{color:cls.color}}>{cls.time}</span>
                      <span className="cls-row-dur">{cls.duration}min</span>
                    </div>
                    <button className="del-btn" onClick={async()=>{await deleteClass(cls.id);await reload();}}>REMOVER</button>
                  </div>

                  {classEdit === cls.id ? (
                    <div>
                      <div className="section-sub">MEMBROS COM ACESSO</div>
                      <div style={{marginBottom:10}}>
                        <MemberPicker
                          color={cls.color||'#85a800'}
                          selected={classMembersEdit} setSelected={setClassMembersEdit}
                          addVal={classAddMember} setAddVal={setClassAddMember}
                          filter={classFilter} setFilter={setClassFilter}
                        />
                      </div>
                      <div style={{display:'flex',gap:6}}>
                        <button onClick={()=>saveClassMembers(cls)} style={{background:'var(--green-bg)',border:'1px solid var(--green-b)',color:'var(--green)',borderRadius:6,padding:'5px 12px',fontSize:11,fontWeight:700,cursor:'pointer'}}>✓ GUARDAR</button>
                        <button onClick={()=>{setClassEdit(null);setClassAddMember('');}} style={{background:'none',border:'1px solid var(--border)',color:'var(--muted)',borderRadius:6,padding:'5px 12px',fontSize:11,cursor:'pointer'}}>CANCELAR</button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="section-sub">MEMBROS COM ACESSO</div>
                      <div style={{marginBottom:8}}>
                        {(cls.allowed_members||[]).length===0
                          ? <span style={{fontFamily:'monospace',fontSize:11,color:'var(--muted)'}}>Nenhum membro</span>
                          : (cls.allowed_members||[]).map(m=><span key={m.id} style={{fontFamily:'monospace',fontSize:11,background:`${cls.color}22`,color:cls.color,border:`1px solid ${cls.color}55`,borderRadius:20,padding:'3px 10px',margin:3,display:'inline-block'}}>✓ {m.name}</span>)
                        }
                      </div>
                      <button onClick={()=>openClassEdit(cls)} style={{background:'var(--accent-bg)',border:'1px solid var(--accent)',color:'var(--accent)',borderRadius:6,padding:'4px 10px',fontSize:10,fontWeight:700,cursor:'pointer',letterSpacing:1}}>+ GERIR MEMBROS</button>
                    </div>
                  )}
                </div>
              ))}
            </div>);
          })}
        </div>
      )}

      {/* ── MEMBROS ─────────────────────────────────── */}
      {tab==='members' && (
        <div>
          <div className="card">
            <div className="card-title">NOVO MEMBRO</div>
            <div style={{marginBottom:12}}>
              <label style={lbl}>NOME</label>
              <input style={inp} placeholder="Nome completo" value={nmForm.name} onChange={e=>setNmForm(f=>({...f,name:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&addMember()}/>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:12}}>
              <div>
                <label style={lbl}>TIPO</label>
                <select style={inp} value={nmForm.type} onChange={e=>setNmForm(f=>({...f,type:e.target.value}))}>
                  <option>PT</option><option>Pilates</option><option>Grupo</option><option>Outro</option>
                </select>
              </div>
              <div>
                <label style={lbl}>SESSÕES</label>
                <select style={inp} value={nmForm.sessions} onChange={e=>setNmForm(f=>({...f,sessions:e.target.value}))}>
                  <option value="1x">1x/semana</option>
                  <option value="2x">2x/semana</option>
                  <option value="3x">3x/semana</option>
                  <option value="grupo">Grupo</option>
                </select>
              </div>
              <div>
                <label style={lbl}>PROFESSOR</label>
                <select style={inp} value={nmForm.professor_id} onChange={e=>setNmForm(f=>({...f,professor_id:e.target.value}))}>
                  <option value="">— sem professor —</option>
                  {teachers.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
              <div>
                <label style={lbl}>VALOR STANDARD (€/mês)</label>
                <input style={inp} type="number" placeholder="0" value={nmForm.standard_value} onChange={e=>setNmForm(f=>({...f,standard_value:e.target.value}))}/>
              </div>
              <div>
                <label style={lbl}>VALOR A PAGAR AO PROFESSOR (€/mês)</label>
                <input style={inp} type="number" placeholder="0" value={nmForm.value_to_professor} onChange={e=>setNmForm(f=>({...f,value_to_professor:e.target.value}))}/>
              </div>
            </div>
            {(nmForm.standard_value || nmForm.value_to_professor) ? (
              <div style={{background:'var(--accent-bg)',border:'1px solid var(--accent)',borderRadius:8,padding:'10px 14px',marginBottom:12,fontSize:12}}>
                <span style={{color:'var(--muted)'}}>Valor a pagar ao Habitus: </span>
                <strong style={{color:'var(--accent)'}}>{(Number(nmForm.standard_value||0) - Number(nmForm.value_to_professor||0)).toFixed(2)} €</strong>
              </div>
            ) : null}
            <div style={{display:'flex',gap:20,marginBottom:16}}>
              <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13}}>
                <input type="checkbox" checked={nmForm.has_pack} onChange={e=>setNmForm(f=>({...f,has_pack:e.target.checked}))} style={{width:16,height:16}}/>
                Tem Pack
              </label>
              <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13}}>
                <input type="checkbox" checked={nmForm.has_insurance} onChange={e=>setNmForm(f=>({...f,has_insurance:e.target.checked}))} style={{width:16,height:16}}/>
                Tem Seguro
              </label>
            </div>
            <button className="green-btn" onClick={addMember}>ADICIONAR MEMBRO</button>
          </div>
          {members.map(m=>(
            <div key={m.id} className="card" style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',marginBottom:8}}>
              <div>
                <div style={{fontWeight:700,fontSize:17}}>{m.name}</div>
                <div style={{fontFamily:'monospace',fontSize:10,color:'var(--muted)',marginTop:2}}>
                  {classes.filter(c=>c.allowed_members?.some(x=>x.id===m.id)).length} aulas com acesso
                </div>
              </div>
              <button className="del-btn" onClick={async()=>{await deleteMember(m.id);await reload();}}>REMOVER</button>
            </div>
          ))}
        </div>
      )}

      {/* ── PROFESSORES ─────────────────────────────── */}
      {tab==='teachers' && (
        <div>
          <div className="card"><div className="card-title">NOVO PROFESSOR</div>
            <div style={{display:'flex',gap:10}}>
              <input className="input" placeholder="Nome do professor" value={ntName} onChange={e=>setNtName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addTeacher()}/>
              <button className="green-btn" onClick={addTeacher}>ADICIONAR</button>
            </div>
          </div>
          {teachers.map(t=>(
            <div key={t.id} className="card" style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',marginBottom:8}}>
              <div style={{fontWeight:700,fontSize:17}}>{t.name}</div>
              <button className="del-btn" onClick={async()=>{await deleteTeacher(t.id);await reload();}}>REMOVER</button>
            </div>
          ))}
        </div>
      )}

      {/* ── CHECK-INS ───────────────────────────────── */}
      {tab==='checkins' && (
        <div>
          <div className="sec-title" style={{marginBottom:16}}>
            <span>CHECK-INS DE HOJE</span>
            <span style={{fontFamily:'monospace',fontSize:10,fontWeight:400}}>{new Date().toLocaleDateString('pt-PT',{weekday:'long',day:'numeric',month:'long'}).toUpperCase()}</span>
          </div>
          {checkins.length===0
            ? <div className="card" style={{textAlign:'center',padding:24,fontFamily:'monospace',fontSize:12,color:'var(--muted)'}}>Sem check-ins hoje.</div>
            : Object.entries(checkins.reduce((acc,ci)=>{
                if(!acc[ci.class_id])acc[ci.class_id]={name:ci.class_name,items:[]};
                acc[ci.class_id].items.push(ci); return acc;
              },{})).map(([classId,{name,items}])=>{
                const cls=classes.find(c=>c.id===classId); const color=cls?.color||'#85a800';
                return(
                  <div key={classId} className="card" style={{borderLeft:`3px solid ${color}`,marginBottom:12}}>
                    <div style={{fontWeight:900,fontSize:16,marginBottom:12,letterSpacing:1}}>{name.toUpperCase()}</div>
                    {items.map(ci=>(
                      <div key={ci.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 12px',background:'var(--green-bg)',border:'1px solid var(--green-b)',borderRadius:8,marginBottom:6}}>
                        <span style={{fontWeight:700,fontSize:16,color:'var(--green)'}}>✓ {ci.member_name}</span>
                        <button className="del-btn" onClick={()=>cancelCheckin(classId,ci.member_id)}>✕ REMOVER</button>
                      </div>
                    ))}
                  </div>
                );
              })
          }
        </div>
      )}

      {/* ── UTILIZADORES ────────────────────────────── */}
      {tab==='users' && (
        <div>
          <div className="card">
            <div className="card-title">CRIAR UTILIZADOR</div>
            <div style={{marginBottom:12}}><div className="input-label">NOME</div><input className="input" placeholder="Nome" value={nuName} onChange={e=>setNuName(e.target.value)}/></div>
            <div style={{marginBottom:12}}><div className="input-label">EMAIL</div><input className="input" type="email" placeholder="email@exemplo.com" value={nuEmail} onChange={e=>setNuEmail(e.target.value)}/></div>
            <div style={{marginBottom:16}}><div className="input-label">PASSWORD</div><input className="input" type="password" placeholder="••••••••" value={nuPass} onChange={e=>setNuPass(e.target.value)}/></div>
            {nuMsg&&<div style={{padding:'10px 14px',borderRadius:8,fontFamily:'monospace',fontSize:11,marginBottom:14,background:nuMsg.startsWith('✓')?'var(--green-bg)':'var(--red-bg)',color:nuMsg.startsWith('✓')?'var(--green)':'var(--red)',border:`1px solid ${nuMsg.startsWith('✓')?'var(--green-b)':'var(--red-b)'}`}}>{nuMsg}</div>}
            <button className="green-btn" onClick={createUser}>CRIAR UTILIZADOR</button>
          </div>
          <div className="admin-day-title">UTILIZADORES COM ACESSO</div>
          {users.map(u=>(
            <div key={u.id} className="card" style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',marginBottom:8}}>
              <div><div style={{fontWeight:700,fontSize:17}}>{u.name}</div><div style={{fontFamily:'monospace',fontSize:10,color:'var(--muted)',marginTop:2}}>{u.email}</div></div>
              <button className="del-btn" onClick={async()=>{await api.delete(`/auth/users/${u.id}`);loadUsers();}}>REMOVER</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
