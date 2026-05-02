import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";

const FN_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/requisition-invite`;

type OpmeItem = {
  description?: string;
  quantity?: number;
  size_model?: string;
  sigtap?: string;
  unit_price?: number;
  observation?: string;
};

const SIDES = ["Direita", "Esquerda", "Bilateral", "Central", "N/A"];
const POSITIONS = ["Proximal", "Médio", "Distal", "Anterior", "Posterior"];
const ANATOMY_DATA: Record<string, string[]> = {
  "Cabeça/Pescoço": ["Crânio", "Face", "Pescoço", "Mandíbula", "Órbita"],
  "Tórax": ["Coração", "Pulmão", "Mama", "Arcabouço Costal", "Mediastino"],
  "Abdome": ["Parede Abdominal", "Fígado/Vias Biliares", "Rim/Ureter", "Intestino", "Estômago"],
  "Membro Superior": ["Ombro", "Braço", "Cotovelo", "Antebraço", "Punho", "Mão"],
  "Membro Inferior": ["Quadril", "Coxa", "Joelho", "Perna", "Tornozelo", "Pé"],
  "Coluna": ["Cervical", "Torácica", "Lombar", "Sacro-Coccígea"],
};

const fmtDate = (s?: string | null) => {
  if (!s) return "—";
  try { return new Date(s).toLocaleDateString("pt-BR"); } catch { return s as string; }
};
const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const norm = (s: string) => String(s || "").trim().toLowerCase();

async function callFn(token: string, body: any) {
  const r = await fetch(`${FN_URL}?token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error || "Falha");
  return j;
}

export default function PublicRequisitionPage() {
  const { token } = useParams<{ token: string }>();
  const [phase, setPhase] = useState<"loading" | "verify" | "form" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [inviteMeta, setInviteMeta] = useState<any>(null);

  // Verificação
  const [crmInput, setCrmInput] = useState("");
  const [verifying, setVerifying] = useState(false);

  // Dados após verificação
  const [data, setData] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedOk, setSubmittedOk] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);

  const [doctorName, setDoctorName] = useState("");
  const [doctorCrm, setDoctorCrm] = useState("");

  const [side, setSide] = useState("");
  const [region, setRegion] = useState("");
  const [segment, setSegment] = useState("");
  const [position, setPosition] = useState("");

  const [items, setItems] = useState<OpmeItem[]>([{ description: "", quantity: 1, size_model: "", sigtap: "", unit_price: 0, observation: "" }]);

  const [instSpec, setInstSpec] = useState(false);
  const [instLoan, setInstLoan] = useState(false);
  const [instNa, setInstNa] = useState(false);
  const [instSpecify, setInstSpecify] = useState("");

  const [indicacao, setIndicacao] = useState("");
  const [cidMain, setCidMain] = useState("");
  const [cidSec, setCidSec] = useState("");
  const [parecer, setParecer] = useState("");

  const [findings, setFindings] = useState("");
  const [validationResp, setValidationResp] = useState("");
  const [procedureTime, setProcedureTime] = useState("");

  // Autocompletes
  const [opmeSug, setOpmeSug] = useState<{ idx: number; items: any[] }>({ idx: -1, items: [] });
  const [cidSug, setCidSug] = useState<{ field: "main" | "sec" | null; items: any[] }>({ field: null, items: [] });
  const opmeTimer = useRef<any>(null);
  const cidTimer = useRef<any>(null);

  // GET inicial: só preview e meta
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${FN_URL}?token=${encodeURIComponent(token || "")}`);
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error || "Falha ao carregar");
        setPreview(j.preview || {});
        setInviteMeta(j.invite || {});
        setPhase("verify");
      } catch (e: any) {
        setError(e?.message || "Erro");
        setPhase("error");
      }
    })();
  }, [token]);

  const verify = async () => {
    if (!crmInput.trim()) { toast.error("Informe seu CRM"); return; }
    setVerifying(true);
    try {
      const j = await callFn(token || "", { action: "verify", doctor_crm: crmInput.trim() });
      setData(j);
      setDoctorCrm(crmInput.trim());
      // NÃO pré-preencher nome do médico — ele deve digitar
      setDoctorName("");
      const c = j.cadastro || {};
      const req = j.requisicao || {};
      setSide(req.procedure_side_requisicao || "");
      setRegion(req.procedure_region_requisicao || "");
      setSegment(req.procedure_segment_requisicao || "");
      setPosition(req.procedure_position_requisicao || "");
      setIndicacao(req.clinical_indication || c.clinical_indication || "");
      setCidMain(req.billing_cid_main || "");
      setCidSec(req.billing_cid_secondary || "");
      setParecer(req.auditor_pre_analysis || "");
      setInstSpec(!!req.instruments_specific);
      setInstLoan(!!req.instruments_loan);
      setInstNa(!!req.instruments_na);
      setInstSpecify(req.instruments_specify || "");
      setFindings(req.preop_finding_description || c.preop_finding_description || "");
      setValidationResp(req.preop_validation_responsible || c.preop_validation_responsible || "");
      if (Array.isArray(req.opme_requested) && req.opme_requested.length > 0) {
        setItems(req.opme_requested.map((it: any) => ({
          description: it.description || "",
          quantity: Number(it.quantity || 1),
          size_model: it.size_model || "",
          sigtap: it.sigtap || "",
          unit_price: Number(it.unit_price || 0),
          observation: it.observation || "",
        })));
      }
      setPhase("form");
    } catch (e: any) {
      toast.error(e?.message || "CRM inválido");
    } finally {
      setVerifying(false);
    }
  };

  const cadastro = data?.cadastro || {};
  const attachments: any[] = data?.attachments || [];
  const examPhotos: any[] = useMemo(() => {
    const arr = (cadastro.preop_exams_details as any[]) || (data?.preop_exams_details as any[]) || [];
    return Array.isArray(arr) ? arr.filter((x: any) => x?.url) : [];
  }, [cadastro, data]);
  const photos = useMemo(() => attachments.filter(a => (a.file_type || "").startsWith("image/")), [attachments]);
  const docs = useMemo(() => attachments.filter(a => !(a.file_type || "").startsWith("image/")), [attachments]);
  const totalOpme = useMemo(
    () => items.reduce((acc, it) => acc + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0),
    [items]
  );

  // Divergência de localização
  const locDivergent = useMemo(() => {
    if (phase !== "form") return null;
    const diffs: string[] = [];
    if (cadastro.procedure_side_cadastro && side && norm(cadastro.procedure_side_cadastro) !== norm(side)) diffs.push(`Lateralidade (cadastro: ${cadastro.procedure_side_cadastro})`);
    if (cadastro.procedure_region_cadastro && region && norm(cadastro.procedure_region_cadastro) !== norm(region)) diffs.push(`Região (cadastro: ${cadastro.procedure_region_cadastro})`);
    if (cadastro.procedure_segment_cadastro && segment && norm(cadastro.procedure_segment_cadastro) !== norm(segment)) diffs.push(`Segmento (cadastro: ${cadastro.procedure_segment_cadastro})`);
    if (cadastro.procedure_position_cadastro && position && norm(cadastro.procedure_position_cadastro) !== norm(position)) diffs.push(`Posição (cadastro: ${cadastro.procedure_position_cadastro})`);
    return diffs.length ? diffs : null;
  }, [cadastro, side, region, segment, position, phase]);

  const addItem = () => setItems(prev => [...prev, { description: "", quantity: 1, size_model: "", sigtap: "", unit_price: 0, observation: "" }]);
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));
  const updItem = (i: number, k: keyof OpmeItem, v: any) =>
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [k]: v } : it));

  const onOpmeDescChange = (i: number, v: string) => {
    updItem(i, "description", v);
    if (opmeTimer.current) clearTimeout(opmeTimer.current);
    if (v.trim().length < 2) { setOpmeSug({ idx: -1, items: [] }); return; }
    opmeTimer.current = setTimeout(async () => {
      try {
        const j = await callFn(token || "", { action: "search_opme", term: v.trim() });
        setOpmeSug({ idx: i, items: j.items || [] });
      } catch { /* ignore */ }
    }, 250);
  };

  const pickOpme = (i: number, sug: any) => {
    setItems(prev => prev.map((it, idx) => idx === i ? {
      ...it,
      description: sug.description,
      sigtap: sug.sigtap || it.sigtap || "",
      unit_price: Number(sug.unit_price) || it.unit_price || 0,
    } : it));
    setOpmeSug({ idx: -1, items: [] });
  };

  const onCidChange = (which: "main" | "sec", v: string) => {
    const up = v.toUpperCase();
    if (which === "main") setCidMain(up); else setCidSec(up);
    if (cidTimer.current) clearTimeout(cidTimer.current);
    if (up.trim().length < 2) { setCidSug({ field: null, items: [] }); return; }
    cidTimer.current = setTimeout(async () => {
      try {
        const j = await callFn(token || "", { action: "search_cid", term: up.trim() });
        setCidSug({ field: which, items: j.items || [] });
      } catch { /* ignore */ }
    }, 250);
  };

  const submit = async () => {
    if (!doctorName.trim() || !doctorCrm.trim()) {
      toast.error("Informe Nome e CRM do médico");
      return;
    }
    const cleanItems = items.filter(i => (i.description || "").trim());
    if (cleanItems.length === 0) {
      toast.error("Adicione ao menos um material/OPME");
      return;
    }
    setSubmitting(true);
    try {
      await callFn(token || "", {
        action: "submit",
        token,
        doctor_name: doctorName.trim(),
        doctor_crm: doctorCrm.trim(),
        payload: {
          procedure_side_requisicao: side,
          procedure_region_requisicao: region,
          procedure_segment_requisicao: segment,
          procedure_position_requisicao: position,
          opme_requested: cleanItems,
          instruments_specific: instSpec,
          instruments_loan: instLoan,
          instruments_na: instNa,
          instruments_specify: instSpecify,
          clinical_indication: indicacao,
          billing_cid_main: cidMain,
          billing_cid_secondary: cidSec,
          auditor_pre_analysis: parecer,
          preop_finding_description: findings,
          preop_validation_responsible: validationResp,
          request_date: new Date().toISOString().slice(0, 10),
          request_time: new Date().toTimeString().slice(0, 5),
        },
      });
      setSubmittedOk(true);
      toast.success("Requisição enviada");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao enviar");
    } finally {
      setSubmitting(false);
    }
  };

  if (phase === "loading") return <div className="min-h-screen flex items-center justify-center text-slate-500">Carregando…</div>;
  if (phase === "error") return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="max-w-md w-full"><CardContent className="p-6 text-center space-y-2">
        <h1 className="text-lg font-bold text-rose-700">Não foi possível abrir o link</h1>
        <p className="text-sm text-slate-600">{error}</p>
      </CardContent></Card>
    </div>
  );

  // ---------- TELA DE VERIFICAÇÃO DE CRM ----------
  if (phase === "verify") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <p className="text-[11px] font-bold uppercase tracking-widest text-teal-700">Requisição OPME</p>
            <CardTitle className="text-base">Acesso restrito ao médico solicitante</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-slate-50 border p-3 text-xs space-y-1">
              <p><span className="text-slate-500">Paciente:</span> <strong>{preview?.patient_name || "—"}</strong></p>
              <p><span className="text-slate-500">Unidade:</span> {preview?.facility_unit || "—"}</p>
              <p><span className="text-slate-500">Procedimento:</span> {preview?.procedure_name || "—"}</p>
              <p><span className="text-slate-500">Data prevista:</span> {fmtDate(preview?.procedure_date)}</p>
              <p className="text-[10px] text-slate-400 pt-1">Link válido até {fmtDate(inviteMeta?.expires_at)}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase text-slate-500">Informe seu CRM para acessar</Label>
              <Input
                autoFocus
                value={crmInput}
                onChange={e => setCrmInput(e.target.value)}
                placeholder="CRM/UF"
                onKeyDown={e => { if (e.key === "Enter") verify(); }}
              />
              <p className="text-[10px] text-slate-400">
                O CRM deve ser idêntico ao registrado no Cadastro do paciente. Após validar, você verá todos os exames, fotos e dados.
              </p>
            </div>
            <Button onClick={verify} disabled={verifying} className="w-full rounded-full">
              {verifying ? "Validando…" : "Acessar requisição"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---------- FORMULÁRIO COMPLETO ----------
  return (
    <div className="min-h-screen bg-slate-50 py-6 px-3 md:px-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <header className="text-center space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-widest text-teal-700">Requisição OPME</p>
          <h1 className="text-xl font-bold text-slate-900">{cadastro.patient_name || "Paciente"}</h1>
          <p className="text-xs text-slate-500">
            {cadastro.facility_unit} · Prontuário {cadastro.patient_record || "—"} · Nasc. {fmtDate(cadastro.patient_birthdate)}
          </p>
          <p className="text-[11px] text-slate-400">Link válido até {fmtDate(data?.invite?.expires_at)}</p>
        </header>

        {submittedOk && (
          <Card className="border-emerald-300 bg-emerald-50">
            <CardContent className="p-4 text-center text-sm text-emerald-800">
              Requisição enviada com sucesso. Você pode editar e reenviar dentro da validade do link.
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle className="text-sm">1. Identificação do Paciente</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            <Info label="Nome" value={cadastro.patient_name} />
            <Info label="Prontuário" value={cadastro.patient_record} />
            <Info label="Nascimento" value={fmtDate(cadastro.patient_birthdate)} />
            <Info label="Mãe" value={cadastro.patient_mother_name} />
            <Info label="Cartão SUS" value={cadastro.patient_sus} />
            <Info label="AIH" value={cadastro.billing_aih_number} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">2. Dados do Procedimento</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            <Info label="Data Prevista" value={fmtDate(cadastro.procedure_date)} />
            <Info label="Tipo" value={cadastro.procedure_type} />
            <Info label="Sala" value={cadastro.procedure_room} />
            <Info label="Procedimento" value={cadastro.procedure_name} />
            <Info label="SIGTAP" value={cadastro.procedure_sigtap_code} />
            <Info label="Solicitante (Cadastro)" value={cadastro.requester_name} />
            <Info label="CRM Solicitante" value={cadastro.requester_register} />
            <Info label="Segmento (Cadastro)" value={cadastro.procedure_segment_cadastro} />
            <Info label="Região (Cadastro)" value={cadastro.procedure_region_cadastro} />
            <Info label="Lado (Cadastro)" value={cadastro.procedure_side_cadastro} />
            <Info label="Posição (Cadastro)" value={cadastro.procedure_position_cadastro} />
          </CardContent>
        </Card>

        {(photos.length > 0 || docs.length > 0 || examPhotos.length > 0 || cadastro.billing_aih_file_url) && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Exames (Imagem, Laboratoriais, Risco Cirúrgico), Fotos e Documentos do Cadastro</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {cadastro.billing_aih_file_url && (
                <a href={cadastro.billing_aih_file_url} target="_blank" rel="noreferrer"
                   className="text-xs text-teal-700 underline">Ver AIH anexada</a>
              )}
              {examPhotos.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-500 mb-2">Exames Pré-Op — Imagem, Laboratoriais, Risco Cirúrgico ({examPhotos.length})</p>
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                    {examPhotos.map((p: any, i: number) => (
                      <button key={p.id || i} type="button" onClick={() => setZoom(p.url)} className="aspect-square rounded-md overflow-hidden border bg-white" title={`${p.type || "Exame"} • ${p.date || ""}`}>
                        <img src={p.url} alt={p.type || "Exame"} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {photos.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-500 mb-2">Fotos / Imagens ({photos.length})</p>
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                    {photos.map(p => (
                      <button key={p.id} type="button" onClick={() => setZoom(p.file_url)} className="aspect-square rounded-md overflow-hidden border bg-white" title={`${p.stage || ""} • ${p.category || ""} • ${p.file_name}`}>
                        <img src={p.file_url} alt={p.file_name} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {docs.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-500 mb-2">Documentos / Exames ({docs.length})</p>
                  <ul className="text-xs space-y-1">
                    {docs.map(d => (
                      <li key={d.id}>
                        <a href={d.file_url} target="_blank" rel="noreferrer" className="text-teal-700 underline">{d.file_name}</a>
                        {d.category && <span className="text-slate-400 ml-2">[{d.category}]</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 3. Identificação do Médico (NOME em branco — médico digita) */}
        <Card>
          <CardHeader><CardTitle className="text-sm">3. Identificação do Médico Responsável</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-slate-500">Nome do Médico</Label>
                <Input value={doctorName} onChange={e => setDoctorName(e.target.value)} placeholder="Nome completo" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-slate-500">CRM (validado)</Label>
                <Input value={doctorCrm} disabled />
              </div>
            </div>
            <p className="text-[10px] text-slate-400">O nome aqui informado será registrado como Médico Responsável pela Requisição.</p>
          </CardContent>
        </Card>

        {/* 4. Localização Cirúrgica */}
        <Card>
          <CardHeader><CardTitle className="text-sm">4. Localização Cirúrgica</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Field label="Lateralidade">
                <Select value={side} onValueChange={setSide}>
                  <SelectTrigger><SelectValue placeholder="Lado" /></SelectTrigger>
                  <SelectContent>
                    {SIDES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Região">
                <Select value={region} onValueChange={(v) => { setRegion(v); setSegment(""); }}>
                  <SelectTrigger><SelectValue placeholder="Região" /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(ANATOMY_DATA).map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Segmento">
                <Select value={segment} onValueChange={setSegment} disabled={!region}>
                  <SelectTrigger><SelectValue placeholder="Parte/Nível" /></SelectTrigger>
                  <SelectContent>
                    {region && (ANATOMY_DATA[region] || []).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Posição">
                <Select value={position} onValueChange={setPosition}>
                  <SelectTrigger><SelectValue placeholder="Posição" /></SelectTrigger>
                  <SelectContent>
                    {POSITIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            {locDivergent && locDivergent.length > 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                <p className="font-bold uppercase text-[10px] mb-1">⚠ Divergência detectada com o Cadastro</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {locDivergent.map((d, i) => <li key={i}>{d}</li>)}
                </ul>
                <p className="mt-1 text-[10px]">Confirme se os dados informados estão corretos antes de enviar.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 5. OPME Solicitada */}
        <Card>
          <CardHeader><CardTitle className="text-sm">5. OPME Solicitada</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {items.map((it, i) => (
              <div key={i} className="border rounded-lg p-3 space-y-2 bg-white">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-slate-500">Item #{String(i + 1).padStart(2, "0")}</span>
                  {items.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={() => removeItem(i)} className="h-6 text-xs text-rose-600">Remover</Button>
                  )}
                </div>
                <div className="space-y-1 relative">
                  <Label className="text-[10px] uppercase text-slate-500">Descrição / Especificação</Label>
                  <Input
                    value={it.description}
                    onChange={e => onOpmeDescChange(i, e.target.value)}
                    onBlur={() => setTimeout(() => setOpmeSug({ idx: -1, items: [] }), 200)}
                    placeholder="Digite ao menos 2 letras…"
                  />
                  {opmeSug.idx === i && opmeSug.items.length > 0 && (
                    <div className="absolute z-50 left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-[40vh] overflow-y-auto">
                      {opmeSug.items.map((s, k) => (
                        <button key={k} type="button"
                          onMouseDown={ev => ev.preventDefault()}
                          onClick={() => pickOpme(i, s)}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b last:border-0">
                          <p className="text-xs font-bold text-slate-800">{s.description}</p>
                          <p className="text-[10px] text-slate-500 flex justify-between">
                            <span>{s.sigtap ? `SIGTAP ${s.sigtap}` : (s.kind === "price" ? "Banco de preços" : "Catálogo")}</span>
                            <span>{brl(Number(s.unit_price) || 0)} {s.supplier ? `· ${s.supplier}` : ""}</span>
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <Field label="Qtd"><Input type="number" min={1} value={it.quantity ?? 1} onChange={e => updItem(i, "quantity", Number(e.target.value))} /></Field>
                  <Field label="Tam/Mod"><Input value={it.size_model || ""} onChange={e => updItem(i, "size_model", e.target.value)} placeholder="G/P/42" /></Field>
                  <Field label="SIGTAP"><Input value={it.sigtap || ""} onChange={e => updItem(i, "sigtap", e.target.value)} /></Field>
                  <Field label="Valor unit. (R$)"><Input type="number" step="0.01" min={0} value={it.unit_price ?? 0} onChange={e => updItem(i, "unit_price", Number(e.target.value))} /></Field>
                </div>
                <Field label="Observação"><Input value={it.observation || ""} onChange={e => updItem(i, "observation", e.target.value)} /></Field>
                <div className="text-right text-xs">
                  <span className="text-slate-400 mr-2">Subtotal</span>
                  <strong className="text-teal-700">{brl((Number(it.quantity) || 0) * (Number(it.unit_price) || 0))}</strong>
                </div>
              </div>
            ))}
            {items.length < 10 && (
              <Button variant="outline" onClick={addItem} className="w-full border-dashed">+ Adicionar Material</Button>
            )}
            <div className="flex items-center justify-between rounded-lg bg-teal-50 border border-teal-100 px-4 py-2">
              <span className="text-[10px] uppercase font-bold text-slate-500">Valor estimado da OPME</span>
              <span className="text-base font-black text-teal-700">{brl(totalOpme)}</span>
            </div>
          </CardContent>
        </Card>

        {/* 6. Instrumentais */}
        <Card>
          <CardHeader><CardTitle className="text-sm">6. Instrumentais / Acessórios</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-4 text-xs">
              <label className="flex items-center gap-2"><Checkbox checked={instSpec} onCheckedChange={v => setInstSpec(!!v)} /> Necessita instrumental específico</label>
              <label className="flex items-center gap-2"><Checkbox checked={instLoan} onCheckedChange={v => setInstLoan(!!v)} /> Necessita comodato</label>
              <label className="flex items-center gap-2"><Checkbox checked={instNa} onCheckedChange={v => setInstNa(!!v)} /> Não se aplica</label>
            </div>
            <Field label="Especificar instrumentais">
              <Textarea value={instSpecify} onChange={e => setInstSpecify(e.target.value)} rows={2} />
            </Field>
          </CardContent>
        </Card>

        {/* 7. Justificativa */}
        <Card>
          <CardHeader><CardTitle className="text-sm">7. Justificativa OPME</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Field label="Indicação Clínica / Evidência">
              <Textarea value={indicacao} onChange={e => setIndicacao(e.target.value)} rows={3} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 relative">
                <Label className="text-[10px] uppercase text-slate-500">CID Principal</Label>
                <Input
                  value={cidMain}
                  onChange={e => onCidChange("main", e.target.value)}
                  onBlur={() => setTimeout(() => setCidSug({ field: null, items: [] }), 200)}
                  placeholder="Ex: M17.1"
                />
                {cidSug.field === "main" && cidSug.items.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-[40vh] overflow-y-auto">
                    {cidSug.items.map((c: any) => (
                      <button key={c.codigo} type="button"
                        onMouseDown={ev => ev.preventDefault()}
                        onClick={() => { setCidMain(c.codigo); setCidSug({ field: null, items: [] }); }}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b last:border-0">
                        <p className="text-xs font-bold text-slate-800">{c.codigo}</p>
                        <p className="text-[10px] text-slate-500 uppercase">{c.descricao}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-1 relative">
                <Label className="text-[10px] uppercase text-slate-500">CID Secundário</Label>
                <Input
                  value={cidSec}
                  onChange={e => onCidChange("sec", e.target.value)}
                  onBlur={() => setTimeout(() => setCidSug({ field: null, items: [] }), 200)}
                  placeholder="Opcional"
                />
                {cidSug.field === "sec" && cidSug.items.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-[40vh] overflow-y-auto">
                    {cidSug.items.map((c: any) => (
                      <button key={c.codigo} type="button"
                        onMouseDown={ev => ev.preventDefault()}
                        onClick={() => { setCidSec(c.codigo); setCidSug({ field: null, items: [] }); }}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b last:border-0">
                        <p className="text-xs font-bold text-slate-800">{c.codigo}</p>
                        <p className="text-[10px] text-slate-500 uppercase">{c.descricao}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <Field label="Parecer da Comissão">
              <Select value={parecer} onValueChange={setParecer}>
                <SelectTrigger><SelectValue placeholder="Status da análise" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="adequada">Aprovado</SelectItem>
                  <SelectItem value="reprovada">Reprovado</SelectItem>
                  <SelectItem value="em_analise">Em Análise</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">8. Achados Pré-Operatórios</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Field label="Descrição dos Achados">
              <Textarea value={findings} onChange={e => setFindings(e.target.value)} rows={3} />
            </Field>
          </CardContent>
        </Card>

        <div className="flex justify-end pb-8">
          <Button onClick={submit} disabled={submitting} className="rounded-full">
            {submitting ? "Enviando…" : "Enviar Requisição"}
          </Button>
        </div>

        <Dialog open={!!zoom} onOpenChange={() => setZoom(null)}>
          <DialogContent className="max-w-3xl">
            {zoom && <img src={zoom} alt="" className="w-full h-auto rounded" />}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <Label className="text-[10px] uppercase text-slate-500">{label}</Label>
      <p className="text-xs font-medium text-slate-800 break-words">{value || "—"}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase text-slate-500">{label}</Label>
      {children}
    </div>
  );
}