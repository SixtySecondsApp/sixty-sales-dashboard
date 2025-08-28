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
  console.error('❌ Error: Release notes are required');
  console.log('Usage: node scripts/add-release.js "Release notes here" [buildId]');
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
  console.log('📝 Creating new releases.json file...');
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
  console.log('🗑️  Trimmed to 10 most recent releases');
}

// Write updated releases
writeFileSync(releasesPath, JSON.stringify(releases, null, 2));

console.log('✅ New release added:');
console.log(`   Build ID: ${buildId}`);
console.log(`   Date: ${date}`);
console.log(`   Notes: ${notes}`);
console.log(`   File: ${releasesPath}`);
console.log(`   Total releases: ${releases.length}`);