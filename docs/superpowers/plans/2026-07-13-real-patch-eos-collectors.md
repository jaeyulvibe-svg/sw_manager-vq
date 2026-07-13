# 실제 패치·EOS 수집기 확장 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `app/api/collect-source/route.ts` with 6 new real collectors (Nginx, PostgreSQL, OpenSSL, Red Hat Enterprise Linux, Oracle Database, KNVD/KISA) so "즉시 수집" pulls real patch/CVE/EOS data for all 8 SW-master products plus a real KISA source, without adding any new tables, columns, screens, or matching logic.

**Architecture:** Each new collector is a standalone async function returning `FoundNotice[]` (`= TablesInsert<"vulnerabilities">[]`), following the exact structure of the existing `collectApacheTomcat`/`collectTmaxSoft` functions — fetch HTML/XML/JSON, parse with `cheerio`, map into rows using only existing `vulnerabilities` columns. A shared `classifyNoticeType()` helper (extracted from `collectTmaxSoft`'s inline keyword logic) is reused by both `collectTmaxSoft` and the new `collectKnvd`. All 6 new functions are written standalone first (unreferenced), then wired into `collectOne`'s dispatch and the `POST` handler's validation in one final route.ts task — this keeps every earlier task's diff isolated to one new function with no risk of a half-wired switch statement.

**Tech Stack:** Next.js Route Handler (`app/api/collect-source/route.ts`), `cheerio` (already a dependency, also handles XML/RSS via `{ xmlMode: true }`), native `fetch`, Supabase service-role client (already set up via `supabaseAdmin()`).

## Global Constraints

- No test suite is configured in this repo — verification is `pnpm build` / `pnpm exec tsc --noEmit` / `pnpm lint`, all three required (this repo's `next.config.mjs` sets `typescript.ignoreBuildErrors: true`, so `next build` alone does NOT type-check — a prior unrelated task already had a real type error that only `tsc`/`eslint` caught). This repo is currently 100% lint-clean; treat any new warning as something to fix.
- `pnpm` is not on PATH in the sandboxed dev environment used for prior work on this repo — use `corepack pnpm <cmd>` instead (this project pins `pnpm@10.34.4` via `packageManager` in `package.json`).
- **No new database columns, tables, or migrations.** Every new collector must map onto the existing `vulnerabilities` columns: `cve, title, severity, product, source, source_url, source_type, notice_type, mapped_assets, collected_at`.
- **No changes to** `lib/vuln-match.ts`, `components/pages/notice-board/*`, `kisa-view.tsx`, `vendor-view.tsx`, `eos-notice-view.tsx`, `patch-view.tsx`, `components/portal/nav.ts`, `app/page.tsx`, or `assets`/`sw_masters` seed data. New collector output flows into the existing 4 review screens purely through `source_type`/`notice_type` values already understood by those screens.
- `product` field on every inserted row must contain, as a substring, the exact name used by the corresponding asset (`lib/vuln-match.ts`'s `isProductMatch` does `product.toLowerCase().includes(asset.name.toLowerCase())`) — e.g. `"Nginx"`, `"OpenSSL"`, `"PostgreSQL 14"`, `"Red Hat Enterprise Linux"`, `"Oracle Database"`.
- Version-range / CVSS-range auto-matching is explicitly out of scope. Where a source gives a vulnerable-version range (Nginx, OpenSSL), fold that into the `title` string so a human reviewer sees it — do not attempt automated range comparison.
- All external `fetch()` calls happen server-side in `app/api/collect-source/route.ts` only (already the existing pattern — never call these URLs from client components).
- Every new collector must fail in isolation: if one source's fetch/parse throws, `collectOne`'s existing try/catch must still report that one product as `ok: false` without preventing the other products' collection in the same batch (already how `collectOne` works — new collectors must not swallow this behavior by, e.g., catching their own errors and returning `[]` instead of throwing, since a silent empty result would be indistinguishable from "no new items" in the collection log).

---

### Task 1: `lib/notice-classify.ts` — shared notice_type classifier

**Files:**
- Create: `lib/notice-classify.ts`
- Modify: `app/api/collect-source/route.ts` (refactor `collectTmaxSoft` to use the new shared function)

**Interfaces:**
- Produces: `classifyNoticeType(title: string): TablesInsert<"vulnerabilities">["notice_type"] | null`. Consumed by `collectTmaxSoft` (this task) and `collectKnvd` (Task 7).

- [ ] **Step 1: Write the shared classifier**

```ts
// lib/notice-classify.ts
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
```

- [ ] **Step 2: Refactor `collectTmaxSoft` to use it**

In `app/api/collect-source/route.ts`, add the import at the top (alongside the existing imports):

```ts
import { classifyNoticeType } from "@/lib/notice-classify"
```

Then replace this block inside `collectTmaxSoft`:

```ts
  for (const row of relevant) {
    let noticeType: FoundNotice["notice_type"] | null = null
    if (row.title.includes("EOL") || row.title.includes("EOS") || row.title.includes("단종")) {
      noticeType = "EOS"
    } else if (row.title.includes("취약점") || row.title.includes("보안")) {
      noticeType = "CVE"
    } else if (row.title.includes("패치")) {
      noticeType = "Patch"
    } else {
      continue // 호환성 테스트 결과 등 관련 없는 공지는 제외
    }
```

with:

```ts
  for (const row of relevant) {
    const noticeType = classifyNoticeType(row.title)
    if (!noticeType) continue // 호환성 테스트 결과 등 관련 없는 공지는 제외
```

Everything else in `collectTmaxSoft` (the `cveMatch`/`key`/`collectedAt`/`notices.push` block below this loop) stays exactly as-is — only the classification block changes.

- [ ] **Step 3: Verify**

Run from the repo root (`D:\nh_workspace\sw_manager-vq`):
```bash
corepack pnpm build
corepack pnpm exec tsc --noEmit -p tsconfig.json
corepack pnpm lint
```
Expected: all three clean (build succeeds; tsc produces no output; lint produces no output).

- [ ] **Step 4: Commit**

```bash
git add lib/notice-classify.ts app/api/collect-source/route.ts
git commit -m "refactor: extract classifyNoticeType shared helper from collectTmaxSoft"
```

---

### Task 2: `collectNginx()` — Nginx security advisories

**Files:**
- Modify: `app/api/collect-source/route.ts` (add one new standalone function; not yet wired into `collectOne`)

**Interfaces:**
- Produces: `collectNginx(): Promise<FoundNotice[]>`. Not consumed by anything until Task 8 wires it into `collectOne`'s dispatch — this task's diff is purely additive and the new function is unused, which is expected (matches how `vendor-view.tsx`/`eos-notice-view.tsx` sat unwired for a task or two in the prior notice-split plan).

Source page verified live: `https://nginx.org/en/security_advisories.html` returns entries shaped like:
```html
<li><p>Use-after-free in HTTP/3<br>Severity: <b>major</b><br><a href="...">Advisory</a><br><a href="https://www.cve.org/CVERecord?id=CVE-2026-42530">CVE-2026-42530</a><br>Not vulnerable: 1.31.2+<br>Vulnerable: 1.31.0-1.31.1</p></li>
```
No per-entry date is present on this page, so `collected_at` uses the collection timestamp.

- [ ] **Step 1: Add the function**

Add this function to `app/api/collect-source/route.ts`, right after `collectApacheTomcat` and before `collectTmaxSoft`:

```ts
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
```

- [ ] **Step 2: Verify**

```bash
corepack pnpm build
corepack pnpm exec tsc --noEmit -p tsconfig.json
corepack pnpm lint
```
Expected: all three clean. `collectNginx` will be reported as unused by neither `tsc` nor `eslint` (module-level function declarations aren't flagged as unused by this repo's lint config — only unused local variables/imports are), but confirm this is actually the case in the output rather than assuming it.

- [ ] **Step 3: Commit**

```bash
git add app/api/collect-source/route.ts
git commit -m "feat: add collectNginx() real-collector function (not yet wired)"
```

---

### Task 3: `collectPostgres()` — PostgreSQL EOS + CVE

**Files:**
- Modify: `app/api/collect-source/route.ts` (add standalone functions)

**Interfaces:**
- Produces: `collectPostgres(): Promise<FoundNotice[]>` (combines two sub-fetches). Not consumed until Task 8.

Two pages verified live:
- `https://www.postgresql.org/support/versioning/` — `<table class="table table-striped">` with rows `<td>{major}</td><td>{minor}</td><td>{supported}</td><td>{first release}</td><td>{final release}</td>`. Confirmed row `14` → final release `November 12, 2026` (this is PostgreSQL 14's real EOS date).
- `https://www.postgresql.org/support/security/` — `<table class="table table-striped">` with rows `<td>{CVE link}<br>{announcement link}</td><td>{affected major versions, comma-separated}</td><td>{fixed versions}</td><td>{component}<br>{CVSS score link}<br>{CVSS vector}</td><td>{description}<br><br>{more details link}</td>`.

- [ ] **Step 1: Add the functions**

Add these three functions to `app/api/collect-source/route.ts`, right after `collectNginx`:

```ts
const PG_TARGET_MAJOR_VERSION = "14"

function cvssToSeverity(score: number): FoundNotice["severity"] {
  if (score >= 9) return "Critical"
  if (score >= 7) return "High"
  if (score >= 4) return "Medium"
  return "Low"
}

// postgresql.org/support/versioning/: 버전별 최종 릴리스(EOS) 날짜 테이블에서
// PG_TARGET_MAJOR_VERSION 행을 찾아 EOS 공지 1건을 만든다. 자산으로 보유 중인 버전만
// 추적하므로 다른 major 버전 행은 무시한다.
async function collectPostgresEos(): Promise<FoundNotice[]> {
  const url = "https://www.postgresql.org/support/versioning/"
  const html = await fetchHtml(url)
  const $ = cheerio.load(html)
  let eosDateText: string | null = null

  $("table.table-striped tr").each((_, trEl) => {
    const cells = $(trEl).find("td")
    if (cells.length < 5) return
    const majorVersion = $(cells[0]).text().trim()
    if (majorVersion === PG_TARGET_MAJOR_VERSION) {
      eosDateText = $(cells[4]).text().trim()
    }
  })

  if (!eosDateText) return []
  const eosDate = new Date(eosDateText)
  if (isNaN(eosDate.getTime())) return []

  return [{
    cve: `PG-EOS-${PG_TARGET_MAJOR_VERSION}`,
    title: `PostgreSQL ${PG_TARGET_MAJOR_VERSION} 지원 종료 안내 (종료일: ${eosDateText})`,
    severity: "High",
    product: `PostgreSQL ${PG_TARGET_MAJOR_VERSION}`,
    source: "PostgreSQL 공식 버전 지원 정책",
    source_url: url,
    source_type: "vendor",
    notice_type: "EOS",
    mapped_assets: 0,
    collected_at: eosDate.toISOString(),
  }]
}

// postgresql.org/support/security/: CVE/영향버전/수정버전/CVSS/설명 테이블에서
// PG_TARGET_MAJOR_VERSION이 영향 major 버전 목록에 포함된 행만 취약점 공지로 만든다.
async function collectPostgresCve(): Promise<FoundNotice[]> {
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
    if (!affectedVersions.includes(PG_TARGET_MAJOR_VERSION)) return

    const cvssText = $(cells[3]).find("a").first().text().trim()
    const cvssScore = parseFloat(cvssText)
    const description = $(cells[4]).contents().first().text().trim()

    notices.push({
      cve: cveText,
      title: description || cveText,
      severity: isNaN(cvssScore) ? "Medium" : cvssToSeverity(cvssScore),
      product: `PostgreSQL ${PG_TARGET_MAJOR_VERSION}`,
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

async function collectPostgres(): Promise<FoundNotice[]> {
  const [eos, cve] = await Promise.all([collectPostgresEos(), collectPostgresCve()])
  return [...eos, ...cve]
}
```

- [ ] **Step 2: Verify**

```bash
corepack pnpm build
corepack pnpm exec tsc --noEmit -p tsconfig.json
corepack pnpm lint
```
Expected: all three clean.

- [ ] **Step 3: Commit**

```bash
git add app/api/collect-source/route.ts
git commit -m "feat: add collectPostgres() real-collector function (EOS + CVE, not yet wired)"
```

---

### Task 4: `collectOpenSSL()` — OpenSSL vulnerabilities

**Files:**
- Modify: `app/api/collect-source/route.ts` (add standalone function)

**Interfaces:**
- Produces: `collectOpenSSL(): Promise<FoundNotice[]>`. Not consumed until Task 8.

Source page verified live: `https://openssl-library.org/news/vulnerabilities/index.html`. Each CVE is `<a href="#CVE-XXXX-XXXXX"><h3 id="CVE-XXXX-XXXXX">CVE-XXXX-XXXXX</h3></a>` immediately followed by a sibling `<div class="grid grid-cols-6 gap-2">` whose children alternate label/value pairs, e.g.:
```html
<div><span class="font-semibold">Severity</span></div>
<div class="col-span-5">Low</div>
<div><span class="font-semibold">Title</span></div>
<div class="col-span-5">Heap Buffer Over-read in ASN.1 Content Parsing</div>
```
The page has years of historical entries (19000+ lines), so only the first N entries (most recent, listed first) are processed per run.

- [ ] **Step 1: Add the function**

Add this to `app/api/collect-source/route.ts`, right after `collectPostgres`:

```ts
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
      $grid.children().each((__, fieldEl) => {
        const labelText = $(fieldEl).find("span.font-semibold").first().text().trim()
        if (labelText === "Severity") severityWord = $(fieldEl).next().text().trim().toLowerCase()
        if (labelText === "Title") title = $(fieldEl).next().text().trim()
      })

      notices.push({
        cve: cveId,
        title: title || cveId,
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
```

- [ ] **Step 2: Verify**

```bash
corepack pnpm build
corepack pnpm exec tsc --noEmit -p tsconfig.json
corepack pnpm lint
```
Expected: all three clean.

- [ ] **Step 3: Commit**

```bash
git add app/api/collect-source/route.ts
git commit -m "feat: add collectOpenSSL() real-collector function (not yet wired)"
```

---

### Task 5: `collectRedHat()` — Red Hat Security Data API

**Files:**
- Modify: `app/api/collect-source/route.ts` (add standalone function)

**Interfaces:**
- Produces: `collectRedHat(): Promise<FoundNotice[]>`. Not consumed until Task 8.

**Important:** `access.redhat.com/security/security-updates` (the HTML page) was verified to be a React SPA — the raw HTML contains no CVE data, only a `<div id="page-wrap">` shell that renders client-side. Scraping it would not work. Instead, Red Hat's official public Security Data REST API was verified live and returns clean JSON:
```
GET https://access.redhat.com/hydra/rest/securitydata/cve.json?product=Red%20Hat%20Enterprise%20Linux&after=YYYY-MM-DD
```
returns an array of objects shaped like:
```json
{"CVE":"CVE-2026-61870","severity":"low","public_date":"2026-07-11T13:01:09Z","bugzilla_description":"ImageMagick: ImageMagick: Denial of Service via specially crafted VIFF images", ...}
```

- [ ] **Step 1: Add the function**

Add this to `app/api/collect-source/route.ts`, right after `collectOpenSSL`:

```ts
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
```

- [ ] **Step 2: Verify**

```bash
corepack pnpm build
corepack pnpm exec tsc --noEmit -p tsconfig.json
corepack pnpm lint
```
Expected: all three clean.

- [ ] **Step 3: Commit**

```bash
git add app/api/collect-source/route.ts
git commit -m "feat: add collectRedHat() real-collector function via official API (not yet wired)"
```

---

### Task 6: `collectOracle()` — Oracle Security Alerts RSS

**Files:**
- Modify: `app/api/collect-source/route.ts` (add standalone function)

**Interfaces:**
- Produces: `collectOracle(): Promise<FoundNotice[]>`. Not consumed until Task 8.

**Important:** `oracle.com/security-alerts/` (the HTML page) only lists quarterly Critical Patch Update *dates* in a table, not per-CVE detail — not useful for structured extraction. Instead, Oracle's official security RSS feed was verified live:
```
https://www.oracle.com/ocom/groups/public/@otn/documents/webcontent/rss-otn-sec.xml
```
returns `<item><title>Critical Security Patch Update Advisory - June 2026</title><link>https://www.oracle.com/security-alerts/cspujun2026.html</link><pubDate>Tue, 16 June 2026  12:30:54</pubDate></item>` — one entry per quarterly patch bundle (not per-CVE), so this maps to `notice_type: "Patch"`, not `"CVE"`.

- [ ] **Step 1: Add the function**

Add this to `app/api/collect-source/route.ts`, right after `collectRedHat`:

```ts
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

      const key = `ORACLE-CPU-${collectedAt.getFullYear()}-${String(collectedAt.getMonth() + 1).padStart(2, "0")}`

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
```

- [ ] **Step 2: Verify**

```bash
corepack pnpm build
corepack pnpm exec tsc --noEmit -p tsconfig.json
corepack pnpm lint
```
Expected: all three clean.

- [ ] **Step 3: Commit**

```bash
git add app/api/collect-source/route.ts
git commit -m "feat: add collectOracle() real-collector function via official RSS (not yet wired)"
```

---

### Task 7: `collectKnvd()` — KISA(KNVD) real-time notices

**Files:**
- Modify: `app/api/collect-source/route.ts` (add standalone function; imports `classifyNoticeType` from Task 1)

**Interfaces:**
- Consumes: `classifyNoticeType` from `@/lib/notice-classify` (Task 1).
- Produces: `collectKnvd(): Promise<FoundNotice[]>`. Not consumed until Task 8.

This is the first real KISA collector in the codebase — `source_type: "kisa"` on every row it produces. Source verified live: `https://knvd.krcert.or.kr/rss/security/notice` returns a well-formed RSS 2.0 feed (`<item><title>/<link>/<description>/<pubDate>`) covering ALL software, not just the 8 tracked SW-master products — so items must be filtered to only those mentioning a tracked product, or the KISA screen would fill with irrelevant noise.

- [ ] **Step 1: Add the function**

Add this to `app/api/collect-source/route.ts`, right after `collectOracle`. Also add the import for `classifyNoticeType` at the top of the file — reuse the same import line added in Task 1 (`import { classifyNoticeType } from "@/lib/notice-classify"`) if it's already there; do not add a duplicate import line.

```ts
const SW_MASTER_PRODUCTS = [
  "Apache Tomcat", "JEUS", "WebtoB", "Oracle Database",
  "OpenSSL", "Nginx", "Red Hat Enterprise Linux", "PostgreSQL",
] as const

// KNVD는 전 분야 보안공지를 다루므로, 제목/본문에 SW마스터 8개 제품 중 하나가 언급된
// 공지만 추적 대상으로 인정한다 — 그렇지 않으면 KISA 공지 화면이 무관한 공지로 가득 찬다.
function detectTrackedProduct(text: string): string | null {
  for (const name of SW_MASTER_PRODUCTS) {
    if (text.includes(name)) return name
  }
  if (text.includes("Tomcat")) return "Apache Tomcat"
  if (text.includes("RHEL")) return "Red Hat Enterprise Linux"
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
```

Note on `key` stability: `KISA-${linkIdMatch[1]}` (derived from the detail page URL's `id=` query parameter, e.g. `KISA-6a50a1091c2df86884b863c9`) must stay identical across repeated collection runs for the same RSS item, so `collectOne`'s existing-CVE dedup check correctly skips re-inserting it. Do NOT use `Date.now()` or any other non-deterministic value in the fallback key — that would insert a duplicate row every time "즉시 수집" is clicked for the same notice.

- [ ] **Step 2: Verify**

```bash
corepack pnpm build
corepack pnpm exec tsc --noEmit -p tsconfig.json
corepack pnpm lint
```
Expected: all three clean.

- [ ] **Step 3: Commit**

```bash
git add app/api/collect-source/route.ts
git commit -m "feat: add collectKnvd() real KISA collector function (not yet wired)"
```

---

### Task 8: Wire everything — `CollectProduct` type, `collectOne` dispatch, `POST` validation

**Files:**
- Modify: `app/api/collect-source/route.ts`

**Interfaces:**
- Consumes: all 6 new collector functions from Tasks 2-7, plus the existing `collectApacheTomcat`/`collectTmaxSoft`.
- Produces: `CollectProduct` now includes all 9 values; `collectOne` routes to the correct collector for any of them. Consumed by Task 9 (`admin-view.tsx`'s `REAL_COLLECT_PRODUCTS`).

This is the only task that changes `CollectProduct`, `collectOne`, and the `POST` handler — every earlier task only added a new standalone function.

- [ ] **Step 1: Extend `CollectProduct`**

Change:

```ts
export type CollectProduct = "Apache Tomcat" | "JEUS" | "WebtoB"
```

to:

```ts
export type CollectProduct =
  | "Apache Tomcat"
  | "JEUS"
  | "WebtoB"
  | "Nginx"
  | "PostgreSQL"
  | "OpenSSL"
  | "Red Hat Enterprise Linux"
  | "Oracle Database"
  | "KISA"

const COLLECT_PRODUCTS: CollectProduct[] = [
  "Apache Tomcat", "JEUS", "WebtoB",
  "Nginx", "PostgreSQL", "OpenSSL", "Red Hat Enterprise Linux", "Oracle Database",
  "KISA",
]
```

- [ ] **Step 2: Add the dispatch function**

Add this right before `collectOne`:

```ts
function fetchForProduct(product: CollectProduct): Promise<FoundNotice[]> {
  switch (product) {
    case "Apache Tomcat": return collectApacheTomcat()
    case "JEUS": return collectTmaxSoft("JEUS")
    case "WebtoB": return collectTmaxSoft("WebtoB")
    case "Nginx": return collectNginx()
    case "PostgreSQL": return collectPostgres()
    case "OpenSSL": return collectOpenSSL()
    case "Red Hat Enterprise Linux": return collectRedHat()
    case "Oracle Database": return collectOracle()
    case "KISA": return collectKnvd()
  }
}
```

- [ ] **Step 3: Update `collectOne` to use it**

Change:

```ts
    const rawFound =
      product === "Apache Tomcat"
        ? await collectApacheTomcat()
        : await collectTmaxSoft(product)
```

to:

```ts
    const rawFound = await fetchForProduct(product)
```

Nothing else in `collectOne` changes — the dedup/insert/error-handling logic below this line stays exactly as-is.

- [ ] **Step 4: Update `POST` validation**

Change:

```ts
  const validProducts = products.filter(
    (p): p is CollectProduct => p === "Apache Tomcat" || p === "JEUS" || p === "WebtoB",
  )

  if (validProducts.length === 0) {
    return NextResponse.json({ error: "products must include at least one of Apache Tomcat, JEUS, WebtoB" }, { status: 400 })
  }
```

to:

```ts
  const validProducts = products.filter(
    (p): p is CollectProduct => COLLECT_PRODUCTS.includes(p as CollectProduct),
  )

  if (validProducts.length === 0) {
    return NextResponse.json(
      { error: `products must include at least one of ${COLLECT_PRODUCTS.join(", ")}` },
      { status: 400 },
    )
  }
```

- [ ] **Step 5: Verify**

```bash
corepack pnpm build
corepack pnpm exec tsc --noEmit -p tsconfig.json
corepack pnpm lint
```
Expected: all three clean. This is the point where TypeScript will actually catch it if the `switch` in `fetchForProduct` is missing a case for any `CollectProduct` value (the switch has no `default`, so a missing case makes the function's return type `Promise<FoundNotice[]> | undefined` and `collectOne`'s `await fetchForProduct(product)` usage would produce a type error) — treat any such error as a sign a Task 2-7 function name doesn't match what's referenced here, not something to paper over with `as` or a `default: return []`.

- [ ] **Step 6: Commit**

```bash
git add app/api/collect-source/route.ts
git commit -m "feat: wire all 9 collectors into CollectProduct/collectOne/POST validation"
```

---

### Task 9: `admin-view.tsx` — extend `REAL_COLLECT_PRODUCTS`

**Files:**
- Modify: `components/pages/admin-view.tsx`

**Interfaces:**
- Consumes: `CollectProduct` values from Task 8 (implicitly, via the string literals matching).

The "즉시 수집" button already sends the entire `REAL_COLLECT_PRODUCTS` array to `/api/collect-source` with no per-product selection UI (confirmed: `runCollection` at `admin-view.tsx:791-837` always POSTs `{ products: REAL_COLLECT_PRODUCTS }`) — so this task is a pure constant extension, no new UI elements.

- [ ] **Step 1: Extend the constant**

Change (around `admin-view.tsx:588`):

```ts
const REAL_COLLECT_PRODUCTS = ["Apache Tomcat", "JEUS", "WebtoB"] as const
```

to:

```ts
const REAL_COLLECT_PRODUCTS = [
  "Apache Tomcat", "JEUS", "WebtoB",
  "Nginx", "PostgreSQL", "OpenSSL", "Red Hat Enterprise Linux", "Oracle Database",
  "KISA",
] as const
```

- [ ] **Step 2: Note on Source URL 관리 table (no code change, just confirm)**

`runCollection`'s `setSources` update (`admin-view.tsx:804-810`) matches results back to the mock "Source URL 관리" table rows by `r.product === s.name`. That table only has the 8 SW-master product rows (`SOURCE_PRODUCT_NAMES`), not a "KISA" row — so the KISA collection result will appear in the "수집 기동 내역" log (`collectLog`, rendered elsewhere) but will NOT update any row in the Source URL 관리 table, since no row there is named "KISA". This is expected and matches the plan's scope (no new Source URL row for KISA) — confirm this by reading, don't add a KISA row to `SOURCE_PRODUCT_NAMES`/`SOURCE_SEED_META`.

- [ ] **Step 3: Verify**

```bash
corepack pnpm build
corepack pnpm exec tsc --noEmit -p tsconfig.json
corepack pnpm lint
```
Expected: all three clean.

- [ ] **Step 4: Commit**

```bash
git add components/pages/admin-view.tsx
git commit -m "feat: extend REAL_COLLECT_PRODUCTS to all 9 collectors"
```

---

### Task 10: Final end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Full build/tsc/lint**

```bash
corepack pnpm build
corepack pnpm exec tsc --noEmit -p tsconfig.json
corepack pnpm lint
```
Expected: all three clean, zero errors/warnings.

- [ ] **Step 2: Live manual walkthrough**

This requires the real Supabase project (the `.env.local` with `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` — `collectOne` uses the service-role client via `supabaseAdmin()`) and live network access to the 6 external sites, since these collectors cannot be verified any other way. Run `corepack pnpm dev`, log in, go to 관리자 페이지 > 수집 관리, click "즉시 수집", and for each of the 9 products check the resulting `collectLog` entry:

1. Confirm all 9 report `ok: true` (or, if a specific external site is temporarily unreachable/rate-limited, confirm that ONE product reports `ok: false` with a captured error message while the other 8 still succeed — this proves the per-product try/catch isolation works, not just that everything is reachable right now).
2. Query `vulnerabilities` for rows with `source = 'Nginx 공식 보안 권고'` and confirm `product`, `severity`, `notice_type: 'CVE'` look sane and the title includes a `(Vulnerable: ...)` suffix where a version range was found.
3. Query for `source = 'PostgreSQL 공식 버전 지원 정책'` and confirm exactly one row exists with `cve = 'PG-EOS-14'`, `notice_type = 'EOS'`.
4. Query for `source = 'PostgreSQL 공식 보안 공지'` and confirm rows only include CVEs that actually affect PostgreSQL 14 (spot-check one against the live page).
5. Query for `source = 'OpenSSL 공식 취약점 공지'` and confirm at most `OPENSSL_RECENT_COUNT` (15) new rows landed, not the page's full multi-year history.
6. Query for `source = 'Red Hat Security Data API'` and confirm `product = 'Red Hat Enterprise Linux'` on every row.
7. Query for `source = 'Oracle 보안 경고(Security Alerts)'` and confirm `notice_type = 'Patch'` (not `'CVE'`) on every row, with `cve` values shaped like `ORACLE-CPU-2026-06`.
8. Query for `source_type = 'kisa'` and confirm every row's `product` is one of the 8 tracked SW-master names (no untracked-product noise slipped through), and re-running "즉시 수집" a second time does NOT insert duplicate rows for the same KNVD items (validates the stable `KISA-{id}` key).
9. Open each of the 4 existing review screens (KISA 취약점 공지 / 제조사 취약점 공지 / EOS 공지 / 승인된 취약점 공지) and confirm the newly collected notices show up on the correct screen purely from their `source_type`/`notice_type` values — e.g. the PostgreSQL EOS row appears on "EOS 공지" (not on "제조사 취약점 공지"), and any KISA-sourced CVE appears on "KISA 취약점 공지" (not "제조사 취약점 공지"). This is the key proof that no screen/nav/matching code needed to change.
10. Confirm zero browser console errors on each screen.

- [ ] **Step 3: Clean up test artifacts**

If any of the collected rows are unwanted for the live demo dataset (e.g. an OpenSSL/Red Hat CVE the presenter doesn't want cluttering the screen), leave them — this task is about validating the collectors work, not curating the final demo dataset. Do NOT delete real collected rows as part of this verification step; that's a separate, later curation decision for the human.

- [ ] **Step 4: Commit (if any fixups were needed)**

```bash
git add -A
git commit -m "fix: address issues found during end-to-end verification"
```

(Skip this commit if Step 2 required no code changes.)
