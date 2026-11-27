import type { PaymentMethod } from "../../domain/index.js"

/** What a checkout is for. Kept by the gateway, so the browser never tells the server what was paid. */
export type CheckoutPurpose = { readonly tenancyId: string; readonly period: string; readonly amount: number; readonly currency: "EUR" }

export type CheckoutStatus = CheckoutPurpose & { readonly paid: boolean; readonly reference: string }

/**
 * The port for rent payments. Two adapters with the same flow: Stripe Checkout in test mode (when test keys are set)
 * and a simulated checkout (no keys: our own form, "Simulated payment, no real money"). No real money moves in either.
 */
export interface PaymentGateway {
  readonly method: PaymentMethod
  /** Starts a checkout. successUrl receives the reference; the browser is sent to redirectUrl. */
  startCheckout(purpose: CheckoutPurpose, urls: { description: string; successUrl: (reference: string) => string; cancelUrl: string }): Promise<{ reference: string; redirectUrl: string }>
  /** Whether a checkout was paid, read from the provider (or the simulation), never from the browser. Null: unknown. */
  checkoutStatus(reference: string): Promise<CheckoutStatus | null>
}
