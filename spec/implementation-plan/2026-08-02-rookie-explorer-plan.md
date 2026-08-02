# The Rookie Explorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Tests are intentionally skipped for this plan** (confirmed with the user) — do not add TDD red/green steps; each task's "Verify" step is a plain sanity check (install/build), not an automated test suite.

**Goal:** Build and deploy "The Rookie Explorer" — a static Astro site, hosted on GitHub Pages, that lists downloadable travel itineraries (Domestic/International) sourced entirely from a folder-based content model, per `spec/implementation-design/2026-08-02-rookie-explorer-design.md`.

**Architecture:** Astro static site (no server, no database). All content — itineraries (PDF + YAML metadata) and site photos — lives under `public/` so Astro's build copies it verbatim into `dist/`, with zero custom copy logic. A build-time Node module (`src/lib/itineraries.js`) walks that folder tree, validates it, and hands structured data to `.astro` pages. GitHub Actions builds on every push to `main` and deploys to GitHub Pages via the modern Actions-based Pages deployment (no `gh-pages` branch).

**Tech Stack:** Astro 4.x (static output), `js-yaml` for metadata parsing, plain CSS (custom properties from `DESIGN.md`) + vanilla JS (`IntersectionObserver`) for animation — no React/Vue, no animation library, no backend.

---

## Architecture Decisions (resolving spec → implementation)

These are decisions the design spec left at the "what," which this plan resolves to a concrete "how." Read this before touching any task.

1. **Content folders live under `public/`, not repo root.** The design spec's tree diagram shows `itineraries/` and `photos/` at the repo root. In Astro, only files under `public/` (or processed assets) are copied into the deployed `dist/` output. So the real paths are `public/itineraries/{domestic|international}/{slug}/` and `public/photos/{hero|about|moments}/`. This is what makes "drop a folder, push, done" true with no custom asset-copying step — Astro's own build does the copying for free.
2. **Base path handling.** The site deploys to `sumitdas66.github.io/therookieexplorer/`, a subpath. Astro's `base` config makes `import.meta.env.BASE_URL` resolve to `/therookieexplorer/`, but it does **not** auto-rewrite hardcoded `href="/..."` strings in your markup — that's a common Astro gotcha. Every internal link and every asset URL built from the content layer goes through one shared helper, `withBase()` in `src/lib/paths.js`, so this is handled in exactly one place.
3. **No fake placeholder photos.** `photos/hero/`, `photos/about/`, `photos/moments/` ship **empty** (with `.gitkeep` files so the folders exist in git for the user to drop real photos into later). The design spec already defines graceful degradation for empty photo folders (gradient hero fallback, text-only about band, hidden moments strip) — that degradation *is* the placeholder strategy. Seeding generic stock-style placeholder images would directly contradict the user's stated goal ("personalized, not AI slop"), so none are created.
4. **Itinerary cover images do get a placeholder — but a designed UI element, not a fake photo.** `PlaceholderCover.astro` renders a DESIGN.md-styled gradient block with an icon and the trip title whenever `cover_image` is omitted. This is different from decision 3: it's a permanent, intentional empty-state component, not a stand-in for missing content.
5. **Two sample itinerary folders are seeded** (`public/itineraries/domestic/sample-kerala-backwaters/`, `public/itineraries/international/sample-malaysia-kuala-lumpur/`) with obviously-labeled placeholder titles/PDFs, dated `2020-01-01`/`2020-01-02` (deliberately old, so they don't awkwardly sit at the top once real 2026-dated trips are added). These exist purely so the build has content to render — without them, every page would legitimately render empty grids, and there'd be nothing to visually verify. They're clearly named as sample data and can be deleted once real itineraries exist.
6. **GitHub Pages deployment uses the modern Actions-based flow** (`actions/upload-pages-artifact` + `actions/deploy-pages`), not the legacy `gh-pages` branch. **One manual one-time step is required outside this plan:** in the repo's GitHub settings (Settings → Pages → Build and deployment → Source), the source must be set to "GitHub Actions." No task in this plan can do this via a code change — flag it to the user after Task 5 lands.
7. **`.nojekyll`** is added to `public/` (Task 1) as a zero-cost safety net. It's not strictly required by the Actions-based deploy flow (which skips Jekyll entirely), but costs nothing and protects against GitHub Pages mishandling Astro's `_astro/` asset folder if the deployment method ever changes.

## Shared Data Contract

Every itinerary, once loaded by `src/lib/itineraries.js`, is shaped exactly like this. Tasks below that consume itinerary data (components, pages) rely on this shape:

```js
{
  slug: string,               // folder name, e.g. "malaysia-kuala-lumpur"
  category: 'domestic' | 'international',
  title: string,
  date: string,                // 'YYYY-MM-DD', sort key (newest first)
  duration: string,
  cost: string,
  tags: string[],              // possibly empty
  summary: string,
  coverImage: string | null,   // absolute site URL (base-prefixed), or null
  pdfUrl: string,               // absolute site URL (base-prefixed)
}
```

`getPhotos(bucket)` (bucket = `'hero' | 'about' | 'moments'`) returns `string[]` of absolute, base-prefixed URLs (possibly empty).

## Dependency & Parallelization Map

```
Task 1 (Scaffolding)
   │
   ├─────────────┬─────────────┬─────────────┐
   ▼             ▼             ▼             ▼
Task 2        Task 3        Task 4        Task 5
(content      (sample       (design       (GH Actions
 layer)        content)      system)       workflow)
   │             │             │
   │             │  (soft dep, │
   │             │  not code-  │
   │             │  blocking)  ▼
   │             └───────────► Task 6
   │                           (base layout,
   │                            header, footer)
   │                              │
   ├──────────────┬───────────────┤
   ▼              ▼               ▼
Task 7         Task 8          Task 9
(homepage)     (category       (itinerary
                pages)          detail page)
   │              │               │
   └──────────────┴───────────────┘
                  ▼
              Task 10
          (animation system —
           sequential, touches
           files from every task
           above; no parallel
           partner)
```

**Parallel dispatch groups:**
- **Batch A** (all depend only on Task 1, no shared files): Tasks 2, 3, 4, 5 — dispatch as 4 parallel Implementer subagents.
- **Batch B** (all depend on Tasks 2, 4, 6, touch only their own page files): Tasks 7, 8, 9 — dispatch as 3 parallel Implementer subagents.
- Task 6 must run alone after Task 4 (it's the single dependency both Batch B members share).
- Task 10 must run alone, last — it modifies files created by Tasks 4, 6, 7, 8, and 9, so parallel dispatch would risk merge conflicts.

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `astro.config.mjs`
- Create: `.gitignore`
- Create: `src/styles/tokens.css`
- Create: `src/lib/paths.js`
- Create: `public/favicon.svg`
- Create: `public/.nojekyll`

**Depends on:** nothing (first task).
**Parallel with:** nothing (everything else depends on this).

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "the-rookie-explorer",
  "type": "module",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview"
  },
  "dependencies": {
    "astro": "^4.16.0",
    "js-yaml": "^4.1.0"
  }
}
```

- [ ] **Step 2: Create `astro.config.mjs`**

```js
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://sumitdas66.github.io',
  base: '/therookieexplorer',
  trailingSlash: 'always',
});
```

- [ ] **Step 3: Create `.gitignore`**

```
node_modules/
dist/
.astro/
```

- [ ] **Step 4: Create `src/lib/paths.js`**

```js
export function withBase(path) {
  const base = import.meta.env.BASE_URL;
  const cleanBase = base.endsWith('/') ? base : `${base}/`;
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${cleanBase}${cleanPath}`;
}
```

- [ ] **Step 5: Create `src/styles/tokens.css`**

```css
:root {
  /* Colors — from DESIGN.md */
  --color-canvas: #ffffff;
  --color-ink: #222222;
  --color-body: #3f3f3f;
  --color-muted: #6a6a6a;
  --color-muted-soft: #929292;
  --color-primary: #ff385c;
  --color-primary-active: #e00b41;
  --color-primary-disabled: #ffd1da;
  --color-on-primary: #ffffff;
  --color-surface-soft: #f7f7f7;
  --color-surface-strong: #f2f2f2;
  --color-hairline: #dddddd;
  --color-hairline-soft: #ebebeb;
  --color-border-strong: #c1c1c1;
  --color-error-text: #c13515;
  --color-scrim: rgba(0, 0, 0, 0.5);

  /* Typography */
  --font-family: 'Inter', -apple-system, system-ui, 'Helvetica Neue', sans-serif;

  /* Spacing (4px base) */
  --space-xxs: 2px;
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 12px;
  --space-base: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-xxl: 48px;
  --space-section: 64px;

  /* Radius */
  --radius-sm: 8px;
  --radius-md: 14px;
  --radius-xl: 32px;
  --radius-full: 9999px;

  /* Elevation */
  --shadow-card: rgba(0, 0, 0, 0.02) 0 0 0 1px, rgba(0, 0, 0, 0.04) 0 2px 6px 0, rgba(0, 0, 0, 0.1) 0 4px 8px 0;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--color-canvas);
  color: var(--color-ink);
  font-family: var(--font-family);
  font-size: 16px;
  line-height: 1.5;
}

a {
  color: inherit;
}
```

- [ ] **Step 6: Create `public/favicon.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="8" fill="#ff385c"/>
  <text x="16" y="22" font-family="Arial, sans-serif" font-size="16" font-weight="700" fill="#ffffff" text-anchor="middle">R</text>
</svg>
```

- [ ] **Step 7: Create empty `public/.nojekyll`**

Create an empty file at `public/.nojekyll` (zero bytes is correct — its presence is what matters).

- [ ] **Step 8: Verify**

Run: `npm install`
Expected: completes with no errors, creates `node_modules/` and `package-lock.json`.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json astro.config.mjs .gitignore src/styles/tokens.css src/lib/paths.js public/favicon.svg public/.nojekyll
git commit -m "Scaffold Astro project with design tokens and base-path helper"
```

---

### Task 2: Content-Layer Build Logic

**Files:**
- Create: `src/lib/itineraries.js`
- Create: `src/lib/photos.js`

**Depends on:** Task 1 (needs `package.json` with `js-yaml`, and `src/lib/paths.js`).
**Parallel with:** Tasks 3, 4, 5.

- [ ] **Step 1: Create `src/lib/itineraries.js`**

```js
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { withBase } from './paths.js';

const CATEGORIES = ['domestic', 'international'];
const ITINERARIES_ROOT = path.join(process.cwd(), 'public', 'itineraries');
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function fail(message) {
  throw new Error(`[itineraries] ${message}`);
}

function readMeta(folderPath, folderLabel) {
  const metaPath = path.join(folderPath, 'meta.txt');
  if (!fs.existsSync(metaPath)) {
    fail(`${folderLabel}: missing meta.txt`);
  }
  const raw = fs.readFileSync(metaPath, 'utf-8');
  let parsed;
  try {
    parsed = yaml.load(raw);
  } catch (err) {
    fail(`${folderLabel}: meta.txt is not valid YAML (${err.message})`);
  }
  if (!parsed || typeof parsed !== 'object') {
    fail(`${folderLabel}: meta.txt did not parse to an object`);
  }
  return parsed;
}

function validateMeta(meta, folderLabel, expectedCategory) {
  const required = ['title', 'category', 'date', 'duration', 'cost', 'summary'];
  for (const field of required) {
    if (meta[field] === undefined || meta[field] === null || meta[field] === '') {
      fail(`${folderLabel}: meta.txt missing required field "${field}"`);
    }
  }
  if (meta.category !== expectedCategory) {
    fail(`${folderLabel}: meta.txt category "${meta.category}" does not match its folder (expected "${expectedCategory}")`);
  }
  if (!DATE_PATTERN.test(String(meta.date)) || Number.isNaN(Date.parse(meta.date))) {
    fail(`${folderLabel}: meta.txt "date" must be a valid YYYY-MM-DD date, got "${meta.date}"`);
  }
  if (meta.tags !== undefined && !Array.isArray(meta.tags)) {
    fail(`${folderLabel}: meta.txt "tags" must be a list if present`);
  }
  if (meta.cover_image !== undefined && typeof meta.cover_image !== 'string') {
    fail(`${folderLabel}: meta.txt "cover_image" must be a filename string if present`);
  }
}

function findSinglePdf(folderPath, folderLabel) {
  const files = fs.readdirSync(folderPath).filter((f) => f.toLowerCase().endsWith('.pdf'));
  if (files.length === 0) {
    fail(`${folderLabel}: no .pdf file found (exactly one is required)`);
  }
  if (files.length > 1) {
    fail(`${folderLabel}: found ${files.length} .pdf files (exactly one is required): ${files.join(', ')}`);
  }
  return files[0];
}

export function getAllItineraries() {
  const results = [];
  const seenSlugs = new Set();

  for (const category of CATEGORIES) {
    const categoryPath = path.join(ITINERARIES_ROOT, category);
    if (!fs.existsSync(categoryPath)) {
      continue;
    }
    const slugs = fs
      .readdirSync(categoryPath)
      .filter((entry) => fs.statSync(path.join(categoryPath, entry)).isDirectory());

    for (const slug of slugs) {
      const folderLabel = `itineraries/${category}/${slug}`;
      if (!SLUG_PATTERN.test(slug)) {
        fail(`${folderLabel}: folder name is not valid kebab-case (lowercase letters, numbers, hyphens only)`);
      }
      if (seenSlugs.has(slug)) {
        fail(`${folderLabel}: slug "${slug}" is used by more than one itinerary folder`);
      }
      seenSlugs.add(slug);

      const folderPath = path.join(categoryPath, slug);
      const meta = readMeta(folderPath, folderLabel);
      validateMeta(meta, folderLabel, category);
      const pdfFile = findSinglePdf(folderPath, folderLabel);

      let coverImage = null;
      if (meta.cover_image) {
        const coverPath = path.join(folderPath, meta.cover_image);
        if (!fs.existsSync(coverPath)) {
          fail(`${folderLabel}: cover_image "${meta.cover_image}" does not exist in the folder`);
        }
        coverImage = withBase(`itineraries/${category}/${slug}/${meta.cover_image}`);
      }

      results.push({
        slug,
        category,
        title: meta.title,
        date: meta.date,
        duration: meta.duration,
        cost: meta.cost,
        tags: meta.tags || [],
        summary: meta.summary,
        coverImage,
        pdfUrl: withBase(`itineraries/${category}/${slug}/${pdfFile}`),
      });
    }
  }

  results.sort((a, b) => {
    if (a.date === b.date) {
      return a.title.localeCompare(b.title);
    }
    return a.date > b.date ? -1 : 1;
  });

  return results;
}

export function getItinerariesByCategory(category) {
  return getAllItineraries().filter((item) => item.category === category);
}
```

- [ ] **Step 2: Create `src/lib/photos.js`**

```js
import fs from 'node:fs';
import path from 'node:path';
import { withBase } from './paths.js';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

function warn(message) {
  if (process.env.GITHUB_ACTIONS === 'true') {
    console.log(`::warning::${message}`);
  } else {
    console.warn(`⚠️  ${message}`);
  }
}

export function getPhotos(bucket) {
  const bucketPath = path.join(process.cwd(), 'public', 'photos', bucket);
  if (!fs.existsSync(bucketPath)) {
    warn(`photos/${bucket}/ is empty`);
    return [];
  }
  const files = fs
    .readdirSync(bucketPath)
    .filter((f) => IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase()));

  if (files.length === 0) {
    warn(`photos/${bucket}/ is empty`);
    return [];
  }

  return files.sort().map((f) => withBase(`photos/${bucket}/${f}`));
}
```

- [ ] **Step 3: Verify**

Run: `node -e "console.log(1)"` is not useful here since these are ESM modules meant to run inside Astro's Vite context — actual verification happens once Task 7/8/9 pages import them and the site builds. No standalone verification for this task; proceed to commit.

- [ ] **Step 4: Commit**

```bash
git add src/lib/itineraries.js src/lib/photos.js
git commit -m "Add build-time content-layer modules for itineraries and site photos"
```

---

### Task 3: Sample Content Seeding

**Files:**
- Create: `public/itineraries/domestic/sample-kerala-backwaters/meta.txt`
- Create: `public/itineraries/domestic/sample-kerala-backwaters/itinerary.pdf`
- Create: `public/itineraries/international/sample-malaysia-kuala-lumpur/meta.txt`
- Create: `public/itineraries/international/sample-malaysia-kuala-lumpur/itinerary.pdf`
- Create: `public/photos/hero/.gitkeep`
- Create: `public/photos/about/.gitkeep`
- Create: `public/photos/moments/.gitkeep`

**Depends on:** Task 1 (needs `public/` to exist as a concept — no code dependency).
**Parallel with:** Tasks 2, 4, 5.

- [ ] **Step 1: Create `public/itineraries/domestic/sample-kerala-backwaters/meta.txt`**

```yaml
title: "Sample Trip — Kerala Backwaters (replace this folder)"
category: domestic
date: 2020-01-01
duration: "5 days"
cost: "₹20,000"
tags: [sample, placeholder]
summary: "Placeholder itinerary used to verify the site renders correctly. Delete this folder once real trips are added."
```

- [ ] **Step 2: Create `public/itineraries/domestic/sample-kerala-backwaters/itinerary.pdf`**

```
%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length 78 >>
stream
BT /F1 24 Tf 72 700 Td (Sample Itinerary - Replace This PDF) Tj ET
endstream
endobj
trailer
<< /Size 6 /Root 1 0 R >>
%%EOF
```

(This is a minimal placeholder PDF — enough to exist as a valid downloadable file for local verification. It will be replaced with a real itinerary PDF later.)

- [ ] **Step 3: Create `public/itineraries/international/sample-malaysia-kuala-lumpur/meta.txt`**

```yaml
title: "Sample Trip — Malaysia (replace this folder)"
category: international
date: 2020-01-02
duration: "4 days"
cost: "₹35,000"
tags: [sample, placeholder]
summary: "Placeholder itinerary used to verify the site renders correctly. Delete this folder once real trips are added."
```

- [ ] **Step 4: Create `public/itineraries/international/sample-malaysia-kuala-lumpur/itinerary.pdf`**

Use the same minimal PDF content as Step 2, with the text line changed to `(Sample Itinerary - Replace This PDF)` (identical file is fine — it's a placeholder).

- [ ] **Step 5: Create empty `.gitkeep` files**

Create three empty (zero-byte) files:
- `public/photos/hero/.gitkeep`
- `public/photos/about/.gitkeep`
- `public/photos/moments/.gitkeep`

These exist only so git tracks the empty folders — the user drops real photos in later and can delete the `.gitkeep` files at that point (or leave them; they're harmless).

- [ ] **Step 6: Commit**

```bash
git add public/itineraries public/photos
git commit -m "Seed sample itinerary content and empty photo-bucket folders"
```

---

### Task 4: Shared Design-System Components

**Files:**
- Create: `src/components/Button.astro`
- Create: `src/components/PlaceholderCover.astro`
- Create: `src/components/ItineraryCard.astro`
- Create: `src/components/TagChip.astro`

**Depends on:** Task 1 (`tokens.css` variables, `paths.js`).
**Parallel with:** Tasks 2, 3, 5.

- [ ] **Step 1: Create `src/components/Button.astro`**

```astro
---
const { href, variant = 'primary', class: className = '', ...rest } = Astro.props;
const Tag = href ? 'a' : 'button';
---
<Tag href={href} class:list={['btn', `btn-${variant}`, className]} {...rest}>
  <slot />
</Tag>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-sm);
    height: 48px;
    padding: 0 var(--space-lg);
    border-radius: var(--radius-sm);
    font-family: var(--font-family);
    font-size: 16px;
    font-weight: 500;
    text-decoration: none;
    border: none;
    cursor: pointer;
    transition: background-color 0.15s ease, transform 0.15s ease;
  }
  .btn-primary {
    background: var(--color-primary);
    color: var(--color-on-primary);
  }
  .btn-primary:hover {
    background: var(--color-primary-active);
  }
  .btn-secondary {
    background: var(--color-canvas);
    color: var(--color-ink);
    border: 1px solid var(--color-ink);
  }
  .btn:active {
    transform: scale(0.98);
  }
</style>
```

- [ ] **Step 2: Create `src/components/PlaceholderCover.astro`**

```astro
---
const { title = '' } = Astro.props;
---
<div class="placeholder-cover" aria-hidden="true">
  <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5">
    <path d="M2 16l4.5-4.5a2 2 0 0 1 2.8 0L12 14l3-3a2 2 0 0 1 2.8 0L22 15" />
    <circle cx="8" cy="8" r="2" />
    <rect x="2" y="3" width="20" height="18" rx="2" />
  </svg>
  <span class="placeholder-title">{title}</span>
</div>

<style>
  .placeholder-cover {
    width: 100%;
    aspect-ratio: 1 / 1;
    border-radius: var(--radius-md);
    background: linear-gradient(135deg, var(--color-surface-soft), var(--color-primary-disabled));
    color: var(--color-muted);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-sm);
    padding: var(--space-base);
    text-align: center;
  }
  .placeholder-title {
    font-size: 14px;
    font-weight: 500;
  }
</style>
```

- [ ] **Step 3: Create `src/components/ItineraryCard.astro`**

```astro
---
import PlaceholderCover from './PlaceholderCover.astro';
import { withBase } from '../lib/paths.js';
const { itinerary } = Astro.props;
const detailHref = withBase(`/${itinerary.category}/${itinerary.slug}/`);
---
<a href={detailHref} class="itinerary-card" data-animate="fade-up">
  <div class="cover-wrap">
    {itinerary.coverImage
      ? <img src={itinerary.coverImage} alt={itinerary.title} loading="lazy" />
      : <PlaceholderCover title={itinerary.title} />}
  </div>
  <div class="meta">
    <h3 class="title">{itinerary.title}</h3>
    <p class="sub">{itinerary.duration} · {itinerary.cost}</p>
    {itinerary.tags.length > 0 && (
      <div class="tags">
        {itinerary.tags.map((tag) => <span class="tag">{tag}</span>)}
      </div>
    )}
  </div>
</a>

<style>
  .itinerary-card {
    display: block;
    text-decoration: none;
    color: inherit;
    border-radius: var(--radius-md);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  .itinerary-card:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-card);
  }
  .cover-wrap {
    border-radius: var(--radius-md);
    overflow: hidden;
  }
  .cover-wrap img {
    width: 100%;
    aspect-ratio: 1 / 1;
    object-fit: cover;
    display: block;
    transition: transform 0.3s ease;
  }
  .itinerary-card:hover .cover-wrap img {
    transform: scale(1.05);
  }
  .meta {
    padding-top: var(--space-base);
  }
  .title {
    font-size: 16px;
    font-weight: 600;
    margin: 0 0 var(--space-xs);
  }
  .sub {
    font-size: 14px;
    color: var(--color-muted);
    margin: 0 0 var(--space-sm);
  }
  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xs);
  }
  .tag {
    font-size: 12px;
    padding: var(--space-xxs) var(--space-sm);
    border-radius: var(--radius-full);
    background: var(--color-surface-soft);
    color: var(--color-muted);
  }
</style>
```

- [ ] **Step 4: Create `src/components/TagChip.astro`**

```astro
---
const { label, active = false } = Astro.props;
---
<button type="button" class:list={['tag-chip', { active }]} data-tag={label}>
  {label}
</button>

<style>
  .tag-chip {
    border: 1px solid var(--color-hairline);
    background: var(--color-canvas);
    color: var(--color-ink);
    border-radius: var(--radius-full);
    padding: var(--space-xs) var(--space-base);
    font-size: 14px;
    cursor: pointer;
    transition: background-color 0.2s ease, color 0.2s ease, transform 0.15s ease;
  }
  .tag-chip.active {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: var(--color-on-primary);
  }
  .tag-chip:hover {
    transform: translateY(-1px);
  }
</style>
```

- [ ] **Step 5: Commit**

```bash
git add src/components/Button.astro src/components/PlaceholderCover.astro src/components/ItineraryCard.astro src/components/TagChip.astro
git commit -m "Add shared design-system components (button, card, tag chip, placeholder cover)"
```

---

### Task 5: GitHub Actions Deploy Workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

**Depends on:** Task 1 (needs to know the `npm run build` script exists).
**Parallel with:** Tasks 2, 3, 4.

- [ ] **Step 1: Create `.github/workflows/deploy.yml`**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "Add GitHub Actions workflow to build and deploy to GitHub Pages"
```

**Note for the orchestrator (not a task step):** after this lands, the repo's GitHub Pages source must be manually switched to "GitHub Actions" under Settings → Pages → Build and deployment. This is a one-time manual toggle in the GitHub UI/API, not a code change — remind the user once this task is dispatched.

---

### Task 6: Base Layout, Header, Footer

**Files:**
- Create: `src/components/Header.astro`
- Create: `src/components/Footer.astro`
- Create: `src/layouts/BaseLayout.astro`

**Depends on:** Task 4 (uses `Button.astro`), Task 1 (`tokens.css`, `paths.js`).
**Parallel with:** none — this is the single bridge between Batch A and Batch B; Tasks 7/8/9 all wait on this.

- [ ] **Step 1: Create `src/components/Header.astro`**

```astro
---
import { withBase } from '../lib/paths.js';
---
<header class="site-header">
  <a href={withBase('/')} class="brand">The Rookie Explorer</a>
  <nav class="nav">
    <a href={withBase('/domestic/')}>Domestic</a>
    <a href={withBase('/international/')}>International</a>
  </nav>
</header>

<style>
  .site-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 80px;
    padding: 0 var(--space-xl);
    border-bottom: 1px solid var(--color-hairline);
  }
  .brand {
    font-size: 20px;
    font-weight: 700;
    text-decoration: none;
    color: var(--color-ink);
  }
  .nav {
    display: flex;
    gap: var(--space-lg);
  }
  .nav a {
    text-decoration: none;
    color: var(--color-ink);
    font-weight: 600;
    font-size: 16px;
  }
</style>
```

- [ ] **Step 2: Create `src/components/Footer.astro`**

```astro
---
import Button from './Button.astro';
const mailSubject = encodeURIComponent('Hey Taniya & Sumit!');
const mailHref = `mailto:letsgotaniya@gmail.com?subject=${mailSubject}`;
---
<footer class="site-footer">
  <p>Have a question about a trip? We'd love to hear from you.</p>
  <Button href={mailHref} variant="primary">Get in Touch</Button>
  <p class="legal">© {new Date().getFullYear()} The Rookie Explorer · <a href="https://instagram.com/letsgo_taniya" target="_blank" rel="noopener">@letsgo_taniya</a></p>
</footer>

<style>
  .site-footer {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-base);
    padding: var(--space-section) var(--space-xl);
    border-top: 1px solid var(--color-hairline);
    text-align: center;
  }
  .legal {
    font-size: 13px;
    color: var(--color-muted);
  }
</style>
```

- [ ] **Step 3: Create `src/layouts/BaseLayout.astro`**

```astro
---
import '../styles/tokens.css';
import Header from '../components/Header.astro';
import Footer from '../components/Footer.astro';
import { withBase } from '../lib/paths.js';
const { title = 'The Rookie Explorer' } = Astro.props;
---
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" href={withBase('/favicon.svg')} />
    <title>{title}</title>
  </head>
  <body>
    <Header />
    <main>
      <slot />
    </main>
    <Footer />
  </body>
</html>
```

(Task 10 will modify this file to add View Transitions and the scroll-reveal script — don't add those now.)

- [ ] **Step 4: Verify**

Run: `npm run dev` and confirm the dev server starts without errors (there's no page yet, so visiting the URL will 404 — that's expected until Task 7 adds `index.astro`). Stop the server after confirming no startup errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/Header.astro src/components/Footer.astro src/layouts/BaseLayout.astro
git commit -m "Add base layout with header and footer"
```

---

### Task 7: Homepage

**Files:**
- Create: `src/components/HeroSection.astro`
- Create: `src/components/AboutBand.astro`
- Create: `src/components/MomentsStrip.astro`
- Create: `src/components/LatestItineraries.astro`
- Create: `src/components/CategoryEntryCards.astro`
- Create: `src/pages/index.astro`

**Depends on:** Task 2 (`getAllItineraries`, `getPhotos`), Task 4 (`ItineraryCard`), Task 6 (`BaseLayout`). Recommended (not code-blocking): Task 3 done first, so there's sample content to look at.
**Parallel with:** Tasks 8, 9.

- [ ] **Step 1: Create `src/components/HeroSection.astro`**

```astro
---
import { getPhotos } from '../lib/photos.js';
const photos = getPhotos('hero');
---
<section class="hero" data-animate="fade-up">
  <div class="hero-photos">
    {photos.length > 0
      ? photos.slice(0, 4).map((src) => <img src={src} alt="" loading="eager" />)
      : <div class="hero-fallback"></div>}
  </div>
  <div class="hero-copy">
    <h1>The Rookie Explorer</h1>
    <p>You don't need to be rich to see the world.</p>
  </div>
</section>

<style>
  .hero {
    position: relative;
    padding: var(--space-section) var(--space-xl);
    text-align: center;
    overflow: hidden;
  }
  .hero-fallback {
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, var(--color-surface-soft), var(--color-primary-disabled));
    z-index: -1;
  }
  .hero-photos {
    position: absolute;
    inset: 0;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    z-index: -1;
    opacity: 0.5;
  }
  .hero-photos img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .hero-copy h1 {
    font-size: 28px;
    font-weight: 700;
    margin: 0 0 var(--space-sm);
  }
  .hero-copy p {
    font-size: 18px;
    color: var(--color-body);
    margin: 0;
  }
</style>
```

(Task 10 will add the floating-emoji background into this section — don't add it now.)

- [ ] **Step 2: Create `src/components/AboutBand.astro`**

```astro
---
import { getPhotos } from '../lib/photos.js';
const photos = getPhotos('about');
---
<section class="about-band" data-animate="fade-up">
  <div class="about-copy">
    <h2>Taniya x Sumit — Budget Travel for Indians</h2>
    <p>Real costs & smart itineraries you'll actually use. We've been sharing our trips on Instagram — now you can download the full itineraries here, free.</p>
    <a class="ig-link" href="https://instagram.com/letsgo_taniya" target="_blank" rel="noopener">Follow @letsgo_taniya on Instagram</a>
  </div>
  {photos.length > 0 && (
    <div class="about-photos">
      {photos.slice(0, 3).map((src) => <img src={src} alt="" loading="lazy" />)}
    </div>
  )}
</section>

<style>
  .about-band {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xl);
    align-items: center;
    justify-content: center;
    padding: var(--space-section) var(--space-xl);
  }
  .about-copy {
    max-width: 480px;
  }
  .about-copy h2 {
    font-size: 21px;
    font-weight: 700;
    margin: 0 0 var(--space-base);
  }
  .about-copy p {
    color: var(--color-body);
    margin: 0 0 var(--space-base);
  }
  .ig-link {
    display: inline-block;
    font-weight: 600;
    color: var(--color-primary);
    text-decoration: none;
  }
  .about-photos {
    display: flex;
    gap: var(--space-sm);
  }
  .about-photos img {
    width: 120px;
    height: 120px;
    object-fit: cover;
    border-radius: var(--radius-md);
  }
</style>
```

- [ ] **Step 3: Create `src/components/MomentsStrip.astro`**

```astro
---
import { getPhotos } from '../lib/photos.js';
const photos = getPhotos('moments');
---
{photos.length > 0 && (
  <section class="moments-strip" data-animate="fade-up">
    {photos.map((src) => <img src={src} alt="" loading="lazy" />)}
  </section>
)}

<style>
  .moments-strip {
    display: flex;
    gap: var(--space-base);
    overflow-x: auto;
    padding: var(--space-base) var(--space-xl);
  }
  .moments-strip img {
    height: 220px;
    width: auto;
    border-radius: var(--radius-md);
    flex-shrink: 0;
  }
</style>
```

- [ ] **Step 4: Create `src/components/LatestItineraries.astro`**

```astro
---
import { getAllItineraries } from '../lib/itineraries.js';
import ItineraryCard from './ItineraryCard.astro';
const latest = getAllItineraries().slice(0, 4);
---
{latest.length > 0 && (
  <section class="latest" data-animate="fade-up">
    <h2>Latest Itineraries</h2>
    <div class="grid">
      {latest.map((itinerary) => <ItineraryCard itinerary={itinerary} />)}
    </div>
  </section>
)}

<style>
  .latest {
    padding: var(--space-section) var(--space-xl);
  }
  .latest h2 {
    font-size: 21px;
    font-weight: 700;
    margin: 0 0 var(--space-lg);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-base);
  }
  @media (max-width: 1128px) {
    .grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 744px) {
    .grid { grid-template-columns: 1fr; }
  }
</style>
```

- [ ] **Step 5: Create `src/components/CategoryEntryCards.astro`**

```astro
---
import { withBase } from '../lib/paths.js';
---
<section class="category-entry" data-animate="fade-up">
  <a class="entry-card" href={withBase('/domestic/')}>
    <h3>Domestic</h3>
    <p>Trips within India</p>
  </a>
  <a class="entry-card" href={withBase('/international/')}>
    <h3>International</h3>
    <p>Trips beyond India</p>
  </a>
</section>

<style>
  .category-entry {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-base);
    padding: 0 var(--space-xl) var(--space-section);
  }
  .entry-card {
    display: block;
    padding: var(--space-xl);
    border-radius: var(--radius-md);
    background: var(--color-surface-soft);
    text-decoration: none;
    color: var(--color-ink);
    text-align: center;
    transition: transform 0.2s ease;
  }
  .entry-card:hover {
    transform: translateY(-4px);
  }
  .entry-card h3 {
    margin: 0 0 var(--space-xs);
    font-size: 20px;
  }
  .entry-card p {
    margin: 0;
    color: var(--color-muted);
  }
  @media (max-width: 744px) {
    .category-entry { grid-template-columns: 1fr; }
  }
</style>
```

- [ ] **Step 6: Create `src/pages/index.astro`**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import HeroSection from '../components/HeroSection.astro';
import AboutBand from '../components/AboutBand.astro';
import MomentsStrip from '../components/MomentsStrip.astro';
import LatestItineraries from '../components/LatestItineraries.astro';
import CategoryEntryCards from '../components/CategoryEntryCards.astro';
---
<BaseLayout title="The Rookie Explorer">
  <HeroSection />
  <AboutBand />
  <MomentsStrip />
  <LatestItineraries />
  <CategoryEntryCards />
</BaseLayout>
```

- [ ] **Step 7: Verify**

Run: `npm run dev`, open the printed local URL. Confirm the homepage renders: hero with gradient fallback (photo folders are empty), about band with bio text and IG link, the two sample itineraries appear in "Latest Itineraries," and two category entry cards.

- [ ] **Step 8: Commit**

```bash
git add src/components/HeroSection.astro src/components/AboutBand.astro src/components/MomentsStrip.astro src/components/LatestItineraries.astro src/components/CategoryEntryCards.astro src/pages/index.astro
git commit -m "Implement homepage: hero, about band, moments strip, latest itineraries, category entry cards"
```

---

### Task 8: Category Listing Pages

**Files:**
- Create: `src/components/TagFilterGrid.astro`
- Create: `src/pages/domestic/index.astro`
- Create: `src/pages/international/index.astro`

**Depends on:** Task 2 (`getItinerariesByCategory`), Task 4 (`ItineraryCard`, `TagChip`), Task 6 (`BaseLayout`).
**Parallel with:** Tasks 7, 9.

- [ ] **Step 1: Create `src/components/TagFilterGrid.astro`**

```astro
---
import ItineraryCard from './ItineraryCard.astro';
import TagChip from './TagChip.astro';
const { itineraries } = Astro.props;
const allTags = [...new Set(itineraries.flatMap((i) => i.tags))].sort();
---
<div class="tag-filter-grid">
  {allTags.length > 0 && (
    <div class="chips" role="group" aria-label="Filter by tag">
      <TagChip label="all" active={true} />
      {allTags.map((tag) => <TagChip label={tag} />)}
    </div>
  )}
  <div class="grid" data-animate="fade-up">
    {itineraries.map((itinerary) => (
      <div class="grid-item" data-tags={itinerary.tags.join(',')}>
        <ItineraryCard itinerary={itinerary} />
      </div>
    ))}
  </div>
</div>

<script>
  const containers = document.querySelectorAll('.tag-filter-grid');
  containers.forEach((container) => {
    const chips = container.querySelectorAll('.tag-chip');
    const items = container.querySelectorAll('.grid-item');
    chips.forEach((chip) => {
      chip.addEventListener('click', () => {
        chips.forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        const tag = chip.dataset.tag;
        items.forEach((item) => {
          const tags = item.dataset.tags ? item.dataset.tags.split(',') : [];
          const show = tag === 'all' || tags.includes(tag);
          item.classList.toggle('hidden', !show);
        });
      });
    });
  });
</script>

<style>
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-sm);
    margin-bottom: var(--space-lg);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-base);
  }
  .grid-item.hidden {
    display: none;
  }
  @media (max-width: 1128px) {
    .grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 744px) {
    .grid { grid-template-columns: 1fr; }
  }
</style>
```

- [ ] **Step 2: Create `src/pages/domestic/index.astro`**

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import TagFilterGrid from '../../components/TagFilterGrid.astro';
import { getItinerariesByCategory } from '../../lib/itineraries.js';
const itineraries = getItinerariesByCategory('domestic');
---
<BaseLayout title="Domestic Itineraries — The Rookie Explorer">
  <section class="page-header" data-animate="fade-up">
    <h1>Domestic Itineraries</h1>
  </section>
  <div class="page-body">
    <TagFilterGrid itineraries={itineraries} />
  </div>
</BaseLayout>

<style>
  .page-header {
    padding: var(--space-xl) var(--space-xl) 0;
  }
  .page-body {
    padding: 0 var(--space-xl) var(--space-section);
  }
</style>
```

- [ ] **Step 3: Create `src/pages/international/index.astro`**

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import TagFilterGrid from '../../components/TagFilterGrid.astro';
import { getItinerariesByCategory } from '../../lib/itineraries.js';
const itineraries = getItinerariesByCategory('international');
---
<BaseLayout title="International Itineraries — The Rookie Explorer">
  <section class="page-header" data-animate="fade-up">
    <h1>International Itineraries</h1>
  </section>
  <div class="page-body">
    <TagFilterGrid itineraries={itineraries} />
  </div>
</BaseLayout>

<style>
  .page-header {
    padding: var(--space-xl) var(--space-xl) 0;
  }
  .page-body {
    padding: 0 var(--space-xl) var(--space-section);
  }
</style>
```

- [ ] **Step 4: Verify**

Run: `npm run dev`, visit `/domestic/` and `/international/`. Confirm each shows its one sample itinerary, the "sample, placeholder" tag chips appear and toggle the grid correctly when clicked.

- [ ] **Step 5: Commit**

```bash
git add src/components/TagFilterGrid.astro src/pages/domestic/index.astro src/pages/international/index.astro
git commit -m "Implement Domestic and International category pages with tag filtering"
```

---

### Task 9: Itinerary Detail Page

**Files:**
- Create: `src/pages/[category]/[slug].astro`

**Depends on:** Task 2 (`getAllItineraries`), Task 4 (`PlaceholderCover`, `Button`), Task 6 (`BaseLayout`).
**Parallel with:** Tasks 7, 8.

- [ ] **Step 1: Create `src/pages/[category]/[slug].astro`**

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import PlaceholderCover from '../../components/PlaceholderCover.astro';
import Button from '../../components/Button.astro';
import { getAllItineraries } from '../../lib/itineraries.js';

export function getStaticPaths() {
  return getAllItineraries().map((itinerary) => ({
    params: { category: itinerary.category, slug: itinerary.slug },
    props: { itinerary },
  }));
}

const { itinerary } = Astro.props;
---
<BaseLayout title={`${itinerary.title} — The Rookie Explorer`}>
  <article class="detail" data-animate="fade-up">
    <div class="cover">
      {itinerary.coverImage
        ? <img src={itinerary.coverImage} alt={itinerary.title} />
        : <PlaceholderCover title={itinerary.title} />}
    </div>
    <div class="body">
      <h1>{itinerary.title}</h1>
      <p class="meta-line">{itinerary.duration} · {itinerary.cost}</p>
      <p class="summary">{itinerary.summary}</p>
      {itinerary.tags.length > 0 && (
        <div class="tags">
          {itinerary.tags.map((tag) => <span class="tag">{tag}</span>)}
        </div>
      )}
      <Button href={itinerary.pdfUrl} variant="primary" download>Download Itinerary (PDF)</Button>
    </div>
  </article>
</BaseLayout>

<style>
  .detail {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-xl);
    padding: var(--space-section) var(--space-xl);
    max-width: 1080px;
    margin: 0 auto;
  }
  .cover img {
    width: 100%;
    border-radius: var(--radius-md);
    object-fit: cover;
  }
  .body h1 {
    font-size: 22px;
    margin: 0 0 var(--space-sm);
  }
  .meta-line {
    color: var(--color-muted);
    margin: 0 0 var(--space-base);
  }
  .summary {
    color: var(--color-body);
    margin: 0 0 var(--space-lg);
  }
  .tags {
    display: flex;
    gap: var(--space-xs);
    margin-bottom: var(--space-lg);
    flex-wrap: wrap;
  }
  .tag {
    font-size: 12px;
    padding: var(--space-xxs) var(--space-sm);
    border-radius: var(--radius-full);
    background: var(--color-surface-soft);
    color: var(--color-muted);
  }
  @media (max-width: 744px) {
    .detail { grid-template-columns: 1fr; }
  }
</style>
```

- [ ] **Step 2: Verify**

Run: `npm run dev`, click through from `/domestic/` into the sample Kerala trip's detail page. Confirm the placeholder cover renders (no `cover_image` set on the sample data), summary/duration/cost/tags show correctly, and the download button points at the sample PDF.

- [ ] **Step 3: Commit**

```bash
git add "src/pages/[category]/[slug].astro"
git commit -m "Implement itinerary detail page with PDF download"
```

---

### Task 10: Animation System

**Files:**
- Create: `src/styles/motion.css`
- Create: `src/scripts/scroll-reveal.js`
- Create: `src/components/EmojiBackground.astro`
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/components/HeroSection.astro`

**Depends on:** Tasks 4, 6, 7, 8, 9 (touches files created by all of them; must run after every structural page exists).
**Parallel with:** none — dispatch alone, last.

- [ ] **Step 1: Create `src/styles/motion.css`**

```css
[data-animate] {
  opacity: 0;
  transform: translateY(24px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}
[data-animate].is-visible {
  opacity: 1;
  transform: translateY(0);
}

@media (prefers-reduced-motion: reduce) {
  [data-animate] {
    opacity: 1;
    transform: none;
    transition: none;
  }
  * {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
  }
}
```

- [ ] **Step 2: Create `src/scripts/scroll-reveal.js`**

```js
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!prefersReducedMotion) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  document.querySelectorAll('[data-animate]').forEach((el) => observer.observe(el));
} else {
  document.querySelectorAll('[data-animate]').forEach((el) => el.classList.add('is-visible'));
}
```

- [ ] **Step 3: Create `src/components/EmojiBackground.astro`**

```astro
---
const EMOJI = ['✈️', '🧳', '🗺️', '🏖️', '🎒', '🌏', '🚆', '🏔️', '📸', '🌴'];
const COUNT = 10;
const items = Array.from({ length: COUNT }, (_, i) => {
  const emoji = EMOJI[i % EMOJI.length];
  const left = Math.round((i / COUNT) * 100 + (i % 3) * 2);
  const delay = (i * 1.7).toFixed(1);
  const duration = (18 + (i % 5) * 3).toFixed(1);
  return { emoji, left, delay, duration };
});
---
<div class="emoji-layer" aria-hidden="true">
  {items.map((item) => (
    <span
      class="emoji"
      style={`left: ${item.left}%; animation-delay: ${item.delay}s; animation-duration: ${item.duration}s;`}
    >
      {item.emoji}
    </span>
  ))}
</div>

<style>
  .emoji-layer {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
    z-index: -1;
  }
  .emoji {
    position: absolute;
    top: 100%;
    font-size: 28px;
    opacity: 0.18;
    animation-name: float-up;
    animation-timing-function: linear;
    animation-iteration-count: infinite;
    will-change: transform;
  }
  @keyframes float-up {
    from { transform: translateY(0); }
    to { transform: translateY(-120vh); }
  }
  @media (prefers-reduced-motion: reduce) {
    .emoji-layer {
      display: none;
    }
  }
</style>
```

- [ ] **Step 4: Modify `src/layouts/BaseLayout.astro`**

Replace the full file with:

```astro
---
import '../styles/tokens.css';
import '../styles/motion.css';
import { ViewTransitions } from 'astro:transitions';
import Header from '../components/Header.astro';
import Footer from '../components/Footer.astro';
import { withBase } from '../lib/paths.js';
const { title = 'The Rookie Explorer' } = Astro.props;
---
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" href={withBase('/favicon.svg')} />
    <title>{title}</title>
    <ViewTransitions />
  </head>
  <body>
    <Header />
    <main>
      <slot />
    </main>
    <Footer />
    <script>
      import '../scripts/scroll-reveal.js';
    </script>
  </body>
</html>
```

- [ ] **Step 5: Modify `src/components/HeroSection.astro`**

Replace the full file with:

```astro
---
import { getPhotos } from '../lib/photos.js';
import EmojiBackground from './EmojiBackground.astro';
const photos = getPhotos('hero');
---
<section class="hero" data-animate="fade-up">
  <EmojiBackground />
  <div class="hero-photos">
    {photos.length > 0
      ? photos.slice(0, 4).map((src) => <img src={src} alt="" loading="eager" />)
      : <div class="hero-fallback"></div>}
  </div>
  <div class="hero-copy">
    <h1>The Rookie Explorer</h1>
    <p>You don't need to be rich to see the world.</p>
  </div>
</section>

<style>
  .hero {
    position: relative;
    padding: var(--space-section) var(--space-xl);
    text-align: center;
    overflow: hidden;
  }
  .hero-fallback {
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, var(--color-surface-soft), var(--color-primary-disabled));
    z-index: -1;
  }
  .hero-photos {
    position: absolute;
    inset: 0;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    z-index: -1;
    opacity: 0.5;
  }
  .hero-photos img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .hero-copy h1 {
    font-size: 28px;
    font-weight: 700;
    margin: 0 0 var(--space-sm);
  }
  .hero-copy p {
    font-size: 18px;
    color: var(--color-body);
    margin: 0;
  }
</style>
```

- [ ] **Step 6: Verify**

Run: `npm run dev`. Confirm: (1) sections fade/slide in as you scroll the homepage and category pages, (2) itinerary cards lift and zoom their cover on hover, (3) navigating Home → Domestic → an itinerary detail shows a smooth transition instead of a hard reload, (4) the homepage (only) shows faint travel emoji drifting upward behind the hero, (5) with OS-level "reduce motion" turned on (or by forcing `prefers-reduced-motion: reduce` in devtools), all of the above becomes static/instant and the emoji layer disappears entirely.

- [ ] **Step 7: Run a full production build**

Run: `npm run build`
Expected: exits 0, produces `dist/` with `index.html`, `domestic/index.html`, `international/index.html`, and one detail page per sample itinerary, plus `dist/itineraries/...` and `dist/.nojekyll` present.

- [ ] **Step 8: Commit**

```bash
git add src/styles/motion.css src/scripts/scroll-reveal.js src/components/EmojiBackground.astro src/layouts/BaseLayout.astro src/components/HeroSection.astro
git commit -m "Add animation system: scroll reveals, view transitions, homepage emoji background, reduced-motion support"
```

---

## After All Tasks Land

1. Remind the user to set the repo's GitHub Pages source to "GitHub Actions" (Settings → Pages) — required once, cannot be done via code (see Architecture Decision 6).
2. Push to `main` and confirm the Actions workflow run in the GitHub UI goes green and the site is live at `https://sumitdas66.github.io/therookieexplorer/`.
3. The orchestrating session (not an Implementer subagent) should open the deployed or local-preview site in a browser and visually confirm the golden path — this is a verification step for the orchestrator per project convention, not a plan task.
