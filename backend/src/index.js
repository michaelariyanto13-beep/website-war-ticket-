// Server lokal untuk development. Di Vercel, app dijalankan lewat /api/index.js.
import app from './app.js';

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`API jalan di http://localhost:${port}`));
