import Anthropic from "@anthropic-ai/sdk";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { HISTORY_LIMIT, MAX_QUESTION_CHARS, TUTOR_MODEL, tutorSystemPrompt } from "@/lib/tutor";

// Resposta em linhas JSON: {"t":"delta","v":"..."} enquanto escreve, {"t":"replace","v":"..."} se a resposta
// precisar ser trocada, {"t":"done","remaining":N} no fim e {"t":"error","v":"..."} em falha.
type Event = { t: "delta" | "replace" | "error"; v: string } | { t: "done"; remaining: number };

const REFUSAL_TEXT =
  "Sobre isso eu não posso ajudar. Se quiser, me conta qual matéria você está estudando e a gente continua por ali.";

function json(status: number, error: string) {
  return Response.json({ error }, { status });
}

export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile || profile.role !== "student" || !profile.school_id) return json(401, "Entre como aluno para usar a IA.");

  if (!process.env.ANTHROPIC_API_KEY) {
    return json(503, "A IA ainda não foi ligada nesta escola. Avise a coordenação.");
  }

  const body = (await request.json().catch(() => null)) as { message?: unknown; voice?: unknown } | null;
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const voice = body?.voice === true;
  if (!message) return json(400, "Escreva sua pergunta.");
  if (message.length > MAX_QUESTION_CHARS) return json(400, `Pergunta muito longa (máximo ${MAX_QUESTION_CHARS} caracteres).`);

  const supabase = await createClient();

  // Histórico recente antes de gravar a pergunta nova.
  const { data: history } = await supabase
    .from("ai_messages")
    .select("role, content")
    .eq("student_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);

  // Gravar a pergunta também confere, no banco, o limite diário e se a escola ligou a IA.
  const { error: insertError } = await supabase
    .from("ai_messages")
    .insert({ school_id: profile.school_id, student_id: profile.id, role: "user", content: message });
  if (insertError) {
    if (insertError.message.includes("limite_diario")) return json(429, "Você chegou ao limite de perguntas de hoje. Amanhã tem mais!");
    if (insertError.message.includes("ia_desligada")) return json(403, "A IA está desligada na sua escola.");
    return json(500, "Não deu para enviar agora. Tente de novo.");
  }

  // A API exige que a conversa comece pelo aluno e alterne os papéis.
  const messages: Anthropic.Beta.BetaMessageParam[] = [];
  for (const m of (history ?? []).reverse()) {
    const role = m.role as "user" | "assistant";
    if (!messages.length && role !== "user") continue;
    const last = messages[messages.length - 1];
    if (last?.role === role) last.content = `${last.content}\n\n${m.content}`;
    else messages.push({ role, content: m.content });
  }
  const last = messages[messages.length - 1];
  if (last?.role === "user") last.content = `${last.content}\n\n${message}`;
  else messages.push({ role: "user", content: message });

  const client = new Anthropic();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: Event) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      let answer = "";
      try {
        const response = client.beta.messages.stream({
          model: TUTOR_MODEL,
          max_tokens: 2000,
          thinking: { type: "adaptive" },
          output_config: { effort: "low" },
          // Se o modelo principal recusar por política, a API tenta de novo num modelo reserva.
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          system: tutorSystemPrompt({
            firstName: profile.full_name.split(" ")[0],
            schoolName: profile.schools?.name ?? "sua escola",
            voice,
          }),
          messages,
        });
        response.on("text", (delta) => {
          answer += delta;
          send({ t: "delta", v: delta });
        });
        const final = await response.finalMessage();
        if (final.stop_reason === "refusal" || !answer.trim()) {
          answer = REFUSAL_TEXT;
          send({ t: "replace", v: answer });
        }
      } catch (err) {
        console.error("tutor", err instanceof Anthropic.APIError ? `${err.status} ${err.message}` : err);
        answer = "";
        send({ t: "error", v: "A IA não respondeu agora. Tente de novo em instantes." });
      }

      if (answer) {
        await supabase
          .from("ai_messages")
          .insert({ school_id: profile.school_id, student_id: profile.id, role: "assistant", content: answer.slice(0, 8000) });
      }
      const { data: remaining } = await supabase.rpc("ai_remaining_today");
      send({ t: "done", remaining: remaining ?? 0 });
      controller.close();
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
