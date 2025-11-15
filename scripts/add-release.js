#!/usr/bin/env node

import { writeFileSync, readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Script to add a new release to releases.json
 * Usage: node scripts/add-release.js "Release notes here" [buildId]
 * Example: node scripts/add-release.js "Fixed critical bug in user authentication" build-2025-01-28-v1.0.1
 */

const args = process.argv.slice(2);
const notes = args[0];
const customBuildId = args[1];

if (!notes) {
  process.exit(1);
}

// Generate build ID or use provided one
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const buildId = customBuildId || `build-${timestamp}`;
const date = new Date().toISOString();

// Read current releases
const releasesPath = resolve(process.cwd(), 'public/releases.json');
let releases = [];

try {
  const releasesContent = readFileSync(releasesPath, 'utf8');
  releases = JSON.parse(releasesContent);
} catch (error) {
}

// Add new release to the beginning of the array
const newRelease = {
  buildId,
  date,
  notes
};

releases.unshift(newRelease);

// Keep only the last 10 releases
if (releases.length > 10) {
  releases = releases.slice(0, 10);
}

// Write updated releases
writeFileSync(releasesPath, JSON.stringify(releases, null, 2));