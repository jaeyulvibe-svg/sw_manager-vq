"use client"

import { createClient } from "@/lib/supabase/client"
import type { Asset, Vulnerability } from "./use-notice-data"

export async function approveNotice(
  v: Vulnerability,
  matched: Asset[],
): Promise<{ notifiedCount: number }> {
  const supabase = createClient()

  await supabase
    .from("vulnerabilities")
    .update({ approval: "승인완료", mapped_assets: matched.length })
    .eq("id", v.id)

  if (matched.length === 0) return { notifiedCount: 0 }

  const toFlag = matched
    .filter((a) => a.approval !== "승인완료" && a.approval !== "긴급")
    .map((a) => a.id)
  if (toFlag.length > 0) {
    await supabase.from("assets").update({ approval: "확인필요" }).in("id", toFlag)
  }

  await supabase.from("notifications").insert(
    matched.map((a) => ({
      category: "security" as const,
      title: `${v.title} 관련 패치 필요`,
      description: `${a.name} (${a.server}) 자산에 ${v.cve} 관련 보안 패치 적용이 필요합니다. 확인 후 조치해주세요.`,
      asset: `${a.name} ${a.version}`,
      owner: a.owner,
      status: "확인필요" as const,
      urgent: v.severity === "Critical",
      link_view: "patch",
      link_label: "승인된 취약점 공지로 이동",
    })),
  )

  return { notifiedCount: matched.length }
}

export async function rejectNotice(v: Vulnerability): Promise<void> {
  const supabase = createClient()
  await supabase.from("vulnerabilities").update({ approval: "반려" }).eq("id", v.id)
}
