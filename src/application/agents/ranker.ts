import { SemanticEvent, SituationSpecification, createHuman, type Participant, type SituationContext } from "@mozaik-ai/core"
import { isMissingData, rankCandidates, scoreCandidate, type Money, type Sourced } from "../../domain/index.js"
import { safeHandler } from "../resilience/safe-handler.js"
import type { AppRuntime } from "../runtime.js"

export const RANKER_NAME = "Ranker"

/** Events after which the room may have gone quiet: an answer, a failed listing, a rejection. */
const SETTLING = new Set(["model.answer", "listing.extraction_failed", "candidate.rejected"])

class WhenSomethingFinished extends SituationSpecification {
  isSatisfiedBy({ event }: SituationContext): boolean {
    return SETTLING.has(event.type)
  }
}

/**
 * The Ranker: plain code, no model. It notices when every listing has been read and no agent loop is still running,
 * then scores every candidate that was not rejected (domain rules in ranking.ts), ranks them and publishes
 * candidate.scored for each, then ranking.done. It ranks once per research.
 */
export function createRanker(rt: AppRuntime): Participant {
  let ranked = false
  let self: Participant

  const settled = () =>
    rt.state.listingTexts.size > 0 &&
    rt.state.candidates.size + rt.state.failedListings.length >= rt.state.listingTexts.size &&
    rt.loops().every((l) => l.status === "done")

  const rank = () => {
    ranked = true
    const profile = rt.state.requireProfile()
    const candidates = [...rt.state.candidates.values()].filter((c) => !c.isRejected())
    const scores = candidates.map((c) => {
      const monthly = rt.state.findings.find((f) => f.id === `${c.id}:finance:monthly_cost`)?.value as Sourced<Money> | undefined
      return scoreCandidate({
        candidateId: c.id,
        listing: c.listing,
        profile,
        monthlyCost: monthly && !isMissingData(monthly) ? monthly : null,
        lease: rt.state.leaseClauses.get(c.id) ?? null,
        hasLeaseDraft: rt.state.hasLease(c.id),
        softFindings: rt.state.findings.filter((f) => f.candidateId === c.id && f.severity === "soft"),
      })
    })
    const order = rankCandidates(scores)
    const id = self.getId()
    for (const r of order) {
      const candidate = rt.state.candidate(r.candidateId)
      if (candidate.status === "pending") candidate.startEvaluation()
      candidate.markScored(r.score)
      rt.state.recordRanking(r)
      rt.sendEvent(
        SemanticEvent.create("candidate.scored", id, { candidateId: r.candidateId, rank: r.rank, score: r.score, scoreHigh: r.scoreHigh, confidence: r.confidence, reasons: r.reasons, components: r.components }),
        id,
      )
    }
    rt.sendEvent(SemanticEvent.create("ranking.done", id, { order: order.map((r) => r.candidateId), excluded: [...rt.state.candidates.values()].filter((c) => c.isRejected()).map((c) => c.id) }), id)
  }

  self = createHuman({
    name: RANKER_NAME,
    capabilities: ["rank"],
    handlers: [
      safeHandler({
        specification: new WhenSomethingFinished(),
        processor: {
          apply() {
            if (ranked || !settled()) return
            // Wait one tick: an answer can start a retry loop or release a waiting tool right after this event.
            setTimeout(() => {
              if (!ranked && settled()) rank()
            }, 0)
          },
        },
      }),
    ],
  })
  return self
}
