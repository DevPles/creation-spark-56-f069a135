// Helpers para cálculo de valor de OPME a partir do banco de preços e do catálogo.

export interface OpmeItemLike {
  description?: string;
  quantity?: number | string;
  unit_price?: number | string | null;
  product_id?: string | null;
  product_code?: string | null;
}

export const toNumber = (v: any): number => {
  const n = typeof v === "string" ? parseFloat(v.replace(",", ".")) : Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const itemSubtotal = (item: OpmeItemLike): number =>
  toNumber(item.quantity) * toNumber(item.unit_price);

export const sumOpme = (items: OpmeItemLike[] | undefined | null): number =>
  (items || []).reduce((acc, it) => acc + itemSubtotal(it), 0);

export const formatBRL = (v: number): string =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
