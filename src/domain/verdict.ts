import type { CandidateScore } from "./ranking.js"

/**
 * The one-word answer on the Decision card. Plain code from the Ranker's score, no model. These are SuiteSpot's
 * choices (shown on the Assumptions screen), not a recommendation to sign: the output is not financial advice.
 */
export const VERDICT_RULES = {
  goodMinScore: 70,
  notRecommendedBelowScore: 50,
  good: "Good: ranked with high confidence, a score of at least 70 (worst case) and nothing to check before signing",
  checkBeforeSigning: "Check before signing: ranked, but something is unknown or must be checked first",
  notRecommended: "Not recommended: rejected by a hard flag, no stated rent, or a score below 50 (worst case)",
} as const

export type Verdict = "good" | "check_before_signing" | "not_recommended"

export type VerdictResult = { readonly verdict: Verdict; readonly why: string }

/** rejected: the candidate was cut by a hard flag (then it has no score). */
export function verdictFor(score: CandidateScore | null, rejected: boolean): VerdictResult {
  if (rejected) return { verdict: "not_recommended", why: "A hard flag rejected this space" }
  if (!score) return { verdict: "not_recommended", why: "This space could not be scored" }
  if (score.tier === 2) return { verdict: "not_recommended", why: "The listing does not state the rent" }
  if (score.score < VERDICT_RULES.notRecommendedBelowScore) {
    return { verdict: "not_recommended", why: `The worst-case score is ${score.score}, below ${VERDICT_RULES.notRecommendedBelowScore}` }
  }
  const checks = score.components.find((c) => c.name === "checks")
  const pointsToCheck = checks?.value !== null && checks?.value !== undefined && checks.value < 1
  if (score.confidence === "high" && !pointsToCheck && score.score >= VERDICT_RULES.goodMinScore) {
    return { verdict: "good", why: `High confidence, a score of ${score.score} and nothing to check before signing` }
  }
  const because = score.confidence !== "high" ? "some inputs are unknown" : pointsToCheck ? "there are points to check before signing" : `the score is ${score.score}, below ${VERDICT_RULES.goodMinScore}`
  return { verdict: "check_before_signing", why: `Ranked, but ${because}` }
}
