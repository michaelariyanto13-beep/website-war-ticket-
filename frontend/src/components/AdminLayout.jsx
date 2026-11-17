import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { setToken } from '../api.js';

const TITLES = [
  [/^\/admin\/scan/, 'Scan kehadiran'],
  [/^\/admin\/events\/new/, 'Buat war baru'],
  [/^\/admin\/events\/[^/]+\/edit/, 'Edit war'],
  [/^\/admin\/events\/[^/]+\/recap/, 'Rekap event'],
  [/^\/admin\/?$/, 'Dashboard'],
];

export default function AdminLayout() {
  const { pathname } = useLocation();
  const title = TITLES.find(([re]) => re.test(pathname))?.[1] || 'Panel Admin';

  const logout = () => {
    if (!confirm('Keluar dari panel admin?')) return;
    setToken(null);
    window.dispatchEvent(new Event('admin-logout'));
  };

  return (
    <div className="a-shell">
      {/* Desktop: sidebar */}
      <aside className="a-side">
        <Link to="/admin" className="a-brand">
          <span className="a-logo">🏃</span>
          <div><b>WarLari</b><small>Panel Admin</small></div>
        </Link>
        <nav className="a-nav">
          <NavLink to="/admin" end><i>📊</i> Dashboard</NavLink>
          <NavLink to="/admin/events/new"><i>➕</i> Buat war baru</NavLink>
          <NavLink to="/admin/scan"><i>📷</i> Scan kehadiran</NavLink>
          <a href="/" target="_blank" rel="noreferrer"><i>🌐</i> Lihat website</a>
        </nav>
        <button className="a-logout" onClick={logout}><i>⎋</i> Keluar</button>
      </aside>

      {/* Mobile: top bar */}
      <header className="a-mtop">
        <Link to="/admin" className="a-logo sm" aria-label="Dashboard">🏃</Link>
        <div className="a-mtop-title">
          <small>WarLari Admin</small>
          <b>{title}</b>
        </div>
        <button className="a-mtop-btn" onClick={logout} aria-label="Keluar">⎋</button>
      </header>

      <main className="a-main"><Outlet /></main>

      {/* Mobile: tab bar bawah */}
      <nav className="a-tabbar" aria-label="Menu admin">
        <NavLink to="/admin" end><i>📊</i><span>Dashboard</span></NavLink>
        <NavLink to="/admin/events/new"><i>➕</i><span>Buat war</span></NavLink>
        <NavLink to="/admin/scan" className="scan"><i>📷</i><span>Scan</span></NavLink>
        <a href="/" target="_blank" rel="noreferrer"><i>🌐</i><span>Website</span></a>
      </nav>
    </div>
  );
}
