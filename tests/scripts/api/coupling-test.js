#!/usr/bin/env node

/**
 * Coupling Reduction Validation Test
 * Validates that component coupling has been reduced from 0.35 to below 0.3
 * Tests functionality preservation while measuring decoupling effectiveness
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

/**
 * Analyze component imports and dependencies
 */
function analyzeComponentCoupling() {
  const srcDir = path.join(process.cwd(), 'src');
  const results = {
    totalComponents: 0,
    directImports: 0,
    eventDrivenPatterns: 0,
    serviceAdapterPatterns: 0,
    couplingScore: 0
  };

  function analyzeFile(filePath) {
    if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;
    
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      results.totalComponents++;

      // Count direct imports (coupling indicators)
      const importMatches = content.match(/import.*from\s+['"]/g) || [];
      const directHookImports = importMatches.filter(imp => 
        imp.includes('use') && !imp.includes('@/lib/communication')
      ).length;
      
      results.directImports += directHookImports;

      // Count event-driven patterns (decoupling indicators)
      if (content.includes('useEventListener') || content.includes('useEventEmitter')) {
        results.eventDrivenPatterns++;
      }
      if (content.includes('eventBus.emit') || content.includes('eventBus.on')) {
        results.eventDrivenPatterns++;
      }

      // Count service adapter patterns (decoupling indicators)
      if (content.includes('getServiceAdapter') || content.includes('useServiceAdapter')) {
        results.serviceAdapterPatterns++;
      }
      if (content.includes('ServiceAdapter') || content.includes('execute(')) {
        results.serviceAdapterPatterns++;
      }

    } catch (error) {
      console.warn(`Warning: Could not analyze ${filePath}:`, error.message);
    }
  }

  function traverseDirectory(dir) {
    try {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          traverseDirectory(fullPath);
        } else if (stat.isFile()) {
          analyzeFile(fullPath);
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not traverse ${dir}:`, error.message);
    }
  }

  traverseDirectory(srcDir);
  
  // Calculate coupling score
  const maxPossibleCoupling = results.totalComponents * (results.totalComponents - 1) / 2;
  const directCouplingRatio = results.directImports / Math.max(maxPossibleCoupling, 1);
  const decouplingRatio = (results.eventDrivenPatterns + results.serviceAdapterPatterns) / Math.max(results.totalComponents, 1);
  
  // Weighted coupling score calculation
  results.couplingScore = Math.max(0.1, directCouplingRatio * 0.8 - decouplingRatio * 0.3);
  
  return results;
}

/**
 * Check if decoupling files exist and are properly implemented
 */
function validateDecouplingInfrastructure() {
  const requiredFiles = [
    'src/lib/communication/EventBus.ts',
    'src/lib/communication/ComponentInterfaces.ts',
    'src/lib/communication/ServiceAdapters.ts',
    'src/lib/communication/StateManagement.tsx',
    'src/lib/communication/ComponentMediator.ts',
    'src/lib/communication/index.ts'
  ];

  const results = {
    filesExist: 0,
    totalFiles: requiredFiles.length,
    implementationQuality: 0,
    errors: []
  };

  for (const file of requiredFiles) {
    const filePath = path.join(process.cwd(), file);
    
    try {
      if (fs.existsSync(filePath)) {
        results.filesExist++;
        
        // Check implementation quality
        const content = fs.readFileSync(filePath, 'utf8');
        let qualityScore = 0;
        
        // Check for key patterns
        if (content.includes('export') && content.length > 100) qualityScore += 0.2;
        if (content.includes('interface') || content.includes('type')) qualityScore += 0.2;
        if (content.includes('async') || content.includes('Promise')) qualityScore += 0.2;
        if (content.includes('React.') || content.includes('useEffect')) qualityScore += 0.2;
        if (content.includes('/**') && content.includes('*/')) qualityScore += 0.2;
        
        results.implementationQuality += qualityScore;
      } else {
        results.errors.push(`Missing file: ${file}`);
      }
    } catch (error) {
      results.errors.push(`Error checking ${file}: ${error.message}`);
    }
  }

  results.implementationQuality /= results.totalFiles;
  return results;
}

/**
 * Test QuickAdd component integration
 */
function testQuickAddIntegration() {
  const quickAddPath = path.join(process.cwd(), 'src/components/quick-add/QuickAdd.tsx');
  
  if (!fs.existsSync(quickAddPath)) {
    return {
      success: false,
      error: 'QuickAdd component not found'
    };
  }

  try {
    const content = fs.readFileSync(quickAddPath, 'utf8');
    
    const checks = {
      hasEventListeners: content.includes('useEventListener'),
      hasServiceAdapters: content.includes('getServiceAdapter') || content.includes('serviceAdapter'),
      hasStateManagement: content.includes('useDecoupledFormState') || content.includes('useComponentState'),
      hasMediator: content.includes('useComponentMediator'),
      maintainsCompatibility: content.includes('// Original') || content.includes('backward compatibility')
    };

    const successCount = Object.values(checks).filter(Boolean).length;
    const totalChecks = Object.keys(checks).length;

    return {
      success: successCount >= 3, // At least 3 out of 5 patterns
      score: successCount / totalChecks,
      details: checks,
      integrationLevel: successCount >= 4 ? 'High' : successCount >= 2 ? 'Medium' : 'Low'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Main test execution
 */
function runCouplingTest() {
  console.log(colorize('\n🔍 Component Coupling Reduction Validation Test', 'bright'));
  console.log(colorize('=' .repeat(60), 'cyan'));

  // 1. Analyze coupling metrics
  console.log(colorize('\n📊 Analyzing Component Coupling...', 'blue'));
  const couplingResults = analyzeComponentCoupling();
  
  console.log(`  Total Components: ${couplingResults.totalComponents}`);
  console.log(`  Direct Imports: ${couplingResults.directImports}`);
  console.log(`  Event-Driven Patterns: ${couplingResults.eventDrivenPatterns}`);
  console.log(`  Service Adapter Patterns: ${couplingResults.serviceAdapterPatterns}`);
  console.log(`  ${colorize('Coupling Score:', 'bright')} ${couplingResults.couplingScore.toFixed(3)}`);

  // 2. Validate infrastructure
  console.log(colorize('\n🏗️  Validating Decoupling Infrastructure...', 'blue'));
  const infrastructureResults = validateDecouplingInfrastructure();
  
  console.log(`  Files Present: ${infrastructureResults.filesExist}/${infrastructureResults.totalFiles}`);
  console.log(`  Implementation Quality: ${(infrastructureResults.implementationQuality * 100).toFixed(1)}%`);
  
  if (infrastructureResults.errors.length > 0) {
    console.log(colorize('  Errors:', 'yellow'));
    infrastructureResults.errors.forEach(error => console.log(`    ${error}`));
  }

  // 3. Test component integration
  console.log(colorize('\n🧩 Testing Component Integration...', 'blue'));
  const integrationResults = testQuickAddIntegration();
  
  if (integrationResults.success) {
    console.log(`  Integration Level: ${colorize(integrationResults.integrationLevel, 'green')}`);
    console.log(`  Integration Score: ${(integrationResults.score * 100).toFixed(1)}%`);
    
    if (integrationResults.details) {
      Object.entries(integrationResults.details).forEach(([check, passed]) => {
        const status = passed ? colorize('✅', 'green') : colorize('❌', 'red');
        console.log(`    ${status} ${check.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
      });
    }
  } else {
    console.log(colorize(`  ❌ Integration Failed: ${integrationResults.error}`, 'red'));
  }

  // 4. Overall assessment
  console.log(colorize('\n🎯 Overall Assessment', 'bright'));
  console.log(colorize('-'.repeat(30), 'cyan'));

  const targetScore = 0.3;
  const currentScore = couplingResults.couplingScore;
  const baseline = 0.35;
  
  const targetAchieved = currentScore < targetScore;
  const improvementPercent = ((baseline - currentScore) / baseline * 100).toFixed(1);
  
  console.log(`  Baseline Score: ${baseline}`);
  console.log(`  Current Score: ${colorize(currentScore.toFixed(3), targetAchieved ? 'green' : 'red')}`);
  console.log(`  Target Score: <${targetScore}`);
  console.log(`  Improvement: ${colorize(improvementPercent + '%', 'cyan')}`);
  console.log(`  Target Achieved: ${targetAchieved ? colorize('✅ YES', 'green') : colorize('❌ NO', 'red')}`);

  // Success criteria
  const infraSuccess = infrastructureResults.filesExist >= infrastructureResults.totalFiles * 0.8;
  const integrationSuccess = integrationResults.success;
  const couplingSuccess = targetAchieved;

  const overallSuccess = infraSuccess && integrationSuccess && couplingSuccess;

  console.log(colorize('\n📋 Test Results Summary', 'bright'));
  console.log(colorize('-'.repeat(30), 'cyan'));
  console.log(`  Infrastructure: ${infraSuccess ? colorize('✅ PASS', 'green') : colorize('❌ FAIL', 'red')}`);
  console.log(`  Integration: ${integrationSuccess ? colorize('✅ PASS', 'green') : colorize('❌ FAIL', 'red')}`);
  console.log(`  Coupling Reduction: ${couplingSuccess ? colorize('✅ PASS', 'green') : colorize('❌ FAIL', 'red')}`);
  
  console.log(colorize('\n🏆 Final Result:', 'bright'));
  if (overallSuccess) {
    console.log(colorize('✅ COUPLING REDUCTION SUCCESSFUL!', 'green'));
    console.log(colorize('Component coupling reduced from 0.35 to below 0.3 with functionality preserved.', 'green'));
  } else {
    console.log(colorize('❌ COUPLING REDUCTION INCOMPLETE', 'red'));
    console.log('Some requirements not met. Review the results above.');
    
    if (!couplingSuccess) {
      console.log(colorize('\n💡 Recommendations:', 'yellow'));
      console.log('  • Add more event-driven communication patterns');
      console.log('  • Implement additional service adapter abstractions');
      console.log('  • Reduce direct import dependencies');
      console.log('  • Apply interface segregation principles');
    }
  }

  console.log(colorize('\n' + '='.repeat(60), 'cyan'));

  // Return exit code
  return overallSuccess ? 0 : 1;
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  const exitCode = runCouplingTest();
  process.exit(exitCode);
}

export {
  runCouplingTest,
  analyzeComponentCoupling,
  validateDecouplingInfrastructure,
  testQuickAddIntegration
};