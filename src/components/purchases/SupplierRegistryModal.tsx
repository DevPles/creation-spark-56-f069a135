import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SupplierQualificationPanel from "./SupplierQualificationPanel";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
}

interface Supplier {
  id?: string;
  nome: string;
  cnpj: string;
  email?: string | null;
  telefone?: string | null;
  endereco?: string | null;
  contato_responsavel?: string | null;
  ativo: boolean;
  observacoes?: string | null;
  qualificacao_status?: string;
  qualificacao_observacoes?: string | null;
  liberado_motivo?: string | null;
  fornece_medicamentos?: boolean;
  inidoneo?: boolean;
}

const cleanCnpj = (v: string) => (v || "").replace(/\D/g, "");
const fmtCnpj = (v: string) => {
  const s = cleanCnpj(v);
  if (s.length !== 14) return v || "—";
  return `${s.slice(0, 2)}.${s.slice(2, 5)}.${s.slice(5, 8)}/${s.slice(8, 12)}-${s.slice(12)}`;
};

export default function SupplierRegistryModal({ open, onOpenChange, onSaved }: Props) {
  const { profile, isAdmin } = useAuth();
  const [list, setList] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("suppliers").select("*").order("nome");
    setList((data as Supplier[]) || []);
  };

  useEffect(() => { if (open) { load(); setEditing(null); setSearch(""); } }, [open]);

  const startNew = () => setEditing({ nome: "", cnpj: "", ativo: true });

  const save = async () => {
    if (!editing || !profile) return;
    const cnpj = cleanCnpj(editing.cnpj);
    if (!editing.nome.trim()) { toast.error("Nome é obrigatório"); return; }
    if (cnpj.length !== 14) { toast.error("CNPJ inválido (14 dígitos)"); return; }
    setSaving(true);
    try {
      const payload = {
        nome: editing.nome.trim(),
        cnpj,
        email: editing.email || null,
        telefone: editing.telefone || null,
        endereco: editing.endereco || null,
        contato_responsavel: editing.contato_responsavel || null,
        observacoes: editing.observacoes || null,
        ativo: editing.ativo,
        fornece_medicamentos: !!editing.fornece_medicamentos,
        inidoneo: !!editing.inidoneo,
      };
      if (editing.id) {
        const { error } = await supabase.from("suppliers").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Fornecedor atualizado");
        // mantém edição aberta para permitir upload de docs
        const { data: refreshed } = await supabase.from("suppliers").select("*").eq("id", editing.id).single();
        if (refreshed) setEditing(refreshed as Supplier);
        load();
        onSaved?.();
        return;
      } else {
        const { data, error } = await supabase
          .from("suppliers")
          .insert({ ...payload, created_by: profile.id })
          .select("*")
          .single();
        if (error) throw error;
        toast.success("Fornecedor cadastrado — agora envie a documentação na aba Qualificação");
        if (data) setEditing(data as Supplier);
        load();
        onSaved?.();
        return;
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar fornecedor");
    } finally { setSaving(false); }
  };

  const toggleAtivo = async (s: Supplier) => {
    const { error } = await supabase.from("suppliers").update({ ativo: !s.ativo }).eq("id", s.id!);
    if (error) { toast.error(error.message); return; }
    toast.success(s.ativo ? "Fornecedor desativado" : "Fornecedor reativado");
    load();
    onSaved?.();
  };

  const remove = async (s: Supplier) => {
    if (!confirm(`Excluir fornecedor "${s.nome}"? O histórico de preços será mantido (sem vínculo).`)) return;
    const { error } = await supabase.from("suppliers").delete().eq("id", s.id!);
    if (error) { toast.error(error.message); return; }
    toast.success("Fornecedor excluído");
    load();
    onSaved?.();
  };

  const filtered = list.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return [s.nome, s.cnpj, s.email, s.contato_responsavel].filter(Boolean).join(" ").toLowerCase().includes(q);
  });

  const updateEditingField = (patch: Partial<Supplier>) => {
    if (!editing) return;
    setEditing({ ...editing, ...patch });
  };

  const persistField = async (patch: Partial<Supplier>) => {
    if (!editing?.id) return;
    const { error } = await supabase.from("suppliers").update(patch).eq("id", editing.id);
    if (error) { toast.error(error.message); return; }
    setEditing({ ...editing, ...patch });
    load();
  };

  const adminLiberar = async (motivo: string) => {
    if (!editing?.id || !profile) return;
    const { error } = await supabase.from("suppliers").update({
      qualificacao_status: "liberado_admin",
      liberado_por: profile.id,
      liberado_em: new Date().toISOString(),
      liberado_motivo: motivo,
    }).eq("id", editing.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Fornecedor liberado para participação em cotação");
    const { data } = await supabase.from("suppliers").select("*").eq("id", editing.id).single();
    if (data) setEditing(data as Supplier);
    load();
  };

  const adminRevogar = async () => {
    if (!editing?.id) return;
    if (!confirm("Revogar a liberação administrativa? O fornecedor voltará a status pendente.")) return;
    const { error } = await supabase.from("suppliers").update({
      qualificacao_status: "pendente",
      liberado_por: null,
      liberado_em: null,
      liberado_motivo: null,
    }).eq("id", editing.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Liberação revogada");
    const { data } = await supabase.from("suppliers").select("*").eq("id", editing.id).single();
    if (data) setEditing(data as Supplier);
    load();
  };

  const renderQualifBadge = (s: Supplier) => {
    if (s.inidoneo) return <Badge variant="destructive">Inidôneo</Badge>;
    if (s.qualificacao_status === "habilitado") return <Badge className="bg-emerald-600 hover:bg-emerald-700">Habilitado</Badge>;
    if (s.qualificacao_status === "liberado_admin") return <Badge className="bg-amber-500 hover:bg-amber-600">Liberado (admin)</Badge>;
    return <Badge variant="outline" className="border-destructive text-destructive">Pendente</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Fornecedores cadastrados</DialogTitle></DialogHeader>

        {editing ? (
          <Tabs defaultValue="dados" className="py-2">
            <TabsList className="rounded-full">
              <TabsTrigger value="dados" className="rounded-full">Dados cadastrais</TabsTrigger>
              <TabsTrigger value="qualif" className="rounded-full" disabled={!editing.id}>
                Qualificação (Art. 9º) {editing.id && renderQualifBadge(editing)}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="dados" className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nome *</Label>
                <Input value={editing.nome} onChange={e => setEditing({ ...editing, nome: e.target.value })} />
              </div>
              <div>
                <Label>CNPJ *</Label>
                <Input value={editing.cnpj} onChange={e => setEditing({ ...editing, cnpj: e.target.value })} placeholder="Somente números ou formatado" />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input value={editing.email || ""} onChange={e => setEditing({ ...editing, email: e.target.value })} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={editing.telefone || ""} onChange={e => setEditing({ ...editing, telefone: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Endereço</Label>
                <Input value={editing.endereco || ""} onChange={e => setEditing({ ...editing, endereco: e.target.value })} />
              </div>
              <div>
                <Label>Contato responsável</Label>
                <Input value={editing.contato_responsavel || ""} onChange={e => setEditing({ ...editing, contato_responsavel: e.target.value })} />
              </div>
              <div>
                <Label>Observações</Label>
                <Input value={editing.observacoes || ""} onChange={e => setEditing({ ...editing, observacoes: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" className="rounded-full" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button className="rounded-full" disabled={saving} onClick={save}>
                {saving ? (<><Loader2 className="h-4 w-4 animate-spin" />Salvando...</>) : "Salvar"}
              </Button>
            </DialogFooter>
            </TabsContent>
            <TabsContent value="qualif">
              {editing.id ? (
                <SupplierQualificationPanel
                  supplierId={editing.id}
                  forneceMedicamentos={!!editing.fornece_medicamentos}
                  inidoneo={!!editing.inidoneo}
                  qualificacaoStatus={editing.qualificacao_status || "pendente"}
                  liberadoMotivo={editing.liberado_motivo || null}
                  onChangeForneceMedicamentos={(v) => persistField({ fornece_medicamentos: v })}
                  onChangeInidoneo={(v) => persistField({ inidoneo: v, qualificacao_status: v ? "inidoneo" : "pendente" })}
                  onStatusRecomputed={(status, _missing) => {
                    // Não rebaixa liberação administrativa nem status de inidôneo automaticamente
                    if (editing.qualificacao_status === "liberado_admin") return;
                    if (editing.inidoneo) return;
                    if (status !== editing.qualificacao_status) {
                      persistField({ qualificacao_status: status });
                    }
                  }}
                  onAdminLiberar={adminLiberar}
                  onAdminRevogarLiberacao={adminRevogar}
                />
              ) : (
                <div className="text-xs text-muted-foreground p-4 text-center">Salve o fornecedor primeiro para gerenciar a documentação.</div>
              )}
              <div className="mt-4 flex justify-end">
                <Button variant="outline" className="rounded-full" onClick={() => setEditing(null)}>Fechar</Button>
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <Input placeholder="Buscar por nome, CNPJ, e-mail..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
              <Button size="sm" className="rounded-full" onClick={startNew}>+ Novo fornecedor</Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Qualificação (Art. 9º)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium text-xs">{s.nome}</TableCell>
                    <TableCell className="font-mono text-xs">{fmtCnpj(s.cnpj)}</TableCell>
                    <TableCell className="text-xs">{s.contato_responsavel || "—"}</TableCell>
                    <TableCell className="text-xs">{s.email || "—"}</TableCell>
                    <TableCell className="text-xs">{renderQualifBadge(s)}</TableCell>
                    <TableCell>
                      <Badge variant={s.ativo ? "default" : "outline"}>{s.ativo ? "Ativo" : "Inativo"}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" className="h-7 rounded-full px-3" onClick={() => setEditing(s)}>Editar</Button>
                        <Button size="sm" variant="outline" className="h-7 rounded-full px-3" onClick={() => toggleAtivo(s)}>{s.ativo ? "Desativar" : "Reativar"}</Button>
                        {isAdmin && (
                          <Button size="sm" variant="destructive" className="h-7 rounded-full px-3" onClick={() => remove(s)}>Excluir</Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum fornecedor cadastrado</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}