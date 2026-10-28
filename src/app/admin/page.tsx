import Link from "next/link";
import { Card, ErrorText, Ranking, SchoolShell, buttonClass, inputClass } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createClass } from "./actions";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const profile = await requireRole("school_admin");
  const supabase = await createClient();
  const { data: scores } = await supabase
    .from("class_scores")
    .select("class_id, class_name, year_points, month_points")
    .eq("school_id", profile.school_id!);

  return (
    <SchoolShell profile={profile} title="Painel da escola">
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
