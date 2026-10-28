import { redirect } from "next/navigation";
import { getProfile, homeFor } from "@/lib/auth";

export default async function Home() {
  const profile = await getProfile();
  if (!profile) redirect("/entrar?erro=" + encodeURIComponent("Sua conta não está ligada a nenhuma escola."));
  redirect(homeFor(profile.role));
}
