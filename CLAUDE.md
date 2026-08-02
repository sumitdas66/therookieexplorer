# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

No source code, build tooling, dependency manifests, or tests exist yet — the project has not been scaffolded. The design has been finalized, though: see `spec/implementation-design/2026-08-02-rookie-explorer-design.md` for the full architecture (Astro static site, GitHub Actions → GitHub Pages, folder-based itinerary content model, animation system, etc.).

There are no build, lint, or test commands to document until the project is scaffolded.

## Workflow

- Push edits directly to `main`. Do not create feature branches or PRs unless explicitly asked.

Update this file as soon as the project is scaffolded with real commands and architecture — it should stop being a placeholder the moment there's code to describe.

## Spec Lifecycle

Design and planning artifacts for features live under `spec/`, in two stages:

- **`spec/implementation-design/`** — approved design specs (the "what and why"), one file per feature, named `YYYY-MM-DD-<topic>-design.md`. Written during the `brainstorming` skill's process, after clarifying questions and user approval, before any implementation plan or code exists.
- **`spec/implementation-plan/`** — step-by-step implementation plans (the "how, in what order") derived from an approved design spec, written during the `writing-plans` skill's process. A plan file should reference the design spec it implements.

The lifecycle for any non-trivial feature is: brainstorm → write design spec to `spec/implementation-design/` → get user approval → write implementation plan to `spec/implementation-plan/` → execute the plan. Don't skip straight to a plan or to code without a corresponding approved design spec in `spec/implementation-design/` first.
