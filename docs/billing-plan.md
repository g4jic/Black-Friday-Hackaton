# Billing plan (prepared 27 Nov 2026, not built)

Prepared by Andrej + Claude while Aleksa builds the onboarding flow (`docs/handoff-aleksa-onboarding.md`). Billing
starts only after onboarding is merged, because who pays and for what depends on the user's role and profile. No
long dashes; prices below are placeholders to decide, not facts.

## 0. Two warnings first
- **The jury judges the public repo until the winners are announced (4 Dec).** After submissions close (midnight
  CET, 27 to 28 Nov), build billing on a branch and do not push to `main` or redeploy until judging is over, unless
  the team decides otherwise. The keyless demo must stay free and must run without any payment step.
- **Rubric:** the brief gives no points for payments by themselves. Billing is for the product after the hackathon.

## 1. What can be charged (options, pick one or two to start)
| Option | Who pays | Pros | Cons |
|---|---|---|---|
| A. Pay per live research (credits) | Tenant | Price follows our real cost: a live run costs about $0.05 to $0.10 in model fees (README, measured with `claude-haiku-4-5`); simple to explain; no subscription logic | A payment before the first value; small amounts make card fees heavy (needs credit packs, not single runs) |
| B. Monthly plan with N live runs | Tenant (or their accountant) | Predictable revenue; fits SME and accountant use | Needs renewal, cancellation and proration; more code (webhooks) |
| C. Listing fee or featured listing | Landlord | Landlords already earn rent, so they can pay; no friction for tenants | A new platform has few landlords; paying before any tenant traffic is a hard sell |
| D. Success fee when a lease is signed | Landlord or tenant | Pays only when value happened; the offer and lease flow already exists (`src/domain/deal.ts`) | **Check before building:** whether charging a fee for a concluded lease makes SuiteSpot a real estate intermediary under Serbian rules (Zakon o posredovanju u prometu i zakupu nepokretnosti) and what that requires |
| E. Fee on rent paid through SuiteSpot | Tenant or landlord | Recurring, built on the existing rent payment port | Moving rent money means handling other people's funds: a licensed payment provider must hold it, never us |

Suggested start: **A (credit packs for tenants)** plus a free allowance (for example the first N live runs free;
N to decide), because it maps directly to the cost we already measure per run, and the demo stays free. C and D come
later, when there are real landlords.

## 2. Payment provider (decision needed, free and paid)
| Option | Cost | Note |
|---|---|---|
| Stripe test mode (already built: `src/adapters/payments/stripe-test-gateway.ts`) | Free | Demonstrates the flow only. Stripe does not onboard businesses registered in Serbia, so not for production. |
| Simulated gateway (already built: `src/adapters/payments/simulated-gateway.ts`) | Free | For keyless runs and tests. |
| A Serbian card processor (a bank e-commerce gateway or a licensed payment institution) | Per transaction fee plus setup, varies | **Check before choosing:** fees, API (redirect checkout vs API), onboarding time, and who is the merchant of record. |
| A merchant of record service (handles VAT and payouts for us) | Higher fee per sale | **Check before choosing:** whether it pays out to a Serbian company or person. |

Whatever we pick goes behind the same port, so the domain and the UI do not change when the provider does.

## 3. Technical design (fits the current architecture)
- **Port:** `src/application/payments/payment-gateway.ts` today only knows rent (`CheckoutPurpose = { tenancyId,
  period, amount, currency }`). Change it to a tagged union:
  `{ kind: "rent", tenancyId, period, amount, currency } | { kind: "credits", accountId, packId, credits, amount, currency }`.
  Both adapters keep the purpose on the server, so the browser never says what was paid (same rule as rent).
- **Domain** (`src/domain/billing.ts`, no I/O): `CreditPack` (id, credits, price with a source: our own price list),
  `CreditBalance` with `grant(credits, paymentReference)` (idempotent: the same reference twice changes nothing) and
  `spendForLiveRun(researchId)` which throws `DomainError("no_credits", "Live research needs a credit. Buy a pack or
  run the demo.")`. A refund returns the credit when a live run fails before any model call.
- **Enforcement point:** `POST /api/research` in `src/adapters/server/research-routes.ts`, next to the existing
  "one live run at a time" guard: live mode spends one credit; demo runs never do. The error goes back to the UI as
  a 402 with the domain message.
- **Storage:** a new server-owned table `credit_ledger` (account id, delta, reason, payment reference unique,
  created at) with RLS: a user can read only their own rows, only the service role writes. The balance is the sum
  of the ledger, so every credit has a source row. Local twin in `data/` for keyless runs, like the deal store.
- **Confirming a payment:** the same pattern as rent: after the redirect the server asks the provider
  (`checkoutStatus`) and grants credits once per reference. Subscriptions (option B) would need webhooks; not in the
  first version.
- **UI:** a "Credits" line in Settings (balance, packs, history from the ledger), and a notice on the research form
  when the balance is 0. Pages for checkout reuse the existing simulated payment page
  (`web/src/deals/DealViews.tsx`, route `simulatedPayment`).
- **Tests:** domain tests for grant idempotency, no credits, refund on failure; a server test that a live run without
  credits gets 402 and a demo run still gets 201; the recorded demo test must stay green.

## 4. What billing needs from onboarding (agree this with Aleksa)
- The user's **role** (tenant, landlord or both), readable on the server for the signed-in account. Note: Supabase
  `user_metadata` can be changed by the user, so it may decide the UI, but anything that decides money (free
  allowance, plan) must live in a server-owned table.
- A stable **account id** (already: Supabase user id, or `local-...` for local accounts).
- The moment onboarding is finished, so the free allowance can be granted once (a ledger row with reason
  `welcome_allowance`).

## 5. Order of work after onboarding is merged
1. Team decides: what to charge (section 1), the free allowance N, pack sizes and prices, the provider (section 2).
2. Domain `billing.ts` + tests.
3. Ledger migration + RLS check + local store.
4. Port change (tagged union) + both adapters + the server guard on live runs.
5. Settings UI for credits + the research form notice.
6. README section "Billing" with what is real and what is simulated.
