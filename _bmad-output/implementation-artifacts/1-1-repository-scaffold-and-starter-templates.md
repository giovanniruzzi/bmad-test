# Story 1.1: Repository scaffold and starter templates

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the builder,
I want the monorepo file structure scaffolded with the official Vite `react-ts` template for the frontend and a hand-scaffolded Express + TypeScript backend,
so that all subsequent stories have a consistent place to add code without further structural decisions.

## Acceptance Criteria

1. The repository contains the locked top-level file tree from Architecture §5.1: `README.md`, `LICENSE`, `.gitignore`, `.env.example`, and the directories `api/`, `web/`, `db/`, `e2e/`. No additional **Tasky-product** top-level entries are created (no `migrations/`, no `tests/`, no `.github/workflows/`, no `infra/`, no product `docs/` — see Architecture §5.3). BMad scaffolding (`_bmad/`, `_bmad-output/`, `.agents/`, `docs/`) is excluded from this prohibition — see Project Structure Notes.
2. `web/` is scaffolded by running **exactly** `npm create vite@latest web -- --template react-ts` and contains a working Vite + React 19.2 + TypeScript app that starts via `npm run dev` from inside `web/` and renders the default Vite/React landing page in the browser.
3. `api/` is hand-scaffolded by running **exactly** the sequence `mkdir api && cd api && npm init -y && npm install express pg && npm install -D typescript @types/node @types/express tsx && npx tsc --init` (Architecture §2.3). It contains `package.json`, `tsconfig.json`, and a `src/` directory with two placeholder TypeScript files: `src/server.ts` and `src/db.ts`. Placeholders may contain a single `// TODO: Story 1.2 / 1.3` comment and an empty `export {}` line — no business logic.
4. `db/` directory exists and contains a single `.gitkeep` file (so git tracks it). `db/init.sql` is **not** created in this story; it belongs to Story 1.2.
5. `e2e/` directory exists and contains a single `.gitkeep` file (so git tracks it). Playwright setup is **not** created in this story; it belongs to Story 2.7.
6. The top-level `.gitignore` excludes at minimum: `node_modules`, `dist`, `.env`, `*.log`. It does **not** ignore `.env.example`, `package-lock.json`, or `tsconfig.json`.
7. The top-level `.env.example` exists with the three placeholder keys and **no real values**: `POSTGRES_PASSWORD=`, `DATABASE_URL=`, `DOMAIN=`.
8. The top-level `LICENSE` file exists with MIT license text (or another permissive equivalent), with the current year and the builder's name as copyright holder.
9. The top-level `README.md` is a stub containing only: the project name (`# Tasky`), a one-line description, and a placeholder line for the public GitHub repo URL. Full README content (setup, deploy, schema, Phase 0 gaps) is **deferred to Story 3.3** — do not write it now.
10. The repository is initialized as a local git repo (`git init`), the `LICENSE` file is committed, and a `.git/` directory exists at the project root. The existing BMad-generated commit history (if any) is preserved.
11. **Builder action (human step):** the local repository is pushed to a new public GitHub repository, and the resulting remote URL is recorded in the `README.md` stub on the placeholder line from AC #9. This step is performed by the human, not by automation; the story is not complete until the URL is in the README.

## Tasks / Subtasks

- [x] **Task 1: Scaffold the frontend with the official Vite template** (AC: #2)
  - [x] From the project root, run `npm create vite@latest web -- --template react-ts` exactly as written. Accept all defaults; do not pass additional flags.
  - [x] `cd web && npm install` to install dependencies (the Vite scaffolder prompts for this; either accept the prompt or run it manually).
  - [x] Verify `web/` contains at minimum: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`. Do NOT modify these files in this story.
  - [x] Run `npm run dev` from inside `web/`, open the printed URL in a browser, and confirm the default Vite + React landing page renders. Stop the dev server.
  - [x] Confirm `web/package.json` shows `react` ≥ 19.2, `react-dom` ≥ 19.2, and `vite` ≥ 8.0. If the template ships newer pins, accept them. If older, **halt and consult** — do not manually upgrade in this story.

- [x] **Task 2: Hand-scaffold the backend** (AC: #3)
  - [x] From the project root, run **exactly** the command sequence from Architecture §2.3:
    ```bash
    mkdir api && cd api
    npm init -y
    npm install express pg
    npm install -D typescript @types/node @types/express tsx
    npx tsc --init
    ```
  - [x] Confirm `api/package.json` has `express` (^5.1) and `pg` in `dependencies`, and `typescript`, `@types/node`, `@types/express`, `tsx` in `devDependencies`. Do not add any other packages in this story.
  - [x] Create `api/src/` directory.
  - [x] Create `api/src/server.ts` containing only:
    ```ts
    // TODO: Story 1.3 — Express app, /api/tasks routes, error middleware, graceful shutdown
    export {};
    ```
  - [x] Create `api/src/db.ts` containing only:
    ```ts
    // TODO: Story 1.2 / 1.3 — pg.Pool + listTasks/createTask/toggleTask/deleteTask
    export {};
    ```
  - [x] Do **not** edit `api/tsconfig.json` beyond what `npx tsc --init` produced. Tsconfig tuning belongs to Story 1.3 when the server is actually compiled.
  - [x] **Module system decision:** Leave `api/package.json` with the `npm init -y` default (CommonJS — no `"type"` field). The ESM-vs-CJS decision is **deferred to Story 1.3** when the server code is actually written. Do not add `"type": "module"` in this story.

- [x] **Task 3: Create the empty `db/` and `e2e/` directories** (AC: #4, #5)
  - [x] `mkdir db e2e` from the project root.
  - [x] Add a `.gitkeep` file to each so git tracks the empty directories: `touch db/.gitkeep e2e/.gitkeep`.
  - [x] Do NOT create `db/init.sql` (Story 1.2) or any Playwright config (Story 2.7).

- [x] **Task 4: Create the top-level `.gitignore`** (AC: #6)
  - [x] At the project root, create `.gitignore` with these lines (and no others required by Phase 0):
    ```
    node_modules
    dist
    .env
    *.log
    ```
  - [x] Verify `.env.example`, `package-lock.json`, and any `tsconfig.json` are NOT matched by these patterns.

- [x] **Task 5: Create the top-level `.env.example`** (AC: #7)
  - [x] At the project root, create `.env.example` containing exactly:
    ```
    POSTGRES_PASSWORD=
    DATABASE_URL=
    DOMAIN=
    ```
  - [x] Confirm there are no real secrets, no example/placeholder values like `changeme`, no inline comments — empty values only. The shape of these values is decided in Story 1.5 (compose orchestration).

- [x] **Task 6: Create the top-level `LICENSE`** (AC: #8)
  - [x] At the project root, create `LICENSE` with the standard MIT license text. Use the current year (2026) and the builder's name (Gio) as the copyright holder. Use the canonical MIT text from <https://opensource.org/license/mit> verbatim, substituting only the year and copyright holder.

- [x] **Task 7: Create the stub `README.md`** (AC: #9)
  - [x] At the project root, create `README.md` containing only:
    ```markdown
    # Tasky

    A deliberately minimal, self-hosted todo app.

    Repository: <add public GitHub URL after pushing — see Story 1.1 AC #11>
    ```
  - [x] Do NOT add setup instructions, deploy steps, schema docs, or Phase 0 gap notes. All of that is Story 3.3.

- [x] **Task 8: Initialize git and commit the LICENSE** (AC: #10)
  - [x] If `.git/` does not exist at the project root, run `git init` from the project root.
  - [x] Stage and commit the `LICENSE` file (alone or together with the other scaffolded files — at minimum LICENSE must be in a commit). Use a clear commit message such as `chore: scaffold repository (Story 1.1)`.
  - [x] Confirm `git log` shows the commit and `git status` is clean (no untracked files).

- [x] **Task 9: [HUMAN] Builder action — push to public GitHub and record URL** (AC: #11)
  - [x] ⚠️ **This task is performed by the human builder, not by an automation/dev agent.** Do not attempt to autonomously run `gh repo create` or push to a remote.
  - [x] **Human step**: Create a new **public** GitHub repository (suggested name: `tasky`). Do not initialize it with a README, .gitignore, or LICENSE on GitHub — the local repo already has them.
  - [x] Add the GitHub remote and push: `git remote add origin <url> && git branch -M main && git push -u origin main`.
  - [x] Edit `README.md` to replace the `<add public GitHub URL after pushing — see Story 1.1 AC #11>` placeholder with the actual URL.
  - [x] Commit and push the README update.

- [x] **Task 10: Verify AC #1 negative invariant — no stray top-level entries** (AC: #1)
  - [x] From the project root, run `ls -A1` and confirm the output contains **only** these entries:
    - Tasky-product entries: `.env.example`, `.git`, `.gitignore`, `LICENSE`, `README.md`, `api`, `db`, `e2e`, `web`
    - BMad scaffolding (allowed, see Project Structure Notes): `_bmad`, `_bmad-output`, `.agents`, `docs`
  - [x] Anything else (e.g., a stray `migrations/`, `tests/`, `.github/`, `infra/`, root `package.json`, root `node_modules/`, root `Dockerfile`) is an AC #1 violation — remove it before declaring the story done.

## Dev Notes

### Locked technology versions (do not deviate)

[Source: architecture.md#3.1, #3.2, #3.3, #3.4]

- **React:** 19.2 (must support `useOptimistic`, used in Epic 3). Accept whatever the Vite `react-ts` template currently pins; do not downgrade.
- **Vite:** 8.0 (whatever the template currently ships).
- **TypeScript:** 5.x (template-pinned for `web/`; use `npx tsc --init` defaults for `api/`).
- **Node.js:** 24 LTS (Krypton). Will be pinned via `.nvmrc` and the API Dockerfile in later stories. Not required to be pinned in this story.
- **Express:** 5.1 (the current `npm install express` default in 2026).
- **pg:** Latest stable (raw node-postgres driver, NO ORM).
- **PostgreSQL:** 17 (referenced for context — not installed in this story).
- **Caddy:** 2.x (referenced for context — not installed in this story).

### Hard prohibitions (Architecture §2.4 — discipline thesis)

Do **NOT** install or scaffold ANY of the following in this story or any other Phase 0 story unless a future story explicitly requires it:

- ❌ State management libraries: Redux, Zustand, Jotai, Recoil, MobX
- ❌ Data-fetching libraries: TanStack Query, SWR, RTK Query, Axios
- ❌ CSS frameworks: Tailwind, MUI, Chakra, shadcn/ui, Bootstrap
- ❌ ORMs: Prisma, Drizzle, TypeORM, Sequelize, Kysely
- ❌ Validation libraries: Zod, Yup, Joi, class-validator
- ❌ Test frameworks: Vitest, Jest, Mocha (Playwright is added later in Story 2.7, but only Playwright)
- ❌ Routing libraries: React Router, TanStack Router (single screen, no routing)
- ❌ Logging libraries: Pino, Winston, Bunyan (`console.log`/`console.error` only)
- ❌ Linters/formatters beyond what the Vite template ships (no extra ESLint configs, no Prettier, no Husky)
- ❌ Migration frameworks: node-pg-migrate, Knex migrations, Prisma Migrate
- ❌ CI/CD config: `.github/workflows/`, GitLab CI, CircleCI configs

If the Vite `react-ts` template ships with ESLint or any other dev dependency by default, **leave it alone** — do not remove it, do not extend its config. Accept the template as-is.

### Exact file tree this story must produce

[Source: architecture.md#5.1]

```
tasky/                                  ← project root (current working directory)
├── README.md                           ← Task 7 stub
├── LICENSE                             ← Task 6
├── .gitignore                          ← Task 4
├── .env.example                        ← Task 5
├── .git/                               ← Task 8 (or pre-existing)
│
├── db/
│   └── .gitkeep                        ← Task 3
│
├── e2e/
│   └── .gitkeep                        ← Task 3
│
├── api/                                ← Task 2
│   ├── package.json                    ← from `npm init -y` + installs
│   ├── package-lock.json               ← auto-generated
│   ├── tsconfig.json                   ← from `npx tsc --init`, untouched
│   ├── node_modules/                   ← gitignored
│   └── src/
│       ├── server.ts                   ← TODO placeholder
│       └── db.ts                       ← TODO placeholder
│
└── web/                                ← Task 1, from `npm create vite@latest`
    ├── package.json
    ├── package-lock.json
    ├── tsconfig.json
    ├── tsconfig.node.json              ← if Vite template includes it
    ├── vite.config.ts
    ├── index.html
    ├── node_modules/                   ← gitignored
    ├── public/                         ← if Vite template includes it
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── App.css
        ├── index.css
        └── assets/                     ← if Vite template includes it
```

Files NOT in this story (deliberately deferred):

- `docker-compose.yml`, `Caddyfile` → Story 1.5
- `db/init.sql` → Story 1.2
- `api/Dockerfile`, real `api/src/server.ts`, real `api/src/db.ts` → Stories 1.3 / 1.5
- `web/Dockerfile`, modified `App.tsx`, `web/src/api.ts` → Stories 1.4 / 2.x / 1.5
- `e2e/package.json`, `e2e/tasks.spec.ts` → Story 2.7

### Naming conventions to follow when creating files

[Source: architecture.md#4.1]

- Module/non-component TypeScript files: `kebab-case.ts` (e.g., `server.ts`, `db.ts`)
- React component files: `PascalCase.tsx` (e.g., `App.tsx`, `main.tsx` — `main.tsx` is the Vite template's convention; do not rename)
- Env variables: `SCREAMING_SNAKE_CASE` (e.g., `POSTGRES_PASSWORD`, `DATABASE_URL`, `DOMAIN`)
- Directories: lowercase, no separators (`api`, `web`, `db`, `e2e`)

### What "done" looks like for this story

A fresh clone of the public GitHub repo, followed by `cd web && npm install && npm run dev`, must render the default Vite + React landing page in the browser. The `api/` directory must be `npm install`-able without errors but is not yet runnable (placeholders only). `db/` and `e2e/` are empty placeholders. The README contains the public repo URL.

### Common mistakes to avoid

(These complement the Hard prohibitions above — listed separately because they are *procedural* mistakes, not banned dependencies.)

- ❌ Do NOT run `npm create vite@latest web -- --template react-swc-ts` or any other template variant. The architecture specifies the plain `react-ts` template.
- ❌ Do NOT `cd` into `web/` and run `npm install <anything>` to add libraries. The template is complete as-is.
- ❌ Do NOT create a top-level `package.json` or set up npm workspaces. The repo is intentionally NOT a workspace monorepo — `api/`, `web/`, `e2e/` each have their own independent `package.json` and `node_modules`. This is deliberate: it keeps Dockerfile build contexts simple in Story 1.5.
- ❌ Do NOT write any actual server, route, or DB code in `api/src/server.ts` or `api/src/db.ts`. Placeholders only.
- ❌ Do NOT include real secrets in `.env.example`. Empty values only.
- ❌ Do NOT write the full README. The stub is intentionally minimal; Story 3.3 owns the real README.

### Project Structure Notes

- The project root is `/Users/gio/Source/bmad-test/`. All paths in the file tree above are relative to this root.
- The `_bmad/`, `_bmad-output/`, `.agents/`, and `docs/` directories that already exist at the project root are BMad-Method scaffolding and are **not** part of the Tasky product repo. They should not be removed, but they should also not be referenced by any product code, Dockerfile, or compose file. They are tooling, not deliverables.
- A `.gitignore` decision: BMad's existing scaffolding directories (`_bmad/`, `_bmad-output/`, `.agents/`, `docs/`) are intentionally NOT added to `.gitignore` — Gio has chosen to commit them to the same public repo for transparency about the BMad workflow. Do not ignore them.
- The existing single git commit (`523489f bmad: step 1`) at the project root is preserved; this story adds new commits on top.

### References

(Architecture sections are inline-cited at each Dev Notes subsection above. The references below are the cross-cutting source documents not already inlined.)

- [Source: epics.md#Story 1.1] — User story, acceptance criteria, builder action.
- [Source: prd.md#FR31, FR37] — One-command `docker compose up` deploy and committed `.env.example` (drives the no-workspace, simple-Dockerfile choice in Story 1.5; relevant here only as the reason the scaffold stays simple).
- [Source: prd.md#FR20, FR35] — README is a published deliverable in the public source repository (justifies why the README stub exists in Story 1.1 even though full content is deferred to Story 3.3).

## Dev Agent Record

### Agent Model Used

claude-opus-4.7 (github-copilot/claude-opus-4.7)

### Debug Log References

- Vite dev-server smoke test: `vite v8.0.10 ready in 798 ms`, `curl http://localhost:5173/` → HTTP 200, served default `index.html` with `<title>web</title>` and `#root` mount point. Server stopped cleanly after verification.
- `git check-ignore -v .env.example api/package-lock.json api/tsconfig.json web/package-lock.json web/tsconfig.json` → exit 1 (none ignored), satisfying AC #6 negative checks.
- `git log --oneline` after Task 8 commit:
  - `13cd7ac chore: scaffold repository (Story 1.1)`
  - `523489f bmad: step 1` (preserved)
- `ls -A1` at project root after Task 10 returned exactly the 13 expected entries (9 Tasky + 4 BMad scaffolding) with no strays.

### Completion Notes List

- Tasks 1–8 and 10 completed by the dev agent. **Task 9 (HUMAN, AC #11) completed by Gio:** public repo `https://github.com/giovanniruzzi/bmad-test` created, pushed, README updated with real URL, README update committed (`086f824`) and pushed to `origin/main`. Working tree clean, 0 ahead / 0 behind.
- **Tooling-version note (AC #2):** Vite `react-ts` template currently pins `typescript` to `~6.0.2` (TS 6, not the "5.x" referenced in Dev Notes). Per the AC #2 rule "if the template ships newer pins, accept them", TS 6 was accepted as-is. No manual downgrade. React 19.2.5, react-dom 19.2.5, Vite 8.0.10 all meet or exceed the locked pins.
- **`api/package.json` `"type"` field nuance (AC #3 / Task 2):** `npm init -y` (with the current npm/Node 24 version installed) explicitly writes `"type": "commonjs"` rather than omitting the field. The Dev Notes intent ("CommonJS — no `\"type\"` field") was to leave `npm init -y` defaults untouched; since `"type": "commonjs"` IS the literal `npm init -y` default and is semantically equivalent to omitting it (CommonJS module system), the field was left as written. The ESM-vs-CJS decision remains deferred to Story 1.3 as instructed.
- **`.gitignore` reconciliation:** the pre-existing project root `.gitignore` ignored `_bmad/` and `.agents/`. Per Project Structure Notes ("Do not ignore them"), it was replaced with the four Phase-0 lines mandated by Task 4. BMad scaffolding directories now remain trackable.
- **Task 8 commit scope:** committed all scaffolded files together in a single `chore: scaffold repository (Story 1.1)` commit. The pre-existing `523489f bmad: step 1` commit is preserved at HEAD~1. The story file itself, sprint-status.yaml, and `_bmad/` (scaffolding metadata) remain uncommitted by design — they are workflow tracking, not the story's deliverable, and will be picked up by the next commit naturally.
- **No automated tests authored:** this story produces no business logic — only directories, config files, and TODO-placeholder modules. The "tests" are the embedded verification steps (Vite serves HTTP 200, AC #1 `ls -A1` invariant, AC #6 `git check-ignore` negative check, version pins assertion). All passed.
- **Hard-prohibition compliance:** no state managers, data-fetching libs, CSS frameworks, ORMs, validators, test frameworks, routers, loggers, linters beyond template defaults, migration tools, or CI configs were installed. The Vite `react-ts` template's bundled ESLint config was left untouched as instructed.

### File List

**New files (committed in `13cd7ac`):**

- `LICENSE`
- `README.md`
- `.gitignore` (replaces pre-existing 2-line BMad-ignoring version)
- `.env.example`
- `api/package.json`
- `api/package-lock.json`
- `api/tsconfig.json`
- `api/src/server.ts`
- `api/src/db.ts`
- `db/.gitkeep`
- `e2e/.gitkeep`
- `web/.gitignore` (Vite template-generated)
- `web/README.md` (Vite template-generated)
- `web/eslint.config.js` (Vite template-generated)
- `web/index.html` (Vite template-generated)
- `web/package.json` (Vite template-generated)
- `web/package-lock.json`
- `web/public/favicon.svg` (Vite template-generated)
- `web/public/icons.svg` (Vite template-generated)
- `web/src/App.css` (Vite template-generated)
- `web/src/App.tsx` (Vite template-generated)
- `web/src/assets/hero.png` (Vite template-generated)
- `web/src/assets/react.svg` (Vite template-generated)
- `web/src/assets/vite.svg` (Vite template-generated)
- `web/src/index.css` (Vite template-generated)
- `web/src/main.tsx` (Vite template-generated)
- `web/tsconfig.app.json` (Vite template-generated)
- `web/tsconfig.json` (Vite template-generated)
- `web/tsconfig.node.json` (Vite template-generated)
- `web/vite.config.ts` (Vite template-generated)

**Gitignored (auto-generated, present on disk, not committed):**

- `api/node_modules/`
- `web/node_modules/`

**Pending Task 9 (human):** *Completed* — `README.md` placeholder replaced with `Repository: https://github.com/giovanniruzzi/bmad-test` in commit `086f824`, pushed to `origin/main`.

## Change Log

| Date       | Version | Change                                                                                                                            | Author |
| ---------- | ------- | --------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 2026-04-29 | 0.1     | Story drafted (ready-for-dev).                                                                                                    | PM     |
| 2026-04-29 | 0.2     | Implemented Tasks 1–8, 10. Scaffolded `web/` (Vite react-ts), hand-scaffolded `api/`, created `db/`, `e2e/`, root config files, committed scaffold. Task 9 (human GitHub push) pending. | Dev (Amelia / claude-opus-4.7) |
| 2026-04-29 | 0.3     | Task 9 completed by Gio: public repo created at https://github.com/giovanniruzzi/bmad-test, README URL recorded (commit `086f824`), pushed to `origin/main`. All ACs satisfied. Status → review. | Dev (Amelia / claude-opus-4.7) |
