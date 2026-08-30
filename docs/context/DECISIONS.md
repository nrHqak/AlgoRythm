# Architectural decisions

## D-001 — Layered context instead of a monolithic prompt

**Status:** accepted.

`AGENTS.md` contains only durable always-on rules. `AI_CONTEXT.md` routes agents to focused documents, and a generated map supplies mechanical facts. This lowers repeated context cost and makes semantic documentation reviewable.

## D-002 — User code executes in a child process

**Status:** accepted.

A thread cannot be safely abandoned after a timeout. `multiprocessing.Process` allows the parent to terminate runaway code; Linux additionally applies an address-space limit. The safe-builtin allowlist and trace limit remain defense-in-depth, not a claim of complete hostile-code isolation.

## D-003 — Split browser and backend Supabase access

**Status:** accepted.

The browser uses the anon client for user-owned state protected by RLS. Privileged session, XP, streak, and achievement writes use the backend service role after bearer-token verification. This avoids routing every low-risk interaction through FastAPI without exposing privileged credentials.

## D-004 — Generated context drift warns by default

**Status:** accepted.

CI surfaces a context warning but does not block merge during the initial rollout. `make context-strict` is available for release hardening or a future required check. Application lint, tests, and build remain blocking.

## D-005 — No initial global coverage threshold

**Status:** accepted.

Coverage is collected for visibility, while tests, lint, and production build gate CI. A threshold can be introduced after the baseline covers enough existing behavior to avoid incentivizing shallow tests.
