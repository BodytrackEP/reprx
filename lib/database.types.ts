
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
                },"class_program_assignments": {
                  Row: {
                    "class_id": number,"created_at": string,"created_by": string | null,"end_date": string | null,"id": number,"program_id": number,"start_date": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "class_id": number,"created_at"?: string,"created_by"?: string | null,"end_date"?: string | null,"id"?: never,"program_id": number,"start_date": string,"updated_at"?: string
                  }
                  Update: {
                    "class_id"?: number,"created_at"?: string,"created_by"?: string | null,"end_date"?: string | null,"id"?: never,"program_id"?: number,"start_date"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "class_program_assignments_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_program_assignments_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_program_assignments_program_id_fkey"
      columns: ["program_id"]
isOneToOne: false
      referencedRelation: "library_programs"
      referencedColumns: ["id"]
    }
                  ]
                },"class_program_items": {
                  Row: {
                    "assignment_id": number,"created_at": string,"exercise_id": number,"fallback_weight_kg": number | null,"id": number,"is_customised": boolean,"is_removed": boolean,"item_key": string,"notes": string | null,"position": number,"reps": string,"rest_seconds": number | null,"rm_percentage": number | null,"sets": number,"source_version_id": number | null,"superset_group": number | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assignment_id": number,"created_at"?: string,"exercise_id": number,"fallback_weight_kg"?: number | null,"id"?: never,"is_customised"?: boolean,"is_removed"?: boolean,"item_key"?: string,"notes"?: string | null,"position": number,"reps": string,"rest_seconds"?: number | null,"rm_percentage"?: number | null,"sets": number,"source_version_id"?: number | null,"superset_group"?: number | null,"updated_at"?: string
                  }
                  Update: {
                    "assignment_id"?: number,"created_at"?: string,"exercise_id"?: number,"fallback_weight_kg"?: number | null,"id"?: never,"is_customised"?: boolean,"is_removed"?: boolean,"item_key"?: string,"notes"?: string | null,"position"?: number,"reps"?: string,"rest_seconds"?: number | null,"rm_percentage"?: number | null,"sets"?: number,"source_version_id"?: number | null,"superset_group"?: number | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "class_program_items_assignment_id_fkey"
      columns: ["assignment_id"]
isOneToOne: false
      referencedRelation: "class_program_assignments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_program_items_assignment_id_fkey"
      columns: ["assignment_id"]
isOneToOne: false
      referencedRelation: "effective_weights_v"
      referencedColumns: ["assignment_id"]
    },{
      foreignKeyName: "class_program_items_exercise_id_fkey"
      columns: ["exercise_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_program_items_source_version_id_fkey"
      columns: ["source_version_id"]
isOneToOne: false
      referencedRelation: "program_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"class_program_pushes": {
                  Row: {
                    "applied_at": string,"applied_by": string | null,"assignment_id": number,"id": number,"rows_changed": NonNullable<Json>,"version_id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "applied_at"?: string,"applied_by"?: string | null,"assignment_id": number,"id"?: never,"rows_changed"?: NonNullable<Json>,"version_id": number
                  }
                  Update: {
                    "applied_at"?: string,"applied_by"?: string | null,"assignment_id"?: number,"id"?: never,"rows_changed"?: NonNullable<Json>,"version_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "class_program_pushes_applied_by_fkey"
      columns: ["applied_by"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_program_pushes_assignment_id_fkey"
      columns: ["assignment_id"]
isOneToOne: false
      referencedRelation: "class_program_assignments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_program_pushes_assignment_id_fkey"
      columns: ["assignment_id"]
isOneToOne: false
      referencedRelation: "effective_weights_v"
      referencedColumns: ["assignment_id"]
    },{
      foreignKeyName: "class_program_pushes_version_id_fkey"
      columns: ["version_id"]
isOneToOne: false
      referencedRelation: "program_versions"
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
                },"library_programs": {
                  Row: {
                    "code": string,"created_at": string,"current_version_id": number | null,"id": number,"name": string,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"current_version_id"?: number | null,"id"?: never,"name": string,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"current_version_id"?: number | null,"id"?: never,"name"?: string,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "library_programs_current_version_fkey"
      columns: ["current_version_id"]
isOneToOne: false
      referencedRelation: "program_versions"
      referencedColumns: ["id"]
    }
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
                },"program_version_items": {
                  Row: {
                    "created_at": string,"exercise_id": number,"fallback_weight_kg": number | null,"id": number,"item_key": string,"notes": string | null,"position": number,"reps": string,"rest_seconds": number | null,"rm_percentage": number | null,"sets": number,"superset_group": number | null,"version_id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"exercise_id": number,"fallback_weight_kg"?: number | null,"id"?: never,"item_key": string,"notes"?: string | null,"position": number,"reps": string,"rest_seconds"?: number | null,"rm_percentage"?: number | null,"sets": number,"superset_group"?: number | null,"version_id": number
                  }
                  Update: {
                    "created_at"?: string,"exercise_id"?: number,"fallback_weight_kg"?: number | null,"id"?: never,"item_key"?: string,"notes"?: string | null,"position"?: number,"reps"?: string,"rest_seconds"?: number | null,"rm_percentage"?: number | null,"sets"?: number,"superset_group"?: number | null,"version_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "program_version_items_exercise_id_fkey"
      columns: ["exercise_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "program_version_items_version_id_fkey"
      columns: ["version_id"]
isOneToOne: false
      referencedRelation: "program_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"program_versions": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": number,"program_id": number,"version_no": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: never,"program_id": number,"version_no": number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: never,"program_id"?: number,"version_no"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "program_versions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "program_versions_program_id_fkey"
      columns: ["program_id"]
isOneToOne: false
      referencedRelation: "library_programs"
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
                    "assignment_id": number,"calculated_kg": number | null,"class_id": number,"client_id": number,"effective_kg": number | null,"exercise_id": number,"fallback_kg": number | null,"item_id": number,"item_key": string,"latest_1rm_kg": number | null,"latest_test_date": string | null,"order_index": number,"override_kg": number | null,"override_reason": string | null,"override_review_date": string | null,"reps": string,"rm_percentage": number | null,"sets": number,"superset_group": number | null,"weight_source": string | null
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
      foreignKeyName: "class_program_items_exercise_id_fkey"
      columns: ["exercise_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "add_class_item":
{ Args: { "p_assignment_id": number,"p_exercise_id": number,"p_reps"?: string,"p_rm_percentage"?: number,"p_sets"?: number }; Returns: number
                           },
"add_class_members":
{ Args: { "p_allow_over_capacity"?: boolean,"p_class_id": number,"p_client_ids": (number)[] }; Returns: undefined
                           },
"assign_program":
{ Args: { "p_class_id": number,"p_end_date"?: string,"p_program_id": number,"p_start_date": string }; Returns: number
                           },
"clear_class_superset":
{ Args: { "p_item_ids": (number)[] }; Returns: undefined
                           },
"create_program":
{ Args: { "p_name": string }; Returns: number
                           },
"duplicate_program":
{ Args: { "p_name": string,"p_program_id": number }; Returns: number
                           },
"effective_weights":
{ Args: { "p_class_id": number }; Returns: {
              "calculated_kg": number,"client_id": number,"effective_kg": number,"exercise_id": number,"fallback_kg": number,"item_id": number,"item_key": string,"latest_1rm_kg": number,"latest_test_date": string,"order_index": number,"override_kg": number,"override_reason": string,"override_review_date": string,"reps": string,"rm_percentage": number,"sets": number,"superset_group": number,"weight_source": string
            }[]
                           },
"effective_weights_for_client":
{ Args: { "p_client_id": number }; Returns: {
              "calculated_kg": number,"class_id": number,"effective_kg": number,"exercise_id": number,"fallback_kg": number,"item_id": number,"item_key": string,"latest_1rm_kg": number,"latest_test_date": string,"order_index": number,"override_kg": number,"override_reason": string,"override_review_date": string,"reps": string,"rm_percentage": number,"sets": number,"superset_group": number,"weight_source": string
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
"move_class_item":
{ Args: { "p_direction": string,"p_item_id": number }; Returns: undefined
                           },
"move_class_item_to":
{ Args: { "p_index": number,"p_item_id": number }; Returns: undefined
                           },
"move_client":
{ Args: { "p_allow_over_capacity"?: boolean,"p_client_id": number,"p_from_class": number,"p_to_class": number }; Returns: undefined
                           },
"move_clients":
{ Args: { "p_allow_over_capacity"?: boolean,"p_client_ids": (number)[],"p_from_class": number,"p_to_class": number }; Returns: undefined
                           },
"normalise_class_supersets":
{ Args: { "p_assignment_id": number }; Returns: undefined
                           },
"practice_today":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"purge_test_data":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"push_version_to_assignment":
{ Args: { "p_assignment_id": number,"p_version_id": number }; Returns: Json
                           },
"push_version_to_assignment_rows":
{ Args: { "p_assignment_id": number,"p_version_id": number }; Returns: Json
                           },
"record_authenticator_reset":
{ Args: { "p_staff_id": string }; Returns: undefined
                           },
"record_invite_link":
{ Args: { "p_staff_id": string }; Returns: undefined
                           },
"remove_class_item":
{ Args: { "p_item_id": number }; Returns: undefined
                           },
"reorder_program_exercises":
{ Args: { "p_ids": (number)[],"p_program_id": number }; Returns: undefined
                           },
"reset_class_item":
{ Args: { "p_item_id": number }; Returns: undefined
                           },
"reset_class_item_row":
{ Args: { "p_item_id": number }; Returns: undefined
                           },
"round_to_increment":
{ Args: { "p_increment": number,"p_kg": number }; Returns: number
                           },
"save_program_version":
{ Args: { "p_items": Json,"p_name": string,"p_program_id": number }; Returns: Json
                           },
"set_class_superset":
{ Args: { "p_item_ids": (number)[] }; Returns: undefined
                           },
"set_client_classes":
{ Args: { "p_allow_over_capacity"?: boolean,"p_class_ids": (number)[],"p_client_id": number }; Returns: undefined
                           },
"set_override":
{ Args: { "p_client_id": number,"p_exercise_id": number,"p_reason": string,"p_review_date"?: string,"p_weight_kg": number }; Returns: number
                           },
"set_program_archived":
{ Args: { "p_archived": boolean,"p_program_id": number }; Returns: undefined
                           },
"validate_supersets":
{ Args: { "p_version_id": number }; Returns: undefined
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
