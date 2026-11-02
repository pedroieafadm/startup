import Link from "next/link";
import { Card, ErrorText, buttonClass, inputClass } from "@/components/ui";
import { signUp } from "./actions";

export default async function CadastroPage({ searchParams }: { searchParams: Promise<{ erro?: string; convite?: string }> }) {
  const { erro, convite } = await searchParams;
  const staff = convite === "1";
  return (
    <main className="mx-auto max-w-sm space-y-4 px-4 py-16">
      <h1 className="text-center text-2xl font-bold text-brand">Criar conta</h1>
      <Card>
        <form action={signUp} className="space-y-3">
          <ErrorText message={erro} />
          <input type="hidden" name="mode" value={staff ? "convite" : "turma"} />
          <input name="full_name" required={!staff} placeholder={staff ? "Nome completo (opcional)" : "Nome completo"} className={inputClass} autoComplete="name" />
          <input name="email" type="email" required placeholder={staff ? "E-mail" : "E-mail institucional da escola"} className={inputClass} autoComplete="email" />
          <input name="password" type="password" required minLength={8} placeholder="Crie uma senha (mínimo 8 caracteres)" className={inputClass} autoComplete="new-password" />
          <input name="code" required placeholder={staff ? "Código de convite" : "Código da turma (peça à coordenação)"} className={`${inputClass} uppercase`} />
          <button className={`${buttonClass} w-full`}>Criar conta</button>
        </form>
      </Card>
      <p className="text-center text-sm">
        {staff ? (
          <Link href="/cadastro" className="text-brand underline">Sou aluno: entrar com o código da turma</Link>
        ) : (
          <Link href="/cadastro?convite=1" className="text-brand underline">Sou da coordenação e recebi um convite</Link>
        )}
      </p>
      <p className="text-center text-sm">
        Já tem conta? <Link href="/entrar" className="text-brand underline">Entrar</Link>
      </p>
    </main>
  );
}
