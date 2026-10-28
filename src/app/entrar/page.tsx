import Link from "next/link";
import { Card, ErrorText, buttonClass, inputClass } from "@/components/ui";
import { signIn } from "./actions";

export default async function EntrarPage({ searchParams }: { searchParams: Promise<{ erro?: string; msg?: string }> }) {
  const { erro, msg } = await searchParams;
  return (
    <main className="mx-auto max-w-sm space-y-4 px-4 py-16">
      <h1 className="text-center text-2xl font-bold text-brand">Entrar</h1>
      <Card>
        <form action={signIn} className="space-y-3">
          <ErrorText message={erro} />
          {msg && <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">{msg}</p>}
          <input name="email" type="email" required placeholder="E-mail" className={inputClass} autoComplete="email" />
          <input name="password" type="password" required placeholder="Senha" className={inputClass} autoComplete="current-password" />
          <button className={`${buttonClass} w-full`}>Entrar</button>
        </form>
      </Card>
      <p className="text-center text-sm">
        Recebeu um código da escola? <Link href="/cadastro" className="text-brand underline">Criar conta</Link>
      </p>
    </main>
  );
}
