import { useState, useEffect } from 'react';
import Schedule   from './components/Schedule';
import Admin      from './components/Admin';
import Login      from './components/Login';
import Finance    from './components/Finance';
import Trainings  from './components/Trainings';
import { getMembers, getTeachers, getClasses } from './api';
import api      from './api';
import './App.css';

export default function App() {
  const [view, setView]         = useState('schedule');
  const [members, setMembers]   = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [user, setUser]         = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('gym_token');
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      api.get('/auth/me')
        .then(({ data }) => { setUser(data); loadData(); })
        .catch(() => { localStorage.removeItem('gym_token'); setLoading(false); });
    } else {
      setLoading(false);
    }
  }, []);

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

  function handleLogin(userData) {
    const token = localStorage.getItem('gym_token');
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(userData);
    loadData();
  }

  function handleLogout() {
    localStorage.removeItem('gym_token');
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
    setMembers([]); setTeachers([]); setClasses([]);
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'monospace', fontSize:12, color:'var(--muted)' }}>
      A carregar...
    </div>
  );

  if (!user) return <Login onLogin={handleLogin}/>;

  const shared = { members, teachers, classes, reload: loadData };

  const navItems = [
    { key:'schedule',   label:'Horário'    },
    { key:'finance',    label:'Financeiro' },
    { key:'trainings',  label:'Treinos'    },
    { key:'admin',      label:'Admin'      },
  ];

  return (
    <div className="app">
      <header className="header">
        <div class="header-inner">
          <div className="logo"><span>●</span> GYM<span className="logo-sub">CHECK-IN</span></div>
          <nav className="nav">
            {navItems.map(({ key, label }) => (
              <button key={key} className={view===key ? 'active' : ''} onClick={() => setView(key)}>{label}</button>
            ))}
            <button onClick={handleLogout} style={{ color:'var(--red)', fontSize:11 }}>Sair</button>
          </nav>
        </div>
      </header>

      <main className="main">
        {view === 'schedule'  && <Schedule  {...shared}/>}
        {view === 'finance'   && <Finance/>}
        {view === 'trainings' && <Trainings/>}
        {view === 'admin'     && <Admin    {...shared}/>}
      </main>
    </div>
  );
}