import { useState, useEffect } from 'react';
import { getPayments, setPayment } from '../api';

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

export default function Payments({ members }) {
  const [date, setDate]       = useState(new Date());
  const [payments, setPayments] = useState([]);

  const monthKey = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
  const isCurrent = monthKey === new Date().toISOString().slice(0,7);

  async function load() {
    try {
      const { data } = await getPayments(monthKey);
      setPayments(data);
    } catch (e) { console.error(e); }
  }

  useEffect(() => { load(); }, [monthKey]);

  async function toggle(memberId, paid) {
    await setPayment({ member_id: memberId, month: monthKey, paid });
    await load();
  }

  function changeMonth(dir) {
    setDate(d => new Date(d.getFullYear(), d.getMonth() + dir, 1));
  }

  function share() {
    const paid    = members.filter(m => payments.find(p => p.member_id === m.id && p.paid));
    const notPaid = members.filter(m => !payments.find(p => p.member_id === m.id && p.paid));
    const label   = `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
    let txt = `💪 GYM · Pagamentos ${label.toUpperCase()}\n${'─'.repeat(30)}\n\n✅ PAGOS (${paid.length})\n`;
    paid.forEach(m => { txt += `  · ${m.name}\n`; });
    txt += `\n❌ PENDENTES (${notPaid.length})\n`;
    notPaid.forEach(m => { txt += `  · ${m.name}\n`; });
    txt += `\n${'─'.repeat(30)}\nTotal: ${members.length} membros`;
    if (navigator.share) navigator.share({ title: `GYM ${label}`, text: txt });
    else navigator.clipboard?.writeText(txt).then(() => alert('Copiado!'));
  }

  const paidCount = members.filter(m => payments.find(p => p.member_id === m.id && p.paid)).length;

  return (
    <div>
      <div className="sec-title"><span>PAGAMENTOS</span></div>

      <div className="pay-header">
        <div className="month-nav">
          <button className="month-nav-btn" onClick={() => changeMonth(-1)}>‹</button>
          <div className="month-label">{MONTHS[date.getMonth()].toUpperCase()} {date.getFullYear()}</div>
          <button className="month-nav-btn" onClick={() => changeMonth(1)}>›</button>
        </div>
        <button className="share-btn" onClick={share}>↑ Partilhar</button>
      </div>

      <div className="pay-stats">
        <div className="pay-stat paid"><div className="pay-stat-val">{paidCount}</div><div className="pay-stat-label">PAGOS</div></div>
        <div className="pay-stat unpaid"><div className="pay-stat-val">{members.length - paidCount}</div><div className="pay-stat-label">PENDENTES</div></div>
        <div className="pay-stat"><div className="pay-stat-val">{members.length}</div><div className="pay-stat-label">TOTAL</div></div>
      </div>

      <div className="pay-table">
        {members.map(m => {
          const p      = payments.find(p => p.member_id === m.id);
          const isPaid = p?.paid === true;
          return (
            <div key={m.id} className="pay-row">
              <div>
                <div className={`pay-name ${isCurrent && !isPaid ? 'unpaid-now' : isPaid ? 'paid-ok' : ''}`}>{m.name}</div>
                <div style={{ marginTop:3 }}>
                  {isPaid
                    ? <span className="pay-badge ok">✓ PAGO</span>
                    : <span className="pay-badge none">— PENDENTE</span>}
                </div>
              </div>
              <div className="pay-toggle">
                {isPaid && <button className="pay-btn mark-unpaid" onClick={() => toggle(m.id, false)}>Anular</button>}
                <button className="pay-btn mark-paid" onClick={() => toggle(m.id, !isPaid)}>
                  {isPaid ? '✓ Pago' : 'Marcar pago'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}