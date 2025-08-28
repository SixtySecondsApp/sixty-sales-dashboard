const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ewtuefzeogytgmsnkpmb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dHVlZnplb2d5dGdtc25rcG1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc4OTQ5MjcsImV4cCI6MjA1MzQ3MDkyN30.O22Zx_xB_UuasB19V66g69fl6GdAdW38vuYQPbGUUf8'
);

async function getStages() {
  const { data: stages, error } = await supabase
    .from('deal_stages')
    .select('*')
    .order('order_position', { ascending: true });
  
  if (error) {
    console.log('Error:', error.message);
    return;
  }
  
  console.log('Current Deal Stages:');
  console.log('===================');
  stages.forEach(stage => {
    const isUnwanted = ['Lead', 'Qualified', 'Closed Won'].includes(stage.name);
    const marker = isUnwanted ? '❌ REMOVE' : '✅ KEEP';
    console.log(`${marker} ${stage.name} (ID: ${stage.id}) - Order: ${stage.order_position}`);
  });
  
  // Get the first non-unwanted stage to use as default
  const firstGoodStage = stages.find(s => !['Lead', 'Qualified', 'Closed Won'].includes(s.name));
  console.log('\n📋 Recommended default stage for API:');
  if (firstGoodStage) {
    console.log(`Use "${firstGoodStage.name}" (ID: ${firstGoodStage.id}) as default instead of "Lead"`);
  } else {
    console.log('No good stages found - you may need to create proper stages first');
  }
}

getStages();
