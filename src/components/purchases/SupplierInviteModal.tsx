import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, Mail, MessageCircle, Plus, Save, Copy, RotateCw, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Supplier {
  id: string;
  nome: string;
  cnpj: string;
  email: string | null;
  telefone: string | null;
  contato_responsavel: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  requisitionId: string | null;
  requisitionNumero?: string;
  facilityUnit?: string;
}

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  enviado: "Enviado",
  respondido: "Respondido",
  expirado: "Expirado",
};

const onlyDigits = (v: string) => (v || "").replace(/\D/g, "");
const normalizePhone = (v: string) => {
  const d = onlyDigits(v);
  if (!d) return "";
  if (d.startsWith("55")) return d;
  return `55${d}`;
};

export default function SupplierInviteModal({ open, onOpenChange, requisitionId, requisitionNumero, facilityUnit }: Props) {
  const { user } = useAuth();
  const [invites, setInvites] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [comboOpen, setComboOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [customMessage, setCustomMessage] = useState("");
  const [expiresInDays, setExpiresInDays] = useState<number>(7);
  const [form, setForm] = useState({ fornecedor_nome: "", fornecedor_cnpj: "", fornecedor_email: "", fornecedor_telefone: "" });
  const [newSupplierForm, setNewSupplierForm] = useState({ nome: "", cnpj: "", email: "", telefone: "" });

  const cadastradosByCnpj = useMemo(() => {
    const map = new Map<string, Supplier>();
    suppliers.forEach(s => { if (s.cnpj) map.set(onlyDigits(s.cnpj), s); });
    return map;
  }, [suppliers]);

  const defaultMessageTemplate = useMemo(() => {
    const expiraDate = new Date(Date.now() + expiresInDays * 86400000).toLocaleDateString("pt-BR");
    return `Prezado(a) Fornecedor(a),

A ${facilityUnit || "nossa instituição"} cumprimenta-o(a) cordialmente e vem, por meio deste, convidá-lo(a) a participar do processo de cotação ${requisitionNumero ? `nº ${requisitionNumero}` : ""}.

Sua participação é muito importante para garantirmos as melhores condições comerciais. Pedimos a gentileza de acessar o link abaixo e enviar sua proposta até ${expiraDate}.

Em caso de dúvidas, estamos à disposição.

Atenciosamente,
Setor de Compras`;
  }, [facilityUnit, requisitionNumero, expiresInDays]);

  const load = async () => {
    if (!requisitionId) return;
    setLoading(true);
    const [{ data: inv, error: ie }, { data: sup }] = await Promise.all([
      (supabase as any).from("quotation_invites").select("*").eq("requisition_id", requisitionId).order("created_at", { ascending: false }),
      (supabase as any).from("suppliers").select("id, nome, cnpj, email, telefone, contato_responsavel").eq("ativo", true).order("nome"),
    ]);
    if (ie) toast.error("Erro ao carregar convites");
    setInvites(inv || []);
    setSuppliers(sup || []);
    setLoading(false);
  };

  useEffect(() => {
    if (open) {
      load();
      setSelectedSupplierId(null);
      setShowNewSupplier(false);
      setForm({ fornecedor_nome: "", fornecedor_cnpj: "", fornecedor_email: "", fornecedor_telefone: "" });
      setNewSupplierForm({ nome: "", cnpj: "", email: "", telefone: "" });
      setExpiresInDays(7);
      setCustomMessage("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, requisitionId]);

  const buildLink = (token: string) => `${window.location.origin}/cotacao-publica/${token}`;

  const buildMessage = (invite: any) => {
    const link = buildLink(invite.token);
    const expira = new Date(invite.expires_at).toLocaleDateString("pt-BR");
    const base = (customMessage?.trim() || defaultMessageTemplate)
      .replace(/\{\{fornecedor\}\}/g, invite.fornecedor_nome || "")
      .replace(/\{\{validade\}\}/g, expira);
    return `${base}\n\nLink de acesso: ${link}\nVálido até: ${expira}`;
  };

  const pickSupplier = (s: Supplier) => {
    setSelectedSupplierId(s.id);
    setForm({
      fornecedor_nome: s.nome,
      fornecedor_cnpj: s.cnpj || "",
      fornecedor_email: s.email || "",
      fornecedor_telefone: s.telefone || "",
    });
    setComboOpen(false);
  };

  const handleManualCnpjBlur = () => {
    const digits = onlyDigits(form.fornecedor_cnpj);
    if (!digits || selectedSupplierId) return;
    const existing = cadastradosByCnpj.get(digits);
    if (existing) {
      toast.info(`Fornecedor "${existing.nome}" já está cadastrado — dados preenchidos automaticamente.`);
      pickSupplier(existing);
    }
  };

  const handleAdd = async () => {
    if (!form.fornecedor_nome.trim()) { toast.error("Informe o nome do fornecedor"); return; }
    if (!requisitionId || !user) return;
    const expiresAt = new Date(Date.now() + Math.max(1, expiresInDays) * 86400000).toISOString();
    const { error } = await (supabase as any).from("quotation_invites").insert({
      requisition_id: requisitionId,
      fornecedor_nome: form.fornecedor_nome.trim(),
      fornecedor_cnpj: form.fornecedor_cnpj.trim() || null,
      fornecedor_email: form.fornecedor_email.trim() || null,
      fornecedor_telefone: form.fornecedor_telefone.trim() || null,
      created_by: user.id,
      status: "pendente",
      expires_at: expiresAt,
    });
    if (error) { toast.error("Erro ao criar convite"); return; }
    toast.success("Convite criado");
    setForm({ fornecedor_nome: "", fornecedor_cnpj: "", fornecedor_email: "", fornecedor_telefone: "" });
    setSelectedSupplierId(null);
    load();
  };

  const handleCreateSupplier = async () => {
    if (!newSupplierForm.nome.trim() || !newSupplierForm.cnpj.trim()) {
      toast.error("Nome e CNPJ são obrigatórios"); return;
    }
    const cnpj = onlyDigits(newSupplierForm.cnpj);
    if (cadastradosByCnpj.has(cnpj)) {
      toast.error("CNPJ já cadastrado"); return;
    }
    const { data, error } = await (supabase as any).from("suppliers").insert({
      nome: newSupplierForm.nome.trim(),
      cnpj,
      email: newSupplierForm.email.trim() || null,
      telefone: newSupplierForm.telefone.trim() || null,
      ativo: true,
      created_by: user?.id || null,
    }).select().single();
    if (error) { toast.error("Erro ao cadastrar fornecedor"); return; }
    toast.success("Fornecedor cadastrado");
    setSuppliers(prev => [...prev, data].sort((a, b) => a.nome.localeCompare(b.nome)));
    pickSupplier(data);
    setShowNewSupplier(false);
    setNewSupplierForm({ nome: "", cnpj: "", email: "", telefone: "" });
  };

  const saveInviteToRegistry = async (inv: any) => {
    if (!inv.fornecedor_cnpj) { toast.error("Convite sem CNPJ — não é possível cadastrar"); return; }
    const cnpj = onlyDigits(inv.fornecedor_cnpj);
    if (cadastradosByCnpj.has(cnpj)) { toast.info("Já cadastrado"); return; }
    const { data, error } = await (supabase as any).from("suppliers").insert({
      nome: inv.fornecedor_nome,
      cnpj,
      email: inv.fornecedor_email,
      telefone: inv.fornecedor_telefone,
      ativo: true,
      created_by: user?.id || null,
    }).select().single();
    if (error) { toast.error("Erro ao cadastrar"); return; }
    setSuppliers(prev => [...prev, data].sort((a, b) => a.nome.localeCompare(b.nome)));
    toast.success("Fornecedor adicionado ao cadastro");
  };

  const markSent = async (inviteId: string, channel: "email" | "whatsapp") => {
    await (supabase as any).from("quotation_invites").update({ status: "enviado" }).eq("id", inviteId).eq("status", "pendente");
    if (user) {
      await (supabase as any).from("purchase_audit_log").insert({
        entity_type: "quotation_invite",
        entity_id: inviteId,
        action: channel === "email" ? "invite_sent_email" : "invite_sent_whatsapp",
        changed_by: user.id,
      });
    }
    load();
  };

  const handleCopyLink = async (inv: any) => {
    try {
      await navigator.clipboard.writeText(buildLink(inv.token));
      toast.success("Link copiado");
      await markSent(inv.id, "email");
    } catch { toast.error("Não foi possível copiar"); }
  };

  const handleCopyFullMessage = async (inv: any) => {
    try {
      await navigator.clipboard.writeText(buildMessage(inv));
      toast.success("Mensagem completa copiada");
    } catch { toast.error("Não foi possível copiar"); }
  };

  const handleSendEmail = (inv: any) => {
    if (!inv.fornecedor_email) { toast.error("Fornecedor sem e-mail"); return; }
    const subject = `Cotação ${requisitionNumero || ""}${facilityUnit ? ` — ${facilityUnit}` : ""}`;
    const body = buildMessage(inv);
    const url = `mailto:${encodeURIComponent(inv.fornecedor_email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = url;
    markSent(inv.id, "email");
  };

  const handleSendWhatsApp = (inv: any) => {
    if (!inv.fornecedor_telefone) { toast.error("Fornecedor sem telefone"); return; }
    const phone = normalizePhone(inv.fornecedor_telefone);
    if (!phone) { toast.error("Telefone inválido"); return; }
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(buildMessage(inv))}`;
    window.open(url, "_blank", "noopener");
    markSent(inv.id, "whatsapp");
  };

  const handleRegenerate = async (id: string) => {
    const newToken = (typeof crypto !== "undefined" && "randomUUID" in crypto) ? crypto.randomUUID() : undefined;
    const payload: Record<string, unknown> = {
      status: "pendente",
      submitted_at: null,
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    };
    if (newToken) payload.token = newToken;
    const { error } = await (supabase as any).from("quotation_invites").update(payload).eq("id", id);
    if (error) { toast.error("Erro ao reenviar"); return; }
    toast.success("Convite reativado por mais 7 dias");
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este convite?")) return;
    const { error } = await (supabase as any).from("quotation_invites").delete().eq("id", id);
    if (error) { toast.error("Sem permissão para excluir"); return; }
    load();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Convidar fornecedores {requisitionNumero ? `— ${requisitionNumero}` : ""}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Bloco principal */}
          <div className="space-y-4 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Adicionar fornecedor</div>
              <Button variant="outline" size="sm" className="rounded-full" onClick={() => setShowNewSupplier(s => !s)}>
                <Plus className="h-4 w-4 mr-1" /> Novo fornecedor
              </Button>
            </div>

            {/* Combobox cadastrado */}
            <div>
              <Label>Escolher fornecedor cadastrado</Label>
              <Popover open={comboOpen} onOpenChange={setComboOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between mt-1 font-normal">
                    {selectedSupplierId
                      ? suppliers.find(s => s.id === selectedSupplierId)?.nome
                      : "Buscar por nome ou CNPJ..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar fornecedor..." />
                    <CommandList>
                      <CommandEmpty>Nenhum fornecedor cadastrado</CommandEmpty>
                      <CommandGroup>
                        {suppliers.map(s => (
                          <CommandItem key={s.id} value={`${s.nome} ${s.cnpj}`} onSelect={() => pickSupplier(s)}>
                            <Check className={cn("mr-2 h-4 w-4", selectedSupplierId === s.id ? "opacity-100" : "opacity-0")} />
                            <div className="flex flex-col">
                              <span className="font-medium">{s.nome}</span>
                              <span className="text-xs text-muted-foreground">{s.cnpj}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Mini-form novo fornecedor */}
            {showNewSupplier && (
              <div className="rounded-md border bg-muted/30 p-3 space-y-3">
                <div className="text-xs font-medium text-muted-foreground">Cadastrar novo fornecedor</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Input placeholder="Nome *" value={newSupplierForm.nome} onChange={e => setNewSupplierForm({ ...newSupplierForm, nome: e.target.value })} />
                  <Input placeholder="CNPJ *" value={newSupplierForm.cnpj} onChange={e => setNewSupplierForm({ ...newSupplierForm, cnpj: e.target.value })} />
                  <Input placeholder="E-mail" type="email" value={newSupplierForm.email} onChange={e => setNewSupplierForm({ ...newSupplierForm, email: e.target.value })} />
                  <Input placeholder="WhatsApp / Telefone" value={newSupplierForm.telefone} onChange={e => setNewSupplierForm({ ...newSupplierForm, telefone: e.target.value })} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setShowNewSupplier(false)}>Cancelar</Button>
                  <Button size="sm" onClick={handleCreateSupplier}>Cadastrar e usar</Button>
                </div>
              </div>
            )}

            {/* Form de dados do convite */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Nome *</Label>
                <Input value={form.fornecedor_nome} onChange={e => { setForm({ ...form, fornecedor_nome: e.target.value }); setSelectedSupplierId(null); }} />
              </div>
              <div>
                <Label>CNPJ</Label>
                <Input value={form.fornecedor_cnpj} onChange={e => { setForm({ ...form, fornecedor_cnpj: e.target.value }); setSelectedSupplierId(null); }} onBlur={handleManualCnpjBlur} />
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

            <div>
              <Label>Mensagem padrão (opcional)</Label>
              <Textarea
                placeholder="Personalize a mensagem que será enviada por e-mail e WhatsApp. Se vazio, usa um texto padrão."
                value={customMessage}
                onChange={e => setCustomMessage(e.target.value)}
                className="mt-1 min-h-[80px]"
              />
            </div>

            <div className="flex justify-end">
              <Button className="rounded-full" onClick={handleAdd}>Gerar link de cotação</Button>
            </div>
          </div>

          {/* Lista de convites */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Convites enviados</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expira em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.map(inv => {
                  const expired = new Date(inv.expires_at) < new Date();
                  const status = expired && inv.status !== "respondido" ? "expirado" : inv.status;
                  const cnpjDigits = onlyDigits(inv.fornecedor_cnpj || "");
                  const isCadastrado = cnpjDigits && cadastradosByCnpj.has(cnpjDigits);
                  const canEmail = !!inv.fornecedor_email;
                  const canWhats = !!inv.fornecedor_telefone;
                  return (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <div className="font-medium flex items-center gap-2">
                          {inv.fornecedor_nome}
                          {isCadastrado && <Badge variant="secondary" className="text-[10px]">Cadastrado</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground">{inv.fornecedor_cnpj || "—"}</div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div>{inv.fornecedor_email || "—"}</div>
                        <div className="text-muted-foreground">{inv.fornecedor_telefone || "—"}</div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{STATUS_LABEL[status] || status}</Badge></TableCell>
                      <TableCell className="text-xs">{new Date(inv.expires_at).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1 flex-wrap">
                          <Button size="sm" variant="outline" className="h-8 rounded-full px-2" title="Copiar link" onClick={() => handleCopyLink(inv)}>
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 rounded-full px-2" title="Copiar mensagem completa" onClick={() => handleCopyFullMessage(inv)}>
                            Msg
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 rounded-full px-2" title="Enviar por e-mail" disabled={!canEmail} onClick={() => handleSendEmail(inv)}>
                            <Mail className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 rounded-full px-2" title="Enviar por WhatsApp" disabled={!canWhats} onClick={() => handleSendWhatsApp(inv)}>
                            <MessageCircle className="h-3.5 w-3.5" />
                          </Button>
                          {!isCadastrado && inv.fornecedor_cnpj && (
                            <Button size="sm" variant="ghost" className="h-8 rounded-full px-2" title="Salvar no cadastro" onClick={() => saveInviteToRegistry(inv)}>
                              <Save className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {(expired || inv.status === "respondido") ? null : (
                            <Button size="sm" variant="secondary" className="h-8 rounded-full px-2" title="Renovar" onClick={() => handleRegenerate(inv.id)}>
                              <RotateCw className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button size="sm" variant="destructive" className="h-8 rounded-full px-2" title="Excluir" onClick={() => handleDelete(inv.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
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
