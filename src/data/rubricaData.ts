/* Shared rubrica mock data used by ControleRubricaPage and EvidenciasPage */

export interface RubricaEntry {
  id: string;
  rubrica: string;
  contract: string;
  unit: string;
  percentAllocated: number;
  valorAllocated: number;
  valorExecuted: number;
  month: string;
}

export interface RubricaEstourada {
  rubrica: string;
  unit: string;
  contract: string;
  pctExec: number;
  allocated: number;
  executed: number;
  excedente: number;
}

export const CONTRACTS = [
  { id: "c1", name: "Contrato de Gestão — Hospital Geral", unit: "Hospital Geral", valorGlobal: 12000000, variable: 0.10 },
  { id: "c2", name: "Contrato de Gestão — UPA Norte", unit: "UPA Norte", valorGlobal: 4500000, variable: 0.08 },
  { id: "c3", name: "Contrato de Gestão — UBS Centro", unit: "UBS Centro", valorGlobal: 2800000, variable: 0.10 },
];

export const RUBRICA_NAMES = ["Recursos Humanos", "Insumos e Materiais", "Equipamentos", "Infraestrutura", "Metas Qualitativas", "Metas Quantitativas"];
export const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun"];

const generateEntries = (): RubricaEntry[] => {
  const entries: RubricaEntry[] = [];
  const allocations: Record<string, Record<string, number>> = {
    "c1": { "Recursos Humanos": 55, "Insumos e Materiais": 18, "Equipamentos": 8, "Infraestrutura": 4, "Metas Qualitativas": 5, "Metas Quantitativas": 10 },
    "c2": { "Recursos Humanos": 60, "Insumos e Materiais": 15, "Equipamentos": 7, "Infraestrutura": 3, "Metas Qualitativas": 5, "Metas Quantitativas": 10 },
    "c3": { "Recursos Humanos": 65, "Insumos e Materiais": 12, "Equipamentos": 5, "Infraestrutura": 3, "Metas Qualitativas": 5, "Metas Quantitativas": 10 },
  };

  CONTRACTS.forEach(c => {
    RUBRICA_NAMES.forEach(rub => {
      const pct = allocations[c.id]?.[rub] || 0;
      if (pct === 0) return;
      MONTHS.forEach((month) => {
        const allocated = c.valorGlobal * (pct / 100);
        // Seed some rubricas to be over budget for demo
        let executionRate: number;
        if ((rub === "Insumos e Materiais" && c.id === "c1") || (rub === "Equipamentos" && c.id === "c2")) {
          executionRate = 1.05 + Math.random() * 0.15; // 105-120%
        } else {
          executionRate = 0.7 + Math.random() * 0.25;
        }
        entries.push({
          id: `${c.id}-${rub}-${month}`,
          rubrica: rub,
          contract: c.name,
          unit: c.unit,
          percentAllocated: pct,
          valorAllocated: allocated,
          valorExecuted: allocated * Math.min(1.2, executionRate),
          month,
        });
      });
    });
  });
  return entries;
};

export const ALL_ENTRIES = generateEntries();

/** Returns rubricas where executed > allocated (estouradas) */
export const getEstouradasByUnit = (): RubricaEstourada[] => {
  const map: Record<string, { allocated: number; executed: number; unit: string; contract: string }> = {};
  ALL_ENTRIES.forEach(e => {
    const key = `${e.unit}|${e.rubrica}`;
    if (!map[key]) map[key] = { allocated: 0, executed: 0, unit: e.unit, contract: e.contract };
    map[key].allocated += e.valorAllocated;
    map[key].executed += e.valorExecuted;
  });
  return Object.entries(map)
    .filter(([, v]) => v.executed > v.allocated)
    .map(([key, v]) => {
      const [, rubrica] = key.split("|");
      return {
        rubrica,
        unit: v.unit,
        contract: v.contract,
        pctExec: Math.round((v.executed / v.allocated) * 100),
        allocated: v.allocated,
        executed: v.executed,
        excedente: v.executed - v.allocated,
      };
    });
};
