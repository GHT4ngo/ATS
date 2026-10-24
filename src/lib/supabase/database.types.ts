
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
            "activity_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"entity": string,"entity_id": string,"id": number,"organization_id": string,"payload": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"entity": string,"entity_id": string,"id"?: never,"organization_id": string,"payload"?: NonNullable<Json>
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"entity"?: string,"entity_id"?: string,"id"?: never,"organization_id"?: string,"payload"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "activity_log_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activity_log_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"applications": {
                  Row: {
                    "candidate_id": string,"created_at": string,"id": string,"job_id": string,"organization_id": string,"position": number,"rating": number | null,"stage": Database["public"]['Enums']["application_stage"],"stage_changed_at": string,"stage_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "candidate_id": string,"created_at"?: string,"id"?: string,"job_id": string,"organization_id": string,"position"?: number,"rating"?: number | null,"stage"?: Database["public"]['Enums']["application_stage"],"stage_changed_at"?: string,"stage_id": string,"updated_at"?: string
                  }
                  Update: {
                    "candidate_id"?: string,"created_at"?: string,"id"?: string,"job_id"?: string,"organization_id"?: string,"position"?: number,"rating"?: number | null,"stage"?: Database["public"]['Enums']["application_stage"],"stage_changed_at"?: string,"stage_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "applications_candidate_id_organization_id_fkey"
      columns: ["candidate_id","organization_id"]
isOneToOne: false
      referencedRelation: "candidates"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "applications_job_id_organization_id_fkey"
      columns: ["job_id","organization_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "applications_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "applications_stage_in_job"
      columns: ["stage_id","job_id"]
isOneToOne: false
      referencedRelation: "job_stages"
      referencedColumns: ["id","job_id"]
    }
                  ]
                },"candidates": {
                  Row: {
                    "created_at": string,"created_by": string | null,"cv_path": string | null,"email": string | null,"full_name": string,"id": string,"linkedin_url": string | null,"location": string | null,"notes": string,"organization_id": string,"phone": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"cv_path"?: string | null,"email"?: string | null,"full_name": string,"id"?: string,"linkedin_url"?: string | null,"location"?: string | null,"notes"?: string,"organization_id": string,"phone"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"cv_path"?: string | null,"email"?: string | null,"full_name"?: string,"id"?: string,"linkedin_url"?: string | null,"location"?: string | null,"notes"?: string,"organization_id"?: string,"phone"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "candidates_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "candidates_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"cv_assessment_locks": {
                  Row: {
                    "candidate_id": string,"job_id": string,"locked_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "candidate_id": string,"job_id": string,"locked_at"?: string
                  }
                  Update: {
                    "candidate_id"?: string,"job_id"?: string,"locked_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cv_assessment_locks_candidate_id_fkey"
      columns: ["candidate_id"]
isOneToOne: false
      referencedRelation: "candidates"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cv_assessment_locks_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["id"]
    }
                  ]
                },"cv_assessments": {
                  Row: {
                    "candidate_id": string,"created_at": string,"created_by": string | null,"gaps": NonNullable<Json>,"id": string,"interview_questions": NonNullable<Json>,"job_id": string,"model": string,"organization_id": string,"score": number,"skill_matches": NonNullable<Json>,"strengths": NonNullable<Json>,"summary": string
                  }
                  ComputedFields: never
                  Insert: {
                    "candidate_id": string,"created_at"?: string,"created_by"?: string | null,"gaps"?: NonNullable<Json>,"id"?: string,"interview_questions"?: NonNullable<Json>,"job_id": string,"model": string,"organization_id": string,"score": number,"skill_matches"?: NonNullable<Json>,"strengths"?: NonNullable<Json>,"summary": string
                  }
                  Update: {
                    "candidate_id"?: string,"created_at"?: string,"created_by"?: string | null,"gaps"?: NonNullable<Json>,"id"?: string,"interview_questions"?: NonNullable<Json>,"job_id"?: string,"model"?: string,"organization_id"?: string,"score"?: number,"skill_matches"?: NonNullable<Json>,"strengths"?: NonNullable<Json>,"summary"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cv_assessments_candidate_id_organization_id_fkey"
      columns: ["candidate_id","organization_id"]
isOneToOne: false
      referencedRelation: "candidates"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "cv_assessments_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cv_assessments_job_id_organization_id_fkey"
      columns: ["job_id","organization_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "cv_assessments_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"job_stages": {
                  Row: {
                    "created_at": string,"id": string,"job_id": string,"name": string | null,"organization_id": string,"phase": Database["public"]['Enums']["application_stage"],"position": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"job_id": string,"name"?: string | null,"organization_id": string,"phase": Database["public"]['Enums']["application_stage"],"position"?: number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"job_id"?: string,"name"?: string | null,"organization_id"?: string,"phase"?: Database["public"]['Enums']["application_stage"],"position"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "job_stages_job_id_organization_id_fkey"
      columns: ["job_id","organization_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "job_stages_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"jobs": {
                  Row: {
                    "created_at": string,"created_by": string | null,"description": string,"employment_type": Database["public"]['Enums']["employment_type"],"id": string,"location": string,"organization_id": string,"status": Database["public"]['Enums']["job_status"],"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"description"?: string,"employment_type"?: Database["public"]['Enums']["employment_type"],"id"?: string,"location"?: string,"organization_id": string,"status"?: Database["public"]['Enums']["job_status"],"title": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"description"?: string,"employment_type"?: Database["public"]['Enums']["employment_type"],"id"?: string,"location"?: string,"organization_id"?: string,"status"?: Database["public"]['Enums']["job_status"],"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "jobs_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "jobs_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"organizations": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"slug": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"slug": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"slug"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"email": string | null,"full_name": string,"id": string,"is_active": boolean,"locale": string,"organization_id": string | null,"role": Database["public"]['Enums']["user_role"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email"?: string | null,"full_name"?: string,"id": string,"is_active"?: boolean,"locale"?: string,"organization_id"?: string | null,"role"?: Database["public"]['Enums']["user_role"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string | null,"full_name"?: string,"id"?: string,"is_active"?: boolean,"locale"?: string,"organization_id"?: string | null,"role"?: Database["public"]['Enums']["user_role"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "latest_cv_assessments": {
                  Row: {
                    "candidate_id": string | null,"created_at": string | null,"created_by": string | null,"gaps": Json | null,"id": string | null,"interview_questions": Json | null,"job_id": string | null,"model": string | null,"organization_id": string | null,"score": number | null,"skill_matches": Json | null,"strengths": Json | null,"summary": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "cv_assessments_candidate_id_organization_id_fkey"
      columns: ["candidate_id","organization_id"]
isOneToOne: false
      referencedRelation: "candidates"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "cv_assessments_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cv_assessments_job_id_organization_id_fkey"
      columns: ["job_id","organization_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "cv_assessments_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "claim_cv_assessment":
{ Args: { "p_candidate": string,"p_job": string,"p_stale_seconds": number }; Returns: boolean
                           },
"current_org_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"reorder_job_stage":
{ Args: { "p_direction": string,"p_stage": string }; Returns: undefined
                           }
          }
          Enums: {
            "application_stage": "applied"|"screening"|"interview"|"offer"|"hired"|"rejected","employment_type": "full_time"|"part_time"|"contract"|"internship","job_status": "open"|"paused"|"closed","user_role": "admin"|"customer"
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
            "application_stage": ["applied", "screening", "interview", "offer", "hired", "rejected"],"employment_type": ["full_time", "part_time", "contract", "internship"],"job_status": ["open", "paused", "closed"],"user_role": ["admin", "customer"]
          }
        }
} as const
