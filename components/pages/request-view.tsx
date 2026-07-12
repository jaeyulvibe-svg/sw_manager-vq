"use client"

import { useEffect, useState } from "react"
import {
  FilePlus2,
  Save,
  Send,
  Paperclip,
  ClipboardList,
  Clock3,
  CircleCheck,
  CircleX,
} from "lucide-react"
import {
  PageHeader,
  StatCard,
  SectionCard,
  StatusBadge,
  TableShell,
  Th,
  Td,
  ExportExcelButton,
  type Accent,
  type RiskLevel,
} from "@/components/portal/ui"
import { createClient } from "@/lib/supabase/client"
import type { Tables } from "@/lib/supabase/types"
import { useToast } from "@/components/portal/toast"
import { useNotifications } from "@/components/portal/notifications-context"
import { MASTER_CATEGORIES, type MasterCategory } from "@/components/pages/sw-master/use-master-draft"
import { cn } from "@/lib/utils"

type AssetRequest = Tables<"asset_requests">
type MasterRow = Tables<"sw_masters">
type Server = Tables<"servers">

const approvalRisk: Record<AssetRequest["approval"], RiskLevel> = {
  반려: 5,
  승인대기: 3,
  검토중: 2,
  승인완료: 1,
}

type FormState = {
  category: MasterCategory | ""
  masterId: string
  server: string
  dept: string
  owner: string
  reason: string
}

const EMPTY_FORM: FormState = {
  category: "",
  masterId: "",
  server: "",
  dept: "",
  owner: "",
  reason: "",
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
}

function Field({
  label,
  children,
  required,
}: {
  label: string
  children: React.ReactNode
  required?: boolean
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">
        {label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </span>
      {children}
    </label>
  )
}

const inputCls =
  "w-full rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20"

export function RequestView() {
  const { toast } = useToast()
  const { refresh: refreshNotifications } = useNotifications()

  const [requests, setRequests] = useState<AssetRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [masters, setMasters] = useState<MasterRow[]>([])
  const [mastersLoading, setMastersLoading] = useState(true)
  const [servers, setServers] = useState<Server[]>([])
  const [serversLoading, setServersLoading] = useState(true)

  function loadRequests() {
    const supabase = createClient()
    supabase
      .from("asset_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setRequests(data)
        setLoading(false)
      })
  }

  useEffect(() => {
    loadRequests()
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from("sw_masters")
      .select("*")
      .eq("active", true)
      .is("deleted_at", null)
      .order("name")
      .then(({ data }) => {
        if (data) setMasters(data)
        setMastersLoading(false)
      })
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from("servers")
      .select("*")
      .order("name")
      .then(({ data }) => {
        if (data) setServers(data)
        setServersLoading(false)
      })
  }, [])

  const mastersInCategory = form.category ? masters.filter((m) => m.category === form.category) : []
  const selectedMaster = masters.find((m) => m.id === form.masterId)

  function handleCategoryChange(next: string) {
    setForm((prev) => ({ ...prev, category: next as MasterCategory | "", masterId: "" }))
  }

  const counts = {
    pending: requests.filter((r) => r.approval === "승인대기" || r.approval === "검토중").length,
    approved: requests.filter((r) => r.approval === "승인완료").length,
    rejected: requests.filter((r) => r.approval === "반려").length,
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit() {
    if (submitting) return
    if (!selectedMaster) {
      toast({
        tone: "danger",
        title: "제품을 선택해주세요",
        description: "SW 마스터 관리에 등록된 제품 중에서만 신규 자산을 요청할 수 있습니다.",
      })
      return
    }
    const requiredText: (keyof FormState)[] = ["server", "dept", "owner", "reason"]
    const missing = requiredText.some((key) => !form[key].trim())
    if (missing) {
      toast({
        tone: "danger",
        title: "필수 항목 누락",
        description: "설치 서버·사용 부서·담당자·요청 사유는 필수 입력 항목입니다.",
      })
      return
    }

    setSubmitting(true)
    const supabase = createClient()
    const { error } = await supabase.from("asset_requests").insert({
      name: selectedMaster.name,
      vendor: selectedMaster.vendor,
      category: selectedMaster.category,
      version: selectedMaster.std_version,
      server: form.server,
      owner: form.owner,
      requester: form.owner,
      requester_dept: form.dept,
      reason: form.reason,
    })
    setSubmitting(false)

    if (error) {
      toast({
        tone: "danger",
        title: "요청 등록 실패",
        description: error.message,
      })
      return
    }

    await supabase.from("notifications").insert({
      category: "asset",
      title: "신규 SW 자산 등록 요청",
      description: `${selectedMaster.name} 자산 등록 요청이 접수되었습니다.`,
      asset: selectedMaster.name,
      owner: form.owner,
      status: "승인대기",
      urgent: false,
      link_view: "approval",
      link_label: "승인 관리로 이동",
    })
    refreshNotifications()

    toast({
      tone: "success",
      title: "요청 등록 완료",
      description: `${selectedMaster.name} 신규 자산 등록 요청이 접수되었습니다. 관리자 승인 후 반영됩니다.`,
    })
    setForm(EMPTY_FORM)
    loadRequests()
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={FilePlus2}
        title="신규 자산 요청"
        description="사용자가 신규 SW 자산 등록을 요청하고, 관리자가 승인 후 공식 관리 대상으로 등록합니다."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="승인 대기" value={counts.pending} icon={Clock3} risk={3} delay={80} />
        <StatCard label="승인 완료" value={counts.approved} icon={CircleCheck} risk={1} delay={180} />
        <StatCard label="반려" value={counts.rejected} icon={CircleX} risk={5} delay={280} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Form */}
        <div className="lg:col-span-3">
          <SectionCard title="신규 자산 등록 요청서" subtitle="필수 항목을 입력해 주세요" icon={FilePlus2}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="분류" required>
                <select
                  className={inputCls}
                  value={form.category}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                >
                  <option value="">분류를 선택하세요</option>
                  {MASTER_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="등록 제품" required>
                <select
                  className={inputCls}
                  value={form.masterId}
                  onChange={(e) => update("masterId", e.target.value)}
                  disabled={!form.category}
                >
                  <option value="">
                    {!form.category
                      ? "먼저 분류를 선택하세요"
                      : mastersLoading
                        ? "불러오는 중..."
                        : mastersInCategory.length === 0
                          ? "해당 분류에 등록된 제품이 없습니다"
                          : "SW 마스터에 등록된 제품을 선택하세요"}
                  </option>
                  {mastersInCategory.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.vendor})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="버전">
                <div className="flex h-[38px] items-center rounded-lg border border-border/60 bg-background/30 px-3 text-sm text-foreground">
                  {selectedMaster ? selectedMaster.std_version : <span className="text-muted-foreground">제품을 선택하면 표시됩니다</span>}
                </div>
              </Field>
              <Field label="설치 서버" required>
                <select
                  className={inputCls}
                  value={form.server}
                  onChange={(e) => update("server", e.target.value)}
                >
                  <option value="">
                    {serversLoading
                      ? "불러오는 중..."
                      : servers.length === 0
                        ? "등록된 서버가 없습니다"
                        : "설치할 서버를 선택하세요"}
                  </option>
                  {servers.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name} · {s.hostname} ({s.ip})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="담당자" required>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className={inputCls}
                    placeholder="부서 (예: WAS운영팀)"
                    value={form.dept}
                    onChange={(e) => update("dept", e.target.value)}
                  />
                  <input
                    className={inputCls}
                    placeholder="이름 (예: 홍길동)"
                    value={form.owner}
                    onChange={(e) => update("owner", e.target.value)}
                  />
                </div>
              </Field>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4">
              <Field label="요청 사유" required>
                <textarea
                  rows={3}
                  className={inputCls}
                  placeholder="신규 도입 배경 및 사용 목적을 입력하세요"
                  value={form.reason}
                  onChange={(e) => update("reason", e.target.value)}
                />
              </Field>
              <Field label="첨부 파일">
                <div className="flex items-center gap-2 rounded-lg border border-dashed border-border/60 bg-background/40 px-3 py-3 text-sm text-muted-foreground">
                  <Paperclip className="h-4 w-4" />
                  구성도 / 도입 계획서 등을 첨부하세요 (준비 중)
                </div>
              </Field>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setForm(EMPTY_FORM)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/50 px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <Save className="h-4 w-4" />
                초기화
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmit}
                className="glow-card inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/15 px-4 py-2 text-sm font-semibold text-primary transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {submitting ? "등록 중..." : "등록 요청"}
              </button>
            </div>
          </SectionCard>
        </div>

        {/* Approval status cards */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <SectionCard title="승인 프로세스" subtitle="요청 → 검토 → 승인 → 등록" icon={ClipboardList}>
            <ol className="flex flex-col gap-3">
              {[
                { step: "1", label: "요청 등록", desc: "사용자 신규 자산 요청", accent: "primary" as Accent, done: true },
                { step: "2", label: "관리자 검토", desc: "중복 여부 확인", accent: "warning" as Accent, done: true },
                { step: "3", label: "승인 / 반려", desc: "관리자 승인 결정", accent: "success" as Accent, done: false },
                { step: "4", label: "마스터 등록", desc: "공식 관리 대상 편입", accent: "eos" as Accent, done: false },
              ].map((s) => (
                <li key={s.step} className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/40 p-3">
                  <StatusBadge accent={s.accent}>{s.step}</StatusBadge>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{s.label}</p>
                    <p className="truncate text-xs text-muted-foreground">{s.desc}</p>
                  </div>
                  {s.done ? (
                    <CircleCheck className="h-4 w-4 text-success" />
                  ) : (
                    <Clock3 className="h-4 w-4 text-muted-foreground" />
                  )}
                </li>
              ))}
            </ol>
          </SectionCard>
        </div>
      </div>

      {/* Request list */}
      <SectionCard
        title="요청 내역"
        subtitle="최근 신규 자산 등록 요청"
        icon={ClipboardList}
        action={
          <ExportExcelButton
            rows={requests}
            filename="신규_자산_요청_내역"
            columns={[
              { label: "요청번호", value: (r: AssetRequest) => r.no },
              { label: "제품명", value: (r: AssetRequest) => r.name },
              { label: "벤더", value: (r: AssetRequest) => r.vendor },
              { label: "요청자", value: (r: AssetRequest) => r.requester },
              { label: "요청일", value: (r: AssetRequest) => formatDate(r.created_at) },
              { label: "승인 상태", value: (r: AssetRequest) => r.approval },
            ]}
          />
        }
      >
        <TableShell>
          <thead>
            <tr>
              <Th>요청번호</Th>
              <Th>제품명</Th>
              <Th>벤더</Th>
              <Th>요청자</Th>
              <Th>요청일</Th>
              <Th>승인 상태</Th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id} className="transition-colors hover:bg-accent/40">
                <Td className="font-mono text-xs text-muted-foreground">{r.no}</Td>
                <Td className="font-semibold">{r.name}</Td>
                <Td className="text-muted-foreground">{r.vendor}</Td>
                <Td>{r.requester}</Td>
                <Td className="text-xs text-muted-foreground">{formatDate(r.created_at)}</Td>
                <Td>
                  <StatusBadge risk={approvalRisk[r.approval]}>{r.approval}</StatusBadge>
                </Td>
              </tr>
            ))}
            {!loading && requests.length === 0 ? (
              <tr>
                <Td className={cn("py-8 text-center text-muted-foreground")}>
                  <span className="block w-full">등록된 요청이 없습니다.</span>
                </Td>
              </tr>
            ) : null}
          </tbody>
        </TableShell>
        {loading ? <p className="mt-2 text-xs text-muted-foreground">불러오는 중…</p> : null}
      </SectionCard>
    </div>
  )
}
