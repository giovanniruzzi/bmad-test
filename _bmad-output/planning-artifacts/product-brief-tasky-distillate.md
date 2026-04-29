---
title: "Product Brief Distillate: Tasky"
type: llm-distillate
source: "product-brief-tasky.md"
created: "2026-04-29"
purpose: "Token-efficient context for downstream PRD creation"
---

# Tasky — Product Brief Distillate

Phase 0 foundation build of a single-user, full-stack todo app. Same-day ship. Self-hosted VPS. Honest framing: commercial positioning deferred to Phase 1, but architectural choices preserve a future "local-first / privacy / data-portable" wedge.

## Project Identity

- **Codename:** Tasky (placeholder, may change before public launch)
- **Builder / primary stakeholder:** Gio (solo)
- **Brief type:** Commercial-aspirational, framed as Phase 0 foundation (no GTM, no monetization Phase 0)
- **Time horizon:** End-of-day, single builder
- **Deployment target:** Self-hosted VPS (owned infra)

## Stack & Technical Context

- **Frontend:** React
- **Backend:** Node (REST API)
- **Database:** Postgres
- **Containerization:** Docker Compose required as a deliverable (`docker-compose.yml` in repo)
- **Deployment requirements:** TLS (Let's Encrypt or Caddy auto-TLS), reverse proxy, supervised process (systemd or compose restart policy), persistent Postgres volume, env-based secret config, firewall (only 80/443/22 open, Postgres bound to localhost)
- **Repo:** Public GitHub, README is the marketing surface (live demo URL, screenshot, philosophy paragraph, quickstart)
- **No third-party SaaS dependencies of any kind** — no Vercel, Supabase, Auth0, Firebase, Stripe, Cloudflare Workers, etc. Postgres + Node process only.

## Data Model (Phase 0)

Single table `tasks`:
- `id` — primary key
- `description` — text
- `completed` — boolean
- `created_at` — timestamp
- `owner_id` — **nullable**, no other auth scaffolding. Sole concession to multi-user future. Refuse all other future-proofing during the build.

## API Surface (Phase 0)

- REST CRUD for tasks: list, create, toggle complete, delete
- Endpoints documented in README (treat API as a product surface — enables curl/Shortcuts/cron use cases at zero cost)
- No auth, no rate limiting, no abuse protection (acknowledged operational gap)

## Frontend Behavior

- List view (default and only view)
- Add input (instant)
- Complete toggle (visually distinct active vs completed)
- Delete action
- **Optimistic UI** with server reconciliation — *cuttable* if day runs long; fallback is plain request/response with 150ms skeleton row
- Empty state: **designed and polished** (first impression — reserved for the only "polished" treatment)
- Loading / error states: functional, not polished. Spinner + inline error string acceptable.
- Responsive: viewport meta, no horizontal scroll on iPhone width, ≥44px touch targets. Real device test, not just devtools.
- No onboarding screen. Open URL → see list → use it.

## Success Criteria (tiered)

**Must-ship (Phase 0 = false without these):**
1. Deployed end-to-end on public internet via VPS, persistent Postgres
2. CRUD works without guidance for first-time user
3. Survives refresh, session loss, and process restart

**Should-ship:**
4. Designed empty state
5. No mobile breakage (no horizontal scroll, touch targets ≥44px)
6. Public GitHub repo with README + docker-compose.yml

**Nice-to-ship:**
7. Optimistic UI

**Day-2 informal signal (not a ship gate):** builder uses Tasky for at least one real task

**Brutal cut order if running long:** optimistic UI → polished loading/error → mobile polish. Never cut: persistent Postgres, deployed URL, CRUD, refresh-survival.

## Scope — In

- Single-user, no auth UI
- React + Node + Postgres CRUD
- Documented REST API
- Docker Compose for one-command self-host
- VPS deploy with TLS, reverse proxy, supervised process, persistent volume
- Public GitHub repo with README

## Scope — Out (Phase 0)

- Auth, multi-user, collaboration, sharing
- Task editing, reordering, priorities, due dates, reminders, recurring tasks
- Tags, labels, projects, folders, filters
- Notifications, email, push
- Mobile native apps
- Offline / local-first sync (foresight only, no implementation)
- Themes, settings, customization
- Analytics, telemetry
- Marketing site / landing page
- Pricing, billing, paywall scaffolding
- Markdown/JSON export endpoint (deferred — `pg_dump` covers Phase 0)
- Backup/restore automation (manual `pg_dump` only)
- Rate limiting, abuse protection
- AI features

## Rejected Ideas (do not re-propose)

- **Authentication / accounts in Phase 0** — explicitly deferred; nullable `owner_id` is the only concession
- **Task editing in Phase 0** — common temptation, explicitly out
- **Drag-to-reorder** — explicitly out
- **localStorage settings (e.g., collapsed completed section)** — pulls in a settings concept that violates scope
- **Theming, favicon polish, page title pass beyond defaults** — out
- **AI auto-scheduling / AI assistant** — competitively crowded (Motion, Reclaim, Todoist AI), explicitly avoided as a future wedge
- **Calendar fusion** — competitively saturated (Amie, Sunsama, Akiflow, Motion), avoided
- **Team collaboration features** — Superlist/Asana/ClickUp own this, avoided
- **Apple-ecosystem premium positioning** — Things 3 owns it, avoided
- **"Forkable reference implementation" wedge** — *considered and rejected* during brief review; Vision stays focused on local-first only
- **Distribution at Phase 0 (Show HN, /r/selfhosted)** — *considered and rejected*; distribution is strictly Phase 1
- **Risk / kill-criteria section in Phase 0 brief** — *considered and rejected*; Phase 0 ships regardless

## Future Wedge (directional, not committing — Phase 1+)

**Local-first / privacy-respecting / data-portable productivity** — for users tired of subscription paywalls and cloud lock-in. Phase 0 architectural constraints exist to preserve this:
- No third-party SaaS dependencies
- Schema documented, `pg_dump` = full backup
- No proprietary data formats
- No paywall-shaped feature flags
- `owner_id` enables future multi-user without rewrite

Other wedges considered and parked: minimalist-that-stays-minimalist (still a brand discipline), honest pricing (still a brand voice). All three remain compatible with chosen architecture.

## Persona Context (directional only)

**Phase 0:** any individual with the URL. Builder is implicit dogfood user.

**Latent Phase 0 audience:** homelab / `/r/selfhosted` / privacy-conscious self-hosters. Single-user-no-auth behind Tailscale/Cloudflare Tunnel matches their deployment pattern. Docker Compose + public repo serves them at marginal cost.

**Phase 1+ aspirational personas (constraints only, not features):**
- Wunderlist refugees (long-running unmet need per Reddit/HN signal)
- Todoist/Any.do paywall-creep migrants
- Users seeking polished alternatives to local-first FOSS (Tasks.org, Logseq) that lack design polish

## Competitive Intelligence (preserved from research)

**Incumbents:**
- **Todoist** — $4/mo Pro, ~15 platforms, natural language input, mature integrations. Bleeding goodwill via paywall creep (reminders moved to Pro 2023). Quote pattern: "used to be simple, now it's a mini-Asana."
- **Things 3** — $80 one-time across Apple devices. Best-in-class design. Apple-only, no web, no real updates since 2017.
- **TickTick** — ~$3/mo Premium. Best feature/$ — calendar + Pomodoro + habits bundled. Chinese ownership raises occasional privacy concerns.
- **Apple Reminders** — free, deep OS integration, Apple-only.
- **Microsoft To Do** — free, slow development, sync flakiness complaints, Wunderlist refugees still vocal.
- **Any.do** — aggressive paywall called "predatory," dark-pattern reputation.

**Indie / minimalist:**
- **Superlist** — ex-Wunderlist team, collab-first, ~$8/mo
- **Amie** — calendar + tasks + AI fusion, ~$15/mo, Gen-Z aesthetic
- **TeuxDeux** — dead-simple horizontal day strip, $3/mo, cult following
- **Tasks.org** — FOSS, local-first, lacks design polish (real gap signal)
- **Tweek** — week-at-a-glance, Product Hunt favorite

**Repeated user pain points (real, quotable):**
- Bloat / feature creep
- Paywall erosion (Todoist 2023 backlash, Any.do "predatory")
- Sync reliability (MS To Do, Any.do)
- Mobile UX regressions (Todoist iOS)
- Lock-in / export friction (Things, Apple Reminders, Todoist JSON-only)
- No polished local-first commercial option (consistent HN signal)
- Privacy concerns (TickTick ownership, cloud-only sensitive data)
- Pricing fatigue ("$5/mo to write down what I need to buy")

**Pricing benchmarks for Phase 1 thinking:**
- Sweet spot for indie commercial play: **$3–5/mo or $30–50 one-time**
- Anything above $8/mo requires calendar/AI fusion to justify
- Free tier dominated by MS To Do, Apple Reminders (loss leaders)

**Wedges to avoid (crowded / capital-intensive):** AI auto-scheduling, calendar fusion at high end, team collaboration, Apple-ecosystem premium.

## Operational Reality (acknowledged gaps, accepted Phase 0)

- **No automated backups** — manual `pg_dump` only
- **No uptime SLO, no monitoring, no incident plan**
- **Single point of failure** — VPS dies = service down
- **No persistence guarantees beyond "Postgres on a volume"**
- These are explicitly inadequate for any Phase 1 commercial claim — must be addressed before Tasky takes real users beyond the builder

## Deployment Risk Notes (informed by review)

Same-day VPS deploy is the highest-risk single bullet. Realistic time budget for first-time-on-this-VPS path: **4–5h** (DNS propagation, TLS challenge, reverse proxy config, Postgres persistence, env vars, firewall, first-deploy boring failures). Builder should consider this the first thing to start, not the last. If experienced on this exact stack and VPS, **2h** floor.

## Open Questions (deferred to Phase 1 or later)

- Real product name (codename Tasky may not survive)
- Eventual commercial pricing model (one-time? flat sub? freemium?)
- Domain / branding decisions
- Backup and restore strategy
- Whether to actively pursue distribution at any point (Show HN, /r/selfhosted, IndieHackers)
- Whether to add authentication before or after seeking external users
- Markdown/JSON export endpoint design
- Multi-device sync model if/when Phase 1 proceeds

## Brief Voice & Tone Notes (preserve in downstream artifacts)

- **Honest framing**: brief openly says "Today, no commercial differentiation." This voice is itself an asset — preserve it in any future README, changelog, public posts. Do not let PRD or marketing materials regress to typical product-launch puffery.
- **Velocity as discipline**: same-day ship is the proof of restraint, not a logistics note. Worth surfacing in public materials when/if Phase 1 launches.
