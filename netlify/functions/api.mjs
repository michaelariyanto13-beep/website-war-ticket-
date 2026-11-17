// Entry Netlify Function: /api/* diarahkan ke sini (lihat netlify.toml).
import serverless from 'serverless-http';
import app from '../../backend/src/app.js';

const PREFIX = '/.netlify/functions/api';

export const handler = serverless(app, {
  // Pastikan Express selalu melihat path /api/... apa pun cara function dipanggil
  request(req) {
    if (req.url.startsWith(PREFIX)) req.url = '/api' + req.url.slice(PREFIX.length);
  },
});
