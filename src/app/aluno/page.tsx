import { Card, Ranking, SchoolShell, buttonClass } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { registerAiInterest } from "./actions";

export default async function AlunoPage() {
  const profile = await requireRole("student");
  const supabase = await createClient();
  const [{ data: scores }, { data: interest }] = await Promise.all([
    supabase.from("class_scores").select("class_id, class_name, year_points, month_points").eq("school_id", profile.school_id!),
    supabase.from("ai_interest").select("student_id").eq("student_id", profile.id).maybeSingle(),
  ]);

  return (
    <SchoolShell profile={profile} title={`Olá, ${profile.full_name.split(" ")[0]}!`}>
      <Card title="Ranking do ano">
        <Ranking rows={scores ?? []} highlightClassId={profile.class_id} />
      </Card>

      <Card title="IA tutora (em breve)">
        <p className="mb-3 text-sm text-slate-600">
          Uma IA da própria escola para tirar dúvidas e estudar, explicando o raciocínio em vez de entregar a resposta pronta.
        </p>
        {interest ? (
          <p className="text-sm font-medium text-brand">Anotado! Você vai saber quando ela chegar.</p>
        ) : (
          <form action={registerAiInterest}>
            <button className={buttonClass}>Tenho interesse</button>
          </form>
        )}
      </Card>
    </SchoolShell>
  );
}
