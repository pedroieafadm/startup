import Link from "next/link";
import type { Profile } from "@/lib/auth";

export function SchoolShell({ profile, title, children }: { profile: Profile; title: string; children: React.ReactNode }) {
  const school = profile.schools;
  const style = school
    ? ({ "--brand": school.primary_color, "--brand-2": school.secondary_color } as React.CSSProperties)
    : undefined;
  return (
    <div style={style} className="min-h-screen">
      <header className="bg-brand text-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- logo vem de link externo da escola */}
            {school?.logo_url && <img src={school.logo_url} alt="" className="h-8 w-8 rounded bg-white object-contain" />}
            <div>
              <p className="text-xs opacity-80">{school?.name ?? "Plataforma"}</p>
              <h1 className="font-semibold">{title}</h1>
            </div>
          </div>
          <form action="/sair" method="post">
            <button className="rounded border border-white/40 px-3 py-1 text-sm hover:bg-white/10">Sair</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">{children}</main>
    </div>
  );
}

export function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      {title && <h2 className="mb-3 font-semibold text-brand">{title}</h2>}
      {children}
    </section>
  );
}

export const inputClass = "w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand focus:outline-none";
export const buttonClass = "rounded-lg bg-brand px-4 py-2 font-medium text-white hover:opacity-90 disabled:opacity-50";

export function ErrorText({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p>;
}

export function Ranking({ rows, highlightClassId }: {
  rows: { class_id: string; class_name: string; year_points: number; month_points: number }[];
  highlightClassId?: string | null;
}) {
  const byYear = [...rows].sort((a, b) => b.year_points - a.year_points);
  const monthLeader = [...rows].sort((a, b) => b.month_points - a.month_points)[0];
  return (
    <div className="space-y-3">
      {monthLeader && monthLeader.month_points > 0 && (
        <p className="rounded-lg bg-brand-2/30 px-3 py-2 text-sm">
          Destaque do mês: <strong>{monthLeader.class_name}</strong> ({monthLeader.month_points.toLocaleString("pt-BR")} pontos)
        </p>
      )}
      <ol className="divide-y divide-slate-100">
        {byYear.map((r, i) => (
          <li key={r.class_id} className={`flex justify-between py-2 ${r.class_id === highlightClassId ? "font-semibold text-brand" : ""}`}>
            <span>{i + 1}º {r.class_name}</span>
            <span>{r.year_points.toLocaleString("pt-BR")} pts</span>
          </li>
        ))}
        {byYear.length === 0 && <li className="py-2 text-sm text-slate-500">Nenhuma turma cadastrada ainda.</li>}
      </ol>
    </div>
  );
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="text-sm text-brand underline">{children}</Link>;
}
