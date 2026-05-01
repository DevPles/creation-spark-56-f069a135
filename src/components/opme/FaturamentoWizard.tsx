import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, ChevronDown, ChevronUp, AlertCircle, CheckCircle2 } from "lucide-react";
import { useState } from "react";

interface FaturamentoWizardProps {
  step: number;
  form: any;
  updateForm: (field: string, value: any) => void;
  user: any;
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

export default function FaturamentoWizard({ step, form, updateForm, user }: FaturamentoWizardProps) {
  // ====== TELA 1 — RESUMO DO CASO ======
  if (step === 1) {
    const cadastroOk = !!(form.patient_name && form.patient_record && form.facility_unit);
    const procedimentoOk = !!(form.procedure_name && form.procedure_sigtap_code && form.procedure_date);
    const aihOk = !!(form.billing_aih_number && form.billing_aih_file_url);
    return (
      <div className="space-y-3">
        <div className="bg-sky-50 border border-sky-100 rounded-lg p-3 text-[10px] font-medium uppercase tracking-wide text-sky-700">
          Tela 1 de 5 — Conferência. Dados vêm automáticos das etapas anteriores. Para alterar, edite a etapa de origem.
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
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-slate-500">Tipo de AIH</Label>
              <Select value={form.billing_aih_type || ""} onValueChange={v => updateForm("billing_aih_type", v)}>
                <SelectTrigger className="h-12 bg-white"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="inicial">Inicial</SelectItem>
                  <SelectItem value="continuidade">Continuidade</SelectItem>
                  <SelectItem value="longa_permanencia">Longa Permanência</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-slate-500">Data Internação</Label>
              <Input type="date" value={form.billing_admission_date || ""} onChange={e => updateForm("billing_admission_date", e.target.value)} className="h-12 bg-white" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-slate-500">Data Alta</Label>
              <Input type="date" value={form.billing_discharge_date || ""} onChange={e => updateForm("billing_discharge_date", e.target.value)} className="h-12 bg-white" />
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
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-slate-500">CID Principal</Label>
              <Input value={form.billing_cid_main || ""} onChange={e => updateForm("billing_cid_main", e.target.value)} placeholder="Ex: M17.1" className="h-12 bg-white" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-slate-500">CID Secundário</Label>
              <Input value={form.billing_cid_secondary || ""} onChange={e => updateForm("billing_cid_secondary", e.target.value)} placeholder="Opcional" className="h-12 bg-white" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-slate-500">CNES da Unidade</Label>
              <Input value={form.billing_cnes || ""} onChange={e => updateForm("billing_cnes", e.target.value)} placeholder="0000000" className="h-12 bg-white" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-slate-500">Caráter de Atendimento</Label>
              <Select value={form.billing_attendance_character || ""} onValueChange={v => updateForm("billing_attendance_character", v)}>
                <SelectTrigger className="h-12 bg-white"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="eletivo">Eletivo</SelectItem>
                  <SelectItem value="urgencia">Urgência</SelectItem>
                  <SelectItem value="emergencia">Emergência</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
    const hasTracking = used.some((u: any) => u?.lot || u?.label_url);
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
                  <div className="font-bold text-slate-800">{m.description || "—"}</div>
                  <div className="text-slate-500 mt-1">Qtd: {m.quantity || 0} • SIGTAP: {m.sigtap_code || "—"} • Modelo: {m.size || "—"}</div>
                </div>
              ))}
            </div>
          )}
        </Accordion>

        <Accordion title={`Utilizado em Cirurgia (${used.length})`} defaultOpen status={used.length ? "ok" : "pending"}>
          {used.length === 0 ? (
            <p className="text-xs text-rose-600 italic">Nenhum material registrado no Consumo Cirúrgico.</p>
          ) : (
            <div className="space-y-2">
              {used.map((m: any, i: number) => (
                <div key={i} className="bg-white border border-slate-200 rounded-md p-3 text-xs">
                  <div className="font-bold text-slate-800">{m.description || "—"}</div>
                  <div className="text-slate-500 mt-1">Qtd: {m.quantity || 0} • Lote: {m.lot || <span className="text-rose-600">faltando</span>} • Etiqueta: {m.label_url ? <a href={m.label_url} target="_blank" rel="noreferrer" className="text-sky-600 underline">ver</a> : <span className="text-rose-600">faltando</span>}</div>
                </div>
              ))}
            </div>
          )}
        </Accordion>

        <Accordion title={`Devolvido (${returned.length})`} status={null}>
          {returned.length === 0 ? (
            <p className="text-xs text-slate-500 italic">Nenhum material devolvido.</p>
          ) : (
            <div className="space-y-2">
              {returned.map((m: any, i: number) => (
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
            {!hasTracking && used.length > 0 && (
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
              <Label className="text-xs font-semibold uppercase text-slate-500">Nível de Risco</Label>
              <Select value={form.billing_glosa_risk || ""} onValueChange={v => updateForm("billing_glosa_risk", v)}>
                <SelectTrigger className="h-12 bg-white"><SelectValue placeholder="Avalie o risco" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixo">Baixo</SelectItem>
                  <SelectItem value="medio">Médio</SelectItem>
                  <SelectItem value="alto">Alto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-slate-500">Observações sobre Glosa</Label>
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

    return (
      <div className="space-y-3">
        <div className="bg-sky-50 border border-sky-100 rounded-lg p-3 text-[10px] font-medium uppercase tracking-wide text-sky-700">
          Tela 5 de 5 — Status final, responsável e geração do dossiê.
        </div>

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

        <Accordion title="Dossiê do Caso" status={form.billing_dossier_url ? "ok" : null}>
          {form.billing_dossier_url ? (
            <Button variant="outline" className="w-full h-12 text-xs font-bold uppercase border-emerald-100 bg-emerald-50 text-emerald-700 flex gap-2" onClick={() => window.open(form.billing_dossier_url, "_blank")}>
              <FileText size={16} /> Ver Dossiê PDF
            </Button>
          ) : (
            <p className="text-xs text-slate-500 italic">O dossiê PDF será gerado automaticamente após o fechamento com status "Faturado" ou "Ressalva".</p>
          )}
        </Accordion>
      </div>
    );
  }

  return null;
}