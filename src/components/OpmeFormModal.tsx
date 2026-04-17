import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import OpmeAttachmentsTab from "@/components/opme/OpmeAttachmentsTab";
import OpmeHistoryTab from "@/components/opme/OpmeHistoryTab";

interface OpmeItem {
  description: string;
  quantity: string;
  size_model: string;
  sigtap: string;
}

interface OpmeUsedItem extends OpmeItem {
  lot: string;
  validity: string;
  label_attached: boolean;
}

interface OpmeReturnedItem {
  description: string;
  quantity: string;
  reason: string;
  responsible: string;
}

interface OpmeFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordId?: string | null;
  onSaved: () => void;
  defaultUnit?: string;
  defaultStatus?: string;
}


const STATUS_OPTIONS = [
  { value: "rascunho", label: "Rascunho" },
  { value: "aguardando_auditor_pre", label: "Aguardando auditor (pré)" },
  { value: "aprovado_pre", label: "Aprovado (pré)" },
  { value: "em_execucao", label: "Em execução" },
  { value: "aguardando_auditor_pos", label: "Aguardando auditor (pós)" },
  { value: "concluido", label: "Concluído" },
  { value: "reprovado", label: "Reprovado" },
  { value: "cancelado", label: "Cancelado" },
];

const emptyItem: OpmeItem = { description: "", quantity: "", size_model: "", sigtap: "" };
const emptyUsed: OpmeUsedItem = { ...emptyItem, lot: "", validity: "", label_attached: false };
const emptyReturned: OpmeReturnedItem = { description: "", quantity: "", reason: "", responsible: "" };

const IMAGE_TYPES = ["Radiografia", "Tomografia", "Ressonância", "Ultrassonografia", "Outro"];
const BILLING_DOCS = [
  { key: "nota_fiscal", label: "Nota fiscal da OPME" },
  { key: "rastreabilidade", label: "Rastreabilidade (lote / etiqueta)" },
  { key: "laudo_cirurgico", label: "Laudo cirúrgico" },
  { key: "registro_consumo", label: "Registro de consumo preenchido" },
  { key: "autorizacao_previa", label: "Autorização prévia (quando aplicável)" },
  { key: "exames_imagem", label: "Exames de imagem (pré e pós)" },
];

export default function OpmeFormModal({ open, onOpenChange, recordId, onSaved }: OpmeFormModalProps) {
  const { user, profile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(recordId || null);
  const [activeTab, setActiveTab] = useState("parte1");
  const [facilities, setFacilities] = useState<string[]>([]);
  const [form, setForm] = useState<any>({
    facility_unit: profile?.facility_unit || "Hospital Geral",
    status: "rascunho",
    patient_name: "",
    patient_record: "",
    patient_birthdate: "",
    patient_mother_name: "",
    patient_sus: "",
    procedure_date: "",
    procedure_type: "",
    procedure_name: "",
    procedure_sigtap_code: "",
    procedure_room: "",
    requester_name: "",
    requester_register: "",
    opme_requested: [{ ...emptyItem }],
    instruments_specific: false,
    instruments_loan: false,
    instruments_na: false,
    instruments_specify: "",
    clinical_indication: "",
    committee_opinion: "",
    preop_image_types: [] as string[],
    preop_image_other: "",
    preop_exam_date: "",
    preop_exam_number: "",
    preop_finding_description: "",
    preop_image_attached: false,
    preop_image_count: 0,
    preop_validation_responsible: "",
    auditor_pre_name: "",
    auditor_pre_crm: "",
    auditor_pre_analysis: "",
    auditor_pre_sigtap_compat: "",
    auditor_pre_opinion: "",
    auditor_pre_date: "",
    request_date: "",
    request_time: "",
    warehouse_received_by: "",
    warehouse_date: "",
    warehouse_time: "",
    stock_available: "",
    sent_to_cme: false,
    cme_processing_date: "",
    cme_responsible: "",
    surgery_dispatch_date: "",
    surgery_dispatch_responsible: "",
    opme_used: [{ ...emptyUsed }],
    opme_returned: [{ ...emptyReturned }],
    postop_image_types: [] as string[],
    postop_image_other: "",
    postop_exam_date: "",
    postop_exam_number: "",
    postop_result_description: "",
    postop_image_attached: false,
    postop_image_count: 0,
    postop_validation_responsible: "",
    auditor_post_name: "",
    auditor_post_crm: "",
    auditor_post_procedure_compat: "",
    auditor_post_sigtap_compat: "",
    auditor_post_image_conformity: "",
    auditor_post_final_opinion: "",
    auditor_post_date: "",
    incident_date: "",
    incident_description: "",
    incident_responsible: "",
    billing_aih_number: "",
    billing_procedure_name: "",
    billing_sigtap_code: "",
    billing_prior_authorization: "",
    billing_aih_generated: false,
    billing_opme_compatibility: "",
    billing_divergence: false,
    billing_divergence_description: "",
    billing_docs: {} as Record<string, boolean>,
    notes: "",
  });

  useEffect(() => {
    if (!open) return;
    setCurrentId(recordId || null);
    // Load dynamic facilities from profiles + contracts (alphabetical, dedup)
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
    if (recordId) {
      (async () => {
        const { data, error } = await supabase.from("opme_requests").select("*").eq("id", recordId).maybeSingle();
        if (error) { toast.error("Erro ao carregar"); return; }
        if (data) {
          setForm({
            ...data,
            opme_requested: Array.isArray(data.opme_requested) && data.opme_requested.length ? data.opme_requested : [{ ...emptyItem }],
            opme_used: Array.isArray(data.opme_used) && data.opme_used.length ? data.opme_used : [{ ...emptyUsed }],
            opme_returned: Array.isArray(data.opme_returned) && data.opme_returned.length ? data.opme_returned : [{ ...emptyReturned }],
            preop_image_types: data.preop_image_types || [],
            postop_image_types: data.postop_image_types || [],
            billing_docs: data.billing_docs || {},
            patient_birthdate: data.patient_birthdate || "",
            procedure_date: data.procedure_date || "",
            preop_exam_date: data.preop_exam_date || "",
            auditor_pre_date: data.auditor_pre_date || "",
            request_date: data.request_date || "",
            warehouse_date: data.warehouse_date || "",
            cme_processing_date: data.cme_processing_date || "",
            surgery_dispatch_date: data.surgery_dispatch_date || "",
            postop_exam_date: data.postop_exam_date || "",
            auditor_post_date: data.auditor_post_date || "",
            incident_date: data.incident_date || "",
          });
        }
      })();
    }
  }, [open, recordId]);

  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const updateItem = (key: "opme_requested" | "opme_used" | "opme_returned", idx: number, field: string, value: any) => {
    setForm((p: any) => {
      const arr = [...p[key]];
      arr[idx] = { ...arr[idx], [field]: value };
      return { ...p, [key]: arr };
    });
  };
  const addItem = (key: "opme_requested" | "opme_used" | "opme_returned") => {
    const tpl = key === "opme_requested" ? emptyItem : key === "opme_used" ? emptyUsed : emptyReturned;
    setForm((p: any) => ({ ...p, [key]: [...p[key], { ...tpl }] }));
  };
  const removeItem = (key: "opme_requested" | "opme_used" | "opme_returned", idx: number) => {
    setForm((p: any) => ({ ...p, [key]: p[key].filter((_: any, i: number) => i !== idx) }));
  };

  const toggleImageType = (field: "preop_image_types" | "postop_image_types", t: string) => {
    setForm((p: any) => {
      const cur = p[field] || [];
      return { ...p, [field]: cur.includes(t) ? cur.filter((x: string) => x !== t) : [...cur, t] };
    });
  };

  const loadSimulation = (kind: "ortopedia" | "cardio") => {
    const today = new Date().toISOString().split("T")[0];
    if (kind === "ortopedia") {
      setForm((p: any) => ({
        ...p,
        status: "aguardando_auditor_pre",
        patient_name: "Maria Silva Souza",
        patient_record: "PR-2025-0142",
        patient_birthdate: "1962-04-18",
        patient_mother_name: "Ana Silva",
        patient_sus: "898 0012 3456 7890",
        procedure_date: today,
        procedure_type: "eletivo",
        procedure_name: "Artroplastia total de quadril",
        procedure_sigtap_code: "04.08.05.005-0",
        procedure_room: "Centro Cirúrgico — Sala 02",
        requester_name: "Dr. Carlos Andrade",
        requester_register: "CRM-SP 123456",
        clinical_indication: "Coxartrose grave à direita, dor incapacitante refratária ao tratamento conservador.",
        committee_opinion: "Aprovado pelo comitê de OPME em reunião ordinária.",
        opme_requested: [
          { description: "Prótese total de quadril cimentada", quantity: "1", size_model: "Tam. M", sigtap: "07.02.06.013-2" },
          { description: "Cimento ósseo com antibiótico", quantity: "2", size_model: "40g", sigtap: "07.02.06.020-5" },
        ],
        instruments_specific: true,
        instruments_loan: true,
        instruments_specify: "Caixa de instrumental específico do fornecedor (comodato).",
        preop_image_types: ["Radiografia", "Ressonância"],
        preop_exam_date: today,
        preop_finding_description: "Redução do espaço articular com osteófitos marginais.",
        preop_image_attached: true,
        preop_image_count: 4,
        preop_validation_responsible: "Enf. Joana Lima",
        notes: "Caso simulado — Ortopedia (eletivo).",
      }));
      toast.success("Caso 1 (Ortopedia) carregado");
    } else {
      setForm((p: any) => ({
        ...p,
        status: "em_execucao",
        patient_name: "João Pedro Oliveira",
        patient_record: "PR-2025-0867",
        patient_birthdate: "1955-11-02",
        patient_mother_name: "Rosa Oliveira",
        patient_sus: "700 1122 3344 5566",
        procedure_date: today,
        procedure_type: "urgencia",
        procedure_name: "Implante de marca-passo definitivo",
        procedure_sigtap_code: "04.06.02.005-1",
        procedure_room: "Hemodinâmica — Sala 01",
        requester_name: "Dra. Helena Costa",
        requester_register: "CRM-SP 654321",
        clinical_indication: "Bloqueio AV total sintomático com episódios de síncope.",
        committee_opinion: "Caso urgente, autorizado pela auditoria de plantão.",
        opme_requested: [
          { description: "Gerador de marca-passo dupla câmara", quantity: "1", size_model: "DDDR", sigtap: "07.02.03.018-7" },
          { description: "Eletrodo atrial ativo", quantity: "1", size_model: "52 cm", sigtap: "07.02.03.020-9" },
          { description: "Eletrodo ventricular ativo", quantity: "1", size_model: "58 cm", sigtap: "07.02.03.021-7" },
        ],
        instruments_specific: true,
        instruments_specify: "Programador do fabricante necessário em sala.",
        preop_image_types: ["Outro"],
        preop_image_other: "ECG e Holter 24h",
        preop_exam_date: today,
        preop_finding_description: "BAVT, FC média 32 bpm.",
        preop_image_attached: true,
        preop_image_count: 2,
        preop_validation_responsible: "Enf. Marcos Pinto",
        notes: "Caso simulado — Cardiologia (urgência).",
      }));
      toast.success("Caso 2 (Cardiologia) carregado");
    }
  };

  const handleSave = async () => {
    if (!user) { toast.error("Não autenticado"); return; }
    if (!form.patient_name?.trim()) { toast.error("Informe o nome do paciente"); return; }
    if (!form.facility_unit) { toast.error("Selecione a unidade"); return; }
    setSaving(true);
    try {
      const payload: any = { ...form };
      // limpar datas vazias
      ["patient_birthdate","procedure_date","preop_exam_date","auditor_pre_date","request_date","warehouse_date","cme_processing_date","surgery_dispatch_date","postop_exam_date","auditor_post_date","incident_date"].forEach(k => {
        if (!payload[k]) payload[k] = null;
      });
      payload.preop_image_count = Number(payload.preop_image_count) || 0;
      payload.postop_image_count = Number(payload.postop_image_count) || 0;

      if (currentId) {
        delete payload.id; delete payload.created_at; delete payload.updated_at; delete payload.created_by;
        const { error } = await supabase.from("opme_requests").update(payload).eq("id", currentId);
        if (error) throw error;
        toast.success("Solicitação atualizada");
      } else {
        payload.created_by = user.id;
        const { data, error } = await supabase.from("opme_requests").insert(payload).select("id").single();
        if (error) throw error;
        if (data?.id) {
          setCurrentId(data.id);
          setActiveTab("anexos");
        }
        toast.success("Solicitação criada — agora você pode anexar evidências");
      }
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{recordId ? "Editar solicitação OPME" : "Nova solicitação OPME"}</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-7 w-full">
            <TabsTrigger value="parte1">Solicitante</TabsTrigger>
            <TabsTrigger value="parte2">Auditor pré</TabsTrigger>
            <TabsTrigger value="consumo">Consumo</TabsTrigger>
            <TabsTrigger value="parte3">Auditor pós</TabsTrigger>
            <TabsTrigger value="faturamento">Faturamento</TabsTrigger>
            <TabsTrigger value="anexos" disabled={!currentId} title={!currentId ? "Salve a solicitação primeiro" : ""}>
              Anexos
            </TabsTrigger>
            <TabsTrigger value="historico" disabled={!currentId} title={!currentId ? "Salve a solicitação primeiro" : ""}>
              Histórico
            </TabsTrigger>
          </TabsList>

          {/* PARTE 1 */}
          <TabsContent value="parte1" className="space-y-6 pt-4">

            <section className="space-y-3">
              <h3 className="font-semibold">1. Identificação do paciente</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><Label>Nome completo *</Label><Input value={form.patient_name} onChange={e => set("patient_name", e.target.value)} /></div>
                <div><Label>Número do prontuário</Label><Input value={form.patient_record} onChange={e => set("patient_record", e.target.value)} /></div>
                <div><Label>Data de nascimento</Label><Input type="date" value={form.patient_birthdate} onChange={e => set("patient_birthdate", e.target.value)} /></div>
                <div><Label>Nome da mãe</Label><Input value={form.patient_mother_name} onChange={e => set("patient_mother_name", e.target.value)} /></div>
                <div><Label>Registro do paciente (SUS)</Label><Input value={form.patient_sus} onChange={e => set("patient_sus", e.target.value)} /></div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="font-semibold">2. Dados do procedimento</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><Label>Data prevista</Label><Input type="date" value={form.procedure_date} onChange={e => set("procedure_date", e.target.value)} /></div>
                <div>
                  <Label>Tipo</Label>
                  <Select value={form.procedure_type} onValueChange={(v) => set("procedure_type", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="eletivo">Eletivo</SelectItem>
                      <SelectItem value="urgencia">Urgência</SelectItem>
                      <SelectItem value="emergencia">Emergência</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Nome do procedimento (SIGTAP)</Label><Input value={form.procedure_name} onChange={e => set("procedure_name", e.target.value)} /></div>
                <div><Label>Código SIGTAP</Label><Input value={form.procedure_sigtap_code} onChange={e => set("procedure_sigtap_code", e.target.value)} /></div>
                <div className="md:col-span-2"><Label>Sala cirúrgica / setor</Label><Input value={form.procedure_room} onChange={e => set("procedure_room", e.target.value)} /></div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="font-semibold">3. Profissional solicitante</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><Label>Nome do profissional</Label><Input value={form.requester_name} onChange={e => set("requester_name", e.target.value)} /></div>
                <div><Label>Registro (CRM/CRO/COREN)</Label><Input value={form.requester_register} onChange={e => set("requester_register", e.target.value)} /></div>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">4. OPME solicitada</h3>
                <Button type="button" variant="outline" size="sm" onClick={() => addItem("opme_requested")}>Adicionar</Button>
              </div>
              {form.opme_requested.map((it: OpmeItem, idx: number) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-12 md:col-span-5"><Label className="text-xs">Descrição</Label><Input value={it.description} onChange={e => updateItem("opme_requested", idx, "description", e.target.value)} /></div>
                  <div className="col-span-4 md:col-span-2"><Label className="text-xs">Quant.</Label><Input value={it.quantity} onChange={e => updateItem("opme_requested", idx, "quantity", e.target.value)} /></div>
                  <div className="col-span-4 md:col-span-2"><Label className="text-xs">Tamanho/Modelo</Label><Input value={it.size_model} onChange={e => updateItem("opme_requested", idx, "size_model", e.target.value)} /></div>
                  <div className="col-span-3 md:col-span-2"><Label className="text-xs">SIGTAP</Label><Input value={it.sigtap} onChange={e => updateItem("opme_requested", idx, "sigtap", e.target.value)} /></div>
                  <div className="col-span-1"><Button type="button" variant="ghost" size="sm" onClick={() => removeItem("opme_requested", idx)}>Remover</Button></div>
                </div>
              ))}
            </section>

            <section className="space-y-3">
              <h3 className="font-semibold">5. Instrumentais / acessórios</h3>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2"><Checkbox checked={form.instruments_specific} onCheckedChange={(c) => set("instruments_specific", !!c)} />Necessita instrumental específico</label>
                <label className="flex items-center gap-2"><Checkbox checked={form.instruments_loan} onCheckedChange={(c) => set("instruments_loan", !!c)} />Necessita comodato</label>
                <label className="flex items-center gap-2"><Checkbox checked={form.instruments_na} onCheckedChange={(c) => set("instruments_na", !!c)} />Não se aplica</label>
              </div>
              <Textarea placeholder="Especificar..." value={form.instruments_specify} onChange={e => set("instruments_specify", e.target.value)} />
            </section>

            <section className="space-y-3">
              <h3 className="font-semibold">6. Justificativa</h3>
              <Textarea placeholder="Indicação clínica / evidência terapêutica" value={form.clinical_indication} onChange={e => set("clinical_indication", e.target.value)} />
              <div>
                <Label>Parecer da Câmara Técnica / Comissão de OPME</Label>
                <Select value={form.committee_opinion} onValueChange={(v) => set("committee_opinion", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aprovado">Aprovado</SelectItem>
                    <SelectItem value="reprovado">Reprovado</SelectItem>
                    <SelectItem value="em_analise">Em análise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="font-semibold">7. Comprovação por imagem (pré-operatório)</h3>
              <div className="flex flex-wrap gap-3">
                {IMAGE_TYPES.map(t => (
                  <label key={t} className="flex items-center gap-2"><Checkbox checked={form.preop_image_types.includes(t)} onCheckedChange={() => toggleImageType("preop_image_types", t)} />{t}</label>
                ))}
              </div>
              {form.preop_image_types.includes("Outro") && <Input placeholder="Outro tipo" value={form.preop_image_other} onChange={e => set("preop_image_other", e.target.value)} />}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><Label>Data do exame</Label><Input type="date" value={form.preop_exam_date} onChange={e => set("preop_exam_date", e.target.value)} /></div>
                <div><Label>Número do exame / laudo</Label><Input value={form.preop_exam_number} onChange={e => set("preop_exam_number", e.target.value)} /></div>
                <div className="md:col-span-2"><Label>Descrição da indicação / achado</Label><Textarea value={form.preop_finding_description} onChange={e => set("preop_finding_description", e.target.value)} /></div>
                <label className="flex items-center gap-2"><Checkbox checked={form.preop_image_attached} onCheckedChange={(c) => set("preop_image_attached", !!c)} />Imagem anexada</label>
                <div><Label>Nº de anexos</Label><Input type="number" value={form.preop_image_count} onChange={e => set("preop_image_count", e.target.value)} /></div>
                <div className="md:col-span-2"><Label>Responsável pela validação pré-operatória</Label><Input value={form.preop_validation_responsible} onChange={e => set("preop_validation_responsible", e.target.value)} /></div>
              </div>
            </section>
          </TabsContent>

          {/* PARTE 2 - AUDITOR PRÉ + ADMIN */}
          <TabsContent value="parte2" className="space-y-6 pt-4">
            <section className="space-y-3">
              <h3 className="font-semibold">8. Validação do médico auditor (pré-operatório)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><Label>Nome do auditor</Label><Input value={form.auditor_pre_name} onChange={e => set("auditor_pre_name", e.target.value)} /></div>
                <div><Label>CRM</Label><Input value={form.auditor_pre_crm} onChange={e => set("auditor_pre_crm", e.target.value)} /></div>
                <div>
                  <Label>Análise da indicação</Label>
                  <Select value={form.auditor_pre_analysis} onValueChange={(v) => set("auditor_pre_analysis", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="adequada">Adequada</SelectItem>
                      <SelectItem value="inadequada">Inadequada</SelectItem>
                      <SelectItem value="complementacao">Necessita complementação</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Compatibilidade com SIGTAP</Label>
                  <Select value={form.auditor_pre_sigtap_compat} onValueChange={(v) => set("auditor_pre_sigtap_compat", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sim">Sim</SelectItem>
                      <SelectItem value="nao">Não</SelectItem>
                      <SelectItem value="parcial">Parcial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2"><Label>Parecer técnico</Label><Textarea value={form.auditor_pre_opinion} onChange={e => set("auditor_pre_opinion", e.target.value)} /></div>
                <div><Label>Data da validação</Label><Input type="date" value={form.auditor_pre_date} onChange={e => set("auditor_pre_date", e.target.value)} /></div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="font-semibold">9. Controle administrativo</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><Label>Data da solicitação</Label><Input type="date" value={form.request_date} onChange={e => set("request_date", e.target.value)} /></div>
                <div><Label>Horário</Label><Input placeholder="hh:mm" value={form.request_time} onChange={e => set("request_time", e.target.value)} /></div>
              </div>
              <p className="text-xs font-semibold text-muted-foreground mt-2">Almoxarifado</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><Label>Recebido por</Label><Input value={form.warehouse_received_by} onChange={e => set("warehouse_received_by", e.target.value)} /></div>
                <div><Label>Data</Label><Input type="date" value={form.warehouse_date} onChange={e => set("warehouse_date", e.target.value)} /></div>
                <div><Label>Hora</Label><Input placeholder="hh:mm" value={form.warehouse_time} onChange={e => set("warehouse_time", e.target.value)} /></div>
                <div>
                  <Label>OPME disponível em estoque</Label>
                  <Select value={form.stock_available} onValueChange={(v) => set("stock_available", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sim">Sim</SelectItem>
                      <SelectItem value="nao">Não</SelectItem>
                      <SelectItem value="parcial">Parcial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex items-center gap-2"><Checkbox checked={form.sent_to_cme} onCheckedChange={(c) => set("sent_to_cme", !!c)} />OPME enviada para CME</label>
              </div>
              <p className="text-xs font-semibold text-muted-foreground mt-2">CME</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><Label>Data do processamento/esterilização</Label><Input type="date" value={form.cme_processing_date} onChange={e => set("cme_processing_date", e.target.value)} /></div>
                <div><Label>Responsável</Label><Input value={form.cme_responsible} onChange={e => set("cme_responsible", e.target.value)} /></div>
              </div>
              <p className="text-xs font-semibold text-muted-foreground mt-2">Centro cirúrgico</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><Label>Data de dispensação para sala</Label><Input type="date" value={form.surgery_dispatch_date} onChange={e => set("surgery_dispatch_date", e.target.value)} /></div>
                <div><Label>Responsável pela dispensação</Label><Input value={form.surgery_dispatch_responsible} onChange={e => set("surgery_dispatch_responsible", e.target.value)} /></div>
              </div>
            </section>
          </TabsContent>

          {/* CONSUMO + PÓS */}
          <TabsContent value="consumo" className="space-y-6 pt-4">
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">10. Registro de consumo — OPME utilizada</h3>
                <Button type="button" variant="outline" size="sm" onClick={() => addItem("opme_used")}>Adicionar</Button>
              </div>
              {form.opme_used.map((it: OpmeUsedItem, idx: number) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end border-b pb-2">
                  <div className="col-span-12 md:col-span-4"><Label className="text-xs">Descrição</Label><Input value={it.description} onChange={e => updateItem("opme_used", idx, "description", e.target.value)} /></div>
                  <div className="col-span-3 md:col-span-1"><Label className="text-xs">Quant.</Label><Input value={it.quantity} onChange={e => updateItem("opme_used", idx, "quantity", e.target.value)} /></div>
                  <div className="col-span-4 md:col-span-2"><Label className="text-xs">Lote</Label><Input value={it.lot} onChange={e => updateItem("opme_used", idx, "lot", e.target.value)} /></div>
                  <div className="col-span-4 md:col-span-2"><Label className="text-xs">Validade</Label><Input type="date" value={it.validity} onChange={e => updateItem("opme_used", idx, "validity", e.target.value)} /></div>
                  <div className="col-span-12 md:col-span-2 flex items-center gap-2 pt-4"><Checkbox checked={it.label_attached} onCheckedChange={(c) => updateItem("opme_used", idx, "label_attached", !!c)} /><span className="text-xs">Etiqueta fixada</span></div>
                  <div className="col-span-1"><Button type="button" variant="ghost" size="sm" onClick={() => removeItem("opme_used", idx)}>Remover</Button></div>
                </div>
              ))}
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">OPME devolvida (não utilizada / aberta)</h3>
                <Button type="button" variant="outline" size="sm" onClick={() => addItem("opme_returned")}>Adicionar</Button>
              </div>
              {form.opme_returned.map((it: OpmeReturnedItem, idx: number) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-12 md:col-span-4"><Label className="text-xs">Descrição</Label><Input value={it.description} onChange={e => updateItem("opme_returned", idx, "description", e.target.value)} /></div>
                  <div className="col-span-3 md:col-span-2"><Label className="text-xs">Quant.</Label><Input value={it.quantity} onChange={e => updateItem("opme_returned", idx, "quantity", e.target.value)} /></div>
                  <div className="col-span-5 md:col-span-3"><Label className="text-xs">Motivo</Label><Input value={it.reason} onChange={e => updateItem("opme_returned", idx, "reason", e.target.value)} /></div>
                  <div className="col-span-3 md:col-span-2"><Label className="text-xs">Responsável</Label><Input value={it.responsible} onChange={e => updateItem("opme_returned", idx, "responsible", e.target.value)} /></div>
                  <div className="col-span-1"><Button type="button" variant="ghost" size="sm" onClick={() => removeItem("opme_returned", idx)}>Remover</Button></div>
                </div>
              ))}
            </section>

            <section className="space-y-3">
              <h3 className="font-semibold">11. Comprovação por imagem (pós-operatório)</h3>
              <div className="flex flex-wrap gap-3">
                {IMAGE_TYPES.map(t => (
                  <label key={t} className="flex items-center gap-2"><Checkbox checked={form.postop_image_types.includes(t)} onCheckedChange={() => toggleImageType("postop_image_types", t)} />{t}</label>
                ))}
              </div>
              {form.postop_image_types.includes("Outro") && <Input placeholder="Outro tipo" value={form.postop_image_other} onChange={e => set("postop_image_other", e.target.value)} />}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><Label>Data do exame</Label><Input type="date" value={form.postop_exam_date} onChange={e => set("postop_exam_date", e.target.value)} /></div>
                <div><Label>Número do exame / laudo</Label><Input value={form.postop_exam_number} onChange={e => set("postop_exam_number", e.target.value)} /></div>
                <div className="md:col-span-2"><Label>Descrição do resultado / posicionamento</Label><Textarea value={form.postop_result_description} onChange={e => set("postop_result_description", e.target.value)} /></div>
                <label className="flex items-center gap-2"><Checkbox checked={form.postop_image_attached} onCheckedChange={(c) => set("postop_image_attached", !!c)} />Imagem anexada</label>
                <div><Label>Nº de anexos</Label><Input type="number" value={form.postop_image_count} onChange={e => set("postop_image_count", e.target.value)} /></div>
                <div className="md:col-span-2"><Label>Responsável pela validação pós-operatória</Label><Input value={form.postop_validation_responsible} onChange={e => set("postop_validation_responsible", e.target.value)} /></div>
              </div>
            </section>
          </TabsContent>

          {/* PARTE 3 */}
          <TabsContent value="parte3" className="space-y-6 pt-4">
            <section className="space-y-3">
              <h3 className="font-semibold">12. Validação do médico auditor (pós-operatório)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><Label>Nome do auditor</Label><Input value={form.auditor_post_name} onChange={e => set("auditor_post_name", e.target.value)} /></div>
                <div><Label>CRM</Label><Input value={form.auditor_post_crm} onChange={e => set("auditor_post_crm", e.target.value)} /></div>
                <div>
                  <Label>OPME utilizada x procedimento</Label>
                  <Select value={form.auditor_post_procedure_compat} onValueChange={(v) => set("auditor_post_procedure_compat", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sim">Sim</SelectItem><SelectItem value="nao">Não</SelectItem><SelectItem value="parcial">Parcial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>OPME utilizada x SIGTAP</Label>
                  <Select value={form.auditor_post_sigtap_compat} onValueChange={(v) => set("auditor_post_sigtap_compat", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sim">Sim</SelectItem><SelectItem value="nao">Não</SelectItem><SelectItem value="parcial">Parcial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Conformidade c/ exame de imagem pós</Label>
                  <Select value={form.auditor_post_image_conformity} onValueChange={(v) => set("auditor_post_image_conformity", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sim">Sim</SelectItem><SelectItem value="nao">Não</SelectItem><SelectItem value="na">Não se aplica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Data da validação</Label><Input type="date" value={form.auditor_post_date} onChange={e => set("auditor_post_date", e.target.value)} /></div>
                <div className="md:col-span-2"><Label>Parecer técnico final</Label><Textarea value={form.auditor_post_final_opinion} onChange={e => set("auditor_post_final_opinion", e.target.value)} /></div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="font-semibold">13. Justificativa de perda / dano / violação / excesso</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><Label>Data</Label><Input type="date" value={form.incident_date} onChange={e => set("incident_date", e.target.value)} /></div>
                <div><Label>Responsável</Label><Input value={form.incident_responsible} onChange={e => set("incident_responsible", e.target.value)} /></div>
                <div className="md:col-span-2"><Label>Descrição do ocorrido</Label><Textarea value={form.incident_description} onChange={e => set("incident_description", e.target.value)} /></div>
              </div>
            </section>
          </TabsContent>

          {/* FATURAMENTO */}
          <TabsContent value="faturamento" className="space-y-6 pt-4">
            <section className="space-y-3">
              <h3 className="font-semibold">14. Faturamento / codificação (pós-procedimento)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><Label>Número da AIH</Label><Input value={form.billing_aih_number} onChange={e => set("billing_aih_number", e.target.value)} /></div>
                <div><Label>Procedimento realizado (SIGTAP)</Label><Input value={form.billing_procedure_name} onChange={e => set("billing_procedure_name", e.target.value)} /></div>
                <div><Label>Código SIGTAP</Label><Input value={form.billing_sigtap_code} onChange={e => set("billing_sigtap_code", e.target.value)} /></div>
                <div>
                  <Label>Procedimento autorizado previamente</Label>
                  <Select value={form.billing_prior_authorization} onValueChange={(v) => set("billing_prior_authorization", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sim">Sim</SelectItem><SelectItem value="nao">Não</SelectItem><SelectItem value="na">Não se aplica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex items-center gap-2"><Checkbox checked={form.billing_aih_generated} onCheckedChange={(c) => set("billing_aih_generated", !!c)} />AIH gerada</label>
                <div>
                  <Label>OPME utilizada x faturada</Label>
                  <Select value={form.billing_opme_compatibility} onValueChange={(v) => set("billing_opme_compatibility", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sim">Sim</SelectItem><SelectItem value="nao">Não</SelectItem><SelectItem value="parcial">Parcial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex items-center gap-2"><Checkbox checked={form.billing_divergence} onCheckedChange={(c) => set("billing_divergence", !!c)} />Divergência identificada</label>
                {form.billing_divergence && (
                  <div className="md:col-span-2"><Label>Descrever divergência</Label><Textarea value={form.billing_divergence_description} onChange={e => set("billing_divergence_description", e.target.value)} /></div>
                )}
              </div>

              <div className="space-y-2">
                <p className="font-medium text-sm">Documentação obrigatória anexada</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {BILLING_DOCS.map(d => (
                    <label key={d.key} className="flex items-center gap-2">
                      <Checkbox checked={!!form.billing_docs[d.key]} onCheckedChange={(c) => set("billing_docs", { ...form.billing_docs, [d.key]: !!c })} />
                      {d.label}
                    </label>
                  ))}
                </div>
              </div>

              <div><Label>Observações gerais</Label><Textarea value={form.notes} onChange={e => set("notes", e.target.value)} /></div>
            </section>
          </TabsContent>

          {/* ANEXOS / EVIDÊNCIAS */}
          <TabsContent value="anexos" className="pt-4">
            <OpmeAttachmentsTab opmeRequestId={currentId} />
          </TabsContent>

          {/* HISTÓRICO / AUDITORIA */}
          <TabsContent value="historico" className="pt-4">
            <OpmeHistoryTab opmeRequestId={currentId} />
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="secondary" type="button" onClick={() => loadSimulation("ortopedia")} disabled={saving}>Simular caso 1 — Ortopedia</Button>
          <Button variant="secondary" type="button" onClick={() => loadSimulation("cardio")} disabled={saving}>Simular caso 2 — Cardiologia</Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Fechar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : currentId ? "Atualizar" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
