"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Tables, TablesInsert, TablesUpdate } from "@/lib/supabase/types"

export type MasterRow = Tables<"sw_masters">
export type MasterCategory = MasterRow["category"]
export type CollectMode = MasterRow["collect_mode"]

export const MASTER_CATEGORIES: MasterCategory[] = ["OS", "WEB", "WAS", "DB", "Middleware", "Security"]
export const COLLECT_MODES: CollectMode[] = ["AUTO", "SEMI_AUTO", "MANUAL"]

export type EditableFields = {
  name: string
  vendor: string
  category: MasterCategory
  std_version: string
  collect_mode: CollectMode
  active: boolean
  manager: string
  note: string
}

const EDITABLE_FIELDS = [
  "name", "vendor", "category", "std_version", "collect_mode", "active", "manager", "note",
] as const satisfies readonly (keyof EditableFields)[]

const REQUIRED_STRING_FIELDS = ["name", "vendor", "std_version"] as const satisfies readonly (keyof EditableFields)[]

export const FIELD_LABELS: Record<keyof EditableFields, string> = {
  name: "제품명",
  vendor: "벤더",
  category: "분류",
  std_version: "표준 버전",
  collect_mode: "수집 모드",
  active: "사용 여부",
  manager: "관리자",
  note: "비고",
}

export function formatDateTime(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 실제 인증 도입 전까지 고정하는 mock 수정자명 — sidebar.tsx의 CURRENT_USER.admin과 동일 */
const ACTOR = "김관리"

const EMPTY_EDITABLE: EditableFields = {
  name: "",
  vendor: "",
  category: MASTER_CATEGORIES[0],
  std_version: "",
  collect_mode: COLLECT_MODES[0],
  active: true,
  manager: "",
  note: "",
}

type DraftStatus = "added" | "modified" | "deleted"

type MasterDraft = {
  status: DraftStatus
  values: EditableFields
  fieldErrors?: Partial<Record<keyof EditableFields, string>>
  saveError?: string
}

export type EffectiveRow = {
  id: string
  values: EditableFields
  status: "clean" | DraftStatus
  dirtyFields: Set<keyof EditableFields>
  fieldErrors?: Partial<Record<keyof EditableFields, string>>
  saveError?: string
  updatedAt: string | null
  updatedBy: string | null
  createdAt: string | null
}

export type ChangeLogEntry = { id: string; label: string }

export type CommitOutcome = { id: string; ok: boolean; error?: string }

function toEditable(row: MasterRow): EditableFields {
  return {
    name: row.name,
    vendor: row.vendor,
    category: row.category,
    std_version: row.std_version,
    collect_mode: row.collect_mode,
    active: row.active,
    manager: row.manager ?? "",
    note: row.note ?? "",
  }
}

function sameValues(a: EditableFields, b: EditableFields): boolean {
  return EDITABLE_FIELDS.every((f) => a[f] === b[f])
}

function dedupKey(v: EditableFields): string {
  return [v.name, v.vendor, v.std_version].map((s) => s.trim().toLowerCase()).join("␟")
}

let tempIdCounter = 0
function nextTempId(): string {
  tempIdCounter += 1
  return `NEW-${tempIdCounter}`
}

function computeErrors(rows: EffectiveRow[]): Map<string, Partial<Record<keyof EditableFields, string>>> {
  const errors = new Map<string, Partial<Record<keyof EditableFields, string>>>()
  const activeRows = rows.filter((r) => r.status !== "deleted")

  for (const row of rows) {
    if (row.status === "clean" || row.status === "deleted") continue
    const rowErrors: Partial<Record<keyof EditableFields, string>> = {}

    for (const f of REQUIRED_STRING_FIELDS) {
      if (!row.values[f].trim()) rowErrors[f] = "필수 입력값입니다"
    }

    const hasKeyParts =
      row.values.name.trim() && row.values.vendor.trim() && row.values.std_version.trim()
    if (hasKeyParts) {
      const key = dedupKey(row.values)
      const duplicate = activeRows.some((other) => other.id !== row.id && dedupKey(other.values) === key)
      if (duplicate) rowErrors.name = "동일한 SW 마스터가 이미 존재합니다"
    }

    if (Object.keys(rowErrors).length > 0) errors.set(row.id, rowErrors)
  }

  return errors
}

export function useMasterDraft() {
  const [baseline, setBaseline] = useState<Map<string, MasterRow>>(new Map())
  const [drafts, setDrafts] = useState<Map<string, MasterDraft>>(new Map())
  const [loading, setLoading] = useState(true)

  async function fetchRows() {
    const supabase = createClient()
    const { data } = await supabase
      .from("sw_masters")
      .select("*")
      .is("deleted_at", null)
      .order("id")
    if (data) setBaseline(new Map(data.map((r) => [r.id, r])))
    setDrafts(new Map())
    setLoading(false)
  }

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from("sw_masters")
      .select("*")
      .is("deleted_at", null)
      .order("id")
      .then(({ data }) => {
        if (data) setBaseline(new Map(data.map((r) => [r.id, r])))
        setDrafts(new Map())
        setLoading(false)
      })
  }, [])

  const rows: EffectiveRow[] = useMemo(() => {
    const out: EffectiveRow[] = []

    for (const [id, draft] of drafts) {
      if (baseline.has(id)) continue
      out.push({
        id,
        values: draft.values,
        status: draft.status,
        dirtyFields: new Set(EDITABLE_FIELDS),
        fieldErrors: draft.fieldErrors,
        saveError: draft.saveError,
        updatedAt: null,
        updatedBy: null,
        createdAt: null,
      })
    }

    for (const [id, row] of baseline) {
      const draft = drafts.get(id)
      const baseValues = toEditable(row)
      const values = draft ? draft.values : baseValues
      const dirtyFields = new Set<keyof EditableFields>()
      if (draft) {
        for (const f of EDITABLE_FIELDS) {
          if (values[f] !== baseValues[f]) dirtyFields.add(f)
        }
      }
      out.push({
        id,
        values,
        status: draft ? draft.status : "clean",
        dirtyFields,
        fieldErrors: draft?.fieldErrors,
        saveError: draft?.saveError,
        updatedAt: row.updated_at,
        updatedBy: row.updated_by,
        createdAt: row.created_at,
      })
    }

    return out
  }, [baseline, drafts])

  const summary = useMemo(() => {
    let added = 0
    let modified = 0
    let deleted = 0
    for (const row of rows) {
      if (row.status === "added") added += 1
      else if (row.status === "modified") modified += 1
      else if (row.status === "deleted") deleted += 1
    }
    return { added, modified, deleted, total: added + modified + deleted }
  }, [rows])

  const changeLog = useMemo<ChangeLogEntry[]>(() => {
    const entries: ChangeLogEntry[] = []
    for (const row of rows) {
      if (row.status === "clean") continue
      if (row.status === "added") {
        entries.push({ id: row.id, label: `${row.values.name || "(제품명 미입력)"} 신규 추가` })
      } else if (row.status === "deleted") {
        entries.push({ id: row.id, label: `${row.id} 삭제 예정` })
      } else {
        const fields = Array.from(row.dirtyFields)
        if (fields.length === 1) {
          entries.push({ id: row.id, label: `${row.id} ${FIELD_LABELS[fields[0]]} 수정` })
        } else if (fields.length > 1) {
          entries.push({ id: row.id, label: `${row.id} ${fields.length}개 항목 수정` })
        }
      }
    }
    return entries
  }, [rows])

  function editCell<K extends keyof EditableFields>(id: string, field: K, value: EditableFields[K]) {
    setDrafts((prev) => {
      const existingDraft = prev.get(id)
      if (existingDraft?.status === "deleted") return prev

      const base = baseline.get(id)
      const currentValues = existingDraft ? existingDraft.values : base ? toEditable(base) : EMPTY_EDITABLE
      const updatedValues = { ...currentValues, [field]: value }

      const next = new Map(prev)
      if (base && sameValues(updatedValues, toEditable(base))) {
        next.delete(id)
        return next
      }

      const status: DraftStatus = base ? "modified" : "added"
      next.set(id, { status, values: updatedValues })
      return next
    })
  }

  function addRow(): string {
    const id = nextTempId()
    setDrafts((prev) => {
      const next = new Map(prev)
      next.set(id, { status: "added", values: { ...EMPTY_EDITABLE } })
      return next
    })
    return id
  }

  function duplicateRow(id: string) {
    const source = rows.find((r) => r.id === id)
    if (!source) return
    const newId = nextTempId()
    setDrafts((prev) => {
      const next = new Map(prev)
      next.set(newId, {
        status: "added",
        values: { ...source.values, name: `${source.values.name} (복제)` },
      })
      return next
    })
    return newId
  }

  function markDeleted(id: string) {
    setDrafts((prev) => {
      const isNew = !baseline.has(id)
      const next = new Map(prev)
      if (isNew) {
        next.delete(id)
        return next
      }
      const base = baseline.get(id)!
      const existingDraft = prev.get(id)
      const values = existingDraft ? existingDraft.values : toEditable(base)
      next.set(id, { status: "deleted", values })
      return next
    })
  }

  function undoDelete(id: string) {
    setDrafts((prev) => {
      const existingDraft = prev.get(id)
      if (!existingDraft || existingDraft.status !== "deleted") return prev
      const next = new Map(prev)
      const base = baseline.get(id)
      if (base && sameValues(existingDraft.values, toEditable(base))) {
        next.delete(id)
      } else {
        next.set(id, { ...existingDraft, status: "modified" })
      }
      return next
    })
  }

  function revertRow(id: string) {
    setDrafts((prev) => {
      if (!prev.has(id)) return prev
      const next = new Map(prev)
      next.delete(id)
      return next
    })
  }

  function revertAll() {
    setDrafts(new Map())
  }

  function validate(): boolean {
    const errors = computeErrors(rows)
    if (errors.size === 0) return true
    setDrafts((prev) => {
      const next = new Map(prev)
      for (const [id, fieldErrors] of errors) {
        const d = next.get(id)
        if (d) next.set(id, { ...d, fieldErrors })
      }
      return next
    })
    return false
  }

  async function commit(): Promise<CommitOutcome[]> {
    const supabase = createClient()
    const outcomes: CommitOutcome[] = []
    const successIds: string[] = []

    for (const row of rows) {
      if (row.status === "clean") continue

      if (row.status === "added") {
        const payload: TablesInsert<"sw_masters"> = {
          name: row.values.name.trim(),
          vendor: row.values.vendor.trim(),
          category: row.values.category,
          std_version: row.values.std_version.trim(),
          collect_mode: row.values.collect_mode,
          active: row.values.active,
          manager: row.values.manager.trim() || null,
          note: row.values.note.trim() || null,
          updated_by: ACTOR,
        }
        const { data, error } = await supabase.from("sw_masters").insert(payload).select().single()
        if (error || !data) {
          outcomes.push({ id: row.id, ok: false, error: error?.message ?? "저장에 실패했습니다" })
        } else {
          outcomes.push({ id: row.id, ok: true })
          successIds.push(row.id)
          setBaseline((prev) => new Map(prev).set(data.id, data))
        }
      } else if (row.status === "modified") {
        const payload: TablesUpdate<"sw_masters"> = {
          name: row.values.name.trim(),
          vendor: row.values.vendor.trim(),
          category: row.values.category,
          std_version: row.values.std_version.trim(),
          collect_mode: row.values.collect_mode,
          active: row.values.active,
          manager: row.values.manager.trim() || null,
          note: row.values.note.trim() || null,
          updated_by: ACTOR,
        }
        const { data, error } = await supabase
          .from("sw_masters")
          .update(payload)
          .eq("id", row.id)
          .select()
          .single()
        if (error || !data) {
          outcomes.push({ id: row.id, ok: false, error: error?.message ?? "저장에 실패했습니다" })
        } else {
          outcomes.push({ id: row.id, ok: true })
          successIds.push(row.id)
          setBaseline((prev) => new Map(prev).set(row.id, data))
        }
      } else if (row.status === "deleted") {
        const payload: TablesUpdate<"sw_masters"> = {
          active: false,
          deleted_at: new Date().toISOString(),
          deleted_by: ACTOR,
        }
        const { error } = await supabase.from("sw_masters").update(payload).eq("id", row.id)
        if (error) {
          outcomes.push({ id: row.id, ok: false, error: error.message })
        } else {
          outcomes.push({ id: row.id, ok: true })
          successIds.push(row.id)
          setBaseline((prev) => {
            const next = new Map(prev)
            next.delete(row.id)
            return next
          })
        }
      }
    }

    setDrafts((prev) => {
      const next = new Map(prev)
      for (const id of successIds) next.delete(id)
      for (const outcome of outcomes) {
        if (!outcome.ok) {
          const d = next.get(outcome.id)
          if (d) next.set(outcome.id, { ...d, saveError: outcome.error })
        }
      }
      return next
    })

    return outcomes
  }

  return {
    rows,
    loading,
    summary,
    changeLog,
    hasChanges: summary.total > 0,
    editCell,
    addRow,
    duplicateRow,
    markDeleted,
    undoDelete,
    revertRow,
    revertAll,
    validate,
    commit,
    refetch: fetchRows,
  }
}
