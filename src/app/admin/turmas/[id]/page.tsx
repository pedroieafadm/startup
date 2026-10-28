import { notFound } from "next/navigation";
import { BackLink, Card, ErrorText, SchoolShell, buttonClass, inputClass } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { deleteInvite, inviteStudents } from "../../actions";

export default async function TurmaPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { id } = await params;
  const { erro } = await searchParams;
  const profile = await requireRole("school_admin");
  const supabase = await createClient();

  const { data: turma } = await supabase.from("classes").select("id, name").eq("id", id).single();
  if (!turma) notFound();

  const [{ data: students }, { data: invites }] = await Promise.all([
    supabase.from("profiles").select("id, full_name").eq("class_id", id).eq("role", "student").order("full_name"),
    supabase.from("invites").select("code, full_name").eq("class_id", id).is("used_at", null).order("full_name"),
  ]);

  return (
    <SchoolShell profile={profile} title={`Turma ${turma.name}`}>
      <BackLink href="/admin">← Voltar ao painel</BackLink>

      <Card title={`Alunos com conta (${students?.length ?? 0})`}>
        <ul className="divide-y divide-slate-100">
          {students?.map((s) => <li key={s.id} className="py-2">{s.full_name}</li>)}
          {!students?.length && <li className="py-2 text-sm text-slate-500">Nenhum aluno criou conta ainda.</li>}
        </ul>
      </Card>

      <Card title="Convites pendentes">
        <p className="mb-3 text-sm text-slate-600">
          Entregue o código a cada aluno. Ele cria a conta em <strong>/cadastro</strong> e entra direto nesta turma.
        </p>
        <ul className="divide-y divide-slate-100">
          {invites?.map((inv) => (
            <li key={inv.code} className="flex items-center justify-between py-2">
              <span>{inv.full_name}</span>
              <span className="flex items-center gap-3">
                <code className="rounded bg-slate-100 px-2 py-1 font-mono">{inv.code}</code>
                <form action={deleteInvite.bind(null, id, inv.code)}>
                  <button className="text-sm text-red-600 underline">Excluir</button>
                </form>
              </span>
            </li>
          ))}
          {!invites?.length && <li className="py-2 text-sm text-slate-500">Nenhum convite pendente.</li>}
        </ul>
      </Card>

      <Card title="Adicionar alunos">
        <form action={inviteStudents.bind(null, id)} className="space-y-3">
          <ErrorText message={erro} />
          <textarea name="names" required rows={5} placeholder={"Um nome por linha\nAna Souza\nBruno Lima"} className={inputClass} />
          <button className={buttonClass}>Gerar convites</button>
        </form>
      </Card>
    </SchoolShell>
  );
}
