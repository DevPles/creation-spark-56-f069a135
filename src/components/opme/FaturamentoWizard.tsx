import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, ChevronDown, ChevronUp, AlertCircle, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useContracts } from "@/contexts/ContractsContext";
import { supabase } from "@/integrations/supabase/client";
import { sumOpme, formatBRL } from "@/lib/opmeValue";

interface FaturamentoWizardProps {
  step: number;
  form: any;
  updateForm: (field: string, value: any) => void;
  user: any;
  onGeneratePdf?: () => void;
}

const ReadOnlyField = ({ label, value, placeholder = "Pendente" }: { label: string; value: any; placeholder?: string }) => {
  const filled = value !== null && value !== undefined && value !== "";
  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold uppercase text-slate-500">{label}</Label>
      <div className={`min-h-12 flex items-center px-3 py-2 rounded-md border text-sm font-medium ${filled ? "bg-slate-50 border-slate-200 text-slate-700" : "bg-rose-50 border-rose-200 text-rose-600"}`}>
        {filled ? String(value) : `${placeholder} — preencher etapa anterior`}
      </div>
    </div>
  );
};

const Accordion = ({ title, defaultOpen = false, children, status }: { title: string; defaultOpen?: boolean; children: React.ReactNode; status?: "ok" | "warn" | "pending" | null }) => {
  const [open, setOpen] = useState(defaultOpen);
  const statusColor =
    status === "ok" ? "border-emerald-200 bg-emerald-50/30" :
    status === "warn" ? "border-amber-200 bg-amber-50/30" :
    status === "pending" ? "border-rose-200 bg-rose-50/30" :
    "border-slate-200 bg-white";
  return (
    <div className={`rounded-xl border ${statusColor} overflow-hidden transition-colors`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          {status === "ok" && <CheckCircle2 size={16} className="text-emerald-600" />}
          {status === "warn" && <AlertCircle size={16} className="text-amber-600" />}
          {status === "pending" && <AlertCircle size={16} className="text-rose-600" />}
          <span className="text-xs font-bold uppercase tracking-wide text-slate-700">{title}</span>
        </div>
        {open ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
      </button>
      {open && <div className="px-4 pb-4 pt-2 border-t border-slate-100 space-y-3">{children}</div>}
    </div>
  );
};

 export default function FaturamentoWizard({ step, form, updateForm, user, onGeneratePdf }: FaturamentoWizardProps) {
  const { contracts } = useContracts();
  const unitContract = contracts.find(c => c.unit === form.facility_unit);
  const autoCnes = unitContract?.cnes || "";

  // Threshold dinâmico (média + 1σ) do valor de OPME nos últimos casos
  const [opmeThreshold, setOpmeThreshold] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("opme_requests")
        .select("opme_used, opme_requested")
        .eq("facility_unit", form.facility_unit)
        .eq("status", "concluido")
        .limit(200);
      if (!active || !data) return;
      const totals = data
        .map((r: any) => sumOpme(Array.isArray(r.opme_used) && r.opme_used.length ? r.opme_used : r.opme_requested))
        .filter((v: number) => v > 0);
      if (totals.length < 3) { setOpmeThreshold(null); return; }
      const mean = totals.reduce((a, b) => a + b, 0) / totals.length;
      const variance = totals.reduce((a, b) => a + (b - mean) ** 2, 0) / totals.length;
      setOpmeThreshold(mean + Math.sqrt(variance));
    })();
    return () => { active = false; };
  }, [form.facility_unit]);

  // Auto-fill CNES from the unit's contract if missing
  useEffect(() => {
    if (autoCnes && !form.billing_cnes) {
      updateForm("billing_cnes", autoCnes);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCnes]);

  // Auto-fill Caráter de Atendimento from procedure_type (Procedimento)
  useEffect(() => {
    if (form.procedure_type && form.billing_attendance_character !== form.procedure_type) {
      updateForm("billing_attendance_character", form.procedure_type);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.procedure_type]);

  // ====== CÁLCULO AUTOMÁTICO DO RISCO DE GLOSA ======
  // Score completo: checklist + justificativas + valor (qtd itens) + tempo de internação
  const computeGlosaScore = () => {
    const reasons: string[] = [];
    let score = 0; // 0 = baixo, quanto maior pior

    // 1) Checklist de documentação (peso alto)
    const docs = form.billing_docs || {};
    const requiredDocs = ["nf", "rastreabilidade", "laudo", "consumo", "exames", "aih_anexa", "termo_consentimento"];
    const missingDocs = requiredDocs.filter(d => !docs[d]);
    if (missingDocs.length >= 3) { score += 3; reasons.push(`${missingDocs.length} documentos obrigatórios faltando`); }
    else if (missingDocs.length > 0) { score += 1; reasons.push(`${missingDocs.length} documento(s) faltando`); }

    // 2) Justificativa do cirurgião exigida pelo auditor (sinal forte de glosa)
    if (form.auditor_post_justification_requested || Number(form.justification_round || 0) > 0) {
      score += 2;
      reasons.push("Caso passou por reanálise/justificativa do cirurgião");
    }

    // 3) Divergência OPME utilizado x faturado
    if (form.billing_opme_compatibility === "nao") {
      score += 3;
      reasons.push("Divergência crítica entre OPME utilizado e faturado");
    } else if (form.billing_opme_compatibility === "parcial") {
      score += 1;
      reasons.push("Divergência parcial OPME utilizado x faturado");
    }

    // 4) Auditoria pós sem aprovação clara
    const auditOk = form.auditor_post_final_opinion === "aprovado" || form.auditor_post_final_opinion === "liberado";
    if (!auditOk && form.auditor_post_final_opinion) {
      score += 2;
      reasons.push("Auditoria pós sem parecer favorável");
    }

    // 5) Rastreabilidade incompleta nos itens utilizados
    const used = Array.isArray(form.opme_used) ? form.opme_used : [];
    const launched = used.filter((u: any) => u?.launched);
    const semRastreio = launched.filter((u: any) => !u?.batch || !u?.photo_url);
    if (launched.length > 0 && semRastreio.length > 0) {
      score += semRastreio.length >= launched.length ? 2 : 1;
      reasons.push(`${semRastreio.length}/${launched.length} item(ns) sem lote/etiqueta`);
    }

    // 6) Valor da OPME — agora REAL (catálogo / banco de preços)
    const opmeTotal = sumOpme(launched.length ? launched : (Array.isArray(form.opme_requested) ? form.opme_requested : []));
    if (opmeThreshold && opmeTotal > 0) {
      if (opmeTotal > opmeThreshold * 1.5) { score += 2; reasons.push(`Valor de OPME muito acima da média da unidade (${formatBRL(opmeTotal)})`); }
      else if (opmeTotal > opmeThreshold) { score += 1; reasons.push(`Valor de OPME acima da média + 1σ (${formatBRL(opmeTotal)})`); }
    } else if (launched.length >= 5) {
      score += 1; reasons.push(`Alto volume de itens (${launched.length})`);
    }

    // 7) Tempo de internação acima da média (>15 dias = alta exposição)
    if (form.billing_admission_date && form.billing_discharge_date) {
      const a = new Date(form.billing_admission_date);
      const b = new Date(form.billing_discharge_date);
      const dias = Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
      if (dias > 30) { score += 2; reasons.push(`Internação prolongada (${dias} dias)`); }
      else if (dias > 15) { score += 1; reasons.push(`Internação acima da média (${dias} dias)`); }
    }

    // 8) Autorização prévia ausente
    if (form.billing_prior_authorization === "nao") {
      score += 2;
      reasons.push("Sem autorização prévia");
    }

    // 9) AIH ou CID ausentes
    if (!form.billing_aih_number) { score += 2; reasons.push("AIH não informada"); }
    if (!form.billing_cid_main) { score += 1; reasons.push("CID Principal ausente"); }

    let level: "baixo" | "medio" | "alto" = "baixo";
    if (score >= 5) level = "alto";
    else if (score >= 2) level = "medio";

    return { level, score, reasons };
  };

  const glosaAuto = computeGlosaScore();

  // Persistir nível calculado automaticamente
  useEffect(() => {
    if (form.billing_glosa_risk !== glosaAuto.level) {
      updateForm("billing_glosa_risk", glosaAuto.level);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [glosaAuto.level]);

  // ====== TELA 1 — RESUMO DO CASO ======
  if (step === 1) {
    const cadastroOk = !!(form.patient_name && form.patient_record && form.facility_unit);
    const procedimentoOk = !!(form.procedure_name && form.procedure_sigtap_code && form.procedure_date);
    const aihOk = !!(form.billing_aih_number && form.billing_aih_file_url);
    // Risco de glosa (calculado automaticamente) e valor financeiro em risco
    const usedNow = Array.isArray(form.opme_used) ? form.opme_used.filter((u: any) => u?.launched) : [];
    const baseTotal = sumOpme(usedNow.length ? usedNow : (Array.isArray(form.opme_requested) ? form.opme_requested : []));
    const glosaPct = glosaAuto.level === "alto" ? 0.6 : glosaAuto.level === "medio" ? 0.25 : 0.05;
    const glosaValue = baseTotal * glosaPct;
    const riskColor =
      glosaAuto.level === "alto" ? "bg-rose-50 border-rose-200 text-rose-700" :
      glosaAuto.level === "medio" ? "bg-amber-50 border-amber-200 text-amber-700" :
      "bg-emerald-50 border-emerald-200 text-emerald-700";
    return (
      <div className="space-y-3">
        {/* Risco e Valor de Glosa — destaque no topo do Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className={`rounded-xl border p-3 ${riskColor}`}>
            <div className="text-[9px] font-bold uppercase tracking-wider opacity-70">Risco de Glosa</div>
            <div className="text-lg font-black uppercase mt-1">{glosaAuto.level === "baixo" ? "Baixo" : glosaAuto.level === "medio" ? "Médio" : "Alto"}</div>
            <div className="text-[10px] font-medium opacity-70 mt-0.5">Score automático: {glosaAuto.score}</div>
          </div>
          <div className={`rounded-xl border p-3 ${riskColor}`}>
            <div className="text-[9px] font-bold uppercase tracking-wider opacity-70">Valor estimado em risco</div>
            <div className="text-lg font-black mt-1">{formatBRL(glosaValue)}</div>
            <div className="text-[10px] font-medium opacity-70 mt-0.5">{(glosaPct * 100).toFixed(0)}% sobre {formatBRL(baseTotal)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Principais fatores</div>
            {glosaAuto.reasons.length === 0 ? (
              <div className="text-[11px] text-emerald-700 font-medium mt-1">Nenhum fator de risco identificado.</div>
            ) : (
              <ul className="text-[10px] text-slate-600 mt-1 space-y-0.5 list-disc list-inside">
                {glosaAuto.reasons.slice(0, 3).map((r, i) => (<li key={i} className="truncate">{r}</li>))}
                {glosaAuto.reasons.length > 3 && (<li className="text-slate-400 italic">+{glosaAuto.reasons.length - 3} outro(s)…</li>)}
              </ul>
            )}
          </div>
        </div>

        <Accordion title="Identificação do Paciente" defaultOpen status={cadastroOk ? "ok" : "pending"}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ReadOnlyField label="Unidade de Saúde" value={form.facility_unit} />
            <ReadOnlyField label="Nome Completo" value={form.patient_name} />
            <ReadOnlyField label="Data de Nascimento" value={form.patient_birthdate} />
            <ReadOnlyField label="Prontuário" value={form.patient_record} />
            <ReadOnlyField label="Nome da Mãe" value={form.patient_mother_name} />
            <ReadOnlyField label="Cartão SUS (CNS)" value={form.patient_sus} />
          </div>
        </Accordion>

        <Accordion title="AIH — Autorização de Internação" defaultOpen status={aihOk ? "ok" : "pending"}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ReadOnlyField label="Número da AIH" value={form.billing_aih_number} />
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-slate-500">AIH Anexada</Label>
              {form.billing_aih_file_url ? (
                <Button
                  variant="outline"
                  className="w-full h-12 text-xs font-bold uppercase border-emerald-100 bg-emerald-50 text-emerald-700 flex gap-2"
                  onClick={() => window.open(form.billing_aih_file_url, "_blank")}
                >
                  <FileText size={16} /> Ver AIH
                </Button>
              ) : (
                <div className="h-12 flex items-center justify-center border rounded-md border-rose-200 bg-rose-50 text-rose-600 text-xs font-medium uppercase">
                  Nenhuma AIH anexada
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
            <ReadOnlyField label="Data Internação" value={form.billing_admission_date} placeholder="Pendente — preencher no Cadastro" />
            <ReadOnlyField label="Data Alta" value={form.billing_discharge_date} placeholder="Pendente — preencher no Cadastro" />
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-slate-500">Tipo de AIH (Faturista)</Label>
              <Select value={form.billing_aih_type || ""} onValueChange={v => updateForm("billing_aih_type", v)}>
                <SelectTrigger className="h-12 bg-white"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="inicial">Inicial</SelectItem>
                  <SelectItem value="continuidade">Continuidade</SelectItem>
                  <SelectItem value="longa_permanencia">Longa Permanência</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Accordion>

        <Accordion title="Procedimento e Equipe" defaultOpen status={procedimentoOk ? "ok" : "pending"}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ReadOnlyField label="Tipo de Procedimento" value={form.procedure_type} />
            <ReadOnlyField label="Data do Procedimento" value={form.procedure_date} />
            <div className="md:col-span-2">
              <ReadOnlyField label="Nome do Procedimento (SIGTAP)" value={form.procedure_name} />
            </div>
            <ReadOnlyField label="Cód. SIGTAP" value={form.procedure_sigtap_code} />
            <ReadOnlyField label="Cirurgião Responsável" value={form.responsible_name ? `${form.responsible_name}${form.responsible_register ? ' — ' + form.responsible_register : ''}` : ""} />
          </div>
        </Accordion>

        <Accordion title="CID e CNES" status={form.billing_cid_main && form.billing_cnes ? "ok" : "pending"}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <ReadOnlyField label="CID Principal" value={form.billing_cid_main} placeholder="Pendente — preencher na Requisição" />
            <ReadOnlyField label="CID Secundário" value={form.billing_cid_secondary} placeholder="Opcional — Requisição" />
            {autoCnes ? (
              <ReadOnlyField label="CNES da Unidade" value={form.billing_cnes || autoCnes} placeholder="Cadastre em Contratos" />
            ) : (
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase text-slate-500">CNES da Unidade</Label>
                <Input value={form.billing_cnes || ""} onChange={e => updateForm("billing_cnes", e.target.value)} placeholder="Cadastre em Contratos" className="h-12 bg-white" />
              </div>
            )}
          </div>
          <p className="text-[10px] text-slate-400 italic mt-1">CID definido pelo médico na Requisição (Parte 2). Para alterar, retorne àquela etapa.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
            <ReadOnlyField
              label="Caráter de Atendimento"
              value={form.billing_attendance_character || form.procedure_type}
              placeholder="Pendente — definir Tipo no Procedimento"
            />
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-slate-500">Motivo da Saída</Label>
              <Select value={form.billing_exit_reason || ""} onValueChange={v => updateForm("billing_exit_reason", v)}>
                <SelectTrigger className="h-12 bg-white"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="alta_curado">Alta Curado</SelectItem>
                  <SelectItem value="alta_melhorado">Alta Melhorado</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                  <SelectItem value="obito">Óbito</SelectItem>
                  <SelectItem value="permanencia">Permanência</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Accordion>
      </div>
    );
  }

  // ====== TELA 2 — OPME E RASTREABILIDADE ======
  if (step === 2) {
    const requested = Array.isArray(form.opme_requested) ? form.opme_requested : [];
    const used = Array.isArray(form.opme_used) ? form.opme_used : [];
    const returned = Array.isArray(form.opme_returned) ? form.opme_returned : [];
    const launchedUsed = used.filter((u: any) => u?.launched);
    const hasTracking = launchedUsed.length > 0 && launchedUsed.every((u: any) => u?.batch && u?.photo_url);
    return (
      <div className="space-y-3">
        <div className="bg-sky-50 border border-sky-100 rounded-lg p-3 text-[10px] font-medium uppercase tracking-wide text-sky-700">
          Tela 2 de 5 — Confronto entre Solicitado, Utilizado, Devolvido e Rastreabilidade.
        </div>

        <Accordion title={`Solicitado pelo Cirurgião (${requested.length})`} defaultOpen status={requested.length ? "ok" : "warn"}>
          {requested.length === 0 ? (
            <p className="text-xs text-slate-500 italic">Nenhum material solicitado na Requisição.</p>
          ) : (
            <div className="space-y-2">
              {requested.map((m: any, i: number) => (
                <div key={i} className="bg-white border border-slate-200 rounded-md p-3 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-800 truncate">{m.description || "—"}</div>
                      <div className="text-slate-500 mt-1">Qtd: {m.quantity || 0} • SIGTAP: {m.sigtap || "—"} • Modelo: {m.size_model || "—"}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[10px] text-slate-400 uppercase font-bold">unit. {formatBRL(Number(m.unit_price) || 0)}</div>
                      <div className="text-sm font-black text-emerald-700">{formatBRL((Number(m.quantity) || 0) * (Number(m.unit_price) || 0))}</div>
                    </div>
                  </div>
                </div>
              ))}
              <div className="bg-primary/5 border border-primary/20 rounded-md px-3 py-2 flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-500">Total estimado solicitado</span>
                <span className="text-sm font-black text-primary">{formatBRL(sumOpme(requested))}</span>
              </div>
            </div>
          )}
        </Accordion>

        <Accordion title={`Utilizado em Cirurgia (${launchedUsed.length})`} defaultOpen status={launchedUsed.length ? "ok" : "pending"}>
          {launchedUsed.length === 0 ? (
            <p className="text-xs text-rose-600 italic">Nenhum material registrado no Consumo Cirúrgico.</p>
          ) : (
            <div className="space-y-2">
              {launchedUsed.map((m: any, i: number) => (
                <div key={i} className="bg-white border border-slate-200 rounded-md p-3 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-800 truncate">{m.description || "—"}</div>
                      <div className="text-slate-500 mt-1">Qtd: {m.quantity || 0} • Lote: {m.batch || <span className="text-rose-600">faltando</span>} • Validade: {m.expiry || <span className="text-rose-600">—</span>} • Etiqueta: {m.photo_url ? <a href={m.photo_url} target="_blank" rel="noreferrer" className="text-sky-600 underline">ver</a> : <span className="text-rose-600">faltando</span>}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[10px] text-slate-400 uppercase font-bold">unit. {formatBRL(Number(m.unit_price) || 0)}</div>
                      <div className="text-sm font-black text-emerald-700">{formatBRL((Number(m.quantity) || 0) * (Number(m.unit_price) || 0))}</div>
                    </div>
                  </div>
                </div>
              ))}
              <div className="bg-primary/5 border border-primary/20 rounded-md px-3 py-2 flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-500">Total utilizado em cirurgia</span>
                <span className="text-sm font-black text-primary">{formatBRL(sumOpme(launchedUsed))}</span>
              </div>
            </div>
          )}
        </Accordion>

        <Accordion title={`Devolvido (${returned.length})`} status={null}>
          {returned.filter((m: any) => m?.description?.trim()).length === 0 ? (
            <p className="text-xs text-slate-500 italic">Nenhum material devolvido.</p>
          ) : (
            <div className="space-y-2">
              {returned.filter((m: any) => m?.description?.trim()).map((m: any, i: number) => (
                <div key={i} className="bg-white border border-slate-200 rounded-md p-3 text-xs">
                  <div className="font-bold text-slate-800">{m.description || "—"}</div>
                  <div className="text-slate-500 mt-1">Qtd devolvida: {m.quantity || 0} • Motivo: {m.reason || "—"}</div>
                </div>
              ))}
            </div>
          )}
        </Accordion>

        <Accordion title="OPME a ser Faturado" defaultOpen status={form.billing_opme_compatibility ? "ok" : "pending"}>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-slate-500">Compatibilidade Utilizada x Faturada</Label>
              <Select value={form.billing_opme_compatibility || ""} onValueChange={v => updateForm("billing_opme_compatibility", v)}>
                <SelectTrigger className="h-12 bg-white"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sim">Sim — totalmente compatível</SelectItem>
                  <SelectItem value="parcial">Parcial — divergência menor</SelectItem>
                  <SelectItem value="nao">Não — divergência crítica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(form.billing_opme_compatibility === "parcial" || form.billing_opme_compatibility === "nao") && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase text-slate-500">Descrição da Divergência</Label>
                <Textarea
                  value={form.billing_divergence_description || ""}
                  onChange={e => { updateForm("billing_divergence_description", e.target.value); updateForm("billing_divergence", true); }}
                  className="bg-white min-h-[80px]"
                  placeholder="Explique o que diverge entre o utilizado e o que será faturado…"
                />
              </div>
            )}
            {!hasTracking && launchedUsed.length > 0 && (
              <div className="bg-rose-50 border border-rose-200 rounded-md p-3 text-[11px] text-rose-700 font-medium">
                ⚠ Rastreabilidade incompleta: lote/etiqueta ausentes. Cadastre no módulo de Consumo Cirúrgico antes do fechamento.
              </div>
            )}
          </div>
        </Accordion>
      </div>
    );
  }

  // ====== TELA 3 — VALIDAÇÃO CRUZADA ======
  if (step === 3) {
    const auditOk = form.auditor_post_final_opinion === "aprovado" || form.auditor_post_final_opinion === "liberado";
    const sigtapOk = form.auditor_post_sigtap_compat === "sim";
    const procOk = form.auditor_post_procedure_compat === "sim";
    return (
      <div className="space-y-3">
        <div className="bg-sky-50 border border-sky-100 rounded-lg p-3 text-[10px] font-medium uppercase tracking-wide text-sky-700">
          Tela 3 de 5 — Resultado da Auditoria, Compatibilidade SIGTAP e Risco de Glosa.
        </div>

        <Accordion title="Resultado da Auditoria Pós" defaultOpen status={auditOk ? "ok" : "pending"}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ReadOnlyField label="Auditor" value={form.auditor_post_name ? `${form.auditor_post_name} — ${form.auditor_post_crm || ''}` : ""} />
            <ReadOnlyField label="Data da Auditoria" value={form.auditor_post_date} />
            <ReadOnlyField label="OPME x Procedimento" value={form.auditor_post_procedure_compat} />
            <ReadOnlyField label="OPME x SIGTAP" value={form.auditor_post_sigtap_compat} />
            <ReadOnlyField label="Conformidade Imagem Pós" value={form.auditor_post_image_conformity} />
            <ReadOnlyField label="Parecer Final" value={form.auditor_post_final_opinion} />
          </div>
        </Accordion>

        <Accordion title="Compatibilidade SIGTAP" defaultOpen status={sigtapOk && procOk ? "ok" : "warn"}>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between p-3 bg-white border rounded-md">
              <span className="font-semibold text-slate-700">Procedimento previsto x executado</span>
              <span className={procOk ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>{form.auditor_post_procedure_compat || "—"}</span>
            </div>
            <div className="flex justify-between p-3 bg-white border rounded-md">
              <span className="font-semibold text-slate-700">SIGTAP x OPME utilizado</span>
              <span className={sigtapOk ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>{form.auditor_post_sigtap_compat || "—"}</span>
            </div>
          </div>
        </Accordion>

        <Accordion title="Risco de Glosa" defaultOpen status={form.billing_glosa_risk === "baixo" ? "ok" : form.billing_glosa_risk ? "warn" : "pending"}>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-slate-500">Nível de Risco (calculado automaticamente)</Label>
              <div className={`min-h-12 flex items-center justify-between gap-3 px-4 py-3 rounded-md border text-sm font-bold uppercase ${
                glosaAuto.level === "baixo" ? "bg-emerald-50 border-emerald-200 text-emerald-700" :
                glosaAuto.level === "medio" ? "bg-amber-50 border-amber-200 text-amber-700" :
                "bg-rose-50 border-rose-200 text-rose-700"
              }`}>
                <span>{glosaAuto.level === "baixo" ? "Baixo" : glosaAuto.level === "medio" ? "Médio" : "Alto"}</span>
                <span className="text-[10px] font-medium">Score: {glosaAuto.score}</span>
              </div>
            </div>
            {glosaAuto.reasons.length > 0 ? (
              <div className="space-y-2">
                <Label className="text-[10px] font-semibold uppercase text-slate-500">Fatores que compõem o risco</Label>
                <ul className="space-y-1">
                  {glosaAuto.reasons.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-[11px] text-slate-700 bg-white border border-slate-200 rounded-md p-2">
                      <AlertCircle size={12} className="text-amber-500 mt-0.5 flex-shrink-0" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="bg-emerald-50 border border-emerald-200 rounded-md p-3 text-[11px] text-emerald-700 font-medium">
                ✓ Nenhum fator de risco identificado — processo conforme.
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-slate-500">Observações Complementares</Label>
              <Textarea
                value={form.billing_glosa_observations || ""}
                onChange={e => updateForm("billing_glosa_observations", e.target.value)}
                className="bg-white min-h-[80px]"
                placeholder="Liste pendências, divergências, ou justificativas que possam impactar o faturamento…"
              />
            </div>
          </div>
        </Accordion>

        <Accordion title="Autorização Prévia" status={form.billing_prior_authorization === "sim" || form.billing_prior_authorization === "nao_aplicavel" ? "ok" : "warn"}>
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase text-slate-500">Houve autorização prévia?</Label>
            <Select value={form.billing_prior_authorization || ""} onValueChange={v => updateForm("billing_prior_authorization", v)}>
              <SelectTrigger className="h-12 bg-white"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sim">Sim — autorizada</SelectItem>
                <SelectItem value="nao">Não — sem autorização</SelectItem>
                <SelectItem value="nao_aplicavel">Não Aplicável</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Accordion>
      </div>
    );
  }

  // ====== TELA 4 — DOCUMENTAÇÃO E EVIDÊNCIAS ======
  if (step === 4) {
    const docs = form.billing_docs || {};
    const requiredDocs = [
      { id: "nf", label: "Nota Fiscal da OPME" },
      { id: "rastreabilidade", label: "Rastreabilidade (Lote/Etiqueta)" },
      { id: "laudo", label: "Laudo Cirúrgico" },
      { id: "consumo", label: "Registro de Consumo" },
      { id: "exames", label: "Exames de Imagem (Pré/Pós)" },
      { id: "aih_anexa", label: "AIH Assinada" },
      { id: "termo_consentimento", label: "Termo de Consentimento" },
    ];
    const completedCount = requiredDocs.filter(d => docs[d.id]).length;
    const allDocs = completedCount === requiredDocs.length;
    return (
      <div className="space-y-3">
        <div className="bg-sky-50 border border-sky-100 rounded-lg p-3 text-[10px] font-medium uppercase tracking-wide text-sky-700">
          Tela 4 de 5 — Checklist obrigatório de documentação para fechamento.
        </div>

        <Accordion title={`Checklist de Documentos (${completedCount}/${requiredDocs.length})`} defaultOpen status={allDocs ? "ok" : "pending"}>
          <div className="space-y-2">
            {requiredDocs.map(doc => (
              <label key={doc.id} className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${docs[doc.id] ? "bg-emerald-50 border-emerald-200" : "bg-white border-slate-200"}`}>
                <Checkbox checked={!!docs[doc.id]} onCheckedChange={v => updateForm("billing_docs", { ...docs, [doc.id]: !!v })} />
                <span className="text-xs font-medium text-slate-700">{doc.label}</span>
              </label>
            ))}
          </div>
        </Accordion>

        <Accordion title="Evidências Complementares" status={null}>
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase text-slate-500">Observações de Evidência</Label>
            <Textarea
              value={form.notes || ""}
              onChange={e => updateForm("notes", e.target.value)}
              className="bg-white min-h-[100px]"
              placeholder="Descreva qualquer evidência adicional, anexo ou observação relevante…"
            />
          </div>
        </Accordion>

        {!allDocs && (
          <div className="bg-rose-50 border border-rose-200 rounded-md p-3 text-[11px] text-rose-700 font-medium">
            ⚠ Documentação incompleta. Faltam {requiredDocs.length - completedCount} item(ns) obrigatório(s) para liberar o fechamento.
          </div>
        )}
      </div>
    );
  }

  // ====== TELA 5 — FECHAMENTO E DOSSIÊ ======
  if (step === 5) {
    const docs = form.billing_docs || {};
    const requiredDocs = ["nf", "rastreabilidade", "laudo", "consumo", "exames", "aih_anexa", "termo_consentimento"];
    const docsComplete = requiredDocs.every(id => docs[id]);
    const auditOk = form.auditor_post_final_opinion === "aprovado" || form.auditor_post_final_opinion === "liberado";
    const opmeOk = form.billing_opme_compatibility === "sim" || (form.billing_opme_compatibility === "parcial" && form.billing_divergence_description);
    const blockers: string[] = [];
    if (!docsComplete) blockers.push("Documentação incompleta");
    if (!auditOk) blockers.push("Auditoria pós sem aprovação");
    if (!opmeOk) blockers.push("OPME utilizado x faturado divergente sem justificativa");
    if (!form.billing_aih_number) blockers.push("AIH ausente");
    if (!form.billing_cid_main) blockers.push("CID principal ausente");
    if (!form.billing_cnes) blockers.push("CNES ausente");

    // ====== Dados consolidados do caso (modo consulta após conclusão) ======
    const isClosed = form.status === "concluido";
    const requested = Array.isArray(form.opme_requested) ? form.opme_requested : [];
    const used = Array.isArray(form.opme_used) ? form.opme_used : [];
    const launchedUsed = used.filter((u: any) => u?.launched);
    const returned = Array.isArray(form.opme_returned) ? form.opme_returned : [];
    const totalRequested = sumOpme(requested);
    const totalUsed = sumOpme(launchedUsed);
    const economy = totalRequested - totalUsed;
    const economyPct = totalRequested > 0 ? (economy / totalRequested) * 100 : 0;
    const docsCount = requiredDocs.filter(id => docs[id]).length;
    const justRounds = Number(form.justification_round || 0);
    const justHistory = Array.isArray(form.justification_history) ? form.justification_history : [];

    const fmtDate = (d?: string) => {
      if (!d) return "—";
      try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return "—"; }
    };
    const fmtDateTime = (d?: string) => {
      if (!d) return "—";
      try { return new Date(d).toLocaleString("pt-BR"); } catch { return "—"; }
    };

    const timeline: { label: string; when?: string; who?: string }[] = [
      { label: "Cadastro do paciente", when: form.created_at, who: form.created_by_name || form.responsible_name },
      { label: "Requisição médica", when: form.requested_at || form.procedure_date, who: form.requester_name || form.responsible_name },
      { label: "Auditoria Pré-OP", when: form.auditor_pre_date, who: form.auditor_pre_name },
      { label: "Procedimento cirúrgico", when: form.procedure_date, who: form.responsible_name },
      { label: "Consumo cirúrgico", when: form.consumption_at, who: form.consumption_responsible_name || form.responsible_name },
      { label: "Auditoria Pós-OP", when: form.auditor_post_date, who: form.auditor_post_name },
      ...(justRounds > 0 ? [{ label: `Justificativa do cirurgião (${justRounds} rodada${justRounds > 1 ? "s" : ""})`, when: form.surgeon_justification_at, who: form.surgeon_justification_by }] : []),
      { label: "Fechamento de faturamento", when: form.billing_closed_at || form.updated_at, who: form.billing_responsible_name },
    ].filter(t => t.when || t.who);

    return (
      <div className="space-y-3">
        <div className={`rounded-lg p-3 text-[10px] font-medium uppercase tracking-wide ${isClosed ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-sky-50 border border-sky-100 text-sky-700"}`}>
          {isClosed
            ? `Processo concluído em ${fmtDateTime(form.billing_closed_at || form.updated_at)} — registro consolidado e somente leitura.`
            : "Tela 5 de 5 — Status final, responsável e geração do dossiê."}
        </div>

        {isClosed && (
          <>
            {/* KPIs do caso */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="bg-white border border-slate-200 rounded-xl p-3">
                <div className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Solicitado</div>
                <div className="text-sm font-black text-slate-700 mt-1">{formatBRL(totalRequested)}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">{requested.length} item(ns)</div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-3">
                <div className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Utilizado</div>
                <div className="text-sm font-black text-primary mt-1">{formatBRL(totalUsed)}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">{launchedUsed.length} consumido(s)</div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-3">
                <div className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Devolvido</div>
                <div className="text-sm font-black text-amber-600 mt-1">{returned.filter((r: any) => r?.description?.trim()).length}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">item(ns) ao estoque</div>
              </div>
              <div className={`border rounded-xl p-3 ${economy >= 0 ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200"}`}>
                <div className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">{economy >= 0 ? "Economia" : "Excedente"}</div>
                <div className={`text-sm font-black mt-1 ${economy >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{formatBRL(Math.abs(economy))}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">{economyPct >= 0 ? "−" : "+"}{Math.abs(economyPct).toFixed(1)}% vs. solicitado</div>
              </div>
            </div>

            {/* Resumo Executivo */}
            <Accordion title="Resumo Executivo do Caso" defaultOpen status="ok">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="bg-white border border-slate-200 rounded-md p-3 space-y-1">
                  <div className="text-[9px] font-bold uppercase text-slate-400">Paciente</div>
                  <div className="font-bold text-slate-800">{form.patient_name || "—"}</div>
                  <div className="text-slate-500">Prontuário {form.patient_record || "—"} • SUS {form.patient_sus || "—"}</div>
                  <div className="text-slate-500">Nascimento: {fmtDate(form.patient_birthdate)}</div>
                </div>
                <div className="bg-white border border-slate-200 rounded-md p-3 space-y-1">
                  <div className="text-[9px] font-bold uppercase text-slate-400">Unidade & AIH</div>
                  <div className="font-bold text-slate-800">{form.facility_unit || "—"}</div>
                  <div className="text-slate-500">CNES {form.billing_cnes || "—"} • AIH {form.billing_aih_number || "—"}</div>
                  <div className="text-slate-500">Internação: {fmtDate(form.billing_admission_date)} → {fmtDate(form.billing_discharge_date)}</div>
                </div>
                <div className="bg-white border border-slate-200 rounded-md p-3 space-y-1 md:col-span-2">
                  <div className="text-[9px] font-bold uppercase text-slate-400">Procedimento</div>
                  <div className="font-bold text-slate-800">{form.procedure_name || "—"}</div>
                  <div className="text-slate-500">SIGTAP {form.procedure_sigtap_code || "—"} • CID {form.billing_cid_main || "—"}{form.billing_cid_secondary ? ` / ${form.billing_cid_secondary}` : ""}</div>
                  <div className="text-slate-500">Realizado em {fmtDate(form.procedure_date)} — Sala {form.procedure_room || "—"} — Caráter {form.billing_attendance_character || form.procedure_type || "—"}</div>
                </div>
                <div className="bg-white border border-slate-200 rounded-md p-3 space-y-1">
                  <div className="text-[9px] font-bold uppercase text-slate-400">Auditoria Pós</div>
                  <div className="font-bold text-slate-800">{form.auditor_post_name || "—"}{form.auditor_post_crm ? ` — ${form.auditor_post_crm}` : ""}</div>
                  <div className="text-slate-500">Parecer: <span className={auditOk ? "text-emerald-700 font-bold uppercase" : "text-rose-700 font-bold uppercase"}>{form.auditor_post_final_opinion || "—"}</span></div>
                  <div className="text-slate-500">Data: {fmtDate(form.auditor_post_date)}</div>
                </div>
                <div className="bg-white border border-slate-200 rounded-md p-3 space-y-1">
                  <div className="text-[9px] font-bold uppercase text-slate-400">Faturamento</div>
                  <div className="font-bold text-slate-800">{form.billing_responsible_name || "—"}</div>
                  <div className="text-slate-500">Status: <span className="font-bold uppercase text-emerald-700">{form.billing_final_status || "Faturado"}</span></div>
                  <div className="text-slate-500">Risco de glosa: <span className={`font-bold uppercase ${form.billing_glosa_risk === "baixo" ? "text-emerald-700" : form.billing_glosa_risk === "medio" ? "text-amber-700" : "text-rose-700"}`}>{form.billing_glosa_risk || "—"}</span></div>
                </div>
              </div>
            </Accordion>

            {/* Linha do Tempo */}
            <Accordion title="Linha do Tempo do Processo" defaultOpen status="ok">
              <ol className="relative border-l-2 border-slate-200 ml-2 space-y-3">
                {timeline.map((t, i) => (
                  <li key={i} className="ml-4">
                    <div className="absolute -left-[7px] w-3 h-3 bg-primary rounded-full border-2 border-white shadow"></div>
                    <div className="bg-white border border-slate-200 rounded-md p-3">
                      <div className="text-xs font-bold text-slate-800">{t.label}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {fmtDateTime(t.when)} {t.who ? `• ${t.who}` : ""}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </Accordion>

            {/* Justificativas (se houve reanálise) */}
            {justRounds > 0 && (
              <Accordion title={`Reanálises e Justificativas (${justRounds})`} status="warn">
                <div className="space-y-2">
                  {justHistory.map((h: any, i: number) => (
                    <div key={i} className="bg-white border border-amber-200 rounded-md p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[10px] font-bold uppercase text-amber-700">Rodada {h.round || i + 1}</div>
                        <div className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${h.decision === "liberada" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{h.decision || "—"}</div>
                      </div>
                      {h.auditor_reason && (<div className="text-[11px]"><span className="font-bold text-slate-600">Auditor: </span><span className="text-slate-700">{h.auditor_reason}</span></div>)}
                      {h.surgeon_justification && (<div className="text-[11px]"><span className="font-bold text-slate-600">Cirurgião: </span><span className="text-slate-700">{h.surgeon_justification}</span></div>)}
                      {Array.isArray(h.attachments) && h.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {h.attachments.map((a: any, ai: number) => (
                            <a key={ai} href={a.url} target="_blank" rel="noreferrer" className="text-[10px] bg-sky-50 text-sky-700 border border-sky-200 rounded px-2 py-1 hover:bg-sky-100 underline">{a.name || `anexo ${ai + 1}`}</a>
                          ))}
                        </div>
                      )}
                      <div className="text-[10px] text-slate-400">{fmtDateTime(h.decision_at)} • {h.decision_by || "—"}</div>
                    </div>
                  ))}
                </div>
              </Accordion>
            )}

            {/* Documentação consolidada */}
            <Accordion title={`Documentação Consolidada (${docsCount}/${requiredDocs.length})`} status={docsComplete ? "ok" : "warn"}>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {requiredDocs.map(id => (
                  <div key={id} className={`text-[11px] flex items-center gap-2 p-2 rounded border ${docs[id] ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-rose-50 border-rose-200 text-rose-700"}`}>
                    {docs[id] ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                    <span className="font-medium uppercase">{id.replace(/_/g, " ")}</span>
                  </div>
                ))}
              </div>
            </Accordion>
          </>
        )}

        <Accordion title="Validação Final" defaultOpen status={blockers.length === 0 ? "ok" : "pending"}>
          {blockers.length === 0 ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-md p-3 text-xs text-emerald-700 font-bold uppercase text-center">
              ✓ Pronto para fechamento — todas as validações aprovadas
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase text-rose-600">Pendências bloqueadoras:</p>
              <ul className="space-y-1">
                {blockers.map((b, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-md p-2">
                    <AlertCircle size={14} /> {b}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Accordion>

        <Accordion title="Dados de Fechamento" defaultOpen status={form.billing_responsible_name && form.billing_final_status ? "ok" : "pending"}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-slate-500">Responsável pelo Faturamento</Label>
              <Input value={form.billing_responsible_name || ""} onChange={e => updateForm("billing_responsible_name", e.target.value)} className="h-12 bg-white" placeholder="Nome do faturista" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-slate-500">Status Final</Label>
              <Select value={form.billing_final_status || ""} onValueChange={v => updateForm("billing_final_status", v)}>
                <SelectTrigger className="h-12 bg-white"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="faturado" disabled={blockers.length > 0}>Faturado{blockers.length > 0 ? " (bloqueado)" : ""}</SelectItem>
                  <SelectItem value="ressalva">Faturado com Ressalva</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="bloqueado">Bloqueado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2 mt-2">
            <Label className="text-xs font-semibold uppercase text-slate-500">Observações Finais</Label>
            <Textarea value={form.billing_final_observations || ""} onChange={e => updateForm("billing_final_observations", e.target.value)} className="bg-white min-h-[80px]" placeholder="Notas de encerramento…" />
          </div>
        </Accordion>

        <Accordion title="Dossiê do Caso" status={form.billing_dossier_url || onGeneratePdf ? "ok" : null}>
          <div className="space-y-3">
            {onGeneratePdf && (
              <Button 
                variant="default" 
                className="w-full h-12 text-xs font-bold uppercase flex gap-2" 
                onClick={onGeneratePdf}
              >
                <FileText size={16} /> Gerar Dossiê Consolidado (PDF)
              </Button>
            )}
            
            {form.billing_dossier_url && (
              <Button 
                variant="outline" 
                className="w-full h-12 text-xs font-bold uppercase border-emerald-100 bg-emerald-50 text-emerald-700 flex gap-2" 
                onClick={() => window.open(form.billing_dossier_url, "_blank")}
              >
                <FileText size={16} /> Ver Arquivo Externo
              </Button>
            )}
            
            {!form.billing_dossier_url && !onGeneratePdf && (
              <p className="text-xs text-slate-500 italic">O dossiê PDF será gerado automaticamente após o fechamento com status "Faturado" ou "Ressalva".</p>
            )}
          </div>
        </Accordion>
      </div>
    );
  }

  return null;
}