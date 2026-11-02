"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

// Reduz a foto para no máximo 1600px em JPEG: envio mais rápido e menos espaço guardado.
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao processar a foto"))), "image/jpeg", 0.8),
  );
}

export function PhotoForm({ taskId, schoolId, classId, studentId }: {
  taskId: string;
  schoolId: string;
  classId: string;
  studentId: string;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function send() {
    if (!file) return;
    setSending(true);
    setError(null);
    try {
      const supabase = createClient();
      const path = `${schoolId}/${classId}/${crypto.randomUUID()}.jpg`;
      const upload = await supabase.storage.from("photos").upload(path, await shrink(file), { contentType: "image/jpeg" });
      if (upload.error) throw new Error("Não foi possível enviar a foto.");
      const { error: insertError } = await supabase.from("submissions").insert({
        school_id: schoolId,
        class_id: classId,
        task_id: taskId,
        student_id: studentId,
        photo_path: path,
      });
      if (insertError) {
        await supabase.storage.from("photos").remove([path]);
        throw new Error(insertError.message.includes("período") ? "Sua turma já enviou esta tarefa hoje." : "Não foi possível registrar o envio.");
      }
      router.push("/aluno?enviado=1");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao enviar.");
      setSending(false);
    }
  }

  return (
    <div className="space-y-3">
      <label className="block cursor-pointer rounded-xl border-2 border-dashed border-brand-2 p-6 text-center text-brand">
        {/* eslint-disable-next-line @next/next/no-img-element -- prévia local da câmera */}
        {preview ? <img src={preview} alt="Prévia da foto" className="mx-auto max-h-80 rounded-lg" /> : "Toque para abrir a câmera"}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setFile(f);
            setPreview(f ? URL.createObjectURL(f) : null);
          }}
        />
      </label>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button onClick={send} disabled={!file || sending} className={`${buttonClass} w-full`}>
        {sending ? "Enviando..." : "Enviar foto"}
      </button>
    </div>
  );
}
