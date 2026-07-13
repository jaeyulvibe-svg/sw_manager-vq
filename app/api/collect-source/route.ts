import { NextResponse } from "next/server"
import * as cheerio from "cheerio"
import { createClient } from "@supabase/supabase-js"
import type { Database, TablesInsert } from "@/lib/supabase/types"
import { classifyNoticeType } from "@/lib/notice-classify"

export type CollectProduct = "Apache Tomcat" | "JEUS" | "WebtoB"

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

// nginx.org/en/security_advisories.html: 각 공지가
// <li><p>제목<br>Severity: <b>등급</b><br><a>Advisory</a><br><a href="...cve.org...">CVE-ID</a><br>
// Not vulnerable: ...<br>Vulnerable: 버전범위</p></li> 형태로 나열된다.
// <br> 태그로 줄이 나뉘므로 raw HTML을 <br> 기준으로 쪼갠 뒤 각 줄의 태그를 벗겨 파싱한다.
async function collectNginx(): Promise<FoundNotice[]> {
  const url = "https://nginx.org/en/security_advisories.html"
  const html = await fetchHtml(url)
  const $ = cheerio.load(html)
  const notices: FoundNotice[] = []

  $("#content li > p").each((_, pEl) => {
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

// www.tmaxsoft.com/kr/developer/notice/list: 공식 기술공지 게시판.
// <tr onclick="fnView('./view','SEQ')"> 행마다 제목/등록일이 들어있다.
async function collectTmaxSoft(product: "JEUS" | "WebtoB"): Promise<FoundNotice[]> {
  const listUrl = "https://www.tmaxsoft.com/kr/developer/notice/list"
  const html = await fetchHtml(listUrl)
  const $ = cheerio.load(html)
  const notices: FoundNotice[] = []

  const rows: { seq: string; title: string; date: string }[] = []
  $("tr[onclick]").each((_, trEl) => {
    const onclick = $(trEl).attr("onclick") ?? ""
    const seqMatch = onclick.match(/fnView\('\.\/view',\s*'(\d+)'\)/)
    if (!seqMatch) return
    const title = $(trEl).find(".text-clamp-1").first().text().trim()
    const date = $(trEl).find("td").eq(1).text().trim()
    if (title) rows.push({ seq: seqMatch[1], title, date })
  })

  const relevant = rows.filter((r) => r.title.includes(product))

  for (const row of relevant) {
    const noticeType = classifyNoticeType(row.title)
    if (!noticeType) continue // 호환성 테스트 결과 등 관련 없는 공지는 제외

    const cveMatch = row.title.match(/CVE-\d{4}-\d+/)
    const key = cveMatch ? cveMatch[0] : `TMAX-${row.seq}`

    const [y, m, d] = row.date.split(".").map((n) => parseInt(n, 10))
    const collectedAt = y && m && d ? new Date(Date.UTC(y, m - 1, d)).toISOString() : new Date().toISOString()

    notices.push({
      cve: key,
      title: row.title,
      severity: noticeType === "EOS" ? "High" : "High",
      product,
      source: "TmaxSoft 공식 기술공지",
      source_url: `https://www.tmaxsoft.com/kr/developer/notice/view?seq=${row.seq}&boardCd=notice`,
      source_type: "vendor",
      notice_type: noticeType,
      mapped_assets: 0,
      collected_at: collectedAt,
    })
  }

  return notices
}

async function collectOne(product: CollectProduct): Promise<CollectResult> {
  const supabase = supabaseAdmin()
  try {
    const rawFound =
      product === "Apache Tomcat"
        ? await collectApacheTomcat()
        : await collectTmaxSoft(product)

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

    const { error: insErr } = await supabase.from("vulnerabilities").insert(toInsert)
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
    (p): p is CollectProduct => p === "Apache Tomcat" || p === "JEUS" || p === "WebtoB",
  )

  if (validProducts.length === 0) {
    return NextResponse.json({ error: "products must include at least one of Apache Tomcat, JEUS, WebtoB" }, { status: 400 })
  }

  const results = await Promise.all(validProducts.map(collectOne))
  return NextResponse.json({ results })
}
