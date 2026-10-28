import { Card, ErrorText, SchoolShell, buttonClass, inputClass } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createSchool } from "./actions";

export default async function PlataformaPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const profile = await requireRole("platform_admin");
  const supabase = await createClient();
  const [{ data: schools }, { data: invites }] = await Promise.all([
    supabase.from("schools").select("id, name, slug").order("name"),
    supabase.from("invites").select("code, full_name, school_id").eq("role", "school_admin").is("used_at", null),
  ]);

  return (
    <SchoolShell profile={profile} title="Plataforma">
      <Card title="Escolas">
        <ul className="divide-y divide-slate-100">
          {schools?.map((s) => (
            <li key={s.id} className="py-2">
              <p className="font-medium">{s.name} <span className="text-sm text-slate-500">({s.slug})</span></p>
              {invites?.filter((i) => i.school_id === s.id).map((i) => (
                <p key={i.code} className="text-sm text-slate-600">
                  Convite do administrador ({i.full_name}): <code className="rounded bg-slate-100 px-2 font-mono">{i.code}</code>
                </p>
              ))}
            </li>
          ))}
          {!schools?.length && <li className="py-2 text-sm text-slate-500">Nenhuma escola cadastrada.</li>}
        </ul>
      </Card>

      <Card title="Nova escola">
        <form action={createSchool} className="space-y-3">
          <ErrorText message={erro} />
          <input name="name" required placeholder="Nome da escola" className={inputClass} />
          <input name="slug" required placeholder="Identificador (ex.: colegio-exemplo)" className={inputClass} />
          <input name="logo_url" type="url" placeholder="Link da logo (opcional)" className={inputClass} />
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">Cor principal <input name="primary_color" type="color" defaultValue="#0b2a5b" /></label>
            <label className="flex items-center gap-2">Cor secundária <input name="secondary_color" type="color" defaultValue="#7cc3f0" /></label>
          </div>
          <input name="admin_name" required placeholder="Nome do responsável da escola" className={inputClass} />
          <button className={buttonClass}>Criar escola e convite</button>
        </form>
      </Card>
    </SchoolShell>
  );
}
