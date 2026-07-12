// components/pages/eos-notice-view.tsx
"use client"

import { CalendarClock } from "lucide-react"
import { NoticeReviewBoard } from "@/components/pages/notice-board/notice-review-board"
import type { ViewKey } from "@/components/portal/nav"

export function EosNoticeView({ onNavigate }: { onNavigate?: (view: ViewKey) => void }) {
  return (
    <NoticeReviewBoard
      noticeTypes={["EOS"]}
      title="EOS 공지"
      description="제조사가 발표한 단종(EOL)/지원종료 공지를 검토·승인하고 SW 자산과 매핑하는 화면입니다. KISA·제조사 출처를 가리지 않고 EOS 공지를 모두 모아 보여줍니다. 승인된 공지는 '승인된 취약점 공지'에서 확인할 수 있습니다."
      icon={CalendarClock}
      onNavigate={onNavigate}
    />
  )
}
