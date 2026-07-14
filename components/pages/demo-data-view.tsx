"use client"

import { useEffect, useState } from "react"
import { RotateCcw, Save, AlertTriangle } from "lucide-react"
import {
  PageHeader,
  SectionCard,
  StatusBadge,
  MiniButton,
  ConfirmDialog,
} from "@/components/portal/ui"
import { useToast } from "@/components/portal/toast"
import { createClient } from "@/lib/supabase/client"
import type { Tables } from "@/lib/supabase/types"

type DemoSnapshot = Tables<"demo_snapshots">

const INCLUDED_TABLES: { key: string; label: string }[] = [
  { key: "assets", label: "자산 목록" },
  { key: "servers", label: "서버" },
  { key: "vulnerabilities", label: "취약점 공지" },
  { key: "asset_requests", label: "신규 자산 요청" },
  { key: "notifications", label: "알림" },
  { key: "notices", label: "공지사항" },
  { key: "licenses", label: "라이선스" },
  { key: "sw_masters", label: "SW 마스터" },
  { key: "sources", label: "Source URL" },
  { key: "app_users", label: "사용자" },
  { key: "patch_tasks", label: "조치 업무" },
]

function formatTimestamp(iso: string | null | undefined) {
  if (!iso) return "저장된 기준 없음"
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function DemoDataView() {
  const { toast } = useToast()
  const [snapshot, setSnapshot] = useState<DemoSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [confirmKind, setConfirmKind] = useState<"save" | "reset" | null>(null)

  function loadSnapshot() {
    const supabase = createClient()
    supabase
      .from("demo_snapshots")
      .select("*")
      .eq("id", "default")
      .maybeSingle()
      .then(({ data }) => {
        setSnapshot(data)
        setLoading(false)
      })
  }

  useEffect(() => {
    loadSnapshot()
  }, [])

  async function handleSave() {
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase.rpc("save_demo_snapshot")
    setBusy(false)
    setConfirmKind(null)
    if (error) {
      toast({ tone: "danger", title: "기준 저장 실패", description: error.message })
      return
    }
    toast({ tone: "success", title: "현재 데이터가 새 기준으로 저장되었습니다" })
    loadSnapshot()
  }

  async function handleReset() {
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase.rpc("reset_demo_data")
    if (error) {
      setBusy(false)
      setConfirmKind(null)
      toast({ tone: "danger", title: "초기화 실패", description: error.message })
      return
    }
    toast({ tone: "success", title: "샘플 데이터가 기준 상태로 초기화되었습니다" })
    window.location.reload()
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={RotateCcw}
        title="DEMO 데이터 설정"
        description="시연 중 바뀐 데이터를 저장된 기준 상태로 되돌립니다. 기준은 언제든 현재 데이터로 다시 저장할 수 있습니다."
      />

      <SectionCard
        title="기준 스냅샷"
        subtitle={loading ? "불러오는 중..." : `마지막 기준 저장: ${formatTimestamp(snapshot?.captured_at)}`}
        icon={RotateCcw}
      >
        <div className="flex flex-col gap-4">
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">포함되는 데이터 (11개 테이블)</p>
            <div className="flex flex-wrap gap-1.5">
              {INCLUDED_TABLES.map((t) => (
                <StatusBadge key={t.key} accent="muted">{t.label}</StatusBadge>
              ))}
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5" />
              관리자 정책(자동수집/승인 정책 설정)은 포함되지 않습니다 — 초기화해도 그대로 유지됩니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-4">
            <MiniButton accent="primary" onClick={() => setConfirmKind("save")} disabled={busy}>
              <Save className="h-3.5 w-3.5" />
              현재 데이터를 새 기준으로 저장
            </MiniButton>
            <MiniButton accent="destructive" onClick={() => setConfirmKind("reset")} disabled={busy}>
              <RotateCcw className="h-3.5 w-3.5" />
              샘플 데이터 초기화
            </MiniButton>
          </div>
        </div>
      </SectionCard>

      <ConfirmDialog
        open={confirmKind === "save"}
        title="현재 데이터를 새 기준으로 저장할까요?"
        description="지금 저장돼 있는 기준 스냅샷을 덮어씁니다. 이전 기준으로는 다시 되돌릴 수 없습니다."
        confirmLabel="새 기준으로 저장"
        tone="default"
        onConfirm={handleSave}
        onCancel={() => setConfirmKind(null)}
      />
      <ConfirmDialog
        open={confirmKind === "reset"}
        title="샘플 데이터를 초기화할까요?"
        description="자산·취약점 공지·알림 등 11개 테이블의 모든 데이터가 삭제되고 저장된 기준 데이터로 교체됩니다. 되돌릴 수 없습니다."
        confirmLabel="초기화"
        tone="danger"
        onConfirm={handleReset}
        onCancel={() => setConfirmKind(null)}
      />
    </div>
  )
}
