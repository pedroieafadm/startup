-- Cadastro do aluno com e-mail institucional + código da turma.
-- Cada turma tem um código que o responsável divulga; o e-mail precisa ser do domínio da escola.

alter table schools add column email_domain text;  -- ex.: colegiopiloto.edu.br (sem @)

create function new_class_code() returns text
language sql volatile as $$ select upper(substr(md5(gen_random_uuid()::text), 1, 6)) $$;

alter table classes add column join_code text unique default new_class_code();
update classes set join_code = new_class_code() where join_code is null;
alter table classes alter column join_code set not null;

-- Gera um código novo (ex.: se o antigo vazou para outra turma).
create function regenerate_class_code(p_class uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  c classes;
  code text;
begin
  select * into c from classes where id = p_class;
  if not found or not is_school_admin(c.school_id) then
    raise exception 'Turma não encontrada';
  end if;
  update classes set join_code = new_class_code() where id = p_class returning join_code into code;
  return code;
end $$;

-- Cadastro: código da turma (alunos) ou convite (responsáveis).
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  inv invites;
  c classes;
  s schools;
  name text := nullif(trim(new.raw_user_meta_data->>'full_name'), '');
begin
  if new.raw_user_meta_data ? 'class_code' then
    select * into c from classes where join_code = upper(trim(new.raw_user_meta_data->>'class_code'));
    if not found then
      raise exception 'Código da turma inválido';
    end if;
    select * into s from schools where id = c.school_id;
    if s.email_domain is not null and lower(split_part(new.email, '@', 2)) <> lower(s.email_domain) then
      raise exception 'Use o e-mail institucional da escola';
    end if;
    if name is null then
      raise exception 'Informe o nome completo';
    end if;
    insert into profiles (id, school_id, class_id, role, full_name)
      values (new.id, c.school_id, c.id, 'student', name);
  elsif new.raw_user_meta_data ? 'invite_code' then
    select * into inv from invites
      where code = upper(trim(new.raw_user_meta_data->>'invite_code')) and used_at is null
      for update;
    if not found then
      raise exception 'Código de convite inválido ou já usado';
    end if;
    insert into profiles (id, school_id, class_id, role, full_name)
      values (new.id, inv.school_id, inv.class_id, inv.role, coalesce(name, inv.full_name));
    update invites set used_by = new.id, used_at = now() where code = inv.code;
  end if;
  return new;
end $$;

-- O responsável pode trocar o aluno de turma (ex.: entrou com o código errado).
create function move_student(p_student uuid, p_class uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  st profiles;
  c classes;
begin
  select * into st from profiles where id = p_student and role = 'student';
  select * into c from classes where id = p_class;
  if st.id is null or c.id is null or st.school_id <> c.school_id or not is_school_admin(c.school_id) then
    raise exception 'Aluno ou turma não encontrados';
  end if;
  update profiles set class_id = c.id where id = st.id;
end $$;

revoke execute on function regenerate_class_code, move_student from anon;

-- Checagem antes do cadastro, para mostrar ao aluno o erro certo (código errado ou e-mail fora da escola).
create function check_signup(p_class_code text, p_email text) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  c classes;
  s schools;
begin
  select * into c from classes where join_code = upper(trim(p_class_code));
  if not found then
    return 'Código da turma não encontrado. Confira com a coordenação.';
  end if;
  select * into s from schools where id = c.school_id;
  if s.email_domain is not null and lower(split_part(trim(p_email), '@', 2)) <> lower(s.email_domain) then
    return 'Use seu e-mail institucional (@' || s.email_domain || ').';
  end if;
  return null;
end $$;

grant execute on function check_signup to anon, authenticated;
