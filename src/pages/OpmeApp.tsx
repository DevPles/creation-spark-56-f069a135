import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import FaturamentoWizard from "@/components/opme/FaturamentoWizard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
  import { ArrowLeft, CalendarIcon, Eye, EyeOff, X, Trash2, Upload, FileText, Plus } from "lucide-react";
 import {
   AlertDialog,
   AlertDialogAction,
   AlertDialogCancel,
   AlertDialogContent,
   AlertDialogDescription,
   AlertDialogFooter,
   AlertDialogHeader,
   AlertDialogTitle,
   AlertDialogTrigger,
 } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const STEPS_CADASTRO = [
  { id: "paciente", title: "Paciente", description: "Identificação do Paciente" },
  { id: "procedimento", title: "Procedimento", description: "Características Cirúrgicas" },
  { id: "imagem", title: "Exames", description: "Anexar Exames e Laudos" },
];

const STEPS_REQUISICAO = [
  { id: "dados_iniciais", title: "Dados Gerais", description: "Paciente e Procedimento" },
  { id: "solicitante", title: "Solicitante", description: "Profissional Responsável" },
  { id: "materiais", title: "Materiais", description: "Solicitação de OPME" },
  { id: "justificativa_imagem", title: "Justificativa", description: "Indicação e Exames" },
];

const STEPS_AUDITORIA = [
  { id: "auditoria_pre", title: "Médico Auditor", description: "Validação Pré-OP" },
  { id: "auditoria_post", title: "Médico Auditor", description: "Validação Pós-OP" },
];

const STEPS_CONTROLE = [
  { id: "administrativo", title: "Controle Administrativo", description: "Logística e CME" },
];

const STEPS_CONSUMO = [
  { id: "consumo", title: "Registro de Uso", description: "Materiais Utilizados" },
  { id: "imagem_pos", title: "Imagem Pós", description: "Controle Pós-OP" },
];

const STEPS_FATURAMENTO = [
  { id: "justificativa_cirurgiao", title: "Justificativa", description: "Responder Auditoria" },
  { id: "fat_resumo", title: "Resumo do Caso", description: "Paciente e Procedimento" },
  { id: "fat_opme", title: "OPME e Rastreabilidade", description: "Solicitado x Utilizado x Faturado" },
  { id: "fat_validacao", title: "Validação Cruzada", description: "Auditoria, SIGTAP e Glosa" },
  { id: "fat_docs", title: "Documentação", description: "Evidências e Anexos" },
  { id: "fat_fechamento", title: "Fechamento", description: "Status Final e Dossiê" },
];

const ANATOMY_DATA: Record<string, string[]> = {
  "Cabeça/Pescoço": ["Crânio", "Face", "Pescoço", "Mandíbula", "Órbita"],
  "Tórax": ["Coração", "Pulmão", "Mama", "Arcabouço Costal", "Mediastino"],
  "Abdome": ["Parede Abdominal", "Fígado/Vias Biliares", "Rim/Ureter", "Intestino", "Estômago"],
  "Membro Superior": ["Ombro", "Braço", "Cotovelo", "Antebraço", "Punho", "Mão"],
  "Membro Inferior": ["Quadril", "Coxa", "Joelho", "Perna", "Tornozelo", "Pé"],
  "Coluna": ["Cervical", "Torácica", "Lombar", "Sacro-Coccígea"]
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const getFileExtension = (file: any) => {
  const name = typeof file?.name === "string" ? file.name : "";
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1) || "bin" : "bin";
};
const isUploadableFile = (file: any): file is File => typeof File !== "undefined" && file instanceof File && typeof file.name === "string";
const isRemoteUrl = (url: any) => typeof url === "string" && /^https?:\/\//i.test(url);
const shortActorName = (value: any) => {
  const text = typeof value === "string" ? value : String(value ?? "");
  if (!text) return "---";
  const at = text.indexOf("@");
  return at > 0 ? text.slice(0, at) : text;
};

interface OpmeAppProps {
  embedded?: boolean;
}

export default function OpmeApp({ embedded = false }: OpmeAppProps = {}) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [recordId, setRecordId] = useState<string | null>(searchParams.get("id"));
  const [part, setPart] = useState<number | null>(null);
   const [preopExams, setPreopExams] = useState<any[]>([]);
    const [consumptionExams, setConsumptionExams] = useState<any[]>([]);
    const [postopExams, setPostopExams] = useState<any[]>([]);
    const [aihFile, setAihFile] = useState<File | null>(null);
    // Anexos da rodada atual de justificativa do cirurgião (somente em memória até o envio)
    const [surgeonJustificationFiles, setSurgeonJustificationFiles] = useState<Array<{ id: string; file: File; name: string; size: number; mime: string; previewUrl: string }>>([]);
    const [uploadingJustification, setUploadingJustification] = useState(false);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authPassword, setAuthPassword] = useState("");
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleAuditAuth = async () => {
    if (!user?.email) return;
    setIsAuthenticating(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: authPassword,
      });

      if (error) {
        toast.error("Senha incorreta. Verifique e tente novamente.");
        return;
      }

      // Log da ação
      await supabase.from("audit_logs").insert({
        user_id: user.id,
        request_id: recordId,
        action: step === 0 ? "validacao_pre" : "validacao_pos"
      });

      setShowAuthModal(false);
      setAuthPassword("");
      handleSave(true);
    } catch (err) {
      toast.error("Erro na autenticação.");
    } finally {
      setIsAuthenticating(false);
    }
  };
  const [loading, setLoading] = useState(false);
  const [facilities, setFacilities] = useState<string[]>([]);
   const [stats, setStats] = useState({
     cadastro: 0,
     requisicao: 0,
     auditoria_pre: 0,
     controle: 0,
     consumo: 0,
     auditoria_post: 0,
     faturamento: 0,
     divergencias: 0
   });
   const [requests, setRequests] = useState<any[]>([]);
   const [filteredRequests, setFilteredRequests] = useState<any[]>([]);
    const [filterStatus, setFilterStatus] = useState<string | null>(null);
    const [filterDate, setFilterDate] = useState<string>("");
  const [sigtapSuggestions, setSigtapSuggestions] = useState<any[]>([]);
  const [materialSuggestions, setMaterialSuggestions] = useState<{ idx: number, items: any[] }>({ idx: -1, items: [] });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const STEPS = part === 1 ? STEPS_CADASTRO : 
                part === 2 ? STEPS_REQUISICAO : 
                part === 3 ? STEPS_AUDITORIA : 
                part === 5 ? STEPS_CONTROLE :
                part === 6 ? STEPS_CONSUMO :
                STEPS_FATURAMENTO;

  const PART_NAMES: Record<number, string> = {
    1: "Cadastro",
    2: "Requisição",
    3: "Auditoria",
    4: "Faturamento",
    5: "Controle",
    6: "Consumo",
  };
  const currentStepTitle = STEPS[step]?.title || "Solicitação OPME";
  const currentStepDescription = STEPS[step]?.description || "";
  const currentPartName = part ? PART_NAMES[part] : "";
  const headerSubtitle = currentPartName
    ? `${currentPartName}${currentStepDescription ? ` · ${currentStepDescription}` : ""}`
    : currentStepDescription;

   const [form, setForm] = useState<any>({
    facility_unit: profile?.facility_unit || "Hospital Geral",
    status: "rascunho",
    patient_name: "",
    patient_record: "",
    patient_birthdate: "",
    patient_mother_name: "",
    patient_sus: "",
    responsible_name: "",
    responsible_register: "",
    procedure_date: todayISO(),
    procedure_type: "eletivo",
    procedure_name: "",
    procedure_sigtap_code: "",
    procedure_room: "",
    requester_name: profile?.name || "",
    requester_register: "",
    opme_requested: [{ description: "", quantity: "1", size_model: "", sigtap: "" }],
    instruments_specific: false,
    instruments_loan: false,
    instruments_na: true,
    instruments_specify: "",
    clinical_indication: "",
    preop_image_types: [],
    preop_image_other: "",
    preop_exam_date: "",
    preop_exam_number: "",
    preop_finding_description: "",
    preop_image_attached: false,
      preop_image_count: 0,
      preop_validation_responsible: profile?.name || "",
      // Campos Parte 2
    auditor_pre_name: "",
    auditor_pre_crm: "",
    auditor_pre_analysis: "adequada",
    auditor_pre_sigtap_compat: "sim",
    auditor_pre_opinion: "",
    auditor_pre_date: "",
    request_date: "",
    request_time: "",
    warehouse_received_by: "",
    warehouse_date: "",
    warehouse_time: "",
    stock_available: "sim",
    sent_to_cme: false,
    cme_processing_date: "",
    cme_responsible: "",
    surgery_dispatch_date: "",
    surgery_dispatch_responsible: "",
    opme_used: [{ description: "", quantity: "1", batch: "", expiry: "", label_fixed: "sim", photo_url: "", launched: false, launched_by: null, launched_at: null }],
    opme_returned: [{ description: "", quantity: "0", batch: "", reason: "", responsible: "" }],
    postop_image_types: [],
    postop_image_other: "",
    postop_exam_date: "",
    postop_exam_number: "",
    postop_result_description: "",
    postop_image_attached: false,
    postop_image_count: 0,
    postop_validation_responsible: "",
    // Campos Parte 3
    auditor_post_name: "",
    auditor_post_crm: "",
    auditor_post_procedure_compat: "sim",
    auditor_post_sigtap_compat: "sim",
    auditor_post_image_conformity: "sim",
    auditor_post_final_opinion: "",
    auditor_post_date: todayISO(),
    auditor_post_justification_requested: false,
    auditor_post_justification_reason: "",
    incident_date: "",
    incident_description: "",
    incident_responsible: "",
    billing_aih_number: "",
    billing_procedure_name: "",
    billing_sigtap_code: "",
    billing_prior_authorization: "nao_se_aplica",
     billing_aih_generated: false,
     billing_aih_file_url: "",
    billing_opme_compatibility: "sim",
    billing_divergence: false,
    billing_divergence_description: "",
    billing_docs: {
      nf: false,
      rastreabilidade: false,
      laudo: false,
      consumo: false,
      autorizacao: false,
      exames: false
    }
  });

   useEffect(() => {
     if (part === 2 && step === 3 && !form.preop_validation_responsible && form.requester_name) {
       setForm((p: any) => ({ ...p, preop_validation_responsible: p.requester_name }));
     }
   }, [part, step, form.requester_name]);
 
   useEffect(() => {
     if (profile) {
       setForm(p => ({ 
         ...p, 
         facility_unit: p.facility_unit || profile.facility_unit || "Hospital Geral",
         requester_name: p.requester_name || profile.name || ""
       }));
     }
   }, [profile]);

  useEffect(() => {
    if (recordId) {
      (async () => {
        setLoading(true);
        const { data, error } = await supabase.from("opme_requests").select("*").eq("id", recordId).single();
        if (data && !error) {
          const safeData = sanitizeLoadedRequest(data);
          setForm(safeData);
          setPreopExams(toList(safeData.preop_exams_details).filter((exam: any) => isRemoteUrl(exam?.url)));
          setPostopExams(toList(safeData.postop_exams_details).filter((exam: any) => isRemoteUrl(exam?.url)));
          setConsumptionExams(toList(safeData.consumption_exams_details).filter((exam: any) => isRemoteUrl(exam?.url)));
        }
        setLoading(false);
      })();
    }
  }, [recordId]);

   useEffect(() => {
     if (part === null) {
       (async () => {
         const { data, error } = await supabase
           .from("opme_requests")
           .select("*")
           .order("created_at", { ascending: false });
         
         if (data && !error) {
           setRequests(data);
           setFilteredRequests(data);
           const s = { 
             cadastro: 0, 
             requisicao: 0, 
             auditoria_pre: 0, 
             controle: 0, 
             consumo: 0, 
             auditoria_post: 0, 
             faturamento: 0, 
             divergencias: 0 
           };
           data.forEach((c: any) => {
             if (c.status === "rascunho") s.cadastro++;
             if (c.status === "pendente_requisicao") s.requisicao++;
             if (c.status === "pendente_auditoria") s.auditoria_pre++;
             if (c.status === "pendente_auditoria_post") s.auditoria_post++;
             if (c.status === "pendente_controle") s.controle++;
             if (c.status === "pendente_consumo") s.consumo++;
             if (c.status === "pendente_faturamento") s.faturamento++;
             
             const sideDiv = c.procedure_side_cadastro && c.procedure_side_requisicao && c.procedure_side_cadastro !== c.procedure_side_requisicao;
             const regionDiv = c.procedure_region_cadastro && c.procedure_region_requisicao && c.procedure_region_cadastro !== c.procedure_region_requisicao;
             const segmentDiv = c.procedure_segment_cadastro && c.procedure_segment_requisicao && c.procedure_segment_cadastro !== c.procedure_segment_requisicao;
             const positionDiv = c.procedure_position_cadastro && c.procedure_position_requisicao && c.procedure_position_cadastro !== c.procedure_position_requisicao;
             
             if (sideDiv || regionDiv || segmentDiv || positionDiv) {
               s.divergencias++;
             }
           });
           setStats(s);
         }
       })();
     }
   }, [part]);
 
    const applyFilters = (status: string | null, date: string) => {
      let filtered = [...requests];
      
      if (status) {
        if (status === "divergencias") {
          filtered = filtered.filter((c: any) => {
            const sideDiv = c.procedure_side_cadastro && c.procedure_side_requisicao && c.procedure_side_cadastro !== c.procedure_side_requisicao;
            const regionDiv = c.procedure_region_cadastro && c.procedure_region_requisicao && c.procedure_region_cadastro !== c.procedure_region_requisicao;
            const segmentDiv = c.procedure_segment_cadastro && c.procedure_segment_requisicao && c.procedure_segment_cadastro !== c.procedure_segment_requisicao;
            const positionDiv = c.procedure_position_cadastro && c.procedure_position_requisicao && c.procedure_position_cadastro !== c.procedure_position_requisicao;
            return sideDiv || regionDiv || segmentDiv || positionDiv;
          });
        } else {
          filtered = filtered.filter((r: any) => r.status === status);
        }
      }
      
      if (date) {
        filtered = filtered.filter((r: any) => r.procedure_date === date);
      }
      
      setFilteredRequests(filtered);
    };

    const handleStatusFilter = (status: string | null) => {
      const newStatus = filterStatus === status ? null : status;
      setFilterStatus(newStatus);
      applyFilters(newStatus, filterDate);
    };

    const handleDateFilter = (date: Date | undefined) => {
      const dateStr = date ? format(date, "yyyy-MM-dd") : "";
      setFilterDate(dateStr);
      applyFilters(filterStatus, dateStr);
    };

    const clearFilters = () => {
      setFilterStatus(null);
      setFilterDate("");
      setFilteredRequests(requests);
    };
 
   const handleDeleteRequest = async (id: string) => {
     try {
       const { error } = await supabase.from("opme_requests").delete().eq("id", id);
       if (error) throw error;
       
       toast.success("Processo excluído com sucesso.");
       setRequests(prev => prev.filter(r => r.id !== id));
       setFilteredRequests(prev => prev.filter(r => r.id !== id));
       
       setStats(prev => {
         const s = { ...prev };
         const req = requests.find(r => r.id === id);
         if (req) {
           if (req.status === "rascunho") s.cadastro--;
           if (req.status === "pendente_requisicao") s.requisicao--;
           if (req.status === "pendente_auditoria") s.auditoria_pre--;
           if (req.status === "pendente_auditoria_post") s.auditoria_post--;
           if (req.status === "pendente_controle") s.controle--;
           if (req.status === "pendente_consumo") s.consumo--;
           if (req.status === "pendente_faturamento") s.faturamento--;
         }
         return s;
       });
     } catch (err: any) {
       toast.error("Erro ao excluir: " + err.message);
     }
   };
 
   const loadRequest = (req: any) => {
      const safeReq = sanitizeLoadedRequest(req);
      setForm(safeReq);
      setPreopExams(toList(safeReq.preop_exams_details).filter((exam: any) => isRemoteUrl(exam?.url)));
      setConsumptionExams(toList(safeReq.consumption_exams_details).filter((exam: any) => isRemoteUrl(exam?.url)));
      setPostopExams(toList(safeReq.postop_exams_details).filter((exam: any) => isRemoteUrl(exam?.url)));
     
      // Determinar qual parte e passo abrir baseado no status
       if (safeReq.status === "rascunho") { setPart(1); setStep(0); }
       else if (safeReq.status === "pendente_requisicao") { setPart(2); setStep(0); }
       else if (safeReq.status === "pendente_auditoria") { setPart(3); setStep(0); }
       else if (safeReq.status === "pendente_auditoria_post") { setPart(3); setStep(1); }
       else if (safeReq.status === "pendente_controle") { setPart(5); setStep(0); }
       else if (safeReq.status === "pendente_consumo") { 
        setPart(6); 
        setStep(0); 
        
        // Sincronizar itens solicitados para o consumo se estiver vazio
         if (!safeReq.opme_used || safeReq.opme_used.length === 0 || (safeReq.opme_used.length === 1 && !safeReq.opme_used[0].description)) {
           if (safeReq.opme_requested && safeReq.opme_requested.length > 0) {
             const initialUsed = safeReq.opme_requested.map((item: any) => ({
              description: item.description,
              quantity: item.quantity,
              batch: "",
              expiry: "",
              label_fixed: "sim",
              launched: false
            }));
            setForm((p: any) => ({ ...p, opme_used: initialUsed }));
          }
        }
      }
       else if (safeReq.status === "aguardando_justificativa") { setPart(4); setStep(0); }
       else if (safeReq.status === "justificativa_respondida") { setPart(3); setStep(1); }
       else if (safeReq.status === "pendente_faturamento") { setPart(4); setStep(1); }
      else { setPart(1); setStep(0); } // Fallback
     
     // Adicionar ID na URL sem recarregar para manter consistência
     const newUrl = new URL(window.location.href);
      newUrl.searchParams.set("id", safeReq.id);
     window.history.pushState({}, '', newUrl);
      setRecordId(safeReq.id);
   };

  useEffect(() => {
    (async () => {
      const [{ data: profs }, { data: ctrs }] = await Promise.all([
        supabase.from("profiles").select("facility_unit"),
        supabase.from("contracts").select("unit"),
      ]);
      const set = new Set<string>();
      (profs || []).forEach((p: any) => p.facility_unit && set.add(p.facility_unit));
      (ctrs || []).forEach((c: any) => c.unit && set.add(c.unit));
      setFacilities(Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR")));
    })();
  }, []);

  const updateForm = (k: string, v: any) => {
    setForm((p: any) => ({ ...p, [k]: v }));
    
    // Sugestão SIGTAP ao digitar nome do procedimento
    if (k === "procedure_name") {
      if (v.length > 2) {
        supabase
          .from("sigtap_procedures")
          .select("code, name")
          .ilike("name", `%${v}%`)
          .limit(5)
          .then(({ data }) => setSigtapSuggestions(data || []));
      } else {
        setSigtapSuggestions([]);
      }
    }
  };

  const uploadFile = async (file: File, bucket: string = "opme-attachments"): Promise<string | null> => {
    if (!isUploadableFile(file)) return null;
    const ext = getFileExtension(file);
    const folder = user?.id || "anon";
    const path = `${folder}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file);
    if (error) {
      console.error("Erro no upload:", error);
      return null;
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  };

  const uploadExamFiles = async (exams: any[]): Promise<any[]> => {
    const results = (Array.isArray(exams) ? exams : []).map((exam) => ({ ...(exam || {}) }));
    for (let i = 0; i < results.length; i++) {
      const currentUrl = results[i]?.url;
      if (isUploadableFile(results[i]?.file) && !isRemoteUrl(currentUrl)) {
        const url = await uploadFile(results[i].file);
        if (url) {
          results[i].url = url;
          // Não deletamos o file da memória ainda para evitar problemas de re-render, 
          // mas no banco ele não será salvo de qualquer forma.
        }
      }
    }
    return results
      .filter((exam) => isRemoteUrl(exam?.url))
      .map(({ file, ...rest }) => rest);
  };

  const sanitizeLoadedRequest = (req: any) => ({
    ...req,
    opme_requested: toList(req?.opme_requested).length ? toList(req.opme_requested) : [{ description: "", quantity: "1", size_model: "", sigtap: "" }],
    opme_used: toList(req?.opme_used).length ? toList(req.opme_used) : [{ description: "", quantity: "1", batch: "", expiry: "", label_fixed: "sim", photo_url: "", launched: false, launched_by: null, launched_at: null }],
    opme_returned: toList(req?.opme_returned).length ? toList(req.opme_returned) : [{ description: "", quantity: "0", batch: "", reason: "", responsible: "" }],
    billing_docs: req?.billing_docs || { nf: false, rastreabilidade: false, laudo: false, consumo: false, autorizacao: false, exames: false },
    auditor_post_procedure_compat: req?.auditor_post_procedure_compat || "sim",
    auditor_post_sigtap_compat: req?.auditor_post_sigtap_compat || "sim",
    auditor_post_image_conformity: req?.auditor_post_image_conformity || "sim",
    auditor_post_final_opinion: req?.auditor_post_final_opinion || "",
    auditor_post_justification_reason: req?.auditor_post_justification_reason || "",
    auditor_post_date: req?.auditor_post_date || todayISO()
  });

  const updateItem = (idx: number, field: string, value: any, listName: string = "opme_requested") => {
    setForm((p: any) => {
      const arr = [...(p[listName] || [])];
      arr[idx] = { ...arr[idx], [field]: value };
      return { ...p, [listName]: arr };
    });

    if (field === "description" && value.length > 2 && listName === "opme_requested") {
      // Busca no catálogo de produtos (somente OPME) e traz preço de referência
      supabase
        .from("product_catalog")
        .select("id, codigo, descricao, descricao_resumida, sigtap_code, preco_referencia, categoria_opme")
        .or(`tipo.eq.IMP,classificacao.eq.implante`)
        .or(`descricao.ilike.%${value}%,descricao_resumida.ilike.%${value}%,codigo.ilike.%${value}%`)
        .eq("ativo", true)
        .limit(8)
        .then(async ({ data }) => {
          const items = data || [];
          // Para cada produto, buscar último preço praticado em price_history
          const enriched = await Promise.all(items.map(async (p: any) => {
            const { data: ph } = await supabase
              .from("price_history")
              .select("valor_unitario, data_referencia")
              .ilike("descricao_produto", `%${p.descricao}%`)
              .order("data_referencia", { ascending: false })
              .limit(1);
            const lastPrice = ph && ph.length > 0 ? Number(ph[0].valor_unitario) : null;
            return {
              code: p.codigo,
              name: p.descricao,
              product_id: p.id,
              sigtap: p.sigtap_code || "",
              unit_price: lastPrice ?? (p.preco_referencia != null ? Number(p.preco_referencia) : 0),
              price_source: lastPrice != null ? "historico" : (p.preco_referencia != null ? "referencia" : "sem_preco"),
            };
          }));
          setMaterialSuggestions({ idx, items: enriched });
        });
    } else if (field === "description") {
      setMaterialSuggestions({ idx: -1, items: [] });
    }
  };

  const addItem = (listName: string = "opme_requested") => {
    const newItem = listName === "opme_used"
      ? { description: "", quantity: "1", batch: "", expiry: "", label_fixed: "sim", photo_url: "", launched: false, unit_price: 0, product_id: null }
      : listName === "opme_returned"
      ? { description: "", quantity: "0", batch: "", reason: "", responsible: "" }
      : { description: "", quantity: "1", size_model: "", sigtap: "", unit_price: 0, product_id: null, price_source: "sem_preco" };

    setForm((p: any) => ({ ...p, [listName]: [...(p[listName] || []), newItem] }));
  };

  const resetForm = () => {
    setForm({
      facility_unit: profile?.facility_unit || "Hospital Geral",
      status: "rascunho",
      patient_name: "",
      patient_record: "",
      patient_birthdate: "",
      patient_mother_name: "",
      patient_sus: "",
      responsible_name: "",
      responsible_register: "",
      procedure_date: todayISO(),
      procedure_type: "eletivo",
      procedure_name: "",
      procedure_sigtap_code: "",
      procedure_room: "",
      requester_name: profile?.name || "",
      requester_register: "",
      opme_requested: [{ description: "", quantity: "1", size_model: "", sigtap: "" }],
      instruments_specific: false,
      instruments_loan: false,
      instruments_na: true,
      instruments_specify: "",
      clinical_indication: "",
      preop_image_types: [],
      preop_image_other: "",
      preop_exam_date: "",
      preop_exam_number: "",
      preop_finding_description: "",
      preop_image_attached: false,
      preop_image_count: 0,
      preop_validation_responsible: profile?.name || "",
      auditor_pre_name: "",
      auditor_pre_crm: "",
      auditor_pre_analysis: "adequada",
      auditor_pre_sigtap_compat: "sim",
      auditor_pre_opinion: "",
      auditor_pre_date: "",
      request_date: "",
      request_time: "",
      warehouse_received_by: "",
      warehouse_date: "",
      warehouse_time: "",
      stock_available: "sim",
      sent_to_cme: false,
      cme_processing_date: "",
      cme_responsible: "",
      surgery_dispatch_date: "",
      surgery_dispatch_responsible: "",
      opme_used: [{ description: "", quantity: "1", batch: "", expiry: "", label_fixed: "sim", photo_url: "", launched: false, launched_by: null, launched_at: null }],
      opme_returned: [{ description: "", quantity: "0", batch: "", reason: "", responsible: "" }],
      postop_image_types: [],
      postop_image_other: "",
      postop_exam_date: "",
      postop_exam_number: "",
      postop_result_description: "",
      postop_image_attached: false,
      postop_image_count: 0,
      postop_validation_responsible: "",
      auditor_post_name: "",
      auditor_post_crm: "",
      auditor_post_procedure_compat: "sim",
      auditor_post_sigtap_compat: "sim",
      auditor_post_image_conformity: "sim",
      auditor_post_final_opinion: "",
      auditor_post_date: "",
      incident_date: "",
      incident_description: "",
      incident_responsible: "",
      billing_aih_number: "",
      billing_procedure_name: "",
      billing_sigtap_code: "",
      billing_prior_authorization: "nao_se_aplica",
      billing_aih_generated: false,
      billing_aih_file_url: "",
      billing_opme_compatibility: "sim",
      billing_divergence: false,
      billing_divergence_description: "",
      billing_docs: {
        nf: false,
        rastreabilidade: false,
        laudo: false,
        consumo: false,
        autorizacao: false,
        exames: false
      }
    });
    setPreopExams([]);
    setConsumptionExams([]);
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.delete("id");
    window.history.pushState({}, '', newUrl);
  };

  const handleLaunchItem = (idx: number) => {
    setForm((p: any) => {
      const arr = [...(p.opme_used || [])];
      arr[idx] = { 
        ...arr[idx], 
        launched: true, 
        launched_by: user?.email || user?.id || "Usuário", 
        launched_at: new Date().toISOString() 
      };
      return { ...p, opme_used: arr };
    });
    setTimeout(() => handleSave(false), 100);
  };

  const toList = (value: any) => Array.isArray(value) ? value : [];
  const formatDateBR = (value?: string | null) => value ? new Date(value).toLocaleDateString("pt-BR") : "---";
  const normalizeMaterial = (value?: string) => (value || "").trim().toLowerCase();

  const getPostAuditDivergences = () => {
    const requested = toList(form.opme_requested).filter((item: any) => item?.description?.trim());
    const used = toList(form.opme_used).filter((item: any) => item?.description?.trim() && item?.launched);
    const divergences: string[] = [];

    requested.forEach((req: any) => {
      const relatedUsed = used.filter((item: any) => normalizeMaterial(item.description) === normalizeMaterial(req.description));
      const requestedQty = Number(req.quantity || 0);
      const usedQty = relatedUsed.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);

      if (relatedUsed.length === 0) {
        divergences.push(`Material autorizado não lançado no consumo: ${req.description} (${req.quantity || 0} un.)`);
      } else if (requestedQty > 0 && usedQty > requestedQty) {
        divergences.push(`Consumo acima do autorizado: ${req.description} autorizado ${requestedQty} un., consumido ${usedQty} un.`);
      } else if (requestedQty > 0 && usedQty < requestedQty) {
        divergences.push(`Consumo abaixo do autorizado: ${req.description} autorizado ${requestedQty} un., consumido ${usedQty} un.`);
      }
    });

    used.forEach((item: any) => {
      const wasRequested = requested.some((req: any) => normalizeMaterial(req.description) === normalizeMaterial(item.description));
      if (!wasRequested) divergences.push(`Material consumido sem solicitação prévia: ${item.description} (${item.quantity || 0} un.)`);
      if (!item.batch?.trim()) divergences.push(`Rastreabilidade incompleta: ${item.description} sem lote informado.`);
      if (!item.expiry?.trim()) divergences.push(`Rastreabilidade incompleta: ${item.description} sem validade informada.`);
      if (item.label_fixed !== "sim") divergences.push(`Etiqueta não confirmada no prontuário: ${item.description}.`);
    });

    if (postopExams.filter((exam: any) => exam?.url).length === 0) {
      divergences.push("Nenhuma imagem pós-operatória anexada para conferência técnica.");
    }

    return divergences;
  };

  const getTimelineEvidence = () => [
    ...preopExams.filter((exam: any) => exam?.url).map((exam: any) => ({ ...exam, stage: "Pré-OP", date: form.preop_exam_date || form.procedure_date })),
    ...consumptionExams.filter((exam: any) => exam?.url).map((exam: any) => ({ ...exam, stage: "Intra-OP", date: exam.date || form.procedure_date })),
    ...toList(form.opme_used).filter((item: any) => item?.photo_url).map((item: any) => ({
      url: item.photo_url,
      type: item.description || "Material utilizado",
      stage: "Consumo",
      date: item.launched_at || form.procedure_date
    })),
    ...postopExams.filter((exam: any) => exam?.url).map((exam: any) => ({ ...exam, stage: "Pós-OP", date: form.postop_exam_date || form.procedure_date }))
  ].sort((a: any, b: any) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());

  const buildPostAuditJustification = () => {
    const divergences = getPostAuditDivergences();
    if (divergences.length === 0) return "Solicito justificativa complementar do cirurgião para conferência final do dossiê pós-operatório.";
    return `Solicito justificativa complementar para os seguintes pontos de divergência:\n- ${divergences.join("\n- ")}`;
  };

   const generateAuditDossierPdf = async () => {
     const { jsPDF } = await import("jspdf");
     const autoTableModule = await import("jspdf-autotable");
     const autoTable = autoTableModule.default;
     const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
     const requested = toList(form.opme_requested).filter((item: any) => item?.description?.trim());
     const used = toList(form.opme_used).filter((item: any) => item?.description?.trim() && item?.launched);
     const divergences = getPostAuditDivergences();
     const evidence = getTimelineEvidence();
     const margin = 14;
     let y = margin;
 
     // Helper para converter imagem para base64
     const getBase64Image = async (url: string) => {
       try {
         const response = await fetch(url);
         const blob = await response.blob();
         return new Promise<string>((resolve) => {
           const reader = new FileReader();
           reader.onloadend = () => resolve(reader.result as string);
           reader.readAsDataURL(blob);
         });
       } catch (e) {
         console.error("Erro ao carregar imagem para PDF:", e);
         return null;
       }
     };
 
     // Capa institucional
     doc.setFont("helvetica", "bold");
     doc.setFontSize(16);
      doc.setTextColor(30, 58, 138);
     doc.text("DOSSIÊ DE AUDITORIA PÓS-OPERATÓRIA", margin, y);
      doc.setDrawColor(30, 58, 138);
     doc.setLineWidth(0.5);
     doc.line(margin, y + 2, 196, y + 2);
     y += 12;
 
     doc.setFontSize(10);
     doc.setTextColor(0, 0, 0);
     doc.setFont("helvetica", "bold");
     doc.text("1. IDENTIFICAÇÃO DO PACIENTE", margin, y);
     y += 6;
     doc.setFont("helvetica", "normal");
     doc.setFontSize(9);
     doc.text(`Paciente: ${form.patient_name?.toUpperCase() || "NÃO INFORMADO"}`, margin, y);
     doc.text(`Prontuário: ${form.patient_record || "---"} | SUS: ${form.patient_sus || "---"}`, 120, y);
     y += 5;
     doc.text(`Data Nasc: ${formatDateBR(form.patient_birthdate)} | Nome da Mãe: ${form.patient_mother_name || "---"}`, margin, y);
     y += 8;
 
     doc.setFont("helvetica", "bold");
     doc.setFontSize(10);
     doc.text("2. DADOS DO PROCEDIMENTO", margin, y);
     y += 6;
     doc.setFont("helvetica", "normal");
     doc.setFontSize(9);
     doc.text(`Cirurgia: ${form.procedure_name?.toUpperCase() || "NÃO INFORMADA"}`, margin, y);
     y += 5;
     doc.text(`Data: ${formatDateBR(form.procedure_date)} | Unidade: ${form.facility_unit || "---"} | Sala: ${form.procedure_room || "---"}`, margin, y);
     y += 5;
     doc.text(`Cirurgião: ${form.responsible_name || "---"} | SIGTAP: ${form.procedure_sigtap_code || "---"} | AIH: ${form.billing_aih_number || "---"}`, margin, y);
     y += 8;
 
     doc.setFont("helvetica", "bold");
     doc.setFontSize(10);
     doc.text("3. INDICAÇÃO CLÍNICA", margin, y);
     y += 6;
     doc.setFont("helvetica", "normal");
     doc.setFontSize(9);
     const indicationLines = doc.splitTextToSize(form.clinical_indication || "Nenhuma indicação clínica registrada.", 182);
     doc.text(indicationLines, margin, y);
     y += Math.max(8, indicationLines.length * 5 + 4);
 
     // Timeline de Movimentações
     doc.setFont("helvetica", "bold");
     doc.setFontSize(10);
     doc.text("4. LOGS DE RASTREABILIDADE E MOVIMENTAÇÃO", margin, y);
     y += 4;
     const logs = [
       { etapa: "Cadastro Inicial", data: formatDateBR(form.created_at), resp: form.requester_name || "---" },
       { etapa: "Auditoria Pré-OP", data: formatDateBR(form.auditor_pre_date), resp: form.auditor_pre_name || "---" },
       { etapa: "Almoxarifado (Recebimento)", data: formatDateBR(form.warehouse_date), resp: form.warehouse_received_by || "---" },
       { etapa: "CME (Processamento)", data: formatDateBR(form.cme_processing_date), resp: form.cme_responsible || "---" },
       { etapa: "Despacho para Sala", data: formatDateBR(form.surgery_dispatch_date), resp: form.surgery_dispatch_responsible || "---" },
       { etapa: "Auditoria Pós-OP", data: formatDateBR(form.auditor_post_date), resp: form.auditor_post_name || "---" }
     ].filter(l => l.data !== "---");
 
     autoTable(doc, {
       startY: y,
       head: [["Etapa do Fluxo", "Data de Conclusão", "Responsável Logístico"]],
       body: logs.map(l => [l.etapa, l.data, l.resp]),
       styles: { fontSize: 8 },
        headStyles: { fillColor: [30, 58, 138] }
     });
     y = (doc as any).lastAutoTable.finalY + 8;
 
     // Materiais
     doc.setFont("helvetica", "bold");
     doc.setFontSize(10);
     doc.text("5. CONTROLE DE MATERIAIS (SOLICITADO X CONSUMIDO)", margin, y);
     y += 4;
     autoTable(doc, { 
       startY: y, 
       head: [["Material Autorizado", "Qtd", "Modelo", "SIGTAP"]], 
       body: requested.map((item: any) => [item.description || "---", item.quantity || "0", item.size_model || "---", item.sigtap || "---"]), 
       styles: { fontSize: 8 }, 
       headStyles: { fillColor: [70, 70, 70] } 
     });
     y = (doc as any).lastAutoTable.finalY + 6;
 
     autoTable(doc, { 
       startY: y, 
       head: [["Consumo Efetivo", "Qtd", "Lote", "Validade", "Horário Lançamento"]], 
       body: used.map((item: any) => [
         item.description || "---", 
         item.quantity || "0", 
         item.batch || "---", 
         item.expiry || "---",
         item.launched_at ? new Date(item.launched_at).toLocaleTimeString('pt-BR') : "---"
       ]), 
       styles: { fontSize: 8 }, 
        headStyles: { fillColor: [30, 58, 138] } 
     });
     y = (doc as any).lastAutoTable.finalY + 8;
 
     // Validações
     doc.setFont("helvetica", "bold");
     doc.setFontSize(10);
     doc.text("6. PARECER TÉCNICO E CONFORMIDADE", margin, y);
     y += 4;
     autoTable(doc, { 
       startY: y, 
       head: [["Análise de Divergências e Inconsistências"]], 
       body: (divergences.length ? divergences : ["Nenhuma divergência detectada no fluxo de consumo."]).map((text: string) => [text]), 
       styles: { fontSize: 8 }, 
        headStyles: { fillColor: [75, 85, 99] } 
     });
     y = (doc as any).lastAutoTable.finalY + 8;
 
     // Galeria de Imagens (Nova página se necessário)
     if (evidence.length > 0) {
       doc.addPage();
       y = margin;
       doc.setFont("helvetica", "bold");
       doc.setFontSize(12);
        doc.setTextColor(30, 58, 138);
       doc.text("7. GALERIA DE EVIDÊNCIAS (IMAGENS E RASTREABILIDADE)", margin, y);
       y += 8;
 
       for (let i = 0; i < evidence.length; i++) {
         const img = evidence[i];
         if (!img.url) continue;
 
         if (y > 240) {
           doc.addPage();
           y = margin;
         }
 
         const base64 = await getBase64Image(img.url);
         if (base64) {
           try {
             // Tentar renderizar a imagem (ajustando proporção básica)
             doc.addImage(base64, 'JPEG', margin, y, 90, 60);
             doc.setFontSize(8);
             doc.setFont("helvetica", "bold");
             doc.setTextColor(50, 50, 50);
             doc.text(`Evidência #${i + 1}: ${img.stage} - ${img.type || "Imagem"}`, margin, y + 65);
             doc.setFont("helvetica", "normal");
             doc.text(`Data: ${formatDateBR(img.date)}`, margin, y + 69);
             
             // Alternar entre coluna esquerda e direita se quiser grid, mas para simplicidade faremos lista
             y += 80;
           } catch (e) {
             doc.setFontSize(8);
             doc.setTextColor(200, 0, 0);
             doc.text(`[Erro ao carregar imagem: ${img.type}]`, margin, y);
             y += 10;
           }
         }
       }
     }
 
     // Parecer Final
     if (y > 250) {
       doc.addPage();
       y = margin;
     } else {
       y += 10;
     }
 
     doc.setFont("helvetica", "bold");
     doc.setFontSize(10);
     doc.setTextColor(0, 0, 0);
     doc.text("8. CONCLUSÃO DA AUDITORIA", margin, y);
     y += 6;
     doc.setFont("helvetica", "normal");
     doc.setFontSize(9);
     const opinionLines = doc.splitTextToSize(form.auditor_post_final_opinion || "Auditoria concluída sem parecer textual específico.", 182);
     doc.text(opinionLines, margin, y);
     y += Math.max(20, opinionLines.length * 5 + 10);
 
     // Assinatura
     doc.setFont("helvetica", "bold");
     doc.line(margin + 50, y, 146, y);
     y += 5;
     doc.text(form.auditor_post_name || "MÉDICO AUDITOR", 105, y, { align: "center" });
     y += 4;
     doc.setFontSize(8);
     doc.text(`CRM: ${form.auditor_post_crm || "---"} | Data: ${formatDateBR(form.auditor_post_date)}`, 105, y, { align: "center" });
 
     doc.save(`dossie-auditoria-pos-${(form.patient_name || "paciente").replace(/\s+/g, "-").toLowerCase()}.pdf`);
   };

  const handleSave = async (isAuthValidated = false) => {
    if (!user) { toast.error("Não autenticado"); return; }
    if (!form.patient_name?.trim()) { toast.error("Informe o nome do paciente"); setStep(0); return; }

    // Se for parte de auditoria (3) e ainda não foi validado por senha
    if (part === 3 && !isAuthValidated) {
      setShowAuthModal(true);
      return;
    }
    
    setSaving(true);
    try {
      let nextStatus = form.status;
      if (part === 1) nextStatus = "pendente_requisicao";
      else if (part === 2) nextStatus = "pendente_auditoria";
      else if (part === 3) {
        if (step === 0) nextStatus = "pendente_controle";
        else if (form.status === "justificativa_respondida") {
          // Re-análise da justificativa do cirurgião — decisão do auditor
          if (form.auditor_post_justification_decision === "reprovada") {
            nextStatus = "aguardando_justificativa";
          } else if (form.auditor_post_justification_decision === "liberada") {
            nextStatus = "pendente_faturamento";
          } else {
            // Sem decisão definida → mantém em re-análise
            nextStatus = "justificativa_respondida";
          }
        }
        else if (form.auditor_post_justification_requested) nextStatus = "aguardando_justificativa";
        else nextStatus = "pendente_faturamento";
      }
      else if (part === 5) nextStatus = "pendente_consumo";
      else if (part === 6) nextStatus = "pendente_auditoria_post";
      else if (part === 4) {
        if (step === 0) {
          // Cirurgião enviando justificativa — nunca conclui.
          nextStatus = "justificativa_respondida";
        } else if (step >= 1 && step < 5) {
          // Sub-passos intermediários do faturamento — apenas salvar, sem concluir.
          nextStatus = form.status || "pendente_faturamento";
        } else if (step === 5 && (form.status === "pendente_faturamento" || form.status === "concluido")) {
          // Faturamento só conclui no último sub-passo (Fechamento) e se o auditor já tiver liberado.
          nextStatus = "concluido";
        } else {
          setSaving(false);
          toast.error("Faturamento só fica disponível após o Médico Auditor liberar a justificativa.");
          return;
        }
      }

      // Sincronizar dados do responsável e exames se necessário
      const requester_name = form.requester_name || form.responsible_name;
      const requester_register = form.requester_register || form.responsible_register;

      // Upload de arquivos se houver novos
      const [uploadedPreop, uploadedConsumption, uploadedPostop] = await Promise.all([
        uploadExamFiles(preopExams),
        uploadExamFiles(consumptionExams),
        uploadExamFiles(postopExams)
      ]);

      // Always use current state for exams to allow deletions
      const preop_exams_details = uploadedPreop;
      const preop_image_types = uploadedPreop.map(e => e.type);
      const preop_image_count = uploadedPreop.length;
      const preop_image_attached = uploadedPreop.length > 0;
      
      const consumption_exams_details = uploadedConsumption;
      
      const postop_exams_details = uploadedPostop;
      const postop_image_types = uploadedPostop.map(e => e.type);
      const postop_image_count = uploadedPostop.length;
      const postop_image_attached = uploadedPostop.length > 0;

      // Upload da AIH se houver um novo arquivo
      let billing_aih_file_url = form.billing_aih_file_url;
      if (aihFile) {
        const url = await uploadFile(aihFile);
        if (url) billing_aih_file_url = url;
      }

      const dateFields = [
        "patient_birthdate", "procedure_date", "preop_exam_date", 
        "auditor_pre_date", "request_date", "warehouse_date", 
        "cme_processing_date", "surgery_dispatch_date", "postop_exam_date", 
        "auditor_post_date", "incident_date"
      ];

      const { id, ...sanitizedForm } = form;
      dateFields.forEach(field => {
        if (sanitizedForm[field] === "") {
          sanitizedForm[field] = null;
        }
      });

      const payload = { 
        ...sanitizedForm,
        requester_name,
        requester_register,
        preop_image_types,
        preop_image_count,
        preop_image_attached,
         preop_exams_details,
          consumption_exams_details,
          postop_exams_details,
          postop_image_types,
          postop_image_count,
          postop_image_attached,
          billing_aih_file_url,
         status: nextStatus,
        created_by: user.id, 
        updated_at: new Date().toISOString() 
      };
      
      let result;
      if (recordId) {
        result = await supabase.from("opme_requests").update(payload).eq("id", recordId).select().single();
      } else {
        result = await supabase.from("opme_requests").insert(payload).select().single();
      }

      if (result.error) throw result.error;

      // Se foi um novo registro, atualizar URL para permitir edições subsequentes
      if (!recordId && result.data) {
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set("id", result.data.id);
        window.history.pushState({}, '', newUrl);
        setForm(result.data);
        setRecordId(result.data.id);
      }
      
      toast.success("Pedido enviado com sucesso!");
      setPart(null);
      setStep(0);
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    // GUARDA: cirurgião na tela de justificativa NUNCA pode pular para faturamento.
    if (part === 4 && step === 0 && (form.status === "aguardando_justificativa" || form.status === "justificativa_respondida")) {
      toast.error("Use o botão 'Enviar Justificativa ao Auditor'. Só o auditor pode liberar o faturamento.");
      return;
    }
    // Sincronizar dados do responsável ao avançar da Parte 1 para a Parte 2
    if (part === 1 && step === STEPS.length - 1) {
      setForm((p: any) => ({
        ...p,
        requester_name: p.requester_name || p.responsible_name,
        requester_register: p.requester_register || p.responsible_register
      }));
    }

    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      // Lógica de transição de partes
      if (part === 1) { setPart(2); setStep(0); }
      else if (part === 2) { setPart(3); setStep(0); }
      else if (part === 3) {
        if (step === 0) { setPart(5); setStep(0); }
        else { setPart(4); setStep(0); }
      }
      else if (part === 5) { setPart(6); setStep(0); }
      else if (part === 6) { setPart(3); setStep(1); } // Após consumo vai para Auditoria Pós (part 3, step 1)
    }
  };

  const prev = () => {
    if (step > 0) {
      setStep(step - 1);
    } else {
      setPart(null);
      setStep(0);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (part === null) {
    return (
      <div className={embedded ? "flex flex-col" : "min-h-screen bg-slate-50 flex flex-col"}>
        {!embedded && (
          <header className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-20">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="text-center">
              <h1 className="text-base font-bold text-slate-900 uppercase tracking-wider">Módulos OPME</h1>
              <p className="text-xs text-slate-500 uppercase">Gestão Hospitalar</p>
            </div>
            <div className="w-10" />
          </header>
        )}

        <main className="flex-1 p-4 sm:p-6 overflow-y-auto pb-10 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-6">
            {[
              { id: 1, title: "Cadastro", description: "Identificação do paciente e procedimento" },
              { id: 2, title: "Requisição", description: "Solicitação de OPME e justificativa" },
              { id: 3, title: "Auditoria", description: "Validação pré e pós-operatória" },
              { id: 5, title: "Controle Administrativo", description: "Logística, CME e rastreabilidade" },
              { id: 6, title: "Consumo", description: "Registro de uso cirúrgico" },
              { id: 4, title: "Faturamento", description: "AIH, glosas e fechamento do dossiê" },
            ].map((card) => (
              <button
                key={card.id}
                onClick={() => setPart(card.id)}
                className="kpi-card group w-full cursor-pointer text-left min-h-[70px] sm:min-h-0"
              >
                <h3 className="font-display font-semibold text-foreground group-hover:text-primary transition-colors text-sm sm:text-base leading-tight">
                  {card.title}
                </h3>
                <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-muted-foreground leading-tight">
                  {card.description}
                </p>
              </button>
            ))}
          </div>

          <div className="bg-white rounded-lg border border-slate-100 p-2 shadow-sm">
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
              {[
                { status: "pendente_requisicao", label: "Pedido" },
                { status: "pendente_auditoria", label: "Pré" },
                { status: "pendente_controle", label: "Adm" },
                { status: "pendente_consumo", label: "Uso" },
                { status: "pendente_auditoria_post", label: "Pós" },
                { status: "pendente_faturamento", label: "Fat" },
              ].map((item, i) => (
                <button 
                   key={i} 
                   onClick={() => handleStatusFilter(item.status)}
                   className={`flex items-center justify-center py-1.5 rounded-md border transition-all font-bold uppercase text-[8px] ${
                    filterStatus === item.status 
                      ? "bg-primary text-white border-primary shadow-sm" 
                       : "bg-white text-slate-400 border-slate-100 hover:border-primary/20"
                  }`}
                >
                  {item.label}
                </button>
              ))}

              <Popover>
                <PopoverTrigger asChild>
                  <button 
                     className={`flex items-center justify-center py-1.5 rounded-md border transition-all ${
                      filterDate 
                        ? "bg-primary text-white border-primary shadow-sm" 
                         : "bg-white text-slate-400 border-slate-100 hover:border-primary/20"
                    }`}
                  >
                    <CalendarIcon className="h-3.5 w-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={filterDate ? new Date(filterDate + 'T00:00:00') : undefined}
                    onSelect={handleDateFilter}
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
 
           <div className="space-y-4">
             <div className="flex items-center justify-between px-1">
               <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                 {filterStatus ? `Filtrando por: ${filterStatus.replace('_', ' ').toUpperCase()}` : "Lista de Trabalho"}
               </h3>
                {(filterStatus || filterDate) && (
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] uppercase font-bold text-primary" onClick={clearFilters}>Limpar Filtros</Button>
                )}
             </div>
             
             <div className="space-y-3">
               {filteredRequests.length > 0 ? (
                 filteredRequests.map((req) => (
                   <Card key={req.id} className="border-slate-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden" onClick={() => loadRequest(req)}>
                     <CardContent className="p-0">
                       <div className="p-4 flex items-center justify-between">
                         <div className="flex-1 min-w-0">
                           <div className="flex items-center gap-2 mb-1">
                             <h4 className="font-bold text-slate-900 truncate uppercase text-sm">{req.patient_name}</h4>
                             <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border ${
                               req.status === 'rascunho' ? 'bg-slate-100 text-slate-600 border-slate-200' :
                               req.status === 'pendente_requisicao' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                               req.status === 'pendente_auditoria' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                               req.status === 'pendente_controle' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                               req.status === 'pendente_consumo' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                               req.status === 'pendente_auditoria_post' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                               'bg-emerald-50 text-emerald-600 border-emerald-100'
                             }`}>
                               {req.status?.replace('_', ' ')}
                             </span>
                           </div>
                            <div className="flex items-center gap-4 text-[11px] text-slate-500 font-medium">
                              <span>{req.procedure_date ? new Date(req.procedure_date).toLocaleDateString('pt-BR') : '---'}</span>
                              <span className="truncate">{req.requester_name || req.responsible_name || 'Não inf.'}</span>
                              {req.billing_aih_number && <span className="text-[10px] bg-slate-100 px-1 rounded border border-slate-200">AIH: {req.billing_aih_number}</span>}
                            </div>
                         </div>
                            <div className="flex items-center gap-2">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-slate-300 hover:text-destructive hover:bg-destructive/5 transition-colors"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <X size={18} />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle className="text-destructive flex items-center gap-2 font-bold uppercase tracking-tight">
                                      <Trash2 size={20} />
                                      Excluir Processo?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription className="text-slate-600 font-medium text-sm">
                                      Atenção: Ao excluir, você perderá TODO o processo e progresso permanentemente. Esta ação não pode ser desfeita.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteRequest(req.id);
                                      }}
                                      className="bg-destructive text-white hover:bg-destructive/90 font-bold uppercase text-xs"
                                    >
                                      Sim, Excluir Tudo
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                       </div>
                     </CardContent>
                   </Card>
                 ))
               ) : (
                 <div className="bg-white border border-dashed border-slate-200 rounded-xl p-10 text-center">
                   <p className="text-sm text-slate-400 font-medium">Nenhum pedido encontrado nesta categoria.</p>
                 </div>
               )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  const sendSurgeonJustification = async () => {
    if (uploadingJustification || saving) return;
    if (!(form.surgeon_justification || "").trim()) { toast.error("Preencha a justificativa técnica."); return; }
    if (!recordId) { toast.error("Salve o pedido antes de enviar a justificativa."); return; }
    setUploadingJustification(true);
    try {
      const uploaded: Array<{ name: string; url: string; mime: string; size: number; uploaded_at: string }> = [];
      for (const item of surgeonJustificationFiles) {
        const url = await uploadFile(item.file);
        if (!url) {
          toast.error(`Falha no upload do anexo ${item.name}.`);
          setUploadingJustification(false);
          return;
        }
        uploaded.push({
          name: item.name,
          url,
          mime: item.mime,
          size: item.size,
          uploaded_at: new Date().toISOString(),
        });
      }
      const previousAttachments = Array.isArray(form.surgeon_justification_attachments) ? form.surgeon_justification_attachments : [];
      const allAttachments = [...previousAttachments, ...uploaded];
      const sentAt = new Date().toISOString();
      const sentBy = user?.email || user?.id || "Cirurgião";

      // Atualiza diretamente no banco para evitar perder anexos por estado defasado.
      setSaving(true);
      const { error: updErr } = await supabase
        .from("opme_requests")
        .update({
          surgeon_justification: form.surgeon_justification,
          surgeon_justification_at: sentAt,
          surgeon_justification_by: sentBy,
          surgeon_justification_attachments: allAttachments,
          status: "justificativa_respondida",
          updated_at: new Date().toISOString(),
        })
        .eq("id", recordId);
      if (updErr) throw updErr;

      setForm((p: any) => ({
        ...p,
        surgeon_justification_at: sentAt,
        surgeon_justification_by: sentBy,
        surgeon_justification_attachments: allAttachments,
        status: "justificativa_respondida",
      }));
      setSurgeonJustificationFiles([]);
      toast.success("Justificativa enviada ao auditor.");
      setPart(null);
      setStep(0);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao enviar justificativa.");
    } finally {
      setUploadingJustification(false);
      setSaving(false);
    }
  };

  return (
    <div className={embedded ? "flex flex-col" : "min-h-screen bg-slate-50 flex flex-col"}>
      {!embedded && (
        <header className="bg-white border-b px-4 py-4 flex items-center justify-between sticky top-0 z-20">
          <Button variant="ghost" size="icon" onClick={() => setPart(null)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="text-center">
            <h1 className="text-sm font-bold text-slate-900 uppercase tracking-wider">{currentStepTitle}</h1>
            <p className="text-[10px] text-slate-500 uppercase">{headerSubtitle}</p>
          </div>
          <div className="w-10" />
        </header>
      )}

      <div className="flex h-1 bg-slate-200">
        {STEPS.map((_, i) => (
          <div 
            key={i} 
            className={`flex-1 transition-all duration-300 ${i <= step ? "bg-primary" : ""}`} 
          />
        ))}
      </div>

      <main className="flex-1 p-4 pb-24">
        {embedded && (
          <div className="mb-3">
            <Button variant="outline" size="sm" onClick={() => { setPart(null); setStep(0); }} className="rounded-full">
              Voltar
            </Button>
            <div className="mt-2">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">{currentStepTitle}</h2>
              <p className="text-[11px] text-slate-500 uppercase">{headerSubtitle}</p>
            </div>
          </div>
        )}
        <AnimatePresence mode="wait">
          <motion.div
            key={`${part}-${step}`}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            {/* --- PARTE 1: CADASTRO --- */}
            {part === 1 && step === 0 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Unidade de Saúde</Label>
                  <Select value={form.facility_unit} onValueChange={(v) => updateForm("facility_unit", v)}>
                    <SelectTrigger className="h-12 bg-white shadow-sm border-slate-200">
                      <SelectValue placeholder="Selecione a unidade" />
                    </SelectTrigger>
                    <SelectContent>
                      {facilities.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Nome Completo</Label>
                  <Input value={form.patient_name} onChange={e => updateForm("patient_name", e.target.value)} placeholder="Nome do paciente" className="h-12 bg-white shadow-sm border-slate-200" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase text-slate-500">Nascimento</Label>
                    <Input type="date" value={form.patient_birthdate} onChange={e => updateForm("patient_birthdate", e.target.value)} className="h-12 bg-white shadow-sm border-slate-200" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase text-slate-500">Prontuário</Label>
                    <Input value={form.patient_record} onChange={e => updateForm("patient_record", e.target.value)} placeholder="Nº Registro" className="h-12 bg-white shadow-sm border-slate-200" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Nome da Mãe</Label>
                  <Input value={form.patient_mother_name} onChange={e => updateForm("patient_mother_name", e.target.value)} placeholder="Nome completo da mãe" className="h-12 bg-white shadow-sm border-slate-200" />
                </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase text-slate-500">Cartão SUS</Label>
                      <Input value={form.patient_sus} onChange={e => updateForm("patient_sus", e.target.value)} placeholder="Número do CNS" className="h-12 bg-white shadow-sm border-slate-200" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase text-slate-500">Nº AIH (Opcional)</Label>
                      <Input value={form.billing_aih_number} onChange={e => updateForm("billing_aih_number", e.target.value)} placeholder="000.000.000-0" className="h-12 bg-white shadow-sm border-slate-200" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase text-slate-500">Anexar AIH</Label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input 
                            type="file" 
                            className="absolute inset-0 opacity-0 cursor-pointer z-10" 
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                               if (file) {
                                 const url = URL.createObjectURL(file);
                                 setAihFile(file);
                                 updateForm("billing_aih_file_url", url);
                                 toast.success("AIH anexada!");
                               }
                            }} 
                          />
                          <Button 
                            variant="outline" 
                            type="button"
                            className={`w-full h-12 text-[10px] font-bold uppercase border-dashed border-2 flex gap-2 px-2 ${form.billing_aih_file_url ? 'border-emerald-500 text-emerald-600 bg-emerald-50' : 'text-slate-400'}`}
                          >
                            {form.billing_aih_file_url ? <><FileText size={14} /> Anexada</> : <><Upload size={14} /> Subir</>}
                          </Button>
                        </div>
                        {form.billing_aih_file_url && (
                          <Button
                            variant="outline"
                            type="button"
                            className="h-12 px-3 border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                            onClick={() => window.open(form.billing_aih_file_url, "_blank")}
                            title="Visualizar AIH"
                          >
                            <Eye size={18} />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase text-slate-500">Data de Internação</Label>
                    <Input type="date" value={form.billing_admission_date || ""} onChange={e => updateForm("billing_admission_date", e.target.value)} className="h-12 bg-white shadow-sm border-slate-200" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase text-slate-500">Data de Alta (se houver)</Label>
                    <Input type="date" value={form.billing_discharge_date || ""} onChange={e => updateForm("billing_discharge_date", e.target.value)} className="h-12 bg-white shadow-sm border-slate-200" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase text-slate-500">Responsável pelo Procedimento</Label>
                    <Input value={form.responsible_name} onChange={e => updateForm("responsible_name", e.target.value)} placeholder="Nome do profissional" className="h-12 bg-white shadow-sm border-slate-200" />
                  </div>
                   <div className="space-y-2">
                     <Label className="text-xs font-semibold uppercase text-slate-500">Conselho (CRM/COREN)</Label>
                     <Input value={form.responsible_register} onChange={e => updateForm("responsible_register", e.target.value)} placeholder="Nº Registro" className="h-12 bg-white shadow-sm border-slate-200" />
                   </div>
                 </div>
               </div>
               )}

            {part === 1 && step === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Data do Procedimento</Label>
                  <Input type="date" value={form.procedure_date} onChange={e => updateForm("procedure_date", e.target.value)} className="h-12 bg-white shadow-sm border-slate-200" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Tipo</Label>
                  <Select value={form.procedure_type} onValueChange={(v) => updateForm("procedure_type", v)}>
                    <SelectTrigger className="h-12 bg-white shadow-sm border-slate-200">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="eletivo">Eletivo</SelectItem>
                      <SelectItem value="urgencia">Urgência</SelectItem>
                      <SelectItem value="emergencia">Emergência</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 relative">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Nome do Procedimento</Label>
                  <Input value={form.procedure_name} onChange={e => updateForm("procedure_name", e.target.value)} placeholder="Nome conforme SIGTAP" className="h-12 bg-white shadow-sm border-slate-200" />
                  {sigtapSuggestions.length > 0 && (
                    <div className="absolute z-50 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-auto">
                      {sigtapSuggestions.map((item) => (
                        <button key={item.code} type="button" className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-0" onClick={() => {
                          setForm((p: any) => ({ ...p, procedure_name: item.name, procedure_sigtap_code: item.code }));
                          setSigtapSuggestions([]);
                        }}>
                          <p className="text-xs font-bold text-slate-800">{item.name}</p>
                          <p className="text-[10px] text-slate-500 uppercase">Cód: {item.code}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase text-slate-500">Cód. SIGTAP</Label>
                    <Input value={form.procedure_sigtap_code} onChange={e => updateForm("procedure_sigtap_code", e.target.value)} placeholder="00.00.00.00" className="h-12 bg-white shadow-sm border-slate-200" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase text-slate-500">Sala / Setor</Label>
                    <Input value={form.procedure_room} onChange={e => updateForm("procedure_room", e.target.value)} placeholder="Ex: Sala 01" className="h-12 bg-white shadow-sm border-slate-200" />
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase text-slate-400">Lateralidade</Label>
                    <Select value={form.procedure_side_cadastro} onValueChange={(v) => updateForm("procedure_side_cadastro", v)}>
                      <SelectTrigger className="h-10 bg-white shadow-sm border-slate-200 text-xs">
                        <SelectValue placeholder="Lado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Direita">Direita</SelectItem>
                        <SelectItem value="Esquerda">Esquerda</SelectItem>
                        <SelectItem value="Bilateral">Bilateral</SelectItem>
                        <SelectItem value="Central">Central</SelectItem>
                        <SelectItem value="N/A">N/A</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase text-slate-400">Região</Label>
                    <Select value={form.procedure_region_cadastro} onValueChange={(v) => {
                      updateForm("procedure_region_cadastro", v);
                      updateForm("procedure_segment_cadastro", "");
                    }}>
                      <SelectTrigger className="h-10 bg-white shadow-sm border-slate-200 text-xs">
                        <SelectValue placeholder="Região" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(ANATOMY_DATA).map(reg => (
                          <SelectItem key={reg} value={reg}>{reg}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase text-slate-400">Segmento</Label>
                    <Select 
                      value={form.procedure_segment_cadastro} 
                      onValueChange={(v) => updateForm("procedure_segment_cadastro", v)}
                      disabled={!form.procedure_region_cadastro}
                    >
                      <SelectTrigger className="h-10 bg-white shadow-sm border-slate-200 text-xs">
                        <SelectValue placeholder="Parte/Nível" />
                      </SelectTrigger>
                      <SelectContent>
                        {form.procedure_region_cadastro && ANATOMY_DATA[form.procedure_region_cadastro]?.map(seg => (
                          <SelectItem key={seg} value={seg}>{seg}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase text-slate-400">Posição</Label>
                    <Select value={form.procedure_position_cadastro} onValueChange={(v) => updateForm("procedure_position_cadastro", v)}>
                      <SelectTrigger className="h-10 bg-white shadow-sm border-slate-200 text-xs">
                        <SelectValue placeholder="Posição" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Proximal">Proximal</SelectItem>
                        <SelectItem value="Médio">Médio</SelectItem>
                        <SelectItem value="Distal">Distal</SelectItem>
                        <SelectItem value="Anterior">Anterior</SelectItem>
                        <SelectItem value="Posterior">Posterior</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {part === 1 && step === 2 && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Adicionar Exame de Imagem</Label>
                  <Select onValueChange={(v) => {
                    if (!v) return;
                    const newExam = { id: Math.random().toString(36), type: v, date: "", file: null, url: "" };
                    setPreopExams(prev => [...prev, newExam]);
                  }}>
                    <SelectTrigger className="h-12 bg-white shadow-sm border-slate-200 text-sm">
                      <SelectValue placeholder="Selecione o exame para anexar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Radiografia">Radiografia</SelectItem>
                      <SelectItem value="Tomografia">Tomografia</SelectItem>
                      <SelectItem value="Ressonância">Ressonância</SelectItem>
                      <SelectItem value="Ultrassonografia">Ultrassonografia</SelectItem>
                      <SelectItem value="Ecocardiograma">Ecocardiograma</SelectItem>
                      <SelectItem value="Cintilografia">Cintilografia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {preopExams.map((exam, idx) => (
                    <Card key={exam.id} className="border-slate-100 shadow-md overflow-hidden bg-white">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-black text-[10px]">IMG</div>
                            <span className="text-sm font-bold text-slate-900">{exam.type}</span>
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400" onClick={() => {
                            setPreopExams(prev => prev.filter(e => e.id !== exam.id));
                          }}>×</Button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase text-slate-400 font-bold">Data do Exame</Label>
                            <Input type="date" className="h-9 text-xs" value={exam.date} onChange={(e) => {
                              const newExams = [...preopExams];
                              newExams[idx].date = e.target.value;
                              setPreopExams(newExams);
                            }} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase text-slate-400 font-bold">Documento</Label>
                            {exam.url ? (
                              <Button variant="outline" className="w-full h-9 text-[10px] font-bold uppercase border-emerald-100 bg-emerald-50 text-emerald-700" onClick={() => window.open(exam.url, "_blank")}>Ver Arquivo</Button>
                            ) : (
                              <div className="relative">
                                <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const url = URL.createObjectURL(file);
                                    const newExams = [...preopExams];
                                    newExams[idx].file = file;
                                    newExams[idx].url = url;
                                    setPreopExams(newExams);
                                  }
                                }} />
                                <Button variant="outline" className="w-full h-9 text-[10px] font-bold uppercase border-dashed">+ Upload</Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="space-y-2 pt-4">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Achados / Descrição Clínica</Label>
                  <Textarea value={form.preop_finding_description} onChange={e => updateForm("preop_finding_description", e.target.value)} placeholder="Descreva brevemente os achados..." className="min-h-[100px] bg-white border-slate-200" />
                </div>
              </div>
            )}

            {/* --- PARTE 2: REQUISIÇÃO --- */}
            {part === 2 && step === 0 && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase text-primary tracking-widest border-b pb-1">1. Identificação do Paciente</h3>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <Label className="text-xs font-semibold uppercase text-slate-500">Nome Completo</Label>
                      <p className="font-medium text-slate-900">{form.patient_name || "Não informado"}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <Label className="text-xs font-semibold uppercase text-slate-500">Prontuário</Label>
                        <p className="font-medium text-slate-900">{form.patient_record || "---"}</p>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <Label className="text-xs font-semibold uppercase text-slate-500">Nascimento</Label>
                        <p className="font-medium text-slate-900">{form.patient_birthdate ? new Date(form.patient_birthdate).toLocaleDateString('pt-BR') : "---"}</p>
                      </div>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <Label className="text-xs font-semibold uppercase text-slate-500">Nome da Mãe</Label>
                      <p className="font-medium text-slate-900">{form.patient_mother_name || "---"}</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <Label className="text-xs font-semibold uppercase text-slate-500">Cartão SUS</Label>
                      <p className="font-medium text-slate-900">{form.patient_sus || "---"}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <Label className="text-xs font-semibold uppercase text-slate-500">Responsável</Label>
                        <p className="font-medium text-slate-900">{form.responsible_name || "---"}</p>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <Label className="text-xs font-semibold uppercase text-slate-500">Conselho</Label>
                        <p className="font-medium text-slate-900">{form.responsible_register || "---"}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase text-primary tracking-widest border-b pb-1">2. Dados do Procedimento</h3>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <Label className="text-xs font-semibold uppercase text-slate-500">Data Prevista</Label>
                        <p className="font-medium text-slate-900">{form.procedure_date ? new Date(form.procedure_date).toLocaleDateString('pt-BR') : "---"}</p>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <Label className="text-xs font-semibold uppercase text-slate-500">Tipo</Label>
                        <p className="font-medium text-slate-900 uppercase">{form.procedure_type}</p>
                      </div>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <Label className="text-xs font-semibold uppercase text-slate-500">Procedimento (SIGTAP)</Label>
                      <p className="font-medium text-slate-900">{form.procedure_name || "Não informado"}</p>
                      <p className="text-xs text-slate-500 font-mono mt-1">CÓD: {form.procedure_sigtap_code || "---"}</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <Label className="text-xs font-semibold uppercase text-slate-500">Sala / Setor</Label>
                      <p className="font-medium text-slate-900">{form.procedure_room || "---"}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {part === 2 && step === 1 && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase text-primary tracking-widest border-b pb-1">3. Profissional Solicitante</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase text-slate-500">Nome do Profissional</Label>
                      <Input value={form.requester_name} onChange={e => updateForm("requester_name", e.target.value)} placeholder="Carimbo ou Identificação" className="h-12 bg-white shadow-sm border-slate-200" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase text-slate-500">Registro Profissional (CRM/CRO)</Label>
                      <Input value={form.requester_register} onChange={e => updateForm("requester_register", e.target.value)} placeholder="Ex: 12345-UF" className="h-12 bg-white shadow-sm border-slate-200" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase text-primary tracking-widest border-b pb-1">Localização Cirúrgica</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase text-slate-500">Lateralidade</Label>
                      <Select value={form.procedure_side_requisicao} onValueChange={(v) => updateForm("procedure_side_requisicao", v)}>
                        <SelectTrigger className="h-12 bg-white shadow-sm border-slate-200">
                          <SelectValue placeholder="Lado" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Direita">Direita</SelectItem>
                          <SelectItem value="Esquerda">Esquerda</SelectItem>
                          <SelectItem value="Bilateral">Bilateral</SelectItem>
                          <SelectItem value="Central">Central</SelectItem>
                          <SelectItem value="N/A">N/A</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase text-slate-400">Região</Label>
                      <Select value={form.procedure_region_requisicao} onValueChange={(v) => {
                        updateForm("procedure_region_requisicao", v);
                        updateForm("procedure_segment_requisicao", "");
                      }}>
                        <SelectTrigger className="h-10 bg-white shadow-sm border-slate-200 text-xs font-semibold">
                          <SelectValue placeholder="Região" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.keys(ANATOMY_DATA).map(reg => (
                            <SelectItem key={reg} value={reg}>{reg}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase text-slate-400">Segmento</Label>
                      <Select 
                        value={form.procedure_segment_requisicao} 
                        onValueChange={(v) => updateForm("procedure_segment_requisicao", v)}
                        disabled={!form.procedure_region_requisicao}
                      >
                        <SelectTrigger className="h-10 bg-white shadow-sm border-slate-200 text-xs font-semibold">
                          <SelectValue placeholder="Parte/Nível" />
                        </SelectTrigger>
                        <SelectContent>
                          {form.procedure_region_requisicao && ANATOMY_DATA[form.procedure_region_requisicao]?.map(seg => (
                            <SelectItem key={seg} value={seg}>{seg}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase text-slate-400">Posição</Label>
                      <Select value={form.procedure_position_requisicao} onValueChange={(v) => updateForm("procedure_position_requisicao", v)}>
                        <SelectTrigger className="h-10 bg-white shadow-sm border-slate-200 text-xs font-semibold">
                          <SelectValue placeholder="Posição" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Proximal">Proximal</SelectItem>
                          <SelectItem value="Médio">Médio</SelectItem>
                          <SelectItem value="Distal">Distal</SelectItem>
                          <SelectItem value="Anterior">Anterior</SelectItem>
                          <SelectItem value="Posterior">Posterior</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {(form.procedure_side_cadastro !== form.procedure_side_requisicao || 
                    form.procedure_region_cadastro !== form.procedure_region_requisicao || 
                    form.procedure_segment_cadastro !== form.procedure_segment_requisicao ||
                    form.procedure_position_cadastro !== form.procedure_position_requisicao) && 
                    form.procedure_side_requisicao && (
                    <div className="p-4 rounded-lg bg-red-50 border border-red-100 flex flex-col gap-2 mt-4">
                      <div className="flex items-center gap-2">
                        <span className="text-red-500">⚠️</span>
                        <p className="text-sm font-bold text-red-700 uppercase tracking-tight">Divergência Detectada:</p>
                      </div>
                      <div className="pl-6 text-xs text-red-600 font-medium space-y-1">
                        {form.procedure_side_cadastro !== form.procedure_side_requisicao && <p>• Lado: {form.procedure_side_cadastro || 'Não inf.'} → {form.procedure_side_requisicao}</p>}
                        {form.procedure_region_cadastro !== form.procedure_region_requisicao && <p>• Região: {form.procedure_region_cadastro || 'Não inf.'} → {form.procedure_region_requisicao}</p>}
                        {form.procedure_segment_cadastro !== form.procedure_segment_requisicao && <p>• Segmento: {form.procedure_segment_cadastro || 'Não inf.'} → {form.procedure_segment_requisicao}</p>}
                        {form.procedure_position_cadastro !== form.procedure_position_requisicao && <p>• Posição: {form.procedure_position_cadastro || 'Não inf.'} → {form.procedure_position_requisicao}</p>}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {part === 2 && step === 2 && (
              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase text-primary tracking-widest border-b pb-1">4. OPME Solicitada</h3>
                <div className="space-y-3">
                  {toList(form.opme_requested).map((item: any, idx: number) => (
                    <Card key={idx} className="border-slate-200 shadow-sm overflow-hidden">
                      <CardContent className="p-0">
                        <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-500 uppercase">Item #{String(idx + 1).padStart(2, '0')}</span>
                          {toList(form.opme_requested).length > 1 && (
                            <Button variant="ghost" size="sm" className="h-6 px-2 text-destructive text-[10px] font-bold" onClick={() => setForm((p: any) => ({ ...p, opme_requested: toList(p.opme_requested).filter((_: any, i: number) => i !== idx) }))}>Remover</Button>
                          )}
                        </div>
                        <div className="p-4 space-y-4">
                          <div className="space-y-2 relative">
                            <Label className="text-xs font-semibold uppercase text-slate-500">Descrição / Especificação</Label>
                            <Input value={item.description} onChange={e => updateItem(idx, "description", e.target.value)} placeholder="Ex: Prótese de quadril..." className="h-12 bg-white border-slate-200" />
                            {materialSuggestions.idx === idx && materialSuggestions.items.length > 0 && (
                              <div className="absolute z-50 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-auto">
                                {materialSuggestions.items.map((m) => (
                                  <button key={m.code} type="button" className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-0" onClick={() => {
                                     const arr = [...toList(form.opme_requested)]; arr[idx] = { ...arr[idx], description: m.name, sigtap: m.code };
                                    setForm((p: any) => ({ ...p, opme_requested: arr })); setMaterialSuggestions({ idx: -1, items: [] });
                                  }}>
                                    <p className="text-xs font-bold text-slate-800">{m.name}</p>
                                    <p className="text-[10px] text-slate-500 uppercase">Cód: {m.code}</p>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-2">
                              <Label className="text-xs font-semibold uppercase text-slate-500">Qtd</Label>
                              <Input type="number" value={item.quantity} onChange={e => updateItem(idx, "quantity", e.target.value)} className="h-12 bg-white border-slate-200" />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs font-semibold uppercase text-slate-500">Tam/Mod</Label>
                              <Input value={item.size_model} onChange={e => updateItem(idx, "size_model", e.target.value)} placeholder="G/P/42" className="h-12 bg-white border-slate-200" />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs font-semibold uppercase text-slate-500">SIGTAP</Label>
                              <Input value={item.sigtap} onChange={e => updateItem(idx, "sigtap", e.target.value)} placeholder="000..." className="h-12 bg-white border-slate-200" />
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {toList(form.opme_requested).length < 10 && (
                    <Button variant="outline" className="w-full border-dashed border-2 h-12 text-xs font-bold uppercase text-slate-400 hover:text-primary transition-colors" onClick={() => addItem("opme_requested")}>+ Adicionar Material (Até 10)</Button>
                  )}
                </div>
              </div>
            )}

            {part === 2 && step === 3 && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase text-primary tracking-widest border-b pb-1">5. Instrumentais / Acessórios</h3>
                  <div className="grid grid-cols-1 gap-4 bg-white p-4 rounded-lg border border-slate-100 shadow-sm">
                    <div className="flex items-center space-x-2">
                      <Checkbox id="instr_spec" checked={form.instruments_specific} onCheckedChange={v => updateForm("instruments_specific", v)} />
                      <Label htmlFor="instr_spec" className="text-sm font-semibold text-slate-700">Necessita instrumental específico</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="instr_loan" checked={form.instruments_loan} onCheckedChange={v => updateForm("instruments_loan", v)} />
                      <Label htmlFor="instr_loan" className="text-sm font-semibold text-slate-700">Necessita comodato</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="instr_na" checked={form.instruments_na} onCheckedChange={v => updateForm("instruments_na", v)} />
                      <Label htmlFor="instr_na" className="text-sm font-semibold text-slate-700">Não se aplica</Label>
                    </div>
                    <div className="space-y-2 mt-2">
                      <Label className="text-xs font-semibold uppercase text-slate-500">Especificar Instrumentais</Label>
                      <Textarea value={form.instruments_specify} onChange={e => updateForm("instruments_specify", e.target.value)} placeholder="Descreva os itens..." className="min-h-[80px] text-sm bg-white border-slate-200" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase text-primary tracking-widest border-b pb-1">6. Justificativa OPME</h3>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase text-slate-500">Indicação Clínica / Evidência</Label>
                    <Textarea value={form.clinical_indication} onChange={e => updateForm("clinical_indication", e.target.value)} placeholder="Justificativa para uso de OPME..." className="min-h-[100px] text-sm bg-white border-slate-200 shadow-sm" />
                  </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase text-slate-500">CID Principal</Label>
                    <Input
                      value={form.billing_cid_main || ""}
                      onChange={e => updateForm("billing_cid_main", e.target.value.toUpperCase())}
                      placeholder="Ex: M17.1"
                      className="h-12 text-sm bg-white border-slate-200 shadow-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase text-slate-500">CID Secundário</Label>
                    <Input
                      value={form.billing_cid_secondary || ""}
                      onChange={e => updateForm("billing_cid_secondary", e.target.value.toUpperCase())}
                      placeholder="Opcional"
                      className="h-12 text-sm bg-white border-slate-200 shadow-sm"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 italic">CID definido pelo médico solicitante — será usado pelo Faturamento.</p>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase text-slate-500">Parecer da Comissão</Label>
                    <Select value={form.auditor_pre_analysis} onValueChange={(v) => updateForm("auditor_pre_analysis", v)}>
                      <SelectTrigger className="h-12 text-sm bg-white border-slate-200 shadow-sm">
                        <SelectValue placeholder="Status da análise" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="adequada">Aprovado</SelectItem>
                        <SelectItem value="reprovada">Reprovado</SelectItem>
                        <SelectItem value="em_analise">Em Análise</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h3 className="text-xs font-bold uppercase text-primary tracking-widest">7. Comprovação por Imagem</h3>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">PRÉ-OPERATÓRIO</span>
                  </div>

                   <div className="space-y-4">
                     <div className="space-y-2">
                       <Label className="text-xs font-semibold uppercase text-slate-500">Adicionar Exame de Imagem</Label>
                       <Select onValueChange={(v) => {
                         if (!v) return;
                         const newExam = { id: Math.random().toString(36), type: v, date: "", file: null, url: "" };
                         setPreopExams(prev => [...prev, newExam]);
                       }}>
                         <SelectTrigger className="h-12 bg-white shadow-sm border-slate-200 text-sm">
                           <SelectValue placeholder="Selecione o exame para anexar" />
                         </SelectTrigger>
                         <SelectContent>
                           <SelectItem value="Radiografia">Radiografia</SelectItem>
                           <SelectItem value="Tomografia">Tomografia</SelectItem>
                           <SelectItem value="Ressonância">Ressonância</SelectItem>
                           <SelectItem value="Ultrassonografia">Ultrassonografia</SelectItem>
                           <SelectItem value="Ecocardiograma">Ecocardiograma</SelectItem>
                           <SelectItem value="Cintilografia">Cintilografia</SelectItem>
                         </SelectContent>
                       </Select>
                     </div>
 
                     <div className="grid grid-cols-1 gap-4">
                       {preopExams.map((exam, idx) => (
                         <Card key={exam.id} className="border-slate-100 shadow-md overflow-hidden bg-white">
                           <CardContent className="p-4 space-y-3">
                             <div className="flex items-center justify-between">
                               <div className="flex items-center gap-2">
                                 <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-black text-[10px]">IMG</div>
                                 <span className="text-sm font-bold text-slate-900">{exam.type}</span>
                               </div>
                               <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400" onClick={() => {
                                 setPreopExams(prev => prev.filter(e => e.id !== exam.id));
                               }}>×</Button>
                             </div>
                             <div className="grid grid-cols-2 gap-3">
                               <div className="space-y-1">
                                 <Label className="text-[10px] uppercase text-slate-400 font-bold">Data do Exame</Label>
                                 <Input type="date" className="h-9 text-xs" value={exam.date} onChange={(e) => {
                                   const newExams = [...preopExams];
                                   newExams[idx].date = e.target.value;
                                   setPreopExams(newExams);
                                 }} />
                               </div>
                               <div className="space-y-1">
                                 <Label className="text-[10px] uppercase text-slate-400 font-bold">Documento</Label>
                                 {exam.url ? (
                                   <Button variant="outline" className="w-full h-9 text-[10px] font-bold uppercase border-emerald-100 bg-emerald-50 text-emerald-700" onClick={() => window.open(exam.url, "_blank")}>Ver Arquivo</Button>
                                 ) : (
                                   <div className="relative">
                                     <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => {
                                       const file = e.target.files?.[0];
                                       if (file) {
                                         const url = URL.createObjectURL(file);
                                         const newExams = [...preopExams];
                                         newExams[idx].file = file;
                                         newExams[idx].url = url;
                                         setPreopExams(newExams);
                                       }
                                     }} />
                                     <Button variant="outline" className="w-full h-9 text-[10px] font-bold uppercase border-dashed">+ Upload</Button>
                                   </div>
                                 )}
                               </div>
                             </div>
                           </CardContent>
                         </Card>
                       ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4 bg-white p-4 rounded-lg border border-slate-100 shadow-sm mt-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase text-slate-500">Data do Exame</Label>
                        <Input type="date" value={form.preop_exam_date} onChange={e => updateForm("preop_exam_date", e.target.value)} className="h-12 bg-white" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase text-slate-500">Nº do Exame / Laudo</Label>
                        <Input value={form.preop_exam_number} onChange={e => updateForm("preop_exam_number", e.target.value)} className="h-12 bg-white" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase text-slate-500">Tipo de Exame Realizado</Label>
                      <div className="grid grid-cols-2 gap-3 mt-1">
                        {["Radiografia", "Tomografia", "Ressonância", "Ultrassonografia"].map(type => (
                          <div key={type} className="flex items-center space-x-2">
                            <Checkbox 
                              id={`pre_${type}`} 
                              checked={form.preop_image_types?.includes(type)} 
                              onCheckedChange={checked => {
                                const types = [...(form.preop_image_types || [])];
                                if (checked) types.push(type);
                                else return updateForm("preop_image_types", types.filter(t => t !== type));
                                updateForm("preop_image_types", types);
                              }} 
                            />
                            <Label htmlFor={`pre_${type}`} className="text-sm">{type}</Label>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase text-slate-500">Descrição dos Achados</Label>
                      <Textarea value={form.preop_finding_description} onChange={e => updateForm("preop_finding_description", e.target.value)} placeholder="Descrição da indicação..." className="min-h-[100px] text-sm bg-white" />
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
                      <div className="flex items-center space-x-2">
                        <Checkbox id="img_att" checked={form.preop_image_attached} onCheckedChange={v => updateForm("preop_image_attached", v)} />
                        <Label htmlFor="img_att" className="text-sm font-semibold">Imagem Anexada</Label>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Label className="text-xs font-semibold uppercase text-slate-500">Nº Anexos:</Label>
                        <Input type="number" value={form.preop_image_count} onChange={e => updateForm("preop_image_count", parseInt(e.target.value))} className="h-10 w-16 text-center" />
                      </div>
                    </div>
                    <div className="space-y-2 pt-4 border-t border-slate-50">
                      <Label className="text-xs font-semibold uppercase text-slate-500">Responsável Validação</Label>
                      <Input value={form.preop_validation_responsible} onChange={e => updateForm("preop_validation_responsible", e.target.value)} placeholder="Assinatura / Carimbo" className="h-12 bg-white" />
                    </div>
                  </div>
                </div>
              )}

            {part === 3 && (
              <div className="space-y-6 pb-6">
                {step === 0 && (
                  <div className="space-y-6">
                    <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 space-y-4">
                      <div className="flex items-center gap-2 mb-2 border-b border-primary/10 pb-2">
                        <div className="w-2 h-4 bg-primary rounded-full"></div>
                        <h3 className="text-[10px] font-black uppercase text-primary tracking-widest">Resumo para Auditoria</h3>
                      </div>

                    <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                      <div className="space-y-0.5">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Paciente</p>
                        <p className="text-xs font-bold text-slate-700 truncate">{form.patient_name || 'Não informado'}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Nascimento</p>
                        <p className="text-xs font-bold text-slate-700">{form.patient_birthdate ? new Date(form.patient_birthdate).toLocaleDateString('pt-BR') : '---'}</p>
                      </div>
                      <div className="col-span-2 space-y-0.5">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Procedimento</p>
                        <p className="text-xs font-bold text-slate-700">{form.procedure_name || 'Não informado'}</p>
                        <p className="text-[10px] text-slate-500 font-medium">SIGTAP: {form.procedure_sigtap_code || '---'}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Lateralidade/Local</p>
                        <p className="text-[11px] font-bold text-slate-700">
                          {form.procedure_side_requisicao || form.procedure_side_cadastro || 'N/A'} - {form.procedure_region_requisicao || form.procedure_region_cadastro || 'N/A'}
                        </p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Data Cirurgia</p>
                        <p className="text-xs font-bold text-slate-700">{form.procedure_date ? new Date(form.procedure_date).toLocaleDateString('pt-BR') : '---'}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Médico Solicitante</p>
                        <p className="text-xs font-bold text-slate-700 truncate">{form.requester_name || 'Não informado'}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Sala da Cirurgia</p>
                        <p className="text-xs font-bold text-slate-700">{form.procedure_room || 'Não informada'}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">AIH</p>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-slate-700">{form.billing_aih_number || 'Não inf.'}</p>
                          {form.billing_aih_file_url && (
                            <Button variant="ghost" size="icon" className="h-5 w-5 text-primary" onClick={() => window.open(form.billing_aih_file_url, "_blank")}>
                              <FileText size={12} />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 mt-2">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Indicação Clínica</p>
                      <div className="bg-white p-3 rounded-lg border border-slate-100 text-[11px] text-slate-600 font-medium leading-relaxed italic">
                        "{form.clinical_indication || 'Sem justificativa informada.'}"
                      </div>
                    </div>

                    <div className="space-y-3 mt-4">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Materiais Solicitados</p>
                      <div className="space-y-2">
                         {toList(form.opme_requested).length > 0 ? (
                           toList(form.opme_requested).map((item: any, i: number) => (
                            <div key={i} className="bg-white px-3 py-2 rounded-lg border border-slate-100 flex items-center justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-bold text-slate-800 truncate uppercase">{item.description}</p>
                                <p className="text-[9px] text-slate-500 font-medium">SIGTAP: {item.sigtap || '---'}</p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-[10px] font-black text-primary">QTD: {item.quantity}</p>
                                <p className="text-[9px] text-slate-400 font-bold uppercase">{item.size_model || '---'}</p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-[10px] text-slate-400 italic">Nenhum material listado.</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3 mt-4">
                       <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mb-1">Exames Anexados ({preopExams.filter(e => e.url).length})</p>
                      
                       {preopExams.filter(e => e.url).length > 0 ? (
                        <div className="grid grid-cols-2 gap-3">
                           {preopExams.filter(e => e.url).map((exam, i) => (
                             <div key={i} className="bg-white p-1 rounded-lg border border-slate-100 space-y-2 relative group flex flex-col h-full">
                               <div className="flex-1">
                                <div className="relative aspect-video rounded-md overflow-hidden border border-slate-50">
                                  <img src={exam.url} alt={exam.type} className="w-full h-full object-cover" />
                                  <button 
                                    onClick={() => window.open(exam.url, "_blank")}
                                    className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[8px] font-bold uppercase"
                                  >
                                    Ampliar
                                  </button>
                                </div>
                               </div>
                               <p className="text-[9px] font-black text-slate-700 uppercase px-1 py-1 truncate bg-slate-50/50 rounded-b-md">{exam.type}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                      <p className="col-span-2 text-[9px] text-slate-400 italic bg-slate-50/50 p-2 rounded border border-dashed text-center">Nenhum exame pré-operatório anexado.</p>
                      )}
                    </div>
                  </div>

                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-slate-500">Nome Auditor</Label>
                      <Input value={form.auditor_pre_name} onChange={e => updateForm("auditor_pre_name", e.target.value)} className="h-10 text-xs bg-white" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-slate-500">CRM</Label>
                      <Input value={form.auditor_pre_crm} onChange={e => updateForm("auditor_pre_crm", e.target.value)} className="h-10 text-xs bg-white" />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-slate-500">Análise</Label>
                      <Select value={form.auditor_pre_analysis} onValueChange={v => updateForm("auditor_pre_analysis", v)}>
                        <SelectTrigger className="h-10 text-xs bg-white"><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="adequada">Adequada</SelectItem>
                          <SelectItem value="inadequada">Inadequada</SelectItem>
                          <SelectItem value="complementacao">Complementação</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-slate-500">SIGTAP Compatível?</Label>
                      <Select value={form.auditor_pre_sigtap_compat} onValueChange={v => updateForm("auditor_pre_sigtap_compat", v)}>
                        <SelectTrigger className="h-10 text-xs bg-white"><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sim">Sim</SelectItem>
                          <SelectItem value="nao">Não</SelectItem>
                          <SelectItem value="parcial">Parcial</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase text-slate-500">Parecer Técnico Final</Label>
                        <Textarea value={form.auditor_pre_opinion} onChange={e => updateForm("auditor_pre_opinion", e.target.value)} placeholder="Descreva sua avaliação técnica aqui..." className="min-h-[100px] text-xs bg-white" />
                      </div>
                    </div>
                  </div>
                )}

                {step === 1 && (
                  <div className="space-y-6">
                    {/* === BLOCO DE REANÁLISE DA JUSTIFICATIVA DO CIRURGIÃO === */}
                    {(form.status === "justificativa_respondida" || (form.surgeon_justification && form.surgeon_justification.trim())) && (
                      <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 space-y-4">
                        <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                          <h3 className="text-[11px] font-black uppercase text-amber-900 tracking-widest">
                            Reanálise — Justificativa do Cirurgião
                          </h3>
                          {form.justification_round > 0 && (
                            <span className="text-[9px] font-bold uppercase bg-amber-200 text-amber-900 px-2 py-1 rounded-full">
                              Rodada {Number(form.justification_round) + 1}
                            </span>
                          )}
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold uppercase text-amber-800">Motivo solicitado por você</Label>
                          <p className="text-[11px] text-slate-800 bg-white p-2 rounded border border-amber-100 italic whitespace-pre-line">
                            "{form.auditor_post_justification_reason || '---'}"
                          </p>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold uppercase text-amber-800">Resposta enviada pelo cirurgião</Label>
                          <div className="bg-white p-3 rounded border border-amber-200">
                            <p className="text-[11px] text-slate-800 whitespace-pre-line">
                              {form.surgeon_justification || "Aguardando resposta do cirurgião."}
                            </p>
                            {form.surgeon_justification_at && (
                              <p className="text-[9px] text-slate-500 mt-2 font-medium">
                                Enviada por <span className="font-bold">{shortActorName(form.surgeon_justification_by)}</span> em {new Date(form.surgeon_justification_at).toLocaleString('pt-BR')}
                              </p>
                            )}
                            {Array.isArray(form.surgeon_justification_attachments) && form.surgeon_justification_attachments.length > 0 && (
                              <div className="mt-3 pt-2 border-t border-amber-100 space-y-1">
                                <p className="text-[9px] font-bold uppercase text-amber-800">Evidências anexadas ({form.surgeon_justification_attachments.length})</p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                  {form.surgeon_justification_attachments.map((a: any, idx: number) => (
                                    <a
                                      key={idx}
                                      href={a.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 rounded border border-slate-200 p-1.5 transition-colors"
                                    >
                                      {a.mime?.startsWith?.("image/") ? (
                                        <img src={a.url} alt={a.name} className="w-9 h-9 object-cover rounded" />
                                      ) : (
                                        <div className="w-9 h-9 flex items-center justify-center rounded bg-white border text-[8px] font-bold text-slate-500 uppercase">PDF</div>
                                      )}
                                      <span className="text-[10px] text-slate-700 truncate flex-1">{a.name || `arquivo ${idx + 1}`}</span>
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Histórico */}
                        {Array.isArray(form.justification_history) && form.justification_history.length > 0 && (
                          <details className="bg-white/50 rounded border border-amber-100 p-2">
                            <summary className="text-[10px] font-bold uppercase text-amber-800 cursor-pointer">Ver rodadas anteriores ({form.justification_history.length})</summary>
                            <div className="mt-2 space-y-2">
                              {form.justification_history.map((h: any, i: number) => (
                                <div key={i} className="text-[10px] border-l-2 border-amber-300 pl-2 py-1">
                                  <p className="font-bold text-slate-700 uppercase">Rodada {(h.round ?? i) + 1}</p>
                                  <p><span className="font-semibold">Motivo:</span> {h.auditor_reason || '---'}</p>
                                  <p><span className="font-semibold">Resposta:</span> {h.surgeon_justification || '---'}</p>
                                  {h.decision && (
                                    <p className="italic">
                                      Decisão: <span className={h.decision === 'liberada' ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>{h.decision === 'liberada' ? 'LIBERADA' : 'REPROVADA'}</span>
                                      {h.decision_notes ? ` — ${h.decision_notes}` : ''}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </details>
                        )}

                        {form.status === "justificativa_respondida" && (
                          <div className="space-y-3 pt-2 border-t border-amber-200">
                            <div className="space-y-1">
                              <Label className="text-[10px] font-bold uppercase text-amber-800">Comentário do auditor sobre a justificativa</Label>
                              <Textarea
                                value={form.auditor_post_justification_decision_notes || ""}
                                onChange={e => updateForm("auditor_post_justification_decision_notes", e.target.value)}
                                placeholder="Ex: justificativa aceita, material compatível com perfil clínico do paciente..."
                                className="min-h-[80px] text-xs bg-white"
                              />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <Button
                                className="h-11 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold uppercase"
                                disabled={saving}
                                onClick={() => {
                                  const previousHistory = Array.isArray(form.justification_history) ? form.justification_history : [];
                                  const newEntry = {
                                    round: Number(form.justification_round || 0),
                                    auditor_reason: form.auditor_post_justification_reason || "",
                                    surgeon_justification: form.surgeon_justification || "",
                                    surgeon_justification_at: form.surgeon_justification_at || null,
                                    surgeon_justification_by: form.surgeon_justification_by || null,
                                    attachments: Array.isArray(form.surgeon_justification_attachments) ? form.surgeon_justification_attachments : [],
                                    decision: "liberada",
                                    decision_at: new Date().toISOString(),
                                    decision_by: user?.email || user?.id || "Auditor",
                                    decision_notes: form.auditor_post_justification_decision_notes || ""
                                  };
                                  setForm((p: any) => ({
                                    ...p,
                                    auditor_post_justification_decision: "liberada",
                                    auditor_post_justification_decision_at: new Date().toISOString(),
                                    justification_history: [...previousHistory, newEntry],
                                    status: "justificativa_respondida" // handleSave decide próximo status
                                  }));
                                  setTimeout(() => handleSave(false), 50);
                                }}
                              >
                                Liberar para Faturamento
                              </Button>
                              <Button
                                variant="outline"
                                className="h-11 border-rose-300 text-rose-700 hover:bg-rose-50 text-[11px] font-bold uppercase"
                                disabled={saving || !(form.auditor_post_justification_decision_notes || "").trim()}
                                onClick={() => {
                                  const previousHistory = Array.isArray(form.justification_history) ? form.justification_history : [];
                                  const newEntry = {
                                    round: Number(form.justification_round || 0),
                                    auditor_reason: form.auditor_post_justification_reason || "",
                                    surgeon_justification: form.surgeon_justification || "",
                                    surgeon_justification_at: form.surgeon_justification_at || null,
                                    surgeon_justification_by: form.surgeon_justification_by || null,
                                    attachments: Array.isArray(form.surgeon_justification_attachments) ? form.surgeon_justification_attachments : [],
                                    decision: "reprovada",
                                    decision_at: new Date().toISOString(),
                                    decision_by: user?.email || user?.id || "Auditor",
                                    decision_notes: form.auditor_post_justification_decision_notes || ""
                                  };
                                  setForm((p: any) => ({
                                    ...p,
                                    auditor_post_justification_decision: "reprovada",
                                    auditor_post_justification_decision_at: new Date().toISOString(),
                                    auditor_post_justification_reason: p.auditor_post_justification_decision_notes || p.auditor_post_justification_reason,
                                    justification_history: [...previousHistory, newEntry],
                                    justification_round: Number(p.justification_round || 0) + 1,
                                    surgeon_justification: "",
                                    surgeon_justification_at: null,
                                    surgeon_justification_by: null,
                                    surgeon_justification_attachments: [],
                                    auditor_post_justification_decision_notes: "",
                                    status: "justificativa_respondida" // handleSave usa decision=reprovada para mandar de volta
                                  }));
                                  setTimeout(() => handleSave(false), 50);
                                }}
                              >
                                Reprovar e solicitar nova
                              </Button>
                            </div>
                            <p className="text-[9px] text-amber-700 italic">Para reprovar é obrigatório informar o comentário (será o novo motivo enviado ao cirurgião).</p>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 space-y-4">
                      <div className="flex items-center justify-between gap-3 border-b border-primary/10 pb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-4 bg-primary rounded-full"></div>
                          <h3 className="text-[10px] font-black uppercase text-primary tracking-widest">Dossiê Consolidado Pós-OP</h3>
                        </div>
                        <Button variant="outline" size="sm" className="h-8 rounded-full text-[10px] font-bold uppercase" onClick={generateAuditDossierPdf}>Gerar PDF</Button>
                      </div>

                      <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                        <div className="space-y-0.5">
                          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">Paciente</p>
                          <p className="text-xs font-bold text-foreground truncate">{form.patient_name || 'Não informado'}</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">Unidade</p>
                          <p className="text-xs font-bold text-foreground truncate">{form.facility_unit || 'Não informada'}</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">Registro / SUS</p>
                          <p className="text-xs font-bold text-foreground">{form.patient_record || '---'} / {form.patient_sus || '---'}</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">Nascimento</p>
                          <p className="text-xs font-bold text-foreground">{formatDateBR(form.patient_birthdate)}</p>
                        </div>
                        <div className="col-span-2 space-y-0.5">
                          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">Procedimento</p>
                          <p className="text-xs font-bold text-foreground">{form.procedure_name || 'Não informado'}</p>
                          <p className="text-[10px] text-muted-foreground font-medium">SIGTAP: {form.procedure_sigtap_code || '---'} | Data: {formatDateBR(form.procedure_date)} | Sala: {form.procedure_room || '---'}</p>
                        </div>
                        <div className="col-span-2 space-y-0.5">
                          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">Indicação Clínica</p>
                          <div className="bg-background p-3 rounded-lg border border-border text-[11px] text-foreground font-medium leading-relaxed">
                            {form.clinical_indication || 'Sem indicação clínica registrada.'}
                          </div>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">Auditoria Pré-OP</p>
                          <p className="text-xs font-bold text-foreground">{form.auditor_pre_analysis || '---'} | SIGTAP {form.auditor_pre_sigtap_compat || '---'}</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">AIH / Faturamento</p>
                          <p className="text-xs font-bold text-foreground">{form.billing_aih_number || 'Não informado'} | {form.billing_aih_generated ? 'Gerada' : 'Pendente'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-muted/30 p-4 rounded-xl border border-border space-y-4">
                      <h3 className="text-[10px] font-black uppercase text-primary tracking-widest border-b border-border pb-2">Comparativo Autorizado x Consumido</h3>
                      <div className="space-y-2">
                        {toList(form.opme_requested).filter((item: any) => item?.description?.trim()).map((item: any, i: number) => {
                          const usedItems = toList(form.opme_used).filter((used: any) => used?.launched && normalizeMaterial(used.description) === normalizeMaterial(item.description));
                          const usedQty = usedItems.reduce((sum: number, used: any) => sum + Number(used.quantity || 0), 0);
                          const requestedQty = Number(item.quantity || 0);
                          const status = usedItems.length === 0 ? 'Não consumido' : usedQty === requestedQty ? 'Conforme' : usedQty > requestedQty ? 'Acima' : 'Abaixo';
                          return (
                            <div key={i} className="bg-background p-3 rounded-lg border border-border grid grid-cols-[minmax(0,1fr)_auto] gap-3">
                              <div className="min-w-0">
                                <p className="text-[11px] font-bold text-foreground uppercase leading-tight">{item.description}</p>
                                <p className="text-[9px] text-muted-foreground font-bold uppercase">Autorizado: {item.quantity || 0} | Consumido: {usedQty} | Modelo: {item.size_model || '---'}</p>
                                {usedItems.map((used: any, idx: number) => (
                                  <p key={idx} className="text-[9px] text-muted-foreground font-medium">Lote {used.batch || '---'} | Validade {used.expiry || '---'} | Etiqueta {used.label_fixed === 'sim' ? 'sim' : 'não'}</p>
                                ))}
                              </div>
                              <span className={`self-start rounded-full px-2 py-1 text-[9px] font-black uppercase ${status === 'Conforme' ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>{status}</span>
                            </div>
                          );
                        })}
                        {toList(form.opme_used).filter((used: any) => used?.launched && used?.description?.trim() && !toList(form.opme_requested).some((req: any) => normalizeMaterial(req.description) === normalizeMaterial(used.description))).map((item: any, i: number) => (
                          <div key={`extra-${i}`} className="bg-destructive/10 p-3 rounded-lg border border-destructive/20">
                            <p className="text-[11px] font-bold text-destructive uppercase leading-tight">Consumido sem autorização: {item.description}</p>
                            <p className="text-[9px] text-destructive font-bold uppercase">Qtd: {item.quantity || 0} | Lote: {item.batch || '---'}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                     <div className="bg-background p-4 rounded-xl border border-border space-y-6">
                       <div className="flex items-center justify-between border-b border-border pb-2">
                         <h3 className="text-[10px] font-black uppercase text-primary tracking-widest">Dossiê de Evidências Visuais</h3>
                       </div>

                       {/* Seção 1: Justificativa Clínica (Pré-OP) */}
                       <div className="space-y-3">
                         <div className="flex items-center gap-2">
                            <div className="w-1.5 h-3 bg-slate-400 rounded-full"></div>
                           <h4 className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">1. Justificativa Clínica (Pré-OP)</h4>
                         </div>
                         <div className="grid grid-cols-2 gap-3">
                           {getTimelineEvidence().filter(e => e.stage === "Pré-OP").length > 0 ? (
                             getTimelineEvidence().filter(e => e.stage === "Pré-OP").map((exam, i) => (
                               <div key={i} className="group relative aspect-video rounded-lg overflow-hidden border border-slate-100 bg-slate-50">
                                 <img src={exam.url} alt="Pré-OP" className="w-full h-full object-cover" />
                                 <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all p-2 flex flex-col justify-end">
                                   <p className="text-[8px] text-white font-bold uppercase">{exam.type}</p>
                                   <p className="text-[7px] text-white/70 uppercase">{formatDateBR(exam.date)}</p>
                                   <Button variant="secondary" size="sm" className="h-6 mt-2 text-[8px] font-bold uppercase" onClick={() => window.open(exam.url, "_blank")}>Ver Original</Button>
                                 </div>
                               </div>
                             ))
                           ) : (
                             <p className="col-span-2 text-[9px] text-slate-400 italic bg-slate-50/50 p-2 rounded border border-dashed text-center">Nenhum exame pré-operatório anexado.</p>
                           )}
                         </div>
                       </div>

                       {/* Seção 2: Rastreabilidade de Materiais (Etiquetas/Lotes) */}
                       <div className="space-y-3">
                         <div className="flex items-center gap-2">
                            <div className="w-1.5 h-3 bg-slate-400 rounded-full"></div>
                           <h4 className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">2. Rastreabilidade (Lotes e Etiquetas)</h4>
                         </div>
                         <div className="grid grid-cols-2 gap-3">
                            {(() => {
                              const trackingEvidence = getTimelineEvidence().filter(e => e.category === "tracking");
                              return trackingEvidence.length > 0 ? (
                                trackingEvidence.map((exam, i) => (
                                   <div key={i} className="group relative aspect-video rounded-lg overflow-hidden border border-slate-200 bg-slate-50/30">
                                    <img src={exam.url} alt="Etiqueta" className="w-full h-full object-cover" />
                                     <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-all p-2 flex flex-col justify-end">
                                      <p className="text-[8px] text-white font-bold uppercase truncate">{exam.type}</p>
                                      <p className="text-[7px] text-white/70 uppercase">{formatDateBR(exam.date)}</p>
                                      <Button variant="secondary" size="sm" className="h-6 mt-2 text-[8px] font-bold uppercase" onClick={() => window.open(exam.url, "_blank")}>Conferir Lote</Button>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <p className="col-span-2 text-[9px] text-slate-500 italic bg-slate-100/50 p-3 rounded-lg border border-dashed border-slate-200 text-center">
                                  Informação: Ausência de fotos das etiquetas para conferência técnica.
                                </p>
                              );
                            })()}
                         </div>
                       </div>

                       {/* Seção 3: Conferência Técnica (Intra e Pós-OP) */}
                       <div className="space-y-3">
                         <div className="flex items-center gap-2">
                            <div className="w-1.5 h-3 bg-slate-400 rounded-full"></div>
                           <h4 className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">3. Conferência Técnica (Intra/Pós-OP)</h4>
                         </div>
                         <div className="grid grid-cols-2 gap-3">
                            {(() => {
                              const technicalEvidence = getTimelineEvidence().filter(e => e.stage === "Pós-OP" || (e.stage === "Consumo" && e.category === "intra"));
                              return technicalEvidence.length > 0 ? (
                                technicalEvidence.map((exam, i) => (
                                  <div key={i} className="group relative aspect-video rounded-lg overflow-hidden border border-slate-100 bg-slate-50">
                                    <img src={exam.url} alt="Pós/Intra" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-all p-2 flex flex-col justify-end">
                                      <p className="text-[8px] text-white font-bold uppercase">{exam.stage} - {exam.type}</p>
                                      <p className="text-[7px] text-white/70 uppercase">{formatDateBR(exam.date)}</p>
                                      <Button variant="secondary" size="sm" className="h-6 mt-2 text-[8px] font-bold uppercase" onClick={() => window.open(exam.url, "_blank")}>Ver Detalhes</Button>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <p className="col-span-2 text-[9px] text-slate-400 italic bg-slate-50/50 p-3 rounded-lg border border-dashed border-slate-200 text-center">
                                  Nenhuma imagem intra ou pós-operatória identificada.
                                </p>
                              );
                            })()}
                         </div>
                       </div>
                     </div>

                     <div className="bg-background p-4 rounded-xl border border-border space-y-4">
                       <h3 className="text-[10px] font-black uppercase text-primary tracking-widest border-b border-border pb-2">Timeline de Movimentação e Auditoria</h3>
                       <div className="space-y-4">
                         <div className="relative pl-6 space-y-4 border-l border-slate-200 ml-2">
                           {/* Solicitação */}
                           <div className="relative">
                              <div className="absolute -left-8 top-1 w-4 h-4 rounded-full bg-slate-400 border-2 border-white shadow-sm flex items-center justify-center text-[8px] text-white font-bold">1</div>
                             <p className="text-[10px] font-bold text-slate-700 uppercase">Solicitação OPME</p>
                             <p className="text-[9px] text-slate-500 font-medium">Médico: {form.requester_name || '---'} @ {formatDateBR(form.procedure_date)} {form.request_time || ''}</p>
                           </div>

                           {/* Almoxarifado */}
                           {form.warehouse_date && (
                             <div className="relative">
                                <div className="absolute -left-8 top-1 w-4 h-4 rounded-full bg-slate-400 border-2 border-white shadow-sm flex items-center justify-center text-[8px] text-white font-bold">2</div>
                                <p className="text-[10px] font-bold text-slate-700 uppercase">Recebimento Almoxarifado</p>
                                <p className="text-[9px] text-slate-500 font-medium">Resp: {form.warehouse_received_by || '---'} @ {formatDateBR(form.warehouse_date)} {form.warehouse_time || ''}</p>
                                <p className="text-[8px] text-slate-500 font-bold uppercase">Estoque: {form.stock_available}</p>
                             </div>
                           )}

                           {/* CME */}
                           {form.cme_processing_date && (
                             <div className="relative">
                                <div className="absolute -left-8 top-1 w-4 h-4 rounded-full bg-slate-400 border-2 border-white shadow-sm flex items-center justify-center text-[8px] text-white font-bold">3</div>
                               <p className="text-[10px] font-bold text-slate-700 uppercase">Processamento CME</p>
                               <p className="text-[9px] text-slate-500 font-medium">Resp: {form.cme_responsible || '---'} @ {formatDateBR(form.cme_processing_date)}</p>
                             </div>
                           )}

                           {/* Consumo */}
                           <div className="relative">
                              <div className="absolute -left-8 top-1 w-4 h-4 rounded-full bg-slate-400 border-2 border-white shadow-sm flex items-center justify-center text-[8px] text-white font-bold">4</div>
                             <p className="text-[10px] font-bold text-slate-700 uppercase">Registro de Consumo (Sala)</p>
                              <p className="text-[9px] text-slate-500 font-medium">
                                {toList(form.opme_used).filter((i: any) => i?.launched).length || 0} Itens Lançados @ {formatDateBR(form.procedure_date)}
                             </p>
                             {(() => {
                                const lastLaunch = toList(form.opme_used).find((i: any) => i?.launched_by);
                               if (!lastLaunch || !lastLaunch.launched_by) return null;
                               return (
                                 <p className="text-[8px] text-slate-400 italic">
                                   Último lançamento: {shortActorName(lastLaunch.launched_by)}
                                 </p>
                               );
                             })()}
                           </div>

                            {/* Auditoria Final */}
                            <div className="relative">
                              <div className="absolute -left-8 top-1 w-4 h-4 rounded-full bg-slate-300 border-2 border-white shadow-sm flex items-center justify-center text-[8px] text-white font-bold">5</div>
                              <p className="text-[10px] font-bold text-slate-700 uppercase">Auditoria de Fechamento</p>
                               <p className="text-[9px] text-slate-500 font-medium">
                                 Status: {form.status === "aguardando_justificativa" ? "Aguardando Justificativa do Cirurgião" :
                                         form.status === "justificativa_respondida" ? "Justificativa Recebida — Aguardando Reanálise" :
                                         form.status === "pendente_faturamento" ? "Liberado para Faturamento" :
                                         form.status === "concluido" ? "Processo Finalizado" : "Em Análise pelo Auditor"}
                               </p>
                              {form.incident_description && (
                                <p className="text-[8px] text-emerald-600 font-bold uppercase mt-1">✓ Justificativa Anexada</p>
                              )}
                            </div>
                         </div>
                       </div>
                     </div>

                     <div className="bg-background p-4 rounded-xl border border-border space-y-4">
                       <h3 className="text-[10px] font-black uppercase text-primary tracking-widest border-b border-border pb-2">Alertas de Auditoria de Anexos</h3>
                       <div className="space-y-2">
                                  {(() => {
                                    const auditDivergences = getPostAuditDivergences();
                                    const missingPhotos = toList(form.opme_used).some((i: any) => i?.launched && !i.photo_url);
                                    
                                    if (auditDivergences.length === 0 && !missingPhotos) {
                                      return (
                                        <p className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-100 rounded-lg p-3">
                                          Dossiê em Conformidade: Todas as evidências e justificativas básicas foram identificadas.
                                        </p>
                                      );
                                    }

                                    return (
                                      <div className="space-y-2">
                                        {auditDivergences.map((item: any, i: number) => (
                                          <p key={i} className="text-[10px] font-bold text-slate-700 bg-slate-100 border border-slate-200 rounded-lg p-2.5">
                                            • {typeof item === 'string' ? item : (item?.description || 'Divergência técnica identificada')}
                                          </p>
                                        ))}
                                        {missingPhotos && (
                                          <p className="text-[10px] font-bold text-blue-900 bg-blue-100/50 border border-blue-200 rounded-lg p-2.5">
                                            ℹ️ OBSERVAÇÃO TÉCNICA: Identificados materiais sem anexo de foto da etiqueta para conferência de lote.
                                          </p>
                                        )}
                                      </div>
                                    );
                                  })()}
                       </div>
                     </div>

                    {form.status !== "justificativa_respondida" && (
                    <div className="bg-muted/30 p-4 rounded-xl border border-border space-y-4">
                      <h3 className="text-[10px] font-black uppercase text-primary tracking-widest border-b border-border pb-2">Validação Auditor Pós-OP</h3>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold uppercase text-slate-500">Nome Auditor</Label>
                          <Input value={form.auditor_post_name} onChange={e => updateForm("auditor_post_name", e.target.value)} className="h-10 text-xs bg-white" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold uppercase text-slate-500">CRM</Label>
                          <Input value={form.auditor_post_crm} onChange={e => updateForm("auditor_post_crm", e.target.value)} className="h-10 text-xs bg-white" />
                        </div>
                      </div>

                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-slate-500">Compatibilidade OPME x Procedimento</Label>
                      <Select value={form.auditor_post_procedure_compat} onValueChange={v => updateForm("auditor_post_procedure_compat", v)}>
                        <SelectTrigger className="h-10 text-xs bg-white"><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sim">Sim</SelectItem>
                          <SelectItem value="nao">Não</SelectItem>
                          <SelectItem value="parcial">Parcial</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-slate-500">Compatibilidade OPME x SIGTAP</Label>
                      <Select value={form.auditor_post_sigtap_compat} onValueChange={v => updateForm("auditor_post_sigtap_compat", v)}>
                        <SelectTrigger className="h-10 text-xs bg-white"><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sim">Sim</SelectItem>
                          <SelectItem value="nao">Não</SelectItem>
                          <SelectItem value="parcial">Parcial</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-slate-500">Conformidade com Imagem Pós</Label>
                      <Select value={form.auditor_post_image_conformity} onValueChange={v => updateForm("auditor_post_image_conformity", v)}>
                        <SelectTrigger className="h-10 text-xs bg-white"><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sim">Sim</SelectItem>
                          <SelectItem value="nao">Não</SelectItem>
                          <SelectItem value="nao_se_aplica">Não se aplica</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase text-slate-500">Parecer Técnico Final</Label>
                      <Textarea value={form.auditor_post_final_opinion} onChange={e => updateForm("auditor_post_final_opinion", e.target.value)} placeholder="Conclusão da auditoria com base no dossiê consolidado..." className="min-h-[150px] text-xs bg-white" />
                    </div>

                    <div className="space-y-4 pt-2 border-t border-border">
                      <div className="flex items-center gap-2">
                        <Checkbox 
                          id="req_justification" 
                          checked={form.auditor_post_justification_requested} 
                          onCheckedChange={(v) => {
                            updateForm("auditor_post_justification_requested", v);
                            if (v && !form.auditor_post_justification_reason?.trim()) {
                              updateForm("auditor_post_justification_reason", buildPostAuditJustification());
                            }
                          }} 
                        />
                        <Label htmlFor="req_justification" className="text-xs font-bold text-slate-600 uppercase">Solicitar Justificativa ao Cirurgião</Label>
                      </div>
                      {form.auditor_post_justification_requested && (
                        <div className="space-y-2">
                          <Label className="text-[10px] font-bold uppercase text-slate-500">Motivo da Solicitação</Label>
                          <Textarea 
                            value={form.auditor_post_justification_reason} 
                            onChange={e => updateForm("auditor_post_justification_reason", e.target.value)} 
                            placeholder="Pontos de divergência identificados no dossiê..." 
                            className="min-h-[110px] text-xs bg-white" 
                          />
                        </div>
                      )}
                    </div>

                     <div className="grid grid-cols-2 gap-4 pt-2">
                       <div className="space-y-1">
                         <Label className="text-[10px] font-bold uppercase text-slate-500">Data Validação</Label>
                         <Input type="date" value={form.auditor_post_date} onChange={e => updateForm("auditor_post_date", e.target.value)} className="h-10 text-xs bg-white" />
                       </div>
                     </div>
                   </div>
                   )}
                 </div>
                 )}
              </div>
            )}

            {/* --- PARTE 5: CONTROLE ADMINISTRATIVO --- */}
            {part === 5 && step === 0 && (
              <div className="space-y-6 pb-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b pb-2">
                    <div className="w-2 h-4 bg-primary rounded-full"></div>
                    <h3 className="text-[10px] font-black uppercase text-primary tracking-widest">9. CONTROLE ADMINISTRATIVO</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase text-slate-500">Data da Solicitação</Label>
                      <Input type="date" value={form.request_date} onChange={e => updateForm("request_date", e.target.value)} className="h-10 text-xs bg-white border-slate-200" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase text-slate-500">Horário da Solicitação</Label>
                      <Input type="time" value={form.request_time} onChange={e => updateForm("request_time", e.target.value)} className="h-10 text-xs bg-white border-slate-200" />
                    </div>
                  </div>

                  <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider border-b pb-1">PARA USO DO ALMOXARIFADO</h4>
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold uppercase text-slate-500">Recebido por</Label>
                        <Input value={form.warehouse_received_by} onChange={e => updateForm("warehouse_received_by", e.target.value)} placeholder="Identificação" className="h-10 text-xs bg-white border-slate-200" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold uppercase text-slate-500">Data</Label>
                          <Input type="date" value={form.warehouse_date} onChange={e => updateForm("warehouse_date", e.target.value)} className="h-10 text-xs bg-white border-slate-200" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold uppercase text-slate-500">Hora do atendimento</Label>
                          <Input type="time" value={form.warehouse_time} onChange={e => updateForm("warehouse_time", e.target.value)} className="h-10 text-xs bg-white border-slate-200" />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold uppercase text-slate-500">OPME disponível em estoque</Label>
                          <Select value={form.stock_available} onValueChange={v => updateForm("stock_available", v)}>
                            <SelectTrigger className="h-10 text-xs bg-white border-slate-200"><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="sim">Sim</SelectItem>
                              <SelectItem value="nao">Não</SelectItem>
                              <SelectItem value="parcial">Parcial</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold uppercase text-slate-500">OPME enviada para CME (se aplicável)</Label>
                          <Select value={form.sent_to_cme === true ? "sim" : form.sent_to_cme === false ? "nao" : ""} onValueChange={v => updateForm("sent_to_cme", v === "sim")}>
                            <SelectTrigger className="h-10 text-xs bg-white border-slate-200"><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="sim">Sim</SelectItem>
                              <SelectItem value="nao">Não</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider border-b pb-1">PARA USO DO CME (se aplicável)</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold uppercase text-slate-500">Data do processamento</Label>
                        <Input type="date" value={form.cme_processing_date} onChange={e => updateForm("cme_processing_date", e.target.value)} className="h-10 text-xs bg-white border-slate-200" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold uppercase text-slate-500">Responsável</Label>
                        <Input value={form.cme_responsible} onChange={e => updateForm("cme_responsible", e.target.value)} placeholder="Nome/Assinatura" className="h-10 text-xs bg-white border-slate-200" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider border-b pb-1">PARA USO DO CENTRO CIRÚRGICO</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold uppercase text-slate-500">Data de dispensação</Label>
                        <Input type="date" value={form.surgery_dispatch_date} onChange={e => updateForm("surgery_dispatch_date", e.target.value)} className="h-10 text-xs bg-white border-slate-200" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold uppercase text-slate-500">Responsável dispensação</Label>
                        <Input value={form.surgery_dispatch_responsible} onChange={e => updateForm("surgery_dispatch_responsible", e.target.value)} placeholder="Nome/ID" className="h-10 text-xs bg-white border-slate-200" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* --- PARTE 6: CONSUMO CIRURGICO --- */}
            {part === 6 && step === 0 && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase text-primary tracking-widest border-b pb-1">Materiais a Lançar</h3>
                  <div className="space-y-3">
                    {toList(form.opme_used).filter((item: any) => !item?.launched).map((item: any) => {
                      const idx = toList(form.opme_used).findIndex((i: any) => i === item);
                      return (
                        <Card key={idx} className="border-slate-200 shadow-sm overflow-hidden">
                          <CardContent className="p-4 space-y-4">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Item #{String(idx + 1).padStart(2, '0')}</span>
                              <div className="flex gap-2">
                                <Button variant="ghost" size="sm" className="h-6 px-2 text-primary text-[10px] font-bold uppercase bg-primary/5 hover:bg-primary/10" 
                                  onClick={async () => {
                                    if (!item.batch) {
                                      toast.error("Preencha o lote antes de lançar");
                                      return;
                                    }
                                    handleLaunchItem(idx);
                                  }}
                                >
                                  Lançar Item
                                </Button>
                                {toList(form.opme_used).length > 1 && (
                                  <Button variant="ghost" size="sm" className="h-6 px-2 text-destructive text-[10px] font-bold uppercase" onClick={() => setForm((p: any) => ({ ...p, opme_used: p.opme_used.filter((_: any, i: number) => i !== idx) }))}>Remover</Button>
                                )}
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[10px] font-bold uppercase text-slate-500">Descrição Material</Label>
                              <Input value={item.description} onChange={e => updateItem(idx, "description", e.target.value, "opme_used")} className="h-10 text-xs bg-white" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label className="text-[10px] font-bold uppercase text-slate-500">Qtd</Label>
                                <Input type="number" value={item.quantity} onChange={e => updateItem(idx, "quantity", e.target.value, "opme_used")} className="h-10 text-xs" />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] font-bold uppercase text-slate-500">Lote</Label>
                                <Input value={item.batch} onChange={e => updateItem(idx, "batch", e.target.value, "opme_used")} className="h-10 text-xs" />
                              </div>
                            </div>
                            <div className="space-y-1.5 pt-1">
                              <Label className="text-[10px] font-bold uppercase text-slate-500">Comprovação (Etiqueta/Lote)</Label>
                              <div className="relative group">
                                {item.photo_url ? (
                                  <div className="relative aspect-video rounded-md overflow-hidden border border-slate-200">
                                    <img src={item.photo_url} alt="Comprovação" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                      <Button variant="secondary" size="sm" className="h-7 text-[9px] font-bold uppercase" onClick={() => window.open(item.photo_url, "_blank")}>Ver</Button>
                                      <Button variant="destructive" size="sm" className="h-7 text-[9px] font-bold uppercase" onClick={() => updateItem(idx, "photo_url", "", "opme_used")}>Remover</Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="relative">
                                    <input 
                                      type="file" 
                                      accept="image/*" 
                                      className="absolute inset-0 opacity-0 cursor-pointer z-10" 
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          const url = URL.createObjectURL(file);
                                          updateItem(idx, "photo_url", url, "opme_used");
                                        }
                                      }} 
                                    />
                                    <Button variant="outline" className="w-full h-10 border-dashed text-[10px] font-bold uppercase text-slate-400 flex gap-2">
                                      <Upload size={14} /> Anexar Foto do Material
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                    <Button variant="outline" className="w-full border-dashed h-10 text-[10px] font-bold uppercase" onClick={() => addItem("opme_used")}>+ Novo Material para Lançar</Button>
                    
                    {/* Botão Salvar Rascunho integrado à lista */}
                    <Button 
                      variant="secondary" 
                      className="w-full h-10 text-[10px] font-bold uppercase bg-slate-100 text-slate-600 hover:bg-slate-200"
                      onClick={() => handleSave(false)}
                      disabled={saving}
                    >
                      {saving ? "Salvando..." : "Salvar Rascunho / Pausar"}
                    </Button>
                  </div>
                </div>

                {toList(form.opme_used).some((item: any) => item?.launched) && (
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase text-emerald-600 tracking-widest border-b pb-1">Materiais Lançados</h3>
                    <div className="space-y-2">
                      {toList(form.opme_used).filter((item: any) => item?.launched).map((item: any) => {
                        const idx = toList(form.opme_used).findIndex((i: any) => i === item);
                        return (
                          <Card key={idx} className="border-emerald-100 bg-emerald-50/30 overflow-hidden">
                            <CardContent className="p-3 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                                  <FileText size={14} />
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold text-slate-700 uppercase leading-tight mb-0.5">{item.description}</p>
                                  <p className="text-[9px] text-slate-500 uppercase font-medium leading-none">
                                    Qtd: {item.quantity} | Lote: {item.batch}
                                  </p>
                                   {item.launched_by && (
                                     <p className="text-[8px] text-slate-400 font-bold uppercase mt-1">
                                       Lançado por: {shortActorName(item.launched_by)} @ {item.launched_at ? new Date(item.launched_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
                                     </p>
                                   )}
                                </div>
                              </div>
                              <Button variant="ghost" size="sm" className="h-7 text-[9px] font-bold uppercase text-slate-400 hover:text-primary" onClick={() => updateItem(idx, "launched", false, "opme_used")}>Editar</Button>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase text-primary tracking-widest border-b pb-1">Devoluções / Sobras</h3>
                  <div className="space-y-3">
                    {toList(form.opme_returned).map((item: any, idx: number) => (
                      <Card key={idx} className="border-slate-200 shadow-sm overflow-hidden bg-slate-50/50">
                        <CardContent className="p-4 space-y-4">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Devolução #{String(idx + 1).padStart(2, '0')}</span>
                            <Button variant="ghost" size="sm" className="h-6 px-2 text-destructive text-[10px] font-bold uppercase" onClick={() => setForm((p: any) => ({ ...p, opme_returned: p.opme_returned.filter((_: any, i: number) => i !== idx) }))}>Remover</Button>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase text-slate-500">Descrição do Material</Label>
                            <Input value={item.description} onChange={e => updateItem(idx, "description", e.target.value, "opme_returned")} className="h-10 text-xs bg-white" placeholder="Nome do item devolvido" />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-[10px] font-bold uppercase text-slate-500">Quantidade</Label>
                              <Input type="number" value={item.quantity} onChange={e => updateItem(idx, "quantity", e.target.value, "opme_returned")} className="h-10 text-xs" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] font-bold uppercase text-slate-500">Lote</Label>
                              <Input value={item.batch} onChange={e => updateItem(idx, "batch", e.target.value, "opme_returned")} className="h-10 text-xs" />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase text-slate-500">Motivo da Devolução</Label>
                            <Input value={item.reason} onChange={e => updateItem(idx, "reason", e.target.value, "opme_returned")} className="h-10 text-xs bg-white" placeholder="Ex: Tamanho inadequado, soba..." />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                     <Button variant="outline" className="w-full border-dashed h-10 text-[10px] font-bold uppercase" onClick={() => addItem("opme_returned")}>+ Registrar Devolução</Button>
                   </div>
                 </div>
 
                 <div className="space-y-4">
                   <h3 className="text-[10px] font-black uppercase text-primary tracking-widest border-b pb-1">Evidências de Uso (Fotos/Rastreabilidade)</h3>
                   <div className="space-y-4">
                     <Select onValueChange={(v) => {
                       if (!v) return;
                       const newExam = { id: Math.random().toString(36), type: v, date: todayISO(), file: null, url: "" };
                       setConsumptionExams(prev => [...prev, newExam]);
                     }}>
                       <SelectTrigger className="h-10 bg-white border-slate-200 text-xs font-bold uppercase">
                         <SelectValue placeholder="+ Adicionar Foto/Evidência" />
                       </SelectTrigger>
                       <SelectContent>
                         <SelectItem value="Etiqueta/Rastreabilidade">Etiqueta/Rastreabilidade</SelectItem>
                         <SelectItem value="Foto do Material">Foto do Material</SelectItem>
                         <SelectItem value="Imagem Intraoperatória">Imagem Intraoperatória</SelectItem>
                         <SelectItem value="Outro">Outro</SelectItem>
                       </SelectContent>
                     </Select>
 
                     <div className="grid grid-cols-1 gap-3">
                       {consumptionExams.map((exam, idx) => (
                         <Card key={exam.id} className="border-slate-100 bg-white shadow-sm overflow-hidden">
                           <CardContent className="p-3 space-y-3">
                             <div className="flex items-center justify-between">
                               <div className="flex items-center gap-2">
                                 <div className="w-7 h-7 rounded bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px]">EVID</div>
                                 <span className="text-xs font-bold text-slate-700">{exam.type}</span>
                               </div>
                               <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400" onClick={() => setConsumptionExams(prev => prev.filter(e => e.id !== exam.id))}>×</Button>
                             </div>
                             <div className="grid grid-cols-2 gap-3">
                               {exam.url ? (
                                 <div className="col-span-2 relative group">
                                   <img src={exam.url} alt="Evidência" className="w-full h-32 object-cover rounded-md border" />
                                   <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-md">
                                     <Button variant="secondary" size="sm" className="h-8 text-[10px] font-bold uppercase" onClick={() => window.open(exam.url, "_blank")}>Ver Ampliado</Button>
                                   </div>
                                 </div>
                               ) : (
                                 <div className="col-span-2 relative">
                                   <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => {
                                     const file = e.target.files?.[0];
                                     if (file) {
                                       const url = URL.createObjectURL(file);
                                       const newExams = [...consumptionExams];
                                       newExams[idx].file = file;
                                       newExams[idx].url = url;
                                       setConsumptionExams(newExams);
                                     }
                                   }} />
                                   <Button variant="outline" className="w-full h-10 text-[10px] font-bold uppercase border-dashed border-2 text-slate-400">+ Upload Foto</Button>
                                 </div>
                               )}
                             </div>
                           </CardContent>
                         </Card>
                       ))}
                     </div>
                   </div>
                 </div>
               </div>
            )}

            {part === 6 && step === 1 && (
              <div className="space-y-6">
                <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 space-y-4">
                  <h3 className="text-[10px] font-black uppercase text-primary tracking-widest border-b border-primary/10 pb-2">Imagem Pós-Operatória</h3>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold uppercase text-slate-500">Data do Exame</Label>
                        <Input type="date" value={form.postop_exam_date} onChange={e => updateForm("postop_exam_date", e.target.value)} className="h-10 text-xs bg-white" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold uppercase text-slate-500">Nº Exame / Laudo</Label>
                        <Input value={form.postop_exam_number} onChange={e => updateForm("postop_exam_number", e.target.value)} className="h-10 text-xs bg-white" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-slate-500">Resultado / Evolução</Label>
                      <Textarea value={form.postop_result_description} onChange={e => updateForm("postop_result_description", e.target.value)} placeholder="Descreva brevemente a evolução..." className="min-h-[100px] text-xs bg-white" />
                    </div>

                    <div className="space-y-4 pt-2">
                      <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
                        <Upload size={12} /> Registro Fotográfico / Laudos
                      </h4>
                      
                      <Select onValueChange={(v) => {
                        if (!v) return;
                        const newExam = { 
                          id: Math.random().toString(36), 
                          type: v, 
                          date: todayISO(), 
                          file: null, 
                          url: "",
                          category: v === "Etiqueta/Rastreabilidade" ? "tracking" : "intra"
                        };
                        setPostopExams(prev => [...prev, newExam]);
                      }}>
                        <SelectTrigger className="h-10 bg-white border-slate-200 text-xs font-bold uppercase">
                          <SelectValue placeholder="+ Adicionar Imagem/Laudo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="RX Pós-Operatório">RX Pós-Operatório</SelectItem>
                          <SelectItem value="TC Pós-Operatório">TC Pós-Operatório</SelectItem>
                          <SelectItem value="Foto do Local Cirúrgico">Foto do Local Cirúrgico</SelectItem>
                          <SelectItem value="Laudo de Imagem">Laudo de Imagem</SelectItem>
                          <SelectItem value="Outro">Outro</SelectItem>
                        </SelectContent>
                      </Select>

                      <div className="grid grid-cols-1 gap-3">
                        {postopExams.map((exam, idx) => (
                          <Card key={exam.id} className="border-slate-100 bg-white shadow-sm overflow-hidden">
                            <CardContent className="p-3 space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px]">PÓS</div>
                                  <span className="text-xs font-bold text-slate-700">{exam.type}</span>
                                </div>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400" onClick={() => setPostopExams(prev => prev.filter(e => e.id !== exam.id))}>×</Button>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                {exam.url ? (
                                  <div className="col-span-2 relative group">
                                    <img src={exam.url} alt="Evidência Pós" className="w-full h-32 object-cover rounded-md border" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-md">
                                      <Button variant="secondary" size="sm" className="h-8 text-[10px] font-bold uppercase" onClick={() => window.open(exam.url, "_blank")}>Ver Ampliado</Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="col-span-2 relative">
                                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        const url = URL.createObjectURL(file);
                                        const newExams = [...postopExams];
                                        newExams[idx].file = file;
                                        newExams[idx].url = url;
                                        setPostopExams(newExams);
                                      }
                                    }} />
                                    <Button variant="outline" className="w-full h-10 text-[10px] font-bold uppercase border-dashed border-2 text-slate-400">+ Upload Imagem Real</Button>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}


            {/* --- PARTE 4: FATURAMENTO (Justificativa Cirurgião) --- */}
            {part === 4 && step === 0 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-[10px] font-black uppercase text-primary tracking-widest">Resposta do Cirurgião à Auditoria</h3>
                  {form.justification_round > 0 && (
                    <span className="text-[9px] font-bold uppercase bg-amber-100 text-amber-800 px-2 py-1 rounded-full">
                      Rodada {Number(form.justification_round) + 1}
                    </span>
                  )}
                </div>

                {/* Histórico de rodadas anteriores */}
                {Array.isArray(form.justification_history) && form.justification_history.length > 0 && (
                  <div className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <Label className="text-[10px] font-bold uppercase text-slate-500">Histórico de Justificativas Anteriores</Label>
                    {form.justification_history.map((h: any, i: number) => (
                      <div key={i} className="text-[10px] border-l-2 border-slate-300 pl-2 py-1">
                        <p className="font-bold text-slate-600 uppercase">Rodada {(h.round ?? i) + 1}</p>
                        <p className="text-slate-700"><span className="font-semibold">Motivo do auditor:</span> {h.auditor_reason || '---'}</p>
                        <p className="text-slate-700"><span className="font-semibold">Resposta:</span> {h.surgeon_justification || '---'}</p>
                        {Array.isArray(h.attachments) && h.attachments.length > 0 && (
                          <p className="text-slate-600"><span className="font-semibold">Anexos:</span> {h.attachments.map((a: any, k: number) => (
                            <a key={k} href={a.url} target="_blank" rel="noreferrer" className="underline text-primary mr-2">{a.name || `arquivo ${k + 1}`}</a>
                          ))}</p>
                        )}
                        {h.decision && (
                          <p className="text-slate-600 italic">
                            Decisão do auditor: <span className={h.decision === 'liberada' ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>{h.decision === 'liberada' ? 'LIBERADA' : 'REPROVADA — nova justificativa solicitada'}</span>
                            {h.decision_notes ? ` — ${h.decision_notes}` : ''}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                  <Label className="text-[10px] font-bold uppercase text-amber-800">Solicitação atual do Auditor:</Label>
                  <p className="text-xs text-amber-900 mt-1 font-medium italic whitespace-pre-line">"{form.auditor_post_justification_reason || 'Favor justificar divergências apontadas.'}"</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Justificativa do Cirurgião</Label>
                  <Textarea
                    value={form.surgeon_justification || ""}
                    onChange={e => updateForm("surgeon_justification", e.target.value)}
                    placeholder="Descreva sua justificativa técnica para os pontos apontados pelo auditor..."
                    className="min-h-[180px] bg-white shadow-sm"
                  />
                  <p className="text-[10px] text-slate-500">Sua resposta retorna ao Médico Auditor para reanálise. Somente após a liberação do auditor o processo segue para o faturamento.</p>
                </div>

                {/* === EVIDÊNCIAS OBRIGATÓRIAS === */}
                <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold uppercase text-slate-500">Evidências Anexadas <span className="text-slate-400 normal-case font-normal">(opcional)</span></Label>
                    <span className="text-[9px] font-bold uppercase text-slate-400">{surgeonJustificationFiles.length} arquivo(s)</span>
                  </div>
                  <p className="text-[10px] text-slate-500">Anexe exames, etiquetas de rastreabilidade, fotos do procedimento, laudos ou qualquer documento que comprove a justificativa, se necessário.</p>

                  <div className="relative">
                    <Button type="button" variant="outline" className="w-full h-10 text-xs font-bold uppercase border-dashed">
                      + Adicionar Evidência
                    </Button>
                    <input
                      type="file"
                      multiple
                      accept="image/*,application/pdf"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        if (!files.length) return;
                        const additions = files.map((f) => ({
                          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                          file: f,
                          name: f.name,
                          size: f.size,
                          mime: f.type || "application/octet-stream",
                          previewUrl: f.type?.startsWith("image/") ? URL.createObjectURL(f) : "",
                        }));
                        setSurgeonJustificationFiles((prev) => [...prev, ...additions]);
                        e.target.value = "";
                      }}
                    />
                  </div>

                  {surgeonJustificationFiles.length > 0 && (
                    <div className="space-y-2 pt-1">
                      {surgeonJustificationFiles.map((a) => (
                        <div key={a.id} className="flex items-center gap-3 bg-white p-2 rounded border border-slate-200">
                          {a.previewUrl ? (
                            <img src={a.previewUrl} alt={a.name} className="w-10 h-10 object-cover rounded border" />
                          ) : (
                            <div className="w-10 h-10 flex items-center justify-center rounded border bg-slate-50 text-[9px] font-bold text-slate-500 uppercase">PDF</div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-medium text-slate-700 truncate">{a.name}</p>
                            <p className="text-[9px] text-slate-400">{(a.size / 1024).toFixed(0)} KB</p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-[10px] text-rose-600 hover:bg-rose-50"
                            onClick={() => setSurgeonJustificationFiles((prev) => prev.filter((x) => x.id !== a.id))}
                          >
                            Remover
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {!((form.surgeon_justification || "").trim()) && (
                    <p className="text-[10px] text-rose-600 font-medium">
                      Preencha a justificativa técnica.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* --- PARTE 4: FATURAMENTO (Dados Faturamento) --- */}
            {part === 4 && step >= 1 && (
              <FaturamentoWizard
                step={step}
                form={form}
                updateForm={updateForm}
                user={user}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="bg-white border-t p-4 fixed bottom-0 w-full z-20 flex gap-3 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        {(part === 3 && step === 1 && form.status === "justificativa_respondida") ? (
          <Button variant="ghost" className="flex-1 h-12 text-slate-400" onClick={() => navigate("/")}>
            Sair
          </Button>
        ) : step > 0 ? (
          <Button variant="outline" className="flex-1 h-12" onClick={prev}>
            Anterior
          </Button>
        ) : (
          <Button variant="ghost" className="flex-1 h-12 text-slate-400" onClick={() => navigate("/")}>
            Sair
          </Button>
        )}
        
        {(part === 4 && step === 0) ? (
          <Button
            className="flex-[2] h-12 bg-primary shadow-lg shadow-primary/20"
            disabled={saving || uploadingJustification || !(form.surgeon_justification || "").trim()}
            onClick={sendSurgeonJustification}
          >
            {uploadingJustification ? "Enviando anexos..." : (saving ? "Enviando..." : "Enviar Justificativa ao Auditor")}
          </Button>
        ) : (step < STEPS.length - 1 && part !== 3) ? (
          <Button className="flex-[2] h-12 shadow-lg shadow-primary/20" onClick={next}>
            Próximo
          </Button>
        ) : (part === 3 && step === 1 && form.status === "justificativa_respondida") ? (
          <Button
            className="flex-[2] h-12 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200 text-[11px] font-bold uppercase"
            disabled={saving}
            onClick={() => {
              const previousHistory = Array.isArray(form.justification_history) ? form.justification_history : [];
              const newEntry = {
                round: Number(form.justification_round || 0),
                auditor_reason: form.auditor_post_justification_reason || "",
                surgeon_justification: form.surgeon_justification || "",
                surgeon_justification_at: form.surgeon_justification_at || null,
                surgeon_justification_by: form.surgeon_justification_by || null,
                attachments: Array.isArray(form.surgeon_justification_attachments) ? form.surgeon_justification_attachments : [],
                decision: "liberada",
                decision_at: new Date().toISOString(),
                decision_by: user?.email || user?.id || "Auditor",
                decision_notes: form.auditor_post_justification_decision_notes || ""
              };
              setForm((p: any) => ({
                ...p,
                auditor_post_justification_decision: "liberada",
                auditor_post_justification_decision_at: new Date().toISOString(),
                justification_history: [...previousHistory, newEntry],
                status: "justificativa_respondida"
              }));
              setTimeout(() => handleSave(false), 50);
            }}
          >
            Liberar para Faturamento
          </Button>
        ) : (
          <Button 
            className="flex-[2] h-12 bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-200" 
            onClick={() => handleSave(false)}
            disabled={saving}
          >
            {saving ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Salvando...
              </div>
            ) : (
            part === 1 ? "Finalizar Cadastro" : 
            part === 2 ? "Finalizar Requisição" : 
            part === 3 ? (step === 0 ? "Finalizar Auditoria Pré" : "Finalizar Auditoria Pós") : 
            part === 5 ? "Finalizar Controle" :
            part === 6 ? "Finalizar Consumo" :
            "Concluir Faturamento"
            )}
          </Button>
        )}
      </footer>

      {/* Modal de Autenticação para Auditoria */}
      <AnimatePresence>
        {showAuthModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-slate-100"
            >
              <div className="text-center mb-6">
                <h3 className="text-lg font-bold text-slate-900 uppercase">Confirmar Validação</h3>
                <p className="text-xs text-slate-500 mt-1 uppercase font-semibold">
                  Médico Auditor: {step === 0 ? "PRÉ-OPERATÓRIO" : "PÓS-OPERATÓRIO"}
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-slate-500">Confirme sua senha de acesso</Label>
                  <div className="relative">
                    <Input 
                      type={showAuthPassword ? "text" : "password"} 
                      value={authPassword} 
                      onChange={(e) => setAuthPassword(e.target.value)} 
                      placeholder="••••••••"
                      className="h-12 bg-slate-50 border-slate-200 text-center text-lg tracking-widest pr-12"
                      autoFocus
                      onKeyDown={(e) => e.key === "Enter" && handleAuditAuth()}
                    />
                    <button
                      type="button"
                      onClick={() => setShowAuthPassword(!showAuthPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-2"
                    >
                      {showAuthPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button 
                    variant="outline" 
                    className="flex-1 h-11 text-xs uppercase font-bold"
                    onClick={() => {
                      setShowAuthModal(false);
                      setAuthPassword("");
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    className="flex-1 h-11 text-xs uppercase font-bold shadow-lg shadow-primary/20"
                    onClick={handleAuditAuth}
                    disabled={isAuthenticating || !authPassword}
                  >
                    {isAuthenticating ? "Validando..." : "Confirmar"}
                  </Button>
                </div>
                
                <p className="text-[9px] text-center text-slate-400 uppercase font-medium leading-relaxed mt-2">
                  Esta ação será registrada em log de auditoria com seu usuário e data/hora.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
