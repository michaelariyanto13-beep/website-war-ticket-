const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const TOKEN_KEY = 'war_admin_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

async function request(method, path, body, auth = false) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) headers.Authorization = `Bearer ${getToken()}`;
  let res;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Koneksi bermasalah, periksa internet lalu coba lagi');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (auth && res.status === 401) {
      setToken(null);
      window.dispatchEvent(new Event('admin-logout'));
    }
    const err = new Error(data.error || `Error ${res.status}`);
    err.status = res.status;
    err.code = data.code;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  // public
  listEvents: () => request('GET', '/events'),
  getEvent: (id) => request('GET', `/events/${id}`),
  register: (id, answers) => request('POST', `/events/${id}/register`, { answers }),
  ticket: (code) => request('GET', `/tickets/${code}`),
  sendTicketEmail: (code) => request('POST', `/tickets/${code}/email`, {}),
  // admin
  login: (username, password) => request('POST', '/admin/login', { username, password }),
  adminEvents: () => request('GET', '/admin/events', undefined, true),
  createEvent: (e) => request('POST', '/admin/events', e, true),
  updateEvent: (id, e) => request('PUT', `/admin/events/${id}`, e, true),
  setOpen: (id, is_open) => request('PATCH', `/admin/events/${id}/open`, { is_open }, true),
  deleteEvent: (id) => request('DELETE', `/admin/events/${id}`, undefined, true),
  recap: (id) => request('GET', `/admin/events/${id}/recap`, undefined, true),
  deleteRegistration: (id) => request('DELETE', `/admin/registrations/${id}`, undefined, true),
  checkin: (code, event_id) => request('POST', '/admin/checkin', { code, event_id }, true),
  setCheckin: (id, checked_in) => request('PATCH', `/admin/registrations/${id}/checkin`, { checked_in }, true),
  resendEmail: (id) => request('POST', `/admin/registrations/${id}/email`, {}, true),
  emailPending: (eventId) => request('POST', `/admin/events/${eventId}/email-pending`, {}, true),
};
