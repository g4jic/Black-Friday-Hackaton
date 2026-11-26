# Demo lease drafts (SYNTHETIC DEMO DATA)

Three invented lease drafts in Serbian, written as raw text, each tied to one demo listing. They are **not real
contracts**. The Lease reader extracts the clauses with quotes; plain code (`evaluateLease` in `src/domain/lease.ts`)
decides what is a hard flag and what to check before signing.

| File | Listing | What code decides |
|---|---|---|
| lease-demo-01.txt | demo-01 | clean: 36 months, early exit with 3 months' notice, indexation by CPI, landlord pays structural repairs |
| lease-demo-04.txt | demo-04 | **soft flags**: director's personal guarantee, tenant pays structural repairs, 6 months' notice (check before signing) |
| lease-demo-07.txt | demo-07 | **hard flag**: 10-year term with no right to end early, and the landlord may raise the rent at will |

Scripted Lease reader answers for keyless demo mode: `fixtures/mock-answers/lease-reader.json`.
