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
