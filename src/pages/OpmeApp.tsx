import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
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
import { ArrowLeft, CalendarIcon } from "lucide-react";
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
  { id: "administrativo", title: "Logística", description: "Almoxarifado e CME" },
];

const STEPS_CONSUMO = [
  { id: "consumo", title: "Registro de Uso", description: "Materiais Utilizados" },
  { id: "imagem_pos", title: "Imagem Pós", description: "Controle Pós-OP" },
];

const STEPS_FATURAMENTO = [
  { id: "cirurgiao_just", title: "Justificativa", description: "Descrição de Intercorrências" },
  { id: "faturamento", title: "Codificação", description: "Fechamento e AIH" },
];

const ANATOMY_DATA: Record<string, string[]> = {
  "Cabeça/Pescoço": ["Crânio", "Face", "Pescoço", "Mandíbula", "Órbita"],
  "Tórax": ["Coração", "Pulmão", "Mama", "Arcabouço Costal", "Mediastino"],
  "Abdome": ["Parede Abdominal", "Fígado/Vias Biliares", "Rim/Ureter", "Intestino", "Estômago"],
  "Membro Superior": ["Ombro", "Braço", "Cotovelo", "Antebraço", "Punho", "Mão"],
  "Membro Inferior": ["Quadril", "Coxa", "Joelho", "Perna", "Tornozelo", "Pé"],
  "Coluna": ["Cervical", "Torácica", "Lombar", "Sacro-Coccígea"]
};

export default function OpmeApp() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const recordId = searchParams.get("id");
  const [part, setPart] = useState<number | null>(null);
  const [preopExams, setPreopExams] = useState<any[]>([]);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
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
    procedure_date: new Date().toISOString().split("T")[0],
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
    opme_used: [{ description: "", quantity: "1", batch: "", expiry: "", label_fixed: "sim" }],
    opme_returned: [{ description: "", quantity: "0", reason: "", responsible: "" }],
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
    auditor_post_date: "",
    incident_date: "",
    incident_description: "",
    incident_responsible: "",
    billing_aih_number: "",
    billing_procedure_name: "",
    billing_sigtap_code: "",
    billing_prior_authorization: "nao_se_aplica",
    billing_aih_generated: false,
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
          setForm(data);
          if (data.preop_exams_details && Array.isArray(data.preop_exams_details)) {
            setPreopExams(data.preop_exams_details as any[]);
          }
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
 
   const loadRequest = (req: any) => {
     setForm(req);
     if (req.preop_exams_details && Array.isArray(req.preop_exams_details)) {
       setPreopExams(req.preop_exams_details as any[]);
     }
     
     // Determinar qual parte e passo abrir baseado no status
     if (req.status === "rascunho") { setPart(1); setStep(0); }
     else if (req.status === "pendente_requisicao") { setPart(2); setStep(0); }
     else if (req.status === "pendente_auditoria") { setPart(3); setStep(0); }
     else if (req.status === "pendente_controle") { setPart(5); setStep(0); }
     else if (req.status === "pendente_consumo") { setPart(6); setStep(0); }
     else if (req.status === "pendente_auditoria_post") { setPart(7); setStep(0); }
     else if (req.status === "pendente_faturamento") { setPart(4); setStep(0); }
     else { setPart(1); setStep(0); } // Fallback
     
     // Adicionar ID na URL sem recarregar para manter consistência
     const newUrl = new URL(window.location.href);
     newUrl.searchParams.set("id", req.id);
     window.history.pushState({}, '', newUrl);
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

  const updateItem = (idx: number, field: string, value: any, listName: string = "opme_requested") => {
    setForm((p: any) => {
      const arr = [...(p[listName] || [])];
      arr[idx] = { ...arr[idx], [field]: value };
      return { ...p, [listName]: arr };
    });

    if (field === "description" && value.length > 2) {
      supabase
        .from("opme_materials")
        .select("code, name")
        .ilike("name", `%${value}%`)
        .limit(5)
        .then(({ data }) => setMaterialSuggestions({ idx, items: data || [] }));
    } else if (field === "description") {
      setMaterialSuggestions({ idx: -1, items: [] });
    }
  };

  const addItem = (listName: string = "opme_requested") => {
    const newItem = listName === "opme_used" 
      ? { description: "", quantity: "1", batch: "", expiry: "", label_fixed: "sim" }
      : listName === "opme_returned"
      ? { description: "", quantity: "1", reason: "", responsible: "" }
      : { description: "", quantity: "1", size_model: "", sigtap: "" };

    setForm((p: any) => ({ ...p, [listName]: [...(p[listName] || []), newItem] }));
  };

  const handleSave = async () => {
    if (!user) { toast.error("Não autenticado"); return; }
    if (!form.patient_name?.trim()) { toast.error("Informe o nome do paciente"); setStep(0); return; }
    
    setSaving(true);
    try {
      let nextStatus = form.status;
      if (part === 1) nextStatus = "pendente_requisicao";
      else if (part === 2) nextStatus = "pendente_auditoria";
      else if (part === 3) nextStatus = "pendente_controle";
      else if (part === 5) nextStatus = "pendente_consumo";
      else if (part === 6) nextStatus = "pendente_auditoria_post";
      else if (part === 7) nextStatus = "pendente_faturamento";
      else if (part === 4) nextStatus = "concluido";

      // Sincronizar dados do responsável e exames se necessário
      const requester_name = form.requester_name || form.responsible_name;
      const requester_register = form.requester_register || form.responsible_register;

      const preop_image_types = preopExams.length > 0 ? preopExams.map(e => e.type) : (form.preop_image_types || []);
      const preop_image_count = preopExams.length > 0 ? preopExams.length : (form.preop_image_count || 0);
      const preop_image_attached = preopExams.length > 0 ? true : (form.preop_image_attached || false);
      const preop_exams_details = preopExams.length > 0 ? preopExams : (form.preop_exams_details || []);

      const dateFields = [
        "patient_birthdate", "procedure_date", "preop_exam_date", 
        "auditor_pre_date", "request_date", "warehouse_date", 
        "cme_processing_date", "surgery_dispatch_date", "postop_exam_date", 
        "auditor_post_date", "incident_date"
      ];

      const sanitizedForm = { ...form };
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
        status: nextStatus,
        created_by: user.id, 
        updated_at: new Date().toISOString() 
      };
      
      if (recordId) {
        const { error } = await supabase.from("opme_requests").update(payload).eq("id", recordId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("opme_requests").insert(payload);
        if (error) throw error;
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
      else if (part === 3) { setPart(5); setStep(0); }
      else if (part === 5) { setPart(6); setStep(0); }
      else if (part === 6) { setPart(7); setStep(0); }
      else if (part === 7) { setPart(4); setStep(0); }
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
      <div className="min-h-screen bg-slate-50 flex flex-col">
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

        <main className="flex-1 p-4 sm:p-6 overflow-y-auto pb-10 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-6">
            {[
              { id: 1, title: "CADASTRO", description: "Paciente" },
              { id: 2, title: "REQUISIÇÃO", description: "Pedido" },
              { id: 3, title: "AUDITORIA PRÉ", description: "Técnica" },
              { id: 5, title: "CONTROLE ADM", description: "Logística" },
              { id: 6, title: "CONSUMO", description: "Cirúrgico" },
              { id: 7, title: "AUDITORIA PÓS", description: "Técnica" },
              { id: 4, title: "FATURAMENTO", description: "AIH" },
            ].map((card) => (
              <button
                key={card.id}
                onClick={() => setPart(card.id)}
                className="kpi-card group w-full cursor-pointer text-left min-h-[70px] sm:min-h-0 bg-white border border-slate-100 shadow-sm rounded-xl p-4 transition-all active:scale-95 hover:shadow-md"
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
                            </div>
                         </div>
                         <Button variant="outline" size="sm" className="h-8 text-[10px] font-bold uppercase">Abrir</Button>
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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b px-4 py-4 flex items-center justify-between sticky top-0 z-20">
        <Button variant="ghost" size="icon" onClick={() => setPart(null)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="text-center">
          <h1 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Solicitação OPME</h1>
          <p className="text-[10px] text-slate-500 uppercase">{STEPS[step]?.description}</p>
        </div>
        <div className="w-10" />
      </header>

      <div className="flex h-1 bg-slate-200">
        {STEPS.map((_, i) => (
          <div 
            key={i} 
            className={`flex-1 transition-all duration-300 ${i <= step ? "bg-primary" : ""}`} 
          />
        ))}
      </div>

      <main className="flex-1 p-4 pb-24">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${part}-${step}`}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <div className="mb-6">
              <h2 className="font-bold text-slate-800">{STEPS[step]?.title}</h2>
              <p className="text-xs text-slate-500">{STEPS[step]?.description}</p>
            </div>

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
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Cartão SUS</Label>
                  <Input value={form.patient_sus} onChange={e => updateForm("patient_sus", e.target.value)} placeholder="Número do CNS" className="h-12 bg-white shadow-sm border-slate-200" />
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
                <div className="space-y-3">
                  {form.opme_requested.map((item: any, idx: number) => (
                    <Card key={idx} className="border-slate-200 shadow-sm overflow-hidden">
                      <CardContent className="p-0">
                        <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-500 uppercase">Item #{String(idx + 1).padStart(2, '0')}</span>
                          {form.opme_requested.length > 1 && (
                            <Button variant="ghost" size="sm" className="h-6 px-2 text-destructive text-[10px] font-bold" onClick={() => setForm((p: any) => ({ ...p, opme_requested: p.opme_requested.filter((_: any, i: number) => i !== idx) }))}>Remover</Button>
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
                                    const arr = [...form.opme_requested]; arr[idx] = { ...arr[idx], description: m.name, sigtap: m.code };
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
                  {form.opme_requested.length < 10 && (
                    <Button variant="outline" className="w-full border-dashed border-2 h-12 text-xs font-bold uppercase text-slate-400 hover:text-primary transition-colors" onClick={() => addItem("opme_requested")}>+ Adicionar Material (Até 10)</Button>
                  )}
                </div>
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
              </div>
            )}



            {/* --- PARTE 3: AUDITORIA (Médico Auditor) --- */}
            {part === 3 && step === 0 && (
              <div className="space-y-6 pb-6">
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
                      {form.opme_requested.length > 0 ? (
                        form.opme_requested.map((item: any, i: number) => (
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

                  {preopExams.length > 0 && (
                    <div className="space-y-3 mt-4">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Exames Anexados ({preopExams.length})</p>
                      <div className="grid grid-cols-2 gap-2">
                        {preopExams.map((exam, i) => (
                          <button 
                            key={i} 
                            onClick={() => exam.url && window.open(exam.url, "_blank")}
                            className="bg-white p-2 rounded-lg border border-slate-100 flex items-center gap-2 text-left hover:border-primary/30 transition-colors"
                          >
                            <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center text-primary font-black text-[8px]">IMG</div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-bold text-slate-800 truncate uppercase">{exam.type}</p>
                              <p className="text-[8px] text-slate-400 font-bold">{exam.date ? new Date(exam.date).toLocaleDateString('pt-BR') : '---'}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
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

            {/* --- PARTE 5: CONTROLE ADM --- */}
            {part === 5 && step === 0 && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase text-slate-400">Controle Administrativo</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase text-slate-500">Data Solicitação</Label>
                      <Input type="date" value={form.request_date} onChange={e => updateForm("request_date", e.target.value)} className="h-12 bg-white shadow-sm" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase text-slate-500">Horário</Label>
                      <Input type="time" value={form.request_time} onChange={e => updateForm("request_time", e.target.value)} className="h-12 bg-white shadow-sm" />
                    </div>
                  </div>
                  <div className="space-y-4 bg-slate-50 p-4 rounded-xl border shadow-sm">
                    <h4 className="text-[10px] font-bold uppercase text-slate-400">Uso do Almoxarifado</h4>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase text-slate-500">Recebido por</Label>
                        <Input value={form.warehouse_received_by} onChange={e => updateForm("warehouse_received_by", e.target.value)} placeholder="Identificação" className="h-12 bg-white border-slate-200 shadow-sm" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase text-slate-500">OPME em Estoque?</Label>
                        <Select value={form.stock_available} onValueChange={v => updateForm("stock_available", v)}>
                          <SelectTrigger className="h-12 bg-white border-slate-200 shadow-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sim">Sim</SelectItem>
                            <SelectItem value="nao">Não</SelectItem>
                            <SelectItem value="parcial">Parcial</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox id="sent_cme" checked={form.sent_to_cme} onCheckedChange={v => updateForm("sent_to_cme", v)} />
                        <Label htmlFor="sent_cme" className="text-xs">Enviada para CME (se aplicável)</Label>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 bg-white p-4 rounded-xl border shadow-sm">
                  <h4 className="text-[10px] font-bold uppercase text-slate-400 italic">Uso do CME (Esterilização)</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-slate-400">Data Processamento</Label>
                      <Input type="date" value={form.cme_processing_date} onChange={e => updateForm("cme_processing_date", e.target.value)} className="h-12 bg-white border-slate-200 shadow-sm" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-slate-400">Responsável</Label>
                      <Input value={form.cme_responsible} onChange={e => updateForm("cme_responsible", e.target.value)} placeholder="ID" className="h-12 bg-white border-slate-200 shadow-sm" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 bg-slate-50 p-4 rounded-xl border shadow-sm">
                  <h4 className="text-[10px] font-bold uppercase text-slate-400 italic">Uso do Centro Cirúrgico</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-slate-400">Data Dispensação</Label>
                      <Input type="date" value={form.surgery_dispatch_date} onChange={e => updateForm("surgery_dispatch_date", e.target.value)} className="h-12 bg-white border-slate-200 shadow-sm" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-slate-400">Responsável</Label>
                      <Input value={form.surgery_dispatch_responsible} onChange={e => updateForm("surgery_dispatch_responsible", e.target.value)} placeholder="ID" className="h-12 bg-white border-slate-200 shadow-sm" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* --- PARTE 6: CONSUMO CIRURGICO --- */}
            {part === 6 && step === 0 && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase text-primary tracking-widest border-b pb-1">Materiais Utilizados</h3>
                  <div className="space-y-3">
                    {form.opme_used?.map((item: any, idx: number) => (
                      <Card key={idx} className="border-slate-200 shadow-sm overflow-hidden">
                        <CardContent className="p-4 space-y-4">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Item #{String(idx + 1).padStart(2, '0')}</span>
                            {form.opme_used.length > 1 && (
                              <Button variant="ghost" size="sm" className="h-6 px-2 text-destructive text-[10px] font-bold uppercase" onClick={() => setForm((p: any) => ({ ...p, opme_used: p.opme_used.filter((_: any, i: number) => i !== idx) }))}>Remover</Button>
                            )}
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
                        </CardContent>
                      </Card>
                    ))}
                    <Button variant="outline" className="w-full border-dashed h-10 text-[10px] font-bold uppercase" onClick={() => addItem("opme_used")}>+ Material Utilizado</Button>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase text-primary tracking-widest border-b pb-1">Devoluções / Sobras</h3>
                  <div className="space-y-3">
                    {form.opme_returned?.map((item: any, idx: number) => (
                      <Card key={idx} className="border-slate-200 shadow-sm overflow-hidden bg-slate-50/50">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Devolução #{idx + 1}</span>
                            <Button variant="ghost" size="sm" className="h-6 px-2 text-destructive text-[10px]" onClick={() => setForm((p: any) => ({ ...p, opme_returned: p.opme_returned.filter((_: any, i: number) => i !== idx) }))}>×</Button>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold uppercase text-slate-500">Motivo</Label>
                            <Input value={item.reason} onChange={e => updateItem(idx, "reason", e.target.value, "opme_returned")} className="h-9 text-xs" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    <Button variant="outline" className="w-full border-dashed h-10 text-[10px] font-bold uppercase" onClick={() => addItem("opme_returned")}>+ Registrar Devolução</Button>
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

                    <div className="flex items-center space-x-2 bg-white p-3 rounded-lg border">
                      <Checkbox id="postop_att" checked={form.postop_image_attached} onCheckedChange={v => updateForm("postop_image_attached", v)} />
                      <Label htmlFor="postop_att" className="text-xs font-semibold">Imagem anexada ao sistema</Label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* --- PARTE 7: AUDITORIA PÓS --- */}
            {part === 7 && step === 0 && (
              <div className="space-y-6">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                  <h3 className="text-[10px] font-black uppercase text-primary tracking-widest border-b pb-2">Validação Auditor Pós-OP</h3>
                  
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
                    <Textarea value={form.auditor_post_final_opinion} onChange={e => updateForm("auditor_post_final_opinion", e.target.value)} placeholder="Conclusão da auditoria..." className="min-h-[100px] text-xs bg-white" />
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase text-slate-500">Data Validação</Label>
                      <Input type="date" value={form.auditor_post_date} onChange={e => updateForm("auditor_post_date", e.target.value)} className="h-10 text-xs bg-white" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* --- PARTE 4: FATURAMENTO (Justificativa Cirurgião) --- */}
            {part === 4 && step === 0 && (
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase text-slate-400">Justificativa do Cirurgião</h3>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Data do Ocorrido</Label>
                  <Input type="date" value={form.incident_date} onChange={e => updateForm("incident_date", e.target.value)} className="h-12 bg-white shadow-sm" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Descrição (Perda / Dano / Violação)</Label>
                  <Textarea value={form.incident_description} onChange={e => updateForm("incident_description", e.target.value)} placeholder="Descreva o ocorrido, se aplicável..." className="min-h-[120px] bg-white shadow-sm" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Assinatura Profissional</Label>
                  <Input value={form.incident_responsible} onChange={e => updateForm("incident_responsible", e.target.value)} placeholder="Nome do Cirurgião" className="h-12 bg-white shadow-sm" />
                </div>
              </div>
            )}

            {/* --- PARTE 4: FATURAMENTO (Dados Faturamento) --- */}
            {part === 4 && step === 1 && (
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase text-slate-400">Dados do Faturamento</h3>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Número da AIH</Label>
                  <Input value={form.billing_aih_number} onChange={e => updateForm("billing_aih_number", e.target.value)} placeholder="000.000.000-0" className="h-12 bg-white shadow-sm" />
                </div>
                <div className="space-y-4 bg-slate-50 p-4 rounded-xl border">
                  <Label className="text-[10px] font-bold uppercase text-slate-400">Documentação Anexada</Label>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { id: "nf", label: "Nota Fiscal da OPME" },
                      { id: "rastreabilidade", label: "Rastreabilidade (Lote/Etiqueta)" },
                      { id: "laudo", label: "Laudo Cirúrgico" },
                      { id: "consumo", label: "Registro de Consumo" },
                      { id: "exames", label: "Exames de Imagem (Pré/Pós)" },
                    ].map(doc => (
                      <div key={doc.id} className="flex items-center space-x-2 bg-white p-3 rounded border">
                        <Checkbox id={`doc_${doc.id}`} checked={form.billing_docs?.[doc.id]} onCheckedChange={v => {
                          updateForm("billing_docs", { ...form.billing_docs, [doc.id]: v });
                        }} />
                        <Label htmlFor={`doc_${doc.id}`} className="text-xs">{doc.label}</Label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Compatibilidade Utilizada x Faturada</Label>
                  <Select value={form.billing_opme_compatibility} onValueChange={v => updateForm("billing_opme_compatibility", v)}>
                    <SelectTrigger className="h-12 bg-white shadow-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sim">Sim</SelectItem>
                      <SelectItem value="nao">Não</SelectItem>
                      <SelectItem value="parcial">Parcial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="bg-white border-t p-4 fixed bottom-0 w-full z-20 flex gap-3 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        {step > 0 ? (
          <Button variant="outline" className="flex-1 h-12" onClick={prev}>
            Anterior
          </Button>
        ) : (
          <Button variant="ghost" className="flex-1 h-12 text-slate-400" onClick={() => navigate("/")}>
            Sair
          </Button>
        )}
        
        {step < STEPS.length - 1 ? (
          <Button className="flex-[2] h-12 shadow-lg shadow-primary/20" onClick={next}>
            Próximo
          </Button>
        ) : (
          <Button 
            className="flex-[2] h-12 bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-200" 
            onClick={handleSave}
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
            part === 3 ? "Finalizar Auditoria" : 
            part === 5 ? "Finalizar Controle" :
            part === 6 ? "Finalizar Consumo" :
            "Concluir Faturamento"
            )}
          </Button>
        )}
      </footer>
    </div>
  );
}
