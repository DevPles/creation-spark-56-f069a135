import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

const ACTION_LABELS: Record<string, string> = {
  created: "Criação",
  field_changed: "Alteração de campo",
  status_changed: "Mudança de status",
  attachment_added: "Anexo adicionado",
  attachment_removed: "Anexo removido",
  signed: "Assinatura",
};

const FIELD_LABELS: Record<string, string> = {
  status: "Status",
  patient_name: "Nome do paciente",
  procedure_name: "Procedimento",
  auditor_pre_opinion: "Parecer auditor pré",
  auditor_post_final_opinion: "Parecer final auditor pós",
  facility_unit: "Unidade",
  cme_processing_date: "CME — Data de processamento",
  cme_responsible: "CME — Responsável",
  surgery_dispatch_date: "Centro Cirúrgico — Data de dispensação",
  surgery_dispatch_responsible: "Centro Cirúrgico — Responsável dispensação",
};

interface Props {
  opmeRequestId: string | null;
}

export default function OpmeHistoryTab({ opmeRequestId }: Props) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!opmeRequestId) return;
    setLoading(true);
    supabase
      .from("opme_history")
      .select("*")
      .eq("opme_request_id", opmeRequestId)
      .order("changed_at", { ascending: false })
      .then(({ data }) => {
        setHistory(data || []);
        setLoading(false);
      });
  }, [opmeRequestId]);

  if (!opmeRequestId) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          A trilha de auditoria estará disponível após salvar a solicitação.
        </CardContent>
      </Card>
    );
  }

  if (loading) return <p className="text-center text-sm text-muted-foreground py-6">Carregando histórico...</p>;
  if (history.length === 0) return <p className="text-center text-sm text-muted-foreground py-6">Nenhuma alteração registrada.</p>;

  return (
    <div className="space-y-2">
      {history.map(h => (
        <Card key={h.id}>
          <CardContent className="py-3">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">{ACTION_LABELS[h.action] || h.action}</Badge>
                  {h.field_changed && (
                    <Badge variant="secondary" className="text-xs">
                      {FIELD_LABELS[h.field_changed] || h.field_changed}
                    </Badge>
                  )}
                </div>
                {(h.old_value || h.new_value) && (
                  <div className="text-sm mt-2 space-y-0.5">
                    {h.old_value && (
                      <div><span className="text-muted-foreground">De:</span> <span className="line-through">{h.old_value}</span></div>
                    )}
                    {h.new_value && (
                      <div><span className="text-muted-foreground">Para:</span> <strong>{h.new_value}</strong></div>
                    )}
                  </div>
                )}
                {h.reason && <p className="text-xs text-muted-foreground mt-1">Motivo: {h.reason}</p>}
                <p className="text-xs text-muted-foreground mt-2">
                  {h.changed_by_name || "—"}
                  {h.signature_register && ` (${h.signature_register})`}
                  {" • "}
                  {new Date(h.changed_at).toLocaleString("pt-BR")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
