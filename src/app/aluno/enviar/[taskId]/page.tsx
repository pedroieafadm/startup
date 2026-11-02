import { notFound } from "next/navigation";
import { BackLink, Card, SchoolShell } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PhotoForm } from "./photo-form";

export default async function EnviarPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const profile = await requireRole("student");
  const supabase = await createClient();
  const { data: task } = await supabase
    .from("tasks")
    .select("id, name, description, points_gain, points_loss")
    .eq("id", taskId)
    .eq("active", true)
    .eq("requires_photo", true)
    .single();
  if (!task) notFound();

  return (
    <SchoolShell profile={profile} title={task.name}>
      <BackLink href="/aluno">← Voltar</BackLink>
      <Card>
        {task.description && <p className="mb-2 text-slate-700">{task.description}</p>}
        <p className="mb-4 text-sm text-slate-600">
          Vale +{task.points_gain.toLocaleString("pt-BR")} se aprovada
          {task.points_loss > 0 && ` ou -${task.points_loss.toLocaleString("pt-BR")} se reprovada`}.
        </p>
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Não fotografe colegas: tire a foto com a sala vazia, mostrando só o espaço.
        </p>
        <PhotoForm taskId={task.id} schoolId={profile.school_id!} classId={profile.class_id!} studentId={profile.id} />
      </Card>
    </SchoolShell>
  );
}
