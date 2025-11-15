import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://dcqjcbagvnsjhmmvuhyp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjcWpjYmFndm5zamhtbXZ1aHlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjcyNzE4MDIsImV4cCI6MjA0Mjg0NzgwMn0.s18zlFdGzwWHPkr9e0s6BPT9DbB4lxCZJKoGAUpqHF4'
);

async function checkViewpointData() {
  // Get all sale activities for Viewpoint
  const { data: activities, error: activitiesError } = await supabase
    .from('activities')
    .select('*')
    .eq('type', 'sale')
    .eq('status', 'completed')
    .ilike('client_name', '%viewpoint%');
    
  if (activitiesError) {
    return;
  }
  activities?.forEach(activity => {
  });
  
  // Get all deals that might be related
  const { data: deals, error: dealsError } = await supabase
    .from('deals')
    .select('*')
    .or('company.ilike.%viewpoint%,name.ilike.%viewpoint%');
    
  if (dealsError) {
    return;
  }
  deals?.forEach(deal => {
  });
  
  // Check for the specific deal ID we saw
  const specificDealId = 'aa5e10';
  const { data: specificDeal, error: specificError } = await supabase
    .from('deals')
    .select('*')
    .ilike('id', `%${specificDealId}%`);
    
  if (!specificError && specificDeal) {
  }
}

checkViewpointData().catch(console.error);