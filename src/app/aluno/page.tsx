import Link from "next/link";
import { Card, Ranking, SchoolShell, buttonClass } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/extrato";
import { createClient } from "@/lib/supabase/server";
import { registerAiInterest } from "./actions";

const STATUS_LABEL = {
  pending: "Aguardando avaliação",
  approved: "Aprovada",
  rejected: "Reprovada",
  discarded: "Descartada",
} as const;

export default async function AlunoPage({ searchParams }: { searchParams: Promise<{ enviado?: string }> }) {
  const { enviado } = await searchParams;
  const profile = await requireRole("student");
  const supabase = await createClient();
  const [{ data: scores }, { data: tasks }, { data: submissions }, { data: interest }] = await Promise.all([
    supabase.from("class_scores").select("class_id, class_name, year_points, month_points").eq("school_id", profile.school_id!),
    supabase.from("tasks").select("id, name, points_gain").eq("active", true).eq("requires_photo", true).order("name"),
    supabase
      .from("submissions")
      .select("id, status, comment, created_at, tasks(name)")
      .eq("class_id", profile.class_id!)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("ai_interest").select("student_id").eq("student_id", profile.id).maybeSingle(),
  ]);

  return (
    <SchoolShell profile={profile} title={`Olá, ${profile.full_name.split(" ")[0]}!`}>
      {enviado && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">Foto enviada! Agora é só aguardar a avaliação.</p>
      )}

      <Card title="Ranking do ano">
        <Ranking rows={scores ?? []} highlightClassId={profile.class_id} />
        <Link href="/aluno/extrato" className="mt-3 inline-block text-sm text-brand underline">Ver extrato da minha turma</Link>
      </Card>

      <Card title="Enviar foto de tarefa">
        <ul className="space-y-2">
          {tasks?.map((t) => (
            <li key={t.id}>
              <Link href={`/aluno/enviar/${t.id}`} className="flex justify-between rounded-lg border border-slate-200 px-3 py-2 hover:border-brand">
                <span>{t.name}</span>
                <span className="text-sm text-slate-500">+{t.points_gain.toLocaleString("pt-BR")}</span>
              </Link>
            </li>
          ))}
          {!tasks?.length && <li className="text-sm text-slate-500">Nenhuma tarefa com foto disponível.</li>}
        </ul>
      </Card>

      <Card title="Últimos envios da turma">
        <ul className="divide-y divide-slate-100">
          {(submissions as unknown as { id: string; status: keyof typeof STATUS_LABEL; comment: string | null; created_at: string; tasks: { name: string } | null }[] | null)?.map((s) => (
            <li key={s.id} className="py-2 text-sm">
              <div className="flex justify-between">
                <span>{s.tasks?.name}</span>
                <span className="font-medium">{STATUS_LABEL[s.status]}</span>
              </div>
              <p className="text-xs text-slate-500">{formatDate(s.created_at)}</p>
              {s.comment && <p className="text-slate-700">“{s.comment}”</p>}
            </li>
          ))}
          {!submissions?.length && <li className="py-2 text-sm text-slate-500">Nenhum envio ainda.</li>}
        </ul>
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
