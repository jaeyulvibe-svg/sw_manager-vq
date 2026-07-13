"use client"

import { createClient } from "@/lib/supabase/client"
import { applyNoticeApproval, type ApprovalPolicy } from "@/lib/notice-approval"
import type { Asset, Vulnerability } from "./use-notice-data"

export async function approveNotice(
  v: Vulnerability,
  matched: Asset[],
  policy: ApprovalPolicy,
): Promise<{ notifiedCount: number }> {
  const supabase = createClient()
  return applyNoticeApproval(supabase, v, matched, policy)
}

export async function rejectNotice(v: Vulnerability): Promise<void> {
  const supabase = createClient()
  await supabase.from("vulnerabilities").update({ approval: "반려" }).eq("id", v.id)
}
