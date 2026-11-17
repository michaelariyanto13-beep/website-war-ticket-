-- Jalankan SEKALI di Supabase > SQL Editor (setelah migration-002 & 003). Aman dijalankan ulang.
-- Tiket QR, nomor tiket, kehadiran (check-in), dan status email.

-- 1) Kolom baru pada pendaftar
alter table registrations add column if not exists ticket_code text;
alter table registrations add column if not exists ticket_no integer;
alter table registrations add column if not exists checked_in_at timestamptz;
alter table registrations add column if not exists email_sent_at timestamptz;

-- Kode tiket acak 128-bit (32 hex) — tidak bisa ditebak. gen_random_uuid() bawaan Postgres.
update registrations set ticket_code = replace(gen_random_uuid()::text, '-', '') where ticket_code is null;
alter table registrations alter column ticket_code set default replace(gen_random_uuid()::text, '-', '');
alter table registrations alter column ticket_code set not null;
create unique index if not exists registrations_ticket_code_idx on registrations(ticket_code);
create index if not exists registrations_checkin_idx on registrations(event_id) where checked_in_at is not null;

-- 2) Nomor tiket berurutan per event yang TIDAK pernah dipakai ulang (walau ada pendaftar dihapus)
alter table events add column if not exists ticket_seq integer not null default 0;

with numbered as (
  select id, row_number() over (partition by event_id order by created_at, id) as rn
  from registrations where ticket_no is null
)
update registrations r set ticket_no = n.rn from numbered n where r.id = n.id;

update events e set ticket_seq = greatest(e.ticket_seq, coalesce((select max(ticket_no) from registrations r where r.event_id = e.id), 0));

-- 3) Fungsi pendaftaran: sekarang juga memberi nomor & kode tiket
create or replace function register_for_event(p_event_id uuid, p_answers jsonb)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_seq integer;
  v_event events%rowtype;
  v_id uuid;
  v_code text;
begin
  update events
     set registered_count = registered_count + 1,
         ticket_seq = ticket_seq + 1
   where id = p_event_id
     and is_open
     and (quota is null or registered_count < quota)
  returning ticket_seq into v_seq;

  if not found then
    select * into v_event from events where id = p_event_id;
    if not found then return jsonb_build_object('ok', false, 'code', 'NOT_FOUND'); end if;
    if not v_event.is_open then return jsonb_build_object('ok', false, 'code', 'CLOSED'); end if;
    return jsonb_build_object('ok', false, 'code', 'FULL');
  end if;

  insert into registrations(event_id, answers, ticket_no)
  values (p_event_id, p_answers, v_seq)
  returning id, ticket_code into v_id, v_code;

  return jsonb_build_object('ok', true, 'id', v_id, 'position', v_seq, 'ticket_code', v_code);
end;
$$;

revoke execute on function register_for_event(uuid, jsonb) from public, anon, authenticated;
grant execute on function register_for_event(uuid, jsonb) to service_role;
