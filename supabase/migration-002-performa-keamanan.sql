-- Jalankan SEKALI di Supabase > SQL Editor (untuk database yang sudah pakai schema.sql lama).
-- Aman dijalankan ulang.

-- 1) Counter pendaftar di tabel events: tidak perlu COUNT(*) tiap request.
alter table events add column if not exists registered_count integer not null default 0;
update events e set registered_count = (select count(*) from registrations r where r.event_id = e.id);

-- 2) Pendaftaran atomik dengan satu UPDATE bersyarat.
--    Postgres mengunci baris event & mengecek ulang kuota, jadi tidak mungkin over-quota
--    walau ribuan request masuk bersamaan, dan transaksinya sangat singkat.
create or replace function register_for_event(p_event_id uuid, p_answers jsonb)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_count integer;
  v_event events%rowtype;
  v_id uuid;
begin
  update events
     set registered_count = registered_count + 1
   where id = p_event_id
     and is_open
     and (quota is null or registered_count < quota)
  returning registered_count into v_count;

  if not found then
    select * into v_event from events where id = p_event_id;
    if not found then return jsonb_build_object('ok', false, 'code', 'NOT_FOUND'); end if;
    if not v_event.is_open then return jsonb_build_object('ok', false, 'code', 'CLOSED'); end if;
    return jsonb_build_object('ok', false, 'code', 'FULL');
  end if;

  insert into registrations(event_id, answers) values (p_event_id, p_answers) returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id, 'position', v_count);
end;
$$;

-- 3) Slot kembali saat admin menghapus pendaftar.
create or replace function on_registration_deleted()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update events set registered_count = greatest(registered_count - 1, 0) where id = old.event_id;
  return old;
end;
$$;

drop trigger if exists registrations_after_delete on registrations;
create trigger registrations_after_delete
after delete on registrations
for each row execute function on_registration_deleted();

-- 4) Keamanan: fungsi hanya boleh dipanggil backend (service_role),
--    bukan langsung dari browser memakai anon key.
revoke execute on function register_for_event(uuid, jsonb) from public, anon, authenticated;
revoke execute on function on_registration_deleted() from public, anon, authenticated;
grant execute on function register_for_event(uuid, jsonb) to service_role;

-- 5) RLS tetap aktif tanpa policy = anon/authenticated tidak bisa baca/tulis tabel.
alter table events enable row level security;
alter table registrations enable row level security;
