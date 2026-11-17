import { Link, NavLink, Outlet } from 'react-router-dom';
import { setToken } from '../api.js';

export default function AdminLayout() {
  const logout = () => {
    setToken(null);
    window.dispatchEvent(new Event('admin-logout'));
  };
  return (
    <div className="a-shell">
      <aside className="a-side">
        <Link to="/admin" className="a-brand">
          <span className="a-logo">🏃</span>
          <div><b>WarLari</b><small>Panel Admin</small></div>
        </Link>
        <nav className="a-nav">
          <NavLink to="/admin" end><i>📊</i> Dashboard</NavLink>
          <NavLink to="/admin/events/new"><i>➕</i> Buat war baru</NavLink>
          <a href="/" target="_blank" rel="noreferrer"><i>🌐</i> Lihat website</a>
        </nav>
        <button className="a-logout" onClick={logout}><i>⎋</i> Keluar</button>
      </aside>
      <main className="a-main"><Outlet /></main>
    </div>
  );
}
