import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { getToken } from './api.js';
import Home from './pages/Home.jsx';
import EventPage from './pages/EventPage.jsx';
import TicketPage from './pages/TicketPage.jsx';

// Halaman admin (termasuk editor) dimuat terpisah → pengunjung war hanya unduh bundle kecil
const AdminLogin = lazy(() => import('./pages/AdminLogin.jsx'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard.jsx'));
const AdminEventForm = lazy(() => import('./pages/AdminEventForm.jsx'));
const AdminRecap = lazy(() => import('./pages/AdminRecap.jsx'));
const AdminLayout = lazy(() => import('./components/AdminLayout.jsx'));
const AdminScan = lazy(() => import('./pages/AdminScan.jsx'));

function RequireAdmin({ children }) {
  const navigate = useNavigate();
  const [ok, setOk] = useState(!!getToken());
  useEffect(() => {
    const onLogout = () => { setOk(false); navigate('/admin/login'); };
    window.addEventListener('admin-logout', onLogout);
    return () => window.removeEventListener('admin-logout', onLogout);
  }, [navigate]);
  return ok ? children : <Navigate to="/admin/login" replace />;
}

export default function App() {
  const { pathname } = useLocation();
  const isAdmin = pathname.startsWith('/admin');
  const [loggedIn, setLoggedIn] = useState(!!getToken());

  useEffect(() => {
    document.body.classList.toggle('public', !isAdmin);
    document.body.classList.toggle('admin', isAdmin);
  }, [isAdmin]);

  useEffect(() => {
    const sync = () => setLoggedIn(!!getToken());
    window.addEventListener('admin-logout', sync);
    window.addEventListener('admin-login', sync);
    return () => {
      window.removeEventListener('admin-logout', sync);
      window.removeEventListener('admin-login', sync);
    };
  }, []);

  return (
    <>
      {!isAdmin && (
        <header className="topbar">
          <Link to="/" className="brand">🏃 WarLari</Link>
          <nav>
            <Link to={loggedIn ? '/admin' : '/admin/login'}>{loggedIn ? 'Dashboard' : 'Admin'}</Link>
          </nav>
        </header>
      )}
      <main className="container">
        <Suspense fallback={<p style={{ padding: '2rem', color: '#8a95b3' }}>Memuat…</p>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/event/:id" element={<EventPage />} />
          <Route path="/ticket/:code" element={<TicketPage />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/events/new" element={<AdminEventForm />} />
            <Route path="/admin/events/:id/edit" element={<AdminEventForm />} />
            <Route path="/admin/events/:id/recap" element={<AdminRecap />} />
            <Route path="/admin/scan" element={<AdminScan />} />
          </Route>
          <Route path="*" element={<p style={{ padding: '2rem' }}>Halaman tidak ditemukan.</p>} />
        </Routes>
        </Suspense>
      </main>
    </>
  );
}
