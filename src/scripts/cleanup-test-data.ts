/**
 * Script to clean up all test data from the database
 * Run this to remove any leftover test data from function tests
 */

import { cleanupAllTestData, getTestDataCounts } from '../lib/utils/testCleanup';

async function main() {
  console.log('🧹 Starting test data cleanup...');
  
  // First, show what we have
  console.log('📊 Checking for test data...');
  const counts = await getTestDataCounts();
  
  const totalTestItems = Object.values(counts).reduce((sum, count) => sum + count, 0);
  
  if (totalTestItems === 0) {
    console.log('✅ No test data found - database is clean!');
    return;
  }
  
  console.log('📊 Found test data:', counts);
  console.log(`📊 Total test items to clean: ${totalTestItems}`);
  
  // Perform cleanup
  console.log('🧹 Performing cleanup...');
  const result = await cleanupAllTestData();
  
  if (result.success) {
    const deletedTotal = Object.values(result.deletedCounts).reduce((sum, count) => sum + count, 0);
    console.log('✅ Cleanup successful!');
    console.log('📊 Deleted counts:', result.deletedCounts);
    console.log(`📊 Total items deleted: ${deletedTotal}`);
  } else {
    console.error('❌ Cleanup had errors:', result.errors);
    console.log('📊 Partial success - deleted counts:', result.deletedCounts);
  }
  
  // Verify cleanup
  console.log('🔍 Verifying cleanup...');
  const remainingCounts = await getTestDataCounts();
  const remainingTotal = Object.values(remainingCounts).reduce((sum, count) => sum + count, 0);
  
  if (remainingTotal === 0) {
    console.log('✅ Verification successful - no test data remains!');
  } else {
    console.warn('⚠️ Some test data may still remain:', remainingCounts);
  }
}

main().catch(console.error);