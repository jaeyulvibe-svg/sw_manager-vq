/**
 * 자산의 patch 버전 문자열(예: "10.1.20", "19c", "16.2")을 endoflife.date의
 * release cycle 이름(예: "10.1", "19", "16")으로 정규화한다.
 * 제품별 release cycle 표기가 서로 달라(Tomcat은 major.minor, RHEL/PostgreSQL은
 * major만, Oracle은 섞여있음) 단순 첫 자리 자르기로는 안 되고, 실제 API가 제공하는
 * release cycle 후보 목록(cycles) 중 가장 구체적으로 일치하는 것을 고른다.
 */
export function normalizeAssetVersion(productKey: string, rawVersion: string): string | null {
  switch (productKey) {
    case "tomcat": {
      // "10.1.20" → "10.1", "7.0.109" → "7.0" (API에 "7"만 있으면 매칭 단계에서 처리)
      const m = rawVersion.match(/^(\d+)\.(\d+)/)
      return m ? `${m[1]}.${m[2]}` : rawVersion.match(/^\d+/)?.[0] ?? null
    }
    case "nginx": {
      // "1.24.0" → "1.24"
      const m = rawVersion.match(/^(\d+)\.(\d+)/)
      return m ? `${m[1]}.${m[2]}` : null
    }
    case "postgresql": {
      // "16.2" → "16" (PostgreSQL 10+는 major만으로 release cycle을 구분)
      const m = rawVersion.match(/^(\d+)/)
      return m ? m[1] : null
    }
    case "rhel": {
      // "8.8" / "RHEL 9.4" → "9"
      const m = rawVersion.match(/(\d+)/)
      return m ? m[1] : null
    }
    case "oracle-database": {
      // "19c" → "19", "12.2.0.1" → "12.2", "12c Release 2" → "12.2"
      const cleaned = rawVersion.replace(/release\s*/i, "")
      const release2 = cleaned.match(/(\d+)\D+2/i)
      if (release2 && /^\d+c?\s*(release)?\s*2/i.test(cleaned.trim())) {
        return `${release2[1]}.2`
      }
      const dotted = cleaned.match(/^(\d+)\.(\d+)/)
      if (dotted) return `${dotted[1]}.${dotted[2]}`
      const major = cleaned.match(/^(\d+)/)
      return major ? major[1] : null
    }
    default:
      return null
  }
}

/**
 * 정규화된 버전 후보를 실제 API가 반환한 release cycle 이름 목록과 대조한다.
 * major.minor 후보가 없으면 major만으로도 한 번 더 시도한다(예: Tomcat "7.0" 후보인데
 * API에는 "7"만 있는 경우) — 단, 이건 "더 구체적인 표기가 없을 때의 폴백"이지
 * 처음부터 major만 쓰는 것과는 다르다(10.1과 10.0을 다른 cycle로 정확히 구분해야 하므로).
 */
export function matchReleaseCycle(normalized: string, availableCycles: string[]): string | null {
  if (availableCycles.includes(normalized)) return normalized
  const majorOnly = normalized.match(/^(\d+)\./)?.[1]
  if (majorOnly && availableCycles.includes(majorOnly)) return majorOnly
  return null
}
