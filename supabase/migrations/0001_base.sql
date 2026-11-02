-- Base multi-escola do MVP: escolas, turmas, perfis, convites, tarefas, envios de foto e extrato de pontos.
-- Toda tabela de dados da escola tem school_id, e o acesso é limitado por RLS à escola do usuário.

create extension if not exists pgcrypto;

create type user_role as enum ('platform_admin', 'school_admin', 'student');
create type submission_status as enum ('pending', 'approved', 'rejected', 'discarded');
create type limit_period as enum ('day', 'week', 'month');

create table schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  primary_color text not null default '#0b2a5b',   -- azul-escuro
  secondary_color text not null default '#7cc3f0', -- azul-claro
  created_at timestamptz not null default now()
);

create table classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (school_id, name)
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid references schools(id) on delete cascade,
  class_id uuid references classes(id) on delete set null,
  role user_role not null,
  full_name text not null,
  created_at timestamptz not null default now(),
  check (role = 'platform_admin' or school_id is not null),
  check (role <> 'student' or class_id is not null)
);

-- Convite de uso único: o admin escolar gera um código para cada aluno (ou para outro admin).
create table invites (
  code text primary key default upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  school_id uuid not null references schools(id) on delete cascade,
  class_id uuid references classes(id) on delete cascade,
  role user_role not null check (role in ('school_admin', 'student')),
  full_name text not null,
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  check (role <> 'student' or class_id is not null)
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  name text not null,
  description text,
  points_gain integer not null check (points_gain >= 0),
  points_loss integer not null check (points_loss >= 0),
  requires_photo boolean not null default true,
  max_per_period integer not null default 1 check (max_per_period > 0),
  period limit_period not null default 'day',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table submissions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  task_id uuid not null references tasks(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  photo_path text not null,
  status submission_status not null default 'pending',
  comment text,
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Extrato: lançamentos nunca são apagados nem editados; um estorno é um novo lançamento.
create table point_entries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  task_id uuid references tasks(id) on delete set null,
  submission_id uuid references submissions(id) on delete set null,
  reverses_entry_id uuid unique references point_entries(id),
  amount integer not null check (amount <> 0),
  reason text not null check (length(trim(reason)) > 0),
  comment text,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create table prizes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  school_year integer not null,
  scope text not null check (scope in ('year', 'month')),
  placement integer not null default 1 check (placement > 0),
  title text not null,
  description text,
  created_at timestamptz not null default now()
);

-- Cliques no botão "tenho interesse" da área de IA (em breve).
create table ai_interest (
  student_id uuid primary key references profiles(id) on delete cascade,
  school_id uuid not null references schools(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index on classes (school_id);
create index on profiles (school_id, class_id);
create index on submissions (school_id, status, created_at);
create index on point_entries (school_id, class_id, created_at);

-- Placar: ano letivo inteiro e destaque do mês.
create view class_scores with (security_invoker = true) as
select c.school_id, c.id as class_id, c.name as class_name,
  coalesce(sum(p.amount) filter (where date_trunc('year', p.created_at) = date_trunc('year', now())), 0)::int as year_points,
  coalesce(sum(p.amount) filter (where date_trunc('month', p.created_at) = date_trunc('month', now())), 0)::int as month_points
from classes c
left join point_entries p on p.class_id = c.id
group by c.school_id, c.id, c.name;

-- Funções de apoio às políticas (security definer evita recursão de RLS em profiles).
create function my_school_id() returns uuid
language sql stable security definer set search_path = public as
$$ select school_id from profiles where id = auth.uid() $$;

create function my_role() returns user_role
language sql stable security definer set search_path = public as
$$ select role from profiles where id = auth.uid() $$;

create function is_platform_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce(my_role() = 'platform_admin', false) $$;

create function is_school_admin(target_school uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select my_role() = 'school_admin' and my_school_id() = target_school $$;

alter table schools enable row level security;
alter table classes enable row level security;
alter table profiles enable row level security;
alter table invites enable row level security;
alter table tasks enable row level security;
alter table submissions enable row level security;
alter table point_entries enable row level security;
alter table prizes enable row level security;
alter table ai_interest enable row level security;

create policy schools_read on schools for select using (id = my_school_id() or is_platform_admin());
create policy schools_platform on schools for all using (is_platform_admin()) with check (is_platform_admin());
create policy schools_admin_update on schools for update using (is_school_admin(id)) with check (is_school_admin(id));

create policy classes_read on classes for select using (school_id = my_school_id() or is_platform_admin());
create policy classes_admin on classes for all using (is_school_admin(school_id)) with check (is_school_admin(school_id));

create policy profiles_read on profiles for select
  using (id = auth.uid() or is_school_admin(school_id) or is_platform_admin());

create policy invites_admin on invites for all
  using (is_school_admin(school_id) or is_platform_admin())
  with check (is_school_admin(school_id) or is_platform_admin());

create policy tasks_read on tasks for select using (school_id = my_school_id());
create policy tasks_admin on tasks for all using (is_school_admin(school_id)) with check (is_school_admin(school_id));

create policy submissions_read on submissions for select using (school_id = my_school_id());
create policy submissions_student_insert on submissions for insert with check (
  my_role() = 'student'
  and student_id = auth.uid()
  and school_id = my_school_id()
  and class_id = (select class_id from profiles where id = auth.uid())
  and status = 'pending'
);

create policy entries_read on point_entries for select using (school_id = my_school_id());

create policy prizes_read on prizes for select using (school_id = my_school_id());
create policy prizes_admin on prizes for all using (is_school_admin(school_id)) with check (is_school_admin(school_id));

create policy ai_interest_read on ai_interest for select using (is_school_admin(school_id) or is_platform_admin() or student_id = auth.uid());
create policy ai_interest_insert on ai_interest for insert with check (
  student_id = auth.uid() and school_id = my_school_id()
  and class_id = (select class_id from profiles where id = auth.uid())
);

-- Cadastro por convite: ao criar a conta com invite_code nos metadados, o perfil nasce ligado à escola e turma.
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  inv invites;
begin
  if new.raw_user_meta_data ? 'invite_code' then
    select * into inv from invites
      where code = upper(trim(new.raw_user_meta_data->>'invite_code')) and used_at is null
      for update;
    if not found then
      raise exception 'Código de convite inválido ou já usado';
    end if;
    insert into profiles (id, school_id, class_id, role, full_name)
      values (new.id, inv.school_id, inv.class_id, inv.role, inv.full_name);
    update invites set used_by = new.id, used_at = now() where code = inv.code;
  end if;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- Avaliação de foto pelo admin escolar: aplica os pontos configurados na tarefa.
create function review_submission(p_submission uuid, p_decision submission_status, p_comment text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  s submissions;
  t tasks;
begin
  select * into s from submissions where id = p_submission for update;
  if not found or not is_school_admin(s.school_id) then
    raise exception 'Envio não encontrado';
  end if;
  if s.status <> 'pending' then
    raise exception 'Este envio já foi avaliado';
  end if;
  if p_decision not in ('approved', 'rejected', 'discarded') then
    raise exception 'Decisão inválida';
  end if;

  update submissions
    set status = p_decision, comment = nullif(trim(p_comment), ''), reviewed_by = auth.uid(), reviewed_at = now()
    where id = s.id;

  if p_decision <> 'discarded' then
    select * into t from tasks where id = s.task_id;
    insert into point_entries (school_id, class_id, task_id, submission_id, amount, reason, comment, created_by)
    values (
      s.school_id, s.class_id, t.id, s.id,
      case when p_decision = 'approved' then t.points_gain else -t.points_loss end,
      t.name, nullif(trim(p_comment), ''), auth.uid()
    );
  end if;
end $$;

-- Lançamento manual (sem foto), ex.: participação em evento.
create function add_manual_entry(p_class uuid, p_amount integer, p_reason text, p_task uuid default null, p_comment text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  c classes;
  new_id uuid;
begin
  select * into c from classes where id = p_class;
  if not found or not is_school_admin(c.school_id) then
    raise exception 'Turma não encontrada';
  end if;
  insert into point_entries (school_id, class_id, task_id, amount, reason, comment, created_by)
    values (c.school_id, c.id, p_task, p_amount, p_reason, nullif(trim(p_comment), ''), auth.uid())
    returning id into new_id;
  return new_id;
end $$;

-- Estorno: cria o lançamento inverso, com motivo, e nunca apaga o original.
create function reverse_entry(p_entry uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  e point_entries;
  new_id uuid;
begin
  select * into e from point_entries where id = p_entry;
  if not found or not is_school_admin(e.school_id) then
    raise exception 'Lançamento não encontrado';
  end if;
  if e.reverses_entry_id is not null then
    raise exception 'Não é possível estornar um estorno';
  end if;
  insert into point_entries (school_id, class_id, task_id, reverses_entry_id, amount, reason, comment, created_by)
    values (e.school_id, e.class_id, e.task_id, e.id, -e.amount, 'Estorno: ' || e.reason, p_reason, auth.uid())
    returning id into new_id;
  return new_id;
end $$;

-- Modelo pronto de tarefas para cada escola nova (a escola ajusta no painel).
create function seed_default_tasks() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into tasks (school_id, name, description, points_gain, points_loss, requires_photo, max_per_period, period) values
    (new.id, 'Sala organizada', 'Foto da sala organizada no fim da aula, sem alunos na imagem.', 1000, 1000, true, 1, 'day'),
    (new.id, 'Participação em atividade escolar', 'Turma participou de uma atividade ou evento da escola.', 500, 0, false, 5, 'month'),
    (new.id, 'Ação benéfica para a escola', 'Ação da turma que melhora a escola ou a comunidade.', 500, 0, false, 5, 'month');
  return new;
end $$;

create trigger on_school_created after insert on schools
  for each row execute function seed_default_tasks();

revoke execute on function review_submission, add_manual_entry, reverse_entry from anon;
