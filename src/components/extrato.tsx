import { formatDate, type Entry } from "@/lib/extrato";

export function ExtratoList({ entries, action }: {
  entries: Entry[];
  action?: (entry: Entry, reversed: boolean) => React.ReactNode;
}) {
  const reversedIds = new Set(entries.map((e) => e.reverses_entry_id).filter(Boolean));
  if (entries.length === 0) return <p className="text-sm text-slate-500">Nenhuma movimentação ainda.</p>;
  return (
    <ul className="divide-y divide-slate-100">
      {entries.map((e) => (
        <li key={e.id} className="space-y-1 py-3">
          <div className="flex justify-between gap-3">
            <span className="font-medium">{e.reason}</span>
            <span className={e.amount > 0 ? "font-semibold text-green-700" : "font-semibold text-red-700"}>
              {e.amount > 0 ? "+" : ""}{e.amount.toLocaleString("pt-BR")}
            </span>
          </div>
          <p className="text-xs text-slate-500">{formatDate(e.created_at)}</p>
          {e.comment && <p className="text-sm text-slate-700">“{e.comment}”</p>}
          {e.photo_url && (
            <a href={e.photo_url} target="_blank" rel="noreferrer" className="text-sm text-brand underline">Ver foto</a>
          )}
          {action?.(e, reversedIds.has(e.id))}
        </li>
      ))}
    </ul>
  );
}
