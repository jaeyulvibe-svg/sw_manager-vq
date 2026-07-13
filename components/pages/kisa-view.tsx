"use client"

import { ShieldAlert } from "lucide-react"
import { NoticeReviewBoard } from "@/components/pages/notice-board/notice-review-board"
import type { ViewKey } from "@/components/portal/nav"

export function KisaView({ onNavigate }: { onNavigate?: (view: ViewKey) => void }) {
  return (
    <NoticeReviewBoard
      sourceType="kisa"
      noticeTypes={["CVE", "Patch"]}
      title="KISA 취약점 공지"
      description="KISA에서 발표한 취약점 공지를 검토·승인하고 SW 자산과 매핑하는 화면입니다. 승인된 공지는 '승인된 취약점 공지'에서 전사 현황으로 확인할 수 있습니다."
      icon={ShieldAlert}
      onNavigate={onNavigate}
    />
  )
}
