"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Tables } from "@/lib/supabase/types"
import { matchAssets } from "@/lib/vuln-match"
import type { RiskLevel } from "@/components/portal/ui"

export type Vulnerability = Tables<"vulnerabilities">
export type Asset = Tables<"assets">
export type Server = Tables<"servers">

export type NoticeDataFilter = {
  sourceType?: Vulnerability["source_type"]
  noticeTypes?: Vulnerability["notice_type"][]
}

export const sevRisk: Record<Vulnerability["severity"], RiskLevel> = {
  Critical: 5, High: 4, Medium: 3, Low: 2,
}

export function formatCollected(iso: string) {
  const d = new Date(iso)
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000)
  const time = d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
  if (diffDays === 0) return `오늘 ${time}`
  if (diffDays === 1) return `어제 ${time}`
  return `${d.toLocaleDateString("ko-KR", { month: "long", day: "numeric" })} ${time}`
}

export function useNoticeData(filter: NoticeDataFilter = {}) {
  const { sourceType, noticeTypes } = filter
  const noticeTypesKey = noticeTypes ? noticeTypes.join(",") : ""
  const [vulns, setVulns] = useState<Vulnerability[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [servers, setServers] = useState<Server[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    const supabase = createClient()
    let vulnQuery = supabase
      .from("vulnerabilities")
      .select("*")
      .order("collected_at", { ascending: false })
    if (sourceType) vulnQuery = vulnQuery.eq("source_type", sourceType)
    if (noticeTypesKey) {
      vulnQuery = vulnQuery.in(
        "notice_type",
        noticeTypesKey.split(",") as Vulnerability["notice_type"][],
      )
    }

    Promise.all([
      vulnQuery,
      supabase.from("assets").select("*"),
      supabase.from("servers").select("*"),
    ]).then(([vulnRes, assetRes, serverRes]) => {
      if (vulnRes.data) setVulns(vulnRes.data)
      if (assetRes.data) setAssets(assetRes.data)
      if (serverRes.data) setServers(serverRes.data)
      setLoading(false)
    })
    // sourceType/noticeTypesKey are primitives derived from `filter`, so this only
    // re-fires when the actual filter *value* changes, not on every re-render that
    // happens to construct a new `filter` object literal.
  }, [sourceType, noticeTypesKey])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  // 공지의 product 문자열과 실제 보유 자산명을 매칭 (실시간 계산, mapped_assets 컬럼은 신뢰하지 않음)
  const matchMap = useMemo(() => {
    const map = new Map<string, Asset[]>()
    for (const v of vulns) map.set(v.id, matchAssets(v, assets))
    return map
  }, [vulns, assets])

  // assets.server는 servers.id(레거시 시드) 또는 servers.name(신규 승인분)이 섞여 있으므로
  // 항상 실제 서버 레코드로 정규화해서 이름/hostname/ip를 얻는다.
  const findServer = useMemo(() => {
    const byId = new Map(servers.map((s) => [s.id, s]))
    const byName = new Map(servers.map((s) => [s.name, s]))
    return (raw: string) => byId.get(raw) ?? byName.get(raw)
  }, [servers])

  return { vulns, setVulns, assets, servers, findServer, matchMap, loading, refresh: load }
}
