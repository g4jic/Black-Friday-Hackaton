import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"
import type { DealService } from "../../application/deals/deal-service.js"
import type { ListingActor } from "../../application/listings/listing-store.js"
import { DomainError } from "../../domain/index.js"
import type { SimulatedGateway } from "../payments/simulated-gateway.js"
import type { ActorResolver } from "./listing-routes.js"

/**
 * Deals over HTTP: offers, answers, the overview for both sides, and rent payments. Every route needs a signed-in
 * user; the rules are checked by the domain, and domain errors come back as 4xx with their plain message.
 */
const STATUS: Partial<Record<DomainError["code"], number>> = {
  not_offer_party: 403,
  not_tenancy_party: 403,
  offer_not_found: 404,
  tenancy_not_found: 404,
  listing_not_found: 404,
  offer_already_open: 409,
  already_leased: 409,
  already_paid: 409,
}

/** The public address of this server, for payment return links (behind a proxy, from X-Forwarded-*). */
export function baseUrlOf(req: FastifyRequest): string {
  const proto = String(req.headers["x-forwarded-proto"] ?? req.protocol).split(",")[0]!.trim()
  const host = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost").split(",")[0]!.trim()
  return `${proto}://${host}`
}

export function registerDealRoutes(app: FastifyInstance, options: { deals: DealService; resolveActor: ActorResolver; simulated: SimulatedGateway | null }): void {
  const { deals, resolveActor, simulated } = options
  const route =
    <T>(fn: (actor: ListingActor, req: FastifyRequest) => Promise<T>) =>
    async (req: FastifyRequest, reply: FastifyReply) => {
      const actor = await resolveActor(req)
      if (!actor) return reply.code(401).send({ error: "Sign in to continue" })
      try {
        return await fn(actor, req)
      } catch (error) {
        if (error instanceof DomainError) return reply.code(STATUS[error.code] ?? 400).send({ error: error.message, code: error.code })
        req.log.error(error)
        return reply.code(500).send({ error: "Something went wrong with this deal. Try again." })
      }
    }
  const body = (req: FastifyRequest) => (req.body ?? {}) as Record<string, unknown>
  const param = (req: FastifyRequest, name: string) => String((req.params as Record<string, string>)[name] ?? "")

  app.get("/api/deals", route((actor) => deals.overview(actor)))
  app.post("/api/listings/:id/offers", route((actor, req) => deals.makeOffer(actor, param(req, "id"), body(req))))
  app.post(
    "/api/offers/:id/answer",
    route((actor, req) => {
      const answer = body(req).answer
      if (answer !== "accept" && answer !== "decline") throw new DomainError("invalid_offer", 'The answer must be "accept" or "decline"')
      return deals.answerOffer(actor, param(req, "id"), answer)
    }),
  )
  app.post("/api/offers/:id/withdraw", route((actor, req) => deals.withdrawOffer(actor, param(req, "id"))))
  app.post("/api/tenancies/:id/pay", route((actor, req) => deals.startRentPayment(actor, param(req, "id"), String(body(req).period ?? ""), baseUrlOf(req))))
  app.post("/api/payments/confirm", route((actor, req) => deals.confirmRentPayment(actor, String(body(req).reference ?? ""))))

  // The simulated checkout page reads its checkout and "pays" it (only without Stripe test keys).
  if (simulated) {
    app.get(
      "/api/payments/simulated/:reference",
      route(async (actor, req) => {
        const checkout = simulated.checkout(param(req, "reference"))
        if (!checkout) throw new DomainError("invalid_payment", "This simulated checkout is not open any more. Start the payment again.")
        await deals.assertTenantOf(actor, checkout.tenancyId)
        return checkout
      }),
    )
    app.post(
      "/api/payments/simulated/:reference/pay",
      route(async (actor, req) => {
        const checkout = simulated.checkout(param(req, "reference"))
        if (!checkout) throw new DomainError("invalid_payment", "This simulated checkout is not open any more. Start the payment again.")
        await deals.assertTenantOf(actor, checkout.tenancyId)
        return simulated.pay(checkout.reference)
      }),
    )
  }
}
