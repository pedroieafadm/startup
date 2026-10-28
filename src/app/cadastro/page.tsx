import Link from "next/link";
import { Card, ErrorText, buttonClass, inputClass } from "@/components/ui";
import { signUp } from "./actions";

export default async function CadastroPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return (
    <main className="mx-auto max-w-sm space-y-4 px-4 py-16">
      <h1 className="text-center text-2xl font-bold text-brand">Criar conta</h1>
      <Card>
        <form action={signUp} className="space-y-3">
          <ErrorText message={erro} />
          <input name="code" required placeholder="Código de convite da escola" className={`${inputClass} uppercase`} />
          <input name="email" type="email" required placeholder="E-mail" className={inputClass} autoComplete="email" />
          <input name="password" type="password" required minLength={8} placeholder="Senha (mínimo 8 caracteres)" className={inputClass} autoComplete="new-password" />
          <button className={`${buttonClass} w-full`}>Criar conta</button>
        </form>
      </Card>
      <p className="text-center text-sm">
        Já tem conta? <Link href="/entrar" className="text-brand underline">Entrar</Link>
      </p>
    </main>
  );
}
