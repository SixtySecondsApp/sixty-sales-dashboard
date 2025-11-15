#!/usr/bin/env node

// Test the new Neon client to make sure it works before testing the React app
import { neonClient } from '../src/lib/database/neonClient.js';

async function testNeonClient() {
  try {
    // Test 1: Mock user
    const mockUser = neonClient.getMockUser();
    // Test 2: Companies
    const companiesResult = await neonClient.getCompanies({
      includeStats: true,
      limit: 3
    });
    // Test 3: Deals with relationships
    const dealsResult = await neonClient.getDealsWithRelationships('dev-user-123');
  } catch (error) {
  } finally {
    await neonClient.disconnect();
  }
}

testNeonClient(); 