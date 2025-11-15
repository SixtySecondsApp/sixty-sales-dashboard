import { createClient } from '@supabase/supabase-js';

// Test script to verify expected_close_date column functionality
async function testExpectedCloseDate() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  try {
    // 1. Check if the column exists in the schema
    const { data: tableInfo, error: schemaError } = await supabase
      .from('deals')
      .select('*')
      .limit(1);
    
    if (schemaError) {
      return;
    }
    // 2. Try to fetch deals with expected_close_date
    const { data: deals, error: fetchError } = await supabase
      .from('deals')
      .select('id, name, expected_close_date')
      .limit(5);
    
    if (fetchError) {
      return;
    }
    if (deals && deals.length > 0) {
    }

    // 3. Try to create a test deal with expected_close_date
    const testDeal = {
      name: 'Test Deal - Expected Close Date',
      company: 'Test Company',
      value: 1000,
      stage_id: '550e8400-e29b-41d4-a716-446655440000', // You may need to adjust this
      owner_id: '550e8400-e29b-41d4-a716-446655440001', // You may need to adjust this
      expected_close_date: '2024-12-31',
      status: 'active'
    };

    const { data: newDeal, error: createError } = await supabase
      .from('deals')
      .insert(testDeal)
      .select()
      .single();
    
    if (createError) {
    } else {
      // 4. Try to update the expected_close_date
      const { data: updatedDeal, error: updateError } = await supabase
        .from('deals')
        .update({ expected_close_date: '2025-01-15' })
        .eq('id', newDeal.id)
        .select()
        .single();
      
      if (updateError) {
      } else {
      }
      
      // Clean up: delete the test deal
      const { error: deleteError } = await supabase
        .from('deals')
        .delete()
        .eq('id', newDeal.id);
      
      if (deleteError) {
      } else {
      }
    }
  } catch (error) {
  }
}

// Run the test
testExpectedCloseDate(); 