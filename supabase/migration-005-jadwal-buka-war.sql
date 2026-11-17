-- Jalankan SEKALI di Supabase > SQL Editor (setelah migration-004). Aman dijalankan ulang.
-- Jadwal buka war: open_at null = langsung dibuka; diisi = pendaftaran baru bisa mulai jam tsb.

alter table events add column if not exists open_at timestamptz;

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
     and (open_at is null or open_at <= now())
     and (quota is null or registered_count < quota)
  returning ticket_seq into v_seq;

  if not found then
    select * into v_event from events where id = p_event_id;
    if not found then return jsonb_build_object('ok', false, 'code', 'NOT_FOUND'); end if;
    if not v_event.is_open then return jsonb_build_object('ok', false, 'code', 'CLOSED'); end if;
    if v_event.open_at is not null and v_event.open_at > now() then
      return jsonb_build_object('ok', false, 'code', 'NOT_YET', 'open_at', v_event.open_at);
    end if;
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
