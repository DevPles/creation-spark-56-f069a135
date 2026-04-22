import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const fmtBRL = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

export default function PriceBankPanel() {
  const { profile } = useAuth();
  const [history, setHistory] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [searchGoogle, setSearchGoogle] = useState("");
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("price_history").select("*").order("data_referencia", { ascending: false }).limit(500);
    setHistory(data || []);
  };

  useEffect(() => { load(); }, []);

  const filtered = history.filter(h => {
    if (!search) return true;
    const q = search.toLowerCase();
    return [h.descricao_produto, h.fornecedor_nome, h.categoria].filter(Boolean).join(" ").toLowerCase().includes(q);
  });

  const runGoogleSearch = async () => {
    if (!searchGoogle.trim() || !profile) return;
    setLoadingGoogle(true);
    try {
      const { data, error } = await supabase.functions.invoke("price-search", { body: { descricao: searchGoogle } });
      if (error) throw error;
      const results = data?.results || [];
      if (!results.length) { toast.warning("Nenhum preço encontrado"); return; }
      const rows = results.map((r: any) => ({
        descricao_produto: searchGoogle,
        valor_unitario: Number(r.preco) || 0,
        fornecedor_nome: r.fornecedor || "Indefinido",
        fonte_url: r.fonte_url || null,
        fonte: "google",
        created_by: profile.id,
      }));
      await supabase.from("price_history").insert(rows);
      toast.success(`${rows.length} preço(s) salvos no banco`);
      load();
    } catch (e: any) {
      toast.error(e.message || "Erro na busca");
    } finally { setLoadingGoogle(false); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Buscar preços de mercado</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input placeholder="Ex: Soro fisiológico 0,9% 500ml" value={searchGoogle} onChange={e => setSearchGoogle(e.target.value)} />
            <Button className="rounded-full" disabled={loadingGoogle} onClick={runGoogleSearch}>{loadingGoogle ? "Buscando..." : "Buscar no Google"}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de preços</CardTitle>
        </CardHeader>
        <CardContent>
          <Input placeholder="Filtrar por descrição, fornecedor ou categoria" value={search} onChange={e => setSearch(e.target.value)} className="mb-3 max-w-md" />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Un</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Fonte</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(h => (
                <TableRow key={h.id}>
                  <TableCell>{new Date(h.data_referencia).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell className="text-xs">{h.descricao_produto}</TableCell>
                  <TableCell>{h.fornecedor_nome || "—"}</TableCell>
                  <TableCell>{h.unidade_medida || "UN"}</TableCell>
                  <TableCell className="text-right">{fmtBRL(Number(h.valor_unitario))}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{h.fonte}</Badge>
                    {h.fonte_url && <a href={h.fonte_url} target="_blank" rel="noreferrer" className="ml-2 text-xs underline">link</a>}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum preço registrado</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}