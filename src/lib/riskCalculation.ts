/**
 * Scoring rule: defines the glosa (penalty) percentage for a given attainment range.
 * - min: minimum attainment % to qualify for this tier (inclusive)
 * - label: display name for the tier
 * - glosa: percentage of glosa (penalty) applied at this tier (0 = no penalty, 100 = full penalty)
 */
export interface ScoringRule {
  min: number;
  label: string;
  glosa: number;
}

/**
 * Legacy scoring rule format (points-based). Used for backward compatibility.
 */
interface LegacyScoringRule {
  min: number;
  label: string;
  points: number;
}

/**
 * Normalize scoring rules from DB (may be legacy format with `points` or new format with `glosa`).
 */
export function normalizeScoringRules(raw: any[]): ScoringRule[] {
  if (!raw || raw.length === 0) return getDefaultScoringRules();

  // Check if it's the new format (has `glosa` field)
  if (typeof raw[0].glosa === "number") {
    return raw as ScoringRule[];
  }

  // Legacy format: convert points (0-1 scale) to glosa %
  // points=1 means full achievement = 0% glosa, points=0 means no achievement = 100% glosa
  return (raw as LegacyScoringRule[]).map(r => ({
    min: r.min,
    label: r.label,
    glosa: Math.round((1 - r.points) * 100),
  }));
}

export function getDefaultScoringRules(): ScoringRule[] {
  return [
    { min: 100, label: "Máximo", glosa: 0 },
    { min: 90, label: "Parcial alto", glosa: 25 },
    { min: 70, label: "Parcial baixo", glosa: 50 },
    { min: 0, label: "Insuficiente", glosa: 100 },
  ];
}

export function getFixedScoringRules(): ScoringRule[] {
  return [
    { min: 100, label: "Atingida", glosa: 0 },
    { min: 0, label: "Não atingida", glosa: 100 },
  ];
}

/**
 * Find the glosa percentage for a given attainment using scoring rules.
 * Rules must be sorted descending by `min`.
 * @param attainmentPct - attainment as percentage (0-100)
 * @param rules - scoring rules (will be normalized)
 * @returns glosa percentage (0-100)
 */
export function findGlosaPct(attainmentPct: number, rules: ScoringRule[]): number {
  // Sort descending by min
  const sorted = [...rules].sort((a, b) => b.min - a.min);
  for (const rule of sorted) {
    if (attainmentPct >= rule.min) {
      return rule.glosa;
    }
  }
  // If no rule matched (shouldn't happen with min=0), return 100%
  return 100;
}

/**
 * Calculate financial risk for a goal based on contract value, variable %, weight, and scoring tiers.
 * @param attainmentPct - current attainment percentage (0-100)
 * @param contractValue - total contract value in R$
 * @param variablePct - variable portion as decimal (e.g., 0.30 for 30%)
 * @param weight - goal weight as decimal (e.g., 0.15 for 15%)
 * @param scoringRules - the scoring tiers
 * @returns risk value in R$
 */
export function calculateGoalRisk(
  attainmentPct: number,
  contractValue: number,
  variablePct: number,
  weight: number,
  scoringRules: ScoringRule[]
): number {
  if (attainmentPct >= 100) return 0;

  const glosaPct = findGlosaPct(attainmentPct, scoringRules);
  if (glosaPct === 0) return 0;

  const variableAmount = contractValue * variablePct;
  const goalValue = variableAmount * weight;
  return Math.round(goalValue * (glosaPct / 100));
}
