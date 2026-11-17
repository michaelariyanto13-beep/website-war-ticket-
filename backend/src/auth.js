import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

const { ADMIN_USERNAME, ADMIN_PASSWORD, JWT_SECRET } = process.env;
if (!ADMIN_USERNAME || !ADMIN_PASSWORD || !JWT_SECRET) {
  throw new Error('ADMIN_USERNAME / ADMIN_PASSWORD / JWT_SECRET belum diisi');
}
if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
  if (ADMIN_PASSWORD.length < 12) throw new Error('ADMIN_PASSWORD minimal 12 karakter untuk production');
  if (JWT_SECRET.length < 32) throw new Error('JWT_SECRET minimal 32 karakter untuk production');
}

// Bandingkan lewat hash agar panjang sama & tahan timing attack
const safeEqual = (a, b) => {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
};

export function login(username, password) {
  const okUser = safeEqual(username ?? '', ADMIN_USERNAME);
  const okPass = safeEqual(password ?? '', ADMIN_PASSWORD);
  if (!(okUser && okPass)) return null;
  return jwt.sign({ role: 'admin' }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '12h' });
}

export function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    if (payload.role !== 'admin') throw new Error('not admin');
    next();
  } catch {
    res.status(401).json({ error: 'Sesi habis, silakan login admin lagi' });
  }
}
