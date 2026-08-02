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
