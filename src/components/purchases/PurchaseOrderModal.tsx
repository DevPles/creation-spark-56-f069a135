import { useEffect, useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { UNIVIDA_LOGO_BASE64 } from "@/assets/univida-logo-base64";

const fmtBRL = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  quotationId?: string;
  orderId?: string;
  onSaved: () => void;
}

export default function PurchaseOrderModal({ open, onOpenChange, quotationId, orderId, onSaved }: Props) {
  const { profile, isAdmin, role } = useAuth();
  const canApprove = isAdmin || role === "gestor";
  const [saving, setSaving] = useState(false);

  const [order, setOrder] = useState<any>(null);
  const [contracts, setContracts] = useState<any[]>([]);
  const [contractId, setContractId] = useState<string>("");
  const [rubricaId, setRubricaId] = useState<string>("");
  const [orders, setOrders] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [fornecedor, setFornecedor] = useState("");
  const [fornecedorCnpj, setFornecedorCnpj] = useState("");
  const [endereco, setEndereco] = useState("");
  const [prazo, setPrazo] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [motivoNegacao, setMotivoNegacao] = useState("");
  const [facilityUnit, setFacilityUnit] = useState("");
  const [reqId, setReqId] = useState<string | null>(null);
  const [reqNumero, setReqNumero] = useState<string>("");
  // Quotation supplier selection
  const [quotation, setQuotation] = useState<any>(null);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [prices, setPrices] = useState<any[]>([]);
  const [reqItems, setReqItems] = useState<any[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [justificativaTroca, setJustificativaTroca] = useState("");
  const [winnerSupplierId, setWinnerSupplierId] = useState<string>("");
  const [approvalLink, setApprovalLink] = useState<string>("");
  const [signedApproval, setSignedApproval] = useState<any>(null);
  const [generatingLink, setGeneratingLink] = useState(false);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      const { data: cs } = await supabase.from("contracts").select("*");
      const contractsList = cs || [];
      setContracts(contractsList);
      const { data: allOrders } = await supabase.from("purchase_orders").select("*").in("status", ["autorizada", "enviada", "recebida"]);
      setOrders(allOrders || []);

      if (orderId) {
        const { data: o } = await supabase.from("purchase_orders").select("*").eq("id", orderId).single();
        setOrder(o);
        let cid = o?.contract_id || "";
        if (!cid && o?.facility_unit) {
          const auto = contractsList.find((c: any) => c.unit === o.facility_unit && c.status === "Vigente")
            || contractsList.find((c: any) => c.unit === o.facility_unit);
          cid = auto?.id || "";
        }
        setContractId(cid);
        setRubricaId(o?.rubrica_id || "");
        setFornecedor(o?.fornecedor_nome || "");
        setFornecedorCnpj(o?.fornecedor_cnpj || "");
        setEndereco(o?.endereco_entrega || "");
        setPrazo(o?.prazo_entrega || "");
        setObservacoes(o?.observacoes || "");
        setFacilityUnit(o?.facility_unit || "");
        setReqId(o?.requisition_id || null);
        if (o?.requisition_id) {
          const { data: rq } = await supabase.from("purchase_requisitions").select("numero").eq("id", o.requisition_id).maybeSingle();
          setReqNumero(rq?.numero || "");
        }
        const { data: itemsData } = await supabase.from("purchase_order_items").select("*").eq("purchase_order_id", orderId).order("item_num");
        setItems(itemsData || []);
        // Load latest approval (link)
        const { data: appr } = await supabase
          .from("purchase_order_approvals" as any)
          .select("*")
          .eq("purchase_order_id", orderId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (appr) {
          setApprovalLink(`${window.location.origin}/aprovar-oc/${(appr as any).token}`);
          setSignedApproval((appr as any).signed_at ? appr : null);
        } else {
          setApprovalLink("");
          setSignedApproval(null);
        }
        // Also load quotation context if present (for re-selecting supplier)
        if (o?.quotation_id) {
          const { data: q } = await supabase.from("purchase_quotations").select("*").eq("id", o.quotation_id).single();
          setQuotation(q);
          const { data: sups } = await supabase.from("purchase_quotation_suppliers").select("*").eq("quotation_id", o.quotation_id);
          const supList = sups || [];
          setSuppliers(supList);
          const winner = supList.find((s: any) => s.fornecedor_nome === q?.winner_supplier);
          setWinnerSupplierId(winner?.id || "");
          const matched = supList.find((s: any) => s.fornecedor_nome === o.fornecedor_nome);
          setSelectedSupplierId(matched?.id || winner?.id || "");
          const { data: pr } = await supabase.from("purchase_quotation_prices").select("*").eq("quotation_id", o.quotation_id);
          setPrices(pr || []);
          const { data: ri } = await supabase.from("purchase_requisition_items").select("*").eq("requisition_id", q?.requisition_id).order("item_num");
          setReqItems(ri || []);
        }
      } else if (quotationId) {
        // Pre-fill from quotation winner
        const { data: q } = await supabase.from("purchase_quotations").select("*").eq("id", quotationId).single();
        if (!q) return;
        setQuotation(q);
        setFacilityUnit(q.facility_unit);
        setReqId(q.requisition_id);
        if (q.requisition_id) {
          const { data: rq } = await supabase.from("purchase_requisitions").select("numero").eq("id", q.requisition_id).maybeSingle();
          setReqNumero(rq?.numero || "");
        }
        const auto = contractsList.find((c: any) => c.unit === q.facility_unit && c.status === "Vigente")
          || contractsList.find((c: any) => c.unit === q.facility_unit);
        if (auto) setContractId(auto.id);
        const { data: sups } = await supabase.from("purchase_quotation_suppliers").select("*").eq("quotation_id", quotationId);
        const supList = sups || [];
        setSuppliers(supList);
        const winner = supList.find((s: any) => s.fornecedor_nome === q.winner_supplier) || supList[0];
        setWinnerSupplierId(winner?.id || "");
        setSelectedSupplierId(winner?.id || "");
        const { data: pr } = await supabase.from("purchase_quotation_prices").select("*").eq("quotation_id", quotationId);
        setPrices(pr || []);
        const { data: ri } = await supabase.from("purchase_requisition_items").select("*").eq("requisition_id", q.requisition_id).order("item_num");
        setReqItems(ri || []);
      }
    };
    load();
  }, [open, orderId, quotationId]);

  // Recalculate supplier-derived fields whenever selection changes
  useEffect(() => {
    if (!selectedSupplierId || !suppliers.length || !reqItems.length) return;
    const sup = suppliers.find((s: any) => s.id === selectedSupplierId);
    if (!sup) return;
    setFornecedor(sup.fornecedor_nome || "");
    setFornecedorCnpj(sup.fornecedor_cnpj || "");
    setPrazo(sup.prazo_entrega || "");
    const orderItems = reqItems.map((ri: any, idx: number) => {
      const sp = prices.find((p: any) => p.requisition_item_id === ri.id && p.supplier_id === selectedSupplierId);
      const unit = sp ? Number(sp.valor_unitario) : 0;
      return {
        item_num: idx + 1,
        descricao: ri.descricao,
        quantidade: Number(ri.quantidade),
        unidade_medida: ri.unidade_medida,
        valor_unitario: unit,
        valor_total: unit * Number(ri.quantidade),
      };
    });
    setItems(orderItems);
  }, [selectedSupplierId, suppliers, reqItems, prices]);

  const supplierTotals = useMemo(() => {
    const map: Record<string, number> = {};
    suppliers.forEach((s: any) => {
      map[s.id] = prices
        .filter((p: any) => p.supplier_id === s.id)
        .reduce((sum: number, p: any) => {
          const ri = reqItems.find((r: any) => r.id === p.requisition_item_id);
          return sum + Number(p.valor_unitario || 0) * Number(ri?.quantidade || 0);
        }, 0);
    });
    return map;
  }, [suppliers, prices, reqItems]);

  const isOverridingWinner = !!winnerSupplierId && !!selectedSupplierId && selectedSupplierId !== winnerSupplierId;

  const valorTotal = useMemo(() => items.reduce((s, i) => s + Number(i.valor_total || 0), 0), [items]);

  const contract = contracts.find(c => c.id === contractId);
  const rubricas: any[] = (contract?.rubricas as any[]) || [];
  const selectedRubrica = rubricas.find(r => r.id === rubricaId);
  const rubricaBudget = selectedRubrica && contract ? Number(contract.value) * Number(selectedRubrica.percent) / 100 : 0;
  const rubricaSpent = orders
    .filter(o => o.contract_id === contractId && o.rubrica_id === rubricaId && o.id !== order?.id)
    .reduce((s, o) => s + Number(o.valor_total || 0), 0);
  const rubricaPct = rubricaBudget > 0 ? ((rubricaSpent + valorTotal) / rubricaBudget) * 100 : 0;
  const wouldExceed = rubricaBudget > 0 && (rubricaSpent + valorTotal) > rubricaBudget;

  const generateNumero = () => `OC/${Math.floor(Math.random() * 999).toString().padStart(3, "0")}/${new Date().getFullYear()}`;

  const updateItem = (idx: number, field: string, value: any) => {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const next = { ...it, [field]: value };
      if (field === "valor_unitario" || field === "quantidade") {
        next.valor_total = Number(next.valor_unitario) * Number(next.quantidade);
      }
      return next;
    }));
  };

  const generateApprovalLink = async () => {
    if (!profile) return;
    if (!order?.id) {
      toast.error("Salve a OC antes de gerar o link de aprovação");
      return;
    }
    setGeneratingLink(true);
    try {
      const { data, error } = await supabase
        .from("purchase_order_approvals" as any)
        .insert({ purchase_order_id: order.id, created_by: profile.id })
        .select()
        .single();
      if (error) throw error;
      const url = `${window.location.origin}/aprovar-oc/${(data as any).token}`;
      setApprovalLink(url);
      try { await navigator.clipboard.writeText(url); toast.success("Link de aprovação copiado!"); }
      catch { toast.success("Link gerado — copie manualmente"); }
    } catch (e: any) {
      toast.error("Erro ao gerar link: " + (e?.message || "desconhecido"));
    } finally {
      setGeneratingLink(false);
    }
  };

  const copyApprovalLink = async () => {
    if (!approvalLink) return;
    try { await navigator.clipboard.writeText(approvalLink); toast.success("Link copiado!"); }
    catch { toast.error("Não foi possível copiar"); }
  };

  const saveDraft = async () => {
    if (!profile) return;
    if (!fornecedor.trim()) { toast.error("Informe o fornecedor"); return; }
    if (isOverridingWinner && !justificativaTroca.trim()) {
      toast.error("Justifique a escolha de um fornecedor diferente do campeão");
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        quotation_id: quotationId || null,
        requisition_id: reqId,
        facility_unit: facilityUnit,
        contract_id: contractId || null,
        rubrica_id: rubricaId || null,
        rubrica_name: selectedRubrica?.name || null,
        fornecedor_nome: fornecedor,
        fornecedor_cnpj: fornecedorCnpj || null,
        endereco_entrega: endereco || null,
        prazo_entrega: prazo || null,
        valor_total: valorTotal,
        observacoes: isOverridingWinner
          ? `${observacoes ? observacoes + "\n\n" : ""}Justificativa de troca de fornecedor: ${justificativaTroca}`
          : (observacoes || null),
        responsavel_emissao_nome: profile.name,
        cargo: profile.cargo || null,
      };
      let oid = order?.id;
      if (oid) {
        await supabase.from("purchase_orders").update(payload).eq("id", oid);
        await supabase.from("purchase_order_items").delete().eq("purchase_order_id", oid);
      } else {
        const { data, error } = await supabase.from("purchase_orders").insert({
          ...payload, numero: generateNumero(), status: "aguardando_aprovacao", created_by: profile.id,
        }).select().single();
        if (error) throw error;
        oid = data.id;
      }
      const itemRows = items.map((it, idx) => ({
        purchase_order_id: oid, item_num: idx + 1,
        descricao: it.descricao, quantidade: it.quantidade,
        unidade_medida: it.unidade_medida, valor_unitario: it.valor_unitario,
        valor_total: it.valor_total,
      }));
      if (itemRows.length) await supabase.from("purchase_order_items").insert(itemRows);
      await supabase.from("purchase_audit_log").insert({
        entity_type: "purchase_order", entity_id: oid,
        action: order ? "updated" : "created",
        motivo: isOverridingWinner ? `Fornecedor não-campeão: ${justificativaTroca}` : null,
        changed_by: profile.id, changed_by_name: profile.name,
      });
      toast.success("Ordem de compra salva");
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally { setSaving(false); }
  };

  const generatePdf = () => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const numero = order?.numero || "Sem número";
    const now = new Date();
    const dataEmissao = now.toLocaleDateString("pt-BR");
    const horaEmissao = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

    // Brand palette
    const brandTeal: [number, number, number] = [22, 78, 99];
    const brandAccent: [number, number, number] = [13, 148, 136];
    const ink: [number, number, number] = [30, 41, 59];
    const muted: [number, number, number] = [100, 116, 139];
    const lineColor: [number, number, number] = [226, 232, 240];

    // ===== Header band =====
    doc.setFillColor(...brandTeal);
    doc.rect(0, 0, pageW, 32, "F");
    doc.setFillColor(...brandAccent);
    doc.rect(0, 32, pageW, 1.5, "F");

    // Logo Instituto Univida (proporção real 300x164 ≈ 1.83:1)
    try {
      const logoH = 18;
      const logoW = logoH * (300 / 164); // ≈ 32.9mm
      const logoY = (32 - logoH) / 2;    // centraliza verticalmente na faixa de 32mm
      doc.addImage(UNIVIDA_LOGO_BASE64, "PNG", 12, logoY, logoW, logoH);
    } catch { /* ignore if logo invalid */ }

    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("ORDEM DE COMPRA", 50, 15);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Instituto Univida — Gestão Hospitalar", 50, 21);

    // Right-side meta box
    const metaX = pageW - 78;
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.2);
    doc.roundedRect(metaX, 6, 70, 22, 2, 2, "S");
    doc.setFontSize(8);
    doc.text("Nº OC", metaX + 3, 11);
    doc.text("Nº Requisição", metaX + 3, 17);
    doc.text("Emitido em", metaX + 3, 23);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(numero, metaX + 28, 11);
    doc.text(reqNumero || "—", metaX + 28, 17);
    doc.text(`${dataEmissao} • ${horaEmissao}`, metaX + 28, 23);
    doc.setFont("helvetica", "normal");

    // ===== Body — Info cards =====
    let y = 42;
    doc.setTextColor(...ink);

    const infoBox = (x: number, w: number, label: string, value: string) => {
      doc.setDrawColor(...lineColor);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x, y, w, 16, 1.5, 1.5, "FD");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...muted);
      doc.text(label.toUpperCase(), x + 3, y + 5);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...ink);
      const lines = doc.splitTextToSize(value || "—", w - 6);
      doc.text(lines.slice(0, 1), x + 3, y + 12);
    };

    const colW = (pageW - 24 - 8) / 3;
    infoBox(12, colW, "Unidade", facilityUnit || "—");
    infoBox(12 + colW + 4, colW, "Contrato", contract?.name || "—");
    infoBox(12 + (colW + 4) * 2, colW, "Rubrica", selectedRubrica?.name || "—");
    y += 20;

    infoBox(12, colW, "Fornecedor", fornecedor || "—");
    infoBox(12 + colW + 4, colW, "CNPJ", fornecedorCnpj || "—");
    infoBox(12 + (colW + 4) * 2, colW, "Prazo de entrega", prazo || "—");
    y += 20;

    // Endereço (full width)
    doc.setDrawColor(...lineColor);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(12, y, pageW - 24, 16, 1.5, 1.5, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...muted);
    doc.text("ENDEREÇO DE ENTREGA", 15, y + 5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...ink);
    doc.text(doc.splitTextToSize(endereco || "—", pageW - 30).slice(0, 1), 15, y + 12);
    y += 22;

    // Rubrica budget panel (when rubric is selected)
    if (selectedRubrica && rubricaBudget > 0) {
      const after = rubricaSpent + valorTotal;
      const remaining = rubricaBudget - after;
      const pct = (after / rubricaBudget) * 100;
      const exceeds = after > rubricaBudget;
      const panelH = 22;
      doc.setDrawColor(...lineColor);
      doc.setFillColor(exceeds ? 254 : 248, exceeds ? 242 : 250, exceeds ? 242 : 252);
      doc.roundedRect(12, y, pageW - 24, panelH, 1.5, 1.5, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...brandTeal);
      doc.text(`RUBRICA — ${(selectedRubrica.name || "").toUpperCase()} (${selectedRubrica.percent}%)`, 15, y + 5);

      const cellW = (pageW - 24) / 4;
      const drawCell = (i: number, label: string, val: string, highlight?: boolean) => {
        const cx = 12 + i * cellW + 3;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(...muted);
        doc.text(label.toUpperCase(), cx, y + 11);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        if (highlight) doc.setTextColor(exceeds ? 185 : 22, exceeds ? 28 : 78, exceeds ? 28 : 99);
        else doc.setTextColor(...ink);
        doc.text(val, cx, y + 17);
      };
      drawCell(0, "Orçamento", fmtBRL(rubricaBudget));
      drawCell(1, "Já gasto", fmtBRL(rubricaSpent));
      drawCell(2, "Esta OC", fmtBRL(valorTotal));
      drawCell(3, `Saldo (${pct.toFixed(1)}%)`, fmtBRL(remaining), true);
      y += panelH + 4;
    }

    // ===== Items table =====
    autoTable(doc, {
      startY: y,
      margin: { left: 12, right: 12 },
      head: [["#", "Descrição", "Qtd", "Un.", "Valor unit.", "Total"]],
      body: items.map((it, idx) => [
        String(idx + 1),
        it.descricao,
        String(it.quantidade),
        it.unidade_medida,
        fmtBRL(Number(it.valor_unitario)),
        fmtBRL(Number(it.valor_total)),
      ]),
      foot: [[
        { content: "TOTAL GERAL", colSpan: 5, styles: { halign: "right", fontStyle: "bold", fillColor: [241, 245, 249], textColor: ink } },
        { content: fmtBRL(valorTotal), styles: { halign: "right", fontStyle: "bold", fillColor: [241, 245, 249], textColor: brandTeal } },
      ]],
      styles: { fontSize: 9, cellPadding: 2.5, lineColor, lineWidth: 0.1, textColor: ink },
      headStyles: { fillColor: brandTeal, textColor: [255, 255, 255], fontStyle: "bold", halign: "left" },
      columnStyles: {
        0: { halign: "center", cellWidth: 10 },
        2: { halign: "right", cellWidth: 16 },
        3: { halign: "center", cellWidth: 14 },
        4: { halign: "right", cellWidth: 28 },
        5: { halign: "right", cellWidth: 30 },
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    y = (doc as any).lastAutoTable.finalY + 8;

    // Observações / Justificativa
    const noteBox = (label: string, text: string) => {
      const lines = doc.splitTextToSize(text, pageW - 30);
      const h = 8 + lines.length * 4.5;
      if (y + h > pageH - 70) { doc.addPage(); y = 20; }
      doc.setDrawColor(...lineColor);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(12, y, pageW - 24, h, 1.5, 1.5, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...brandTeal);
      doc.text(label.toUpperCase(), 15, y + 5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...ink);
      doc.text(lines, 15, y + 10);
      y += h + 4;
    };
    if (observacoes) noteBox("Observações", observacoes);
    if (isOverridingWinner && justificativaTroca) noteBox("Justificativa — fornecedor diferente do campeão", justificativaTroca);

    // ===== Signature blocks =====
    if (y > pageH - 70) { doc.addPage(); y = 20; }
    y = Math.max(y, pageH - 70);

    const sigW = (pageW - 24 - 12) / 2;
    const drawSignature = (x: number, label: string, name: string, sub: string, dateText: string) => {
      doc.setDrawColor(...lineColor);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(x, y, sigW, 50, 1.5, 1.5, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...brandTeal);
      doc.text(label.toUpperCase(), x + 4, y + 6);
      // Signature line
      doc.setDrawColor(...muted);
      doc.setLineWidth(0.3);
      doc.line(x + 6, y + 30, x + sigW - 6, y + 30);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...ink);
      doc.text(name || "—", x + sigW / 2, y + 36, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...muted);
      if (sub) doc.text(sub, x + sigW / 2, y + 41, { align: "center" });
      if (dateText) doc.text(dateText, x + sigW / 2, y + 46, { align: "center" });
    };

    drawSignature(
      12,
      "Emitido por",
      profile?.name || "—",
      profile?.cargo || "Responsável pela emissão",
      `Data: ${dataEmissao} ${horaEmissao}`,
    );

    const aprovadoEm = order?.aprovado_em ? new Date(order.aprovado_em) : null;
    const aprovadoData = aprovadoEm ? `${aprovadoEm.toLocaleDateString("pt-BR")} ${aprovadoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "";
    const isAuthorized = order?.status === "autorizada" || order?.status === "enviada" || order?.status === "recebida";
    // If signed via public link, prefer that data
    const signedAt = signedApproval?.signed_at ? new Date(signedApproval.signed_at) : null;
    const signedData = signedAt
      ? `${signedAt.toLocaleDateString("pt-BR")} ${signedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
      : "";
    const approverName = signedApproval?.approver_name || (isAuthorized ? (order?.aprovado_por_nome || "") : "");
    const approverCargo = signedApproval?.approver_cargo || "Gestor / Diretoria";
    const approverIp = signedApproval?.approver_ip ? ` • IP ${signedApproval.approver_ip}` : "";
    const dateLine = signedData
      ? `Assinado em ${signedData}${approverIp}`
      : (aprovadoData ? `Data: ${aprovadoData}` : "Data: ___/___/______");
    drawSignature(
      12 + sigW + 12,
      signedApproval ? "Assinado digitalmente" : (isAuthorized ? "Autorizado por" : "Autorização (a preencher)"),
      approverName,
      approverCargo,
      dateLine,
    );

    // ===== Footer =====
    doc.setDrawColor(...lineColor);
    doc.line(12, pageH - 14, pageW - 12, pageH - 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...muted);
    doc.text(`Documento gerado eletronicamente • ${dataEmissao} ${horaEmissao}`, 12, pageH - 9);
    doc.text(`OC ${numero}${reqNumero ? "  •  Req. " + reqNumero : ""}`, pageW - 12, pageH - 9, { align: "right" });

    doc.save(`OC_${numero.replace(/[\/\s]/g, "_")}.pdf`);
  };

  const authorize = async () => {
    if (!order || !profile) return;
    if (wouldExceed && !isAdmin) { toast.error("Saldo insuficiente na rubrica selecionada"); return; }
    setSaving(true);
    try {
      await supabase.from("purchase_orders").update({
        status: "autorizada", aprovado_por: profile.id, aprovado_em: new Date().toISOString(),
      }).eq("id", order.id);
      // Register rubric execution
      if (contractId && selectedRubrica) {
        await supabase.from("rubrica_entries").insert({
          contract_id: contractId,
          rubrica_name: selectedRubrica.name,
          facility_unit: facilityUnit,
          period: new Date().toLocaleDateString("pt-BR"),
          value_executed: valorTotal,
          notes: `OC ${order.numero}`,
          user_id: profile.id,
        });
      }
      await supabase.from("purchase_audit_log").insert({
        entity_type: "purchase_order", entity_id: order.id,
        action: "authorized",
        changed_by: profile.id, changed_by_name: profile.name,
      });
      toast.success("Ordem autorizada");
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Erro ao autorizar");
    } finally { setSaving(false); }
  };

  const deny = async () => {
    if (!order || !profile) return;
    if (!motivoNegacao.trim()) { toast.error("Informe o motivo da negação"); return; }
    setSaving(true);
    try {
      await supabase.from("purchase_orders").update({
        status: "negada", motivo_negacao: motivoNegacao,
        aprovado_por: profile.id, aprovado_em: new Date().toISOString(),
      }).eq("id", order.id);
      await supabase.from("purchase_audit_log").insert({
        entity_type: "purchase_order", entity_id: order.id,
        action: "denied", motivo: motivoNegacao,
        changed_by: profile.id, changed_by_name: profile.name,
      });
      toast.success("Ordem negada");
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Erro ao negar");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{order ? `Ordem de compra ${order.numero}` : "Nova ordem de compra"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          {order && <Badge variant="outline">Status: {order.status}</Badge>}

          <div>
            <Label>Rubrica {contract ? `— ${contract.name}` : ""}</Label>
            <Select value={rubricaId} onValueChange={setRubricaId} disabled={!contractId}>
              <SelectTrigger><SelectValue placeholder={contractId ? "Selecione a rubrica" : "Nenhum contrato vigente para esta unidade"} /></SelectTrigger>
              <SelectContent>
                {[...rubricas].sort((a: any, b: any) => a.name.localeCompare(b.name)).map((r: any) =>
                  <SelectItem key={r.id} value={r.id}>{r.name} ({r.percent}%)</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {selectedRubrica && (
            <div className={`p-3 rounded-md text-sm ${wouldExceed ? "bg-red-50 dark:bg-red-950/40" : "bg-muted"}`}>
              Rubrica <strong>{selectedRubrica.name}</strong>: {fmtBRL(rubricaSpent)} já gasto + {fmtBRL(valorTotal)} desta OC
              {" / "} <strong>{fmtBRL(rubricaBudget)}</strong> orçado ({rubricaPct.toFixed(1)}%)
              {wouldExceed && <div className="text-destructive mt-1 font-medium">Atenção: ultrapassa o saldo da rubrica</div>}
            </div>
          )}

          {suppliers.length > 0 && (
            <div className="border rounded-md p-3 space-y-3 bg-muted/40">
              <div className="flex items-center justify-between">
                <Label className="text-base">Fornecedor da cotação</Label>
                {winnerSupplierId && (
                  <Badge variant="secondary" className="text-xs">
                    Campeão: {suppliers.find(s => s.id === winnerSupplierId)?.fornecedor_nome || "-"}
                  </Badge>
                )}
              </div>
              <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                <SelectTrigger><SelectValue placeholder="Selecione o fornecedor" /></SelectTrigger>
                <SelectContent>
                  {[...suppliers]
                    .sort((a, b) => (supplierTotals[a.id] || 0) - (supplierTotals[b.id] || 0))
                    .map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.fornecedor_nome} — {fmtBRL(supplierTotals[s.id] || 0)}
                        {s.id === winnerSupplierId ? " (campeão)" : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {isOverridingWinner && (
                <div className="space-y-2">
                  <Label className="text-destructive">Justificativa para escolher fornecedor diferente do campeão *</Label>
                  <Textarea
                    value={justificativaTroca}
                    onChange={e => setJustificativaTroca(e.target.value)}
                    placeholder="Ex: prazo de entrega mais curto, qualidade do produto, restrição técnica..."
                    rows={3}
                  />
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label>Fornecedor</Label><Input value={fornecedor} onChange={e => setFornecedor(e.target.value)} /></div>
            <div><Label>CNPJ</Label><Input value={fornecedorCnpj} onChange={e => setFornecedorCnpj(e.target.value)} /></div>
            <div className="md:col-span-2"><Label>Endereço de entrega</Label><Input value={endereco} onChange={e => setEndereco(e.target.value)} /></div>
            <div><Label>Prazo de entrega</Label><Input value={prazo} onChange={e => setPrazo(e.target.value)} /></div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-20">Qtd</TableHead>
                <TableHead className="w-20">Un</TableHead>
                <TableHead className="w-32 text-right">Valor unt.</TableHead>
                <TableHead className="w-32 text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it, idx) => (
                <TableRow key={idx}>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell className="text-xs">{it.descricao}</TableCell>
                  <TableCell><Input type="number" value={it.quantidade} onChange={e => updateItem(idx, "quantidade", Number(e.target.value))} /></TableCell>
                  <TableCell>{it.unidade_medida}</TableCell>
                  <TableCell><Input type="number" step="0.01" className="text-right" value={it.valor_unitario} onChange={e => updateItem(idx, "valor_unitario", Number(e.target.value))} /></TableCell>
                  <TableCell className="text-right">{fmtBRL(it.valor_total)}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={5} className="text-right font-medium">Total geral</TableCell>
                <TableCell className="text-right font-semibold">{fmtBRL(valorTotal)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>

          <Textarea placeholder="Observações" value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} />

          {order?.status === "aguardando_aprovacao" && canApprove && (
            <div className="border rounded-md p-3 space-y-2 bg-muted/40">
              <Label>Motivo (em caso de negação)</Label>
              <Textarea value={motivoNegacao} onChange={e => setMotivoNegacao(e.target.value)} rows={2} />
              <div className="flex gap-2">
                <Button className="rounded-full" disabled={saving} onClick={authorize}>Autorizar</Button>
                <Button variant="destructive" className="rounded-full" disabled={saving} onClick={deny}>Negar</Button>
              </div>
            </div>
          )}

          {order?.id && (
            <div className="border rounded-md p-3 space-y-2 bg-muted/30">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Label className="m-0">Aprovação por link (opcional)</Label>
                {signedApproval ? (
                  <Badge variant="default">Assinado por {signedApproval.approver_name}</Badge>
                ) : approvalLink ? (
                  <Badge variant="outline">Aguardando assinatura</Badge>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                Gere um link único para enviar ao aprovador. Ele assina online (nome, cargo, ciência) e o sistema captura IP, data e hora. Você também pode simplesmente baixar o PDF e enviar por outro meio.
              </p>
              {approvalLink ? (
                <div className="flex gap-2 flex-wrap">
                  <Input value={approvalLink} readOnly className="text-xs" />
                  <Button type="button" variant="outline" className="rounded-full" onClick={copyApprovalLink}>Copiar link</Button>
                  {!signedApproval && (
                    <Button type="button" variant="ghost" className="rounded-full" onClick={generateApprovalLink} disabled={generatingLink}>
                      Gerar novo link
                    </Button>
                  )}
                </div>
              ) : (
                <Button type="button" className="rounded-full" onClick={generateApprovalLink} disabled={generatingLink}>
                  {generatingLink ? "Gerando..." : "Gerar link de aprovação"}
                </Button>
              )}
              {signedApproval && (
                <div className="text-xs text-muted-foreground space-y-0.5 pt-1">
                  <div>Decisão: <strong>{signedApproval.decision}</strong></div>
                  <div>Cargo: {signedApproval.approver_cargo || "—"}</div>
                  <div>IP: {signedApproval.approver_ip || "—"}</div>
                  <div>Data/hora: {new Date(signedApproval.signed_at).toLocaleString("pt-BR")}</div>
                  {signedApproval.motivo_recusa && <div>Motivo: {signedApproval.motivo_recusa}</div>}
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button variant="secondary" className="rounded-full" onClick={generatePdf} disabled={!items.length}>
            Gerar PDF
          </Button>
          <Button className="rounded-full" disabled={saving} onClick={saveDraft}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}