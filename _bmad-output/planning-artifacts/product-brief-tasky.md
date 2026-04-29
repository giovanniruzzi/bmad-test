---
title: "Product Brief: Tasky"
status: "complete"
created: "2026-04-29"
updated: "2026-04-29"
inputs:
  - user brain dump (in-conversation)
  - web research report (todo app competitive landscape, in-conversation)
phase: "Phase 0 — Foundation Build"
codename: "Tasky (placeholder)"
---

# Product Brief: Tasky

> **Honest framing.** This brief covers **Phase 0** — a deliberately minimal, single-user todo application that proves the core experience and establishes a clean technical foundation. Commercial positioning is *intentionally deferred* to Phase 1. Phase 0 is base camp, not the summit.

## Executive Summary

Tasky is a single-user, full-stack todo application built around a simple thesis: **the todo space doesn't need another feature-rich app — it needs one that stays minimal on purpose, ships polished, and respects the user's data.** Phase 0 delivers a deployed, working application that lets one person add, complete, and delete tasks with zero friction, zero onboarding, and zero feature creep — the kind of "boring done well" that the market keeps asking for and rarely gets.

The opportunity is timing, not novelty. Incumbents like Todoist and Any.do are visibly bleeding goodwill through paywall erosion and feature bloat; Wunderlist refugees still haven't found a permanent home; "minimalist" indie players (Tasks.org, Logseq Tasks) lack design polish, while polished options (Things 3) are Apple-locked. There is a quiet, durable gap for a cross-platform, web-based, design-conscious, **data-portable** alternative — but earning the right to address that gap requires first proving you can build the boring 20% beautifully.

Phase 0 is that proof. It ships today, runs on a self-hosted VPS, uses a conservative React + Node + Postgres stack, and is architected so that the most likely future commercial wedge — **local-first / privacy / data-portability** — remains achievable without rewrites. No premature roadmap. No fantasy GTM. Just a clean foundation, deployed.

## The Problem

Anyone who has tried to keep track of personal tasks digitally has met the same pattern: the app starts simple, then grows projects, labels, filters, AI assistants, calendar fusion, team seats, theme stores, and a paywall that keeps moving. The thing you actually wanted — *write down a task, see it, mark it done* — is now buried under a sidebar of modes you don't use.

The pain is consistent and quotable across r/productivity, App Store reviews, and HN threads:

- *"Todoist used to be simple, now it's a mini-Asana."*
- *"I left after 8 years — they keep moving features behind the paywall."*
- *"Wunderlist was perfect. Nothing has replaced it."*
- *"$5/month to write down what I need to buy."*

The cost of the status quo isn't catastrophic — it's *quietly degrading*. Users churn between apps every 12–18 months, lose context every migration, and many give up and go back to paper or a notes-app checklist that doesn't sync. Meanwhile, the apps that *do* stay simple (Apple Reminders, MS To Do) trade simplicity for ecosystem lock-in or sync flakiness. There is no polished, cross-platform, web-first, design-conscious option that publicly commits to staying small.

## The Solution

A web-first todo application that does four things, fast: **see your list, add a task, complete a task, delete a task.** Open it and your todos are there. Add one and it appears instantly. Tap done and it's visually distinct. No login, no project tree, no priority flags, no due dates, no notifications, no theme store. Works on desktop and mobile. Polished empty, loading, and error states. Survives refresh and session loss without losing data.

Beneath the surface, a small REST API persists the data to Postgres. Optimistic UI updates make every interaction feel instant. The whole thing is deployed to a self-hosted VPS the same day it's built. The user opens the URL, sees an empty list, types a task, and starts using it — no explanation required. That's the experience bar.

## What Makes This Different

**Today, no commercial differentiation — but four discipline markers earn the right to claim one later:**

- **Stays minimal on purpose** — no sidebar full of "modes for later," no schema fields reserved for premium features, no paywall scaffolding. The product is conceptually whole, not a free tier disguised as a product.
- **Velocity as discipline** — brief-to-deployed in a day is itself the proof of restraint. You cannot bloat what you built in 24 hours. Same-day ship is the *first concrete evidence* of the minimalism thesis, not a logistics note.
- **Zero third-party SaaS dependencies** — no Vercel, Supabase, Auth0, Firebase, Stripe. Postgres dump = full backup. Any VPS = valid host. No platform can deprecate, reprice, or sunset Tasky out from under its users.
- **Boring tech, fast iteration** — React + Node + Postgres is conservative on purpose. Stack chosen for shipping and forkability, not novelty.

**Concrete portability commitments (architectural, not aspirational):**
- Tasks table includes a nullable `owner_id` column today; no other auth scaffolding. Multi-user is a column-fill away, not a rewrite.
- Schema is documented in the README; full data export = `pg_dump`. Markdown/JSON export endpoint deferred to Phase 1 but not blocked by Phase 0 design.
- Refused today: any third-party SDK, any proprietary data format, any paywall-shaped feature flag.

**The future wedge** — should Phase 1 pursue it — is local-first, privacy-respecting, data-portable productivity for users tired of subscription paywalls and cloud lock-in. Phase 0 doesn't claim that ground; the constraints above preserve the right to claim it later.

## Who This Serves

**Phase 0 user:** any individual who needs a todo list and opens the URL. No persona narrowing for the *product*; the success bar is "a generic individual can complete every core action without guidance."

**Phase 0 primary stakeholder:** the builder (Gio). The brief, the build, and the deployment all happen in one day on owned infrastructure. Dogfooding is implicit — if it isn't usable enough for the builder to keep using, it isn't done.

**Latent Phase 0 audience (free distribution, zero commitment):** the homelab / `/r/selfhosted` / privacy-conscious crowd already self-host their notes, RSS readers, and bookmarks. Single-user-no-auth behind a Tailscale or Cloudflare Tunnel is exactly what this audience prefers — a Docker Compose quickstart and a public repo turn Phase 0 into a forkable artifact for them at marginal cost.

**Phase 1+ persona thinking (directional, not a commitment):** users actively migrating away from paywall-creep incumbents (Todoist, Any.do) and users seeking polished alternatives to local-first FOSS options (Tasks.org, Logseq). These influence Phase 0 *constraints* (data portability, no SaaS dependencies) but not Phase 0 *features*.

## Success Criteria

Phase 0 is successful when **all** of the following are true at end-of-day:

**Must-ship (non-negotiable — defines "deployed"):**
1. **Deployed end-to-end** — application reachable on the public internet via self-hosted VPS, with persistent Postgres storage behind it (TLS, reverse proxy, supervised process).
2. **Core CRUD works** — a first-time user can add, view, complete, and delete a task without any guidance, instructions, or onboarding screen.
3. **Survives refresh, session loss, and process restart** — tasks created in one session are present in the next; data persists across browser close, refresh, and `systemctl restart` of the app or Postgres.

**Should-ship (defines "polished"):**
4. **Empty state is intentional** — first-time users see a designed empty state, not a blank list. (Loading and error states use simple fallbacks; "polished" is reserved for empty.)
5. **Doesn't visibly break on mobile** — viewport meta set, no horizontal scroll on iPhone width, touch targets ≥ 44px on interactive elements. Real device test, not just devtools.
6. **Public GitHub repo** — README contains live demo URL, screenshot, one-paragraph philosophy statement, and `docker-compose.yml` for one-command self-host.

**Nice-to-ship (cut first if the day runs long):**
7. **Optimistic UI** — add/complete/delete render in one frame; server reconciliation does not visibly flicker. (If cut: simple request → response → re-render with a 150ms skeleton row is acceptable.)

**Day-2 verification (not a Phase 0 ship gate):**
- Builder uses Tasky to track at least one real task on day 2 — informal dogfood signal, not a release blocker.

Explicitly **not** Phase 0 success metrics: signups, retention, NPS, MRR, conversion, server P95 latency targets, real telemetry. Those are Phase 1+ concerns.

**Brutal cut order if the day runs long** (drop in this sequence):
1. Optimistic UI → fall back to plain request/response with skeleton row (~2h saved)
2. Polished loading/error states → spinner + inline error string (~1h saved); keep empty state polished
3. Mobile polish → ensure no horizontal scroll only; defer touch refinement (~1h saved)

**Do not cut under any circumstances:** persistent Postgres, deployed URL, core CRUD, refresh-survival.

## Scope

**In scope (Phase 0):**

- Single-user, no authentication (appropriate for personal-server deployment, not just a deferred limitation)
- React frontend, Node backend, Postgres storage
- REST API with CRUD endpoints for tasks; endpoints documented in README
- Task fields: `id`, `description` (text), `completed` (bool), `created_at` (timestamp), `owner_id` (nullable — multi-user enabler, no other auth scaffolding)
- Frontend: list view, add input, complete toggle, delete action
- Optimistic UI updates with server reconciliation *(may cut — see brutal cut order)*
- Designed empty state; functional loading/error states
- Responsive layout (mobile = no horizontal scroll, ≥44px touch targets)
- Deployed to self-hosted VPS with persistent Postgres, TLS, supervised process
- `docker-compose.yml` shipped alongside for one-command self-host
- Public GitHub repo with README (demo URL, screenshot, philosophy, quickstart)

**Explicitly out of scope (Phase 0):**

- User accounts, authentication UI, multi-user
- Collaboration, sharing, teams
- Task editing, reordering, priorities, due dates, reminders, recurring tasks
- Tags, labels, projects, folders, filters
- Notifications, email, push
- Mobile native apps
- Offline mode / local-first sync (architectural foresight only — no implementation)
- Themes, settings, customization
- Analytics, telemetry
- Marketing site, landing page, signup flow (the GitHub repo IS the marketing surface)
- Pricing, billing, paywall scaffolding
- Markdown/JSON export endpoint (deferred to Phase 1; `pg_dump` covers Phase 0)
- Backup/restore automation (manual `pg_dump` only)
- Rate limiting, abuse protection
- AI features of any kind

If a scope decision is ambiguous, the default is **out**. Phase 0's discipline is what makes Phase 1 possible.

**Known operational gaps (acknowledged, not addressed today):** no automated backups, no uptime SLO, no monitoring, no incident plan. Self-hosted VPS is a single point of failure. Acceptable for a Phase 0 single-user app; explicitly inadequate for any future commercial claim.

## Vision

If Phase 0 ships clean and the foundation holds, Phase 1 explores a **local-first, privacy-respecting, data-portable** evolution: offline-first sync, clean export (markdown, JSON, ICS), no third-party tracking, and pricing positioned honestly against incumbent paywall fatigue. The eventual product earns the right to say *"your tasks, your data, your server, no upsell"* — the one positioning the entire incumbent field has effectively conceded.

Two to three years out, a successful Tasky looks like a small, sustainable indie product with a quietly loyal user base in the Wunderlist-refugee / privacy-conscious / minimalist-aesthetic segments — competing on trust and restraint rather than feature count. Not a unicorn. Not the goal.

The vision is grounded by what Phase 0 will *not* do: it will not lock the architecture into a single-user model, will not introduce paywall-shaped data structures, and will not adopt third-party dependencies that compromise data portability. Everything else is deliberately deferred.

---

*Phase 0 ships today. Phase 1 is a conversation for another day.*
