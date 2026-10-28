"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function registerAiInterest() {
  const profile = await requireRole("student");
  const supabase = await createClient();
  await supabase
    .from("ai_interest")
    .upsert({ student_id: profile.id, school_id: profile.school_id, class_id: profile.class_id }, { ignoreDuplicates: true });
  revalidatePath("/aluno");
}
