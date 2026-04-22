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
      };
      if (editing.id) {
        const { error } = await supabase.from("suppliers").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Fornecedor atualizado");
      } else {
        const { error } = await supabase.from("suppliers").insert({ ...payload, created_by: profile.id });
        if (error) throw error;
        toast.success("Fornecedor cadastrado");
      }
      setEditing(null);
      load();
      onSaved?.();
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Fornecedores cadastrados</DialogTitle></DialogHeader>

        {editing ? (
          <div className="space-y-3 py-2">
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
              <Button className="rounded-full" disabled={saving} onClick={save}>{saving ? "Salvando..." : "Salvar"}</Button>
            </DialogFooter>
          </div>
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
                  <TableHead>Telefone</TableHead>
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
                    <TableCell className="text-xs">{s.telefone || "—"}</TableCell>
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