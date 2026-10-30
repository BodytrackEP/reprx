
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "app_settings": {
                  Row: {
                    "client_session_timeout_days": number,"created_at": string,"environment": string,"id": number,"retention_years_after_last_activity": number,"rm_warn_above_reps": number,"rounding_increment_kg": number,"soft_delete_restore_days": number,"staff_session_timeout_hours": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_session_timeout_days"?: number,"created_at"?: string,"environment"?: string,"id"?: number,"retention_years_after_last_activity"?: number,"rm_warn_above_reps"?: number,"rounding_increment_kg"?: number,"soft_delete_restore_days"?: number,"staff_session_timeout_hours"?: number,"updated_at"?: string
                  }
                  Update: {
                    "client_session_timeout_days"?: number,"created_at"?: string,"environment"?: string,"id"?: number,"retention_years_after_last_activity"?: number,"rm_warn_above_reps"?: number,"rounding_increment_kg"?: number,"soft_delete_restore_days"?: number,"staff_session_timeout_hours"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor": string | null,"actor_label": string | null,"id": number,"new_row": Json | null,"occurred_at": string,"old_row": Json | null,"row_pk": string,"table_name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor"?: string | null,"actor_label"?: string | null,"id"?: never,"new_row"?: Json | null,"occurred_at"?: string,"old_row"?: Json | null,"row_pk": string,"table_name": string
                  }
                  Update: {
                    "action"?: string,"actor"?: string | null,"actor_label"?: string | null,"id"?: never,"new_row"?: Json | null,"occurred_at"?: string,"old_row"?: Json | null,"row_pk"?: string,"table_name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"class_categories": {
                  Row: {
                    "code": string,"colour": string,"created_at": string,"label": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"colour": string,"created_at"?: string,"label": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "code"?: string,"colour"?: string,"created_at"?: string,"label"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"class_members": {
                  Row: {
                    "added_at": string,"added_by": string,"class_id": number,"client_id": number,"created_at": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "added_at"?: string,"added_by"?: string,"class_id": number,"client_id": number,"created_at"?: string,"updated_at"?: string
                  }
                  Update: {
                    "added_at"?: string,"added_by"?: string,"class_id"?: number,"client_id"?: number,"created_at"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "class_members_added_by_fkey"
      columns: ["added_by"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_members_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_members_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    }
                  ]
                },"classes": {
                  Row: {
                    "category_code": string,"cliniko_group_appointment_ref": string | null,"created_at": string,"day_of_week": number,"end_time": string,"id": number,"is_active": boolean,"location": string | null,"max_capacity": number | null,"name": string,"start_time": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category_code": string,"cliniko_group_appointment_ref"?: string | null,"created_at"?: string,"day_of_week": number,"end_time": string,"id"?: never,"is_active"?: boolean,"location"?: string | null,"max_capacity"?: number | null,"name": string,"start_time": string,"updated_at"?: string
                  }
                  Update: {
                    "category_code"?: string,"cliniko_group_appointment_ref"?: string | null,"created_at"?: string,"day_of_week"?: number,"end_time"?: string,"id"?: never,"is_active"?: boolean,"location"?: string | null,"max_capacity"?: number | null,"name"?: string,"start_time"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "classes_category_code_fkey"
      columns: ["category_code"]
isOneToOne: false
      referencedRelation: "class_categories"
      referencedColumns: ["code"]
    }
                  ]
                },"clients": {
                  Row: {
                    "auth_user_id": string | null,"cliniko_archived_at": string | null,"cliniko_last_synced_at": string | null,"cliniko_linked_at": string | null,"cliniko_linked_by": string | null,"cliniko_patient_id": number | null,"cliniko_shard": string | null,"created_at": string,"deleted_at": string | null,"first_name": string,"id": number,"is_active": boolean,"is_test": boolean,"last_name": string,"preferred_name": string | null,"source": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auth_user_id"?: string | null,"cliniko_archived_at"?: string | null,"cliniko_last_synced_at"?: string | null,"cliniko_linked_at"?: string | null,"cliniko_linked_by"?: string | null,"cliniko_patient_id"?: number | null,"cliniko_shard"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"first_name": string,"id"?: never,"is_active"?: boolean,"is_test"?: boolean,"last_name": string,"preferred_name"?: string | null,"source"?: string,"updated_at"?: string
                  }
                  Update: {
                    "auth_user_id"?: string | null,"cliniko_archived_at"?: string | null,"cliniko_last_synced_at"?: string | null,"cliniko_linked_at"?: string | null,"cliniko_linked_by"?: string | null,"cliniko_patient_id"?: number | null,"cliniko_shard"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"first_name"?: string,"id"?: never,"is_active"?: boolean,"is_test"?: boolean,"last_name"?: string,"preferred_name"?: string | null,"source"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "clients_cliniko_linked_by_fkey"
      columns: ["cliniko_linked_by"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    }
                  ]
                },"exercises": {
                  Row: {
                    "created_at": string,"description": string | null,"equipment": string | null,"id": number,"is_active": boolean,"muscle_group": string | null,"name": string,"updated_at": string,"video_url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"equipment"?: string | null,"id"?: never,"is_active"?: boolean,"muscle_group"?: string | null,"name": string,"updated_at"?: string,"video_url"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"equipment"?: string | null,"id"?: never,"is_active"?: boolean,"muscle_group"?: string | null,"name"?: string,"updated_at"?: string,"video_url"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"program_exercises": {
                  Row: {
                    "created_at": string,"exercise_id": number,"fallback_weight_kg": number | null,"id": number,"notes": string | null,"order_index": number,"program_id": number,"reps": number,"rest_seconds": number | null,"rm_percentage": number | null,"sets": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"exercise_id": number,"fallback_weight_kg"?: number | null,"id"?: never,"notes"?: string | null,"order_index": number,"program_id": number,"reps": number,"rest_seconds"?: number | null,"rm_percentage"?: number | null,"sets": number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"exercise_id"?: number,"fallback_weight_kg"?: number | null,"id"?: never,"notes"?: string | null,"order_index"?: number,"program_id"?: number,"reps"?: number,"rest_seconds"?: number | null,"rm_percentage"?: number | null,"sets"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "program_exercises_exercise_id_fkey"
      columns: ["exercise_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "program_exercises_program_id_fkey"
      columns: ["program_id"]
isOneToOne: false
      referencedRelation: "programs"
      referencedColumns: ["id"]
    }
                  ]
                },"programs": {
                  Row: {
                    "class_id": number,"created_at": string,"id": number,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "class_id": number,"created_at"?: string,"id"?: never,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "class_id"?: number,"created_at"?: string,"id"?: never,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "programs_class_id_fkey"
      columns: ["class_id"]
isOneToOne: true
      referencedRelation: "classes"
      referencedColumns: ["id"]
    }
                  ]
                },"rm_tests": {
                  Row: {
                    "client_id": number,"created_at": string,"estimated_1rm_kg": number | null,"exercise_id": number,"id": number,"notes": string | null,"recorded_by": string,"reps": number,"test_date": string,"updated_at": string,"voided_at": string | null,"voided_reason": string | null,"weight_kg": number
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": number,"created_at"?: string,"estimated_1rm_kg"?: never,"exercise_id": number,"id"?: never,"notes"?: string | null,"recorded_by"?: string,"reps": number,"test_date"?: string,"updated_at"?: string,"voided_at"?: string | null,"voided_reason"?: string | null,"weight_kg": number
                  }
                  Update: {
                    "client_id"?: number,"created_at"?: string,"estimated_1rm_kg"?: never,"exercise_id"?: number,"id"?: never,"notes"?: string | null,"recorded_by"?: string,"reps"?: number,"test_date"?: string,"updated_at"?: string,"voided_at"?: string | null,"voided_reason"?: string | null,"weight_kg"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "rm_tests_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rm_tests_exercise_id_fkey"
      columns: ["exercise_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rm_tests_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    }
                  ]
                },"staff": {
                  Row: {
                    "created_at": string,"display_name": string,"id": string,"is_active": boolean,"role": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name": string,"id": string,"is_active"?: boolean,"role": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string,"id"?: string,"is_active"?: boolean,"role"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"weight_overrides": {
                  Row: {
                    "client_id": number,"created_at": string,"ended_at": string | null,"ended_by": string | null,"exercise_id": number,"id": number,"override_weight_kg": number,"reason": string,"review_date": string | null,"set_at": string,"set_by": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": number,"created_at"?: string,"ended_at"?: string | null,"ended_by"?: string | null,"exercise_id": number,"id"?: never,"override_weight_kg": number,"reason": string,"review_date"?: string | null,"set_at"?: string,"set_by"?: string,"updated_at"?: string
                  }
                  Update: {
                    "client_id"?: number,"created_at"?: string,"ended_at"?: string | null,"ended_by"?: string | null,"exercise_id"?: number,"id"?: never,"override_weight_kg"?: number,"reason"?: string,"review_date"?: string | null,"set_at"?: string,"set_by"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "weight_overrides_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "weight_overrides_ended_by_fkey"
      columns: ["ended_by"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "weight_overrides_exercise_id_fkey"
      columns: ["exercise_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "weight_overrides_set_by_fkey"
      columns: ["set_by"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "effective_weights_v": {
                  Row: {
                    "calculated_kg": number | null,"class_id": number,"client_id": number,"effective_kg": number | null,"exercise_id": number,"fallback_kg": number | null,"latest_1rm_kg": number | null,"latest_test_date": string | null,"order_index": number,"override_kg": number | null,"override_reason": string | null,"override_review_date": string | null,"reps": number,"rm_percentage": number | null,"sets": number,"weight_source": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "class_members_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_members_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "program_exercises_exercise_id_fkey"
      columns: ["exercise_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "add_class_members":
{ Args: { "p_allow_over_capacity"?: boolean,"p_class_id": number,"p_client_ids": (number)[] }; Returns: undefined
                           },
"effective_weights":
{ Args: { "p_class_id": number }; Returns: {
              "calculated_kg": number,"client_id": number,"effective_kg": number,"exercise_id": number,"fallback_kg": number,"latest_1rm_kg": number,"latest_test_date": string,"order_index": number,"override_kg": number,"override_reason": string,"override_review_date": string,"reps": number,"rm_percentage": number,"sets": number,"weight_source": string
            }[]
                           },
"effective_weights_for_client":
{ Args: { "p_client_id": number }; Returns: {
              "calculated_kg": number,"class_id": number,"effective_kg": number,"exercise_id": number,"fallback_kg": number,"latest_1rm_kg": number,"latest_test_date": string,"order_index": number,"override_kg": number,"override_reason": string,"override_review_date": string,"reps": number,"rm_percentage": number,"sets": number,"weight_source": string
            }[]
                           },
"end_override":
{ Args: { "p_override_id": number }; Returns: undefined
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_staff":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"move_client":
{ Args: { "p_allow_over_capacity"?: boolean,"p_client_id": number,"p_from_class": number,"p_to_class": number }; Returns: undefined
                           },
"move_clients":
{ Args: { "p_allow_over_capacity"?: boolean,"p_client_ids": (number)[],"p_from_class": number,"p_to_class": number }; Returns: undefined
                           },
"purge_test_data":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"reorder_program_exercises":
{ Args: { "p_ids": (number)[],"p_program_id": number }; Returns: undefined
                           },
"round_to_increment":
{ Args: { "p_increment": number,"p_kg": number }; Returns: number
                           },
"set_client_classes":
{ Args: { "p_allow_over_capacity"?: boolean,"p_class_ids": (number)[],"p_client_id": number }; Returns: undefined
                           },
"set_override":
{ Args: { "p_client_id": number,"p_exercise_id": number,"p_reason": string,"p_review_date"?: string,"p_weight_kg": number }; Returns: number
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
