import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/types"
import { normalizeAssetVersion, matchReleaseCycle } from "@/lib/eos-version-match"

// endoflife.date API v1(Beta) 응답 — 이번 기능에서 실제로 쓰는 필드만 선언한다.
// 문서에 없는 필드가 추가돼도 무시되므로(모르는 필드는 그냥 안 읽음) 깨지지 않는다.
type EndOfLifeRelease = {
  name: string
  eolFrom: string | null
  isEol: boolean
}
type EndOfLifeResponse = {
  result: {
    label: string
    links?: { html?: string | null }
    releases: EndOfLifeRelease[]
  }
}

const EOS_PRODUCTS = [
  "Apache Tomcat",
  "Nginx",
  "PostgreSQL",
  "Oracle Database",
  "Red Hat Enterprise Linux",
] as const

const FETCH_TIMEOUT_MS = 8000

type ProductResult = {
  product: string
  ok: boolean
  updatedAssets: number
  unmatchedAssets: string[]
  error?: string
}

function supabaseAdmin() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function fetchEndOfLife(productKey: string): Promise<EndOfLifeResponse> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(`https://endoflife.date/api/v1/products/${productKey}/`, {
      signal: controller.signal,
      cache: "no-store",
    })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }
    const data = (await res.json()) as unknown
    if (
      typeof data !== "object" || data === null ||
      !("result" in data) || typeof (data as EndOfLifeResponse).result !== "object" ||
      !Array.isArray((data as EndOfLifeResponse).result?.releases)
    ) {
      throw new Error("응답 형식 오류(result.releases 없음)")
    }
    return data as EndOfLifeResponse
  } finally {
    clearTimeout(timeout)
  }
}

async function syncProduct(
  supabase: ReturnType<typeof supabaseAdmin>,
  productName: string,
  productKey: string,
): Promise<ProductResult> {
  try {
    const { data: assets, error: assetsErr } = await supabase
      .from("assets")
      .select("id, version")
      .eq("name", productName)
    if (assetsErr) throw assetsErr
    if (!assets || assets.length === 0) {
      return { product: productName, ok: true, updatedAssets: 0, unmatchedAssets: [] }
    }

    const eol = await fetchEndOfLife(productKey)
    const availableCycles = eol.result.releases.map((r) => r.name)

    let updatedAssets = 0
    const unmatchedAssets: string[] = []

    for (const asset of assets) {
      const normalized = normalizeAssetVersion(productKey, asset.version)
      const cycle = normalized ? matchReleaseCycle(normalized, availableCycles) : null
      const release = cycle ? eol.result.releases.find((r) => r.name === cycle) : undefined

      if (!release) {
        unmatchedAssets.push(`${asset.id} (${asset.version})`)
        continue
      }
      // eolFrom이 없으면(문서에 날짜가 없는 release) 기존 assets.eos를 건드리지 않는다 —
      // "정보 없음"을 임의로 만들어내지 않기 위해.
      if (!release.eolFrom) {
        unmatchedAssets.push(`${asset.id} (${asset.version}) — EOS 날짜 미제공`)
        continue
      }

      const { error: updErr } = await supabase
        .from("assets")
        .update({ eos: release.eolFrom })
        .eq("id", asset.id)
      if (updErr) throw updErr
      updatedAssets++
    }

    return { product: productName, ok: true, updatedAssets, unmatchedAssets }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { product: productName, ok: false, updatedAssets: 0, unmatchedAssets: [], error: message }
  }
}

export async function POST() {
  const supabase = supabaseAdmin()

  const { data: masters, error: mastersErr } = await supabase
    .from("sw_masters")
    .select("name, eos_source, eos_source_product_key")
    .eq("eos_source", "endoflife.date")
    .not("eos_source_product_key", "is", null)
    .is("deleted_at", null)

  if (mastersErr) {
    return NextResponse.json({ error: mastersErr.message }, { status: 500 })
  }

  const targets = (masters ?? []).filter((m) =>
    EOS_PRODUCTS.includes(m.name as (typeof EOS_PRODUCTS)[number]),
  )

  if (targets.length === 0) {
    return NextResponse.json(
      { error: "eos_source_product_key가 설정된 지원 대상 제품이 없습니다." },
      { status: 400 },
    )
  }

  const results = await Promise.all(
    targets.map((m) => syncProduct(supabase, m.name, m.eos_source_product_key!)),
  )

  return NextResponse.json({ results, syncedAt: new Date().toISOString() })
}
