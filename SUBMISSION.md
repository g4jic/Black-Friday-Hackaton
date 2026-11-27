# SuiteSpot: submission text

Text for the JigJoy Black Friday AI Hackathon submission form (team Scope). Every number below comes from the
README (recorded runs replayed on 27 Nov 2026).

## Project name
SuiteSpot

## Repository
https://github.com/g4jic/Black-Friday-Hackaton

## Live deployment
https://suitespot-production.up.railway.app (sign up, then Research. The three demo scenarios and the whole deal loop
run with no key; your own questionnaire runs the live model on our key, capped by a usage limit in the Anthropic
Console and one live run at a time. Every feature is open.)

## Description
"Is this lease a good financial decision for my business?" A small business owner comparing commercial spaces needs an
evening with a spreadsheet per listing, and the lease clause that matters most is the easiest to miss. SuiteSpot is a
two-sided platform for commercial spaces: landlords publish structured listings, a business fills in a short
questionnaire, and Mozaik agents evaluate every candidate space at the same time from different angles. AI agents read
(numbers, lease drafts, the area around the address, the description of the space); plain code does every
calculation, decides every deal breaker and every verdict, and checks every quote and every number against its
source. Each space gets a score range, a verdict, a rent share of revenue, a bad year / good year view, a lease or buy
comparison and a list of what to check before signing. The business can then make an offer; once the landlord accepts,
both sides see the same lease with its rent due dates, and the tenant pays rent through one payment port (Stripe
Checkout in test mode with test keys, a clearly labelled simulated checkout without them; no real money ever moves).
All listings, landlords and businesses are synthetic. Not financial or legal advice.

## How the agents run concurrently
Built on @mozaik-ai/core 6.0.0. Every research run is one Mozaik runtime with one shared, typed RuntimeState, and
there is no orchestrator: every event goes to every participant, and each one decides through its own situation
handlers whether to react. runLoop is fire-and-forget, so on each candidate.found four AI roles start their own loops
at once (Finance analyst, Location analyst, Premises inspector, and the Lease reader when there is a lease draft), and with 8 candidates that is up to 30
loops in parallel (Office in Beograd: 32 loops, peak 30 at once, 10 s). Agents react to each other through state, not
calls: the Finance analyst waits in state for the lease terms the Lease reader writes. When any participant raises a
hard flag (code decides it), the candidate is rejected in state and a Mozaik InterceptionHandler stops every other loop
on that candidate at its next breakpoint, before the next model call (in Office in Beograd the Lease reader finds an
unlimited rent increase after 4.6 s and the Finance analyst's running loop stops before its next tool call). When the
room is quiet, a code Ranker scores worst case first, the Report writer drafts from numbered facts, and a code Auditor
checks every sentence against the facts it cites (sends it back once, then removes failing sentences; 0 removed in all
three demo runs). The Timeline tab draws every loop from the runtime's own events, and each run appears in Mozaik
Cloud. Without a key the agents replay recorded real claude-haiku-4-5 runs, labelled "Recorded run".
