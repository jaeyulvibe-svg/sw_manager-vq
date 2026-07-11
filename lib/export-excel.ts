import * as XLSX from "xlsx"

export function exportRowsToExcel(filename: string, rows: Record<string, string | number>[]) {
  const sheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1")
  XLSX.writeFile(workbook, `${filename}.xlsx`)
}
