import { SituationSpecification, type SituationContext, type SituationHandler } from "@mozaik-ai/core"

export type HandlerErrorReporter = (
  error: unknown,
  context: SituationContext,
  where: "specification" | "processor",
) => void

const defaultReporter: HandlerErrorReporter = (error, { event, participant }, where) =>
  console.error(`[safe-handler] ${where} of ${participant.getManifest().name} failed on ${event.type}:`, error)

class GuardedSpecification extends SituationSpecification {
  constructor(
    private readonly inner: SituationSpecification,
    private readonly report: HandlerErrorReporter,
  ) {
    super()
  }

  isSatisfiedBy(context: SituationContext): boolean {
    try {
      return this.inner.isSatisfiedBy(context)
    } catch (error) {
      this.report(error, context, "specification")
      return false
    }
  }
}

/**
 * Mozaik delivers events synchronously to every participant. A throw inside any handler travels back into
 * whoever published the event (often another agent's loop) and can crash the process. Every handler we
 * register goes through this wrapper: errors are reported, never thrown.
 */
export function safeHandler(handler: SituationHandler, report: HandlerErrorReporter = defaultReporter): SituationHandler {
  return {
    specification: new GuardedSpecification(handler.specification, report),
    processor: {
      apply(context) {
        try {
          const result = handler.processor.apply(context)
          if (result instanceof Promise) result.catch((error: unknown) => report(error, context, "processor"))
        } catch (error) {
          report(error, context, "processor")
        }
      },
    },
  }
}
