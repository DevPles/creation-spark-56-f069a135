import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useEffect, useRef } from "react";
import { ContractData, ContractFormModalProps, Rubrica, STATUSES, UNITS_LIST, DEFAULT_RUBRICAS } from "./contract/types";
import RubricaSection from "./contract/RubricaSection";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, FileText, X, Loader2, Plus, Trash2, BedDouble } from "lucide-react";

export type { ContractData } from "./contract/types";

interface BedRow {
  id?: string;
  category: string;
  specialty: string;
  quantity: number;
}

interface SectorRow {
  id?: string;
  name: string;
  isNew?: boolean;
}

const CATEGORY_OPTIONS = [
  { value: "internacao", label: "Internação" },
  { value: "complementar", label: "Complementar" },
];

const ContractFormModal = ({ contract, open, onOpenChange, onSave, isNew = false }: ContractFormModalProps) => {
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [variable, setVariable] = useState("");
  const [status, setStatus] = useState("Vigente");
  const [periodStart, setPeriodStart] = useState("2024");
  const [periodEnd, setPeriodEnd] = useState("2025");
  const [unit, setUnit] = useState("Hospital Geral");
  const [goalsCount, setGoalsCount] = useState("0");
  const [pdfName, setPdfName] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const [rubricas, setRubricas] = useState<Rubrica[]>(DEFAULT_RUBRICAS);
  const [notificationEmail, setNotificationEmail] = useState("");
  const [cnes, setCnes] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Bed management
  const [beds, setBeds] = useState<BedRow[]>([]);
  const [loadingBeds, setLoadingBeds] = useState(false);
  
  // Sector management
  const [sectors, setSectors] = useState<SectorRow[]>([]);
  const [newSectorName, setNewSectorName] = useState("");

  // Load beds and sectors when unit changes or modal opens
  useEffect(() => {
    if (!open) return;
    const loadBeds = async () => {
      setLoadingBeds(true);
      const currentUnit = unit;
      const { data, error } = await supabase
        .from("beds")
        .select("id, category, specialty, quantity")
        .eq("facility_unit", currentUnit)
        .order("category")
        .order("specialty");
      if (!error && data) {
        setBeds(data);
      } else {
        setBeds([]);
      }
      setLoadingBeds(false);
    };
    const loadSectors = async () => {
      const { data } = await supabase
        .from("sectors")
        .select("id, name")
        .eq("facility_unit", unit)
        .order("name");
      setSectors((data || []).map(s => ({ id: s.id, name: s.name })));
    };
    loadBeds();
    loadSectors();
  }, [unit, open]);

  useEffect(() => {
    if (contract && !isNew) {
      setName(contract.name);
      setValue(String(contract.value));
      setVariable(String(contract.variable * 100));
      setStatus(contract.status);
      setUnit(contract.unit || "Hospital Geral");
      setGoalsCount(String(contract.goals));
      setPdfName(contract.pdfName || "");
      setPdfUrl(contract.pdfUrl || "");
      setNotificationEmail(contract.notificationEmail || "");
      setCnes(contract.cnes || "");
      setRubricas(contract.rubricas?.length ? contract.rubricas : DEFAULT_RUBRICAS);
      const parts = contract.period.split("-");
      if (parts.length === 2) {
        setPeriodStart(parts[0]);
        setPeriodEnd(parts[1]);
      }
    } else if (isNew) {
      setName("");
      setValue("");
      setVariable("10");
      setStatus("Vigente");
      setUnit("Hospital Geral");
      setGoalsCount("0");
      setPdfName("");
      setPdfUrl("");
      setNotificationEmail("");
      setCnes("");
      setPeriodStart("2024");
      setPeriodEnd("2025");
      setRubricas(DEFAULT_RUBRICAS.map((r) => ({ ...r })));
    }
  }, [contract, isNew, open]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${crypto.randomUUID()}_${safeName}`;
    const { error } = await supabase.storage.from("contract-pdfs").upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type || "application/pdf",
    });
    if (error) {
      console.error("Upload error:", error);
      toast.error("Erro ao enviar arquivo", { description: error.message });
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("contract-pdfs").getPublicUrl(filePath);
    setPdfName(file.name);
    setPdfUrl(urlData.publicUrl);
    setUploading(false);
    toast.success("PDF enviado com sucesso");
  };

  const handleRemovePdf = async () => {
    setPdfName("");
    setPdfUrl("");
  };

  // Sector helpers
  const addSector = async () => {
    const trimmed = newSectorName.trim();
    if (!trimmed) return;
    if (sectors.some(s => s.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("Setor já cadastrado");
      return;
    }
    const { data, error } = await supabase.from("sectors").insert({ name: trimmed, facility_unit: unit }).select("id, name").single();
    if (error) {
      toast.error("Erro ao adicionar setor");
      return;
    }
    setSectors(prev => [...prev, { id: data.id, name: data.name }].sort((a, b) => a.name.localeCompare(b.name)));
    setNewSectorName("");
    toast.success(`Setor "${trimmed}" adicionado`);
  };

  const removeSector = async (sectorId: string) => {
    const { error } = await supabase.from("sectors").delete().eq("id", sectorId);
    if (error) {
      toast.error("Erro ao remover setor");
      return;
    }
    setSectors(prev => prev.filter(s => s.id !== sectorId));
    toast.success("Setor removido");
  };

  // Bed CRUD helpers
  const addBedRow = () => {
    setBeds(prev => [...prev, { category: "internacao", specialty: "", quantity: 0 }]);
  };

  const updateBedRow = (index: number, field: keyof BedRow, val: string | number) => {
    setBeds(prev => prev.map((b, i) => i === index ? { ...b, [field]: val } : b));
  };

  const removeBedRow = (index: number) => {
    setBeds(prev => prev.filter((_, i) => i !== index));
  };

  const saveBeds = async (facilityUnit: string) => {
    const { error: delError } = await supabase.from("beds").delete().eq("facility_unit", facilityUnit);
    if (delError) {
      console.error("Error deleting beds:", delError);
      toast.error("Erro ao salvar leitos");
      return;
    }

    const validBeds = beds.filter(b => b.specialty.trim() !== "" && b.quantity > 0);
    if (validBeds.length === 0) return;

    const { error: insError } = await supabase.from("beds").insert(
      validBeds.map(b => ({
        facility_unit: facilityUnit,
        category: b.category,
        specialty: b.specialty.trim(),
        quantity: b.quantity,
      }))
    );
    if (insError) {
      console.error("Error inserting beds:", insError);
      toast.error("Erro ao salvar leitos");
    }
  };

  const handleSave = async () => {
    const data: ContractData = {
      id: contract?.id || crypto.randomUUID(),
      name: name || `Contrato de Gestão — ${unit}`,
      value: Number(value) || 0,
      variable: (Number(variable) || 10) / 100,
      goals: Number(goalsCount) || 0,
      status,
      period: `${periodStart}-${periodEnd}`,
      unit,
      pdfName,
      pdfUrl,
      notificationEmail,
      cnes: cnes.trim() || undefined,
      rubricas: rubricas.filter((r) => r.percent > 0),
    };
    
    // Save beds to DB
    await saveBeds(unit);
    
    onSave(data);
    onOpenChange(false);
  };

  const totalValue = Number(value) || 0;

  const bedTotals = beds.reduce((acc, b) => {
    if (b.category === "internacao") acc.internacao += b.quantity;
    else acc.complementar += b.quantity;
    return acc;
  }, { internacao: 0, complementar: 0 });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            {isNew ? "Novo contrato" : "Editar contrato"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome do contrato</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Contrato de Gestão — Hospital Geral" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Unidade</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNITS_LIST.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Valor global mensal (R$)</Label>
              <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder="12000000" />
            </div>
            <div className="space-y-2">
              <Label>Parte variável (%)</Label>
              <Input type="number" value={variable} onChange={(e) => setVariable(e.target.value)} placeholder="10" min="0" max="100" />
            </div>
          </div>

          {/* Rubrica breakdown - appears when value is set */}
          {totalValue > 0 && (
            <RubricaSection rubricas={rubricas} onChange={setRubricas} totalValue={totalValue} />
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Vigência início</Label>
              <Input value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} placeholder="2024" />
            </div>
            <div className="space-y-2">
              <Label>Vigência fim</Label>
              <Input value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} placeholder="2025" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Nº de metas vinculadas</Label>
            <Input type="number" value={goalsCount} onChange={(e) => setGoalsCount(e.target.value)} placeholder="8" />
          </div>

          <div className="space-y-2">
            <Label>E-mail para notificações semanais de metas baixas</Label>
            <Input type="email" value={notificationEmail} onChange={(e) => setNotificationEmail(e.target.value)} placeholder="gestor@hospital.gov.br" />
            <p className="text-[10px] text-muted-foreground">
              Recebe alertas semanais quando o atingimento médio das metas ficar abaixo da fração semanal esperada. O cálculo divide a meta mensal por 4 semanas e compara com o realizado acumulado.
            </p>
          </div>

          {/* ===== SECTOR MANAGEMENT SECTION ===== */}
          <div className="space-y-3 border border-border rounded-lg p-4 bg-secondary/30">
            <Label className="text-sm font-semibold">Setores / Áreas — {unit}</Label>
            <div className="flex gap-2">
              <Input
                className="h-8 text-xs flex-1"
                value={newSectorName}
                onChange={(e) => setNewSectorName(e.target.value)}
                placeholder="Nome do setor (ex: Nutrição, Farmácia)"
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSector())}
              />
              <Button type="button" variant="outline" size="sm" onClick={addSector} className="gap-1 h-8">
                <Plus className="h-3 w-3" /> Adicionar
              </Button>
            </div>
            {sectors.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {sectors.map((s) => (
                  <span key={s.id} className="inline-flex items-center gap-1 bg-background border border-border rounded-full px-3 py-1 text-xs">
                    {s.name}
                    <button type="button" onClick={() => s.id && removeSector(s.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Nenhum setor cadastrado. Adicione setores para vincular às metas.</p>
            )}
          </div>

          {/* ===== BED MANAGEMENT SECTION ===== */}
          <div className="space-y-3 border border-border rounded-lg p-4 bg-secondary/30">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Cadastro de Leitos — {unit}</Label>
              <Button type="button" variant="outline" size="sm" onClick={addBedRow} className="gap-1">
                <Plus className="h-3 w-3" /> Adicionar leito
              </Button>
            </div>

            {loadingBeds ? (
              <div className="flex items-center justify-center py-4 gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Carregando leitos...</span>
              </div>
            ) : beds.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">
                Nenhum leito cadastrado para esta unidade. Clique em "Adicionar leito" para começar.
              </p>
            ) : (
              <>
                {/* Header */}
                <div className="grid grid-cols-[1fr_2fr_80px_36px] gap-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                  <span>Tipo</span>
                  <span>Especialidade</span>
                  <span>Qtd</span>
                  <span></span>
                </div>

                <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                  {beds.map((bed, i) => (
                    <div key={i} className="grid grid-cols-[1fr_2fr_80px_36px] gap-2 items-center">
                      <Select value={bed.category} onValueChange={(v) => updateBedRow(i, "category", v)}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORY_OPTIONS.map(c => (
                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {(() => {
                        const sectorNames = sectors.map(s => s.name);
                        const extraNames = bed.specialty && !sectorNames.includes(bed.specialty) ? [bed.specialty] : [];
                        const allOptions = [...sectorNames, ...extraNames].sort((a, b) => a.localeCompare(b));
                        return (
                          <Select value={bed.specialty || ""} onValueChange={(v) => updateBedRow(i, "specialty", v)}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Selecione a área" />
                            </SelectTrigger>
                            <SelectContent>
                              {allOptions.map(name => (
                                <SelectItem key={name} value={name}>{name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        );
                      })()}
                      <Input
                        className="h-8 text-xs"
                        type="number"
                        min={0}
                        value={bed.quantity || ""}
                        onChange={(e) => updateBedRow(i, "quantity", Number(e.target.value) || 0)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        onClick={() => removeBedRow(i)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="flex gap-4 pt-2 border-t border-border text-xs">
                  <span className="text-muted-foreground">Internação: <strong className="text-primary">{bedTotals.internacao}</strong></span>
                  <span className="text-muted-foreground">Complementar: <strong style={{ color: "hsl(35 90% 55%)" }}>{bedTotals.complementar}</strong></span>
                  <span className="text-muted-foreground">Total: <strong className="text-foreground">{bedTotals.internacao + bedTotals.complementar}</strong></span>
                </div>
              </>
            )}
          </div>

          <div className="space-y-2">
            <Label>PDF do contrato</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={handleFileUpload}
            />
            <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
              {uploading ? (
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Enviando...</span>
                </div>
              ) : pdfName && pdfUrl ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText className="h-5 w-5 text-primary" />
                  <span className="text-sm text-foreground">{pdfName}</span>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleRemovePdf}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div>
                  <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                  <p className="text-sm text-muted-foreground">Arraste ou selecione o arquivo PDF</p>
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => fileInputRef.current?.click()}>
                    Selecionar arquivo
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Financial summary */}
          {totalValue > 0 && (
            <div className="bg-secondary rounded-lg p-3">
              <p className="text-xs font-medium text-foreground mb-2">Resumo financeiro</p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Valor global</p>
                  <p className="font-display font-bold text-foreground">R$ {(totalValue / 1000000).toFixed(1)}M</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Parte variável</p>
                  <p className="font-display font-bold text-foreground">{variable}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground">R$ variável</p>
                  <p className="font-display font-bold text-risk">R$ {((totalValue * (Number(variable) / 100)) / 1000).toFixed(0)}k</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={handleSave}>
              {isNew ? "Cadastrar contrato" : "Salvar alterações"}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ContractFormModal;