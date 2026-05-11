import { useState, useEffect } from 'react';
import Schedule   from './components/Schedule';
import Payments   from './components/Payments';
import Admin      from './components/Admin';
import { getMembers, getTeachers, getClasses } from './api';
import './App.css';

export default function App() {
  const [view, setView]       = useState('schedule');
  const [members, setMembers] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    try {
      const [m, t, c] = await Promise.all([getMembers(), getTeachers(), getClasses()]);
      setMembers(m.data);
      setTeachers(t.data);
      setClasses(c.data);
    } catch (e) {
      console.error('Erro ao carregar dados:', e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  const shared = { members, teachers, classes, reload: loadData };

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="logo"><span>●</span> GYM<span className="logo-sub">CHECK-IN</span></div>
          <nav className="nav">
            <button className={view === 'schedule' ? 'active' : ''} onClick={() => setView('schedule')}>Horário</button>
            <button className={view === 'payments' ? 'active' : ''} onClick={() => setView('payments')}>Pagamentos</button>
            <button className={view === 'admin'    ? 'active' : ''} onClick={() => setView('admin')}>Admin</button>
          </nav>
        </div>
      </header>

      <main className="main">
        {loading ? (
          <div className="loading">A carregar...</div>
        ) : (
          <>
            {view === 'schedule' && <Schedule {...shared} />}
            {view === 'payments' && <Payments {...shared} />}
            {view === 'admin'    && <Admin    {...shared} />}
          </>
        )}
      </main>
    </div>
  );
}