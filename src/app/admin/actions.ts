"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function createClass(formData: FormData) {
  const profile = await requireRole("school_admin");
  const name = String(formData.get("name")).trim();
  if (!name) return;
  const supabase = await createClient();
  const { error } = await supabase.from("classes").insert({ school_id: profile.school_id, name });
  if (error) redirect("/admin?erro=" + encodeURIComponent("Já existe uma turma com esse nome."));
  revalidatePath("/admin");
}

// Um nome por linha: facilita colar a lista de alunos de uma planilha.
export async function inviteStudents(classId: string, formData: FormData) {
  const profile = await requireRole("school_admin");
  const names = String(formData.get("names"))
    .split("\n")
    .map((n) => n.trim())
    .filter(Boolean);
  if (names.length === 0) return;
  const supabase = await createClient();
  const { error } = await supabase.from("invites").insert(
    names.map((full_name) => ({ school_id: profile.school_id, class_id: classId, role: "student", full_name })),
  );
  if (error) redirect(`/admin/turmas/${classId}?erro=` + encodeURIComponent("Não foi possível gerar os convites."));
  revalidatePath(`/admin/turmas/${classId}`);
}

export async function deleteInvite(classId: string, code: string) {
  await requireRole("school_admin");
  const supabase = await createClient();
  await supabase.from("invites").delete().eq("code", code).is("used_at", null);
  revalidatePath(`/admin/turmas/${classId}`);
}

export async function reviewSubmission(formData: FormData) {
  await requireRole("school_admin");
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_submission", {
    p_submission: String(formData.get("submission")),
    p_decision: String(formData.get("decision")),
    p_comment: String(formData.get("comment") ?? ""),
  });
  if (error) redirect("/admin/fila?erro=" + encodeURIComponent(error.message));
  revalidatePath("/admin/fila");
  revalidatePath("/admin");
}

// Lançamento sem foto: usa os pontos da tarefa escolhida ou um valor livre.
export async function addManualEntry(classId: string, formData: FormData) {
  await requireRole("school_admin");
  const supabase = await createClient();
  const back = `/admin/turmas/${classId}`;
  const taskId = String(formData.get("task") ?? "");
  const sign = formData.get("direction") === "lose" ? -1 : 1;
  let amount = Math.abs(Number(formData.get("amount")) || 0);
  let reason = String(formData.get("reason") ?? "").trim();

  if (taskId) {
    const { data: task } = await supabase.from("tasks").select("name, points_gain, points_loss").eq("id", taskId).single();
    if (!task) redirect(back + "?erro=" + encodeURIComponent("Tarefa não encontrada."));
    amount = amount || (sign > 0 ? task.points_gain : task.points_loss);
    reason = reason || task.name;
  }
  if (!amount || !reason) redirect(back + "?erro=" + encodeURIComponent("Informe a tarefa ou o valor e o motivo."));

  const { error } = await supabase.rpc("add_manual_entry", {
    p_class: classId,
    p_amount: sign * amount,
    p_reason: reason,
    p_task: taskId || null,
    p_comment: String(formData.get("comment") ?? ""),
  });
  if (error) redirect(back + "?erro=" + encodeURIComponent(error.message));
  revalidatePath(back);
}

export async function reverseEntry(classId: string, entryId: string, formData: FormData) {
  await requireRole("school_admin");
  const supabase = await createClient();
  const reason = String(formData.get("reason") ?? "").trim();
  const back = `/admin/turmas/${classId}`;
  if (!reason) redirect(back + "?erro=" + encodeURIComponent("Informe o motivo do estorno."));
  const { error } = await supabase.rpc("reverse_entry", { p_entry: entryId, p_reason: reason });
  if (error) redirect(back + "?erro=" + encodeURIComponent(error.message));
  revalidatePath(back);
}
