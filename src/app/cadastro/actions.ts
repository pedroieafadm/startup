"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function fail(message: string, convite: boolean): never {
  redirect(`/cadastro?${convite ? "convite=1&" : ""}erro=` + encodeURIComponent(message));
}

// Aluno: e-mail institucional + código da turma. Coordenação: código de convite.
export async function signUp(formData: FormData) {
  const supabase = await createClient();
  const convite = formData.get("mode") === "convite";
  const email = String(formData.get("email")).trim();
  const password = String(formData.get("password"));
  const fullName = String(formData.get("full_name") ?? "").trim();
  const code = String(formData.get("code")).trim().toUpperCase();

  if (password.length < 8) fail("A senha precisa ter pelo menos 8 caracteres.", convite);
  if (!convite) {
    if (!fullName) fail("Informe seu nome completo.", convite);
    const { data: problem } = await supabase.rpc("check_signup", { p_class_code: code, p_email: email });
    if (problem) fail(problem, convite);
  }

  // O banco valida de novo e cria o perfil ligado à escola e à turma (gatilho handle_new_user).
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: convite ? { invite_code: code, full_name: fullName || undefined } : { class_code: code, full_name: fullName } },
  });
  if (error) {
    fail(
      error.message.includes("already registered")
        ? "Este e-mail já tem conta. Use a opção Entrar."
        : error.message.includes("Database error")
          ? convite ? "Código de convite inválido ou já usado." : "Confira o código da turma e o e-mail institucional."
          : "Não foi possível criar a conta. Confira os dados e tente de novo.",
      convite,
    );
  }
  if (!data.session) {
    redirect("/entrar?msg=" + encodeURIComponent("Conta criada! Confirme seu e-mail e depois entre."));
  }
  redirect("/");
}
