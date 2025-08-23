#!/usr/bin/env node

/**
 * Optimize date-fns imports across the codebase
 * Converts destructured imports to individual imports for better tree-shaking
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Function to optimize date-fns imports in a file
function optimizeDateFnsImports(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Match import statements from date-fns
  const importRegex = /import\s*{\s*([^}]+)\s*}\s*from\s*['"]date-fns['"]/g;
  
  content = content.replace(importRegex, (match, imports) => {
    modified = true;
    
    // Parse the imported functions
    const functions = imports
      .split(',')
      .map(fn => fn.trim())
      .filter(fn => fn);
    
    // Generate individual imports with proper syntax
    const individualImports = functions
      .map(fn => `import { ${fn} } from 'date-fns/${fn}';`)
      .join('\n');
    
    console.log(`  ✅ Optimized ${functions.length} imports in ${path.basename(filePath)}`);
    
    return individualImports;
  });
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  
  return false;
}

// Get all TypeScript/JavaScript files
function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Skip node_modules and dist
      if (!file.includes('node_modules') && !file.includes('dist') && !file.includes('.git')) {
        getAllFiles(filePath, fileList);
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.jsx') || file.endsWith('.js')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Main function
async function main() {
  const srcPath = path.join(__dirname, '..', 'src');
  
  console.log('🚀 Starting date-fns import optimization...\n');
  
  const files = getAllFiles(srcPath);
  let optimizedCount = 0;
  
  files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes("from 'date-fns'")) {
      if (optimizeDateFnsImports(file)) {
        optimizedCount++;
      }
    }
  });
  
  console.log(`\n✨ Optimization complete! Optimized ${optimizedCount} files.`);
  
  // Also create a centralized date utility file
  const dateUtilsPath = path.join(srcPath, 'lib', 'utils', 'dateUtils.ts');
  const dateUtilsContent = `/**
 * Centralized date utility functions
 * Pre-imports commonly used date-fns functions for better performance
 */

import format from 'date-fns/format';
import parseISO from 'date-fns/parseISO';
import isValid from 'date-fns/isValid';
import differenceInDays from 'date-fns/differenceInDays';
import addDays from 'date-fns/addDays';
import subDays from 'date-fns/subDays';
import startOfDay from 'date-fns/startOfDay';
import endOfDay from 'date-fns/endOfDay';
import startOfWeek from 'date-fns/startOfWeek';
import endOfWeek from 'date-fns/endOfWeek';
import startOfMonth from 'date-fns/startOfMonth';
import endOfMonth from 'date-fns/endOfMonth';
import addMonths from 'date-fns/addMonths';
import subMonths from 'date-fns/subMonths';
import isBefore from 'date-fns/isBefore';
import isAfter from 'date-fns/isAfter';
import isToday from 'date-fns/isToday';
import getDate from 'date-fns/getDate';

// Re-export for easy import
export {
  format,
  parseISO,
  isValid,
  differenceInDays,
  addDays,
  subDays,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  isBefore,
  isAfter,
  isToday,
  getDate
};

// Common date formatting functions
export const formatDate = (date: Date | string, formatStr: string = 'PPP') => {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return isValid(dateObj) ? format(dateObj, formatStr) : '';
};

export const formatRelativeTime = (date: Date | string) => {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  const days = differenceInDays(new Date(), dateObj);
  
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return \`\${days} days ago\`;
  if (days < 30) return \`\${Math.floor(days / 7)} weeks ago\`;
  if (days < 365) return \`\${Math.floor(days / 30)} months ago\`;
  return \`\${Math.floor(days / 365)} years ago\`;
};
`;
  
  fs.writeFileSync(dateUtilsPath, dateUtilsContent, 'utf8');
  console.log('\n📅 Created centralized dateUtils.ts for common date operations');
}

main().catch(console.error);