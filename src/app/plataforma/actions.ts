"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Cria a escola (com o modelo pronto de tarefas) e o convite do primeiro administrador.
export async function createSchool(formData: FormData) {
  await requireRole("platform_admin");
  const supabase = await createClient();
  const name = String(formData.get("name")).trim();
  const slug = String(formData.get("slug")).trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");

  const { data: school, error } = await supabase
    .from("schools")
    .insert({
      name,
      slug,
      logo_url: String(formData.get("logo_url")).trim() || null,
      primary_color: String(formData.get("primary_color")),
      secondary_color: String(formData.get("secondary_color")),
    })
    .select("id")
    .single();
  if (error || !school) redirect("/plataforma?erro=" + encodeURIComponent("Não foi possível criar a escola. O identificador já existe?"));

  await supabase.from("invites").insert({
    school_id: school.id,
    role: "school_admin",
    full_name: String(formData.get("admin_name")).trim(),
  });
  revalidatePath("/plataforma");
}
