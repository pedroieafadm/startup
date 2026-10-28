import { BackLink, Card, ErrorText, SchoolShell, inputClass } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { formatDate, signPhotos } from "@/lib/extrato";
import { createClient } from "@/lib/supabase/server";
import { reviewSubmission } from "../actions";

type Pending = {
  id: string;
  photo_path: string;
  created_at: string;
  classes: { name: string } | null;
  tasks: { name: string; points_gain: number; points_loss: number } | null;
  profiles: { full_name: string } | null;
};

export default async function FilaPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const profile = await requireRole("school_admin");
  const supabase = await createClient();
  const { data } = await supabase
    .from("submissions")
    .select("id, photo_path, created_at, classes(name), tasks(name, points_gain, points_loss), profiles!submissions_student_id_fkey(full_name)")
    .eq("status", "pending")
    .order("created_at");
  const pending = (data ?? []) as unknown as Pending[];
  const urls = await signPhotos(supabase, pending.map((p) => p.photo_path));

  return (
    <SchoolShell profile={profile} title="Fotos para avaliar">
      <BackLink href="/admin">← Voltar ao painel</BackLink>
      <ErrorText message={erro} />
      {pending.length === 0 && <Card><p className="text-sm text-slate-500">Nenhuma foto aguardando avaliação.</p></Card>}
      {pending.map((p) => (
        <Card key={p.id} title={`${p.classes?.name} · ${p.tasks?.name}`}>
          <p className="mb-2 text-xs text-slate-500">Enviada por {p.profiles?.full_name} em {formatDate(p.created_at)}</p>
          {urls.get(p.photo_path) && (
            // eslint-disable-next-line @next/next/no-img-element -- link assinado e temporário do Supabase
            <img src={urls.get(p.photo_path)} alt="Foto enviada pela turma" className="mb-3 max-h-96 w-full rounded-lg object-contain bg-slate-100" />
          )}
          <form action={reviewSubmission} className="space-y-3">
            <input type="hidden" name="submission" value={p.id} />
            <input name="comment" placeholder="Comentário para a turma (opcional)" className={inputClass} />
            <div className="grid grid-cols-3 gap-2">
              <button name="decision" value="approved" className="rounded-lg bg-green-600 px-3 py-2 font-medium text-white">
                Ganhar +{p.tasks?.points_gain.toLocaleString("pt-BR")}
              </button>
              <button name="decision" value="rejected" className="rounded-lg bg-red-600 px-3 py-2 font-medium text-white">
                Perder -{p.tasks?.points_loss.toLocaleString("pt-BR")}
              </button>
              <button name="decision" value="discarded" className="rounded-lg border border-slate-300 px-3 py-2 font-medium">
                Descartar
              </button>
            </div>
          </form>
        </Card>
      ))}
    </SchoolShell>
  );
}
