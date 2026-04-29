export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      action_plan_history: {
        Row: {
          action_plan_id: string
          changed_at: string
          changed_by: string
          field_changed: string
          id: string
          new_value: string | null
          notes: string | null
          old_value: string | null
        }
        Insert: {
          action_plan_id: string
          changed_at?: string
          changed_by: string
          field_changed: string
          id?: string
          new_value?: string | null
          notes?: string | null
          old_value?: string | null
        }
        Update: {
          action_plan_id?: string
          changed_at?: string
          changed_by?: string
          field_changed?: string
          id?: string
          new_value?: string | null
          notes?: string | null
          old_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "action_plan_history_action_plan_id_fkey"
            columns: ["action_plan_id"]
            isOneToOne: false
            referencedRelation: "action_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      action_plans: {
        Row: {
          acao_corretiva: string | null
          analise_critica: string | null
          area: string | null
          arquivo_url: string | null
          category: string
          causa_raiz: string | null
          created_at: string
          created_by: string
          facility_unit: string
          id: string
          notes: string | null
          prazo: string | null
          prioridade: Database["public"]["Enums"]["action_priority"]
          reference_id: string | null
          reference_name: string
          responsavel: string | null
          risco_financeiro: number | null
          status_acao: Database["public"]["Enums"]["action_status"]
          status_evidencia: Database["public"]["Enums"]["evidence_status"]
          tipo_evidencia: string | null
          tipo_problema: Database["public"]["Enums"]["problem_type"]
          updated_at: string
        }
        Insert: {
          acao_corretiva?: string | null
          analise_critica?: string | null
          area?: string | null
          arquivo_url?: string | null
          category?: string
          causa_raiz?: string | null
          created_at?: string
          created_by: string
          facility_unit: string
          id?: string
          notes?: string | null
          prazo?: string | null
          prioridade?: Database["public"]["Enums"]["action_priority"]
          reference_id?: string | null
          reference_name: string
          responsavel?: string | null
          risco_financeiro?: number | null
          status_acao?: Database["public"]["Enums"]["action_status"]
          status_evidencia?: Database["public"]["Enums"]["evidence_status"]
          tipo_evidencia?: string | null
          tipo_problema?: Database["public"]["Enums"]["problem_type"]
          updated_at?: string
        }
        Update: {
          acao_corretiva?: string | null
          analise_critica?: string | null
          area?: string | null
          arquivo_url?: string | null
          category?: string
          causa_raiz?: string | null
          created_at?: string
          created_by?: string
          facility_unit?: string
          id?: string
          notes?: string | null
          prazo?: string | null
          prioridade?: Database["public"]["Enums"]["action_priority"]
          reference_id?: string | null
          reference_name?: string
          responsavel?: string | null
          risco_financeiro?: number | null
          status_acao?: Database["public"]["Enums"]["action_status"]
          status_evidencia?: Database["public"]["Enums"]["evidence_status"]
          tipo_evidencia?: string | null
          tipo_problema?: Database["public"]["Enums"]["problem_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_plans_reference_id_fkey"
            columns: ["reference_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      bed_movements: {
        Row: {
          admissions: number
          category: string
          created_at: string
          deaths: number
          discharges: number
          facility_unit: string
          id: string
          movement_date: string
          notes: string | null
          occupied: number
          specialty: string
          transfers: number
          user_id: string
        }
        Insert: {
          admissions?: number
          category?: string
          created_at?: string
          deaths?: number
          discharges?: number
          facility_unit: string
          id?: string
          movement_date: string
          notes?: string | null
          occupied?: number
          specialty: string
          transfers?: number
          user_id: string
        }
        Update: {
          admissions?: number
          category?: string
          created_at?: string
          deaths?: number
          discharges?: number
          facility_unit?: string
          id?: string
          movement_date?: string
          notes?: string | null
          occupied?: number
          specialty?: string
          transfers?: number
          user_id?: string
        }
        Relationships: []
      }
      beds: {
        Row: {
          category: string
          created_at: string
          facility_unit: string
          id: string
          quantity: number
          specialty: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          facility_unit: string
          id?: string
          quantity?: number
          specialty: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          facility_unit?: string
          id?: string
          quantity?: number
          specialty?: string
          updated_at?: string
        }
        Relationships: []
      }
      contracts: {
        Row: {
          created_at: string
          goals: number
          id: string
          name: string
          notification_email: string | null
          pdf_name: string | null
          pdf_url: string | null
          period: string
          rubricas: Json
          status: string
          unit: string
          updated_at: string
          value: number
          variable: number
        }
        Insert: {
          created_at?: string
          goals?: number
          id?: string
          name: string
          notification_email?: string | null
          pdf_name?: string | null
          pdf_url?: string | null
          period?: string
          rubricas?: Json
          status?: string
          unit: string
          updated_at?: string
          value?: number
          variable?: number
        }
        Update: {
          created_at?: string
          goals?: number
          id?: string
          name?: string
          notification_email?: string | null
          pdf_name?: string | null
          pdf_url?: string | null
          period?: string
          rubricas?: Json
          status?: string
          unit?: string
          updated_at?: string
          value?: number
          variable?: number
        }
        Relationships: []
      }
      goal_entries: {
        Row: {
          created_at: string
          goal_id: string
          id: string
          notes: string | null
          period: string
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          goal_id: string
          id?: string
          notes?: string | null
          period: string
          user_id: string
          value: number
        }
        Update: {
          created_at?: string
          goal_id?: string
          id?: string
          notes?: string | null
          period?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "goal_entries_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          created_at: string
          end_date: string | null
          facility_unit: Database["public"]["Enums"]["facility_unit"]
          id: string
          name: string
          risk: number
          scoring: Json
          sector: string | null
          start_date: string | null
          target: number
          type: string
          unit: string
          updated_at: string
          weight: number
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          facility_unit: Database["public"]["Enums"]["facility_unit"]
          id?: string
          name: string
          risk?: number
          scoring?: Json
          sector?: string | null
          start_date?: string | null
          target: number
          type?: string
          unit?: string
          updated_at?: string
          weight?: number
        }
        Update: {
          created_at?: string
          end_date?: string | null
          facility_unit?: Database["public"]["Enums"]["facility_unit"]
          id?: string
          name?: string
          risk?: number
          scoring?: Json
          sector?: string | null
          start_date?: string | null
          target?: number
          type?: string
          unit?: string
          updated_at?: string
          weight?: number
        }
        Relationships: []
      }
      opme_attachments: {
        Row: {
          category: string
          created_at: string
          description: string | null
          file_name: string
          file_size: number | null
          file_type: string
          file_url: string
          id: string
          is_required: boolean
          opme_request_id: string
          stage: string
          uploaded_by: string
          uploaded_by_name: string | null
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string
          file_url: string
          id?: string
          is_required?: boolean
          opme_request_id: string
          stage: string
          uploaded_by: string
          uploaded_by_name?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string
          file_url?: string
          id?: string
          is_required?: boolean
          opme_request_id?: string
          stage?: string
          uploaded_by?: string
          uploaded_by_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opme_attachments_opme_request_id_fkey"
            columns: ["opme_request_id"]
            isOneToOne: false
            referencedRelation: "opme_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      opme_history: {
        Row: {
          action: string
          changed_at: string
          changed_by: string
          changed_by_name: string | null
          field_changed: string | null
          id: string
          new_value: string | null
          old_value: string | null
          opme_request_id: string
          reason: string | null
          signature_name: string | null
          signature_register: string | null
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by: string
          changed_by_name?: string | null
          field_changed?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          opme_request_id: string
          reason?: string | null
          signature_name?: string | null
          signature_register?: string | null
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string
          changed_by_name?: string | null
          field_changed?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          opme_request_id?: string
          reason?: string | null
          signature_name?: string | null
          signature_register?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opme_history_opme_request_id_fkey"
            columns: ["opme_request_id"]
            isOneToOne: false
            referencedRelation: "opme_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      opme_requests: {
        Row: {
          auditor_post_crm: string | null
          auditor_post_date: string | null
          auditor_post_final_opinion: string | null
          auditor_post_image_conformity: string | null
          auditor_post_name: string | null
          auditor_post_procedure_compat: string | null
          auditor_post_sigtap_compat: string | null
          auditor_pre_analysis: string | null
          auditor_pre_crm: string | null
          auditor_pre_date: string | null
          auditor_pre_name: string | null
          auditor_pre_opinion: string | null
          auditor_pre_sigtap_compat: string | null
          billing_aih_generated: boolean | null
          billing_aih_number: string | null
          billing_divergence: boolean | null
          billing_divergence_description: string | null
          billing_docs: Json
          billing_opme_compatibility: string | null
          billing_prior_authorization: string | null
          billing_procedure_name: string | null
          billing_sigtap_code: string | null
          clinical_indication: string | null
          cme_processing_date: string | null
          cme_responsible: string | null
          committee_opinion: string | null
          created_at: string
          created_by: string
          facility_unit: string
          id: string
          incident_date: string | null
          incident_description: string | null
          incident_responsible: string | null
          instruments_loan: boolean | null
          instruments_na: boolean | null
          instruments_specific: boolean | null
          instruments_specify: string | null
          notes: string | null
          opme_requested: Json
          opme_returned: Json
          opme_used: Json
          patient_birthdate: string | null
          patient_mother_name: string | null
          patient_name: string
          patient_record: string | null
          patient_sus: string | null
          postop_exam_date: string | null
          postop_exam_number: string | null
          postop_image_attached: boolean | null
          postop_image_count: number | null
          postop_image_other: string | null
          postop_image_types: string[] | null
          postop_result_description: string | null
          postop_validation_responsible: string | null
          preop_exam_date: string | null
          preop_exam_number: string | null
          preop_finding_description: string | null
          preop_image_attached: boolean | null
          preop_image_count: number | null
          preop_image_other: string | null
          preop_image_types: string[] | null
          preop_validation_responsible: string | null
          procedure_date: string | null
          procedure_name: string | null
          procedure_room: string | null
          procedure_sigtap_code: string | null
          procedure_type: string | null
          request_date: string | null
          request_time: string | null
          requester_name: string | null
          requester_register: string | null
          sent_to_cme: boolean | null
          status: Database["public"]["Enums"]["opme_status"]
          stock_available: string | null
          surgery_dispatch_date: string | null
          surgery_dispatch_responsible: string | null
          updated_at: string
          warehouse_date: string | null
          warehouse_received_by: string | null
          warehouse_time: string | null
        }
        Insert: {
          auditor_post_crm?: string | null
          auditor_post_date?: string | null
          auditor_post_final_opinion?: string | null
          auditor_post_image_conformity?: string | null
          auditor_post_name?: string | null
          auditor_post_procedure_compat?: string | null
          auditor_post_sigtap_compat?: string | null
          auditor_pre_analysis?: string | null
          auditor_pre_crm?: string | null
          auditor_pre_date?: string | null
          auditor_pre_name?: string | null
          auditor_pre_opinion?: string | null
          auditor_pre_sigtap_compat?: string | null
          billing_aih_generated?: boolean | null
          billing_aih_number?: string | null
          billing_divergence?: boolean | null
          billing_divergence_description?: string | null
          billing_docs?: Json
          billing_opme_compatibility?: string | null
          billing_prior_authorization?: string | null
          billing_procedure_name?: string | null
          billing_sigtap_code?: string | null
          clinical_indication?: string | null
          cme_processing_date?: string | null
          cme_responsible?: string | null
          committee_opinion?: string | null
          created_at?: string
          created_by: string
          facility_unit: string
          id?: string
          incident_date?: string | null
          incident_description?: string | null
          incident_responsible?: string | null
          instruments_loan?: boolean | null
          instruments_na?: boolean | null
          instruments_specific?: boolean | null
          instruments_specify?: string | null
          notes?: string | null
          opme_requested?: Json
          opme_returned?: Json
          opme_used?: Json
          patient_birthdate?: string | null
          patient_mother_name?: string | null
          patient_name?: string
          patient_record?: string | null
          patient_sus?: string | null
          postop_exam_date?: string | null
          postop_exam_number?: string | null
          postop_image_attached?: boolean | null
          postop_image_count?: number | null
          postop_image_other?: string | null
          postop_image_types?: string[] | null
          postop_result_description?: string | null
          postop_validation_responsible?: string | null
          preop_exam_date?: string | null
          preop_exam_number?: string | null
          preop_finding_description?: string | null
          preop_image_attached?: boolean | null
          preop_image_count?: number | null
          preop_image_other?: string | null
          preop_image_types?: string[] | null
          preop_validation_responsible?: string | null
          procedure_date?: string | null
          procedure_name?: string | null
          procedure_room?: string | null
          procedure_sigtap_code?: string | null
          procedure_type?: string | null
          request_date?: string | null
          request_time?: string | null
          requester_name?: string | null
          requester_register?: string | null
          sent_to_cme?: boolean | null
          status?: Database["public"]["Enums"]["opme_status"]
          stock_available?: string | null
          surgery_dispatch_date?: string | null
          surgery_dispatch_responsible?: string | null
          updated_at?: string
          warehouse_date?: string | null
          warehouse_received_by?: string | null
          warehouse_time?: string | null
        }
        Update: {
          auditor_post_crm?: string | null
          auditor_post_date?: string | null
          auditor_post_final_opinion?: string | null
          auditor_post_image_conformity?: string | null
          auditor_post_name?: string | null
          auditor_post_procedure_compat?: string | null
          auditor_post_sigtap_compat?: string | null
          auditor_pre_analysis?: string | null
          auditor_pre_crm?: string | null
          auditor_pre_date?: string | null
          auditor_pre_name?: string | null
          auditor_pre_opinion?: string | null
          auditor_pre_sigtap_compat?: string | null
          billing_aih_generated?: boolean | null
          billing_aih_number?: string | null
          billing_divergence?: boolean | null
          billing_divergence_description?: string | null
          billing_docs?: Json
          billing_opme_compatibility?: string | null
          billing_prior_authorization?: string | null
          billing_procedure_name?: string | null
          billing_sigtap_code?: string | null
          clinical_indication?: string | null
          cme_processing_date?: string | null
          cme_responsible?: string | null
          committee_opinion?: string | null
          created_at?: string
          created_by?: string
          facility_unit?: string
          id?: string
          incident_date?: string | null
          incident_description?: string | null
          incident_responsible?: string | null
          instruments_loan?: boolean | null
          instruments_na?: boolean | null
          instruments_specific?: boolean | null
          instruments_specify?: string | null
          notes?: string | null
          opme_requested?: Json
          opme_returned?: Json
          opme_used?: Json
          patient_birthdate?: string | null
          patient_mother_name?: string | null
          patient_name?: string
          patient_record?: string | null
          patient_sus?: string | null
          postop_exam_date?: string | null
          postop_exam_number?: string | null
          postop_image_attached?: boolean | null
          postop_image_count?: number | null
          postop_image_other?: string | null
          postop_image_types?: string[] | null
          postop_result_description?: string | null
          postop_validation_responsible?: string | null
          preop_exam_date?: string | null
          preop_exam_number?: string | null
          preop_finding_description?: string | null
          preop_image_attached?: boolean | null
          preop_image_count?: number | null
          preop_image_other?: string | null
          preop_image_types?: string[] | null
          preop_validation_responsible?: string | null
          procedure_date?: string | null
          procedure_name?: string | null
          procedure_room?: string | null
          procedure_sigtap_code?: string | null
          procedure_type?: string | null
          request_date?: string | null
          request_time?: string | null
          requester_name?: string | null
          requester_register?: string | null
          sent_to_cme?: boolean | null
          status?: Database["public"]["Enums"]["opme_status"]
          stock_available?: string | null
          surgery_dispatch_date?: string | null
          surgery_dispatch_responsible?: string | null
          updated_at?: string
          warehouse_date?: string | null
          warehouse_received_by?: string | null
          warehouse_time?: string | null
        }
        Relationships: []
      }
      price_history: {
        Row: {
          categoria: string | null
          created_at: string
          created_by: string | null
          data_referencia: string
          descricao_produto: string
          fonte: string
          fonte_url: string | null
          fornecedor_cnpj: string | null
          fornecedor_nome: string | null
          id: string
          quotation_id: string | null
          supplier_id: string | null
          unidade_medida: string | null
          valor_unitario: number
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          created_by?: string | null
          data_referencia?: string
          descricao_produto: string
          fonte?: string
          fonte_url?: string | null
          fornecedor_cnpj?: string | null
          fornecedor_nome?: string | null
          id?: string
          quotation_id?: string | null
          supplier_id?: string | null
          unidade_medida?: string | null
          valor_unitario: number
        }
        Update: {
          categoria?: string | null
          created_at?: string
          created_by?: string | null
          data_referencia?: string
          descricao_produto?: string
          fonte?: string
          fonte_url?: string | null
          fornecedor_cnpj?: string | null
          fornecedor_nome?: string | null
          id?: string
          quotation_id?: string | null
          supplier_id?: string | null
          unidade_medida?: string | null
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "price_history_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "purchase_quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      product_catalog: {
        Row: {
          ativo: boolean
          classificacao: string
          codigo: string
          created_at: string
          created_by: string | null
          descricao: string
          facility_unit: string | null
          id: string
          image_url: string | null
          setor: string | null
          tipo: string
          unidade_medida: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          classificacao?: string
          codigo: string
          created_at?: string
          created_by?: string | null
          descricao: string
          facility_unit?: string | null
          id?: string
          image_url?: string | null
          setor?: string | null
          tipo?: string
          unidade_medida?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          classificacao?: string
          codigo?: string
          created_at?: string
          created_by?: string | null
          descricao?: string
          facility_unit?: string | null
          id?: string
          image_url?: string | null
          setor?: string | null
          tipo?: string
          unidade_medida?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          allowed_cards: string[] | null
          avatar_url: string | null
          cargo: string | null
          created_at: string
          facility_unit: Database["public"]["Enums"]["facility_unit"]
          id: string
          name: string
          supervisor_id: string | null
          updated_at: string
        }
        Insert: {
          allowed_cards?: string[] | null
          avatar_url?: string | null
          cargo?: string | null
          created_at?: string
          facility_unit: Database["public"]["Enums"]["facility_unit"]
          id: string
          name: string
          supervisor_id?: string | null
          updated_at?: string
        }
        Update: {
          allowed_cards?: string[] | null
          avatar_url?: string | null
          cargo?: string | null
          created_at?: string
          facility_unit?: Database["public"]["Enums"]["facility_unit"]
          id?: string
          name?: string
          supervisor_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_audit_log: {
        Row: {
          action: string
          changed_at: string
          changed_by: string
          changed_by_name: string | null
          entity_id: string
          entity_type: string
          field_changed: string | null
          id: string
          motivo: string | null
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by: string
          changed_by_name?: string | null
          entity_id: string
          entity_type: string
          field_changed?: string | null
          id?: string
          motivo?: string | null
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string
          changed_by_name?: string | null
          entity_id?: string
          entity_type?: string
          field_changed?: string | null
          id?: string
          motivo?: string | null
          new_value?: string | null
          old_value?: string | null
        }
        Relationships: []
      }
      purchase_order_approvals: {
        Row: {
          approver_cargo: string | null
          approver_email: string | null
          approver_ip: string | null
          approver_name: string | null
          ciencia_lgpd: boolean
          created_at: string
          created_by: string
          decision: string | null
          expires_at: string
          id: string
          motivo_recusa: string | null
          purchase_order_id: string
          signed_at: string | null
          token: string
        }
        Insert: {
          approver_cargo?: string | null
          approver_email?: string | null
          approver_ip?: string | null
          approver_name?: string | null
          ciencia_lgpd?: boolean
          created_at?: string
          created_by: string
          decision?: string | null
          expires_at?: string
          id?: string
          motivo_recusa?: string | null
          purchase_order_id: string
          signed_at?: string | null
          token?: string
        }
        Update: {
          approver_cargo?: string | null
          approver_email?: string | null
          approver_ip?: string | null
          approver_name?: string | null
          ciencia_lgpd?: boolean
          created_at?: string
          created_by?: string
          decision?: string | null
          expires_at?: string
          id?: string
          motivo_recusa?: string | null
          purchase_order_id?: string
          signed_at?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_approvals_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          created_at: string
          descricao: string
          id: string
          item_num: number
          purchase_order_id: string
          quantidade: number
          unidade_medida: string
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          created_at?: string
          descricao: string
          id?: string
          item_num?: number
          purchase_order_id: string
          quantidade?: number
          unidade_medida?: string
          valor_total?: number
          valor_unitario?: number
        }
        Update: {
          created_at?: string
          descricao?: string
          id?: string
          item_num?: number
          purchase_order_id?: string
          quantidade?: number
          unidade_medida?: string
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          cargo: string | null
          cnpj_emissao_nf: string | null
          contract_id: string | null
          created_at: string
          created_by: string
          data_envio_fornecedor: string | null
          data_envio_setor: string | null
          endereco_entrega: string | null
          facility_unit: string
          fornecedor_cnpj: string | null
          fornecedor_nome: string
          id: string
          motivo_negacao: string | null
          numero: string
          observacoes: string | null
          prazo_entrega: string | null
          quotation_id: string | null
          requisition_id: string | null
          responsavel_emissao_nome: string | null
          rubrica_id: string | null
          rubrica_name: string | null
          status: Database["public"]["Enums"]["purchase_order_status"]
          texto_obrigatorio_nf: string | null
          updated_at: string
          valor_total: number
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          cargo?: string | null
          cnpj_emissao_nf?: string | null
          contract_id?: string | null
          created_at?: string
          created_by: string
          data_envio_fornecedor?: string | null
          data_envio_setor?: string | null
          endereco_entrega?: string | null
          facility_unit: string
          fornecedor_cnpj?: string | null
          fornecedor_nome: string
          id?: string
          motivo_negacao?: string | null
          numero: string
          observacoes?: string | null
          prazo_entrega?: string | null
          quotation_id?: string | null
          requisition_id?: string | null
          responsavel_emissao_nome?: string | null
          rubrica_id?: string | null
          rubrica_name?: string | null
          status?: Database["public"]["Enums"]["purchase_order_status"]
          texto_obrigatorio_nf?: string | null
          updated_at?: string
          valor_total?: number
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          cargo?: string | null
          cnpj_emissao_nf?: string | null
          contract_id?: string | null
          created_at?: string
          created_by?: string
          data_envio_fornecedor?: string | null
          data_envio_setor?: string | null
          endereco_entrega?: string | null
          facility_unit?: string
          fornecedor_cnpj?: string | null
          fornecedor_nome?: string
          id?: string
          motivo_negacao?: string | null
          numero?: string
          observacoes?: string | null
          prazo_entrega?: string | null
          quotation_id?: string | null
          requisition_id?: string | null
          responsavel_emissao_nome?: string | null
          rubrica_id?: string | null
          rubrica_name?: string | null
          status?: Database["public"]["Enums"]["purchase_order_status"]
          texto_obrigatorio_nf?: string | null
          updated_at?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "purchase_quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_requisition_id_fkey"
            columns: ["requisition_id"]
            isOneToOne: false
            referencedRelation: "purchase_requisitions"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_quotation_prices: {
        Row: {
          created_at: string
          id: string
          is_winner: boolean
          quotation_id: string
          requisition_item_id: string
          supplier_id: string
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_winner?: boolean
          quotation_id: string
          requisition_item_id: string
          supplier_id: string
          valor_total?: number
          valor_unitario?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_winner?: boolean
          quotation_id?: string
          requisition_item_id?: string
          supplier_id?: string
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_quotation_prices_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "purchase_quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_quotation_prices_requisition_item_id_fkey"
            columns: ["requisition_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_requisition_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_quotation_prices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "purchase_quotation_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_quotation_suppliers: {
        Row: {
          condicao_pagamento: string | null
          created_at: string
          fonte: string
          fornecedor_cnpj: string | null
          fornecedor_nome: string
          id: string
          prazo_entrega: string | null
          quotation_id: string
          slot: string
          submission_ip: string | null
          total: number | null
        }
        Insert: {
          condicao_pagamento?: string | null
          created_at?: string
          fonte?: string
          fornecedor_cnpj?: string | null
          fornecedor_nome: string
          id?: string
          prazo_entrega?: string | null
          quotation_id: string
          slot?: string
          submission_ip?: string | null
          total?: number | null
        }
        Update: {
          condicao_pagamento?: string | null
          created_at?: string
          fonte?: string
          fornecedor_cnpj?: string | null
          fornecedor_nome?: string
          id?: string
          prazo_entrega?: string | null
          quotation_id?: string
          slot?: string
          submission_ip?: string | null
          total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_quotation_suppliers_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "purchase_quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_quotations: {
        Row: {
          created_at: string
          created_by: string
          data_cotacao: string
          facility_unit: string
          id: string
          numero: string
          observacoes: string | null
          requisition_id: string
          setor_comprador: string | null
          status: Database["public"]["Enums"]["purchase_quotation_status"]
          total_winner: number | null
          updated_at: string
          winner_supplier: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          data_cotacao?: string
          facility_unit: string
          id?: string
          numero: string
          observacoes?: string | null
          requisition_id: string
          setor_comprador?: string | null
          status?: Database["public"]["Enums"]["purchase_quotation_status"]
          total_winner?: number | null
          updated_at?: string
          winner_supplier?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          data_cotacao?: string
          facility_unit?: string
          id?: string
          numero?: string
          observacoes?: string | null
          requisition_id?: string
          setor_comprador?: string | null
          status?: Database["public"]["Enums"]["purchase_quotation_status"]
          total_winner?: number | null
          updated_at?: string
          winner_supplier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_quotations_requisition_id_fkey"
            columns: ["requisition_id"]
            isOneToOne: false
            referencedRelation: "purchase_requisitions"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_requisition_items: {
        Row: {
          created_at: string
          descricao: string
          id: string
          item_num: number
          observacao: string | null
          product_id: string | null
          quantidade: number
          requisition_id: string
          unidade_medida: string
        }
        Insert: {
          created_at?: string
          descricao: string
          id?: string
          item_num?: number
          observacao?: string | null
          product_id?: string | null
          quantidade?: number
          requisition_id: string
          unidade_medida?: string
        }
        Update: {
          created_at?: string
          descricao?: string
          id?: string
          item_num?: number
          observacao?: string | null
          product_id?: string | null
          quantidade?: number
          requisition_id?: string
          unidade_medida?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_requisition_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requisition_items_requisition_id_fkey"
            columns: ["requisition_id"]
            isOneToOne: false
            referencedRelation: "purchase_requisitions"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_requisitions: {
        Row: {
          aprovador_diretoria_nome: string | null
          aprovador_imediato_nome: string | null
          classificacao: string[]
          created_at: string
          created_by: string
          data_requisicao: string
          facility_unit: string
          id: string
          justificativa_tipo: string
          municipio: string | null
          numero: string
          observacoes: string | null
          setor: string | null
          solicitante_id: string | null
          solicitante_nome: string | null
          status: Database["public"]["Enums"]["purchase_requisition_status"]
          updated_at: string
        }
        Insert: {
          aprovador_diretoria_nome?: string | null
          aprovador_imediato_nome?: string | null
          classificacao?: string[]
          created_at?: string
          created_by: string
          data_requisicao?: string
          facility_unit: string
          id?: string
          justificativa_tipo?: string
          municipio?: string | null
          numero: string
          observacoes?: string | null
          setor?: string | null
          solicitante_id?: string | null
          solicitante_nome?: string | null
          status?: Database["public"]["Enums"]["purchase_requisition_status"]
          updated_at?: string
        }
        Update: {
          aprovador_diretoria_nome?: string | null
          aprovador_imediato_nome?: string | null
          classificacao?: string[]
          created_at?: string
          created_by?: string
          data_requisicao?: string
          facility_unit?: string
          id?: string
          justificativa_tipo?: string
          municipio?: string | null
          numero?: string
          observacoes?: string | null
          setor?: string | null
          solicitante_id?: string | null
          solicitante_nome?: string | null
          status?: Database["public"]["Enums"]["purchase_requisition_status"]
          updated_at?: string
        }
        Relationships: []
      }
      quotation_invite_responses: {
        Row: {
          created_at: string
          disponivel: boolean
          id: string
          invite_id: string
          observacao: string | null
          requisition_item_id: string
          valor_unitario: number
        }
        Insert: {
          created_at?: string
          disponivel?: boolean
          id?: string
          invite_id: string
          observacao?: string | null
          requisition_item_id: string
          valor_unitario?: number
        }
        Update: {
          created_at?: string
          disponivel?: boolean
          id?: string
          invite_id?: string
          observacao?: string | null
          requisition_item_id?: string
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotation_invite_responses_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "quotation_invites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_invite_responses_requisition_item_id_fkey"
            columns: ["requisition_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_requisition_items"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_invites: {
        Row: {
          condicao_pagamento: string | null
          created_at: string
          created_by: string
          expires_at: string
          fornecedor_cnpj: string | null
          fornecedor_email: string | null
          fornecedor_nome: string
          fornecedor_telefone: string | null
          id: string
          observacoes: string | null
          prazo_entrega: string | null
          requisition_id: string
          responder_cpf: string | null
          responder_email: string | null
          responder_name: string | null
          responder_phone: string | null
          status: string
          submission_ip: string | null
          submitted_at: string | null
          token: string
          updated_at: string
        }
        Insert: {
          condicao_pagamento?: string | null
          created_at?: string
          created_by: string
          expires_at?: string
          fornecedor_cnpj?: string | null
          fornecedor_email?: string | null
          fornecedor_nome: string
          fornecedor_telefone?: string | null
          id?: string
          observacoes?: string | null
          prazo_entrega?: string | null
          requisition_id: string
          responder_cpf?: string | null
          responder_email?: string | null
          responder_name?: string | null
          responder_phone?: string | null
          status?: string
          submission_ip?: string | null
          submitted_at?: string | null
          token?: string
          updated_at?: string
        }
        Update: {
          condicao_pagamento?: string | null
          created_at?: string
          created_by?: string
          expires_at?: string
          fornecedor_cnpj?: string | null
          fornecedor_email?: string | null
          fornecedor_nome?: string
          fornecedor_telefone?: string | null
          id?: string
          observacoes?: string | null
          prazo_entrega?: string | null
          requisition_id?: string
          responder_cpf?: string | null
          responder_email?: string | null
          responder_name?: string | null
          responder_phone?: string | null
          status?: string
          submission_ip?: string | null
          submitted_at?: string | null
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotation_invites_requisition_id_fkey"
            columns: ["requisition_id"]
            isOneToOne: false
            referencedRelation: "purchase_requisitions"
            referencedColumns: ["id"]
          },
        ]
      }
      report_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_type: string
          file_url: string
          id: string
          report_id: string | null
          section_id: string
          sort_order: number
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_type?: string
          file_url: string
          id?: string
          report_id?: string | null
          section_id: string
          sort_order?: number
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_type?: string
          file_url?: string
          id?: string
          report_id?: string | null
          section_id?: string
          sort_order?: number
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_attachments_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_attachments_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "report_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      report_section_entries: {
        Row: {
          created_at: string
          created_by: string
          entry_json: Json
          entry_type: string
          id: string
          report_id: string | null
          section_id: string | null
          updated_at: string
          updated_by: string
        }
        Insert: {
          created_at?: string
          created_by: string
          entry_json?: Json
          entry_type?: string
          id?: string
          report_id?: string | null
          section_id?: string | null
          updated_at?: string
          updated_by: string
        }
        Update: {
          created_at?: string
          created_by?: string
          entry_json?: Json
          entry_type?: string
          id?: string
          report_id?: string | null
          section_id?: string | null
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_section_entries_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_section_entries_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "report_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      report_sections: {
        Row: {
          auto_snapshot_json: Json | null
          completion_status: string
          content: string
          contract_id: string
          created_at: string
          facility_unit: string
          id: string
          manual_content: string
          period: string
          report_id: string | null
          section_key: string
          section_title: string
          sort_order: number
          updated_at: string
          updated_by: string
        }
        Insert: {
          auto_snapshot_json?: Json | null
          completion_status?: string
          content?: string
          contract_id: string
          created_at?: string
          facility_unit: string
          id?: string
          manual_content?: string
          period?: string
          report_id?: string | null
          section_key: string
          section_title: string
          sort_order?: number
          updated_at?: string
          updated_by: string
        }
        Update: {
          auto_snapshot_json?: Json | null
          completion_status?: string
          content?: string
          contract_id?: string
          created_at?: string
          facility_unit?: string
          id?: string
          manual_content?: string
          period?: string
          report_id?: string | null
          section_key?: string
          section_title?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_sections_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_sections_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_templates: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          source_report_id: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          source_report_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          source_report_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_templates_source_report_id_fkey"
            columns: ["source_report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          contract_id: string
          cover_config: Json | null
          created_at: string
          created_by: string
          facility_unit: string
          id: string
          reference_month: number
          reference_year: number
          status: Database["public"]["Enums"]["report_status"]
          title: string
          updated_at: string
          updated_by: string
          version: number
        }
        Insert: {
          contract_id: string
          cover_config?: Json | null
          created_at?: string
          created_by: string
          facility_unit: string
          id?: string
          reference_month: number
          reference_year: number
          status?: Database["public"]["Enums"]["report_status"]
          title?: string
          updated_at?: string
          updated_by: string
          version?: number
        }
        Update: {
          contract_id?: string
          cover_config?: Json | null
          created_at?: string
          created_by?: string
          facility_unit?: string
          id?: string
          reference_month?: number
          reference_year?: number
          status?: Database["public"]["Enums"]["report_status"]
          title?: string
          updated_at?: string
          updated_by?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "reports_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      rubrica_entries: {
        Row: {
          contract_id: string
          created_at: string
          facility_unit: string
          id: string
          notes: string | null
          period: string
          rubrica_name: string
          user_id: string
          value_executed: number
        }
        Insert: {
          contract_id: string
          created_at?: string
          facility_unit: string
          id?: string
          notes?: string | null
          period: string
          rubrica_name: string
          user_id: string
          value_executed?: number
        }
        Update: {
          contract_id?: string
          created_at?: string
          facility_unit?: string
          id?: string
          notes?: string | null
          period?: string
          rubrica_name?: string
          user_id?: string
          value_executed?: number
        }
        Relationships: [
          {
            foreignKeyName: "rubrica_entries_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      sau_records: {
        Row: {
          created_at: string
          created_by: string
          descricao: string
          facility_unit: string
          id: string
          notes: string | null
          resolved_at: string | null
          responsavel: string | null
          setor: string | null
          status: Database["public"]["Enums"]["sau_status"]
          tipo: Database["public"]["Enums"]["sau_tipo"]
        }
        Insert: {
          created_at?: string
          created_by: string
          descricao: string
          facility_unit: string
          id?: string
          notes?: string | null
          resolved_at?: string | null
          responsavel?: string | null
          setor?: string | null
          status?: Database["public"]["Enums"]["sau_status"]
          tipo: Database["public"]["Enums"]["sau_tipo"]
        }
        Update: {
          created_at?: string
          created_by?: string
          descricao?: string
          facility_unit?: string
          id?: string
          notes?: string | null
          resolved_at?: string | null
          responsavel?: string | null
          setor?: string | null
          status?: Database["public"]["Enums"]["sau_status"]
          tipo?: Database["public"]["Enums"]["sau_tipo"]
        }
        Relationships: []
      }
      sectors: {
        Row: {
          created_at: string
          facility_unit: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          facility_unit: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          facility_unit?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      sigtap_procedures: {
        Row: {
          code: string
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      supplier_documents: {
        Row: {
          created_at: string
          doc_key: string
          doc_label: string
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          observacoes: string | null
          supplier_id: string
          uploaded_by: string
          uploaded_by_name: string | null
          validade: string | null
        }
        Insert: {
          created_at?: string
          doc_key: string
          doc_label: string
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          observacoes?: string | null
          supplier_id: string
          uploaded_by: string
          uploaded_by_name?: string | null
          validade?: string | null
        }
        Update: {
          created_at?: string
          doc_key?: string
          doc_label?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          observacoes?: string | null
          supplier_id?: string
          uploaded_by?: string
          uploaded_by_name?: string | null
          validade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_documents_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          ativo: boolean
          cnpj: string
          contato_responsavel: string | null
          created_at: string
          created_by: string | null
          email: string | null
          endereco: string | null
          fornece_medicamentos: boolean
          id: string
          inidoneo: boolean
          liberado_em: string | null
          liberado_motivo: string | null
          liberado_por: string | null
          nome: string
          observacoes: string | null
          qualificacao_observacoes: string | null
          qualificacao_status: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cnpj: string
          contato_responsavel?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          endereco?: string | null
          fornece_medicamentos?: boolean
          id?: string
          inidoneo?: boolean
          liberado_em?: string | null
          liberado_motivo?: string | null
          liberado_por?: string | null
          nome: string
          observacoes?: string | null
          qualificacao_observacoes?: string | null
          qualificacao_status?: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cnpj?: string
          contato_responsavel?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          endereco?: string | null
          fornece_medicamentos?: boolean
          id?: string
          inidoneo?: boolean
          liberado_em?: string | null
          liberado_motivo?: string | null
          liberado_por?: string | null
          nome?: string
          observacoes?: string | null
          qualificacao_observacoes?: string | null
          qualificacao_status?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      training_modules: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          id: string
          sort_order: number
          title: string
          updated_at: string
          video_uploaded_at: string | null
          video_url: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          sort_order?: number
          title: string
          updated_at?: string
          video_uploaded_at?: string | null
          video_url?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string
          video_uploaded_at?: string | null
          video_url?: string | null
        }
        Relationships: []
      }
      training_ratings: {
        Row: {
          created_at: string
          id: string
          module_id: string
          rating: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          module_id: string
          rating: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          module_id?: string
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_ratings_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "training_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_edit_order: { Args: { _o_id: string }; Returns: boolean }
      can_edit_quotation: { Args: { _q_id: string }; Returns: boolean }
      can_edit_requisition: { Args: { _req_id: string }; Returns: boolean }
      get_invite_by_token: { Args: { _token: string }; Returns: Json }
      get_order_dossier: { Args: { _order_id: string }; Returns: Json }
      get_order_for_approval: { Args: { _token: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      submit_invite_response:
        | {
            Args: {
              _condicao_pagamento: string
              _observacoes: string
              _prazo_entrega: string
              _responses: Json
              _token: string
            }
            Returns: Json
          }
        | {
            Args: {
              _condicao_pagamento: string
              _ip?: string
              _observacoes: string
              _prazo_entrega: string
              _responses: Json
              _token: string
            }
            Returns: Json
          }
        | {
            Args: {
              _condicao_pagamento: string
              _ip?: string
              _observacoes: string
              _prazo_entrega: string
              _responder_cpf?: string
              _responder_email?: string
              _responder_name?: string
              _responder_phone?: string
              _responses: Json
              _token: string
            }
            Returns: Json
          }
      submit_order_approval: {
        Args: {
          _approver_cargo: string
          _approver_email: string
          _approver_name: string
          _ciencia: boolean
          _decision: string
          _ip: string
          _motivo_recusa: string
          _token: string
        }
        Returns: Json
      }
      upsert_supplier_from_cnpj: {
        Args: { _cnpj: string; _nome: string }
        Returns: string
      }
    }
    Enums: {
      action_priority: "baixa" | "media" | "alta" | "critica"
      action_status: "nao_iniciada" | "em_andamento" | "concluida" | "cancelada"
      app_role: "admin" | "gestor" | "analista" | "clinico" | "funcionario"
      evidence_status: "pendente" | "enviada" | "validada" | "rejeitada"
      facility_unit: "Hospital Geral" | "UPA Norte" | "UBS Centro"
      opme_status:
        | "rascunho"
        | "aguardando_auditor_pre"
        | "aprovado_pre"
        | "em_execucao"
        | "aguardando_auditor_pos"
        | "concluido"
        | "cancelado"
        | "reprovado"
      problem_type:
        | "processo"
        | "equipamento"
        | "rh"
        | "insumo"
        | "infraestrutura"
        | "outro"
      purchase_order_status:
        | "aguardando_aprovacao"
        | "autorizada"
        | "negada"
        | "enviada"
        | "recebida"
        | "cancelada"
      purchase_quotation_status:
        | "rascunho"
        | "em_andamento"
        | "concluida"
        | "cancelada"
      purchase_requisition_status:
        | "rascunho"
        | "aguardando_cotacao"
        | "em_cotacao"
        | "cotacao_concluida"
        | "em_oc"
        | "finalizada"
        | "cancelada"
      report_status: "rascunho" | "em_revisao" | "fechado" | "exportado"
      sau_status: "aberto" | "em_andamento" | "resolvido" | "cancelado"
      sau_tipo: "elogio" | "reclamacao" | "sugestao" | "ouvidoria"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      action_priority: ["baixa", "media", "alta", "critica"],
      action_status: ["nao_iniciada", "em_andamento", "concluida", "cancelada"],
      app_role: ["admin", "gestor", "analista", "clinico", "funcionario"],
      evidence_status: ["pendente", "enviada", "validada", "rejeitada"],
      facility_unit: ["Hospital Geral", "UPA Norte", "UBS Centro"],
      opme_status: [
        "rascunho",
        "aguardando_auditor_pre",
        "aprovado_pre",
        "em_execucao",
        "aguardando_auditor_pos",
        "concluido",
        "cancelado",
        "reprovado",
      ],
      problem_type: [
        "processo",
        "equipamento",
        "rh",
        "insumo",
        "infraestrutura",
        "outro",
      ],
      purchase_order_status: [
        "aguardando_aprovacao",
        "autorizada",
        "negada",
        "enviada",
        "recebida",
        "cancelada",
      ],
      purchase_quotation_status: [
        "rascunho",
        "em_andamento",
        "concluida",
        "cancelada",
      ],
      purchase_requisition_status: [
        "rascunho",
        "aguardando_cotacao",
        "em_cotacao",
        "cotacao_concluida",
        "em_oc",
        "finalizada",
        "cancelada",
      ],
      report_status: ["rascunho", "em_revisao", "fechado", "exportado"],
      sau_status: ["aberto", "em_andamento", "resolvido", "cancelado"],
      sau_tipo: ["elogio", "reclamacao", "sugestao", "ouvidoria"],
    },
  },
} as const
