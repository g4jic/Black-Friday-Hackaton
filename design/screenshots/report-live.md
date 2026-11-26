# Live run: audited report (claude-haiku-4-5, 8 SYNTHETIC demo listings)

Run on 2026-11-26 15:59 UTC. Not financial or legal advice.

- Time: 34.1 s, 22 loops, peak 11 in parallel, 13 calculator calls
- Tokens: 69477 in, 6918 out; cost about $0.1041 (at $1 / $5 per million tokens)
- Rejected: 2; loops cancelled: 1; rejected extractions: 1; agents halted: 0
- Audit: 12 claims checked, 1 corrected, 0 removed, 2 attempt(s)
- Recommended: demo-01, demo-06, demo-05

## Recommendation

- demo-01 is ranked #1 with a score of 80 out of 100, offers 72 m² within the required range, and allows early exit with a monthly cost of 1,310 EUR. [F1: calc, F3: calc, F2: lease, F4: calc]
- demo-06 is ranked #2 with a score of 74-94 out of 100, provides 50 m² at the lowest monthly cost of 700 EUR which is 47% of the budget. [F7: calc, F9: calc, F8: calc, F11: calc]
- demo-05 is ranked #3 with a score of 68-88 out of 100, offers 65 m² at a monthly cost of 1,185 EUR which is 79% of the budget. [F12: calc, F14: calc, F13: calc, F16: calc]

## Check before signing

- For demo-04, a person must personally guarantee the rent; check who signs the personal guarantee and up to what amount. [F25: lease]
- For demo-04, the tenant pays for structural repairs; check which repairs are the tenant's and whether the cost is capped. [F26: lease]
- For demo-04, early exit needs 6 months' notice; check whether the notice period can be shortened. [F27: lease]

## Why these were rejected

- demo-02 was rejected because the monthly cost of 3,200 EUR is 113% over the budget of 1,500 EUR. [F36: calc]
- demo-07 was rejected because the tenant cannot end the lease early with a term of 120 months and the landlord may raise the rent at will with no limit. [F37: lease, F38: lease]

## What we do not know

- demo-06 has confidence medium: no lease draft available, leaving up to 20 points unknown. [F10: profile]
- demo-05 has confidence medium: no lease draft available, leaving up to 20 points unknown. [F15: profile]
- demo-03 has confidence low: the area is not stated and no lease draft is available, leaving up to 20 points unknown for each issue. [F30: profile]
- demo-08 has confidence low: the rent is not stated and no lease draft is available, leaving up to 45 points and up to 20 points unknown respectively. [F35: profile]
