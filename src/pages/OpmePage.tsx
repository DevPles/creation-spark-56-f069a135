import { useEffect, useState, useMemo } from "react";
import TopBar from "@/components/TopBar";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import OpmeFormModal from "@/components/OpmeFormModal";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  aguardando_auditor_pre: "Aguardando auditor (pré)",
  aprovado_pre: "Aprovado (pré)",
  em_execucao: "Em execução",
  aguardando_auditor_pos: "Aguardando auditor (pós)",
  concluido: "Concluído",
  reprovado: "Reprovado",
  cancelado: "Cancelado",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  rascunho: "outline",
  aguardando_auditor_pre: "secondary",
  aprovado_pre: "default",
  em_execucao: "default",
  aguardando_auditor_pos: "secondary",
  concluido: "default",
  reprovado: "destructive",
  cancelado: "destructive",
};

export default function OpmePage() {
  const { isAdmin } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [unitFilter, setUnitFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("opme_requests").select("*").order("created_at", { ascending: false });
    if (error) { toast.error("Erro ao carregar"); setLoading(false); return; }
    setRecords(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const units = useMemo(() => {
    const set = new Set<string>(records.map(r => r.facility_unit).filter(Boolean));
    return Array.from(set).sort();
  }, [records]);

  const filtered = useMemo(() => {
    return records.filter(r => {
      if (unitFilter !== "all" && r.facility_unit !== unitFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = [r.patient_name, r.patient_record, r.procedure_name, r.requester_name].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [records, search, unitFilter, statusFilter]);

  const stats = useMemo(() => {
    const total = records.length;
    const pendentes = records.filter(r => ["rascunho","aguardando_auditor_pre","em_execucao","aguardando_auditor_pos"].includes(r.status)).length;
    const concluidos = records.filter(r => r.status === "concluido").length;
    const reprovados = records.filter(r => r.status === "reprovado").length;
    return { total, pendentes, concluidos, reprovados };
  }, [records]);

  const handleEdit = (id: string) => { setEditingId(id); setModalOpen(true); };
  const handleNew = () => { setEditingId(null); setModalOpen(true); };
  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("opme_requests").delete().eq("id", deleteId);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Excluído");
    setDeleteId(null);
    load();
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <PageHeader
          title="Gestão de OPME"
          subtitle="Órteses, Próteses e Materiais Especiais"
          action={
            <>
              <Input
                placeholder="Buscar paciente, prontuário, procedimento..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-9 w-full sm:w-64 text-xs"
              />
              <Select value={unitFilter} onValueChange={setUnitFilter}>
                <SelectTrigger className="w-[160px] h-9 text-xs"><SelectValue placeholder="Unidade" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as unidades</SelectItem>
                  {units.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px] h-9 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  {Object.entries(STATUS_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={handleNew} size="sm" className="rounded-full h-9">
                <Plus className="h-4 w-4 mr-1" />Nova solicitação
              </Button>
            </>
          }
        />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats.total}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Pendentes</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats.pendentes}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Concluídos</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats.concluidos}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Reprovados</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats.reprovados}</p></CardContent></Card>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Procedimento</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Solicitante</TableHead>
                  <TableHead>Data prevista</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma solicitação encontrada</TableCell></TableRow>
                ) : filtered.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.patient_name || "—"}<div className="text-xs text-muted-foreground">{r.patient_record}</div></TableCell>
                    <TableCell>{r.procedure_name || "—"}<div className="text-xs text-muted-foreground">{r.procedure_sigtap_code}</div></TableCell>
                    <TableCell>{r.facility_unit}</TableCell>
                    <TableCell>{r.requester_name || "—"}</TableCell>
                    <TableCell>{r.procedure_date ? new Date(r.procedure_date).toLocaleDateString("pt-BR") : "—"}</TableCell>
                    <TableCell><Badge variant={STATUS_VARIANT[r.status] || "outline"}>{STATUS_LABELS[r.status] || r.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(r.id)}><Pencil className="h-4 w-4" /></Button>
                        {isAdmin && <Button variant="ghost" size="icon" onClick={() => setDeleteId(r.id)}><Trash2 className="h-4 w-4" /></Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>

      <OpmeFormModal open={modalOpen} onOpenChange={setModalOpen} recordId={editingId} onSaved={load} />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir solicitação?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
