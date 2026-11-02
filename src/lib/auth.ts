import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "platform_admin" | "school_admin" | "student";

export type Profile = {
  id: string;
  full_name: string;
  role: Role;
  school_id: string | null;
  class_id: string | null;
  schools: { name: string; logo_url: string | null; primary_color: string; secondary_color: string } | null;
};

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, role, school_id, class_id, schools(name, logo_url, primary_color, secondary_color)")
    .eq("id", user.id)
    .single();
  return data as Profile | null;
}

export function homeFor(role: Role) {
  return { platform_admin: "/plataforma", school_admin: "/admin", student: "/aluno" }[role];
}

// Garante que o usuário logado tem o papel esperado; senão manda para a tela certa.
export async function requireRole(role: Role): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/entrar");
  if (profile.role !== role) redirect(homeFor(profile.role));
  return profile;
}
