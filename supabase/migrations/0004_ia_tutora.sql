-- IA tutora: histórico das conversas e limite diário por aluno.

alter table schools
  add column ai_enabled boolean not null default true,
  add column ai_daily_limit int not null default 30 check (ai_daily_limit between 1 and 500);

create table ai_messages (
  id bigint generated always as identity primary key,
  school_id uuid not null references schools(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 8000),
  created_at timestamptz not null default now()
);
create index ai_messages_student_idx on ai_messages (student_id, created_at desc);

alter table ai_messages enable row level security;

-- O aluno vê as próprias conversas; o responsável da escola pode auditar (proteção de menores).
create policy ai_messages_read on ai_messages for select using (
  student_id = auth.uid() or is_school_admin(school_id) or is_platform_admin()
);
create policy ai_messages_insert on ai_messages for insert with check (
  student_id = auth.uid() and school_id = my_school_id() and my_role() = 'student'
);

-- Perguntas feitas hoje (fuso de São Paulo).
create function ai_questions_today(p_student uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from ai_messages
  where student_id = p_student and role = 'user'
    and created_at >= (date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')
$$;

-- Quantas perguntas o aluno logado ainda pode fazer hoje.
create function ai_remaining_today() returns int
language sql stable security definer set search_path = public as $$
  select greatest(s.ai_daily_limit - ai_questions_today(auth.uid()), 0)
  from profiles p join schools s on s.id = p.school_id
  where p.id = auth.uid()
$$;
grant execute on function ai_remaining_today() to authenticated;
revoke execute on function ai_questions_today(uuid) from public, anon, authenticated;

-- Barra pergunta nova se a escola desligou a IA ou se o aluno passou do limite do dia.
create function check_ai_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_enabled boolean; v_limit int;
begin
  if new.role <> 'user' then return new; end if;
  select ai_enabled, ai_daily_limit into v_enabled, v_limit from schools where id = new.school_id;
  if not coalesce(v_enabled, false) then
    raise exception 'ia_desligada';
  end if;
  if ai_questions_today(new.student_id) >= v_limit then
    raise exception 'limite_diario';
  end if;
  return new;
end $$;

create trigger ai_messages_check before insert on ai_messages
for each row execute function check_ai_message();
