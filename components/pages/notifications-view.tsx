"use client"

import { useMemo, useState } from "react"
import { Bell, Search, CheckCheck, Check, ArrowRight } from "lucide-react"
import {
  PageHeader,
  StatCard,
  StatusBadge,
  TableShell,
  Th,
  Td,
  MiniButton,
  ExportExcelButton,
  usePagination,
  Pagination,
} from "@/components/portal/ui"
import {
  useNotifications,
  CATEGORY_META,
  STATUS_RISK,
  type NotifCategory,
} from "@/components/portal/notifications-context"
import { type ViewKey } from "@/components/portal/nav"
import { cn } from "@/lib/utils"

const TYPE_FILTERS: { key: "all" | NotifCategory; label: string }[] = [
  { key: "all", label: "전체 유형" },
  { key: "asset", label: "자산" },
  { key: "security", label: "보안" },
  { key: "system", label: "시스템" },
]

type StatFilter = "all" | "unread" | "urgent"

export function NotificationsView({
  onNavigate,
}: {
  onNavigate: (view: ViewKey) => void
}) {
  const { notifications, unreadCount, urgentCount, markRead, markAllRead } =
    useNotifications()

  const [query, setQuery] = useState("")
  const [type, setType] = useState<"all" | NotifCategory>("all")
  const [statFilter, setStatFilter] = useState<StatFilter>("all")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return notifications
      .filter((n) => {
        if (type !== "all" && n.category !== type) return false
        if (statFilter === "unread" && n.read) return false
        if (statFilter === "urgent" && !n.urgent) return false
        if (q) {
          const hay = `${n.title} ${n.description} ${n.asset} ${n.owner}`.toLowerCase()
          if (!hay.includes(q)) return false
        }
        return true
      })
      .sort((a, b) => a.order - b.order)
  }, [notifications, query, type, statFilter])
  const pagination = usePagination(filtered)

  function selectStatFilter(next: StatFilter) {
    setStatFilter(next)
    pagination.setPage(1)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Bell}
        title="알림"
        description="SW 자산관리, EOS, 패치, 보안공지, 승인 요청 등 전사 이벤트를 한 곳에서 확인하고 관련 메뉴로 바로 이동합니다."
        action={
          <div className="flex items-center gap-2">
            <ExportExcelButton
              rows={filtered}
              filename="알림_센터"
              columns={[
                { label: "발생 시간", value: (n) => n.time },
                { label: "유형", value: (n) => CATEGORY_META[n.category].label },
                { label: "제목", value: (n) => n.title },
                { label: "관련 자산", value: (n) => n.asset },
                { label: "담당자", value: (n) => n.owner },
                { label: "중요도", value: (n) => (n.urgent ? "긴급" : "일반") },
                { label: "상태", value: (n) => n.status },
              ]}
            />
            <button
              type="button"
              onClick={markAllRead}
              className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/12 px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/20"
            >
              <CheckCheck className="h-4 w-4" />
              전체 읽음 처리
            </button>
          </div>
        }
      />

      {/* Summary KPIs — 클릭하면 그 조건으로 목록이 바로 필터링된다 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => selectStatFilter("all")}
          aria-pressed={statFilter === "all"}
          className="rounded-2xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <StatCard
            label="전체 알림"
            value={notifications.length}
            icon={Bell}
            accent="primary"
            trendLabel="누적 알림"
            delay={80}
            className={cn(statFilter === "all" && "ring-2 ring-primary/60")}
          />
        </button>
        <button
          type="button"
          onClick={() => selectStatFilter("unread")}
          aria-pressed={statFilter === "unread"}
          className="rounded-2xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <StatCard
            label="읽지 않음"
            value={unreadCount}
            icon={Check}
            risk={3}
            trendLabel="확인 대기"
            delay={160}
            className={cn(statFilter === "unread" && "ring-2 ring-primary/60")}
          />
        </button>
        <button
          type="button"
          onClick={() => selectStatFilter("urgent")}
          aria-pressed={statFilter === "urgent"}
          className="rounded-2xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <StatCard
            label="긴급"
            value={urgentCount}
            icon={Bell}
            risk={5}
            trendLabel="즉시 조치 필요"
            delay={240}
            className={cn(statFilter === "urgent" && "ring-2 ring-primary/60")}
          />
        </button>
      </div>

      {/* Filters */}
      <div className="glow-card flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); pagination.setPage(1) }}
            placeholder="제목, 상세, 관련 자산, 담당자 검색"
            className="w-full rounded-lg border border-border/60 bg-background/60 py-2 pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50"
          />
        </div>
        <FilterRow options={TYPE_FILTERS} value={type} onChange={(v) => { setType(v); pagination.setPage(1) }} />
      </div>

      {/* Table */}
      <TableShell>
        <thead>
          <tr>
            <Th>발생 시간</Th>
            <Th>유형</Th>
            <Th>제목</Th>
            <Th>관련 자산</Th>
            <Th>담당자</Th>
            <Th>중요도</Th>
            <Th>상태</Th>
            <Th>바로가기</Th>
          </tr>
        </thead>
        <tbody>
          {pagination.pageItems.map((n) => {
            const meta = CATEGORY_META[n.category]
            return (
              <tr
                key={n.id}
                className={cn(
                  "transition-colors hover:bg-accent/40",
                  !n.read && "bg-primary/[0.04]",
                )}
              >
                <Td className="text-muted-foreground">{n.time}</Td>
                <Td>
                  <StatusBadge accent={meta.accent}>{meta.label}</StatusBadge>
                </Td>
                <Td className="max-w-xs">
                  <div className="flex items-center gap-2">
                    {!n.read ? (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    ) : null}
                    <span className="truncate font-medium text-foreground">
                      {n.title}
                    </span>
                  </div>
                </Td>
                <Td className="text-muted-foreground">{n.asset}</Td>
                <Td className="text-muted-foreground">{n.owner}</Td>
                <Td>
                  {n.urgent ? (
                    <StatusBadge risk={5} pulse>
                      긴급
                    </StatusBadge>
                  ) : (
                    <StatusBadge accent="muted">일반</StatusBadge>
                  )}
                </Td>
                <Td>
                  <StatusBadge
                    risk={STATUS_RISK[n.status]}
                    pulse={n.status === "긴급"}
                  >
                    {n.status}
                  </StatusBadge>
                </Td>
                <Td>
                  <div className="flex items-center gap-1.5">
                    <MiniButton
                      accent="primary"
                      onClick={() => {
                        markRead(n.id)
                        onNavigate(n.link.view)
                      }}
                    >
                      {n.link.label}
                      <ArrowRight className="h-3 w-3" />
                    </MiniButton>
                    {!n.read ? (
                      <MiniButton accent="muted" onClick={() => markRead(n.id)}>
                        <Check className="h-3 w-3" />
                        알림확인
                      </MiniButton>
                    ) : null}
                  </div>
                </Td>
              </tr>
            )
          })}
          {filtered.length === 0 ? (
            <tr>
              <td
                colSpan={8}
                className="border-b border-border/40 px-3 py-10 text-center text-sm text-muted-foreground"
              >
                검색 조건에 맞는 알림이 없습니다.
              </td>
            </tr>
          ) : null}
        </tbody>
      </TableShell>
      {filtered.length > 0 && (
        <Pagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          totalPages={pagination.totalPages}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
        />
      )}
    </div>
  )
}

function FilterRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            value === o.key
              ? "border-primary/50 bg-primary/15 text-primary"
              : "border-border/60 text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
