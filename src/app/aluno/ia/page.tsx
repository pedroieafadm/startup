import { BackLink, SchoolShell } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TutorChat } from "./tutor-chat";

export default async function IaPage() {
  const profile = await requireRole("student");
  const supabase = await createClient();
  const [{ data: history }, { data: remaining }] = await Promise.all([
    supabase
      .from("ai_messages")
      .select("id, role, content")
      .eq("student_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.rpc("ai_remaining_today"),
  ]);

  return (
    <SchoolShell profile={profile} title="IA tutora">
      <BackLink href="/aluno">← Voltar</BackLink>
      <TutorChat
        firstName={profile.full_name.split(" ")[0]}
        enabled={Boolean(process.env.ANTHROPIC_API_KEY)}
        initialRemaining={remaining ?? 0}
        initialMessages={(history ?? []).reverse().map((m) => ({ id: String(m.id), role: m.role as "user" | "assistant", content: m.content }))}
      />
    </SchoolShell>
  );
}
