/**
 * Shared utility to compute rubrica budget consumption.
 * Used by both Controle de Rubricas (lançamentos) and the new Painel de Compras
 * to guarantee that both surfaces show identical numbers and color thresholds.
 *
 * Sources of truth:
 *  - Orçamento da rubrica = contracts.value × (rubrica.percent / 100)
 *  - Lançado            = sum(rubrica_entries.value_executed)  (filtered by period/unit)
 *  - Comprometido em OCs = sum(purchase_orders.valor_total) WHERE status IN
 *    ('autorizada','enviada','recebida') AND contract_id+rubrica_id match
 *  - Total executado    = lançado + comprometido em OCs
 *  - % consumido        = (total executado / orçamento) × 100
 */

export type ConsumptionStatus = "ok" | "warning" | "critical" | "over";

export interface RubricaConsumption {
  contractId: string;
  contractName: string;
  unit: string;
  rubricaId: string;
  rubricaName: string;
  percent: number;
  budget: number;
  spentEntries: number; // from rubrica_entries
  spentOrders: number;  // from purchase_orders (autorizada/enviada/recebida)
  totalSpent: number;
  remaining: number;
  pct: number;          // 0-100+ (can exceed 100 when over budget)
  status: ConsumptionStatus;
}

const ORDER_COMMITTED_STATUSES = new Set(["autorizada", "enviada", "recebida"]);

/**
 * Parse a period string in 'dd/MM/yyyy' or 'yyyy-MM-dd' form into {year, month0}.
 * Returns null if it cannot be parsed.
 */
export function parsePeriod(period?: string | null): { year: number; month0: number } | null {
  if (!period) return null;
  if (period.includes("/")) {
    const [d, m, y] = period.split("/");
    const year = parseInt(y, 10);
    const month0 = parseInt(m, 10) - 1;
    if (Number.isNaN(year) || Number.isNaN(month0)) return null;
    return { year, month0 };
  }
  if (period.includes("-")) {
    const [y, m] = period.split("-");
    const year = parseInt(y, 10);
    const month0 = parseInt(m, 10) - 1;
    if (Number.isNaN(year) || Number.isNaN(month0)) return null;
    return { year, month0 };
  }
  return null;
}

export interface PeriodFilter {
  /** Year (number) or 'all'. */
  year?: number | "all";
  /** Zero-based month or 'all'. */
  month0?: number | "all";
}

export function matchesPeriod(period: string | null | undefined, filter: PeriodFilter): boolean {
  if (!filter || (filter.year === "all" && filter.month0 === "all")) return true;
  const p = parsePeriod(period);
  if (!p) return false;
  if (filter.year !== undefined && filter.year !== "all" && p.year !== filter.year) return false;
  if (filter.month0 !== undefined && filter.month0 !== "all" && p.month0 !== filter.month0) return false;
  return true;
}

export interface ComputeRubricaConsumptionInput {
  contracts: Array<{
    id: string;
    name?: string;
    unit: string;
    value: number;
    rubricas?: Array<{ id?: string; name: string; percent: number }> | unknown;
  }>;
  rubricaEntries: Array<{
    contract_id: string;
    rubrica_name: string;
    value_executed: number | string;
    period?: string;
    facility_unit?: string;
  }>;
  purchaseOrders: Array<{
    contract_id?: string | null;
    rubrica_id?: string | null;
    rubrica_name?: string | null;
    valor_total?: number | string | null;
    status?: string | null;
    facility_unit?: string | null;
  }>;
  /** Filter by unit (contracts.unit / facility_unit). 'all' or undefined = no filter. */
  unit?: string | "all";
  /** Filter rubrica_entries by period. Orders are not period-filtered (commitments are cumulative). */
  period?: PeriodFilter;
}

/**
 * Returns thresholded status for a percentage of consumption.
 * Mirrors the Controle de Rubricas color logic:
 *   <60%  → ok       (verde)
 *   60-80 → warning  (amarelo)
 *   80-100 → critical (vermelho atenção)
 *   >100  → over     (estourada)
 */
export function statusFromPct(pct: number): ConsumptionStatus {
  if (pct > 100) return "over";
  if (pct >= 80) return "critical";
  if (pct >= 60) return "warning";
  return "ok";
}

export function statusColorClasses(status: ConsumptionStatus): {
  bar: string;
  text: string;
  badge: string;
} {
  switch (status) {
    case "over":
      return { bar: "bg-destructive", text: "text-destructive", badge: "bg-destructive/10 text-destructive border-destructive/30" };
    case "critical":
      return { bar: "bg-destructive/80", text: "text-destructive", badge: "bg-destructive/10 text-destructive border-destructive/30" };
    case "warning":
      return { bar: "bg-amber-500", text: "text-amber-600", badge: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400" };
    case "ok":
    default:
      return { bar: "bg-emerald-500", text: "text-emerald-600", badge: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400" };
  }
}

export function computeRubricaConsumption(input: ComputeRubricaConsumptionInput): RubricaConsumption[] {
  const { contracts, rubricaEntries, purchaseOrders, unit, period } = input;

  const filteredContracts = !unit || unit === "all"
    ? contracts
    : contracts.filter(c => c.unit === unit);

  const out: RubricaConsumption[] = [];

  filteredContracts.forEach(contract => {
    const rubricas = Array.isArray(contract.rubricas)
      ? (contract.rubricas as Array<{ id?: string; name: string; percent: number }>)
      : [];

    rubricas.forEach(r => {
      if (!r?.name || !(r.percent > 0)) return;
      const budget = (Number(contract.value) || 0) * (Number(r.percent) || 0) / 100;

      const spentEntries = rubricaEntries
        .filter(e =>
          e.contract_id === contract.id &&
          e.rubrica_name === r.name &&
          (!unit || unit === "all" || (e.facility_unit ?? contract.unit) === unit) &&
          matchesPeriod(e.period, period || {})
        )
        .reduce((s, e) => s + Number(e.value_executed || 0), 0);

      const rubricaIdStr = r.id ?? r.name;
      const spentOrders = purchaseOrders
        .filter(o =>
          o.contract_id === contract.id &&
          ORDER_COMMITTED_STATUSES.has(String(o.status || "")) &&
          (
            (o.rubrica_id && String(o.rubrica_id) === String(rubricaIdStr)) ||
            (!o.rubrica_id && o.rubrica_name === r.name)
          )
        )
        .reduce((s, o) => s + Number(o.valor_total || 0), 0);

      const totalSpent = spentEntries + spentOrders;
      const remaining = Math.max(budget - totalSpent, 0);
      const pct = budget > 0 ? (totalSpent / budget) * 100 : 0;

      out.push({
        contractId: contract.id,
        contractName: contract.name || contract.unit,
        unit: contract.unit,
        rubricaId: rubricaIdStr,
        rubricaName: r.name,
        percent: Number(r.percent) || 0,
        budget,
        spentEntries,
        spentOrders,
        totalSpent,
        remaining,
        pct,
        status: statusFromPct(pct),
      });
    });
  });

  return out.sort((a, b) => b.pct - a.pct);
}

export const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);