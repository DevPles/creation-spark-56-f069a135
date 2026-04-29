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
import { ArrowLeft } from "lucide-react";

const STEPS_CADASTRO = [
  { id: "paciente", title: "Paciente", description: "Identificação do Paciente" },
  { id: "procedimento", title: "Procedimento", description: "Características Cirúrgicas" },
  { id: "imagem", title: "Exames", description: "Anexar Exames e Laudos" },
];

const STEPS_REQUISICAO = [
  { id: "solicitante", title: "Solicitante", description: "Profissional Responsável" },
  { id: "materiais", title: "Materiais", description: "Solicitação de OPME" },
  { id: "justificativa", title: "Justificativa", description: "Indicação e Instrumentais" },
];

const STEPS_AUDITORIA = [
  { id: "auditoria_pre", title: "Médico Auditor", description: "Validação Pré-OP" },
  { id: "administrativo", title: "Controle", description: "Logística e Suprimentos" },
  { id: "consumo", title: "Consumo", description: "Registro de Uso e Devolução" },
  { id: "imagem_pos", title: "Imagem Pós", description: "Controle Pós-OP" },
];

const STEPS_FATURAMENTO = [
  { id: "auditoria_pos", title: "Auditoria Pós", description: "Validação Final" },
  { id: "cirurgiao_just", title: "Justificativa", description: "Descrição de Intercorrências" },
  { id: "faturamento", title: "Codificação", description: "Fechamento e AIH" },
];

export default function OpmeApp() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const recordId = searchParams.get("id");
  const [part, setPart] = useState<number | null>(null);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [facilities, setFacilities] = useState<string[]>([]);
  const [sigtapSuggestions, setSigtapSuggestions] = useState<any[]>([]);
  const [materialSuggestions, setMaterialSuggestions] = useState<{ idx: number, items: any[] }>({ idx: -1, items: [] });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const STEPS = part === 1 ? STEPS_CADASTRO : part === 2 ? STEPS_REQUISICAO : part === 3 ? STEPS_AUDITORIA : STEPS_FATURAMENTO;

  const [form, setForm] = useState<any>({
    facility_unit: profile?.facility_unit || "Hospital Geral",
    status: "rascunho",
    patient_name: "",
    patient_record: "",
    patient_birthdate: "",
    patient_mother_name: "",
    patient_sus: "",
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
        }
        setLoading(false);
      })();
    }
  }, [recordId]);

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

  const updateItem = (idx: number, field: string, value: any) => {
    setForm((p: any) => {
      const arr = [...p.opme_requested];
      arr[idx] = { ...arr[idx], [field]: value };
      return { ...p, opme_requested: arr };
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

  const addItem = () => {
    setForm((p: any) => ({ ...p, opme_requested: [...p.opme_requested, { description: "", quantity: "1", size_model: "", sigtap: "" }] }));
  };

  const handleSave = async () => {
    if (!user) { toast.error("Não autenticado"); return; }
    if (!form.patient_name?.trim()) { toast.error("Informe o nome do paciente"); setStep(0); return; }
    
    setSaving(true);
    try {
      const payload = { ...form, created_by: user.id, updated_at: new Date().toISOString() };
      
      if (recordId) {
        const { error } = await supabase.from("opme_requests").update(payload).eq("id", recordId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("opme_requests").insert(payload);
        if (error) throw error;
      }
      
      toast.success("Pedido enviado com sucesso!");
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else if (part < 3) {
      setPart(part + 1);
      setStep(0);
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
        <header className="bg-white border-b px-4 py-6 flex items-center justify-between sticky top-0 z-20">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="text-center">
            <h1 className="text-lg font-bold text-slate-900 uppercase tracking-wider">Menu OPME</h1>
            <p className="text-xs text-slate-500">Selecione a etapa desejada</p>
          </div>
          <div className="w-10" />
        </header>

        <main className="flex-1 p-6 grid grid-cols-1 gap-4 overflow-y-auto pb-10">
          {[
            { id: 1, title: "CADASTRO", desc: "Equipe de Enfermagem: Dados do paciente e exames", color: "border-blue-500 bg-blue-50" },
            { id: 2, title: "REQUISIÇÃO", desc: "Médico Solicitante: Materiais e justificativa", color: "border-emerald-500 bg-emerald-50" },
            { id: 3, title: "AUDITORIA", desc: "Médico Auditor e Administrativo: Validação e Consumo", color: "border-amber-500 bg-amber-50" },
            { id: 4, title: "FATURAMENTO", desc: "Setor de Faturamento: Codificação e fechamento AIH", color: "border-slate-500 bg-slate-50" },
          ].map((card) => (
            <button
              key={card.id}
              onClick={() => setPart(card.id)}
              className={`w-full p-6 rounded-2xl border-2 text-left shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] ${card.color}`}
            >
              <h3 className="text-xl font-black text-slate-800 mb-1">{card.title}</h3>
              <p className="text-sm text-slate-600 font-medium leading-tight">{card.desc}</p>
            </button>
          ))}
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
                  <Input 
                    value={form.patient_name} 
                    onChange={e => updateForm("patient_name", e.target.value)}
                    placeholder="Nome do paciente"
                    className="h-12 bg-white shadow-sm border-slate-200"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase text-slate-500">Nascimento</Label>
                    <Input 
                      type="date"
                      value={form.patient_birthdate} 
                      onChange={e => updateForm("patient_birthdate", e.target.value)}
                      className="h-12 bg-white shadow-sm border-slate-200"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase text-slate-500">Prontuário</Label>
                    <Input 
                      value={form.patient_record} 
                      onChange={e => updateForm("patient_record", e.target.value)}
                      placeholder="Nº Registro"
                      className="h-12 bg-white shadow-sm border-slate-200"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Nome da Mãe</Label>
                  <Input 
                    value={form.patient_mother_name} 
                    onChange={e => updateForm("patient_mother_name", e.target.value)}
                    placeholder="Nome completo da mãe"
                    className="h-12 bg-white shadow-sm border-slate-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Cartão SUS</Label>
                  <Input 
                    value={form.patient_sus} 
                    onChange={e => updateForm("patient_sus", e.target.value)}
                    placeholder="Número do CNS"
                    className="h-12 bg-white shadow-sm border-slate-200"
                  />
                </div>
              </div>
            )}

            {part === 1 && step === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Data do Procedimento</Label>
                  <Input 
                    type="date"
                    value={form.procedure_date} 
                    onChange={e => updateForm("procedure_date", e.target.value)}
                    className="h-12 bg-white shadow-sm border-slate-200"
                  />
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
                  <Input 
                    value={form.procedure_name} 
                    onChange={e => updateForm("procedure_name", e.target.value)}
                    placeholder="Nome conforme SIGTAP"
                    className="h-12 bg-white shadow-sm border-slate-200"
                  />
                  {sigtapSuggestions.length > 0 && (
                    <div className="absolute z-50 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-auto">
                      {sigtapSuggestions.map((item) => (
                        <button
                          key={item.code}
                          type="button"
                          className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-0"
                          onClick={() => {
                            setForm((p: any) => ({ 
                              ...p, 
                              procedure_name: item.name, 
                              procedure_sigtap_code: item.code 
                            }));
                            setSigtapSuggestions([]);
                          }}
                        >
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
                    <Input 
                      value={form.procedure_sigtap_code} 
                      onChange={e => updateForm("procedure_sigtap_code", e.target.value)}
                      placeholder="00.00.00.00"
                      className="h-12 bg-white shadow-sm border-slate-200"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase text-slate-500">Sala / Setor</Label>
                    <Input 
                      value={form.procedure_room} 
                      onChange={e => updateForm("procedure_room", e.target.value)}
                      placeholder="Ex: Sala 01"
                      className="h-12 bg-white shadow-sm border-slate-200"
                    />
                  </div>
                </div>
              </div>
            )}

            {part === 1 && step === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Nome do Profissional</Label>
                  <Input 
                    value={form.requester_name} 
                    onChange={e => updateForm("requester_name", e.target.value)}
                    placeholder="Carimbo ou Identificação"
                    className="h-12 bg-white shadow-sm border-slate-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Registro Profissional</Label>
                  <Input 
                    value={form.requester_register} 
                    onChange={e => updateForm("requester_register", e.target.value)}
                    placeholder="CRM / CRO / COREN"
                    className="h-12 bg-white shadow-sm border-slate-200"
                  />
                </div>
              </div>
            )}

            {part === 1 && step === 3 && (
              <div className="space-y-4">
                {form.opme_requested.map((item: any, idx: number) => (
                  <Card key={idx} className="border-slate-200">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-primary uppercase">Item #{idx + 1}</span>
                        {form.opme_requested.length > 1 && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 text-destructive text-[10px]"
                            onClick={() => setForm((p: any) => ({ ...p, opme_requested: p.opme_requested.filter((_: any, i: number) => i !== idx) }))}
                          >
                            Remover
                          </Button>
                        )}
                      </div>
                      <div className="space-y-2 relative">
                        <Label className="text-[10px] uppercase text-slate-400">Descrição</Label>
                        <Input 
                          value={item.description} 
                          onChange={e => updateItem(idx, "description", e.target.value)}
                          placeholder="Nome do material"
                          className="h-10 text-sm bg-slate-50/50"
                        />
                        {materialSuggestions.idx === idx && materialSuggestions.items.length > 0 && (
                          <div className="absolute z-50 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-40 overflow-auto">
                            {materialSuggestions.items.map((m) => (
                              <button
                                key={m.code}
                                type="button"
                                className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0"
                                onClick={() => {
                                  const arr = [...form.opme_requested];
                                  arr[idx] = { ...arr[idx], description: m.name, sigtap: m.code };
                                  setForm((p: any) => ({ ...p, opme_requested: arr }));
                                  setMaterialSuggestions({ idx: -1, items: [] });
                                }}
                              >
                                <p className="text-[10px] font-bold text-slate-800">{m.name}</p>
                                <p className="text-[9px] text-slate-500">Cód: {m.code}</p>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase text-slate-400">Qtd</Label>
                          <Input 
                            type="number"
                            value={item.quantity} 
                            onChange={e => updateItem(idx, "quantity", e.target.value)}
                            className="h-10 text-sm bg-slate-50/50"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase text-slate-400">Tam/Modelo</Label>
                          <Input 
                            value={item.size_model} 
                            onChange={e => updateItem(idx, "size_model", e.target.value)}
                            placeholder="Tamanho"
                            className="h-10 text-sm bg-slate-50/50"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase text-slate-400">Cód. SIGTAP</Label>
                        <Input 
                          value={item.sigtap} 
                          onChange={e => updateItem(idx, "sigtap", e.target.value)}
                          placeholder="00.00.00.00"
                          className="h-10 text-sm bg-slate-50/50"
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
                <Button 
                  variant="outline" 
                  className="w-full border-dashed border-2 h-12 text-slate-500"
                  onClick={addItem}
                >
                  Adicionar outro material
                </Button>
              </div>
            )}

            {part === 1 && step === 4 && (
              <div className="space-y-6">
                <div className="space-y-4 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                  <h3 className="text-xs font-bold uppercase text-slate-400">Instrumentais / Acessórios</h3>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="instr_spec" 
                        checked={form.instruments_specific} 
                        onCheckedChange={v => updateForm("instruments_specific", v)} 
                      />
                      <Label htmlFor="instr_spec" className="text-sm">Necessita instrumental específico</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="instr_loan" 
                        checked={form.instruments_loan} 
                        onCheckedChange={v => updateForm("instruments_loan", v)} 
                      />
                      <Label htmlFor="instr_loan" className="text-sm">Necessita comodato</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="instr_na" 
                        checked={form.instruments_na} 
                        onCheckedChange={v => updateForm("instruments_na", v)} 
                      />
                      <Label htmlFor="instr_na" className="text-sm">Não se aplica</Label>
                    </div>
                  </div>
                  <div className="space-y-2 mt-4">
                    <Label className="text-xs font-semibold uppercase text-slate-500">Especificar Instrumentais</Label>
                    <Textarea 
                      value={form.instruments_specify} 
                      onChange={e => updateForm("instruments_specify", e.target.value)}
                      placeholder="Descreva os instrumentais necessários..."
                      className="min-h-[80px] bg-white border-slate-200"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Justificativa Clínica</Label>
                  <Textarea 
                    value={form.clinical_indication} 
                    onChange={e => updateForm("clinical_indication", e.target.value)}
                    placeholder="Indicação clínica / evidência terapêutica"
                    className="min-h-[120px] bg-white border-slate-200 shadow-sm"
                  />
                </div>
              </div>
            )}

            {part === 1 && step === 5 && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Tipo de Exame de Imagem</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {["Radiografia", "Tomografia", "Ressonância", "Ultrassonografia"].map(type => (
                      <div key={type} className="flex items-center space-x-2 bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                        <Checkbox 
                          id={`img_${type}`} 
                          checked={form.preop_image_types?.includes(type)}
                          onCheckedChange={(v) => {
                            const current = form.preop_image_types || [];
                            updateForm("preop_image_types", v ? [...current, type] : current.filter((t: string) => t !== type));
                          }}
                        />
                        <Label htmlFor={`img_${type}`} className="text-xs">{type}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase text-slate-500">Data do Exame</Label>
                    <Input 
                      type="date"
                      value={form.preop_exam_date} 
                      onChange={e => updateForm("preop_exam_date", e.target.value)}
                      className="h-12 bg-white shadow-sm border-slate-200"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase text-slate-500">Nº do Laudo</Label>
                    <Input 
                      value={form.preop_exam_number} 
                      onChange={e => updateForm("preop_exam_number", e.target.value)}
                      placeholder="Nº Exame"
                      className="h-12 bg-white shadow-sm border-slate-200"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Achados / Descrição</Label>
                  <Textarea 
                    value={form.preop_finding_description} 
                    onChange={e => updateForm("preop_finding_description", e.target.value)}
                    placeholder="Descrição da indicação..."
                    className="min-h-[100px] bg-white border-slate-200"
                  />
                </div>

                <div className="space-y-4">
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple />
                  <Button 
                    variant="outline" 
                    className="w-full h-24 border-dashed border-2 flex flex-col gap-2 bg-slate-50"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <span className="text-xs font-medium text-slate-500">Anexar Imagem Pré-Operatória</span>
                  </Button>
                </div>
              </div>
            )}

            {/* --- PARTE 2 --- */}
            {part === 2 && step === 0 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Nome do Médico Auditor</Label>
                  <Input 
                    value={form.auditor_pre_name} 
                    onChange={e => updateForm("auditor_pre_name", e.target.value)}
                    placeholder="Identificação do Auditor"
                    className="h-12 bg-white shadow-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Registro (CRM)</Label>
                  <Input 
                    value={form.auditor_pre_crm} 
                    onChange={e => updateForm("auditor_pre_crm", e.target.value)}
                    placeholder="Nº do Registro"
                    className="h-12 bg-white shadow-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Análise da Indicação</Label>
                  <Select value={form.auditor_pre_analysis} onValueChange={v => updateForm("auditor_pre_analysis", v)}>
                    <SelectTrigger className="h-12 bg-white shadow-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="adequada">Adequada</SelectItem>
                      <SelectItem value="inadequada">Inadequada</SelectItem>
                      <SelectItem value="complementacao">Necessita complementação</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Compatibilidade SIGTAP</Label>
                  <Select value={form.auditor_pre_sigtap_compat} onValueChange={v => updateForm("auditor_pre_sigtap_compat", v)}>
                    <SelectTrigger className="h-12 bg-white shadow-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sim">Sim</SelectItem>
                      <SelectItem value="nao">Não</SelectItem>
                      <SelectItem value="parcial">Parcial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Parecer Técnico</Label>
                  <Textarea 
                    value={form.auditor_pre_opinion} 
                    onChange={e => updateForm("auditor_pre_opinion", e.target.value)}
                    placeholder="Descreva a avaliação..."
                    className="min-h-[100px] bg-white shadow-sm"
                  />
                </div>
              </div>
            )}

            {part === 2 && step === 1 && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase text-slate-400">Controle Administrativo</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase text-slate-500">Data Solicitação</Label>
                      <Input type="date" value={form.request_date} onChange={e => updateForm("request_date", e.target.value)} className="h-12 bg-white" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase text-slate-500">Horário</Label>
                      <Input type="time" value={form.request_time} onChange={e => updateForm("request_time", e.target.value)} className="h-12 bg-white" />
                    </div>
                  </div>
                  <div className="space-y-4 bg-slate-50 p-4 rounded-xl border shadow-sm">
                    <h4 className="text-[10px] font-bold uppercase text-slate-400">Uso do Almoxarifado</h4>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase text-slate-500">Recebido por</Label>
                        <Input value={form.warehouse_received_by} onChange={e => updateForm("warehouse_received_by", e.target.value)} placeholder="Identificação" className="h-12 bg-white border-slate-200" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase text-slate-500">OPME em Estoque?</Label>
                        <Select value={form.stock_available} onValueChange={v => updateForm("stock_available", v)}>
                          <SelectTrigger className="h-12 bg-white border-slate-200"><SelectValue /></SelectTrigger>
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
                      <Input type="date" value={form.cme_processing_date} onChange={e => updateForm("cme_processing_date", e.target.value)} className="h-12 bg-white border-slate-200" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-slate-400">Responsável</Label>
                      <Input value={form.cme_responsible} onChange={e => updateForm("cme_responsible", e.target.value)} placeholder="ID" className="h-12 bg-white border-slate-200" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 bg-slate-50 p-4 rounded-xl border shadow-sm">
                  <h4 className="text-[10px] font-bold uppercase text-slate-400 italic">Uso do Centro Cirúrgico</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-slate-400">Data Dispensação</Label>
                      <Input type="date" value={form.surgery_dispatch_date} onChange={e => updateForm("surgery_dispatch_date", e.target.value)} className="h-12 bg-white border-slate-200" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-slate-400">Responsável</Label>
                      <Input value={form.surgery_dispatch_responsible} onChange={e => updateForm("surgery_dispatch_responsible", e.target.value)} placeholder="ID" className="h-12 bg-white border-slate-200" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {part === 2 && step === 3 && (
              <div className="space-y-6">
                <h3 className="text-sm font-bold uppercase text-slate-800">Registro de Consumo</h3>
                <div className="space-y-4">
                  <Label className="text-[10px] font-bold uppercase text-primary">OPME Utilizada</Label>
                  {form.opme_used.map((item: any, idx: number) => (
                    <Card key={idx} className="border-slate-200">
                      <CardContent className="p-4 space-y-3">
                        <Input value={item.description} onChange={e => {
                          const arr = [...form.opme_used]; arr[idx].description = e.target.value; updateForm("opme_used", arr);
                        }} placeholder="Material Utilizado" className="h-10 text-sm" />
                        <div className="grid grid-cols-3 gap-2">
                          <Input value={item.quantity} type="number" onChange={e => {
                            const arr = [...form.opme_used]; arr[idx].quantity = e.target.value; updateForm("opme_used", arr);
                          }} placeholder="Qtd" className="h-10 text-sm" />
                          <Input value={item.batch} onChange={e => {
                            const arr = [...form.opme_used]; arr[idx].batch = e.target.value; updateForm("opme_used", arr);
                          }} placeholder="Lote" className="h-10 text-sm" />
                          <Input value={item.expiry} onChange={e => {
                            const arr = [...form.opme_used]; arr[idx].expiry = e.target.value; updateForm("opme_used", arr);
                          }} placeholder="Val" className="h-10 text-sm" />
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox id={`label_${idx}`} checked={item.label_fixed === "sim"} onCheckedChange={v => {
                            const arr = [...form.opme_used]; arr[idx].label_fixed = v ? "sim" : "nao"; updateForm("opme_used", arr);
                          }} />
                          <Label htmlFor={`label_${idx}`} className="text-xs">Etiqueta fixada?</Label>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  <Button variant="outline" className="w-full h-10 text-xs border-dashed" onClick={() => updateForm("opme_used", [...form.opme_used, { description: "", quantity: "1", batch: "", expiry: "", label_fixed: "sim" }])}>
                    + Adicionar Material Utilizado
                  </Button>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <Label className="text-[10px] font-bold uppercase text-amber-600">OPME Devolvida</Label>
                  {form.opme_returned.map((item: any, idx: number) => (
                    <Card key={idx} className="border-slate-100 bg-slate-50">
                      <CardContent className="p-4 space-y-3">
                        <Input value={item.description} onChange={e => {
                          const arr = [...form.opme_returned]; arr[idx].description = e.target.value; updateForm("opme_returned", arr);
                        }} placeholder="Material Devolvido" className="h-10 text-sm bg-white" />
                        <div className="grid grid-cols-2 gap-2">
                          <Input value={item.quantity} type="number" onChange={e => {
                            const arr = [...form.opme_returned]; arr[idx].quantity = e.target.value; updateForm("opme_returned", arr);
                          }} placeholder="Qtd" className="h-10 text-sm bg-white" />
                          <Input value={item.responsible} onChange={e => {
                            const arr = [...form.opme_returned]; arr[idx].responsible = e.target.value; updateForm("opme_returned", arr);
                          }} placeholder="Responsável" className="h-10 text-sm bg-white" />
                        </div>
                        <Input value={item.reason} onChange={e => {
                          const arr = [...form.opme_returned]; arr[idx].reason = e.target.value; updateForm("opme_returned", arr);
                        }} placeholder="Motivo da devolução" className="h-10 text-sm bg-white" />
                      </CardContent>
                    </Card>
                  ))}
                  <Button variant="outline" className="w-full h-10 text-xs border-dashed" onClick={() => updateForm("opme_returned", [...form.opme_returned, { description: "", quantity: "0", reason: "", responsible: "" }])}>
                    + Registrar Devolução
                  </Button>
                </div>
              </div>
            )}

            {part === 2 && step === 4 && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Tipo de Exame (Pós-OP)</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {["Radiografia", "Tomografia", "Ressonância", "Ultrassonografia"].map(type => (
                      <div key={type} className="flex items-center space-x-2 bg-white p-3 rounded-lg border shadow-sm">
                        <Checkbox 
                          id={`postimg_${type}`} 
                          checked={form.postop_image_types?.includes(type)}
                          onCheckedChange={(v) => {
                            const current = form.postop_image_types || [];
                            updateForm("postop_image_types", v ? [...current, type] : current.filter((t: string) => t !== type));
                          }}
                        />
                        <Label htmlFor={`postimg_${type}`} className="text-[10px]">{type}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase text-slate-500">Data do Exame</Label>
                    <Input type="date" value={form.postop_exam_date} onChange={e => updateForm("postop_exam_date", e.target.value)} className="h-12 bg-white" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase text-slate-500">Nº Laudo</Label>
                    <Input value={form.postop_exam_number} onChange={e => updateForm("postop_exam_number", e.target.value)} placeholder="Nº" className="h-12 bg-white" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Resultado / Posicionamento</Label>
                  <Textarea value={form.postop_result_description} onChange={e => updateForm("postop_result_description", e.target.value)} placeholder="Descrição técnica..." className="min-h-[100px] bg-white" />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Responsável Validação</Label>
                  <Input value={form.postop_validation_responsible} onChange={e => updateForm("postop_validation_responsible", e.target.value)} placeholder="Assinatura / Carimbo" className="h-12 bg-white" />
                </div>

                <Button variant="outline" className="w-full h-20 border-dashed border-2 bg-slate-50" onClick={() => fileInputRef.current?.click()}>
                  <span className="text-xs font-medium text-slate-500">Anexar Imagem Pós-Operatória</span>
                </Button>
              </div>
            )}

            {/* --- PARTE 3 --- */}
            {part === 3 && step === 0 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Nome do Médico Auditor (Pós)</Label>
                  <Input value={form.auditor_post_name} onChange={e => updateForm("auditor_post_name", e.target.value)} placeholder="Identificação" className="h-12 bg-white shadow-sm" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Compatibilidade OPME x Procedimento</Label>
                  <Select value={form.auditor_post_procedure_compat} onValueChange={v => updateForm("auditor_post_procedure_compat", v)}>
                    <SelectTrigger className="h-12 bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sim">Sim</SelectItem>
                      <SelectItem value="nao">Não</SelectItem>
                      <SelectItem value="parcial">Parcial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Conformidade com Imagem Pós</Label>
                  <Select value={form.auditor_post_image_conformity} onValueChange={v => updateForm("auditor_post_image_conformity", v)}>
                    <SelectTrigger className="h-12 bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sim">Sim</SelectItem>
                      <SelectItem value="nao">Não</SelectItem>
                      <SelectItem value="nao_se_aplica">Não se aplica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Parecer Técnico Final</Label>
                  <Textarea value={form.auditor_post_final_opinion} onChange={e => updateForm("auditor_post_final_opinion", e.target.value)} placeholder="Conclusão da auditoria..." className="min-h-[100px] bg-white shadow-sm" />
                </div>
              </div>
            )}

            {part === 3 && step === 1 && (
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

            {part === 3 && step === 2 && (
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
                    <SelectTrigger className="h-12 bg-white"><SelectValue /></SelectTrigger>
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
              part === 1 ? "Finalizar Parte 1" : part === 2 ? "Finalizar Parte 2" : "Concluir Solicitação"
            )}
          </Button>
        )}
      </footer>
    </div>
  );
}
