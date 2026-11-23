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
      enrollments: {
        Row: {
          course_code: string
          created_at: string
          credit: number | null
          grade: string | null
          id: string
          source: string
          status: string
          taken_semester: number
          taken_year: number
          user_id: string
        }
        ComputedFields: never
        Insert: {
          course_code: string
          created_at?: string
          credit?: number | null
          grade?: string | null
          id?: string
          source: string
          status: string
          taken_semester: number
          taken_year: number
          user_id: string
        }
        Update: {
          course_code?: string
          created_at?: string
          credit?: number | null
          grade?: string | null
          id?: string
          source?: string
          status?: string
          taken_semester?: number
          taken_year?: number
          user_id?: string
        }
        Relationships: []
      }
      followup_stats: {
        Row: {
          base_count: number
          follower_count: number
          from_code: string
          program_id: string
          to_code: string
        }
        ComputedFields: never
        Insert: {
          base_count: number
          follower_count: number
          from_code: string
          program_id: string
          to_code: string
        }
        Update: {
          base_count?: number
          follower_count?: number
          from_code?: string
          program_id?: string
          to_code?: string
        }
        Relationships: []
      }
      noncredit_status: {
        Row: {
          checklist_key: string
          input_value: string | null
          status: string
          updated_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          checklist_key: string
          input_value?: string | null
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          checklist_key?: string
          input_value?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ocr_import_items: {
        Row: {
          candidate_codes: string[]
          created_at: string
          id: string
          matched_course_code: string | null
          raw_text: string
          review_status: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          candidate_codes?: string[]
          created_at?: string
          id?: string
          matched_course_code?: string | null
          raw_text: string
          review_status?: string
          user_id: string
        }
        Update: {
          candidate_codes?: string[]
          created_at?: string
          id?: string
          matched_course_code?: string | null
          raw_text?: string
          review_status?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          admission_year: number
          created_at: string
          email: string | null
          id: string
          major_type: string
          program_id: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          admission_year: number
          created_at?: string
          email?: string | null
          id: string
          major_type?: string
          program_id: string
          updated_at?: string
        }
        Update: {
          admission_year?: number
          created_at?: string
          email?: string | null
          id?: string
          major_type?: string
          program_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      senior_enrollments: {
        Row: {
          course_code: string
          senior_id: string
          taken_semester: number
          taken_year: number
        }
        ComputedFields: never
        Insert: {
          course_code: string
          senior_id: string
          taken_semester: number
          taken_year: number
        }
        Update: {
          course_code?: string
          senior_id?: string
          taken_semester?: number
          taken_year?: number
        }
        Relationships: [
          {
            foreignKeyName: "senior_enrollments_senior_id_fkey"
            columns: ["senior_id"]
            isOneToOne: false
            referencedRelation: "senior_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      senior_profiles: {
        Row: {
          admission_year: number
          id: string
          label: string
          program_id: string
        }
        ComputedFields: never
        Insert: {
          admission_year: number
          id?: string
          label: string
          program_id: string
        }
        Update: {
          admission_year?: number
          id?: string
          label?: string
          program_id?: string
        }
        Relationships: []
      }
      user_interests: {
        Row: {
          field_id: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          field_id: string
          user_id: string
        }
        Update: {
          field_id?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      replace_user_interests: {
        Args: { field_ids: string[] }
        Returns: string[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
