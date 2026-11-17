# WarLari — War Ticket Lari

React (Vite) + Express + Supabase. Satu project Vercel: frontend statis + API serverless (`/api`).

## Development lokal

```bash
npm install                 # sekali, di folder root
npm run dev:api             # API  → http://localhost:4000  (butuh backend/.env)
npm run dev:web             # Web  → http://localhost:5173
```

## Database (Supabase → SQL Editor)

- Database baru: jalankan `supabase/schema.sql`, `migration-002-performa-keamanan.sql`, `migration-003-pesan-slot-penuh.sql`, lalu `migration-004-tiket-qr-kehadiran.sql`.
- Database lama: jalankan `supabase/migration-002-performa-keamanan.sql` (jika belum).
- Lalu jalankan `supabase/migration-003-pesan-slot-penuh.sql`, kemudian `supabase/migration-004-tiket-qr-kehadiran.sql`.

## Deploy ke Vercel

1. Push repo ke GitHub (pastikan `.env` TIDAK ikut ter-commit).
2. Vercel → **Add New Project** → import repo. **Root Directory: biarkan root** (jangan pilih `frontend`).
   Pengaturan build otomatis terbaca dari `vercel.json`.
3. **Settings → Environment Variables** (Production):

   | Nama | Isi |
   |---|---|
   | `SUPABASE_URL` | Project URL Supabase |
   | `SUPABASE_SERVICE_ROLE_KEY` | key `service_role` / `sb_secret_...` |
   | `ADMIN_USERNAME` | username admin |
   | `ADMIN_PASSWORD` | **min. 12 karakter** |
   | `JWT_SECRET` | **min. 32 karakter acak** |

   Jangan isi `VITE_API_URL` / `CORS_ORIGIN` — frontend & API satu domain.
4. Deploy. Cek `https://domainmu.vercel.app/api/health` → `{"ok":true}`.

Region function = `sin1` (Singapura). Buat project Supabase di region **Singapore** juga agar latensi minimal.

## Deploy ke Netlify (alternatif)

1. Push repo ke GitHub.
2. Netlify → **Add new site → Import an existing project** → pilih repo.
   **Base directory: kosong (root).** Build command & publish dir otomatis dari `netlify.toml`.
3. **Site configuration → Environment variables**: isi 5 variabel yang sama seperti tabel di atas
   (scope minimal: *Functions* & *Builds*).
4. **Site configuration → Build & deploy → Functions → Functions region**: pilih
   **Asia Pacific (Singapore)** bila tersedia di paketmu (default-nya US → latensi ke Supabase Singapore lebih tinggi).
5. Deploy → cek `https://namasitus.netlify.app/api/health` → `{"ok":true}`.

## Email tiket QR (opsional)

Tambahkan Environment Variables berikut (Netlify/Vercel), lalu deploy ulang:

| Nama | Contoh (Gmail) |
|---|---|
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | `emailkamu@gmail.com` |
| `SMTP_PASS` | App Password 16 huruf (Google Account → Security → 2-Step Verification → App passwords) |
| `MAIL_FROM` | `WarLari <emailkamu@gmail.com>` |

Batas kirim: Gmail ±500 email/hari. Untuk war besar pakai layanan email (Brevo, Resend, Mailgun) — cukup ganti nilai SMTP_*.
Form event wajib punya isian bertipe **Email** agar tiket terkirim. Tanpa SMTP, QR tetap tampil di layar & di link tiket.

Scan kehadiran: Panel admin → **Scan kehadiran** (buka dari HP, izinkan kamera).

## Checklist sebelum war besar

- [ ] Migration 002 sudah dijalankan.
- [ ] Supabase **tidak** di-pause (free plan pause setelah 7 hari tidak aktif) — buka dashboard H-1.
- [ ] Untuk ribuan peserta serentak: pertimbangkan Supabase Pro (koneksi & CPU lebih besar).
- [ ] Tes beban di URL preview, mis. `npx autocannon -c 200 -d 20 https://domainmu.vercel.app/api/events`.
- [ ] Vercel → Firewall: aktifkan *Attack Challenge Mode* kalau ada serangan bot saat war.
