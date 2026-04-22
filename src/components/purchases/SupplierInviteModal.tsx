import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  requisitionId: string | null;
  requisitionNumero?: string;
}

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  enviado: "Enviado",
  respondido: "Respondido",
  expirado: "Expirado",
};

export default function SupplierInviteModal({ open, onOpenChange, requisitionId, requisitionNumero }: Props) {
  const { user } = useAuth();
  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ fornecedor_nome: "", fornecedor_cnpj: "", fornecedor_email: "", fornecedor_telefone: "" });

  const load = async () => {
    if (!requisitionId) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("quotation_invites")
      .select("*")
      .eq("requisition_id", requisitionId)
      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar convites");
    setInvites(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (open) load();
  }, [open, requisitionId]);

  const buildLink = (token: string) => `${window.location.origin}/cotacao-publica/${token}`;

  const handleAdd = async () => {
    if (!form.fornecedor_nome.trim()) {
      toast.error("Informe o nome do fornecedor");
      return;
    }
    if (!requisitionId || !user) return;
    const { error } = await (supabase as any).from("quotation_invites").insert({
      requisition_id: requisitionId,
      fornecedor_nome: form.fornecedor_nome.trim(),
      fornecedor_cnpj: form.fornecedor_cnpj.trim() || null,
      fornecedor_email: form.fornecedor_email.trim() || null,
      fornecedor_telefone: form.fornecedor_telefone.trim() || null,
      created_by: user.id,
      status: "pendente",
    });
    if (error) {
      toast.error("Erro ao criar convite");
      return;
    }
    toast.success("Convite criado");
    setForm({ fornecedor_nome: "", fornecedor_cnpj: "", fornecedor_email: "", fornecedor_telefone: "" });
    load();
  };

  const handleCopy = async (token: string, id: string) => {
    const link = buildLink(token);
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copiado");
      // marca como enviado se ainda pendente
      await (supabase as any).from("quotation_invites")
        .update({ status: "enviado" })
        .eq("id", id)
        .eq("status", "pendente");
      load();
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const handleRegenerate = async (id: string) => {
    const newToken = (typeof crypto !== "undefined" && "randomUUID" in crypto)
      ? crypto.randomUUID()
      : undefined;
    const payload: Record<string, unknown> = {
      status: "pendente",
      submitted_at: null,
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    };
    if (newToken) payload.token = newToken;
    const { error } = await (supabase as any)
      .from("quotation_invites")
      .update(payload)
      .eq("id", id);
    if (error) {
      toast.error("Erro ao reenviar");
      return;
    }
    toast.success("Convite reativado por mais 7 dias");
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este convite?")) return;
    const { error } = await (supabase as any).from("quotation_invites").delete().eq("id", id);
    if (error) {
      toast.error("Sem permissão para excluir");
      return;
    }
    load();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Convidar fornecedores {requisitionNumero ? `— ${requisitionNumero}` : ""}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <div className="space-y-3 rounded-lg border p-4">
            <div className="text-sm font-medium">Adicionar fornecedor</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Nome *</Label>
                <Input value={form.fornecedor_nome} onChange={e => setForm({ ...form, fornecedor_nome: e.target.value })} />
              </div>
              <div>
                <Label>CNPJ</Label>
                <Input value={form.fornecedor_cnpj} onChange={e => setForm({ ...form, fornecedor_cnpj: e.target.value })} />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input type="email" value={form.fornecedor_email} onChange={e => setForm({ ...form, fornecedor_email: e.target.value })} />
              </div>
              <div>
                <Label>WhatsApp / Telefone</Label>
                <Input value={form.fornecedor_telefone} onChange={e => setForm({ ...form, fornecedor_telefone: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end">
              <Button className="rounded-full" onClick={handleAdd}>Gerar link de cotação</Button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Convites enviados</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expira em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.map(inv => {
                  const expired = new Date(inv.expires_at) < new Date();
                  const status = expired && inv.status !== "respondido" ? "expirado" : inv.status;
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.fornecedor_nome}</TableCell>
                      <TableCell className="text-xs">{inv.fornecedor_cnpj || "—"}</TableCell>
                      <TableCell><Badge variant="outline">{STATUS_LABEL[status] || status}</Badge></TableCell>
                      <TableCell className="text-xs">{new Date(inv.expires_at).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button size="sm" variant="outline" className="h-8 rounded-full px-3" onClick={() => handleCopy(inv.token, inv.id)}>
                            Copiar link
                          </Button>
                          {(expired || inv.status === "respondido") ? null : (
                            <Button size="sm" variant="secondary" className="h-8 rounded-full px-3" onClick={() => handleRegenerate(inv.id)}>
                              Renovar
                            </Button>
                          )}
                          <Button size="sm" variant="destructive" className="h-8 rounded-full px-3" onClick={() => handleDelete(inv.id)}>
                            Excluir
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {invites.length === 0 && !loading && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhum convite criado</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}