import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Invite = {
  id: string;
  token: string;
  expires_at: string;
  last_filled_at: string | null;
  last_doctor_name: string | null;
  last_doctor_crm: string | null;
  fill_count: number;
};

const fmtDate = (s?: string | null) => {
  if (!s) return "—";
  try { return new Date(s).toLocaleDateString("pt-BR"); } catch { return s as string; }
};

export default function DoctorInviteBlock({ recordId }: { recordId: string | null }) {
  const [invite, setInvite] = useState<Invite | null>(null);
  const [loading, setLoading] = useState(false);

  const url = invite ? `${window.location.origin}/requisicao/${invite.token}` : "";

  const load = async () => {
    if (!recordId) return;
    const { data } = await supabase
      .from("opme_requisition_invites")
      .select("*")
      .eq("opme_request_id", recordId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      setInvite(data as any);
    } else {
      // Auto-gera o link assim que o paciente é cadastrado
      await generate(true);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [recordId]);

  const generate = async (silent = false) => {
    if (!recordId) {
      if (!silent) toast.error("Salve o cadastro do paciente antes de gerar o link");
      return;
    }
    setLoading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id;
      if (!uid) throw new Error("Faça login");
      const { data, error } = await supabase
        .from("opme_requisition_invites")
        .insert({ opme_request_id: recordId, created_by: uid })
        .select()
        .maybeSingle();
      if (error) throw error;
      setInvite(data as any);
      if (!silent) toast.success("Link gerado");
    } catch (e: any) {
      if (!silent) toast.error(e?.message || "Erro ao gerar link");
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); toast.success("Link copiado"); }
    catch { toast.error("Não foi possível copiar"); }
  };

  const wppMsg = encodeURIComponent(
    `Olá, doutor(a). Por favor, preencha a Requisição OPME deste paciente: ${url}`
  );

  return (
    <div className="rounded-xl border-2 border-teal-200 bg-teal-50 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-teal-700">
            Enviar para o médico
          </p>
          <p className="text-[11px] text-teal-700/90">
            Gere um link para o cirurgião preencher a requisição remotamente. Ele poderá ver
            todos os dados do cadastro, exames e fotos.
          </p>
        </div>
        {!invite && (
          <Button size="sm" onClick={() => generate(false)} disabled={loading || !recordId}
                  className="rounded-full">
            {loading ? "Gerando…" : "Gerar link"}
          </Button>
        )}
      </div>

      {invite && (
        <div className="space-y-2">
          <Input readOnly value={url} className="bg-white text-xs" onFocus={(e) => e.currentTarget.select()} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={copy} className="rounded-full">Copiar</Button>
            <a
              href={`https://wa.me/?text=${wppMsg}`}
              target="_blank" rel="noreferrer"
              className="inline-flex items-center px-3 h-8 rounded-full text-xs font-semibold border bg-white hover:bg-slate-50"
            >WhatsApp</a>
            <a
              href={`mailto:?subject=${encodeURIComponent("Requisição OPME")}&body=${encodeURIComponent(`Olá, doutor(a).\n\nPor favor, preencha a Requisição OPME deste paciente:\n${url}\n\nObrigado.`)}`}
              className="inline-flex items-center px-3 h-8 rounded-full text-xs font-semibold border bg-white hover:bg-slate-50"
            >E-mail</a>
            <Button size="sm" variant="ghost" onClick={() => generate(false)} className="rounded-full text-teal-700">
              Gerar novo
            </Button>
          </div>
          <p className="text-[10px] text-teal-700/80">
            Expira em {fmtDate(invite.expires_at)} · Reutilizável até a expiração
            {invite.last_filled_at ? ` · Último preenchimento: ${invite.last_doctor_name} (CRM ${invite.last_doctor_crm})` : ""}
          </p>
        </div>
      )}
    </div>
  );
}