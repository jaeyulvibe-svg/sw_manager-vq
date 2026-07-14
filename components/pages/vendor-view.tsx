// components/pages/vendor-view.tsx
"use client"

import { ShieldAlert } from "lucide-react"
import { NoticeReviewBoard } from "@/components/pages/notice-board/notice-review-board"
import type { ViewKey } from "@/components/portal/nav"

export function VendorView({ onNavigate }: { onNavigate?: (view: ViewKey) => void }) {
  return (
    <NoticeReviewBoard
      sourceType="vendor"
      noticeTypes={["CVE", "Patch"]}
      title="제조사 공지"
      description="Apache·TmaxSoft 등 제조사 공식 보안 공지를 검토·승인하고 SW 자산과 매핑하는 화면입니다. 승인된 공지는 '패치&취약점&EOS공지'에서 전사 현황으로 확인할 수 있습니다."
      icon={ShieldAlert}
      onNavigate={onNavigate}
      initialPageSize={5}
      pageSizeOptions={[5, 10, 20]}
    />
  )
}
