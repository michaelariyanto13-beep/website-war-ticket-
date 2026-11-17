import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api, getToken, setToken } from '../api.js';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (getToken()) return <Navigate to="/admin" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { token } = await api.login(username, password);
      setToken(token);
      window.dispatchEvent(new Event('admin-login'));
      navigate('/admin');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="a-login">
      <section className="a-login-art">
        <div className="a-blob b1" /><div className="a-blob b2" />
        <div className="a-login-copy">
          <span className="a-logo big">🏃</span>
          <h1>WarLari<br /><em>Admin</em></h1>
          <p>Kelola event war ticket, atur formulir, dan pantau pendaftar secara real-time.</p>
          <ul>
            <li>⚡ Limit peserta otomatis</li>
            <li>📝 Deskripsi event ala dokumen</li>
            <li>📊 Rekap & export CSV</li>
          </ul>
        </div>
      </section>

      <section className="a-login-form">
        <form onSubmit={submit}>
          <h2>Selamat datang 👋</h2>
          <p className="a-sub">Masuk untuk mengelola event.</p>

          <div className="field">
            <label>Username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="username" />
          </div>
          <div className="field">
            <label>Password</label>
            <div className="a-pass">
              <input type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
              <button type="button" onClick={() => setShow((s) => !s)}>{show ? 'Sembunyikan' : 'Lihat'}</button>
            </div>
          </div>

          {error && <p className="alert error">{error}</p>}
          <button className="a-btn primary full" disabled={busy}>{busy ? 'Masuk…' : 'Masuk'}</button>
          <Link to="/" className="a-back">← Kembali ke website</Link>
        </form>
      </section>
    </div>
  );
}
