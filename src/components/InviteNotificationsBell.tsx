import { useEffect, useState, useCallback } from "react";
import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type InviteResponse = {
  id: string;
  fornecedor_nome: string;
  submitted_at: string;
  requisition_id: string;
  requisition_numero?: string;
};

const STORAGE_KEY = "invite-notifications-seen";

const getSeenIds = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
};

const InviteNotificationsBell = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [responses, setResponses] = useState<InviteResponse[]>([]);
  const [seenIds, setSeenIds] = useState<string[]>(getSeenIds());

  const load = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("quotation_invites")
      .select("id, fornecedor_nome, submitted_at, requisition_id")
      .not("submitted_at", "is", null)
      .order("submitted_at", { ascending: false })
      .limit(20);
    const list = (data || []) as InviteResponse[];
    if (list.length === 0) {
      setResponses([]);
      return;
    }
    const reqIds = Array.from(new Set(list.map((i) => i.requisition_id)));
    const { data: reqs } = await supabase
      .from("purchase_requisitions")
      .select("id, numero")
      .in("id", reqIds);
    const numeroById: Record<string, string> = {};
    (reqs || []).forEach((r: any) => { numeroById[r.id] = r.numero; });
    setResponses(list.map((r) => ({ ...r, requisition_numero: numeroById[r.requisition_id] })));
  }, []);

  useEffect(() => {
    load();
    const channel = (supabase as any)
      .channel("invite-notifications")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "quotation_invites" },
        () => load(),
      )
      .subscribe();
    const interval = setInterval(load, 60000);
    return () => {
      clearInterval(interval);
      (supabase as any).removeChannel(channel);
    };
  }, [load]);

  const unseenCount = responses.filter((r) => !seenIds.includes(r.id)).length;

  const markAllSeen = () => {
    const ids = responses.map((r) => r.id);
    const merged = Array.from(new Set([...seenIds, ...ids])).slice(-200);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    setSeenIds(merged);
  };

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (v) setTimeout(markAllSeen, 800);
  };

  const handleClick = (req_id: string) => {
    setOpen(false);
    navigate(`/compras?req=${req_id}`);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          aria-label="Notificações de convites"
          className="relative w-8 h-8 rounded-full bg-primary-foreground/20 hover:bg-primary-foreground/30 flex items-center justify-center text-primary-foreground transition-colors shrink-0"
        >
          <Bell className="w-4 h-4" />
          {unseenCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {unseenCount > 9 ? "9+" : unseenCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="px-3 py-2 border-b border-border flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Respostas de convites</p>
          {responses.length > 0 && (
            <span className="text-xs text-muted-foreground">{responses.length}</span>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {responses.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Nenhuma resposta de convite ainda.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {responses.map((r) => {
                const isNew = !seenIds.includes(r.id);
                return (
                  <li key={r.id}>
                    <button
                      onClick={() => handleClick(r.requisition_id)}
                      className="w-full text-left px-3 py-2.5 hover:bg-muted/60 transition-colors"
                    >
                      <div className="flex items-start gap-2">
                        {isNew && (
                          <span className="mt-1.5 w-2 h-2 rounded-full bg-primary shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {r.fornecedor_nome}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            Respondeu {r.requisition_numero ? `RC ${r.requisition_numero}` : "convite"}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {formatDistanceToNow(new Date(r.submitted_at), { addSuffix: true, locale: ptBR })}
                          </p>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default InviteNotificationsBell;