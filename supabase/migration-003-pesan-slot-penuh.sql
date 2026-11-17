-- Jalankan SEKALI di Supabase > SQL Editor (setelah migration-002). Aman dijalankan ulang.
-- Pesan (HTML dari editor admin) yang tampil ke peserta saat kuota war habis.
alter table events add column if not exists full_message text not null default '';
