import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  // Diagnosa: tampilkan NAMA variabel terkait yang terbaca (tanpa nilainya) —
  // memperlihatkan salah ketik / spasi di nama / nilai kosong / scope Functions belum aktif.
  const seen = Object.keys(process.env)
    .filter((k) => /SUPA|ADMIN|JWT/i.test(k))
    .map((k) => `${JSON.stringify(k)}${process.env[k]?.trim() ? '' : ' (KOSONG)'}`)
    .join(', ');
  throw new Error(
    'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diisi (lokal: backend/.env, online: Environment Variables di Netlify/Vercel lalu deploy ulang). ' +
    `Variabel terkait yang terbaca: ${seen || 'TIDAK ADA SAMA SEKALI'}`
  );
}

export const supabase = createClient(SUPABASE_URL.trim(), SUPABASE_SERVICE_ROLE_KEY.trim(), {
  auth: { persistSession: false, autoRefreshToken: false },
});
