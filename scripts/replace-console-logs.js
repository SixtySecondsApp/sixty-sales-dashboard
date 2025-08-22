#!/usr/bin/env node

/**
 * Script to replace all console.log/warn/error statements with logger utility
 * This prevents memory leaks in production
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Files to process
const patterns = [
  'src/**/*.ts',
  'src/**/*.tsx',
  '!src/**/*.test.ts',
  '!src/**/*.test.tsx',
  '!src/lib/utils/logger.ts'
];

// Get all files matching the patterns
const files = glob.sync('{' + patterns.join(',') + '}', {
  cwd: path.join(__dirname, '..'),
  absolute: true
});

let totalReplacements = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  const originalContent = content;
  
  // Check if file already imports logger
  const hasLoggerImport = content.includes("from '@/lib/utils/logger'");
  
  // Count console statements
  const consoleCount = (content.match(/console\.(log|warn|error)/g) || []).length;
  
  if (consoleCount > 0) {
    // Add logger import if not present
    if (!hasLoggerImport) {
      // Find the last import statement
      const importMatch = content.match(/^import .* from .*;?$/gm);
      if (importMatch) {
        const lastImport = importMatch[importMatch.length - 1];
        const lastImportIndex = content.lastIndexOf(lastImport);
        content = content.slice(0, lastImportIndex + lastImport.length) + 
                  "\nimport logger from '@/lib/utils/logger';" +
                  content.slice(lastImportIndex + lastImport.length);
      }
    }
    
    // Replace console statements
    content = content.replace(/console\.log/g, 'logger.log');
    content = content.replace(/console\.warn/g, 'logger.warn');
    content = content.replace(/console\.error/g, 'logger.error');
    content = content.replace(/console\.info/g, 'logger.info');
    content = content.replace(/console\.debug/g, 'logger.debug');
    content = content.replace(/console\.table/g, 'logger.table');
    content = content.replace(/console\.time/g, 'logger.time');
    content = content.replace(/console\.timeEnd/g, 'logger.timeEnd');
    
    // Write back if changed
    if (content !== originalContent) {
      fs.writeFileSync(file, content);
      console.log(`✅ Updated ${path.relative(process.cwd(), file)} (${consoleCount} replacements)`);
      totalReplacements += consoleCount;
    }
  }
});

console.log(`\n🎉 Total replacements: ${totalReplacements} console statements across ${files.length} files`);
console.log('💡 Memory usage should now be significantly reduced in production builds');