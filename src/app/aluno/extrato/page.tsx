import { ExtratoList } from "@/components/extrato";
import { BackLink, Card, SchoolShell } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { loadExtrato } from "@/lib/extrato";
import { createClient } from "@/lib/supabase/server";

export default async function ExtratoAlunoPage() {
  const profile = await requireRole("student");
  const supabase = await createClient();
  const entries = await loadExtrato(supabase, profile.class_id!);
  return (
    <SchoolShell profile={profile} title="Extrato da turma">
      <BackLink href="/aluno">← Voltar</BackLink>
      <Card>
        <ExtratoList entries={entries} />
      </Card>
    </SchoolShell>
  );
}
