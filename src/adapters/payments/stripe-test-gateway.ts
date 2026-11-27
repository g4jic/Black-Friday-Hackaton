import type { CheckoutPurpose, CheckoutStatus, PaymentGateway } from "../../application/payments/payment-gateway.js"
import { DomainError } from "../../domain/index.js"

/**
 * Stripe Checkout in TEST MODE only (fake money, test cards such as 4242 4242 4242 4242). Plain HTTPS calls to the
 * Stripe API, no SDK. The secret key stays in this server process; the reference is the Checkout session id, which
 * is the source of the payment record. Stripe does not currently onboard businesses registered in Serbia, so this
 * shows the flow only; production would use a local payment processor behind the same PaymentGateway port.
 */
export type StripeTestConfig = { readonly secretKey: string; readonly publishableKey: string }

/** Test keys only: both set, sk_test_ and pk_test_. A live key is refused (the server falls back to simulated). */
export function stripeTestConfig(env: NodeJS.ProcessEnv = process.env): { config: StripeTestConfig | null; warning: string | null } {
  const secretKey = env.STRIPE_SECRET_KEY?.trim() ?? ""
  const publishableKey = env.STRIPE_PUBLISHABLE_KEY?.trim() ?? ""
  if (!secretKey && !publishableKey) return { config: null, warning: null }
  if (!secretKey.startsWith("sk_test_") || !publishableKey.startsWith("pk_test_"))
    return { config: null, warning: "Stripe keys are set but are not both test keys (sk_test_, pk_test_): payments stay simulated." }
  return { config: { secretKey, publishableKey }, warning: null }
}

type StripeSession = { id: string; url: string | null; payment_status: string; amount_total: number | null; currency: string | null; metadata: Record<string, string> | null }

export class StripeTestGateway implements PaymentGateway {
  readonly method = "stripe_test" as const

  constructor(
    private readonly config: StripeTestConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async call(path: string, init: { method: "GET" | "POST"; body?: URLSearchParams }): Promise<StripeSession> {
    const response = await this.fetchImpl(`https://api.stripe.com/v1/${path}`, {
      method: init.method,
      headers: { Authorization: `Bearer ${this.config.secretKey}`, ...(init.body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
      body: init.body,
      signal: AbortSignal.timeout(15_000),
    })
    const body = (await response.json().catch(() => ({}))) as StripeSession & { error?: { message?: string } }
    if (!response.ok) throw new DomainError("invalid_payment", `Stripe test mode: ${body.error?.message ?? `HTTP ${response.status}`}`)
    return body
  }

  async startCheckout(purpose: CheckoutPurpose, urls: { description: string; successUrl: (reference: string) => string; cancelUrl: string }): Promise<{ reference: string; redirectUrl: string }> {
    const form = new URLSearchParams({
      mode: "payment",
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": purpose.currency.toLowerCase(),
      "line_items[0][price_data][unit_amount]": String(Math.round(purpose.amount * 100)),
      "line_items[0][price_data][product_data][name]": urls.description,
      success_url: urls.successUrl("{CHECKOUT_SESSION_ID}"),
      cancel_url: urls.cancelUrl,
      "metadata[tenancyId]": purpose.tenancyId,
      "metadata[period]": purpose.period,
    })
    const session = await this.call("checkout/sessions", { method: "POST", body: form })
    if (!session.url) throw new DomainError("invalid_payment", "Stripe test mode returned no checkout page")
    return { reference: session.id, redirectUrl: session.url }
  }

  async checkoutStatus(reference: string): Promise<CheckoutStatus | null> {
    if (!/^cs_test_[A-Za-z0-9_]+$/.test(reference)) return null
    const s = await this.call(`checkout/sessions/${encodeURIComponent(reference)}`, { method: "GET" })
    const tenancyId = s.metadata?.tenancyId
    const period = s.metadata?.period
    if (!tenancyId || !period || s.amount_total === null || s.currency !== "eur") return null
    return { tenancyId, period, amount: s.amount_total / 100, currency: "EUR", paid: s.payment_status === "paid", reference: s.id }
  }
}
