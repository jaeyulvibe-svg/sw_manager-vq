import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, Tables } from "@/lib/supabase/types"

type Vulnerability = Tables<"vulnerabilities">
type Asset = Tables<"assets">

export type ApprovalPolicy = {
  criticalUrgentAlert: boolean
}

/**
 * 매칭된 자산을 '확인필요'로 플래그하고 담당자에게 알림을 생성한다.
 * Critical 등급 공지는 policy.criticalUrgentAlert가 false면 알림을 건너뛴다.
 */
export async function flagMatchedAssetsAndNotify(
  supabase: SupabaseClient<Database>,
  notice: Pick<Vulnerability, "id" | "title" | "cve" | "severity" | "notice_type" | "eos_date">,
  matched: Asset[],
  policy: ApprovalPolicy,
): Promise<{ notifiedCount: number }> {
  if (matched.length === 0) return { notifiedCount: 0 }

  const toFlag = matched
    .filter((a) => a.approval !== "승인완료" && a.approval !== "긴급")
    .map((a) => a.id)
  if (toFlag.length > 0) {
    await supabase.from("assets").update({ approval: "확인필요" }).in("id", toFlag)
  }

  // EOS 공지 승인 시 매칭 자산의 EOS 날짜를 바로 반영한다 —
  // 그렇지 않으면 관리자 페이지의 "즉시 수집"(endoflife.date 실시간 조회) 버튼을
  // 별도로 눌러야만 자산 목록/EOS 로드맵에 날짜가 채워져 승인 직후에는 반영이 안 된 것처럼 보인다.
  if (notice.notice_type === "EOS" && notice.eos_date) {
    await supabase.from("assets").update({ eos: notice.eos_date }).in("id", matched.map((a) => a.id))
  }

  await supabase.from("patch_tasks").upsert(
    matched.map((a) => ({
      vulnerability_id: notice.id,
      asset_id: a.id,
      owner: a.owner,
    })),
    { onConflict: "vulnerability_id,asset_id", ignoreDuplicates: true },
  )

  if (notice.severity === "Critical" && !policy.criticalUrgentAlert) {
    return { notifiedCount: 0 }
  }

  const isEos = notice.notice_type === "EOS"
  await supabase.from("notifications").insert(
    matched.map((a) => ({
      category: "security" as const,
      title: isEos ? `${notice.title} 관련 지원종료(EOS) 대응 필요` : `${notice.title} 관련 패치 필요`,
      description: isEos
        ? `${a.name} (${a.server}) 자산의 제품이 지원종료(EOS) 대상입니다. ${notice.cve} 공지를 확인하고 교체·업그레이드 등 후속 조치를 계획해주세요.`
        : `${a.name} (${a.server}) 자산에 ${notice.cve} 관련 보안 패치 적용이 필요합니다. 확인 후 조치해주세요.`,
      asset: `${a.name} ${a.version}`,
      owner: a.owner,
      status: "확인필요" as const,
      urgent: notice.severity === "Critical",
      link_view: "patch",
      link_label: "승인된 취약점 공지로 이동",
    })),
  )

  return { notifiedCount: matched.length }
}

/** 이미 존재하는 공지 행을 승인 처리 (수동 승인 버튼 경로). */
export async function applyNoticeApproval(
  supabase: SupabaseClient<Database>,
  v: Pick<Vulnerability, "id" | "title" | "cve" | "severity" | "notice_type" | "eos_date">,
  matched: Asset[],
  policy: ApprovalPolicy,
): Promise<{ notifiedCount: number }> {
  await supabase
    .from("vulnerabilities")
    .update({ approval: "승인완료", mapped_assets: matched.length })
    .eq("id", v.id)

  return flagMatchedAssetsAndNotify(supabase, v, matched, policy)
}
