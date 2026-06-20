import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import api from '../api';

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const fmt = v => !v && v!==0 ? '—' : v===0 ? '0 €' : (Math.round(v*10)/10)%1===0 ? Math.round(v)+' €' : (Math.round(v*10)/10).toFixed(1)+' €';
const TAG = { PT:{bg:'#E6F1FB',c:'#185FA5'}, Pilates:{bg:'#E1F5EE',c:'#0F6E56'}, Grupo:{bg:'#FAEEDA',c:'#854F0B'} };
const getTag = t => TAG[t] || {bg:'var(--card2)',c:'var(--muted)'};

export default function Finance() {
  const [view, setView]       = useState('month');
  const [month, setMonth]     = useState('Jun');
  const [tab, setTab]         = useState('clients');
  const [filter, setFilter]   = useState('all');

  const [clients, setClients]   = useState([]);
  const [values, setValues]     = useState([]);
  const [payments, setPayments] = useState([]);
  const [costs, setCosts]       = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [tSessions, setTSessions] = useState([]);
  const [annualData, setAnnualData] = useState([]);
  const [loading, setLoading]   = useState(true);

  // Edit states
  const [editVal, setEditVal]         = useState(null); // {client_id}
  const [editForm, setEditForm]       = useState({});
  const [editSessVal, setEditSessVal] = useState({});

  // Novo cliente
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClient, setNewClient] = useState({ name:'', type:'PT', sessions:'1x', standard_value:'', value_to_professor:'', professor_id:'', has_pack:false, has_insurance:false, has_invoice:false });

  // Despesas
  const [newCost, setNewCost] = useState({ label:'', value:'', type:'regular', expense_date:'' });
  // Sessões
  const [newSession, setNewSession] = useState({ teacher_id:'', session_date:'', notes:'' });

  const year = 2026;

  useEffect(() => { loadAll(); }, [month]);
  useEffect(() => { if(view==='annual') loadAnnual(); }, [view]);

  async function loadAll() {
    setLoading(true);
    const [c,v,p,fc,t,ts] = await Promise.allSettled([
      api.get('/finance/clients'),
      api.get(`/finance/values?month=${month}&year=${year}`),
      api.get(`/finance/payments?month=${month}&year=${year}`),
      api.get(`/finance/costs?month=${month}&year=${year}`),
      api.get('/finance/teachers'),
      api.get(`/finance/teacher-sessions/month?month=${month}&year=${year}`),
    ]);
    if (c.status==='fulfilled') setClients(c.value.data);
    if (v.status==='fulfilled') setValues(v.value.data);
    if (p.status==='fulfilled') setPayments(p.value.data);
    if (fc.status==='fulfilled') setCosts(fc.value.data);
    if (t.status==='fulfilled') setTeachers(t.value.data);
    if (ts.status==='fulfilled') setTSessions(ts.value.data);
    setLoading(false);
  }

  async function loadAnnual() {
    try { const {data}=await api.get(`/finance/annual?year=${year}`); setAnnualData(data); }
    catch(e) { console.error(e); }
  }

  const getVal       = cid => values.find(v=>v.client_id===cid);
  const getValue     = cid => Number(getVal(cid)?.value||0);
  const getProfValue = cid => Number(getVal(cid)?.professor_value||0);
  const getHabValue  = cid => getValue(cid) - getProfValue(cid);
  const isPaid       = cid => payments.find(p=>p.client_id===cid)?.paid===true;
  const getDate      = cid => payments.find(p=>p.client_id===cid)?.payment_date||'';
  const getSessions  = tid => tSessions.filter(s=>s.teacher_id===tid);
  const getClientProfTotal = tid => withVal
    .filter(c => (getVal(c.id)?.monthly_professor_id || c.professor_id) === tid)
    .reduce((s,c) => s + getProfValue(c.id), 0);

  // Toggle pagamento
  async function toggle(client) {
    const was = isPaid(client.id);
    const date = was ? '' : new Date().toLocaleDateString('pt-PT',{day:'2-digit',month:'2-digit',year:'numeric'});
    await api.post('/finance/payments',{client_id:client.id,month,year,paid:!was,payment_date:date});
    await loadAll();
  }

  // Toggle fatura (has_invoice)
  async function toggleInvoice(c) {
    await api.put(`/finance/clients/${c.id}`, {
      name: c.name, type: c.type, sessions: c.sessions, active: c.active,
      has_pack: c.has_pack, has_insurance: c.has_insurance, has_invoice: !c.has_invoice,
      professor_id: c.professor_id || null, standard_value: c.standard_value,
      value_to_professor: c.value_to_professor,
    });
    await loadAll();
  }

  // Guardar valor mensal com split
  async function saveValue(cid) {
    const f = editForm;
    await api.post('/finance/values',{
      client_id: cid, month, year,
      value: Number(f.value||0),
      professor_value: Number(f.professor_value||0),
      monthly_professor_id: f.monthly_professor_id||null,
      monthly_has_pack: f.monthly_has_pack,
      is_new_standard: f.is_new_standard||false,
    });
    // Atualiza has_invoice no registo do cliente
    const client = active.find(c => c.id === cid);
    if (client) {
      await api.put(`/finance/clients/${cid}`, {
        name: client.name, type: client.type, sessions: client.sessions, active: client.active,
        has_pack: client.has_pack, has_insurance: client.has_insurance, has_invoice: f.has_invoice || false,
        professor_id: client.professor_id || null, standard_value: client.standard_value,
        value_to_professor: client.value_to_professor,
      });
    }
    setEditVal(null); setEditForm({});
    await loadAll();
  }

  function openEdit(c) {
    const v = getVal(c.id);
    setEditVal(c.id);
    setEditForm({
      value: v?.value ?? c.standard_value ?? 0,
      professor_value: v?.professor_value ?? c.value_to_professor ?? 0,
      monthly_professor_id: v?.monthly_professor_id || c.professor_id || '',
      monthly_has_pack: v?.monthly_has_pack ?? c.has_pack ?? false,
      is_new_standard: false,
      has_invoice: c.has_invoice || false,
    });
  }

  // Copy previous month
  async function copyMonth() {
    if (!confirm(`Copiar valores do mês anterior para ${month}?`)) return;
    await api.post('/finance/values/copy-month',{month,year});
    await loadAll();
  }

  async function resetMonth() {
    if (!confirm(`Limpar pagamentos de ${month}?`)) return;
    await api.delete('/finance/payments/reset',{data:{month,year}});
    await loadAll();
  }

  // Novo cliente financeiro
  async function deactivateClient(c) {
    if (!confirm(`Remover "${c.name}"?\nOs dados dos meses anteriores são mantidos.`)) return;
    try {
      await api.delete(`/finance/clients/${c.id}`);
      await loadAll();
    } catch(e) { alert('Erro: ' + (e.response?.data?.error || e.message)); }
  }

  async function addClient() {
    if (!newClient.name.trim()) return;
    try {
      const { data: client } = await api.post('/finance/clients', {
        name: newClient.name.trim(),
        type: newClient.type,
        sessions: newClient.sessions,
        standard_value: Number(newClient.standard_value) || 0,
        value_to_professor: Number(newClient.value_to_professor) || 0,
        professor_id: newClient.professor_id || null,
        has_pack: newClient.has_pack,
        has_insurance: newClient.has_insurance,
      });
      await api.post('/finance/values', {
        client_id: client.id,
        month, year,
        value: Number(newClient.standard_value) || 0,
        professor_value: Number(newClient.value_to_professor) || 0,
        monthly_professor_id: newClient.professor_id || null,
        monthly_has_pack: newClient.has_pack,
        is_new_standard: false,
      });
      setNewClient({ name:'', type:'PT', sessions:'1x', standard_value:'', value_to_professor:'', professor_id:'', has_pack:false, has_insurance:false, has_invoice:false });
      setShowNewClient(false);
      await loadAll();
    } catch(e) {
      alert('Erro ao guardar: ' + (e.response?.data?.error || e.message));
    }
  }

  // Despesas
  async function addCost() {
    if (!newCost.label.trim()||!newCost.value) return;
    await api.post('/finance/costs',{month,year,label:newCost.label,value:Number(newCost.value),type:newCost.type,expense_date:newCost.expense_date||null});
    setNewCost({label:'',value:'',type:'regular',expense_date:''});
    await loadAll();
  }

  // Sessões
  async function addSession() {
    if (!newSession.teacher_id||!newSession.session_date) return;
    await api.post('/finance/teacher-sessions',{...newSession,month,year});
    setNewSession({teacher_id:'',session_date:'',notes:''});
    await loadAll();
  }
  async function saveSessionValue(tid,val) {
    await api.put(`/finance/teachers/${tid}/session-value`,{value_per_session:Number(val)});
    setEditSessVal({}); await loadAll();
  }

  // Excel
  function exportExcel() {
    const wb = XLSX.utils.book_new();
    const rows = clients.filter(c=>c.active&&getValue(c.id)>0).map(c=>({
      Cliente:c.name, Tipo:c.type, Pack:c.has_pack?'Sim':'Não', Seguro:c.has_insurance?'Sim':'Não',
      'Valor Total':getValue(c.id), 'Valor Habitus':getHabValue(c.id), 'Valor Professor':getProfValue(c.id),
      Pago:isPaid(c.id)?'Sim':'Não', Data:getDate(c.id),
    }));
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),`${month} ${year}`);
    if (annualData.length) XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(annualData.map(r=>({Mês:r.month,Previsto:r.previsto,Recebido:r.recebido,Custos:r.custos,Lucro:r.lucro}))),`Anual ${year}`);
    XLSX.writeFile(wb,`habitus_${month}_${year}.xlsx`);
  }

  // Cálculos
  const active     = clients.filter(c=>c.active);
  const withVal    = active.filter(c=>getValue(c.id)>0);
  const total      = withVal.reduce((s,c)=>s+getValue(c.id),0);
  const received   = withVal.filter(c=>isPaid(c.id)).reduce((s,c)=>s+getValue(c.id),0);
  const perc       = total>0?Math.round(received/total*100):0;
  const regularCosts  = costs.filter(c=>c.type==='regular');
  const sporadicCosts = costs.filter(c=>c.type==='sporadic');
  const fcTotal    = costs.reduce((s,c)=>s+Number(c.value),0);
  // Custo dos professores = sessões × valor/sessão
  const tcTotal    = teachers.reduce((s,t)=>s+getSessions(t.id).length*Number(t.value_per_session||0),0);
  // + valor prof por cliente (se definido)
  const clientProfTotal = withVal.reduce((s,c)=>s+getProfValue(c.id),0);
  const ivaTotal = withVal.filter(c=>c.has_invoice).reduce((s,c)=>s+getHabValue(c.id)*0.23,0);
  const totalCosts = fcTotal + tcTotal;
  const profit     = received - totalCosts - clientProfTotal - ivaTotal;
  const projected  = total - totalCosts - withVal.reduce((s,c)=>s+getProfValue(c.id),0) - withVal.filter(c=>c.has_invoice).reduce((s,c)=>s+getHabValue(c.id)*0.23,0);

  let tableClients = active;
  if (filter==='paid')   tableClients = tableClients.filter(c=>isPaid(c.id));
  if (filter==='unpaid') tableClients = tableClients.filter(c=>!isPaid(c.id));

  const s = {
    card:  {background:'var(--card2)',borderRadius:8,padding:'12px 14px',border:'1px solid var(--border)'},
    panel: {background:'var(--card)',border:'1px solid var(--border)',borderRadius:10,overflow:'hidden'},
    pHdr:  {background:'var(--card2)',padding:'8px 12px',fontSize:10,fontWeight:500,letterSpacing:2,textTransform:'uppercase',color:'var(--muted)',borderBottom:'1px solid var(--border)'},
    crow:  {display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 12px',borderBottom:'1px solid var(--border)',fontSize:12},
  };

  if (loading) return <div style={{textAlign:'center',padding:40,fontFamily:'monospace',fontSize:12,color:'var(--muted)'}}>A carregar...</div>;

  return (
    <div>
      <div className="sec-title">
        <span>FINANCEIRO</span>
        <button onClick={exportExcel} style={{fontFamily:'Barlow Condensed,sans-serif',fontWeight:700,letterSpacing:1,textTransform:'uppercase',background:'var(--text)',color:'#fff',padding:'5px 14px',borderRadius:8,fontSize:11,border:'none',cursor:'pointer'}}>⬇ Excel</button>
      </div>

      {/* View toggle */}
      <div style={{display:'flex',border:'1px solid var(--border)',borderRadius:8,overflow:'hidden',marginBottom:20,maxWidth:300}}>
        {[['month','Mensal'],['annual','Evolução Anual']].map(([v,l])=>(
          <button key={v} onClick={()=>setView(v)} style={{flex:1,padding:'8px',fontSize:11,fontWeight:500,letterSpacing:1,textTransform:'uppercase',cursor:'pointer',background:view===v?'var(--accent-bg)':'var(--card)',color:view===v?'var(--accent)':'var(--muted)',border:'none',borderRight:'1px solid var(--border)'}}>{l}</button>
        ))}
      </div>

      {/* ── ANUAL ─────────────────────────────────────── */}
      {view==='annual' && (
        <div style={{border:'1px solid var(--border)',borderRadius:10,overflow:'hidden'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr style={{background:'var(--card2)'}}>
              {['Mês','Previsto','Recebido','Custos','Lucro'].map((h,i)=>(
                <th key={h} style={{textAlign:i===0?'left':'right',fontSize:10,fontWeight:500,letterSpacing:2,textTransform:'uppercase',color:'var(--muted)',padding:'9px 12px',borderBottom:'1px solid var(--border)'}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {annualData.map(r=>(
                <tr key={r.month} style={{borderBottom:'1px solid var(--border)',background:r.month===month?'var(--accent-bg)':undefined}}>
                  <td style={{padding:'9px 12px',fontSize:12,fontWeight:r.month===month?700:400}}>{r.month}</td>
                  <td style={{padding:'9px 12px',fontSize:12,textAlign:'right',color:'var(--muted)'}}>{fmt(r.previsto)}</td>
                  <td style={{padding:'9px 12px',fontSize:12,textAlign:'right',color:'var(--green)'}}>{fmt(r.recebido)}</td>
                  <td style={{padding:'9px 12px',fontSize:12,textAlign:'right',color:'var(--red)'}}>{fmt(r.custos)}</td>
                  <td style={{padding:'9px 12px',fontSize:12,textAlign:'right',color:r.lucro>=0?'var(--green)':'var(--red)',fontWeight:600}}>{fmt(r.lucro)}</td>
                </tr>
              ))}
              {annualData.length>0&&(()=>{
                const tot=annualData.reduce((a,r)=>({previsto:a.previsto+r.previsto,recebido:a.recebido+r.recebido,custos:a.custos+r.custos,lucro:a.lucro+r.lucro}),{previsto:0,recebido:0,custos:0,lucro:0});
                return <tr style={{background:'var(--card2)',fontWeight:700,borderTop:'2px solid var(--border2)'}}>
                  <td style={{padding:'9px 12px',fontSize:12}}>TOTAL</td>
                  <td style={{padding:'9px 12px',fontSize:12,textAlign:'right',color:'var(--muted)'}}>{fmt(tot.previsto)}</td>
                  <td style={{padding:'9px 12px',fontSize:12,textAlign:'right',color:'var(--green)'}}>{fmt(tot.recebido)}</td>
                  <td style={{padding:'9px 12px',fontSize:12,textAlign:'right',color:'var(--red)'}}>{fmt(tot.custos)}</td>
                  <td style={{padding:'9px 12px',fontSize:12,textAlign:'right',color:tot.lucro>=0?'var(--green)':'var(--red)'}}>{fmt(tot.lucro)}</td>
                </tr>;
              })()}
            </tbody>
          </table>
        </div>
      )}

      {/* ── MENSAL ────────────────────────────────────── */}
      {view==='month' && (<>

        {/* Cards */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:12}}>
          {[['Previsto',fmt(total),'var(--text)'],['Recebido',fmt(received),'var(--green)'],['Por receber',fmt(total-received),'var(--red)'],['% Cobrado',perc+'%','var(--muted)']].map(([l,v,c])=>(
            <div key={l} style={s.card}><div style={{fontSize:22,fontWeight:500,color:c}}>{v}</div><div style={{fontSize:10,color:'var(--muted)',textTransform:'uppercase',letterSpacing:1.5,marginTop:2}}>{l}</div></div>
          ))}
        </div>

        {/* Progress */}
        <div style={{background:'var(--border)',borderRadius:4,height:4,marginBottom:20,overflow:'hidden'}}>
          <div style={{height:'100%',width:`${perc}%`,background:'var(--accent)',borderRadius:4,transition:'width .4s'}}/>
        </div>

        {/* Painéis */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:20}}>
          <div style={s.panel}>
            <div style={s.pHdr}>Despesas</div>
            <div style={s.crow}><span style={{color:'var(--muted)'}}>Regulares</span><span>{fmt(regularCosts.reduce((s,c)=>s+Number(c.value),0))}</span></div>
            <div style={s.crow}><span style={{color:'var(--muted)'}}>Esporádicas</span><span>{fmt(sporadicCosts.reduce((s,c)=>s+Number(c.value),0))}</span></div>
            <div style={s.crow}><span style={{color:'var(--muted)'}}>Prof. clientes</span><span>{fmt(clientProfTotal)}</span></div>
            {ivaTotal>0&&<div style={s.crow}><span style={{color:'var(--muted)'}}>IVA (23%)</span><span>{fmt(ivaTotal)}</span></div>}
            <div style={{...s.crow,fontWeight:500}}><span style={{color:'var(--muted)'}}>Total</span><span style={{color:'var(--red)'}}>{fmt(fcTotal+clientProfTotal+ivaTotal)}</span></div>
          </div>
          <div style={s.panel}>
            <div style={s.pHdr}>Professores</div>
            {teachers.map(t=>{
              const sess=getSessions(t.id); const vps=Number(t.value_per_session||0);
              const sessTotal=sess.length*vps; const cliTotal=getClientProfTotal(t.id);
              return(
                <div key={t.id} style={s.crow}>
                  <span style={{color:'var(--muted)'}}>{t.name}</span>
                  <div style={{textAlign:'right'}}>
                    {cliTotal>0&&<div style={{fontSize:10,color:'var(--muted)'}}>clientes {fmt(cliTotal)}</div>}
                    {sessTotal>0&&<div style={{fontSize:10,color:'var(--muted)'}}>sessões {fmt(sessTotal)}</div>}
                    <b>{fmt(sessTotal+cliTotal)}</b>
                  </div>
                </div>
              );
            })}
            <div style={{...s.crow,fontWeight:500}}><span style={{color:'var(--muted)'}}>Total</span><span style={{color:'var(--red)'}}>{fmt(tcTotal+clientProfTotal)}</span></div>
          </div>
          <div style={s.panel}>
            <div style={s.pHdr}>Resultado</div>
            <div style={s.crow}><span style={{color:'var(--muted)'}}>Receita recebida</span><span>{fmt(received)}</span></div>
            <div style={s.crow}><span style={{color:'var(--muted)'}}>Total custos</span><span style={{color:'var(--red)'}}>− {fmt(totalCosts+clientProfTotal+ivaTotal)}</span></div>
            <div style={{padding:'14px 12px',background:'var(--card2)',borderBottom:'1px solid var(--border)'}}>
              <div style={{fontSize:10,color:'var(--muted)',textTransform:'uppercase',letterSpacing:1.5,marginBottom:4}}>Lucro líquido atual</div>
              <div style={{fontSize:32,fontWeight:500,color:profit>=0?'var(--green)':'var(--red)'}}>{fmt(profit)}</div>
            </div>
            <div style={s.crow}><span style={{fontSize:11,color:'var(--muted)'}}>Projeção mês completo</span><span style={{fontSize:12,color:'var(--muted)'}}>{fmt(projected)}</span></div>
          </div>
        </div>

        {/* Meses */}
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:16,flexWrap:'wrap'}}>
          <div style={{display:'flex',gap:6,flexWrap:'wrap',flex:1}}>
            {MONTHS.map(m=>(
              <button key={m} onClick={()=>setMonth(m)} style={{background:m===month?'var(--accent-bg)':'var(--card)',border:m===month?'1px solid var(--accent)':'1px solid var(--border)',color:m===month?'var(--accent)':'var(--muted)',fontSize:11,padding:'4px 11px',borderRadius:20,cursor:'pointer',fontWeight:m===month?700:400}}>{m}</button>
            ))}
          </div>
          <button onClick={copyMonth} style={{background:'var(--accent-bg)',border:'1px solid var(--accent)',color:'var(--accent)',fontSize:11,padding:'4px 11px',borderRadius:16,cursor:'pointer',fontWeight:600}}>↩ Copiar mês anterior</button>
          <button onClick={resetMonth} style={{background:'none',border:'1px solid var(--border)',color:'var(--muted)',fontSize:11,padding:'4px 11px',borderRadius:16,cursor:'pointer'}}>Limpar mês</button>
        </div>

        {/* Tabs */}
        <div style={{display:'flex',border:'1px solid var(--border)',borderRadius:8,overflow:'hidden',marginBottom:16}}>
          {[['clients','Clientes'],['expenses','Despesas'],['teachers','Professores']].map(([v,l])=>(
            <button key={v} onClick={()=>setTab(v)} style={{flex:1,padding:'8px',textAlign:'center',fontSize:11,fontWeight:500,letterSpacing:1,textTransform:'uppercase',cursor:'pointer',background:tab===v?'var(--card2)':'var(--card)',color:tab===v?'var(--text)':'var(--muted)',border:'none',borderRight:'1px solid var(--border)'}}>{l}</button>
          ))}
        </div>

        {/* ── CLIENTES ──────────────────────────────── */}
        {tab==='clients' && (<>

          {/* Botão + formulário novo cliente */}
          <div style={{marginBottom:14}}>
            {!showNewClient
              ? <button onClick={()=>setShowNewClient(true)} style={{background:'var(--accent-bg)',border:'1px solid var(--accent)',color:'var(--accent)',fontSize:11,fontWeight:700,padding:'6px 14px',borderRadius:8,cursor:'pointer',letterSpacing:1}}>+ NOVO CLIENTE</button>
              : (
                <div className="card" style={{marginBottom:0}}>
                  <div className="card-title">NOVO CLIENTE</div>
                  <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr',gap:10,marginBottom:10}}>
                    <div>
                      <div className="input-label">NOME</div>
                      <input className="input" placeholder="Nome completo" value={newClient.name} onChange={e=>setNewClient(f=>({...f,name:e.target.value}))}/>
                    </div>
                    <div>
                      <div className="input-label">TIPO</div>
                      <select className="input" value={newClient.type} onChange={e=>setNewClient(f=>({...f,type:e.target.value}))}>
                        <option>PT</option><option>Pilates</option><option>Grupo</option><option>Outro</option>
                      </select>
                    </div>
                    <div>
                      <div className="input-label">SESSÕES</div>
                      <select className="input" value={newClient.sessions} onChange={e=>setNewClient(f=>({...f,sessions:e.target.value}))}>
                        <option value="1x">1x/semana</option>
                        <option value="2x">2x/semana</option>
                        <option value="3x">3x/semana</option>
                        <option value="grupo">Grupo</option>
                      </select>
                    </div>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:10}}>
                    <div>
                      <div className="input-label">VALOR STANDARD (€/mês)</div>
                      <input className="input" type="number" placeholder="0" value={newClient.standard_value} onChange={e=>setNewClient(f=>({...f,standard_value:e.target.value}))}/>
                    </div>
                    <div>
                      <div className="input-label">VALOR PROFESSOR (€/mês)</div>
                      <input className="input" type="number" placeholder="0" value={newClient.value_to_professor} onChange={e=>setNewClient(f=>({...f,value_to_professor:e.target.value}))}/>
                    </div>
                    <div>
                      <div className="input-label">PROFESSOR</div>
                      <select className="input" value={newClient.professor_id} onChange={e=>setNewClient(f=>({...f,professor_id:e.target.value}))}>
                        <option value="">— nenhum —</option>
                        {teachers.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                  </div>
                  {(newClient.standard_value||newClient.value_to_professor) ? (
                    <div style={{background:'var(--accent-bg)',border:'1px solid var(--accent)',borderRadius:8,padding:'8px 12px',marginBottom:10,fontSize:12}}>
                      <span style={{color:'var(--muted)'}}>Habitus recebe: </span>
                      <strong style={{color:'var(--accent)'}}>{fmt(Number(newClient.standard_value||0)-Number(newClient.value_to_professor||0))}</strong>
                    </div>
                  ) : null}
                  <div style={{display:'flex',gap:20,marginBottom:14}}>
                    <label style={{display:'flex',alignItems:'center',gap:8,fontSize:12,cursor:'pointer'}}>
                      <input type="checkbox" checked={newClient.has_pack} onChange={e=>setNewClient(f=>({...f,has_pack:e.target.checked}))}/>
                      Tem Pack
                    </label>
                    <label style={{display:'flex',alignItems:'center',gap:8,fontSize:12,cursor:'pointer'}}>
                      <input type="checkbox" checked={newClient.has_insurance} onChange={e=>setNewClient(f=>({...f,has_insurance:e.target.checked}))}/>
                      Tem Seguro
                    </label>
                    <label style={{display:'flex',alignItems:'center',gap:8,fontSize:12,cursor:'pointer'}}>
                      <input type="checkbox" checked={newClient.has_invoice} onChange={e=>setNewClient(f=>({...f,has_invoice:e.target.checked}))}/>
                      Tem Fatura (IVA 23%)
                    </label>
                  </div>
                  <div style={{display:'flex',gap:8}}>
                    <button className="green-btn" onClick={addClient}>GUARDAR CLIENTE</button>
                    <button onClick={()=>setShowNewClient(false)} style={{background:'none',border:'1px solid var(--border)',color:'var(--muted)',borderRadius:8,padding:'6px 14px',fontSize:11,cursor:'pointer'}}>Cancelar</button>
                  </div>
                </div>
              )
            }
          </div>

          <div style={{display:'flex',gap:8,marginBottom:14}}>
            {[['all','Todos'],['unpaid','Por pagar'],['paid','Pagos']].map(([v,l])=>(
              <button key={v} onClick={()=>setFilter(v)} style={{background:filter===v?'var(--accent-bg)':'var(--card)',border:filter===v?'1px solid var(--accent)':'1px solid var(--border)',color:filter===v?'var(--accent)':'var(--muted)',fontSize:12,padding:'5px 14px',borderRadius:20,cursor:'pointer',fontWeight:filter===v?600:400}}>{l}</button>
            ))}
          </div>

          <div style={{border:'1px solid var(--border)',borderRadius:10,overflow:'hidden'}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr style={{background:'var(--card2)'}}>
                {['Cliente','Habitus','Professor','Data','Estado'].map((h,i)=>(
                  <th key={h} style={{textAlign:i>=1&&i<=2?'right':i===4?'right':'left',fontSize:10,fontWeight:500,letterSpacing:2,textTransform:'uppercase',color:'var(--muted)',padding:'9px 12px',borderBottom:'1px solid var(--border)'}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {tableClients.length===0
                  ? <tr><td colSpan={5} style={{textAlign:'center',padding:32,color:'var(--muted)',fontSize:13}}>Nenhum cliente neste filtro.</td></tr>
                  : tableClients.map(c=>{
                    const p=isPaid(c.id); const tag=getTag(c.type);
                    const isEditing=editVal===c.id;
                    return(<>
                      <tr key={c.id} style={{opacity:p?0.55:1,borderBottom:isEditing?'none':'1px solid var(--border)'}}>
                        <td style={{padding:'10px 12px',fontSize:12}}>
                          <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                            {c.name}
                            <span style={{background:tag.bg,color:tag.c,fontSize:9,fontWeight:500,padding:'1px 5px',borderRadius:4}}>{c.type}</span>
                            {c.has_pack&&<span style={{background:'#EAF3DE',color:'#3B6D11',fontSize:9,fontWeight:500,padding:'1px 5px',borderRadius:4}}>PACK</span>}
                            {c.has_insurance&&<span style={{background:'#E6F1FB',color:'#185FA5',fontSize:9,fontWeight:500,padding:'1px 5px',borderRadius:4}}>SEG</span>}
                            <button onClick={e=>{e.stopPropagation();toggleInvoice(c);}} title={c.has_invoice?'Tem fatura (clica para remover)':'Sem fatura (clica para ativar)'} style={{background:c.has_invoice?'#FFF3E0':'transparent',color:c.has_invoice?'#E65100':'var(--muted)',fontSize:9,fontWeight:500,padding:'1px 5px',borderRadius:4,border:c.has_invoice?'1px solid #E65100':'1px dashed var(--border)',cursor:'pointer'}}>FAT</button>
                          </div>
                          <div style={{fontSize:10,color:'var(--muted)',fontFamily:'monospace',marginTop:2}}>{c.sessions} · Total: {fmt(getValue(c.id))}</div>
                        </td>
                        <td style={{padding:'10px 12px',textAlign:'right'}}>
                          <span onClick={()=>isEditing?null:openEdit(c)} style={{cursor:'pointer',fontWeight:600,fontSize:13,borderBottom:'1px dashed var(--muted)'}} title="Clica para editar">{fmt(getHabValue(c.id))}</span>
                        </td>
                        <td style={{padding:'10px 12px',textAlign:'right',fontSize:12,color:'var(--muted)'}}>{fmt(getProfValue(c.id))}</td>
                        <td style={{padding:'10px 12px',fontSize:11,color:'var(--muted)',fontStyle:'italic'}}>{getDate(c.id)}</td>
                        <td style={{padding:'10px 12px',textAlign:'right'}}>
                          <div style={{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:6}}>
                            <button onClick={()=>toggle(c)} style={{fontSize:11,fontWeight:500,padding:'5px 11px',borderRadius:6,cursor:'pointer',background:p?'var(--red-bg)':'var(--green-bg)',border:p?'1px solid var(--red-b)':'1px solid var(--green-b)',color:p?'var(--red)':'var(--green)'}}>
                              {p?'✕ Desfazer':'✓ Pago'}
                            </button>
                            <button onClick={()=>deactivateClient(c)} title="Remover cliente" style={{fontSize:11,padding:'5px 8px',borderRadius:6,cursor:'pointer',background:'none',border:'1px solid var(--border)',color:'var(--muted)'}}>✕</button>
                          </div>
                        </td>
                      </tr>
                      {/* Linha de edição inline */}
                      {isEditing&&(
                        <tr key={`${c.id}-edit`} style={{background:'var(--accent-bg)',borderBottom:'1px solid var(--border)'}}>
                          <td colSpan={5} style={{padding:'12px 14px'}}>
                            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr auto',gap:10,alignItems:'flex-end'}}>
                              <div>
                                <div style={{fontSize:10,color:'var(--muted)',marginBottom:4,fontFamily:'monospace',letterSpacing:1}}>VALOR TOTAL</div>
                                <input type="number" className="input" value={editForm.value} onChange={e=>setEditForm(f=>({...f,value:e.target.value}))} style={{fontSize:13}}/>
                              </div>
                              <div>
                                <div style={{fontSize:10,color:'var(--muted)',marginBottom:4,fontFamily:'monospace',letterSpacing:1}}>VALOR PROFESSOR</div>
                                <input type="number" className="input" value={editForm.professor_value} onChange={e=>setEditForm(f=>({...f,professor_value:e.target.value}))} style={{fontSize:13}}/>
                              </div>
                              <div>
                                <div style={{fontSize:10,color:'var(--muted)',marginBottom:4,fontFamily:'monospace',letterSpacing:1}}>PROFESSOR</div>
                                <select className="input" value={editForm.monthly_professor_id} onChange={e=>setEditForm(f=>({...f,monthly_professor_id:e.target.value}))}>
                                  <option value="">— nenhum —</option>
                                  {teachers.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                              </div>
                              <div>
                                <div style={{fontSize:10,color:'var(--muted)',marginBottom:8,fontFamily:'monospace',letterSpacing:1}}>OPÇÕES</div>
                                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                                  <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,cursor:'pointer'}}>
                                    <input type="checkbox" checked={editForm.monthly_has_pack} onChange={e=>setEditForm(f=>({...f,monthly_has_pack:e.target.checked}))}/>
                                    Pack este mês
                                  </label>
                                  <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,cursor:'pointer',color:'#E65100',fontWeight:600}}>
                                    <input type="checkbox" checked={editForm.has_invoice||false} onChange={e=>setEditForm(f=>({...f,has_invoice:e.target.checked}))}/>
                                    Tem Fatura (IVA)
                                  </label>
                                  <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,cursor:'pointer',color:'var(--accent)',fontWeight:600}}>
                                    <input type="checkbox" checked={editForm.is_new_standard} onChange={e=>setEditForm(f=>({...f,is_new_standard:e.target.checked}))}/>
                                    Novo valor standard
                                  </label>
                                </div>
                              </div>
                              <div style={{display:'flex',gap:6}}>
                                <button onClick={()=>saveValue(c.id)} style={{background:'var(--green-bg)',border:'1px solid var(--green-b)',color:'var(--green)',borderRadius:6,padding:'8px 14px',fontSize:12,fontWeight:700,cursor:'pointer'}}>✓ Guardar</button>
                                <button onClick={()=>{setEditVal(null);setEditForm({});}} style={{background:'var(--red-bg)',border:'1px solid var(--red-b)',color:'var(--red)',borderRadius:6,padding:'8px 14px',fontSize:12,cursor:'pointer'}}>✕</button>
                              </div>
                            </div>
                            <div style={{marginTop:8,fontSize:11,color:'var(--accent)'}}>
                              Habitus recebe: <strong>{fmt(Number(editForm.value||0)-Number(editForm.professor_value||0))}</strong>
                              {editForm.is_new_standard&&<span style={{marginLeft:12,background:'var(--accent)',color:'#fff',padding:'1px 7px',borderRadius:4,fontSize:10}}>Atualiza standard</span>}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>);
                  })
                }
              </tbody>
            </table>
          </div>
        </>)}

        {/* ── DESPESAS ──────────────────────────────── */}
        {tab==='expenses' && (
          <div>
            <div className="card" style={{marginBottom:16}}>
              <div className="card-title">ADICIONAR DESPESA</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 100px 130px 150px',gap:10,marginBottom:10}}>
                <input className="input" placeholder="Descrição" value={newCost.label} onChange={e=>setNewCost(f=>({...f,label:e.target.value}))}/>
                <input className="input" type="number" placeholder="Valor €" value={newCost.value} onChange={e=>setNewCost(f=>({...f,value:e.target.value}))}/>
                <select className="input" value={newCost.type} onChange={e=>setNewCost(f=>({...f,type:e.target.value}))}>
                  <option value="regular">Regular</option>
                  <option value="sporadic">Esporádica</option>
                </select>
                <input className="input" type="date" value={newCost.expense_date} onChange={e=>setNewCost(f=>({...f,expense_date:e.target.value}))}/>
              </div>
              <button className="green-btn" onClick={addCost}>ADICIONAR</button>
            </div>

            {[['regular','DESPESAS REGULARES',regularCosts],['sporadic','DESPESAS ESPORÁDICAS',sporadicCosts]].map(([type,title,list])=>(
              <div key={type} style={{marginBottom:16}}>
                <div className="admin-day-title">{title}</div>
                <div style={{border:'1px solid var(--border)',borderRadius:10,overflow:'hidden'}}>
                  {list.length===0
                    ? <div style={{padding:20,textAlign:'center',fontFamily:'monospace',fontSize:12,color:'var(--muted)'}}>Sem despesas.</div>
                    : list.map(c=>(
                      <div key={c.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',borderBottom:'1px solid var(--border)',fontSize:12}}>
                        <div>
                          <span>{c.label}</span>
                          {c.expense_date&&<span style={{fontFamily:'monospace',fontSize:10,color:'var(--muted)',marginLeft:8}}>{new Date(c.expense_date).toLocaleDateString('pt-PT')}</span>}
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:12}}>
                          <span style={{fontWeight:600}}>{fmt(c.value)}</span>
                          <button className="del-btn" onClick={()=>api.delete(`/finance/costs/${c.id}`).then(loadAll)}>✕</button>
                        </div>
                      </div>
                    ))
                  }
                  <div style={{display:'flex',justifyContent:'space-between',padding:'10px 14px',background:'var(--card2)',fontWeight:600,fontSize:12}}>
                    <span style={{color:'var(--muted)'}}>Total</span>
                    <span style={{color:'var(--red)'}}>{fmt(list.reduce((s,c)=>s+Number(c.value),0))}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── PROFESSORES ───────────────────────────── */}
        {tab==='teachers' && (
          <div>
            <div className="card" style={{marginBottom:16}}>
              <div className="card-title">REGISTAR SESSÃO</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 160px 1fr',gap:10,marginBottom:10}}>
                <select className="input" value={newSession.teacher_id} onChange={e=>setNewSession(f=>({...f,teacher_id:e.target.value}))}>
                  <option value="">— Professor —</option>
                  {teachers.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <input className="input" type="date" value={newSession.session_date} onChange={e=>setNewSession(f=>({...f,session_date:e.target.value}))}/>
                <input className="input" placeholder="Notas (opcional)" value={newSession.notes} onChange={e=>setNewSession(f=>({...f,notes:e.target.value}))}/>
              </div>
              <button className="green-btn" onClick={addSession}>ADICIONAR SESSÃO</button>
            </div>

            {teachers.map(t=>{
              const sess=getSessions(t.id); const vps=Number(t.value_per_session||0);
              const sessTotal=sess.length*vps; const cliTotal=getClientProfTotal(t.id);
              const tClients=withVal.filter(c=>(getVal(c.id)?.monthly_professor_id||c.professor_id)===t.id);
              return(
                <div key={t.id} className="cls-row" style={{borderLeft:'3px solid var(--accent)',marginBottom:12}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12,flexWrap:'wrap',gap:8}}>
                    <span style={{fontWeight:900,fontSize:16,letterSpacing:1}}>{t.name.toUpperCase()}</span>
                    <div style={{display:'flex',alignItems:'center',gap:12}}>
                      <span style={{fontFamily:'monospace',fontSize:12,color:'var(--muted)'}}>
                        Total a receber:
                      </span>
                      <span style={{fontFamily:'monospace',fontSize:16,color:'var(--accent)',fontWeight:700}}>{fmt(sessTotal+cliTotal)}</span>
                    </div>
                  </div>

                  {/* Clientes deste professor */}
                  {tClients.length>0&&(
                    <div style={{marginBottom:10}}>
                      <div style={{fontSize:10,color:'var(--muted)',letterSpacing:1.5,textTransform:'uppercase',marginBottom:6}}>Clientes</div>
                      <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                        {tClients.map(c=>(
                          <div key={c.id} style={{display:'inline-flex',alignItems:'center',gap:6,background:'var(--card2)',border:'1px solid var(--border)',borderRadius:8,padding:'5px 10px',fontSize:11}}>
                            <span>{c.name}</span>
                            <span style={{fontFamily:'monospace',fontWeight:600,color:'var(--accent)'}}>{fmt(getProfValue(c.id))}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sessões */}
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                    <span style={{fontFamily:'monospace',fontSize:11,color:'var(--muted)'}}>Sessões — valor/sessão:</span>
                    {editSessVal[t.id]!==undefined
                      ? <div style={{display:'flex',gap:4}}>
                          <input type="number" defaultValue={vps} autoFocus style={{width:70,padding:'3px 6px',borderRadius:6,border:'1px solid var(--accent)',fontFamily:'monospace',fontSize:12}}
                            onKeyDown={e=>{if(e.key==='Enter')saveSessionValue(t.id,e.target.value);if(e.key==='Escape')setEditSessVal({});}}/>
                          <button onClick={e=>saveSessionValue(t.id,e.target.previousSibling?.value||vps)} style={{background:'var(--green-bg)',border:'1px solid var(--green-b)',color:'var(--green)',borderRadius:5,padding:'2px 7px',fontSize:11,cursor:'pointer'}}>✓</button>
                        </div>
                      : <span onClick={()=>setEditSessVal({[t.id]:vps})} style={{cursor:'pointer',fontWeight:600,borderBottom:'1px dashed var(--muted)',fontFamily:'monospace',fontSize:12}}>{fmt(vps)}</span>
                    }
                    <span style={{fontFamily:'monospace',fontSize:12,color:'var(--muted)'}}>{sess.length} sessões = <b style={{color:'var(--accent)'}}>{fmt(sessTotal)}</b></span>
                  </div>
                  {sess.length===0
                    ? <div style={{fontFamily:'monospace',fontSize:11,color:'var(--muted)'}}>Sem sessões registadas.</div>
                    : <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                        {sess.map(s=>(
                          <div key={s.id} style={{display:'inline-flex',alignItems:'center',gap:6,background:'var(--card2)',border:'1px solid var(--border)',borderRadius:8,padding:'4px 10px',fontSize:11}}>
                            <span style={{fontFamily:'monospace'}}>{new Date(s.session_date).toLocaleDateString('pt-PT',{day:'2-digit',month:'2-digit'})}</span>
                            {s.notes&&<span style={{color:'var(--muted)',fontSize:10}}>· {s.notes}</span>}
                            <button onClick={()=>api.delete(`/finance/teacher-sessions/${s.id}`).then(loadAll)} style={{background:'none',border:'none',color:'var(--red)',cursor:'pointer',fontSize:12,padding:'0 2px'}}>✕</button>
                          </div>
                        ))}
                      </div>
                  }
                </div>
              );
            })}
          </div>
        )}
      </>)}
    </div>
  );
}