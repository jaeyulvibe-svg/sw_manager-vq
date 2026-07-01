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
} from "@/components/portal/ui"
import {
  useNotifications,
  CATEGORY_META,
  STATUS_ACCENT,
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

const READ_FILTERS: { key: "all" | "unread" | "read"; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "unread", label: "읽지 않음" },
  { key: "read", label: "읽음" },
]

export function NotificationsView({
  onNavigate,
}: {
  onNavigate: (view: ViewKey) => void
}) {
  const { notifications, unreadCount, urgentCount, markRead, markAllRead } =
    useNotifications()

  const [query, setQuery] = useState("")
  const [type, setType] = useState<"all" | NotifCategory>("all")
  const [read, setRead] = useState<"all" | "unread" | "read">("all")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return notifications
      .filter((n) => {
        if (type !== "all" && n.category !== type) return false
        if (read === "unread" && n.read) return false
        if (read === "read" && !n.read) return false
        if (q) {
          const hay = `${n.title} ${n.description} ${n.asset} ${n.owner}`.toLowerCase()
          if (!hay.includes(q)) return false
        }
        return true
      })
      .sort((a, b) => a.order - b.order)
  }, [notifications, query, type, read])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Bell}
        title="알림 센터"
        description="SW 자산관리, EOS, 패치, 보안공지, 승인 요청 등 전사 이벤트를 한 곳에서 확인하고 관련 메뉴로 바로 이동합니다."
        action={
          <button
            type="button"
            onClick={markAllRead}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/12 px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/20"
          >
            <CheckCheck className="h-4 w-4" />
            전체 읽음 처리
          </button>
        }
      />

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="전체 알림"
          value={notifications.length}
          icon={Bell}
          accent="primary"
          trendLabel="누적 알림"
          delay={80}
        />
        <StatCard
          label="읽지 않음"
          value={unreadCount}
          icon={Check}
          accent="warning"
          trendLabel="확인 대기"
          delay={160}
        />
        <StatCard
          label="긴급"
          value={urgentCount}
          icon={Bell}
          accent="destructive"
          trendLabel="즉시 조치 필요"
          delay={240}
        />
      </div>

      {/* Filters */}
      <div className="glow-card flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="제목, 상세, 관련 자산, 담당자 검색"
            className="w-full rounded-lg border border-border/60 bg-background/60 py-2 pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50"
          />
        </div>
        <div className="flex flex-col gap-2">
          <FilterRow options={TYPE_FILTERS} value={type} onChange={setType} />
          <FilterRow options={READ_FILTERS} value={read} onChange={setRead} />
        </div>
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
          {filtered.map((n) => {
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
                    <StatusBadge accent="destructive" pulse>
                      긴급
                    </StatusBadge>
                  ) : (
                    <StatusBadge accent="muted">일반</StatusBadge>
                  )}
                </Td>
                <Td>
                  <StatusBadge
                    accent={STATUS_ACCENT[n.status]}
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
                        읽음
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
