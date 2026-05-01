import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";

/**
 * BillingTabs — Faturamento OPME (Tela 4)
 *
 * 12 abas não-lineares. Conferência, validação e fechamento.
 * Princípios:
 *  - dados que existem em outras etapas → preenchidos automaticamente
 *  - dados inéditos → criados aqui
 *  - inconsistências → bloqueiam o fechamento
 */

const TABS = [
  { id: "resumo", label: "Resumo" },
  { id: "aih", label: "AIH" },
  { id: "procedimento", label: "Procedimento" },
  { id: "opme", label: "OPME util × fat" },
  { id: "rastreabilidade", label: "Rastreabilidade" },
  { id: "documentacao", label: "Documentação" },
  { id: "evidencias", label: "Evidências" },
  { id: "log", label: "Histórico" },
  { id: "validacao", label: "Validação SUS" },
  { id: "glosa", label: "Glosa" },
  { id: "saida", label: "Saída" },
  { id: "fechamento", label: "Fechamento" },
];

const fmtDate = (d: any) => {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return String(d); }
};
const fmtDT = (d: any) => {
  if (!d) return "—";
  try { return new Date(d).toLocaleString("pt-BR"); } catch { return String(d); }
};

const Field = ({ label, value }: { label: string; value: any }) => (
  <div className="space-y-0.5">
    <p className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">{label}</p>
    <p className="text-xs text-slate-800 break-words">{value || value === 0 ? value : <span className="text-slate-300">—</span>}</p>
  </div>
);

interface Props {
  form: any;
  updateForm: (key: string, value: any) => void;
  preopExams: any[];
  postopExams: any[];
  consumptionExams: any[];
  history: any[];
  attachments: any[];
}

export default function BillingTabs({ form, updateForm, preopExams, postopExams, consumptionExams, history, attachments }: Props) {
  const [tab, setTab] = useState<string>("resumo");

  const requested = useMemo(() => Array.isArray(form.opme_requested) ? form.opme_requested.filter((i: any) => i?.description?.trim()) : [], [form.opme_requested]);
  const used = useMemo(() => Array.isArray(form.opme_used) ? form.opme_used.filter((i: any) => i?.description?.trim()) : [], [form.opme_used]);

  // ===== VALIDAÇÕES (Tela 9) =====
  const checks = useMemo(() => {
    const procDivergent = !!(form.procedure_sigtap_code && form.billing_sigtap_code && form.procedure_sigtap_code !== form.billing_sigtap_code);
    const procDivergentNoDesc = procDivergent && !(form.billing_divergence_description || "").trim();

    const usedWithoutBatch = used.filter((u: any) => !u.batch || !String(u.batch).trim());
    const usedWithoutEvidence = used.filter((u: any) => !u.photo_url);
    const traceabilityOk = used.length > 0 && usedWithoutBatch.length === 0 && usedWithoutEvidence.length === 0;

    const docs = form.billing_docs || {};
    const requiredDocs = ["nf", "rastreabilidade", "laudo", "consumo", "exames"];
    const missingDocs = requiredDocs.filter((k) => !docs[k]);
    const docsOk = missingDocs.length === 0;

    const auditPosOk = form.auditor_post_final_opinion === "aprovado" || form.auditor_post_justification_decision === "liberada";
    const auditPreOk = form.auditor_pre_opinion === "aprovado";

    const aihOk = !!(form.billing_aih_number || "").trim();
    const cnesOk = !!(form.billing_cnes || "").trim();
    const cidOk = !!(form.billing_cid_main || "").trim();

    return {
      procDivergent,
      procDivergentNoDesc,
      traceabilityOk,
      usedWithoutBatch,
      usedWithoutEvidence,
      docsOk,
      missingDocs,
      auditPosOk,
      auditPreOk,
      aihOk,
      cnesOk,
      cidOk,
    };
  }, [form, used]);

  const blockers: string[] = [];
  if (!checks.traceabilityOk) blockers.push("Rastreabilidade incompleta (lote ou comprovação ausente em OPME utilizada).");
  if (!checks.docsOk) blockers.push(`Documentação obrigatória faltando: ${checks.missingDocs.join(", ")}.`);
  if (!checks.auditPosOk) blockers.push("Auditoria pós-OP ainda não aprovada.");
  if (checks.procDivergentNoDesc) blockers.push("Divergência entre procedimento solicitado e faturado sem descrição.");
  if (!checks.aihOk) blockers.push("Número da AIH não informado.");

  const validationResult = blockers.length > 0 ? "bloqueado" : (checks.procDivergent || !checks.auditPreOk ? "ressalva" : "apto");

  // ===== GLOSA (Tela 10) — risco automático =====
  const glosaReasons: { etapa: string; tipo: string; motivo: string }[] = [];
  if (checks.procDivergent) glosaReasons.push({ etapa: "Procedimento", tipo: "SIGTAP", motivo: "SIGTAP solicitado ≠ SIGTAP faturado" });
  if (!checks.traceabilityOk) glosaReasons.push({ etapa: "Consumo", tipo: "Rastreabilidade", motivo: "Lote ou etiqueta ausentes" });
  if (!checks.docsOk) glosaReasons.push({ etapa: "Faturamento", tipo: "Documentação", motivo: `Faltam: ${checks.missingDocs.join(", ")}` });
  if (!checks.auditPosOk) glosaReasons.push({ etapa: "Auditoria pós", tipo: "Auditoria", motivo: "Parecer pós não aprovado" });
  if (form.billing_prior_authorization === "nao") glosaReasons.push({ etapa: "Faturamento", tipo: "Autorização", motivo: "Sem autorização prévia" });
  const glosaRisk = glosaReasons.length === 0 ? "baixo" : glosaReasons.length <= 2 ? "medio" : "alto";

  // ===== EVIDÊNCIAS unificadas (Tela 7) =====
  const evidences = useMemo(() => {
    const list: { origem: string; tipo: string; nome: string; url: string; data?: string; usuario?: string }[] = [];
    if (form.billing_aih_file_url) list.push({ origem: "Cadastro", tipo: "AIH", nome: "AIH anexada", url: form.billing_aih_file_url });
    preopExams.forEach((e: any) => list.push({ origem: "Cadastro/Requisição", tipo: "Exame pré", nome: e.name || "exame pré", url: e.url, data: e.exam_date }));
    consumptionExams.forEach((e: any) => list.push({ origem: "Consumo", tipo: "Exame consumo", nome: e.name || "exame consumo", url: e.url, data: e.exam_date }));
    postopExams.forEach((e: any) => list.push({ origem: "Consumo (pós)", tipo: "Exame pós", nome: e.name || "exame pós", url: e.url, data: e.exam_date }));
    used.forEach((u: any, i: number) => { if (u.photo_url) list.push({ origem: "Consumo", tipo: "Etiqueta/Lote", nome: `Comprovação OPME #${i + 1}`, url: u.photo_url }); });
    if (Array.isArray(form.surgeon_justification_attachments)) {
      form.surgeon_justification_attachments.forEach((a: any) => list.push({ origem: "Justificativa cirurgião", tipo: "Anexo", nome: a.name || "anexo", url: a.url, data: a.uploaded_at }));
    }
    (attachments || []).forEach((a: any) => list.push({ origem: a.stage || "—", tipo: a.category || "Anexo", nome: a.file_name, url: a.file_url, data: a.created_at, usuario: a.uploaded_by_name }));
    return list;
  }, [form, preopExams, postopExams, consumptionExams, used, attachments]);

  return (
    <div className="space-y-3">
      {/* Barra de status global */}
      <div className={`rounded-xl p-3 border text-xs font-medium flex items-center justify-between ${
        validationResult === "apto" ? "bg-emerald-50 border-emerald-200 text-emerald-800" :
        validationResult === "ressalva" ? "bg-amber-50 border-amber-200 text-amber-800" :
        "bg-rose-50 border-rose-200 text-rose-800"
      }`}>
        <span className="uppercase font-bold tracking-wider">
          {validationResult === "apto" ? "Apto para faturamento" : validationResult === "ressalva" ? "Com ressalva" : "Bloqueado"}
        </span>
        <span className="text-[10px] uppercase">Risco de glosa: {glosaRisk}</span>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`text-[10px] font-bold uppercase px-2.5 py-1.5 rounded-full transition-colors ${
              tab === t.id ? "bg-primary text-primary-foreground" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* === TELA 1: RESUMO === */}
      {tab === "resumo" && (
        <div className="space-y-4">
          <section className="bg-white rounded-xl border p-4 space-y-3">
            <h4 className="text-[10px] font-black uppercase text-primary tracking-widest">Paciente</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Field label="Unidade" value={form.facility_unit} />
              <Field label="Paciente" value={form.patient_name} />
              <Field label="Nascimento" value={fmtDate(form.patient_birthdate)} />
              <Field label="Prontuário" value={form.patient_record} />
              <Field label="Mãe" value={form.patient_mother_name} />
              <Field label="Cartão SUS" value={form.patient_sus} />
              <Field label="Nº AIH" value={form.billing_aih_number} />
              <Field label="AIH anexada" value={form.billing_aih_file_url ? "Sim" : "—"} />
              <Field label="Responsável" value={form.responsible_name} />
              <Field label="Conselho" value={form.responsible_register} />
            </div>
          </section>
          <section className="bg-white rounded-xl border p-4 space-y-3">
            <h4 className="text-[10px] font-black uppercase text-primary tracking-widest">Procedimento</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Field label="Data" value={fmtDate(form.procedure_date)} />
              <Field label="Tipo" value={form.procedure_type} />
              <Field label="Procedimento" value={form.procedure_name} />
              <Field label="SIGTAP" value={form.procedure_sigtap_code} />
              <Field label="Sala/Setor" value={form.procedure_room} />
              <Field label="Lateralidade" value={form.procedure_side_cadastro} />
              <Field label="Região" value={form.procedure_region_cadastro} />
              <Field label="Segmento" value={form.procedure_segment_cadastro} />
              <Field label="Posição" value={form.procedure_position_cadastro} />
            </div>
          </section>
        </div>
      )}

      {/* === TELA 2: AIH === */}
      {tab === "aih" && (
        <section className="bg-white rounded-xl border p-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pb-2 border-b">
            <Field label="Unidade" value={form.facility_unit} />
            <Field label="Procedimento SIGTAP" value={form.procedure_name} />
            <Field label="Cód. SIGTAP" value={form.procedure_sigtap_code} />
            <Field label="Status AIH anexada" value={form.billing_aih_file_url ? "Anexada" : "Não anexada"} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase text-slate-500">Número da AIH *</Label>
              <Input value={form.billing_aih_number || ""} onChange={(e) => updateForm("billing_aih_number", e.target.value)} placeholder="000.000.000-0" className="h-11 bg-white" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase text-slate-500">Tipo da AIH</Label>
              <Select value={form.billing_aih_type || ""} onValueChange={(v) => updateForm("billing_aih_type", v)}>
                <SelectTrigger className="h-11 bg-white"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Tipo 1 — Normal</SelectItem>
                  <SelectItem value="3">Tipo 3 — Longa permanência</SelectItem>
                  <SelectItem value="5">Tipo 5 — Continuação</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase text-slate-500">Data de internação</Label>
              <Input type="date" value={form.billing_admission_date || ""} onChange={(e) => updateForm("billing_admission_date", e.target.value)} className="h-11 bg-white" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase text-slate-500">Data de alta</Label>
              <Input type="date" value={form.billing_discharge_date || ""} onChange={(e) => updateForm("billing_discharge_date", e.target.value)} className="h-11 bg-white" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase text-slate-500">CNES da unidade *</Label>
              <Input value={form.billing_cnes || ""} onChange={(e) => updateForm("billing_cnes", e.target.value)} placeholder="0000000" className="h-11 bg-white" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase text-slate-500">Caráter do atendimento</Label>
              <Select value={form.billing_attendance_character || ""} onValueChange={(v) => updateForm("billing_attendance_character", v)}>
                <SelectTrigger className="h-11 bg-white"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="01">01 — Eletivo</SelectItem>
                  <SelectItem value="02">02 — Urgência</SelectItem>
                  <SelectItem value="03">03 — Acidente local trabalho</SelectItem>
                  <SelectItem value="04">04 — Acidente trajeto trabalho</SelectItem>
                  <SelectItem value="05">05 — Outros tipos de acidente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase text-slate-500">CID principal *</Label>
              <Input value={form.billing_cid_main || ""} onChange={(e) => updateForm("billing_cid_main", e.target.value.toUpperCase())} placeholder="Ex.: M16.1" className="h-11 bg-white" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase text-slate-500">CID secundário</Label>
              <Input value={form.billing_cid_secondary || ""} onChange={(e) => updateForm("billing_cid_secondary", e.target.value.toUpperCase())} placeholder="Ex.: I10" className="h-11 bg-white" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-[10px] font-bold uppercase text-slate-500">Motivo da saída</Label>
              <Select value={form.billing_exit_reason || ""} onValueChange={(v) => updateForm("billing_exit_reason", v)}>
                <SelectTrigger className="h-11 bg-white"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="alta_curado">Alta — curado</SelectItem>
                  <SelectItem value="alta_melhorado">Alta — melhorado</SelectItem>
                  <SelectItem value="alta_administrativa">Alta administrativa</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                  <SelectItem value="evasao">Evasão</SelectItem>
                  <SelectItem value="obito_com_necropsia">Óbito com necropsia</SelectItem>
                  <SelectItem value="obito_sem_necropsia">Óbito sem necropsia</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>
      )}

      {/* === TELA 3: PROCEDIMENTO FATURADO === */}
      {tab === "procedimento" && (
        <section className="bg-white rounded-xl border p-4 space-y-4">
          <div>
            <h4 className="text-[10px] font-black uppercase text-primary tracking-widest mb-2">Solicitado (requisição)</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 bg-slate-50 rounded-lg p-3">
              <Field label="Procedimento solicitado" value={form.procedure_name} />
              <Field label="SIGTAP solicitado" value={form.procedure_sigtap_code} />
              <Field label="Data prevista" value={fmtDate(form.procedure_date)} />
              <Field label="Tipo" value={form.procedure_type} />
              <Field label="Sala / setor" value={form.procedure_room} />
              <Field label="Solicitante" value={form.requester_name} />
              <Field label="Registro" value={form.requester_register} />
            </div>
          </div>

          <div>
            <h4 className="text-[10px] font-black uppercase text-primary tracking-widest mb-2">Faturado</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase text-slate-500">Procedimento faturado</Label>
                <Input value={form.billing_procedure_name || ""} onChange={(e) => updateForm("billing_procedure_name", e.target.value)} className="h-11 bg-white" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase text-slate-500">SIGTAP faturado</Label>
                <Input value={form.billing_sigtap_code || ""} onChange={(e) => updateForm("billing_sigtap_code", e.target.value)} className="h-11 bg-white" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase text-slate-500">Autorização prévia</Label>
                <Select value={form.billing_prior_authorization || "nao_se_aplica"} onValueChange={(v) => updateForm("billing_prior_authorization", v)}>
                  <SelectTrigger className="h-11 bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sim">Sim</SelectItem>
                    <SelectItem value="nao">Não</SelectItem>
                    <SelectItem value="nao_se_aplica">Não se aplica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Checkbox id="aih_gen" checked={!!form.billing_aih_generated} onCheckedChange={(v) => updateForm("billing_aih_generated", !!v)} />
                <Label htmlFor="aih_gen" className="text-xs">AIH gerada</Label>
              </div>
            </div>
          </div>

          {checks.procDivergent && (
            <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="destructive">Divergência</Badge>
                <span className="text-xs text-amber-900 font-medium">SIGTAP solicitado ({form.procedure_sigtap_code}) ≠ SIGTAP faturado ({form.billing_sigtap_code}).</span>
              </div>
              <Textarea
                value={form.billing_divergence_description || ""}
                onChange={(e) => { updateForm("billing_divergence_description", e.target.value); updateForm("billing_divergence", true); }}
                placeholder="Descreva a justificativa clínica/administrativa para a divergência (obrigatório)..."
                className="min-h-[80px] bg-white"
              />
              {checks.procDivergentNoDesc && <p className="text-[10px] text-rose-600 font-medium">Descrição obrigatória para liberar o faturamento.</p>}
            </div>
          )}
        </section>
      )}

      {/* === TELA 4: OPME UTILIZADA × FATURADA === */}
      {tab === "opme" && (
        <section className="bg-white rounded-xl border p-4 space-y-3">
          <h4 className="text-[10px] font-black uppercase text-primary tracking-widest">Confronto solicitado × utilizado × faturado</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b text-[9px] font-bold uppercase text-slate-500">
                  <th className="text-left py-2 px-1">Descrição</th>
                  <th className="text-center px-1">Solic.</th>
                  <th className="text-center px-1">Utiliz.</th>
                  <th className="text-center px-1">Faturada</th>
                  <th className="text-center px-1">Lote</th>
                  <th className="text-right px-1">V.unit</th>
                  <th className="text-right px-1">V.total</th>
                </tr>
              </thead>
              <tbody>
                {used.map((u: any, idx: number) => {
                  const matchReq = requested.find((r: any) => r.description?.toLowerCase().trim() === u.description?.toLowerCase().trim());
                  const qReq = matchReq?.quantity ?? "—";
                  const qUsed = u.quantity || "0";
                  const qBilled = u.billed_quantity ?? u.quantity ?? "";
                  const valor = parseFloat(String(u.unit_price || "0").replace(",", ".")) || 0;
                  const total = valor * (parseFloat(String(qBilled || 0)) || 0);
                  return (
                    <tr key={idx} className="border-b align-top">
                      <td className="py-2 px-1">{u.description}</td>
                      <td className="text-center px-1">{qReq}</td>
                      <td className="text-center px-1">{qUsed}</td>
                      <td className="px-1">
                        <Input
                          value={qBilled}
                          onChange={(e) => {
                            const next = [...used];
                            next[idx] = { ...next[idx], billed_quantity: e.target.value };
                            // Mescla de volta na lista original mantendo itens não-utilizados
                            const merged = (form.opme_used || []).map((it: any) => it === used[idx] ? next[idx] : it);
                            updateForm("opme_used", merged);
                          }}
                          className="h-8 w-16 text-[11px] text-center"
                        />
                      </td>
                      <td className="text-center px-1 text-[10px]">
                        {u.batch ? <span className="font-mono">{u.batch}</span> : <span className="text-rose-500 font-bold">faltando</span>}
                      </td>
                      <td className="px-1">
                        <Input
                          value={u.unit_price || ""}
                          onChange={(e) => {
                            const merged = (form.opme_used || []).map((it: any) => it === used[idx] ? { ...it, unit_price: e.target.value } : it);
                            updateForm("opme_used", merged);
                          }}
                          placeholder="0,00"
                          className="h-8 w-20 text-[11px] text-right"
                        />
                      </td>
                      <td className="text-right px-1 font-mono text-[11px]">{total ? total.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t">
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase text-slate-500">Compatibilidade utilizada × faturada</Label>
              <Select value={form.billing_opme_compatibility || ""} onValueChange={(v) => updateForm("billing_opme_compatibility", v)}>
                <SelectTrigger className="h-11 bg-white"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sim">Sim</SelectItem>
                  <SelectItem value="parcial">Parcial</SelectItem>
                  <SelectItem value="nao">Não</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Checkbox id="opme_div" checked={!!form.billing_divergence} onCheckedChange={(v) => updateForm("billing_divergence", !!v)} />
              <Label htmlFor="opme_div" className="text-xs">Há divergência</Label>
            </div>
            {form.billing_divergence && (
              <div className="md:col-span-2">
                <Label className="text-[10px] font-bold uppercase text-slate-500">Descrição da divergência</Label>
                <Textarea value={form.billing_divergence_description || ""} onChange={(e) => updateForm("billing_divergence_description", e.target.value)} className="min-h-[70px] bg-white" />
              </div>
            )}
          </div>
        </section>
      )}

      {/* === TELA 5: RASTREABILIDADE === */}
      {tab === "rastreabilidade" && (
        <section className="bg-white rounded-xl border p-4 space-y-3">
          <h4 className="text-[10px] font-black uppercase text-primary tracking-widest">Rastreabilidade por OPME utilizada</h4>
          {used.length === 0 && <p className="text-xs text-slate-400">Nenhuma OPME utilizada registrada no Consumo.</p>}
          {used.map((u: any, idx: number) => (
            <div key={idx} className="border rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-700">{u.description}</p>
                {(!u.batch || !u.photo_url) && <Badge variant="destructive">Bloqueia</Badge>}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Field label="Quantidade utilizada" value={u.quantity} />
                <Field label="Lote" value={u.batch} />
                <Field label="Etiqueta anexada" value={u.photo_url ? "Sim" : "Não"} />
                <div className="space-y-1">
                  <Label className="text-[9px] font-bold uppercase text-slate-500">Validade</Label>
                  <Input type="date" value={u.expiry || ""} onChange={(e) => {
                    const merged = (form.opme_used || []).map((it: any) => it === used[idx] ? { ...it, expiry: e.target.value } : it);
                    updateForm("opme_used", merged);
                  }} className="h-9 bg-white" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-bold uppercase text-slate-500">Fabricante</Label>
                  <Input value={u.manufacturer || ""} onChange={(e) => {
                    const merged = (form.opme_used || []).map((it: any) => it === used[idx] ? { ...it, manufacturer: e.target.value } : it);
                    updateForm("opme_used", merged);
                  }} className="h-9 bg-white" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-bold uppercase text-slate-500">Nº Nota Fiscal</Label>
                  <Input value={u.invoice_number || ""} onChange={(e) => {
                    const merged = (form.opme_used || []).map((it: any) => it === used[idx] ? { ...it, invoice_number: e.target.value } : it);
                    updateForm("opme_used", merged);
                  }} className="h-9 bg-white" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-bold uppercase text-slate-500">Nº Etiqueta</Label>
                  <Input value={u.label_number || ""} onChange={(e) => {
                    const merged = (form.opme_used || []).map((it: any) => it === used[idx] ? { ...it, label_number: e.target.value } : it);
                    updateForm("opme_used", merged);
                  }} className="h-9 bg-white" />
                </div>
              </div>
              {u.photo_url && (
                <a href={u.photo_url} target="_blank" rel="noreferrer" className="text-[10px] text-primary underline">Ver comprovação</a>
              )}
            </div>
          ))}
          {!checks.traceabilityOk && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
              <strong>FATURAMENTO BLOQUEADO.</strong> Há OPME utilizada sem lote ou sem comprovação anexada.
            </div>
          )}
        </section>
      )}

      {/* === TELA 6: DOCUMENTAÇÃO === */}
      {tab === "documentacao" && (
        <section className="bg-white rounded-xl border p-4 space-y-3">
          <h4 className="text-[10px] font-black uppercase text-primary tracking-widest">Documentação obrigatória</h4>
          <p className="text-[10px] text-slate-500">Marcações automáticas baseadas em evidências do sistema. Você pode revisar e marcar manualmente quando necessário.</p>
          {[
            { id: "nf", label: "Nota fiscal da OPME", auto: used.some((u: any) => u.invoice_number) },
            { id: "laudo", label: "Laudo cirúrgico", auto: !!form.postop_result_description },
            { id: "consumo", label: "Registro de consumo", auto: used.length > 0 },
            { id: "autorizacao", label: "Autorização prévia", auto: form.billing_prior_authorization === "sim" || form.billing_prior_authorization === "nao_se_aplica" },
            { id: "exames", label: "Exames pré-operatórios", auto: preopExams.length > 0 },
            { id: "exames_pos", label: "Exames pós-operatórios", auto: postopExams.length > 0 },
            { id: "rastreabilidade", label: "Rastreabilidade lote/etiqueta", auto: checks.traceabilityOk },
          ].map((d) => {
            const docs = form.billing_docs || {};
            const checked = docs[d.id] ?? d.auto;
            return (
              <div key={d.id} className="flex items-center justify-between border rounded-lg p-3 bg-slate-50">
                <div className="flex items-center gap-2">
                  <Checkbox id={`d_${d.id}`} checked={!!checked} onCheckedChange={(v) => updateForm("billing_docs", { ...docs, [d.id]: !!v })} />
                  <Label htmlFor={`d_${d.id}`} className="text-xs">{d.label}</Label>
                </div>
                {d.auto && <Badge variant="secondary" className="text-[9px]">Auto-detectado</Badge>}
              </div>
            );
          })}
        </section>
      )}

      {/* === TELA 7: EVIDÊNCIAS === */}
      {tab === "evidencias" && (
        <section className="bg-white rounded-xl border p-4 space-y-3">
          <h4 className="text-[10px] font-black uppercase text-primary tracking-widest">Evidências do caso ({evidences.length})</h4>
          {evidences.length === 0 && <p className="text-xs text-slate-400">Nenhuma evidência registrada ainda.</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead className="text-[9px] uppercase font-bold text-slate-500 border-b">
                <tr><th className="text-left py-2">Tipo</th><th className="text-left">Nome</th><th className="text-left">Origem</th><th className="text-left">Data</th><th className="text-left">Usuário</th><th></th></tr>
              </thead>
              <tbody>
                {evidences.map((ev, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-2">{ev.tipo}</td>
                    <td className="truncate max-w-[180px]">{ev.nome}</td>
                    <td>{ev.origem}</td>
                    <td>{fmtDate(ev.data)}</td>
                    <td>{ev.usuario || "—"}</td>
                    <td className="text-right">
                      <a href={ev.url} target="_blank" rel="noreferrer" className="text-primary underline text-[10px]">abrir</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* === TELA 8: HISTÓRICO === */}
      {tab === "log" && (
        <section className="bg-white rounded-xl border p-4 space-y-2">
          <h4 className="text-[10px] font-black uppercase text-primary tracking-widest">Histórico do caso ({history.length})</h4>
          {history.length === 0 && <p className="text-xs text-slate-400">Sem alterações registradas.</p>}
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {history.map((h: any) => (
              <div key={h.id} className="text-[10px] border-l-2 border-slate-200 pl-2 py-1">
                <p className="font-mono text-slate-400">{fmtDT(h.changed_at)} • {h.changed_by_name || "—"}</p>
                <p className="text-slate-700"><span className="font-bold uppercase">{h.action}</span>{h.field_changed ? ` · ${h.field_changed}` : ""}</p>
                {(h.old_value || h.new_value) && (
                  <p className="text-slate-500">de <span className="line-through">{h.old_value || "—"}</span> → <strong>{h.new_value || "—"}</strong></p>
                )}
                {h.reason && <p className="italic text-slate-500">Motivo: {h.reason}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* === TELA 9: VALIDAÇÃO SUS === */}
      {tab === "validacao" && (
        <section className="bg-white rounded-xl border p-4 space-y-2">
          <h4 className="text-[10px] font-black uppercase text-primary tracking-widest">Verificações automáticas</h4>
          {[
            { ok: !!form.procedure_sigtap_code, label: "Procedimento com SIGTAP definido" },
            { ok: used.length > 0, label: "OPME utilizada registrada" },
            { ok: !checks.procDivergent || !checks.procDivergentNoDesc, label: "Procedimento solicitado × faturado consistente" },
            { ok: form.billing_opme_compatibility === "sim", label: "OPME utilizada compatível com faturada", warn: form.billing_opme_compatibility === "parcial" },
            { ok: checks.traceabilityOk, label: "Rastreabilidade completa (lote + etiqueta)" },
            { ok: checks.docsOk, label: "Documentação obrigatória completa" },
            { ok: checks.auditPreOk, label: "Auditoria pré-OP aprovada" },
            { ok: checks.auditPosOk, label: "Auditoria pós-OP aprovada ou liberada" },
            { ok: checks.aihOk, label: "Número da AIH preenchido" },
            { ok: checks.cnesOk, label: "CNES da unidade informado" },
            { ok: checks.cidOk, label: "CID principal informado" },
          ].map((c, i) => (
            <div key={i} className={`flex items-center justify-between rounded-lg p-2 border ${c.ok ? "bg-emerald-50 border-emerald-200" : c.warn ? "bg-amber-50 border-amber-200" : "bg-rose-50 border-rose-200"}`}>
              <span className="text-xs">{c.label}</span>
              <span className={`text-[10px] font-bold uppercase ${c.ok ? "text-emerald-700" : c.warn ? "text-amber-700" : "text-rose-700"}`}>
                {c.ok ? "OK" : c.warn ? "Atenção" : "Pendente"}
              </span>
            </div>
          ))}
        </section>
      )}

      {/* === TELA 10: GLOSA === */}
      {tab === "glosa" && (
        <section className="bg-white rounded-xl border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] font-black uppercase text-primary tracking-widest">Risco de glosa</h4>
            <Badge variant={glosaRisk === "alto" ? "destructive" : glosaRisk === "medio" ? "secondary" : "default"} className="uppercase">
              {glosaRisk}
            </Badge>
          </div>
          {glosaReasons.length === 0 ? (
            <p className="text-xs text-emerald-700 font-medium">Nenhum motivo de glosa identificado.</p>
          ) : (
            <div className="space-y-1">
              {glosaReasons.map((r, i) => (
                <div key={i} className="text-[11px] border rounded p-2 bg-amber-50 border-amber-200">
                  <span className="text-[9px] font-bold uppercase text-amber-700">{r.tipo} · {r.etapa}</span>
                  <p className="text-amber-900">{r.motivo}</p>
                </div>
              ))}
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-[10px] font-bold uppercase text-slate-500">Observação do faturamento</Label>
            <Textarea value={form.billing_glosa_observations || ""} onChange={(e) => updateForm("billing_glosa_observations", e.target.value)} placeholder="Anotações sobre risco de glosa..." className="min-h-[80px] bg-white" />
          </div>
        </section>
      )}

      {/* === TELA 11: SAÍDA OPERACIONAL === */}
      {tab === "saida" && (
        <section className="bg-white rounded-xl border p-4 space-y-3">
          <h4 className="text-[10px] font-black uppercase text-primary tracking-widest">Saída operacional</h4>
          <p className="text-[11px] text-slate-500">Geração de etiquetas, checklist físico e dossiê digital completo. Disponível após Fechamento.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Button variant="outline" disabled={validationResult === "bloqueado"} onClick={() => window.dispatchEvent(new CustomEvent("opme:billing:print", { detail: { type: "labels", form } }))}>
              Gerar etiquetas
            </Button>
            <Button variant="outline" disabled={validationResult === "bloqueado"} onClick={() => window.dispatchEvent(new CustomEvent("opme:billing:print", { detail: { type: "checklist", form } }))}>
              Gerar checklist físico
            </Button>
            <Button variant="default" disabled={validationResult === "bloqueado"} onClick={() => window.dispatchEvent(new CustomEvent("opme:billing:print", { detail: { type: "dossier", form, evidences, history } }))}>
              Gerar dossiê digital
            </Button>
          </div>
          {validationResult === "bloqueado" && (
            <p className="text-[10px] text-rose-700">Resolva os bloqueios antes de gerar a saída operacional.</p>
          )}
        </section>
      )}

      {/* === TELA 12: FECHAMENTO === */}
      {tab === "fechamento" && (
        <section className="bg-white rounded-xl border p-4 space-y-4">
          <div>
            <h4 className="text-[10px] font-black uppercase text-primary tracking-widest mb-2">Status sugerido pelo sistema</h4>
            <div className={`rounded-lg p-3 border ${
              validationResult === "apto" ? "bg-emerald-50 border-emerald-200" :
              validationResult === "ressalva" ? "bg-amber-50 border-amber-200" :
              "bg-rose-50 border-rose-200"
            }`}>
              <p className="text-xs font-bold uppercase">
                {validationResult === "apto" ? "Apto para faturar" : validationResult === "ressalva" ? "Com ressalva" : "Bloqueado"}
              </p>
              <p className="text-[10px] text-slate-600 mt-1">Risco de glosa: {glosaRisk}</p>
              {blockers.length > 0 && (
                <ul className="text-[10px] text-rose-700 list-disc pl-4 mt-2">
                  {blockers.map((b, i) => <li key={i}>{b}</li>)}
                </ul>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase text-slate-500">Responsável pelo faturamento</Label>
              <Input value={form.billing_responsible_name || ""} onChange={(e) => updateForm("billing_responsible_name", e.target.value)} className="h-11 bg-white" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase text-slate-500">Data do faturamento</Label>
              <Input type="date" value={form.billing_closed_at ? String(form.billing_closed_at).slice(0, 10) : ""} onChange={(e) => updateForm("billing_closed_at", e.target.value ? new Date(e.target.value).toISOString() : null)} className="h-11 bg-white" />
            </div>
            <div className="md:col-span-2 space-y-1">
              <Label className="text-[10px] font-bold uppercase text-slate-500">Observações finais</Label>
              <Textarea value={form.billing_final_observations || ""} onChange={(e) => updateForm("billing_final_observations", e.target.value)} className="min-h-[80px] bg-white" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase text-slate-500">Status final</Label>
              <Select value={form.billing_final_status || ""} onValueChange={(v) => {
                if (v === "faturado" && validationResult === "bloqueado") return;
                updateForm("billing_final_status", v);
              }}>
                <SelectTrigger className="h-11 bg-white"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="faturado" disabled={validationResult === "bloqueado"}>Faturado</SelectItem>
                  <SelectItem value="com_ressalva">Com ressalva</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="bloqueado">Bloqueado</SelectItem>
                </SelectContent>
              </Select>
              {validationResult === "bloqueado" && <p className="text-[10px] text-rose-600">"Faturado" bloqueado: resolva pendências.</p>}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}