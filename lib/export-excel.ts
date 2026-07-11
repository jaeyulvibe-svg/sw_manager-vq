import * as XLSX from "xlsx"

export function exportRowsToExcel(
  filename: string,
  rows: Record<string, string | number>[],
  title: string,
) {
  const sheet = XLSX.utils.aoa_to_sheet([[title]])
  XLSX.utils.sheet_add_json(sheet, rows, { origin: "A2" })

  const colCount = rows.length > 0 ? Object.keys(rows[0]).length : 1
  sheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(colCount - 1, 0) } }]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1")
  XLSX.writeFile(workbook, `${filename}.xlsx`)
}
