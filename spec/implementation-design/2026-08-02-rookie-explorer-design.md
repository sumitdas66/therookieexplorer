# The Rookie Explorer — Design Spec

Date: 2026-08-02
Status: Approved

## Purpose

A travel website that acts as the downloadable-itinerary companion to the Instagram account [@letsgo_taniya](https://instagram.com/letsgo_taniya) ("Taniya x Sumit | Budget Travel for Indians"). Visitors browse trips by category, read a short summary, and download a free PDF itinerary. The overriding non-functional goal: after initial build, adding a new trip must never require touching code — only dropping files into a folder and pushing to `main`.

## Stack & Hosting

- **Astro**, static output only (no server, no API routes, no database).
- **GitHub Actions** builds the site on every push to `main` and deploys the static output to **GitHub Pages**.
- Served at the default project-page subpath, `sumitdas66.github.io/therookieexplorer/`. A custom domain may be added later via a `CNAME` file with no code changes.
- The build script walks the content folders described below at build time and generates all pages from what it finds — there is no manifest file to hand-maintain and no admin panel.

## Content Model: Itineraries

```
itineraries/
  domestic/
    {slug}/
      itinerary.pdf
      meta.txt
      {cover_image, optional}
  international/
    {slug}/
      itinerary.pdf
      meta.txt
      {cover_image, optional}
```

- **`{slug}`** is the folder name: lowercase kebab-case, letters/numbers/hyphens only. It becomes the URL path segment. It is never shown as-is in the UI — display text always comes from `meta.txt`'s `title` field.
- **`itinerary.pdf`** — the downloadable file. Each folder must contain exactly one PDF. Zero or multiple PDFs in a folder is a build error.
- **`meta.txt`** — YAML content (the `.txt` extension is intentional; it signals "plain edit me," but the parser expects strict YAML):

  ```yaml
  title: "Kuala Lumpur, Malaysia"
  category: international   # "domestic" | "international"
  date: 2026-08-15           # sort key — see Ordering below
  duration: "4 days"
  cost: "₹35,000"
  tags: [budget, southeast-asia, city]
  summary: "Everything you need for 4 days in KL without breaking the bank."
  cover_image: kl-towers.jpg  # optional, filename relative to this same folder
  ```

- **Cover image**, if present, lives in the same folder as `itinerary.pdf` and `meta.txt` and is referenced by filename only. If `cover_image` is omitted, the card renders a default placeholder styled per [DESIGN.md](../../DESIGN.md) instead of erroring.

### Ordering

`date` in `meta.txt` is the **only** sort key for "newest first." Git commit time, folder creation time, and filesystem metadata are all explicitly rejected as sort sources — none of them are reliably preserved through a fresh `git clone`/CI checkout, and a backfilled old trip must not jump to the top just because it was added recently.

### Revisions

To update a trip, overwrite `itinerary.pdf` (and/or `meta.txt`) in place in its existing folder and commit. Git history is the changelog; there is no `v2` folder convention and no separate versioning mechanism. `date` only changes if you deliberately want the trip to re-sort to the top.

### Explicitly unsupported

- **No draft/"coming soon" state.** A folder is either a complete, valid itinerary (passes all build checks below) or it does not exist. There is no in-between.
- **No multiple PDFs per trip.** One trip = one itinerary = one PDF.

### Build-time validation (fail loudly)

The build must hard-fail (red GitHub Actions run) on any of:
- Folder name that isn't valid kebab-case
- Slug collision (same folder name reused, including across `domestic`/`international`)
- A trip folder with zero or more than one `.pdf` file
- Missing or invalid `date` field in `meta.txt`

These are load-bearing content-correctness checks, not style preferences — a broken build is the mechanism that prevents bad content from ever going live.

## Content Model: Site Photos

Separate from itinerary cover images — these feed site-wide decorative/personal placements:

```
photos/
  hero/      — curated, small set. Feeds the homepage hero collage.
  about/     — curated, small set. Feeds the About/bio band.
  moments/   — open pool. Any photo dropped in feeds a scrolling/masonry
               strip between the Domestic and International sections
               on the homepage. Order/curation doesn't matter here.
```

Unlike itinerary folders, **empty photo folders never fail the build.** They degrade gracefully at runtime:
- Empty `photos/hero/` → hero renders a plain gradient background using DESIGN.md palette tokens instead of a photo collage.
- Empty `photos/about/` → About band renders text-only (bio copy + Instagram link), no photos.
- Empty `photos/moments/` → the moments strip section doesn't render at all.

In all three cases the build still emits a visible warning annotation (e.g. `⚠️ warning: photos/hero/ is empty`) on the GitHub Actions run, so an empty photo folder is never silently missed — it just never blocks deployment.

## Taxonomy

Exactly two top-level categories: **Domestic** and **International**. No further sub-page routing by country or region.

Within each category's listing page, a **tag-based filter chip bar** reads the `tags` array from every itinerary's `meta.txt` (e.g. "Southeast Asia," "Budget," "Beach") and lets visitors filter the grid. Toggling a chip animates chips and card-grid reflow smoothly rather than snapping instantly. No separate taxonomy data file — tags are free, since they already live in content that must exist anyway.

## Pages

### Homepage (landing/highlight page — not the full catalog)

1. **Hero** — photo collage sourced from `photos/hero/` (or gradient fallback), with the floating travel-emoji background animation (see Animation).
2. **About/bio band** — short bio copy sourced from the Instagram profile ("Taniya x Sumit | Budget Travel for Indians," "You don't need to be rich to see the world," "Real costs & Smart Itineraries you'll actually use"), photos from `photos/about/`, and a visible "Follow @letsgo_taniya on Instagram" link/button.
3. **Moments strip** — scrolling/masonry strip fed by `photos/moments/`, sitting between the bio band and the itinerary content.
4. **Latest Itineraries preview** — the 3–4 most recent itineraries across both categories combined, sorted by `date`.
5. **Category entry cards** — two clear entry points into `/domestic/` and `/international/`.
6. **Footer** — a styled `mailto:letsgotaniya@gmail.com` contact button (default subject line, e.g. "Hey Taniya & Sumit!").

### `/domestic/` and `/international/`

Full, filterable (tag chips) grid of every itinerary in that category, newest-first by `date`. Each card shows cover image, title, duration, cost, and tags, and links to a detail/download view.

## Branding & Visual System

- Site title: **"The Rookie Explorer"** — deliberately kept distinct from the Instagram handle `@letsgo_taniya`, not a rename. The connection is made explicit via a visible follow link on the homepage rather than folded into the site name.
- Visual design system reuses [DESIGN.md](../../DESIGN.md) as-is: white canvas, Rausch (#ff385c) primary accent, ink (#222) text, Airbnb Cereal VF / Inter fallback font, soft rounded corners, single shadow tier, photo-first cards, 8px/4px spacing scale, responsive breakpoints at 744/1128/1440px.

## Animation System

Layered on top of the otherwise-restrained Airbnb-derived DESIGN.md:

- **Scroll-triggered reveals** — cards/sections fade and slide into view on scroll.
- **Hover micro-interactions** — itinerary cards lift, cover photo does a subtle zoom.
- **Page/route transitions** — smooth cross-fade/slide between Home → category pages → itinerary detail, via Astro's View Transitions API.
- **Hero motion** — subtle parallax/drift on the hero photo collage on load.
- **Animated filter chips** — smooth in/out toggling and card-grid reflow, not an instant snap.
- **Floating travel-emoji background** (✈️ 🧳 🗺️ 🏖️ 🎒 🌏, etc.) — **homepage only**, never on category or detail pages, where focus should stay on trip content and the download action. Pure CSS `transform`-based animation (no JS animation loop) for performance, a modest fixed count (~8–12 emoji), very low opacity, positioned behind all real content (below any clickable element in stacking order).

**`prefers-reduced-motion` is a hard requirement, not a nice-to-have** — every animation listed above, including the emoji drift, must have a static/calm fallback when that media query is set.

## Contact

A plain `mailto:letsgotaniya@gmail.com` link styled as an interactive button, with a default pre-filled subject line. No third-party form service, no backend — proportionate to expected volume, and consistent with the fully-static GitHub Pages hosting constraint (there is no server available to receive a real form submission anyway).

## Out of Scope (explicitly not building)

- Draft/"coming soon" itinerary state
- Itinerary versioning beyond in-place PDF overwrite
- Sub-category routing by country/region (tags handle this instead)
- Any contact form requiring a backend or third-party service
- Custom domain (deferred, not blocking)
- Site-wide (non-homepage) ambient animation
