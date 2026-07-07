import type { Tables } from "@/lib/supabase/types"

type Asset = Tables<"assets">
type Vulnerability = Tables<"vulnerabilities">

/**
 * vulnerabilities.product 는 "OpenSSL 3.0.x", "Apache Tomcat 9.0.x" 처럼
 * 제품명 뒤에 버전 표기가 붙은 자유 텍스트라, 자산명이 product 문자열에
 * 포함되는지로 실제 보유 자산과 매칭한다.
 */
export function isProductMatch(product: string, asset: Asset): boolean {
  return product.toLowerCase().includes(asset.name.toLowerCase())
}

export function matchAssets(vuln: Pick<Vulnerability, "product">, assets: Asset[]): Asset[] {
  return assets.filter((a) => isProductMatch(vuln.product, a))
}

export function matchVulnerabilities(
  asset: Asset,
  vulns: Vulnerability[],
): Vulnerability[] {
  return vulns.filter((v) => isProductMatch(v.product, asset))
}
