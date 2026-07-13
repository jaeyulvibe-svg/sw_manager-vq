import type { TablesInsert } from "@/lib/supabase/types"

type NoticeType = TablesInsert<"vulnerabilities">["notice_type"]

// 제목 키워드로 공지 유형을 분류한다. TmaxSoft 게시판 공지와 KNVD(KISA) RSS 공지가
// 이 로직을 공유한다 — 원래 collectTmaxSoft 안에 있던 인라인 분기를 그대로 옮긴 것.
export function classifyNoticeType(title: string): NoticeType | null {
  if (title.includes("EOL") || title.includes("EOS") || title.includes("단종")) return "EOS"
  if (title.includes("취약점") || title.includes("보안")) return "CVE"
  if (title.includes("패치")) return "Patch"
  return null
}
