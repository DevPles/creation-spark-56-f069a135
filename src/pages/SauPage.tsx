import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "@/components/TopBar";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { motion } from "framer-motion";

const TIPO_LABELS: Record<string, string> = {
  elogio: "Elogio",
  reclamacao: "Reclamação",
  sugestao: "Sugestão",
  ouvidoria: "Ouvidoria",
};

const STATUS_LABELS: Record<string, string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  resolvido: "Resolvido",
  cancelado: "Cancelado",
};

const TIPO_COLORS: Record<string, string> = {
  elogio: "status-success",
  reclamacao: "status-critical",
  sugestao: "status-warning",
  ouvidoria: "bg-primary/10 text-primary",
};

const STATUS_COLORS: Record<string, string> = {
  aberto: "status-warning",
  em_andamento: "bg-primary/10 text-primary",
  resolvido: "status-success",
  cancelado: "bg-muted text-muted-foreground",
};

interface SauRecord {
  id: string;
  facility_unit: string;
  tipo: string;
  descricao: string;
  status: string;
  responsavel: string | null;
  setor: string | null;
  created_by: string;
  created_at: string;
  resolved_at: string | null;
  notes: string | null;
}

const SauPage = () => {
  const navigate = useNavigate();
  const { user, profile, isAdmin } = useAuth();
  const [records, setRecords] = useState<SauRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState("Todas as unidades");
  const [filterTipo, setFilterTipo] = useState("todos");
  const [filterStatus, setFilterStatus] = useState("todos");

  // Form state
  const [formTipo, setFormTipo] = useState("reclamacao");
  const [formDescricao, setFormDescricao] = useState("");
  const [formResponsavel, setFormResponsavel] = useState("");
  const [formSetor, setFormSetor] = useState("");
  const [formUnit, setFormUnit] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const UNITS = ["Hospital Geral", "UPA Norte", "UBS Centro"];

  useEffect(() => {
    if (profile) setFormUnit(profile.facility_unit);
  }, [profile]);

  const loadRecords = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("sau_records").select("*").order("created_at", { ascending: false });
    if (error) { console.error(error); toast.error("Erro ao carregar registros"); }
    else setRecords((data as SauRecord[]) || []);
    setLoading(false);
  };

  useEffect(() => { loadRecords(); }, []);

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      if (selectedUnit !== "Todas as unidades" && r.facility_unit !== selectedUnit) return false;
      if (filterTipo !== "todos" && r.tipo !== filterTipo) return false;
      if (filterStatus !== "todos" && r.status !== filterStatus) return false;
      return true;
    });
  }, [records, selectedUnit, filterTipo, filterStatus]);

  const stats = useMemo(() => ({
    total: filteredRecords.length,
    abertos: filteredRecords.filter(r => r.status === "aberto").length,
    emAndamento: filteredRecords.filter(r => r.status === "em_andamento").length,
    resolvidos: filteredRecords.filter(r => r.status === "resolvido").length,
    reclamacoes: filteredRecords.filter(r => r.tipo === "reclamacao").length,
    elogios: filteredRecords.filter(r => r.tipo === "elogio").length,
  }), [filteredRecords]);

  const handleSubmit = async () => {
    if (!user) return;
    if (!formDescricao.trim()) { toast.error("Preencha a descrição"); return; }
    setSubmitting(true);
    const { error } = await supabase.from("sau_records").insert({
      facility_unit: formUnit || profile?.facility_unit || "Hospital Geral",
      tipo: formTipo as any,
      descricao: formDescricao,
      responsavel: formResponsavel || null,
      setor: formSetor || null,
      created_by: user.id,
    });
    if (error) { console.error(error); toast.error("Erro ao criar registro"); }
    else {
      toast.success("Registro criado com sucesso");
      setModalOpen(false);
      setFormDescricao("");
      setFormResponsavel("");
      setFormSetor("");
      loadRecords();
    }
    setSubmitting(false);
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    const update: any = { status: newStatus };
    if (newStatus === "resolvido") update.resolved_at = new Date().toISOString();
    const { error } = await supabase.from("sau_records").update(update).eq("id", id);
    if (error) { console.error(error); toast.error("Erro ao atualizar status"); }
    else { toast.success("Status atualizado"); loadRecords(); }
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")} className="rounded-full mb-4">
          Voltar
        </Button>

        <PageHeader
          title="SAU"
          subtitle="Serviço de Atendimento ao Usuário — Ouvidoria, Elogios, Reclamações e Sugestões"
          selectedUnit={selectedUnit}
          onUnitChange={setSelectedUnit}
          action={
            <Button onClick={() => setModalOpen(true)}>Novo Registro</Button>
          }
        />

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <div className="kpi-card"><p className="text-xs text-muted-foreground">Total</p><p className="kpi-value">{stats.total}</p></div>
          <div className="kpi-card"><p className="text-xs text-muted-foreground">Abertos</p><p className="kpi-value text-amber-500">{stats.abertos}</p></div>
          <div className="kpi-card"><p className="text-xs text-muted-foreground">Em andamento</p><p className="kpi-value text-primary">{stats.emAndamento}</p></div>
          <div className="kpi-card"><p className="text-xs text-muted-foreground">Resolvidos</p><p className="kpi-value text-emerald-600">{stats.resolvidos}</p></div>
          <div className="kpi-card"><p className="text-xs text-muted-foreground">Reclamações</p><p className="kpi-value text-destructive">{stats.reclamacoes}</p></div>
          <div className="kpi-card"><p className="text-xs text-muted-foreground">Elogios</p><p className="kpi-value text-emerald-600">{stats.elogios}</p></div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <Select value={filterTipo} onValueChange={setFilterTipo}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              {Object.entries(TIPO_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Records list */}
        {loading ? (
          <p className="text-muted-foreground text-center py-12">Carregando registros...</p>
        ) : filteredRecords.length === 0 ? (
          <div className="kpi-card p-8 text-center">
            <p className="text-muted-foreground">Nenhum registro encontrado.</p>
            <Button className="mt-4" onClick={() => setModalOpen(true)}>Criar primeiro registro</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRecords.map((record, i) => (
              <motion.div
                key={record.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="kpi-card"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`status-badge text-[10px] ${TIPO_COLORS[record.tipo] || ""}`}>
                        {TIPO_LABELS[record.tipo] || record.tipo}
                      </span>
                      <span className={`status-badge text-[10px] ${STATUS_COLORS[record.status] || ""}`}>
                        {STATUS_LABELS[record.status] || record.status}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{record.facility_unit}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(record.created_at).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    <p className="text-sm text-foreground">{record.descricao}</p>
                    <div className="flex gap-4 mt-1 text-[10px] text-muted-foreground">
                      {record.responsavel && <span>Responsável: {record.responsavel}</span>}
                      {record.setor && <span>Setor: {record.setor}</span>}
                      {record.resolved_at && <span>Resolvido: {new Date(record.resolved_at).toLocaleDateString("pt-BR")}</span>}
                    </div>
                  </div>
                  {(isAdmin || record.status !== "resolvido") && (
                    <Select value={record.status} onValueChange={(v) => handleStatusChange(record.id, v)}>
                      <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* Create Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Registro SAU</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground">Tipo</label>
              <Select value={formTipo} onValueChange={setFormTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Unidade</label>
              <Select value={formUnit} onValueChange={setFormUnit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Descrição *</label>
              <Textarea
                value={formDescricao}
                onChange={e => setFormDescricao(e.target.value)}
                placeholder="Descreva o elogio, reclamação ou sugestão..."
                className="min-h-[100px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-muted-foreground">Responsável</label>
                <Input value={formResponsavel} onChange={e => setFormResponsavel(e.target.value)} placeholder="Nome do responsável" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Setor</label>
                <Input value={formSetor} onChange={e => setFormSetor(e.target.value)} placeholder="Setor envolvido" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Salvando..." : "Criar Registro"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SauPage;
