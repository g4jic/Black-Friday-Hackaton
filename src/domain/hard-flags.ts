import type { AreaM2 } from "./area.js"
import type { HardFlag } from "./candidate.js"
import type { Money } from "./money.js"
import type { BusinessType } from "./profile.js"
import type { Requirement } from "./requirement.js"
import { calc, type SourceRef, type Sourced } from "./source.js"

/**
 * Deal breakers, decided in code, never by a model. Each rule returns a HardFlag (with its source) or null.
 * A model may only report facts (for example "the listing says first floor, no storefront"); these rules
 * decide whether that cancels the candidate.
 */

export const BUDGET_TOLERANCE = 0.1

export const BUSINESS_TYPE_TEXT: Record<BusinessType, string> = { cafe_food: "cafe or food", retail: "retail shop", office_studio: "office or studio", workshop: "small workshop" }

/** The listing's permitted use must include the business type from the questionnaire. Applies to every evaluation. */
export function permittedUseExcludes(permitted: Sourced<readonly BusinessType[]>, businessType: Sourced<BusinessType>, raisedBy: string): HardFlag | null {
  if (permitted.value.includes(businessType.value)) return null
  return {
    aspect: "premises",
    rule: "permitted_use_excludes_business",
    reason: `Permitted use does not include your business type (${BUSINESS_TYPE_TEXT[businessType.value]}): the listing allows ${permitted.value.map((u) => BUSINESS_TYPE_TEXT[u]).join(", ")}`,
    raisedBy,
    source: calc(false, "business type compared with the permitted use", [permitted, businessType]).source,
  }
}

export function budgetExceeded(monthlyTotal: Sourced<Money>, budget: Sourced<Money>, raisedBy: string): HardFlag | null {
  const limit = budget.value.multiply(1 + BUDGET_TOLERANCE)
  if (!monthlyTotal.value.greaterThan(limit)) return null
  const overBy = Math.round((monthlyTotal.value.ratioTo(budget.value) - 1) * 100)
  return {
    aspect: "finance",
    rule: "monthly_cost_over_budget",
    reason: `Monthly cost ${monthlyTotal.value} is ${overBy}% over the budget of ${budget.value} (limit +${BUDGET_TOLERANCE * 100}%)`,
    raisedBy,
    source: calc(overBy, "monthly cost / budget - 1", [monthlyTotal, budget]).source,
  }
}

export function areaOutsideRange(area: Sourced<AreaM2>, min: Sourced<AreaM2>, max: Sourced<AreaM2>, raisedBy: string): HardFlag | null {
  if (area.value.isWithin(min.value, max.value)) return null
  return {
    aspect: "premises",
    rule: "area_outside_range",
    reason: `Area ${area.value.value} m2 is outside the required ${min.value.value}-${max.value.value} m2`,
    raisedBy,
    source: calc(area.value.value, "area compared with required range", [area, min, max]).source,
  }
}

export function costShareAboveThreshold(share: Sourced<number>, threshold: Sourced<number>, raisedBy: string): HardFlag | null {
  if (share.value <= threshold.value) return null
  return {
    aspect: "finance",
    rule: "cost_share_of_revenue_above_threshold",
    reason: `Space costs ${pct(share.value)} of expected revenue, above the ${pct(threshold.value)} threshold`,
    raisedBy,
    source: calc(share.value, "cost share compared with threshold", [share, threshold]).source,
  }
}

export type RequirementStatus = "met" | "not_met" | "unknown"

/**
 * Only a hard requirement that is DEFINITELY not met cancels a candidate. "unknown" never does: it becomes
 * a "check before signing" item instead.
 */
export function hardRequirementNotMet(
  requirement: Requirement,
  status: RequirementStatus,
  evidence: SourceRef,
  raisedBy: string,
): HardFlag | null {
  if (!requirement.hard || status !== "not_met") return null
  return {
    aspect: requirement.aspect,
    rule: "hard_requirement_not_met",
    reason: `Hard requirement not met: ${requirement.text}`,
    raisedBy,
    source: evidence,
  }
}

function pct(x: number): string {
  return `${Math.round(x * 1000) / 10}%`
}
