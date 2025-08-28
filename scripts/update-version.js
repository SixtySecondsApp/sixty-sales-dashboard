#!/usr/bin/env node

import { writeFileSync, readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Script to update version.json with current build information
 * Usage: node scripts/update-version.js [version]
 * Example: node scripts/update-version.js v1.2.3
 */

const args = process.argv.slice(2);
const version = args[0] || 'dev';

// Generate unique build ID with timestamp
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const buildId = `build-${timestamp}-${version}`;
const builtAt = new Date().toISOString();

// Update version.json
const versionData = {
  buildId,
  builtAt
};

const versionPath = resolve(process.cwd(), 'public/version.json');
writeFileSync(versionPath, JSON.stringify(versionData, null, 2));

console.log('✅ Version updated:');
console.log(`   Build ID: ${buildId}`);
console.log(`   Built At: ${builtAt}`);
console.log(`   File: ${versionPath}`);

// Optional: Update package.json version if provided
if (version !== 'dev' && version.startsWith('v')) {
  try {
    const packagePath = resolve(process.cwd(), 'package.json');
    const packageData = JSON.parse(readFileSync(packagePath, 'utf8'));
    packageData.version = version.slice(1); // Remove 'v' prefix
    writeFileSync(packagePath, JSON.stringify(packageData, null, 2) + '\n');
    console.log(`📦 Package.json version updated to: ${packageData.version}`);
  } catch (error) {
    console.warn('⚠️  Could not update package.json version:', error.message);
  }
}