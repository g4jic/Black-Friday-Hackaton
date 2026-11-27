# SuiteSpot: submission

Submit at **https://build.jigjoy.ai/submit**. One entry per team; resubmitting before midnight CET keeps the latest.
The fields below are in the order of the form. Every number comes from the README (recorded runs replayed on
27 Nov 2026).

## Project name
SuiteSpot

## Contact email
The address the team applied with (filled in by hand, not stored in this repository).

## Team name
Scope

## Track
Agents in Finance

## Repository URL
https://github.com/g4jic/Black-Friday-Hackaton

## Live deployment URL
https://suitespot-production.up.railway.app

## Demo or video URL
https://youtu.be/syJkZpOK5TE (walkthrough, 3.5 min)

## What does it do?
SuiteSpot finds a small business the best financial deal on a commercial space.

Comparing spaces by hand takes an evening with a spreadsheet per listing, and the lease clause that matters most is
the easiest to miss. SuiteSpot is a two-sided platform: space owners publish structured listings and a business fills in
a short questionnaire.

Mozaik agents then evaluate every matching space at the same time. Each covers one financial angle, with one goal:
find the business its best financial case. The angles are:
- the real monthly cost and the money needed up front;
- the cost of leaving early;
- the rent's share of revenue;
- the lease risks;
- the location and the premises.

AI agents read; plain code does every calculation, decides every deal breaker and verdict, and checks every quote
and number against its source. Each space gets a score range, a verdict and a list of what to check before signing,
and the ranking puts the best financial case first.

The business can then make an offer, get a lease with its rent schedule and pay rent: Stripe test mode online, a
simulated checkout locally; no real money moves. It runs from the README with no key, and has 284 automated tests.

All data is synthetic. Not financial or legal advice.

## How do the agents run concurrently?
Built on @mozaik-ai/core 6.0.0.

- **One room, no orchestrator.** Every research run is one Mozaik runtime with one shared, typed RuntimeState. Every
  event goes to every participant, and each one decides through its own situation handlers whether to react.
- **Parallel loops.** runLoop is fire-and-forget. On each candidate.found, four AI roles start their own loops at
  once: the Finance analyst, the Location analyst, the Premises inspector, and the Lease reader when there is a lease
  draft. With 8 candidates that is up to 30 loops in parallel (Office in Beograd: 32 loops, peak 30 at once, 10 s).
- **Reacting through state, not calls.** The Finance analyst waits in state for the lease terms the Lease reader
  writes.
- **Deal breakers stop running loops.** When any participant raises a hard flag (code decides it), the candidate is
  rejected in state. A Mozaik InterceptionHandler then stops every other loop on that candidate at its next
  breakpoint, before the next model call. In Office in Beograd the Lease reader finds an unlimited rent increase after
  4.6 s, and the Finance analyst's running loop stops before its next tool call.
- **Ranking and an audited report.** When the room is quiet, a code Ranker scores worst case first and the Report
  writer drafts from numbered facts. A code Auditor checks every sentence against the facts it cites: it sends the
  draft back once, then removes failing sentences (0 removed in all three demo runs).
- **Proof on screen.**
  - During a run, every running loop is a dot circling its agent, drawn from the runtime's own events. At the peak
    there are as many dots as loops: 27, 30 and 28 in the three scenarios.
  - The Timeline tab draws every loop as a lane, and each run appears in Mozaik Cloud.
- **Without a key** the three example businesses replay recorded real claude-haiku-4-5 runs, and every other run uses
  scripted agents (stated in the README).

## Screenshots (4, each under 5 MB)
1. `design/screenshots/results-list.png`: the ranked results
2. `design/screenshots/run-mid.png`: the agents at work
3. `design/screenshots/candidate.png`: one space's financial case with sources
4. `design/screenshots/timeline.png`: one lane per agent loop
