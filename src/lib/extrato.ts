import type { SupabaseClient } from "@supabase/supabase-js";

export type Entry = {
  id: string;
  amount: number;
  reason: string;
  comment: string | null;
  created_at: string;
  reverses_entry_id: string | null;
  photo_url: string | null;
};

// Links temporários (1 hora) para fotos do bucket privado.
export async function signPhotos(supabase: SupabaseClient, paths: string[]) {
  const unique = [...new Set(paths)];
  if (unique.length === 0) return new Map<string, string>();
  const { data } = await supabase.storage.from("photos").createSignedUrls(unique, 3600);
  const urls = new Map<string, string>();
  for (const d of data ?? []) if (d.path && d.signedUrl) urls.set(d.path, d.signedUrl);
  return urls;
}

export async function loadExtrato(supabase: SupabaseClient, classId: string, limit = 50): Promise<Entry[]> {
  const { data } = await supabase
    .from("point_entries")
    .select("id, amount, reason, comment, created_at, reverses_entry_id, submissions(photo_path)")
    .eq("class_id", classId)
    .order("created_at", { ascending: false })
    .limit(limit);
  const rows = (data ?? []) as unknown as (Omit<Entry, "photo_url"> & { submissions: { photo_path: string } | null })[];
  const urls = await signPhotos(supabase, rows.flatMap((r) => (r.submissions ? [r.submissions.photo_path] : [])));
  return rows.map(({ submissions, ...r }) => ({ ...r, photo_url: submissions ? urls.get(submissions.photo_path) ?? null : null }));
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
}
