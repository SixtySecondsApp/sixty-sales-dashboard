#!/usr/bin/env node

import { execSync } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Complete build release script for CI/CD integration
 * Updates version.json, adds to releases.json, and triggers build
 * 
 * Usage: node scripts/build-release.js [version] [notes]
 * Example: node scripts/build-release.js v1.2.3 "Fixed authentication bug"
 * 
 * Environment variables:
 * - BUILD_VERSION: Override version (e.g., from Git tag)
 * - RELEASE_NOTES: Override release notes
 * - SKIP_BUILD: Skip the actual build process (for testing)
 */

const args = process.argv.slice(2);
const version = process.env.BUILD_VERSION || args[0] || 'dev';
const releaseNotes = process.env.RELEASE_NOTES || args[1] || `Build ${version}`;
const skipBuild = process.env.SKIP_BUILD === 'true';
// Generate build information
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const buildId = `build-${timestamp}-${version}`;
const builtAt = new Date().toISOString();

try {
  // Step 1: Update version.json
  const versionData = { buildId, builtAt };
  const versionPath = resolve(process.cwd(), 'public/version.json');
  writeFileSync(versionPath, JSON.stringify(versionData, null, 2));
  // Step 2: Add to releases.json
  const releasesPath = resolve(process.cwd(), 'public/releases.json');
  let releases = [];
  
  try {
    const releasesContent = readFileSync(releasesPath, 'utf8');
    releases = JSON.parse(releasesContent);
  } catch (error) {
  }

  const newRelease = {
    buildId,
    date: builtAt,
    notes: releaseNotes
  };

  releases.unshift(newRelease);
  if (releases.length > 10) releases = releases.slice(0, 10);
  
  writeFileSync(releasesPath, JSON.stringify(releases, null, 2));
  // Step 3: Update package.json if version provided
  if (version !== 'dev' && version.startsWith('v')) {
    const packagePath = resolve(process.cwd(), 'package.json');
    const packageData = JSON.parse(readFileSync(packagePath, 'utf8'));
    packageData.version = version.slice(1);
    writeFileSync(packagePath, JSON.stringify(packageData, null, 2) + '\n');
  }

  // Step 4: Build the application (unless skipped)
  if (!skipBuild) {
    execSync('npm run build', { stdio: 'inherit', cwd: process.cwd() });
  } else {
  }

  // Step 5: Display summary
  // Step 6: Output for CI/CD systems
  if (process.env.CI) {
  }

} catch (error) {
  process.exit(1);
}