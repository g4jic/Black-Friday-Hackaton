# PROGRESS - SuiteSpot

Read this at the start of every session. Update it before every push. Newest entries at the top.
No long dashes in this file; use a plain hyphen.

## Current state
- Nothing built yet. Repo contains `CLAUDE.md`, `2026-11-26-plan-lease-decision.md` and this file.

## Next step
- Plan step 1: repo skeleton (server + web), `@mozaik-ai/core@6.0.0`, mock runner, resilience helpers, domain model
  with tests. Spike the cancellation interception (plan section 8). Check web search and web fetch support for
  `claude-haiku-4-5` with one real call (needs `ANTHROPIC_API_KEY` in `.env`).

## Open problems
- None yet.

## Decisions log
- 2026-11-26: listings come from live web search, no listing database (option 2). Feasibility checked on a real
  Novi Sad listing (plan section 12a). Always read the listing page, not the search snippet.
- 2026-11-26: project SuiteSpot chosen; live web search via Anthropic `web_search` inside our own function tool;
  OpenStreetMap for area data; Supabase for history; Railway for deploy; Stripe and Solana not used.

## For Andrej (needs the Uizze MCP)
- None yet.

## Session log
- 2026-11-26 13:00 (Andrej): planning done, files committed.
