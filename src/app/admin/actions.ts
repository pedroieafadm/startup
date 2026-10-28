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
