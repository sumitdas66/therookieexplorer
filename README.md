# The Rookie Explorer

A static travel itinerary site for [@letsgo_taniya](https://instagram.com/letsgo_taniya), built with Astro and deployed to GitHub Pages at [sumitdas66.github.io/therookieexplorer](https://sumitdas66.github.io/therookieexplorer/). Visitors browse Domestic and International trips and download free PDF itineraries.

## Development

```bash
npm install
npm run dev      # http://localhost:4321/therookieexplorer/
npm run build    # production build to dist/
npm run preview  # preview the production build locally
```

Pushing to `main` automatically builds and deploys the site via GitHub Actions (`.github/workflows/deploy.yml`) — there is no manual publish step.

## Adding a new itinerary

Every itinerary is just a folder — there is no admin panel, database, or code change required. Drop the folder in, push to `main`, and it appears on the site, sorted newest-first by its `date` field.

### 1. Create the folder

Place it under `public/itineraries/domestic/` or `public/itineraries/international/`, depending on the trip:

```
public/itineraries/domestic/goa-beaches/
public/itineraries/international/bali-honeymoon/
```

The folder name becomes the URL slug, so it must be **lowercase kebab-case**: lowercase letters, numbers, and hyphens only (e.g. `goa-beaches`, not `Goa Beaches` or `goa_beaches`). It is never shown to visitors as-is — the human-readable name comes from `title` in `meta.txt` below. It must also be unique across *both* categories combined; reusing a slug that already exists anywhere fails the build.

### 2. Add exactly one PDF

Put the downloadable itinerary at `<folder>/itinerary.pdf`. Exactly one PDF file per folder — zero or more than one both fail the build. The filename doesn't matter as long as it ends in `.pdf`.

### 3. Add `meta.txt`

Create `<folder>/meta.txt` with this YAML content (the `.txt` extension is intentional — it's plain YAML, just easy to open and edit anywhere):

```yaml
title: "Goa, India"
category: domestic
date: 2026-08-15
duration: "4 days"
cost: "₹18,000"
tags: [budget, beach, weekend-trip]
summary: "Everything you need for a relaxed 4-day budget trip to Goa."
cover_image: goa-beach.jpg
```

| Field | Required | Notes |
| --- | --- | --- |
| `title` | yes | Display name shown on the site. Can be anything — doesn't need to match the folder name. |
| `category` | yes | Must be `domestic` or `international`, and must match the folder it's actually placed in. |
| `date` | yes | `YYYY-MM-DD`, quoted or unquoted. This is the **only** sort key — newest date appears first, site-wide. Not git history, not folder creation time. |
| `duration` | yes | Free text, e.g. `"4 days"`. |
| `cost` | yes | Free text, e.g. `"₹18,000"`. |
| `summary` | yes | One or two sentences shown on the card and detail page. |
| `tags` | no | List of free-text tags, e.g. `[budget, beach]`. Powers the filter chips on the category page. Omit entirely if you don't want any. |
| `cover_image` | no | Filename of an image *in this same folder* (see step 4). If omitted, a default placeholder graphic is shown instead — this is fine and won't fail the build. |

### 4. (Optional) Add a cover image

If you set `cover_image` in `meta.txt`, add that exact file into the same folder, e.g.:

```
public/itineraries/domestic/goa-beaches/goa-beach.jpg
```

The path is resolved relative to the folder itself — no shared/central image directory. If the file referenced by `cover_image` is missing, the build fails.

### 5. Commit and push

```bash
git add public/itineraries/domestic/goa-beaches
git commit -m "Add Goa itinerary"
git push origin main
```

The GitHub Actions workflow rebuilds and redeploys automatically. No further steps.

### Build-time validation (fails loudly, on purpose)

The build hard-fails the GitHub Actions run — nothing goes live — if any of these are wrong, so a broken itinerary can never accidentally publish:

- Folder name isn't valid kebab-case
- The same slug is reused across any two folders (domestic or international)
- A folder has zero or more than one `.pdf` file
- `meta.txt` is missing, isn't valid YAML, or is missing a required field
- `date` isn't a valid `YYYY-MM-DD` date
- `category` in `meta.txt` doesn't match the folder it's in
- `cover_image` is set but that file doesn't exist in the folder

### Updating an existing itinerary

Just overwrite `itinerary.pdf` and/or edit `meta.txt` in place in its existing folder, and push. Git history is the changelog — there's no versioning folder convention. Only bump `date` if you actually want the trip to re-sort to the top.

### Placeholder content to remove

`public/itineraries/domestic/sample-kerala-backwaters/` and `public/itineraries/international/sample-malaysia-kuala-lumpur/` are sample folders used to verify the site during initial development — both are clearly titled `(replace this folder)`. Delete them (or just leave them until you've added enough real trips that they're no longer needed).

## Site photos

Separate from itinerary covers — `public/photos/hero/` (homepage hero) and `public/photos/moments/` (the auto-sliding ribbon on the homepage) each just need image files (`.jpg`, `.jpeg`, `.png`, or `.webp`) dropped in; no metadata needed. Empty folders degrade gracefully (gradient fallback for the hero, hidden ribbon if `moments/` is empty) rather than failing the build.
