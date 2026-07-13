import type { Tables } from "@/lib/supabase/types"

export type MasterRow = Tables<"sw_masters">
export type MasterCategory = MasterRow["category"]

export const MASTER_CATEGORIES: MasterCategory[] = ["OS", "WEB", "WAS", "DB", "Middleware", "Security"]

/** 실제 인증 도입 전까지 고정하는 mock 수정자명 — sidebar.tsx의 CURRENT_USER.admin과 동일 */
export const MASTER_ACTOR = "김관리"

export function formatDateOnly(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`
}
