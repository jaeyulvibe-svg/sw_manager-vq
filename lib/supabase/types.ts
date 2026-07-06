export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      assets: {
        Row: {
          id: string
          name: string
          vendor: string
          category: "OS" | "WEB" | "DB" | "Middleware" | "Security"
          version: string
          latest_version: string | null
          server: string
          owner: string
          vuln: "Critical" | "High" | "Medium" | "Low"
          patch: "Patch Required" | "Up to Date" | "Patch Available"
          eos: string | null
          approval: "승인대기" | "확인필요" | "승인완료" | "긴급"
          checked_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          vendor: string
          category: "OS" | "WEB" | "DB" | "Middleware" | "Security"
          version: string
          latest_version?: string | null
          server: string
          owner: string
          vuln?: "Critical" | "High" | "Medium" | "Low"
          patch?: "Patch Required" | "Up to Date" | "Patch Available"
          eos?: string | null
          approval?: "승인대기" | "확인필요" | "승인완료" | "긴급"
          checked_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          vendor?: string
          category?: "OS" | "WEB" | "WAS" | "DB" | "Middleware" | "Security"
          version?: string
          latest_version?: string | null
          server?: string
          owner?: string
          vuln?: "Critical" | "High" | "Medium" | "Low"
          patch?: "Patch Required" | "Up to Date" | "Patch Available"
          eos?: string | null
          approval?: "승인대기" | "확인필요" | "승인완료" | "긴급"
          checked_at?: string | null
          updated_at?: string
        }
      }
      vulnerabilities: {
        Row: {
          id: string
          cve: string
          title: string
          severity: "Critical" | "High" | "Medium" | "Low"
          product: string
          source: string
          source_url: string | null
          mapped_assets: number
          approval: "승인대기" | "검토중" | "승인완료" | "반려"
          collected_at: string
          created_at: string
        }
        Insert: {
          id?: string
          cve: string
          title: string
          severity: "Critical" | "High" | "Medium" | "Low"
          product: string
          source: string
          source_url?: string | null
          mapped_assets?: number
          approval?: "승인대기" | "검토중" | "승인완료" | "반려"
          collected_at?: string
          created_at?: string
        }
        Update: {
          cve?: string
          title?: string
          severity?: "Critical" | "High" | "Medium" | "Low"
          product?: string
          source?: string
          source_url?: string | null
          mapped_assets?: number
          approval?: "승인대기" | "검토중" | "승인완료" | "반려"
          collected_at?: string
        }
      }
      asset_requests: {
        Row: {
          id: string
          no: string
          name: string
          vendor: string
          version: string
          category: string
          server: string
          owner: string
          reason: string
          requester: string
          requester_dept: string
          approval: "승인대기" | "검토중" | "승인완료" | "반려"
          urgency: "일반" | "긴급"
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          no?: string
          name: string
          vendor: string
          version: string
          category: string
          server: string
          owner: string
          reason: string
          requester: string
          requester_dept: string
          approval?: "승인대기" | "검토중" | "승인완료" | "반려"
          urgency?: "일반" | "긴급"
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          vendor?: string
          version?: string
          category?: string
          server?: string
          owner?: string
          reason?: string
          approval?: "승인대기" | "검토중" | "승인완료" | "반려"
          urgency?: "일반" | "긴급"
          updated_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          category: "asset" | "security" | "system"
          title: string
          description: string
          asset: string
          owner: string
          status: "확인필요" | "승인대기" | "검토중" | "완료" | "긴급"
          urgent: boolean
          read: boolean
          link_view: string
          link_label: string
          created_at: string
        }
        Insert: {
          id?: string
          category: "asset" | "security" | "system"
          title: string
          description: string
          asset: string
          owner: string
          status?: "확인필요" | "승인대기" | "검토중" | "완료" | "긴급"
          urgent?: boolean
          read?: boolean
          link_view: string
          link_label: string
          created_at?: string
        }
        Update: {
          read?: boolean
          status?: "확인필요" | "승인대기" | "검토중" | "완료" | "긴급"
        }
      }
      notices: {
        Row: {
          id: string
          category: string
          title: string
          author: string
          status: "일반" | "중요" | "긴급"
          views: number
          created_at: string
        }
        Insert: {
          id?: string
          category: string
          title: string
          author: string
          status?: "일반" | "중요" | "긴급"
          views?: number
          created_at?: string
        }
        Update: {
          category?: string
          title?: string
          author?: string
          status?: "일반" | "중요" | "긴급"
          views?: number
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"]

export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"]

export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"]
