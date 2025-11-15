/**
 * Script to clean up all test data from the database
 * Run this to remove any leftover test data from function tests
 */

import { cleanupAllTestData, getTestDataCounts } from '../lib/utils/testCleanup';

async function main() {
  // First, show what we have
  const counts = await getTestDataCounts();
  
  const totalTestItems = Object.values(counts).reduce((sum, count) => sum + count, 0);
  
  if (totalTestItems === 0) {
    return;
  }
  // Perform cleanup
  const result = await cleanupAllTestData();
  
  if (result.success) {
    const deletedTotal = Object.values(result.deletedCounts).reduce((sum, count) => sum + count, 0);
  } else {
  }
  
  // Verify cleanup
  const remainingCounts = await getTestDataCounts();
  const remainingTotal = Object.values(remainingCounts).reduce((sum, count) => sum + count, 0);
  
  if (remainingTotal === 0) {
  } else {
  }
}

main().catch(() => {});