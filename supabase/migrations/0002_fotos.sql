-- Fotos das tarefas: bucket privado, caminho {school_id}/{class_id}/{arquivo}.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

create policy photos_student_upload on storage.objects for insert to authenticated with check (
  bucket_id = 'photos'
  and my_role() = 'student'
  and (storage.foldername(name))[1] = my_school_id()::text
  and (storage.foldername(name))[2] = (select class_id::text from public.profiles where id = auth.uid())
);

create policy photos_school_read on storage.objects for select to authenticated using (
  bucket_id = 'photos' and (storage.foldername(name))[1] = my_school_id()::text
);

-- Regras do envio: tarefa ativa da mesma escola, que pede foto, dentro do limite do período.
create function check_submission() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  t tasks;
  used integer;
begin
  select * into t from tasks where id = new.task_id;
  if not found or t.school_id <> new.school_id or not t.active or not t.requires_photo then
    raise exception 'Tarefa indisponível para envio de foto';
  end if;
  if new.photo_path not like new.school_id::text || '/' || new.class_id::text || '/%' then
    raise exception 'Foto em local inválido';
  end if;
  select count(*) into used from submissions
    where class_id = new.class_id and task_id = new.task_id and status <> 'discarded'
      and created_at >= date_trunc(t.period::text, now());
  if used >= t.max_per_period then
    raise exception 'A turma já enviou esta tarefa no período';
  end if;
  return new;
end $$;

create trigger before_submission_insert before insert on submissions
  for each row execute function check_submission();
