"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signUp(formData: FormData) {
  const supabase = await createClient();
  const password = String(formData.get("password"));
  if (password.length < 8) redirect("/cadastro?erro=" + encodeURIComponent("A senha precisa ter pelo menos 8 caracteres."));

  // O banco valida o código e cria o perfil ligado à escola e à turma (gatilho handle_new_user).
  const { data, error } = await supabase.auth.signUp({
    email: String(formData.get("email")).trim(),
    password,
    options: { data: { invite_code: String(formData.get("code")).trim().toUpperCase() } },
  });
  if (error) {
    const message = error.message.includes("Database error")
      ? "Código de convite inválido ou já usado."
      : "Não foi possível criar a conta. Confira os dados e tente de novo.";
    redirect("/cadastro?erro=" + encodeURIComponent(message));
  }
  if (!data.session) {
    redirect("/entrar?msg=" + encodeURIComponent("Conta criada! Confirme seu e-mail e depois entre."));
  }
  redirect("/");
}
