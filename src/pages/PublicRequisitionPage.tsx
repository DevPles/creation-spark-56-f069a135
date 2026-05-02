import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";

const FN_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/requisition-invite`;

type OpmeRequestedItem = {
  description?: string;
  quantity?: number;
  observation?: string;
};

const fmtDate = (s?: string | null) => {
  if (!s) return "—";
  try { return new Date(s).toLocaleDateString("pt-BR"); } catch { return s as string; }
};

export default function PublicRequisitionPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [submittedOk, setSubmittedOk] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);

  // Identificação do médico
  const [doctorName, setDoctorName] = useState("");
  const [doctorCrm, setDoctorCrm] = useState("");

  // Campos da requisição
  const [segmento, setSegmento] = useState("");
  const [regiao, setRegiao] = useState("");
  const [lado, setLado] = useState("");
  const [posicao, setPosicao] = useState("");
  const [indicacao, setIndicacao] = useState("");
  const [parecer, setParecer] = useState("");
  const [instSpec, setInstSpec] = useState(false);
  const [instLoan, setInstLoan] = useState(false);
  const [instNa, setInstNa] = useState(false);
  const [instSpecify, setInstSpecify] = useState("");
  const [items, setItems] = useState<OpmeRequestedItem[]>([{ description: "", quantity: 1, observation: "" }]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${FN_URL}?token=${encodeURIComponent(token || "")}`);
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Falha ao carregar");
        setData(j);
        const req = j.requisicao || {};
        setSegmento(req.procedure_segment_requisicao || j.cadastro?.procedure_segment_cadastro || "");
        setRegiao(req.procedure_region_requisicao || j.cadastro?.procedure_region_cadastro || "");
        setLado(req.procedure_side_requisicao || j.cadastro?.procedure_side_cadastro || "");
        setPosicao(req.procedure_position_requisicao || j.cadastro?.procedure_position_cadastro || "");
        setIndicacao(req.clinical_indication || j.cadastro?.clinical_indication || "");
        setParecer(req.committee_opinion || "");
        setInstSpec(!!req.instruments_specific);
        setInstLoan(!!req.instruments_loan);
        setInstNa(!!req.instruments_na);
        setInstSpecify(req.instruments_specify || "");
        if (Array.isArray(req.opme_requested) && req.opme_requested.length > 0) {
          setItems(req.opme_requested.map((it: any) => ({
            description: it.description || "",
            quantity: Number(it.quantity || 1),
            observation: it.observation || "",
          })));
        }
        setDoctorName(j.invite?.last_doctor_name || "");
        setDoctorCrm(j.invite?.last_doctor_crm || "");
      } catch (e: any) {
        setError(e?.message || "Erro");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const cadastro = data?.cadastro || {};
  const attachments: any[] = data?.attachments || [];

  const photos = useMemo(
    () => attachments.filter(a => (a.file_type || "").startsWith("image/")),
    [attachments]
  );
  const docs = useMemo(
    () => attachments.filter(a => !(a.file_type || "").startsWith("image/")),
    [attachments]
  );

  const addItem = () => setItems(prev => [...prev, { description: "", quantity: 1, observation: "" }]);
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));
  const updItem = (i: number, k: keyof OpmeRequestedItem, v: any) =>
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [k]: v } : it));

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
      const r = await fetch(FN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          doctor_name: doctorName.trim(),
          doctor_crm: doctorCrm.trim(),
          payload: {
            procedure_segment_requisicao: segmento,
            procedure_region_requisicao: regiao,
            procedure_side_requisicao: lado,
            procedure_position_requisicao: posicao,
            clinical_indication: indicacao,
            committee_opinion: parecer,
            instruments_specific: instSpec,
            instruments_loan: instLoan,
            instruments_na: instNa,
            instruments_specify: instSpecify,
            opme_requested: cleanItems,
            request_date: new Date().toISOString().slice(0, 10),
            request_time: new Date().toTimeString().slice(0, 5),
          },
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Falha ao enviar");
      setSubmittedOk(true);
      toast.success("Requisição enviada");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao enviar");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500">Carregando…</div>;
  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="max-w-md w-full"><CardContent className="p-6 text-center space-y-2">
        <h1 className="text-lg font-bold text-rose-700">Não foi possível abrir o link</h1>
        <p className="text-sm text-slate-600">{error}</p>
      </CardContent></Card>
    </div>
  );

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
              Requisição enviada com sucesso. Você pode editar e reenviar a qualquer momento dentro da validade do link.
            </CardContent>
          </Card>
        )}

        {/* Dados do Cadastro (read-only) */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Dados do Cadastro</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            <Info label="AIH" value={cadastro.billing_aih_number} />
            <Info label="Mãe" value={cadastro.patient_mother_name} />
            <Info label="Cartão SUS" value={cadastro.patient_sus} />
            <Info label="Procedimento" value={cadastro.procedure_name} />
            <Info label="SIGTAP" value={cadastro.procedure_sigtap_code} />
            <Info label="Tipo" value={cadastro.procedure_type} />
            <Info label="Sala" value={cadastro.procedure_room} />
            <Info label="Data Prevista" value={fmtDate(cadastro.procedure_date)} />
            <Info label="Solicitante" value={cadastro.requester_name} />
            <Info label="Segmento (Cadastro)" value={cadastro.procedure_segment_cadastro} />
            <Info label="Região (Cadastro)" value={cadastro.procedure_region_cadastro} />
            <Info label="Lado (Cadastro)" value={cadastro.procedure_side_cadastro} />
            {cadastro.preop_finding_description && (
              <div className="col-span-2 md:col-span-3">
                <Label className="text-[10px] uppercase text-slate-500">Achado pré-op</Label>
                <p className="text-xs text-slate-800 whitespace-pre-wrap">{cadastro.preop_finding_description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Anexos */}
        {(photos.length > 0 || docs.length > 0 || cadastro.billing_aih_file_url) && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Exames, Fotos e Documentos</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {cadastro.billing_aih_file_url && (
                <a href={cadastro.billing_aih_file_url} target="_blank" rel="noreferrer"
                   className="text-xs text-teal-700 underline">Ver AIH anexada</a>
              )}
              {photos.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-500 mb-2">Fotos</p>
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                    {photos.map(p => (
                      <button key={p.id} type="button" onClick={() => setZoom(p.file_url)} className="aspect-square rounded-md overflow-hidden border bg-white">
                        <img src={p.file_url} alt={p.file_name} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {docs.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-500 mb-2">Documentos</p>
                  <ul className="text-xs space-y-1">
                    {docs.map(d => (
                      <li key={d.id}>
                        <a href={d.file_url} target="_blank" rel="noreferrer" className="text-teal-700 underline">{d.file_name}</a>
                        {d.stage && <span className="text-slate-400 ml-2">[{d.stage}]</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Identificação do médico */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Identificação do Médico</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase text-slate-500">Nome do Médico</Label>
              <Input value={doctorName} onChange={e => setDoctorName(e.target.value)} placeholder="Nome completo" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase text-slate-500">CRM</Label>
              <Input value={doctorCrm} onChange={e => setDoctorCrm(e.target.value)} placeholder="CRM/UF" />
            </div>
          </CardContent>
        </Card>

        {/* Requisição (preenchimento) */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Dados da Requisição</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-slate-500">Segmento</Label>
                <Input value={segmento} onChange={e => setSegmento(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-slate-500">Região</Label>
                <Input value={regiao} onChange={e => setRegiao(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-slate-500">Lado</Label>
                <Input value={lado} onChange={e => setLado(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-slate-500">Posição</Label>
                <Input value={posicao} onChange={e => setPosicao(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] uppercase text-slate-500">Indicação Clínica</Label>
              <Textarea value={indicacao} onChange={e => setIndicacao(e.target.value)} rows={3} />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase text-slate-500">Parecer / Comitê</Label>
              <Textarea value={parecer} onChange={e => setParecer(e.target.value)} rows={2} />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] uppercase text-slate-500">Instrumentais</Label>
              <div className="flex flex-wrap gap-4 text-xs">
                <label className="flex items-center gap-2"><Checkbox checked={instSpec} onCheckedChange={v => setInstSpec(!!v)} /> Específicos</label>
                <label className="flex items-center gap-2"><Checkbox checked={instLoan} onCheckedChange={v => setInstLoan(!!v)} /> Em comodato</label>
                <label className="flex items-center gap-2"><Checkbox checked={instNa} onCheckedChange={v => setInstNa(!!v)} /> Não se aplica</label>
              </div>
              <Input value={instSpecify} onChange={e => setInstSpecify(e.target.value)} placeholder="Especificar instrumentais" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] uppercase text-slate-500">Materiais OPME Solicitados</Label>
                <Button type="button" size="sm" variant="outline" onClick={addItem}>+ Adicionar item</Button>
              </div>
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-start">
                  <Input className="col-span-7" placeholder="Descrição do material"
                         value={it.description} onChange={e => updItem(i, "description", e.target.value)} />
                  <Input className="col-span-2" type="number" min={1} placeholder="Qtd"
                         value={it.quantity ?? 1} onChange={e => updItem(i, "quantity", Number(e.target.value))} />
                  <Input className="col-span-2" placeholder="Obs."
                         value={it.observation || ""} onChange={e => updItem(i, "observation", e.target.value)} />
                  <Button className="col-span-1" type="button" variant="ghost" size="sm" onClick={() => removeItem(i)}>×</Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
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