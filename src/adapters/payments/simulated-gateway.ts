import { randomUUID } from "node:crypto"
import type { CheckoutPurpose, CheckoutStatus, PaymentGateway } from "../../application/payments/payment-gateway.js"
import { DomainError } from "../../domain/index.js"

/**
 * A simulated checkout, used when no Stripe test keys are set: the same flow as Stripe Checkout, but the "payment
 * page" is SuiteSpot's own form labelled "Simulated payment, no real money". The payment record says
 * method "simulated" and its reference starts with "simulated:". Open checkouts live in memory (a restart drops
 * unpaid ones; recorded payments are in the deal store).
 */
export class SimulatedGateway implements PaymentGateway {
  readonly method = "simulated" as const
  private readonly checkouts = new Map<string, CheckoutStatus>()

  async startCheckout(purpose: CheckoutPurpose, urls: { successUrl: (reference: string) => string; cancelUrl: string }): Promise<{ reference: string; redirectUrl: string }> {
    const reference = `simulated:${randomUUID()}`
    this.checkouts.set(reference, { ...purpose, paid: false, reference })
    const params = new URLSearchParams({ success: urls.successUrl(reference), cancel: urls.cancelUrl })
    return { reference, redirectUrl: `/pay/simulated/${encodeURIComponent(reference)}?${params}` }
  }

  async checkoutStatus(reference: string): Promise<CheckoutStatus | null> {
    const c = this.checkouts.get(reference)
    return c ? { tenancyId: c.tenancyId, period: c.period, amount: c.amount, currency: c.currency, paid: c.paid, reference } : null
  }

  /** What the simulated payment form shows. */
  checkout(reference: string): CheckoutStatus | null {
    const c = this.checkouts.get(reference)
    return c ? { tenancyId: c.tenancyId, period: c.period, amount: c.amount, currency: c.currency, paid: c.paid, reference } : null
  }

  /** "Pay" on the simulated form. Paying twice changes nothing. */
  pay(reference: string): CheckoutStatus {
    const c = this.checkouts.get(reference)
    if (!c) throw new DomainError("invalid_payment", "This simulated checkout is not open any more. Start the payment again.")
    const paid = { ...c, paid: true }
    this.checkouts.set(reference, paid)
    return paid
  }
}
