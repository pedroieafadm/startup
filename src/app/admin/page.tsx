import Link from "next/link";
import { Card, ErrorText, Ranking, SchoolShell, buttonClass, inputClass } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createClass } from "./actions";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const profile = await requireRole("school_admin");
  const supabase = await createClient();
  const [{ data: scores }, { count: pending }] = await Promise.all([
    supabase.from("class_scores").select("class_id, class_name, year_points, month_points").eq("school_id", profile.school_id!),
    supabase.from("submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  return (
    <SchoolShell profile={profile} title="Painel da escola">
      <Link href="/admin/fila" className="flex items-center justify-between rounded-xl bg-brand px-4 py-3 text-white shadow-sm">
        <span className="font-semibold">Fotos para avaliar</span>
        <span className="rounded-full bg-white px-3 py-0.5 text-sm font-bold text-brand">{pending ?? 0}</span>
      </Link>

      <Card title="Ranking do ano">
        <Ranking rows={scores ?? []} />
      </Card>

      <Card title="Turmas">
        <ErrorText message={erro} />
        <ul className="mb-4 divide-y divide-slate-100">
          {[...(scores ?? [])]
            .sort((a, b) => a.class_name.localeCompare(b.class_name, "pt-BR"))
            .map((c) => (
              <li key={c.class_id} className="py-2">
                <Link href={`/admin/turmas/${c.class_id}`} className="text-brand underline">{c.class_name}</Link>
              </li>
            ))}
        </ul>
        <form action={createClass} className="flex gap-2">
          <input name="name" required placeholder="Nome da turma (ex.: 1º A)" className={inputClass} />
          <button className={buttonClass}>Adicionar</button>
        </form>
      </Card>
    </SchoolShell>
  );
}
