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
          category: "OS" | "WEB" | "WAS" | "DB" | "Middleware" | "Security"
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
          category: "OS" | "WEB" | "WAS" | "DB" | "Middleware" | "Security"
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
        Relationships: []
      }
      servers: {
        Row: {
          id: string
          name: string
          hostname: string
          ip: string
          category: "WEB" | "WAS" | "DB"
          os_type: string
          location: string
          status: "Running" | "Stopped" | "Maintenance"
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          hostname: string
          ip: string
          category: "WEB" | "WAS" | "DB"
          os_type?: string
          location?: string
          status?: "Running" | "Stopped" | "Maintenance"
          created_at?: string
        }
        Update: {
          name?: string
          hostname?: string
          ip?: string
          category?: "WEB" | "WAS" | "DB"
          os_type?: string
          location?: string
          status?: "Running" | "Stopped" | "Maintenance"
        }
        Relationships: []
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
          source_type: "kisa" | "vendor"
          mapped_assets: number
          approval: "승인대기" | "검토중" | "승인완료" | "반려"
          notice_type: "CVE" | "Patch" | "EOS"
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
          source_type?: "kisa" | "vendor"
          mapped_assets?: number
          approval?: "승인대기" | "검토중" | "승인완료" | "반려"
          notice_type?: "CVE" | "Patch" | "EOS"
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
          source_type?: "kisa" | "vendor"
          mapped_assets?: number
          approval?: "승인대기" | "검토중" | "승인완료" | "반려"
          notice_type?: "CVE" | "Patch" | "EOS"
          collected_at?: string
        }
        Relationships: []
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
        Relationships: []
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
        Relationships: []
      }
      notices: {
        Row: {
          id: string
          category: string
          title: string
          author: string
          status: "일반" | "중요" | "긴급"
          views: number
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          category: string
          title: string
          author: string
          status?: "일반" | "중요" | "긴급"
          views?: number
          content?: string
          created_at?: string
        }
        Update: {
          category?: string
          title?: string
          author?: string
          status?: "일반" | "중요" | "긴급"
          views?: number
          content?: string
        }
        Relationships: []
      }
      licenses: {
        Row: {
          id: string
          asset_id: string
          total_seats: number
          used_seats: number
          note: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          asset_id: string
          total_seats: number
          used_seats?: number
          note?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          asset_id?: string
          total_seats?: number
          used_seats?: number
          note?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sw_masters: {
        Row: {
          id: string
          name: string
          vendor: string
          category: "OS" | "WEB" | "WAS" | "DB" | "Middleware" | "Security"
          std_version: string
          collect_mode: "AUTO" | "SEMI_AUTO" | "MANUAL"
          active: boolean
          manager: string | null
          note: string | null
          updated_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          deactivated_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          vendor: string
          category: "OS" | "WEB" | "WAS" | "DB" | "Middleware" | "Security"
          std_version: string
          collect_mode: "AUTO" | "SEMI_AUTO" | "MANUAL"
          active?: boolean
          manager?: string | null
          note?: string | null
          updated_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deactivated_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          vendor?: string
          category?: "OS" | "WEB" | "WAS" | "DB" | "Middleware" | "Security"
          std_version?: string
          collect_mode?: "AUTO" | "SEMI_AUTO" | "MANUAL"
          active?: boolean
          manager?: string | null
          note?: string | null
          updated_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deactivated_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sources: {
        Row: {
          id: string
          name: string
          type: string
          url: string
          cycle: "1시간" | "6시간" | "일 1회"
          status: "정상" | "지연" | "실패"
          last_collected_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          type: string
          url: string
          cycle: "1시간" | "6시간" | "일 1회"
          status?: "정상" | "지연" | "실패"
          last_collected_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          type?: string
          url?: string
          cycle?: "1시간" | "6시간" | "일 1회"
          status?: "정상" | "지연" | "실패"
          last_collected_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      app_users: {
        Row: {
          id: string
          name: string
          email: string
          dept: string
          role: "관리자" | "승인자" | "담당자" | "조회 사용자"
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          email: string
          dept: string
          role: "관리자" | "승인자" | "담당자" | "조회 사용자"
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          email?: string
          dept?: string
          role?: "관리자" | "승인자" | "담당자" | "조회 사용자"
          active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      admin_policies: {
        Row: {
          id: string
          auto_collect_enabled: boolean
          collect_interval: "1시간" | "6시간" | "일 1회"
          critical_urgent_alert: boolean
          high_requires_approval: boolean
          eos_alert_180d: boolean
          queue_after_collect: boolean
          updated_at: string
        }
        Insert: {
          id?: string
          auto_collect_enabled?: boolean
          collect_interval?: "1시간" | "6시간" | "일 1회"
          critical_urgent_alert?: boolean
          high_requires_approval?: boolean
          eos_alert_180d?: boolean
          queue_after_collect?: boolean
          updated_at?: string
        }
        Update: {
          auto_collect_enabled?: boolean
          collect_interval?: "1시간" | "6시간" | "일 1회"
          critical_urgent_alert?: boolean
          high_requires_approval?: boolean
          eos_alert_180d?: boolean
          queue_after_collect?: boolean
          updated_at?: string
        }
        Relationships: []
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
