import { describe, expect, it } from "vitest"
import { VERDICT_RULES, verdictFor, type CandidateScore } from "../src/domain/index.js"

const score = (patch: Partial<CandidateScore> & { checks?: number | null }): CandidateScore => ({
  candidateId: "c1",
  score: 80,
  scoreHigh: 80,
  confidence: "high",
  tier: 1,
  reasons: [],
  components: [
    { name: "cost", weight: 45, value: 0.9 },
    { name: "area", weight: 20, value: 0.9 },
    { name: "lease", weight: 20, value: 0.9 },
    { name: "checks", weight: 15, value: patch.checks === undefined ? 1 : patch.checks },
  ],
  ...patch,
})

describe("verdict (plain code, Decision card)", () => {
  it("Good only with high confidence, nothing to check and a worst-case score of at least 70", () => {
    expect(verdictFor(score({}), false).verdict).toBe("good")
    expect(verdictFor(score({ score: VERDICT_RULES.goodMinScore - 1 }), false).verdict).toBe("check_before_signing")
    expect(verdictFor(score({ confidence: "medium" }), false).verdict).toBe("check_before_signing")
    expect(verdictFor(score({ checks: 0.85 }), false).verdict).toBe("check_before_signing")
  })
  it("a space outside the required area range is never Good, however high the score", () => {
    const outside = score({ score: 90, scoreHigh: 90, components: [{ name: "cost", weight: 45, value: 1 }, { name: "area", weight: 20, value: 0 }, { name: "lease", weight: 20, value: 1 }, { name: "checks", weight: 15, value: 1 }] })
    expect(verdictFor(outside, false)).toEqual({ verdict: "check_before_signing", why: "Ranked, but the area is outside your required range" })
  })
  it("Not recommended for a hard flag, no stated rent, or a worst-case score below 50", () => {
    expect(verdictFor(null, true).verdict).toBe("not_recommended")
    expect(verdictFor(score({ tier: 2, confidence: "low" }), false).verdict).toBe("not_recommended")
    expect(verdictFor(score({ score: 49, scoreHigh: 90, confidence: "low" }), false)).toEqual({ verdict: "not_recommended", why: "The worst-case score is 49, below 50" })
  })
  it("always says why", () => {
    expect(verdictFor(score({ confidence: "medium" }), false).why).toBe("Ranked, but some inputs are unknown")
  })
})
