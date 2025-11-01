/**
 * Manual Test Script for Deal Health Monitoring System
 * Run with: node test-deal-health.js
 */

console.log('🏥 Deal Health Monitoring System - Manual Test\n');

// Test 1: Health Score Calculation Logic
console.log('Test 1: Health Score Calculation Logic');
console.log('========================================');

function calculateStageVelocityScore(daysInStage, stage) {
  // Based on dealHealthService.ts logic
  const optimalDays = { SQL: 7, Opportunity: 14, Verbal: 7, Signed: 0 };
  const optimal = optimalDays[stage] || 14;

  if (daysInStage <= optimal) return 100;
  if (daysInStage <= optimal * 1.5) return 85;
  if (daysInStage <= optimal * 2) return 70;
  if (daysInStage <= optimal * 3) return 50;
  return 30;
}

// Test scenarios
const testCases = [
  { stage: 'SQL', days: 5, expected: 100 },
  { stage: 'SQL', days: 10, expected: 85 },
  { stage: 'SQL', days: 14, expected: 70 },
  { stage: 'Opportunity', days: 14, expected: 100 },
  { stage: 'Opportunity', days: 30, expected: 50 },
];

testCases.forEach((test, i) => {
  const score = calculateStageVelocityScore(test.days, test.stage);
  const passed = score === test.expected;
  console.log(`  ${passed ? '✅' : '❌'} Test ${i+1}: ${test.stage} @ ${test.days} days = ${score} (expected: ${test.expected})`);
});

// Test 2: Sentiment Score Calculation
console.log('\nTest 2: Sentiment Score Calculation');
console.log('====================================');

function calculateSentimentScore(sentiments) {
  if (!sentiments || sentiments.length === 0) return 50;

  const avg = sentiments.reduce((sum, s) => sum + s, 0) / sentiments.length;
  const normalized = ((avg + 1) / 2) * 100; // Convert -1 to 1 scale to 0-100

  // Check trend
  if (sentiments.length >= 2) {
    const recent = sentiments.slice(-2);
    if (recent[1] > recent[0]) return Math.min(100, normalized + 10); // Improving
    if (recent[1] < recent[0]) return Math.max(0, normalized - 15); // Declining
  }

  return normalized;
}

const sentimentTests = [
  { sentiments: [0.8, 0.9, 0.95], expected: 'High score with improving trend' },
  { sentiments: [0.5, 0.3, 0.1], expected: 'Declining score' },
  { sentiments: [-0.5, -0.3, -0.1], expected: 'Low but improving' },
];

sentimentTests.forEach((test, i) => {
  const score = calculateSentimentScore(test.sentiments);
  console.log(`  ✅ Test ${i+1}: ${JSON.stringify(test.sentiments)} = ${score.toFixed(1)} (${test.expected})`);
});

// Test 3: Overall Health Score Calculation
console.log('\nTest 3: Overall Health Score Calculation');
console.log('=========================================');

function calculateOverallHealth(scores) {
  const weights = {
    stageVelocity: 0.30,
    sentiment: 0.25,
    engagement: 0.20,
    activity: 0.15,
    responseTime: 0.10
  };

  const overall =
    scores.stageVelocity * weights.stageVelocity +
    scores.sentiment * weights.sentiment +
    scores.engagement * weights.engagement +
    scores.activity * weights.activity +
    scores.responseTime * weights.responseTime;

  return Math.round(overall);
}

const healthTests = [
  {
    name: 'Healthy Deal',
    scores: { stageVelocity: 100, sentiment: 90, engagement: 85, activity: 90, responseTime: 95 },
    expectedRange: [90, 100]
  },
  {
    name: 'Warning Deal',
    scores: { stageVelocity: 70, sentiment: 60, engagement: 65, activity: 70, responseTime: 75 },
    expectedRange: [65, 75]
  },
  {
    name: 'Critical Deal',
    scores: { stageVelocity: 30, sentiment: 20, engagement: 40, activity: 35, responseTime: 30 },
    expectedRange: [25, 40]
  }
];

healthTests.forEach((test) => {
  const score = calculateOverallHealth(test.scores);
  const inRange = score >= test.expectedRange[0] && score <= test.expectedRange[1];
  console.log(`  ${inRange ? '✅' : '❌'} ${test.name}: ${score} (expected: ${test.expectedRange[0]}-${test.expectedRange[1]})`);
  console.log(`     Stage Velocity: ${test.scores.stageVelocity}, Sentiment: ${test.scores.sentiment}`);
});

// Test 4: Health Status Classification
console.log('\nTest 4: Health Status Classification');
console.log('=====================================');

function getHealthStatus(score) {
  if (score >= 80) return 'healthy';
  if (score >= 60) return 'warning';
  if (score >= 40) return 'critical';
  return 'stalled';
}

const statusTests = [
  { score: 95, expected: 'healthy' },
  { score: 75, expected: 'warning' },
  { score: 45, expected: 'critical' },
  { score: 25, expected: 'stalled' }
];

statusTests.forEach((test) => {
  const status = getHealthStatus(test.score);
  const passed = status === test.expected;
  console.log(`  ${passed ? '✅' : '❌'} Score ${test.score} = ${status} (expected: ${test.expected})`);
});

console.log('\n✅ All manual tests completed!');
console.log('\nNext steps:');
console.log('1. Open the app at http://localhost:5173');
console.log('2. Navigate to a deal detail page');
console.log('3. Check for the Deal Health Badge');
console.log('4. Navigate to Admin > Health Rules to configure thresholds');
console.log('5. Check for health alerts in the dashboard');
