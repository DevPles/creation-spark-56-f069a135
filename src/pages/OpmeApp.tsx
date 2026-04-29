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
import { 
  ArrowLeft, 
  ArrowRight, 
  User, 
  Activity, 
  Package, 
  CheckCircle2, 
  Stethoscope, 
  ClipboardList, 
  Image as ImageIcon,
  Plus,
  Trash2,
  Camera
} from "lucide-react";

const STEPS = [
  { id: "paciente", title: "Paciente", icon: User, description: "Identificação" },
  { id: "procedimento", title: "Procedimento", icon: Activity, description: "Dados Cirúrgicos" },
  { id: "solicitante", title: "Solicitante", icon: Stethoscope, description: "Profissional" },
  { id: "materiais", title: "Materiais", icon: Package, description: "OPME Solicitada" },
  { id: "justificativa", title: "Justificativa", icon: ClipboardList, description: "Instrumentais" },
  { id: "imagem", title: "Imagem", icon: ImageIcon, description: "Pré-Operatório" },
];

export default function OpmeApp() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const recordId = searchParams.get("id");
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [facilities, setFacilities] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    preop_image_count: 0
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

  const updateForm = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const updateItem = (idx: number, field: string, value: any) => {
    setForm((p: any) => {
      const arr = [...p.opme_requested];
      arr[idx] = { ...arr[idx], [field]: value };
      return { ...p, opme_requested: arr };
    });
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

  const next = () => step < STEPS.length - 1 && setStep(step + 1);
  const prev = () => step > 0 && setStep(step - 1);

  const CurrentIcon = STEPS[step].icon;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b px-4 py-4 flex items-center justify-between sticky top-0 z-20">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="text-center">
          <h1 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Solicitação OPME</h1>
          <p className="text-[10px] text-slate-500 uppercase">{STEPS[step].description}</p>
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
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <CurrentIcon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-slate-800">{STEPS[step].title}</h2>
                <p className="text-xs text-slate-500">{STEPS[step].description}</p>
              </div>
            </div>

            {step === 0 && (
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

            {step === 1 && (
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
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Nome do Procedimento</Label>
                  <Input 
                    value={form.procedure_name} 
                    onChange={e => updateForm("procedure_name", e.target.value)}
                    placeholder="Nome conforme SIGTAP"
                    className="h-12 bg-white shadow-sm border-slate-200"
                  />
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

            {step === 2 && (
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

            {step === 3 && (
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
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase text-slate-400">Descrição</Label>
                        <Input 
                          value={item.description} 
                          onChange={e => updateItem(idx, "description", e.target.value)}
                          placeholder="Nome do material"
                          className="h-10 text-sm bg-slate-50/50"
                        />
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
                            placeholder="M, G, 40..."
                            className="h-10 text-sm bg-slate-50/50"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                <Button 
                  variant="outline" 
                  className="w-full border-dashed border-2 h-12 text-slate-500"
                  onClick={addItem}
                >
                  + Adicionar outro material
                </Button>
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
            Próximo <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        ) : (
          <Button 
            className="flex-[2] h-12 bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-200" 
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Enviando..." : (
              <span className="flex items-center gap-2">
                Finalizar Pedido <CheckCircle2 className="w-4 h-4" />
              </span>
            )}
          </Button>
        )}
      </footer>
    </div>
  );
}
