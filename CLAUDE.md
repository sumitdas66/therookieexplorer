# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Scaffolded and implemented: a static Astro site, "The Rookie Explorer," deployed to GitHub Pages. Full architecture rationale lives in `spec/implementation-design/2026-08-02-rookie-explorer-design.md`; the implementation plan (10 tasks, all complete) is in `spec/implementation-plan/2026-08-02-rookie-explorer-plan.md`. There are no automated tests in this project — that was an explicit, deliberate decision for this build, not an oversight.

## Commands

- `npm install` — install dependencies
- `npm run dev` — start the dev server (default port 4321; site is served under the `/therookieexplorer` base path, so visit `http://localhost:4321/therookieexplorer/`, not the bare root)
- `npm run build` — full production build to `dist/`
- `npm run preview` — preview the production build locally

There is no lint or test command — none is configured for this project.

## Architecture

- **Astro static site**, no server, no database. `astro.config.mjs` sets `base: '/therookieexplorer'` and `trailingSlash: 'always'` for the GitHub Pages project-page subpath.
- **Content lives under `public/`, not a `src/content/` collection**, so Astro's build copies it into `dist/` verbatim with zero custom copy logic:
  - `public/itineraries/{domestic|international}/{slug}/` — each folder holds exactly one `itinerary.pdf`, one `meta.txt` (YAML metadata), and an optional cover image. Build-time validation in `src/lib/itineraries.js` fails loudly on a malformed slug, a slug collision, the wrong PDF count, or a missing/invalid `date`.
  - `public/photos/{hero|about|moments}/` — site-wide personal photos, separate from itinerary covers. These ship intentionally empty (only `.gitkeep`) — no stock placeholder images were seeded, by design. Missing/empty buckets degrade gracefully at build time with a warning, never a failure.
- **`src/lib/itineraries.js`** and **`src/lib/photos.js`** are the build-time content layer — plain Node modules (`fs`/`path`) imported directly into `.astro` page frontmatter. `getAllItineraries()` is memoized per build process; `date` (a `YYYY-MM-DD` string) is the only sort key for "newest first" — never git/filesystem metadata.
  - **Gotcha:** `js-yaml`'s default schema auto-coerces unquoted YAML dates (`date: 2020-01-01`) into JS `Date` objects. `itineraries.js` parses with `{ schema: yaml.JSON_SCHEMA }` specifically to prevent this — don't remove that option.
- **`src/lib/paths.js`** exports `withBase(path)`, the single place base-path-prefixing happens. Astro's `base` config does **not** auto-rewrite hardcoded `href="/..."` strings — every internal link and content-derived URL in this project must go through `withBase()`.
- **Animation system** (`src/styles/motion.css`, `src/scripts/scroll-reveal.js`, `src/components/EmojiBackground.astro`) layers scroll reveals, hover states, Astro View Transitions, and a homepage-only floating-emoji background on top of the Airbnb-derived visual system in `DESIGN.md`. `prefers-reduced-motion` is a hard requirement, not optional polish.
  - **Gotcha:** Astro's `<ViewTransitions />` intercepts internal link clicks and does soft (same-document) navigation by default. Any script that queries the DOM or attaches listeners must re-run on every navigation, not just once at initial load — wrap setup logic in `document.addEventListener('astro:page-load', ...)` (see `scroll-reveal.js` and `TagFilterGrid.astro` for the pattern). A script that only runs once at top-level will silently stop working the moment a visitor clicks an internal link.
- **`.github/workflows/deploy.yml`** builds and deploys via the modern Actions-based GitHub Pages flow (`upload-pages-artifact` + `deploy-pages`), not the `gh-pages` branch method. The repo's GitHub Pages source must be set to "GitHub Actions" in Settings → Pages for this to actually publish — see the handoff doc for whether that's been done yet.

## Workflow

- Push edits directly to `main`. Do not create feature branches or PRs unless explicitly asked.

## Handoff Documents

Session handoffs live under `handoff/`, named `YYYY-MM-DD-<topic>.md`, written via the `handoff` skill. Check the most recent one at the start of a new session to see what's done, what's outstanding, and where to resume — see `handoff/2026-08-02-rookie-explorer-build-handoff.md` for the current state as of the initial build.

## Spec Lifecycle

Design and planning artifacts for features live under `spec/`, in two stages:

- **`spec/implementation-design/`** — approved design specs (the "what and why"), one file per feature, named `YYYY-MM-DD-<topic>-design.md`. Written during the `brainstorming` skill's process, after clarifying questions and user approval, before any implementation plan or code exists.
- **`spec/implementation-plan/`** — step-by-step implementation plans (the "how, in what order") derived from an approved design spec, written during the `writing-plans` skill's process. A plan file should reference the design spec it implements.

The lifecycle for any non-trivial feature is: brainstorm → write design spec to `spec/implementation-design/` → get user approval → write implementation plan to `spec/implementation-plan/` → execute the plan. Don't skip straight to a plan or to code without a corresponding approved design spec in `spec/implementation-design/` first.
