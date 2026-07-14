import { NextResponse } from "next/server"
import * as cheerio from "cheerio"
import { createClient } from "@supabase/supabase-js"
import type { Database, TablesInsert } from "@/lib/supabase/types"
import { classifyNoticeType } from "@/lib/notice-classify"
import { normalizeAssetVersion } from "@/lib/eos-version-match"

export type CollectProduct =
  | "Apache Tomcat"
  | "Nginx"
  | "PostgreSQL"
  | "OpenSSL"
  | "Red Hat Enterprise Linux"
  | "Oracle Database"
  | "KISA"

const COLLECT_PRODUCTS: CollectProduct[] = [
  "Apache Tomcat",
  "Nginx", "PostgreSQL", "OpenSSL", "Red Hat Enterprise Linux", "Oracle Database",
  "KISA",
]

type FoundNotice = TablesInsert<"vulnerabilities">

type CollectResult = {
  product: CollectProduct
  ok: boolean
  newCount: number
  error?: string
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

function supabaseAdmin() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}


async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA }, cache: "no-store" })
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`)
  return res.text()
}

const APACHE_SEVERITY_MAP: Record<string, FoundNotice["severity"]> = {
  Critical: "Critical",
  Important: "High",
  Moderate: "Medium",
  Low: "Low",
}

// tomcat.apache.org/security-10.html: 각 버전 섹션(<h3 id="Fixed_in_Apache_Tomcat_X.Y.Z">) 아래
// <div class="text"> 안에 CVE 항목마다 <p><strong>심각도: 제목</strong> <a>CVE-ID</a></p> 가 반복된다.
// 자산 설치 버전(10.1.x 브랜치)에 맞춰 10.x 페이지를 사용한다.
async function collectApacheTomcat(): Promise<FoundNotice[]> {
  const url = "https://tomcat.apache.org/security-10.html"
  const html = await fetchHtml(url)
  const $ = cheerio.load(html)
  const notices: FoundNotice[] = []

  // 페이지 전체(수년치 이력)를 매번 다시 훑지 않도록 최근 릴리스 섹션만 확인한다.
  const RECENT_SECTIONS = 8
  $("h3[id^='Fixed_in_Apache_Tomcat_']")
    .slice(0, RECENT_SECTIONS)
    .each((_, h3el) => {
    const $h3 = $(h3el)
    const fixedVersion = $h3
      .clone()
      .children("span")
      .remove()
      .end()
      .text()
      .replace("Fixed in Apache Tomcat", "")
      .trim()
    const releaseDate = $h3.find("span.pull-right").text().trim()

    const $body = $h3.next("div.text")
    let current: { severity: string; title: string; cve: string; paras: string[] } | null = null

    const flush = () => {
      if (!current) return
      const joined = current.paras.join(" ")
      const publicMatch = joined.match(/made public on ([0-9]{1,2} [A-Za-z]+ [0-9]{4})/)
      const affectsMatch = joined.match(/Affects:\s*([^.]+)/)
      const collectedAt = publicMatch ? new Date(publicMatch[1]) : new Date()
      const severity = APACHE_SEVERITY_MAP[current.severity] ?? "Medium"
      notices.push({
        cve: current.cve,
        title: current.title,
        severity,
        product: `Apache Tomcat ${affectsMatch ? affectsMatch[1].trim() : fixedVersion}`,
        source: "Apache Tomcat 공식 보안 공지",
        source_url: url,
        source_type: "vendor",
        notice_type: "CVE",
        mapped_assets: 0,
        collected_at: collectedAt.toISOString(),
      })
      current = null
    }

    $body.children("p").each((_, pEl) => {
      const $p = $(pEl)
      const $strong = $p.children("strong").first()
      const $cveLink = $p.find("a[href*='cvename.cgi']")
      if ($strong.length && $cveLink.length) {
        flush()
        const label = $strong.text().trim()
        const sepIdx = label.indexOf(":")
        current = {
          severity: sepIdx >= 0 ? label.slice(0, sepIdx).trim() : "Moderate",
          title: sepIdx >= 0 ? label.slice(sepIdx + 1).trim() : label,
          cve: $cveLink.first().text().trim(),
          paras: [],
        }
      } else if (current) {
        current.paras.push($p.text().trim())
      }
    })
    flush()
  })

  return notices
}

const NGINX_SEVERITY_MAP: Record<string, FoundNotice["severity"]> = {
  critical: "Critical",
  high: "High",
  major: "High",
  medium: "Medium",
  low: "Low",
  minor: "Low",
}

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]+>/g, "").trim()
}

const NGINX_RECENT_COUNT = 30

// nginx.org/en/security_advisories.html: 각 공지가
// <li><p>제목<br>Severity: <b>등급</b><br><a>Advisory</a><br><a href="...cve.org...">CVE-ID</a><br>
// Not vulnerable: ...<br>Vulnerable: 버전범위</p></li> 형태로 나열된다.
// <br> 태그로 줄이 나뉘므로 raw HTML을 <br> 기준으로 쪼갠 뒤 각 줄의 태그를 벗겨 파싱한다.
// 페이지 전체(수년치 이력)를 매번 다시 훑지 않도록 최근 NGINX_RECENT_COUNT개만 처리한다.
async function collectNginx(): Promise<FoundNotice[]> {
  const url = "https://nginx.org/en/security_advisories.html"
  const html = await fetchHtml(url)
  const $ = cheerio.load(html)
  const notices: FoundNotice[] = []

  $("#content li > p")
    .slice(0, NGINX_RECENT_COUNT)
    .each((_, pEl) => {
    const $p = $(pEl)
    const rawHtml = $p.html() ?? ""
    const lines = rawHtml.split(/<br\s*\/?>/i).map(stripHtmlTags).filter(Boolean)
    if (lines.length === 0) return

    const title = lines[0]
    const severityLine = lines.find((l) => l.startsWith("Severity:"))
    const severityWord = severityLine?.replace("Severity:", "").trim().toLowerCase() ?? ""
    const cveLine = lines.find((l) => /^CVE-\d{4}-\d+$/.test(l))
    const vulnerableLine = lines.find((l) => l.startsWith("Vulnerable:"))
    if (!cveLine) return

    const versionRange = vulnerableLine?.replace("Vulnerable:", "").trim() ?? ""
    notices.push({
      cve: cveLine,
      title: versionRange ? `${title} (Vulnerable: ${versionRange})` : title,
      severity: NGINX_SEVERITY_MAP[severityWord] ?? "Medium",
      product: "Nginx",
      source: "Nginx 공식 보안 권고",
      source_url: url,
      source_type: "vendor",
      notice_type: "CVE",
      mapped_assets: 0,
      collected_at: new Date().toISOString(),
    })
  })

  return notices
}

function cvssToSeverity(score: number): FoundNotice["severity"] {
  if (score >= 9) return "Critical"
  if (score >= 7) return "High"
  if (score >= 4) return "Medium"
  return "Low"
}

// assets 테이블에 실제로 등록된 PostgreSQL major 버전들을 조회한다 — 하드코딩된
// 단일 버전 대신, 보유 중인 자산 버전에 맞춰 추적 대상을 동적으로 정한다.
async function findTrackedPgMajorVersions(
  supabase: ReturnType<typeof supabaseAdmin>,
): Promise<string[]> {
  const { data, error } = await supabase.from("assets").select("version").eq("name", "PostgreSQL")
  if (error) throw error
  const majors = new Set<string>()
  for (const row of data ?? []) {
    const major = normalizeAssetVersion("postgresql", row.version)
    if (major) majors.add(major)
  }
  return Array.from(majors)
}

// postgresql.org/support/versioning/: 버전별 최종 릴리스(EOS) 날짜 테이블에서
// 추적 대상 major 버전 행을 찾아 EOS 공지를 만든다. 자산으로 보유 중인 버전만 추적한다.
async function collectPostgresEos(targetMajors: string[]): Promise<FoundNotice[]> {
  if (targetMajors.length === 0) return []
  const url = "https://www.postgresql.org/support/versioning/"
  const html = await fetchHtml(url)
  const $ = cheerio.load(html)
  const eosDateByMajor = new Map<string, string>()

  $("table.table-striped tr").each((_, trEl) => {
    const cells = $(trEl).find("td")
    if (cells.length < 5) return
    const majorVersion = $(cells[0]).text().trim()
    if (targetMajors.includes(majorVersion)) {
      eosDateByMajor.set(majorVersion, $(cells[4]).text().trim())
    }
  })

  const notices: FoundNotice[] = []
  for (const [majorVersion, eosDateText] of eosDateByMajor) {
    const eosDate = new Date(eosDateText)
    if (isNaN(eosDate.getTime())) continue
    notices.push({
      cve: `PG-EOS-${majorVersion}`,
      title: `PostgreSQL ${majorVersion} 지원 종료 안내 (종료일: ${eosDateText})`,
      severity: "High",
      product: `PostgreSQL ${majorVersion}`,
      source: "PostgreSQL 공식 버전 지원 정책",
      source_url: url,
      source_type: "vendor",
      notice_type: "EOS",
      mapped_assets: 0,
      eos_date: eosDate.toISOString().slice(0, 10),
      collected_at: new Date().toISOString(),
    })
  }
  return notices
}

// postgresql.org/support/security/: CVE/영향버전/수정버전/CVSS/설명 테이블에서
// 추적 대상 major 버전이 영향 버전 목록에 포함된 행만 취약점 공지로 만든다.
async function collectPostgresCve(targetMajors: string[]): Promise<FoundNotice[]> {
  if (targetMajors.length === 0) return []
  const url = "https://www.postgresql.org/support/security/"
  const html = await fetchHtml(url)
  const $ = cheerio.load(html)
  const notices: FoundNotice[] = []

  $("table.table-striped tr").each((_, trEl) => {
    const cells = $(trEl).find("td")
    if (cells.length < 5) return

    const cveText = $(cells[0]).find("a").first().text().trim()
    if (!/^CVE-/.test(cveText)) return

    const affectedVersions = $(cells[1]).text().split(",").map((s) => s.trim())
    const matchedMajor = targetMajors.find((major) => affectedVersions.includes(major))
    if (!matchedMajor) return

    const cvssText = $(cells[3]).find("a").first().text().trim()
    const cvssScore = parseFloat(cvssText)
    const description = $(cells[4]).contents().first().text().trim()

    notices.push({
      cve: cveText,
      title: description || cveText,
      severity: isNaN(cvssScore) ? "Medium" : cvssToSeverity(cvssScore),
      product: `PostgreSQL ${matchedMajor}`,
      source: "PostgreSQL 공식 보안 공지",
      source_url: url,
      source_type: "vendor",
      notice_type: "CVE",
      mapped_assets: 0,
      collected_at: new Date().toISOString(),
    })
  })

  return notices
}

async function collectPostgres(supabase: ReturnType<typeof supabaseAdmin>): Promise<FoundNotice[]> {
  const targetMajors = await findTrackedPgMajorVersions(supabase)
  const [eos, cve] = await Promise.all([
    collectPostgresEos(targetMajors),
    collectPostgresCve(targetMajors),
  ])
  return [...eos, ...cve]
}

const OPENSSL_SEVERITY_MAP: Record<string, FoundNotice["severity"]> = {
  critical: "Critical",
  high: "High",
  moderate: "Medium",
  low: "Low",
}

const OPENSSL_RECENT_COUNT = 15

// openssl-library.org/news/vulnerabilities/: 각 CVE가 <h3 id="CVE-...">와 그 뒤에 오는
// .grid(라벨/값 div가 번갈아 나오는 레이아웃)로 구성된다. 페이지 전체(수년치 이력)를 매번
// 다시 훑지 않도록 최근 OPENSSL_RECENT_COUNT개만 처리한다.
async function collectOpenSSL(): Promise<FoundNotice[]> {
  const url = "https://openssl-library.org/news/vulnerabilities/index.html"
  const html = await fetchHtml(url)
  const $ = cheerio.load(html)
  const notices: FoundNotice[] = []

  $("h3[id^='CVE-']")
    .slice(0, OPENSSL_RECENT_COUNT)
    .each((_, h3El) => {
      const cveId = $(h3El).attr("id") ?? ""
      if (!cveId) return
      const $grid = $(h3El).parent().nextAll(".grid").first()
      if ($grid.length === 0) return

      let severityWord = ""
      let title = ""
      let affected = ""
      $grid.children().each((__, fieldEl) => {
        const labelText = $(fieldEl).find("span.font-semibold").first().text().trim()
        if (labelText === "Severity") severityWord = $(fieldEl).next().text().trim().toLowerCase()
        if (labelText === "Title") title = $(fieldEl).next().text().trim()
        if (labelText === "Affected") {
          const ranges: string[] = []
          $(fieldEl).next().find("li").each((___, liEl) => {
            const range = $(liEl).text().trim()
            if (range) ranges.push(range)
          })
          affected = ranges.join("; ")
        }
      })

      const baseTitle = title || cveId
      notices.push({
        cve: cveId,
        title: affected ? `${baseTitle} (Affected: ${affected})` : baseTitle,
        severity: OPENSSL_SEVERITY_MAP[severityWord] ?? "Medium",
        product: "OpenSSL",
        source: "OpenSSL 공식 취약점 공지",
        source_url: `${url}#${cveId}`,
        source_type: "vendor",
        notice_type: "CVE",
        mapped_assets: 0,
        collected_at: new Date().toISOString(),
      })
    })

  return notices
}

type RedHatCveEntry = {
  CVE: string
  severity: string
  public_date: string
  bugzilla_description: string
}

const REDHAT_SEVERITY_MAP: Record<string, FoundNotice["severity"]> = {
  critical: "Critical",
  important: "High",
  moderate: "Medium",
  low: "Low",
}

// access.redhat.com/security/security-updates 는 React SPA라 HTML 스크래핑으로는 CVE
// 데이터를 얻을 수 없다(확인됨). 대신 공식 Security Data REST API를 직접 호출한다.
async function collectRedHat(): Promise<FoundNotice[]> {
  const after = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const url = `https://access.redhat.com/hydra/rest/securitydata/cve.json?product=Red%20Hat%20Enterprise%20Linux&after=${after}`
  const res = await fetch(url, { headers: { "User-Agent": UA }, cache: "no-store" })
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`)
  const entries = (await res.json()) as RedHatCveEntry[]

  return entries.slice(0, 30).map((entry) => {
    const severityWord = entry.severity?.toLowerCase() ?? ""
    const collectedAt = entry.public_date ? new Date(entry.public_date) : new Date()
    return {
      cve: entry.CVE,
      title: entry.bugzilla_description || entry.CVE,
      severity: REDHAT_SEVERITY_MAP[severityWord] ?? "Medium",
      product: "Red Hat Enterprise Linux",
      source: "Red Hat Security Data API",
      source_url: `https://access.redhat.com/security/cve/${entry.CVE}`,
      source_type: "vendor",
      notice_type: "CVE",
      mapped_assets: 0,
      collected_at: isNaN(collectedAt.getTime()) ? new Date().toISOString() : collectedAt.toISOString(),
    }
  })
}

// oracle.com/security-alerts/ 의 HTML은 분기별 CPU 날짜만 나열되어 있어 구조화된 추출이
// 어렵다(확인됨). 대신 공식 RSS를 사용한다. 분기별 배포 단위 공지이므로 CVE 단위가 아니라
// notice_type: "Patch"로 분류한다.
async function collectOracle(): Promise<FoundNotice[]> {
  const url = "https://www.oracle.com/ocom/groups/public/@otn/documents/webcontent/rss-otn-sec.xml"
  const xml = await fetchHtml(url)
  const $ = cheerio.load(xml, { xmlMode: true })
  const notices: FoundNotice[] = []

  $("item")
    .slice(0, 10)
    .each((_, itemEl) => {
      const title = $(itemEl).find("title").text().trim()
      const link = $(itemEl).find("link").text().trim()
      const pubDateText = $(itemEl).find("pubDate").text().trim()
      if (!title) return

      let collectedAt = pubDateText ? new Date(pubDateText) : new Date()
      if (isNaN(collectedAt.getTime())) collectedAt = new Date()

      // 링크의 페이지 슬러그로 고유 키를 만든다(예: cspujun2026, alert-cve-2026-35273).
      // 이 피드는 분기별 CPU 번들과 개별 CVE 알림이 섞여 있어, 같은 달에 둘 다 나오면
      // 연-월만으로 키를 만들 경우 충돌해 한쪽이 배치 내 중복 제거로 유실된다.
      const slugMatch = link.match(/\/([a-z0-9-]+)\.html/i)
      const key = slugMatch
        ? `ORACLE-${slugMatch[1].toUpperCase()}`
        : `ORACLE-CPU-${collectedAt.getFullYear()}-${String(collectedAt.getMonth() + 1).padStart(2, "0")}`

      notices.push({
        cve: key,
        title,
        severity: "High",
        product: "Oracle Database",
        source: "Oracle 보안 경고(Security Alerts)",
        source_url: link || url,
        source_type: "vendor",
        notice_type: "Patch",
        mapped_assets: 0,
        collected_at: collectedAt.toISOString(),
      })
    })

  return notices
}

const SW_MASTER_PRODUCTS = [
  "Apache Tomcat", "Oracle Database",
  "OpenSSL", "Nginx", "Red Hat Enterprise Linux", "PostgreSQL",
] as const

// KNVD는 전 분야 보안공지를 다루므로, 제목/본문에 SW마스터 6개 제품 중 하나가 언급된
// 공지만 추적 대상으로 인정한다 — 그렇지 않으면 KISA 공지 화면이 무관한 공지로 가득 찬다.
function detectTrackedProduct(text: string): string | null {
  for (const name of SW_MASTER_PRODUCTS) {
    if (text.includes(name)) return name
  }
  if (text.includes("Tomcat")) return "Apache Tomcat"
  // RHEL은 Linux 배포판이므로 커널 취약점 공지("Linux Kernel", "Linux 제품 보안...")도
  // RHEL 자산에 실질적으로 영향을 준다 — KNVD 공지 대부분이 "RHEL"이 아니라 "Linux"로만
  // 표기되어 있어 이 매칭이 없으면 관련 공지가 전부 걸러졌었다.
  if (text.includes("RHEL") || text.includes("Linux")) return "Red Hat Enterprise Linux"
  return null
}

// knvd.krcert.or.kr 공식 RSS — KISA 실시간 보안공지. 이 코드베이스의 첫 실제 KISA
// 수집기다(그전까지는 수동 등록 시 출처 유형을 KISA로 선택하는 경로뿐이었음).
async function collectKnvd(): Promise<FoundNotice[]> {
  const url = "https://knvd.krcert.or.kr/rss/security/notice"
  const xml = await fetchHtml(url)
  const $ = cheerio.load(xml, { xmlMode: true })
  const notices: FoundNotice[] = []

  $("item")
    .slice(0, 30)
    .each((i, itemEl) => {
      const title = $(itemEl).find("title").text().trim()
      const link = $(itemEl).find("link").text().trim()
      const description = $(itemEl).find("description").text()
      const pubDateText = $(itemEl).find("pubDate").text().trim()
      if (!title) return

      const combined = `${title} ${description}`
      const product = detectTrackedProduct(combined)
      if (!product) return

      const noticeType = classifyNoticeType(title)
      if (!noticeType) return

      const cveMatch = combined.match(/CVE-\d{4}-\d{4,7}/)
      const linkIdMatch = link.match(/id=([a-f0-9]+)/i)
      const key = cveMatch?.[0] ?? (linkIdMatch ? `KISA-${linkIdMatch[1]}` : `KISA-${i}-${title.slice(0, 20)}`)

      let collectedAt = pubDateText ? new Date(pubDateText) : new Date()
      if (isNaN(collectedAt.getTime())) collectedAt = new Date()

      notices.push({
        cve: key,
        title,
        severity: "Medium",
        product,
        source: "KISA 보안취약점 정보포털(KNVD)",
        source_url: link || url,
        source_type: "kisa",
        notice_type: noticeType,
        mapped_assets: 0,
        collected_at: collectedAt.toISOString(),
      })
    })

  return notices
}

function fetchForProduct(
  product: CollectProduct,
  supabase: ReturnType<typeof supabaseAdmin>,
): Promise<FoundNotice[]> {
  switch (product) {
    case "Apache Tomcat": return collectApacheTomcat()
    case "Nginx": return collectNginx()
    case "PostgreSQL": return collectPostgres(supabase)
    case "OpenSSL": return collectOpenSSL()
    case "Red Hat Enterprise Linux": return collectRedHat()
    case "Oracle Database": return collectOracle()
    case "KISA": return collectKnvd()
  }
}

async function collectOne(product: CollectProduct): Promise<CollectResult> {
  try {
    const supabase = supabaseAdmin()
    const rawFound = await fetchForProduct(product, supabase)

    // 동일 CVE가 여러 버전 섹션에 걸쳐 반복 언급될 수 있으므로 배치 내에서도 cve 기준 중복 제거.
    const found = Array.from(new Map(rawFound.map((n) => [n.cve, n])).values())

    if (found.length === 0) {
      return { product, ok: true, newCount: 0 }
    }

    const { data: existing, error: selErr } = await supabase
      .from("vulnerabilities")
      .select("cve")
      .in("cve", found.map((n) => n.cve))
    if (selErr) throw selErr

    const existingCves = new Set((existing ?? []).map((r) => r.cve))
    const toInsert = found.filter((n) => !existingCves.has(n.cve))

    if (toInsert.length === 0) {
      return { product, ok: true, newCount: 0 }
    }

    const rows = toInsert.map((notice) => ({
      ...notice,
      approval: "승인대기" as const,
      mapped_assets: 0,
    }))

    const { error: insErr } = await supabase.from("vulnerabilities").insert(rows)
    if (insErr) throw insErr

    return { product, ok: true, newCount: toInsert.length }
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : String(err)
    console.error(`collect-source failed for ${product}:`, err)
    return { product, ok: false, newCount: 0, error: message }
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const products: CollectProduct[] = Array.isArray(body?.products) ? body.products : []

  const validProducts = products.filter(
    (p): p is CollectProduct => COLLECT_PRODUCTS.includes(p as CollectProduct),
  )

  if (validProducts.length === 0) {
    return NextResponse.json(
      { error: `products must include at least one of ${COLLECT_PRODUCTS.join(", ")}` },
      { status: 400 },
    )
  }

  const results = await Promise.all(validProducts.map((p) => collectOne(p)))
  return NextResponse.json({ results })
}
