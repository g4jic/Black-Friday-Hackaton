# CLAUDE.md: Team Scope, JigJoy Black Friday AI Hackathon

## Who you are working with
- Team **Scope**: Aleksa Ćupina (owner of the entry) and Andrej Gajić. Both are software engineering students.
- **Talk to the user in Serbian (Latin script).** Code, comments, commit messages and the README are in English.
- The user is on **Windows**. Give commands that work in PowerShell or cmd, and say which one.
- The user will not write most of the code himself, but **he must be able to explain it to the judges**. After every
  meaningful step, explain in a few plain Serbian sentences what you built and why. Keep it short.
- **When something is unclear, stop and ask. Do not guess.** This covers product decisions, scope, anything that costs
  money and anything that is hard to undo. Present options with their pros and cons, free and paid, and let the user
  choose.
- Push back directly when an idea is weak, and propose something better.

## Chosen project: SuiteSpot (decided Thu 26 Nov) - read this first
**SuiteSpot:** a small business fills in a questionnaire and either submits a commercial space it is considering
(mode A) or asks SuiteSpot to find candidates (mode B). Mozaik agents evaluate every candidate at the same time from
different angles and answer one question: **"Is this lease a good financial decision for my business?"**
The full build plan is **`2026-11-26-plan-lease-decision.md`**. Work state is in **`PROGRESS.md`** (read it at the start
of every session, update it before every push). If the plan and this file disagree, ask the user.
- Repo: https://github.com/g4jic/Black-Friday-Hackaton. Local path (Andrej): `C:\Users\Lenovo LOQ\Desktop\SuiteSpot`.
- Two people work in relay through Claude Code CLI in PowerShell: one works, pushes, the other continues.
- Data: live web search (Anthropic `web_search` through our own function tool, same `ANTHROPIC_API_KEY`), OpenStreetMap
  for area data, estimates with method and sources, a labelled synthetic demo dataset plus one recorded real run.
- History of research runs in Supabase (live) or a local JSON file (demo mode). Deploy on Railway.
- Stripe and Solana are not used (no natural fit).
- Never give a legal verdict on permitted use; report "check before signing: <what>".
- **Writing rule:** no long dashes anywhere (UI, docs, comments, commits). Use a plain hyphen `-`.
- UI is English and must look excellent: use Uizze (MCP on Andrej's machine; free skills elsewhere). The README is
  written at the end and must be excellent, it is scored.

## The event (facts, checked 25-26 Nov 2026)
- **Black Friday AI Hackathon** by JigJoy. 26-27 Nov 2026. On site at Science Technology Park Belgrade, or online.
  **We are online.** All times are Belgrade (CET).
- Thu 26 Nov: 10:00 kickoff, when **the brief goes public** (streamed for online teams).
- Fri 27 Nov: 10:00-11:00 pitch preparation talk. 17:00-19:00 demos. **00:00 (midnight Fri→Sat) submissions close.**
  Only the latest submission before the deadline counts.
- Site: https://build.jigjoy.ai · Rules: https://build.jigjoy.ai/rules · Contact: miodrag.todorovic@jigjoy.ai · Discord
  for announcements.
- **One track: AI agents in finance and fintech.** The official brief (published Thu 26 Nov, 10:35) is below.
- The co-host's announcement (Science Technology Park Belgrade, with JigJoy and Raising Starts) lists the challenge areas
  as: payment processing and fraud detection, back office automation, risk assessment and compliance, personal
  finance, and market analysis. It states the goal as "a system in which several AI agents work **concurrently and in a
  coordinated way**". Mentors are available throughout the event; online teams reach them through Discord.
- Organizer's current focus (a hint at what the judges like): **adaptivity, meaning agents that change behavior at
  runtime based on the situation**. Miodrag Vilotijević's "Behavior Rules" design pattern and the standalone
  `@jigjoy/mozaik-rule-engine` (first release 19 Nov 2026; the organizers themselves call the `@jigjoy` packages
  "early and not yet stable"). **Do not use it.** Mozaik's own situation handlers and interception already cover
  adaptivity.
- Prizes: $500 / $300 / $200, plus 6-month Mozaik Cloud Premium for the top 5 teams. Winners are announced on 4 Dec.
- 128 registered participants (checked 25 Nov, 19:00).
- **Model API keys are our own cost.** The site, rules and dashboard never mention organizer-provided keys or credits.

### The official brief (build.jigjoy.ai/tracks/finance, published Thu 26 Nov 2026, 10:35)
Organizer on Discord: "these are just our suggestions, you don't have to follow word for word, if you have another
idea, feel free to submit."

> **Agents in Finance.** Build any system where at least two agents work together on a finance task.
> These are starting points, not a list to choose from. Bring your own problem if you have one.
>
> **Traditional Finance.** Help bank employees and finance teams handle documents, investigate exceptions, and make
> decisions.
> - *From document to SEPA payment draft.* Extract payment details from invoices, emails, or scans. Validate the draft
>   and flag conflicting bank details for review.
> - *Investigate failed or held payments.* Read the transaction status and case notes, explain why the payment stopped,
>   and suggest the next action.
> - *Build a controlled payment agent.* Let an agent prepare payments in a banking sandbox. Apply spending limits and
>   route payments that exceed its authority to a human approver.
>
> **Stablecoins.** Build around the everyday work of sending, receiving, and accounting for stablecoins.
> - *Close the books across Stripe and USDC.* One agent reads Stripe sandbox payments. Another matches stablecoin
>   transfers to orders in the same sales ledger.
> - *Explain a stablecoin depeg.* One agent tracks simulated prices. Another calculates the impact on the company's
>   treasury and upcoming bills.
> - *Split one stablecoin sale across a marketplace.* One agent reads the seller, creator, and platform agreements.
>   Another calculates each share and prepares a batch payout.
>
> **Online Payments.** Use a Stripe sandbox to build agents that help a merchant understand payments and support
> customers. (Link: Stripe MCP documentation, https://docs.stripe.com/mcp)
> - *Explain a failed checkout.* A customer asks why their card payment failed. Inspect the sandbox payment and draft a
>   reply using the reason Stripe recorded.
> - *Turn a quote into a payment link.* A customer accepts a quote by email. Extract the items, verify the amount and
>   currency against the catalog, and create a Stripe payment link.
> - *Investigate a revenue drop.* Combine Stripe payments and refunds with checkout activity. Did fewer people reach
>   checkout, did more payments fail, or did refunds increase?
>
> **Agentic Payments.** Explore what happens when an AI agent has a budget, a wallet, and a reason to pay.
> (Link: Solana Agentic Payments, https://solana.com/developers/docs/payments/agentic-payments)
> - *Give an agent a budget.* Give a purchasing agent $50 in test funds to buy API credits. Can it complete the task
>   and show what it spent?
> - *Let agents hire each other.* A research agent needs a dataset. It requests quotes from other agents, picks a
>   provider, and pays for the result.
> - *Release a freelancer's milestone payment.* One agent checks submitted work against agreed acceptance criteria.
>   Another tracks the coin held for each milestone and prepares the approved release.
>
> **Ground rules:** synthetic or public data only (no real customer data, no real accounts, no real money moving);
> every number has a source (invented numbers cost points); not financial advice (where a user could take the output
> for advice, the system says that it is not).
>
> **For every team:** built on Mozaik ("one agent with a pile of tools doesn't count"); deadline Friday 27 November,
> midnight CET, resubmit as often as you like, the last entry counts; submit a public GitHub repo with a README (what
> it does, the architecture, how to run it), "no video needed"; prizes $500, $300, $200, each entry scored out of 100.

**What the brief means for us**
- The bar to enter is low ("at least two agents work together"), but the rubric and the rules still score
  **concurrency**: "agents in parallel, shared state, checks between them" (30 pts) and, in the rules, "run two or
  more concurrent agents" and "the weight is on genuine use of concurrency".
- 128 people got the same 12 starting points. Many teams will build the obvious ones. Our angle must be clearly ours.
- **The rubric gives no points for using Stripe or Solana by themselves.** Use them only where the problem needs them.
  Forced use makes "Useful" look invented.

## Hard rules (breaking any of them disqualifies us)
1. **Must use Mozaik (`@mozaik-ai/core`) and run 2 or more concurrent agents.** A single-agent project does not qualify.
2. Must fit the track: AI agents in finance and fintech.
3. **Only synthetic or public data.** No real customers, invoices, bank data or personal data. Generate fake data.
4. **The substance must be built during the event.** Frameworks, libraries and boilerplate are fine. Do not copy code
   from other projects, including the user's earlier projects (KontoAI, Rook). Domain knowledge is fine.
5. Everything we submit must be ours or properly licensed. Credit what we use.
6. Required in the submission: **project name, a repository the judges can access (public GitHub), a description, and
   an explanation of how the agents run concurrently.** Recommended: a demo video, a live deployment and screenshots.
   **If the judges cannot open, run or verify a submission, it may be excluded.**

7. **From the official track brief (build.jigjoy.ai/tracks/finance):**
   - "A single agent with many tools does not count." Agents must **work in parallel, share state and check each
     other's work**.
   - **Public GitHub repo** with a README covering what it does, the architecture and how to run it. ("No video
     needed", but we still make one.) Resubmit as often as you like; the last entry counts.
   - **No real customer data, no real accounts, no real money moving.**
   - **Every number an agent reports must point to its source. Invented numbers cost points.**
   - **Wherever a user could read the output as advice, the system must state that it is not financial advice.**

## How we are judged: the official rubric (track brief, 100 points)
| Criterion | Points | What it means for us |
|---|---|---|
| **Useful**: it solves a finance problem someone has | 30 | A real, named user and pain. Show the before/after with numbers. |
| **Multi-agent design on Mozaik**: agents in parallel, shared state, checks between them | 30 | Real concurrency, one shared `RuntimeState`, agents that verify each other (one agent's finding is checked by another against the source). |
| **It works**: we can run it from the README | 25 | Keyless mock mode, one command, works on a fresh clone the first time. |
| **Care with financial data**: sources shown, no invented numbers | 15 | Every figure carries a source reference (document id, line, field, dataset row). A verifier agent or plain code rejects any number without a source. "Not financial advice" notice wherever relevant. |
- Plus, from the rules and the site: "The weight is on genuine use of concurrency"; "agents that actually run together,
  not a sequential pipeline in disguise." Judges include the people who built Mozaik. They will spot fake concurrency.
- **Data provenance is a design requirement, not a README detail.** Every value an agent outputs must be a structured
  object with a `source` field (for example `{ value, currency, source: { docId, field | line | row } }`). Plain code
  checks that the source exists and that the value matches it, before the value enters state. Show this in the UI and in
  the README.
- The official starting points are in the brief above. Expect many teams to build exactly those. Pick an angle that is
  clearly ours.

## How to judge an idea before building it (agreed rules, apply them to every idea)
1. **The ChatGPT test.** If a user could get the same result by pasting their documents into one chat, the idea is
   weak. A strong idea needs at least one of: volume (many items at once), time (events keep arriving and the system
   reacts), actions with consequences (with human approval), auditability (every number traced to a source).
2. **An agent only where reading, judging or writing is needed.** Math, status checks, thresholds, limits, currency
   conversion and lookups are plain code (domain methods or tools), never an "agent". The judges include the creator
   of Mozaik and will spot code dressed up as agents.
3. **No artificial role splits.** Split roles only where inputs, expertise or accountability genuinely differ (for
   example maker and checker, the four-eyes principle). Do not invent extra "checkers" to look parallel.
4. **Where concurrency honestly comes from:**
   - volume: the same agent role runs as several parallel loops over many items;
   - independent parallel reviews of the same item by roles that genuinely differ;
   - reactions mid-run: one agent's finding changes shared state and others react while still working;
   - checks between agents: an independent agent verifies another agent's claims against the source.
   A single decision for a single user tends to become a chain (A, then B, then C). If the design reads like a chain,
   add volume or redesign.
5. **Check that the platform does not already do it.** Example: Stripe already offers "Smart Disputes" (AI-assembled
   dispute evidence), so a plain Stripe dispute-evidence agent would be answered with "why not use Stripe?".
6. **State the holes upfront**, with the idea, not later.
7. **Numbers we cannot source reliably are out of scope.** Example: Serbian lump-sum (paušal) tax is set by an
   individual Tax Administration decision, not by a formula we can apply, so we never "calculate" it.

## The jury (know who scores the "Useful" points)
- **Luka Maljković**, CEO of Ralt, an alternative bank for people whose finances go beyond a traditional paycheck
  (freelancers, founders, irregular income). Serial entrepreneur. He judges real usefulness in finance.
  From his LinkedIn: founder of Ralt / Nonresident Bank, "borderless banking" for international entrepreneurs,
  investors and global users who need access to the U.S. financial system. He also runs Nonresident Investor (U.S.
  real estate for foreigners, investor mortgages, LLC company formation). He talks about Banking-as-a-Service (BaaS),
  community banks and partnerships, attends Money20/20 and Fintech Meetup, and posts data-driven research (for example
  ranking U.S. cities for Airbnb investing by median home price, listings, occupancy and local regulations). What
  resonates with him: a real B2B use case a bank or fintech would pay for, cross-border and non-resident customers,
  onboarding and compliance (KYC/KYB), lending and underwriting, and research backed by real metrics with sources.
- **Dragan Trifunović**, Consulting Technical VP at Oracle. Enterprise AI and mission-critical platforms for
  governments and large companies. He judges robustness, auditability and enterprise realism.
  From his LinkedIn:
  - "We are moving beyond the stage where the value of AI is measured by how well it can generate an answer." What
    matters is AI inside how organizations actually work and decide: **connecting information, testing scenarios,
    making predictions and showing the evidence behind its recommendations.**
  - **Human judgment and accountability must remain part of the process.** → Human approval through interception, plus
    a clear audit trail of who (agent or human) decided what and why.
  - **E-invoicing**: he shares Unified SSK (Dubai, e-invoicing and compliance) and a Billentis report on multinational
    e-invoicing. To him, e-invoicing is "a strategic foundation for tax transparency, real-time compliance, automation
    and cross-border digital trade" (for example the UAE Peppol mandate). → An e-invoicing or compliance angle speaks
    directly to him.
  - "Actionable recommendations, not just insights. Real data, stable models, seamless integration into
    decision-making processes." → Output a decision or next action with its evidence, not a chat answer.
  - Regulation differs by country (data rules, AI governance, export controls). → Country-specific rule sets in the
    domain model are a plus.
  - Oracle background, MBA: enterprise realism, integration with existing systems, auditability.
- **Uroš Đoković**, Innovation Advisor at STP Belgrade. He judges innovation and potential.
  From his LinkedIn: he builds international partnerships and runs support programs for startups and SMEs. He leads
  Ready4EIC workshops (innovation diagnostics and preparation for EU funding: EIC, Horizon Europe), works in CIPS EDIH
  (European Digital Innovation Hubs that help SMEs adopt new technology), hosts foreign business delegations (German,
  Dutch, Canadian, Uzbek) and is connected to the Raising Starts startup program, a co-organizer of this hackathon. He
  shares posts on getting past the pilot stage ("a prototype can perform flawlessly in a lab, but if it fails
  certification..."), on validation in real operating environments and on scaling across borders. One of his
  workshop exercises is an "Assumption stress test". What resonates with him:
  - **A clear customer and business case**: who exactly uses it (for example Serbian SMEs and their accountants) and
    why they would pay.
  - **Market potential beyond Serbia**: show how it scales to the EU or the region (rules as swappable per-country
    modules).
  - **A path from prototype to real deployment**: what is needed to go live (integrations, compliance,
    certification), stated honestly.
  - **Tested assumptions**: in the README and the pitch, name the key assumptions and how the demo checks them.
  - **SME digital transformation**: technology that small companies can actually adopt (low cost, simple setup).
- **Aleksandar Hadžibabić**, builder of beaver.rs, AI-native software engineer. He judges engineering quality.
  From his LinkedIn: he builds the Serbian AI/dev community with Vilotijević (beaver.rs; Devin, Cursor and Grok Bot
  hackathons and meetups; SpaceXAI and Cognition ambassador). He ran a workshop on **agentic loops for building
  software** and discussed **legal frameworks around enterprise AI**. He reshares projects that were **"built,
  deployed and presented fully working"** in hours, and talks on distributed-systems reliability (idempotency,
  retries with exponential backoff, dead-letter queues, event ordering). What resonates with him:
  - **A live deployed demo** (a URL that works in mock mode), not only localhost.
  - **Clean, professional architecture.** JigJoy's internship for the top students of the last hackathon taught
    exactly this: **Domain-Driven Design, layered and hexagonal architecture, design patterns, structuring and
    managing LLM context, and "loop engineering" for AI agents.** That is the house style. Structure the repo
    accordingly:
    `src/domain/` (entities, value objects, invariants, typed domain errors, no I/O, no LLM),
    `src/application/` (participants, situation handlers, interception policies, the runtime),
    `src/adapters/` (model providers, the mock runner, data loaders, the UI/API, Mozaik Cloud).
    The domain never imports from adapters.
  - **Reliability**: idempotent tools (processing the same item twice changes nothing), retries with backoff on provider
    errors, a "failed items" queue instead of crashes, and deterministic ordering of our own domain events.
  - From his X: he studies **observability** (OpenTelemetry, the Google SRE book), **formal verification and
    security**, privacy, a **multi-provider LLM gateway** (one inference interface, provider adapters, model capability
    checks; different labs' models for different roles) and **cutting costs** ("the real edge isn't earning more, it's
    spending less"). → Trace every agent step (Mozaik Cloud plus our JSONL trace), keep the provider behind one adapter
    so models are swappable per agent, and report cost per run.
  - **Responsible AI**: an audit log of decisions, a human in the loop for consequential actions and a clear statement
    of limitations.
- **Note:** at the October edition, the top 3 students also got a 2-week JigJoy internship. Check whether this edition
  offers the same. A strong, cleanly architected entry is also a job application.
- **Miodrag Todorović**, JigJoy co-founder (Mozaik Cloud, baro). **Miodrag Vilotijević**, JigJoy CEO and creator of
  Mozaik. They judge Mozaik usage and concurrency.
- More judges may be added. At the last edition, 17 finalists were scored by a jury of 7.
- The site says registrants get a starter template and a primer before kickoff. As of 25 Nov, 19:00, no JigJoy email
  had arrived. If a starter template arrives, check it before starting from scratch.

## Mozaik: pin to exactly 6.0.0 (checked 25 Nov 2026)
- **Install exactly `npm install @mozaik-ai/core@6.0.0` and pin it in package.json (no `^`).**
- 6.0.0 was published on 25 Nov 2026 and is **byte-for-byte identical to 4.2.0** (same `dist/`, same README, same
  dependencies). It is the v4 multi-agent runtime (`defineRuntime`, `runLoop`, situation handlers, interception).
  4.1.0 and 4.2.0 are also identical.
- The official examples (github.com/jigjoy-ai/mozaik-examples) switched to 6.0.0 the same day. Their README says:
  "`@mozaik-ai/core` is finished: 6.0.0 is its final version ... Version 5.x is deprecated." New work happens in the
  `@jigjoy/mozaik-agent`, `@jigjoy/mozaik-network` and `@jigjoy/mozaik-rule-engine` packages, which are "still early
  and not yet stable". **Do not use them, and never use 5.x** (a single-agent breakpoint harness, now deprecated).
- In v4/v6, `InterceptionHandler` is the equivalent of a loop breakpoint, so name it that way in the README ("each
  consequential step is held at a breakpoint before it runs") to speak the judges' language.
- Before relying on an API, read the installed types in `node_modules/@mozaik-ai/core/dist/index.d.ts` and the matching
  example. Do not invent APIs.

### Mental model
- One **runtime** is the shared room. Humans, agents and observers are all **participants** that `join` it.
- **There is no central scheduler.** Every event (a message, an inference, a tool call, an answer) is delivered to every
  participant. Each participant decides for itself, through **situation handlers**, whether to react.
- **Concurrency:** `runLoop` is fire-and-forget. Each call gets its own `loopId`, so several agents (or several loops of
  one agent) think and call tools at the same time.
- **Awareness:** typed shared `RuntimeState` that every participant reads and writes. It is the only shared store.
- **Adaptivity:** handlers react to what happened. **Interception decides what happens next.**
- "Agents are not called. They notice."

### API cheat sheet (v4)
```ts
import { defineRuntime, RuntimeState, createAgent, createHuman, SituationSpecification,
         Agent, type SituationHandler, type SituationContext, type Tool,
         type InterceptionHandler } from "@mozaik-ai/core"

class AppState extends RuntimeState { /* shared data: queues, ledger, flags, budgets */ }

// The returned functions are NOT package exports. Define them once in runtime.ts and re-export them.
export const { initializeRuntime, resolveRuntime, resolveParticipant, join, leave,
               sendMessage, sendEvent, runLoop } = defineRuntime<AppState>()

initializeRuntime({ state: new AppState() })          // exactly once; a second call throws

class WhenOthersSendAMessage extends SituationSpecification {
  isSatisfiedBy({ event, participant }: SituationContext): boolean {
    return event.type === "message.sent" && event.producerId !== participant.getId()
  }
}

const thinkOnMessage: SituationHandler = {
  specification: new WhenOthersSendAMessage(),
  processor: {
    apply({ event, participant }) {
      if (!(participant instanceof Agent)) return
      const { message } = event.payload as { message: string }
      runLoop(participant.getId(), message, {                 // NO await
        model: "MODEL_NAME",
        context: participant.getMemory().getContext(),
        tools: participant.getTools(),
      })
    },
  },
}

const agent = createAgent({ name: "Assistant", capabilities: ["inference"],
  instruction: "You are a helpful teammate.", tools: [], handlers: [thinkOnMessage] })
const human = createHuman({ name: "User", capabilities: [], handlers: [] })
join(human); join(agent)
sendMessage("Hello", human.getId())
```
- **Never `await` `runLoop` or `sendMessage` inside a processor.** Both return at once while the runtime keeps
  delivering events. Awaiting turns concurrency into a sequence.
- `runLoop(agentId, message, inferenceInput, interceptionHandler?)` is a state machine: `context_update` → `inference`
  → (`function_call` → `inference`)* → `model_message` → `idle`.
- `InferenceInput`: `model` (required), `context` (required), `tools`, `maxOutputTokens`, `reasoningEffort`,
  `streaming`, `structuredOutput` (JSON Schema). **Use `structuredOutput`** whenever another participant or plain code
  consumes an agent's answer.
- Events on the bus: `message.sent`, `participant.joined/left`, `context_update.started/completed`,
  `inference.started/completed` (with `items` and `tokenUsage`), `inference.stream` (with `streaming: true`),
  `function_call.started/completed`, `model.answer`, `interception.started`. Publish your own domain events with
  `sendEvent`.
- **Tool:**
  `{ type: "function", name, description, parameters: <JSON Schema, additionalProperties: false>, strict: true, invoke: async (args) => result }`.
  The model only proposes a call. The loop runs `invoke` and appends the result to the context.
- **Interception** (4th argument of `runLoop`): `isSatisfiedBy(transition)` plus `async handle(transition)`. It **is
  awaited**: the loop waits for it. It can rewrite `input`, change `nextStateId`, veto a step or wait for a human or
  another agent. When you reject a tool call, still answer it with an output such as "Not executed: rejected by X", so
  the model can revise its plan.
- Providers read keys from the environment: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`. DeepSeek goes
  through `OPENAI_API_KEY` plus `OPENAI_BASE_URL`. A custom `InferenceRunner` and `supportedModels` go in
  `initializeRuntime({ state, inferenceRunnerConfig: { supportedModels, runner } })`.
- **Mock runner** (keyless runs): see `mozaik-examples/custom-inference-runner/src/runner.ts`. It implements
  `InferenceRunner` with `run(input)` and `stream(input)`, and returns `ModelMessageItem.rehydrate({ text })`.

### Runtime behavior (tested on 6.0.0 with a mock runner, Node 22, 25 Nov 2026)
- **Concurrency is real.** Three agents whose mock model takes 1000 ms each all finished at about 1005 ms. All three
  `runLoop` calls returned immediately.
- **Keyless mode works.** `initializeRuntime({ state, inferenceRunnerConfig: { runner: new MockRunner() } })`.
- **A tool that throws does NOT crash anything.** The loop catches it and hands the model the text
  `"Error calling tool: Error: <message>"`; the model then answers. This is the built-in path for "a domain error is
  feedback": throw a typed `DomainError` with a clear message inside the tool and the agent reads it.
- **An error from the model or provider (inside `InferenceRunner.run`) CRASHES THE WHOLE PROCESS.** `runLoop` does not
  catch the loop's promise, so it becomes an unhandled rejection and Node exits with code 1. Every agent dies.
- **An error thrown inside any participant's situation processor (`apply`) also CRASHES THE WHOLE PROCESS.** `publish`
  is synchronous: it calls every participant's handlers in a plain loop, so the throw travels back into whoever
  published, including another agent's loop.
- **An interception `handle` that returns `nextStateId: "idle"` crashes the process.** Never return `idle` from
  `handle`. To stop a step, rewrite the input instead (for a rejected tool call, answer with "Not executed: rejected by
  X").
- `publish` is synchronous and re-entrant, so participants can see events in different orders. If we need ordering for
  our own domain events, use an outbox queue.
- **Required from day one (this is boilerplate, allowed before kickoff):**
  1. A resilient `InferenceRunner` that wraps the real one: retries with backoff on provider errors, and after the last
     retry returns a model message such as "Inference failed: <reason>" instead of throwing. Also emits an
     `agent.halted` domain event.
  2. A helper that wraps every processor's `apply` in try/catch and logs the error instead of throwing.
  3. A last-resort `process.on("unhandledRejection")` / `process.on("uncaughtException")` handler that logs and keeps
     the process alive.
  4. An end-to-end test that proves one failing agent does not stop the others.

### Mozaik Cloud (live view of the loops; free trial covers the hackathon)
- Sign in at https://app.jigjoy.ai. Pair each machine once in the project folder: `npx @mozaik-ai/cloud-sdk pair`. The
  key is saved to `~/.mozaik/credentials.json`. Alternative: `MOZAIK_API_KEY=pk_...` in `.env`.
- **Cloud is automatic. Do not add the exporter.** The core's loop already calls `createCloudClient()` and sends every
  loop event when a key is found. Without a key it prints "mozaik cloud: no API key - telemetry disabled" and the app
  runs normally. Adding `createCloudExporter` would duplicate sessions.
- So the app runs without an account by default; no extra flag is needed.
- **The Cloud timeline is our proof of concurrency.** Put a screenshot and a shared run link in the README.

## Lessons from the October winners (all three on Mozaik 4.1.0, all TypeScript)
1st **Bringup** (hardware design agents) · 2nd **Intersection** (traffic lights; first-year FTN Novi Sad students) ·
3rd **Quorum** (meeting agents).

What they all did, and we copy:
- **No orchestrator.** Nobody calls or awaits anybody. Situations are the dependency graph: each participant's
  specifications decide what wakes it.
- **Shared `RuntimeState` as the single source of truth** (Bringup: a design contract whose fields each have an owner
  and a version; Quorum: room state with claim locks, a semaphore and a token budget).
- **They proved concurrency instead of claiming it.** Quorum prints a lane chart per agent and "peak N agents busy at
  once". Intersection draws overlapping agent requests on a timeline. Bringup reports how many agents woke and how long
  it took. All of them showed Mozaik Cloud.
- **Interception used for real decisions**: human approval of consequential tool calls, agent-to-agent veto (Quorum: the
  Fact-Checker rejects a pending action built on a false claim while that loop is still paused), and change control
  (Bringup: a change to another owner's field is held until the owner decides).
- **State-based triggers, not keywords** (Quorum's Devil's Advocate fires when the state shows consensus without
  dissent).
- **It runs without API keys.** A mock or scripted mode with a custom `InferenceRunner`, so judges can run it in a minute.
  Real models are optional through `.env`.
- **A README a beginner can follow.** One-command quick start, Node version, `.env.example`, troubleshooting. A hero GIF
  or screenshot at the top, a 2-3 minute demo video, an architecture diagram (Mermaid), and a "how the agents run
  concurrently" section with a table of mechanisms linked to files.
- **Honest scope**: a table of what is real and what is mocked or scripted. Intersection says outright that the
  simulation does not prove that AI always wins.
- **Robustness**: failure isolation, so one broken agent never stops the room, plus retries, timeouts, a deterministic
  fallback and a deterministic safety or validation layer in plain code around the LLM decisions.
- **Plain-code participants** next to LLM agents (checkers, moderators, archivists, a UI tap). Not everything needs a
  model.

What was weak, and we avoid:
- **Bringup**: a huge toolchain (about 9.6 GB, Docker, KiCad), so the live demo had to be stubbed and much of it was
  scripted. The README is very dense. → Keep our setup light: Node only, nothing else to install.
- **Intersection**: only 2 concurrent agents plus an extra paid third-party service (its own fork and another API key).
  Much effort went into a 3D UI. → Aim for 4-6 participants where concurrency is natural. No extra required services.
  Keep the UI simple.
- **Quorum**: very wide scope (a full WebRTC video-meeting app) and a second required key (Tavily). → One clear core
  loop that works perfectly, rather than many half-features.
- **The official `human-in-the-loop` example is already a payments demo** (queue transfers, approve those over $50).
  Many teams will clone it. → Do not build a thin variation of it.

## Projects the organizers chose to showcase (October edition, posted by Todorović on X)
Read these as "what JigJoy considers a great Mozaik project". Note how each is pitched in one line with concrete
numbers:
- **Counterbill**: "Dispute freight bills in minutes. **Six agents read the documents, code does the math**, and the
  case updates when new evidence arrives: ₦298,100 → ₦189,700 → ₦54,200." (Finance, live re-computation, LLMs read,
  code calculates.)
- **Quil**: "An AI sales crew for freelancers. Five agents find the business, check the evidence, and write the hello.
  **One of them pulls the pitch if the facts don't hold.**" (Agent veto on evidence.)
- **Spona**: "489 company problems, 1,047 researchers. Read them all in under 6 minutes, **for $1.52**. **19 agents at
  once**, with **a critic that sends back any claim it can't find in the records**." (Scale, time, cost, grounded
  critic.)
- **Archilles**: "Upload a floor plan, and a team of Mozaik agents checks it against the building code. **Every issue
  comes with the exact article it breaks. Fix a dimension, and it rechecks instantly.**" (Rules with citations, live
  recheck.)
- **Custodian**: "A firewall for AI agents. Agents respond to an incident, but **nothing runs until the firewall
  checks every action**." (Interception as a policy gate.)
- Plus BringUp, Quorum and Mori.
Common pattern for us: **LLM agents read and propose; plain code calculates and enforces rules; a critic checks every
claim against the source; changes trigger an instant recheck; the pitch gives counts, time and cost.** Write our
one-line pitch in the same shape before building.

## The judge's own design philosophy (follow it, it is how we score points)
Miodrag Vilotijević, who created Mozaik and is on the jury, argues this in his blog post "Why AI Engineers Are Building
Multi-Agent Systems From the Wrong Direction" (mozaik.jigjoy.ai/blog/building-multi-agent-systems-from-the-wrong-direction)
and in JigJoy's dev.to articles:
- **Model the domain first, not the workflow.** In order: the process, the state, the invariants, what is allowed and
  what is impossible. Then give agents tools to act on that model. Do not start from "agent A, then agent B".
- **Business rules live in code, not in prompts.** His example: "Never approve a claim above €10,000 without human
  review" must not be a prompt line. `claim.approve()` throws a `DomainError("Claims above €10,000 require human review")`.
- **A domain error is feedback, not a crash.** The error goes back into the agent's context, and the agent reasons:
  retry, pick another tool, request human approval or revise the plan. "Autonomy comes from a well-defined environment,
  not from more freedom."
- **Agents work concurrently and independently against one shared domain model** (our `RuntimeState`), which keeps
  itself consistent. This is the direction of the next Mozaik version.
- Against a central controller deciding turns. Against sequential hand-offs. Against anemic domain models. Typed
  handlers per event kind. Separate "my own outputs" from "events from others". The UI only displays; observers listen.
- **For us:** a rich domain model in plain TypeScript (entities with methods that enforce rules and throw typed domain
  errors) inside `RuntimeState`. Agent tools call those methods. Show in the demo an agent hitting a domain rule,
  reading the error and adapting, for example by requesting approval through interception. In the README, name the
  invariants in a table ("rule → where it is enforced → what the agent does when it hits it").

## What the second co-founder values (Miodrag Todorović, "Lotus" on Discord, the event contact)
He is a QA Automation Engineer. Judging from what he shares on LinkedIn:
- **He will try to run it.** Assume a tester clones the repo on a clean machine and follows the README word for word.
  It must work the first time, with no API key (mock mode), in under 2 minutes. No hidden steps, no "works on my
  machine". Pin versions, commit the lockfile, state the Node version, add `.env.example` and a troubleshooting table.
  Test this yourself on a fresh clone before submitting.
- **Tests and reliability matter.** Unit tests for the domain rules (every invariant has a test that proves the
  violation is rejected), one end-to-end mock run in CI or as `npm test`, and graceful failure: a provider error or a
  bad model answer must never crash the run.
- **One strong visual sells the project.** He reshared Intersection's side-by-side "traditional vs AI" image. Give us
  one hero image or GIF that shows the value at a glance, for example a before/after: "manual: N minutes, agents: M
  seconds, K rule violations caught". Put it at the top of the README and in the video.
- **Presentation counts.** A shared post from a participant put most of his own time into the presentation and a short
  video while the agents wrote the code. Plan for this: Friday afternoon goes to the demo video, screenshots and README
  polish, not to new features. Feature freeze on Fri 18:00.
- **Something real and measurable.** He posts real numbers (visitors, growth). Show real metrics from our runs: items
  processed, time, peak agents in parallel, rule violations caught, tokens and cost.
- Online teams can win: at JigJoy's online September hackathon (210 registrations, 83 countries, 40 projects), 2nd place
  went to an online participant.

## Summary: what wins with this jury
1. Genuine concurrency, proven with a timeline, "peak agents at once" and Mozaik Cloud.
2. A rich domain model: rules and invariants in code, typed domain errors, agents that adapt when rejected.
3. Adaptivity: behavior that changes at runtime based on state, through situation handlers and interception.
4. Human or agent approval on consequential actions, through interception.
5. It runs from the README on the first try, with no key, plus tests for the rules.
6. One clear visual and a 2-3 minute video with real numbers.
7. Honest scope: what is real and what is mocked.
8. Every number has a source, nothing is invented, and a "not financial advice" notice is shown where relevant
   (15 points on their own).

## How we build
1. **Brief → plan, before code.** After kickoff, write a short plan: the problem, the participants (name, trigger
   situation, what it does, LLM or plain code), the shared state, the domain events, the interception points, and what
   the demo shows. **Show it to the user and wait for approval.**
2. **Concurrency by design.** Each agent wakes on events or state, never on a direct call. Work in parallel across items
   (many transactions or invoices at once) and across checks (several agents on the same item at once). Agents must
   react to each other mid-run. If the design reads "A finishes, then B, then C", redesign it.
3. **Thin vertical slice first**: runtime, 2 agents in mock mode, an end-to-end terminal run, Cloud connected. Then add
   agents, then real models, then the UI.
4. **Keyless mode from day one** (mock `InferenceRunner`, deterministic seed data), real models behind `.env`.
5. **Small model tiers** (mini or flash) for most agents, to save cost and rate limits. Cap concurrency with a semaphore
   in state, so free-tier rate limits do not kill the demo.
6. **Concurrency evidence built in**: a per-agent timeline or lane chart in the terminal or UI, "peak agents busy at
   once", and a JSONL trace of events.
7. **Safety in plain code**: validate every LLM output (`structuredOutput` plus a schema check) before it changes state.
   Money-moving or booking actions go through interception (human approval or another agent's veto).
8. **UI from the start, built with Uizze.** The live research view is the hero of the demo. The engine still comes first in each slice: logic is scored, the UI makes it visible.
9. Git: a **public repo** from the start, small commits with clear messages, `.env` in `.gitignore`, and an
   `.env.example` committed. **Never print or commit keys.**
10. Tests only for the core logic (state rules, validators), plus one end-to-end mock run that must pass before every
    push.

## Stack
- Node.js 22 or newer (Andrej has Node 26), TypeScript (strict), `@mozaik-ai/core@6.0.0`, `dotenv`, `tsx`.
- Web: Vite + React + TypeScript + Tailwind frontend; Fastify server running the Mozaik runtime and streaming events
  with Server-Sent Events. One service on Railway. History in Supabase (live) or a local JSON file (demo mode).
- Area data: OpenStreetMap (Nominatim + Overpass), free, no key; real `User-Agent`, max 1 request per second.

## Uizze (UI references and design skills)
- The Uizze MCP (`https://uizze.com/mcp`) is installed and signed in only in Andrej's Claude Code CLI. Tools:
  `find_ui_references` (1-3 real screens for ONE concrete design question) and `find_ui_materials` (fonts, icons,
  animated icons, design packs).
- Free skills from `uizze/uizze` (install with `npx skills@latest add uizze/uizze`): `uizze-ui` (image-first: target
  image, implement, render, compare, fix), `ui-design`, `anti-ui-slop` (design contract and finish gate),
  `image-to-ui`, `ui-radar`.
- Rules: use the project's own design system first; search only for an unresolved design question; 1-3 results;
  inspect the images; never copy other apps' branding; keep font and icon license notices; never fake Uizze output.
  A design pack becomes `DESIGN.md` only after the user picks it.
- In a session without the MCP, use the skills and `DESIGN.md`, and note design work that needs the MCP in
  `PROGRESS.md` as "for Andrej".
- **Model key: Anthropic**, from the user's own Anthropic Console account (`ANTHROPIC_API_KEY` in `.env`). The user
  manages the budget himself. Default model: `claude-haiku-4-5` (cheapest model in Mozaik's bundled list). Mozaik
  6.0.0's bundled Anthropic names are `claude-haiku-4-5`, `claude-sonnet-4-6`, `claude-opus-4-7`, `claude-opus-4-8`.
  Newer models (for example the 5.5 family) are NOT in the bundled list; using one needs a custom `supportedModels`
  entry. First real-key run: verify `claude-haiku-4-5` still answers.
- Organizer keys: none. See "Tools we were pointed to" below for what app.jigjoy.ai keys are and are not.

## Tools we were pointed to (checked 26 Nov 2026)

### app.jigjoy.ai (JigJoy Cloud, Pro plan on Andrej's account)
- A hosted product where you create agents through a UI ("name an agent and tell it the job"), with built-in web tools,
  automations, runs, traces, a Network (500 messages free), Deployments and API Keys. Models listed as "included in
  your plan": `claude-sonnet-5-5`, `claude-haiku-5-5`, `claude-haiku-4-5`, `claude-sonnet-4-6`.
- **Its API keys start with `jjk_` and only call agents deployed inside app.jigjoy.ai over HTTP** (the dialog says "It
  calls all your deployed agents"). They are not an Anthropic/OpenAI key and do not work as `ANTHROPIC_API_KEY` for
  `@mozaik-ai/core`. Never commit them.
- **We do not build the entry from UI agents in app.jigjoy.ai.** The rules require `@mozaik-ai/core` and a public repo
  the judges can run from the README. Open question to the organizers if in doubt.
- What we DO use it for: **Mozaik Cloud tracing.** Run `npx @mozaik-ai/cloud-sdk pair` once in the project folder,
  approve in the browser, and every run appears live in app.jigjoy.ai (Automations → Traces). The key lands in
  `~/.mozaik/credentials.json`; `MOZAIK_API_KEY=pk_...` in `.env` also works. Without a key the app still runs.

### Stripe (online card payments)
- Stripe lets online businesses accept card payments, invoices, payment links, refunds and disputes. **Sandbox / test
  mode** is free with any Stripe account: same API, fake money, test cards (for example `4242 4242 4242 4242`). Test
  keys start with `sk_test_`. Everything shows live in the Stripe Dashboard.
- **Stripe MCP** (`https://mcp.stripe.com`, docs.stripe.com/mcp): tools for agents to read and write Stripe data
  (customers, charges, PaymentIntents, checkout sessions, invoices, payment links, refunds, disputes, products, prices,
  balance, payouts, events). Auth: OAuth, or an **agent API key** as a Bearer token. Stripe says that from 11 Jan 2027
  MCP stops accepting full-access secret keys and non-agent restricted keys. Some actions (for example creating a
  refund) require **human confirmation in the Stripe Dashboard**.
- `@mozaik-ai/core` exports `McpClient` and `McpToolRegistry`, so Mozaik agents can use MCP tools directly. Plain
  `stripe` npm SDK calls with a test key are the simpler alternative.
- **Stripe is not available to businesses registered in Serbia.** A story that says "a Serbian business takes payments
  with Stripe" is not credible; use a non-Serbian business or a platform registered elsewhere.
- Stripe already ships AI features (for example Smart Disputes). Check before building something it already does.
- For keyless judging: record Stripe responses as fixtures and replay them in mock mode.

### Solana (blockchain payments, stablecoins)
- A public blockchain. Payments move as **stablecoins** (for example USDC, 1 token = 1 USD) in seconds, worldwide, for
  a small fee. Every transfer has a public **transaction signature**, which is a perfect "source" for a number.
- **Devnet** is Solana's test network with free test money (from a faucet). We can also mint our own test token on
  devnet, which keeps the demo fully under our control.
- "Agentic payments" (the brief's link): a client pays per HTTP request. The server answers `402 Payment Required` with
  a price, the client signs a stablecoin payment on Solana, retries and gets the data. Protocols named on that page:
  **x402**, **MPP** (Machine Payments Protocol, not the same as MCP) and **Pay.sh**.
- Any "escrow" we build in two days is an app-controlled wallet, not an on-chain escrow program. Say so in the README.
- For keyless judging: a mock chain adapter that returns recorded signatures.

## Submission checklist (done before Fri 22:00, leaving 2 hours of buffer)
- [ ] Public GitHub repo, and a fresh clone runs from the README in keyless mode.
- [ ] README: one-line pitch, hero image or GIF, demo video link, quick start (keyless), optional real-model setup, "How
      the agents run concurrently" (mechanism table + Mermaid diagram + Cloud screenshot or link), the agent team table,
      what is real and what is mocked, limitations, credits ("Built on @mozaik-ai/core 6.0.0 by JigJoy").
- [ ] All data synthetic or public, and stated in the README.
- [ ] Every figure in the output and the UI shows its source. No invented numbers. A "not financial advice" notice
      in the UI and the README wherever relevant.
- [ ] Demo video, 2-3 minutes: problem → live run with agents overlapping → interception moment → result.
- [ ] Submission form: name, repo link, description, concurrency explanation.
- [ ] Final check: clone into a new folder, follow the README exactly, it works.
